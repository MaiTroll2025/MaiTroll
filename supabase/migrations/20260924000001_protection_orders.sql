-- MaiTroll Protection Orders: UUID identity, transactional filing, court decisions,
-- active-order enforcement, violation audit, and three-strike detention.
BEGIN;

CREATE TABLE IF NOT EXISTS public.protection_order_username_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_uuid, username, valid_from)
);
CREATE INDEX IF NOT EXISTS idx_protection_username_history_lookup
  ON public.protection_order_username_history (lower(username), valid_until);

CREATE TABLE IF NOT EXISTS public.protection_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE DEFAULT ('PO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  petitioner_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDING_HEARING' CHECK (status IN ('PENDING_HEARING', 'DENIED', 'GRANTED', 'ACTIVE', 'EXPIRED')),
  filed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filing_fee INTEGER NOT NULL CHECK (filing_fee >= 100),
  hearing_date DATE NOT NULL,
  expedited_requested BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (petitioner_uuid, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_protection_orders_petitioner ON public.protection_orders(petitioner_uuid, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_protection_orders_status ON public.protection_orders(status, expires_at);

CREATE TABLE IF NOT EXISTS public.protection_order_respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_order_id UUID NOT NULL REFERENCES public.protection_orders(id) ON DELETE CASCADE,
  respondent_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  username_at_filing TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (protection_order_id, respondent_uuid)
);
CREATE INDEX IF NOT EXISTS idx_protection_order_respondents_uuid ON public.protection_order_respondents(respondent_uuid);

CREATE TABLE IF NOT EXISTS public.protection_order_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_order_id UUID NOT NULL REFERENCES public.protection_orders(id) ON DELETE RESTRICT,
  respondent_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  violating_account_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  violation_type TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  strike_number INTEGER NOT NULL CHECK (strike_number BETWEEN 1 AND 3),
  enforcement_action TEXT NOT NULL DEFAULT 'RECORDED',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_protection_order_violations_account ON public.protection_order_violations(violating_account_uuid, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.protection_order_detentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_uuid UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  detention_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detention_expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  related_protection_order_id UUID REFERENCES public.protection_orders(id) ON DELETE SET NULL,
  violation_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_protection_order_detentions_active ON public.protection_order_detentions(account_uuid, detention_expires_at);

ALTER TABLE public.protection_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_order_respondents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_order_username_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_order_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protection_order_detentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protection_orders_participant_read ON public.protection_orders;
CREATE POLICY protection_orders_participant_read ON public.protection_orders FOR SELECT USING (
  petitioner_uuid = auth.uid() OR public.is_modo_role(auth.uid())
);
DROP POLICY IF EXISTS protection_order_respondents_participant_read ON public.protection_order_respondents;
CREATE POLICY protection_order_respondents_participant_read ON public.protection_order_respondents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.protection_orders po WHERE po.id = protection_order_id AND (po.petitioner_uuid = auth.uid() OR public.is_modo_role(auth.uid())))
);
DROP POLICY IF EXISTS protection_order_detention_owner_read ON public.protection_order_detentions;
CREATE POLICY protection_order_detention_owner_read ON public.protection_order_detentions FOR SELECT USING (account_uuid = auth.uid() OR public.is_modo_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_protection_order_hearing(p_expedited BOOLEAN DEFAULT false)
RETURNS DATE LANGUAGE plpgsql STABLE AS $$
DECLARE v_date DATE := CURRENT_DATE; v_dow INT;
BEGIN
  IF p_expedited THEN RETURN v_date; END IF;
  v_dow := EXTRACT(ISODOW FROM v_date)::INT;
  IF v_dow <= 2 THEN RETURN v_date + (4 - v_dow); END IF;
  IF v_dow = 3 OR v_dow = 4 THEN RETURN v_date + (4 - v_dow); END IF;
  IF v_dow = 5 OR v_dow = 6 THEN RETURN v_date + (9 - v_dow); END IF;
  RETURN v_date + 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_protection_order_users(p_username TEXT)
RETURNS TABLE(id UUID, username TEXT, avatar_url TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT up.id, up.username, up.avatar_url
  FROM public.user_profiles up
  WHERE lower(up.username) LIKE '%' || lower(trim(p_username)) || '%'
  UNION
  SELECT up.id, up.username, up.avatar_url
  FROM public.protection_order_username_history h
  JOIN public.user_profiles up ON up.id = h.user_uuid
  WHERE h.valid_until >= now()
    AND lower(h.username) LIKE '%' || lower(trim(p_username)) || '%'
  ORDER BY username
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_protection_order_users(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.file_protection_order(
  p_respondent_ids UUID[],
  p_idempotency_key UUID,
  p_expedited BOOLEAN DEFAULT false
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_petitioner UUID := auth.uid(); v_fee INTEGER; v_case UUID; v_hearing DATE; v_count INTEGER;
  v_balance INTEGER; v_respondent UUID; v_username TEXT; v_payment BOOLEAN;
BEGIN
  IF v_petitioner IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated'); END IF;
  SELECT id INTO v_case FROM public.protection_orders WHERE petitioner_uuid = v_petitioner AND idempotency_key = p_idempotency_key;
  IF v_case IS NOT NULL THEN
    SELECT hearing_date INTO v_hearing FROM public.protection_orders WHERE id = v_case;
    RETURN jsonb_build_object('success', true, 'case_id', v_case, 'hearing_date', v_hearing, 'duplicate', true);
  END IF;
  SELECT count(DISTINCT value)::INT INTO v_count FROM unnest(p_respondent_ids) AS value WHERE value <> v_petitioner;
  IF v_count < 1 THEN RETURN jsonb_build_object('success', false, 'message', 'Select at least one respondent'); END IF;
  IF v_count <> cardinality(p_respondent_ids) THEN RETURN jsonb_build_object('success', false, 'message', 'Respondents must be unique and cannot include you'); END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_respondent_ids) r WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = r)) THEN
    RETURN jsonb_build_object('success', false, 'message', 'One or more respondents could not be resolved');
  END IF;
  v_fee := 100 + ((v_count - 1) * 10);
  v_hearing := public.next_protection_order_hearing(p_expedited);
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_petitioner FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_fee THEN RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins'); END IF;

  INSERT INTO public.protection_orders (petitioner_uuid, filing_fee, hearing_date, expedited_requested, idempotency_key)
  VALUES (v_petitioner, v_fee, v_hearing, p_expedited, p_idempotency_key) RETURNING id INTO v_case;
  FOREACH v_respondent IN ARRAY p_respondent_ids LOOP
    SELECT username INTO v_username FROM public.user_profiles WHERE id = v_respondent;
    INSERT INTO public.protection_order_respondents (protection_order_id, respondent_uuid, username_at_filing)
    VALUES (v_case, v_respondent, COALESCE(v_username, 'unknown'));
  END LOOP;
  SELECT public.try_pay_coins_secure(v_fee, 'protection_order_filing', jsonb_build_object('protection_order_id', v_case, 'respondent_count', v_count)) INTO v_payment;
  IF NOT COALESCE(v_payment, false) THEN RAISE EXCEPTION 'Troll Coin payment failed'; END IF;
  RETURN jsonb_build_object('success', true, 'case_id', v_case, 'case_number', (SELECT case_number FROM public.protection_orders WHERE id = v_case), 'hearing_date', v_hearing, 'filing_fee', v_fee);
END;
$$;
GRANT EXECUTE ON FUNCTION public.file_protection_order(UUID[], UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_protection_order_active(p_requesting_user UUID, p_target_user UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.protection_orders SET status = 'EXPIRED', updated_at = now()
  WHERE status IN ('GRANTED', 'ACTIVE') AND expires_at IS NOT NULL AND expires_at <= now();
  RETURN EXISTS (
    SELECT 1 FROM public.protection_orders po
    JOIN public.protection_order_respondents por ON por.protection_order_id = po.id
    WHERE po.petitioner_uuid = p_target_user AND por.respondent_uuid = p_requesting_user
      AND po.status IN ('GRANTED', 'ACTIVE') AND po.expires_at > now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_protection_order_active(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_protection_order(p_order_id UUID, p_grant BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor UUID := auth.uid(); v_granted TIMESTAMPTZ := now(); v_expires TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL OR NOT public.is_modo_role(v_actor) THEN RETURN jsonb_build_object('success', false, 'message', 'Not authorized'); END IF;
  IF p_grant THEN
    v_expires := v_granted + interval '6 months';
    UPDATE public.protection_orders SET status = 'ACTIVE', granted_at = v_granted, expires_at = v_expires, updated_at = now() WHERE id = p_order_id AND status = 'PENDING_HEARING';
  ELSE
    UPDATE public.protection_orders SET status = 'DENIED', updated_at = now() WHERE id = p_order_id AND status = 'PENDING_HEARING';
  END IF;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Case is no longer pending'); END IF;
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_grant THEN 'ACTIVE' ELSE 'DENIED' END, 'granted_at', v_granted, 'expires_at', v_expires);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decide_protection_order(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_protection_order_violation(
  p_order_id UUID, p_violating_account UUID, p_violation_type TEXT, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor UUID := auth.uid(); v_respondent UUID; v_strike INT; v_action TEXT := 'RECORDED';
BEGIN
  IF v_actor IS NULL OR (v_actor <> p_violating_account AND NOT public.is_modo_role(v_actor)) THEN RETURN jsonb_build_object('success', false, 'message', 'Not authorized'); END IF;
  SELECT por.respondent_uuid INTO v_respondent FROM public.protection_order_respondents por WHERE por.protection_order_id = p_order_id LIMIT 1;
  IF NOT public.is_protection_order_active(p_violating_account, (SELECT petitioner_uuid FROM public.protection_orders WHERE id = p_order_id)) THEN RETURN jsonb_build_object('success', false, 'message', 'Order is not active'); END IF;
  SELECT LEAST(COUNT(*) + 1, 3)::INT INTO v_strike FROM public.protection_order_violations WHERE protection_order_id = p_order_id AND violating_account_uuid = p_violating_account;
  IF v_strike = 3 THEN
    v_action := '14_DAY_TROLL_COURT_DETENTION';
    INSERT INTO public.protection_order_detentions (account_uuid, detention_expires_at, reason, related_protection_order_id, violation_count)
    VALUES (p_violating_account, now() + interval '14 days', 'Three confirmed protection-order violations', p_order_id, v_strike);
  END IF;
  INSERT INTO public.protection_order_violations (protection_order_id, respondent_uuid, violating_account_uuid, violation_type, strike_number, enforcement_action, metadata)
  VALUES (p_order_id, v_respondent, p_violating_account, p_violation_type, v_strike, v_action, p_metadata);
  RETURN jsonb_build_object('success', true, 'strike_number', v_strike, 'enforcement_action', v_action);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_protection_order_violation(UUID, UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_protection_order_staff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_staff(
    'protection_order_filed',
    'Protection Order Filed',
    'A new Protection Order requires court review. Case: ' || NEW.case_number,
    jsonb_build_object(
      'protection_order_id', NEW.id,
      'case_number', NEW.case_number,
      'petitioner_uuid', NEW.petitioner_uuid,
      'hearing_date', NEW.hearing_date,
      'expedited', NEW.expedited_requested,
      'route', '/troll-court'
    )
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_protection_order_staff ON public.protection_orders;
CREATE TRIGGER trg_notify_protection_order_staff
  AFTER INSERT ON public.protection_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_protection_order_staff();

CREATE OR REPLACE FUNCTION public.capture_protection_order_username_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username AND OLD.username IS NOT NULL THEN
    INSERT INTO public.protection_order_username_history (user_uuid, username, valid_from, valid_until)
    VALUES (NEW.id, OLD.username, now() - interval '1 second', now() + interval '30 days');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_capture_protection_order_username_change ON public.user_profiles;
CREATE TRIGGER trg_capture_protection_order_username_change AFTER UPDATE OF username ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.capture_protection_order_username_change();

COMMIT;
