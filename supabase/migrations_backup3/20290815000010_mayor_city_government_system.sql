-- Mayor + City Government system for MAI Troll
-- Implements mayor qualification, mayor allowance, town meetings, proposals, city openings, and newspaper content.

CREATE TABLE IF NOT EXISTS public.mayor_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  qualification_coin_total BIGINT NOT NULL DEFAULT 0,
  qualification_transaction_id UUID,
  term_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  term_ended_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mayor_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  qualification_coin_total BIGINT NOT NULL DEFAULT 0,
  qualification_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  account_standing TEXT NOT NULL DEFAULT 'good' CHECK (account_standing IN ('good','review','restricted')),
  mayor_term_id UUID REFERENCES public.mayor_terms(id) ON DELETE SET NULL,
  rank_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.mayor_coin_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mayor_term_id UUID NOT NULL REFERENCES public.mayor_terms(id) ON DELETE CASCADE,
  allowance_amount BIGINT NOT NULL DEFAULT 0,
  remaining_allowance BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','used')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mayor_coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mayor_term_id UUID NOT NULL REFERENCES public.mayor_terms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remaining_allowance BIGINT NOT NULL DEFAULT 0,
  transaction_id UUID,
  reversal_status TEXT NOT NULL DEFAULT 'none' CHECK (reversal_status IN ('none','pending','reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mayor_frontend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mayor_term_id UUID REFERENCES public.mayor_terms(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  change_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','active','expired','revoked')),
  reviewed_by UUID REFERENCES public.user_profiles(id),
  review_notes TEXT,
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.town_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  agenda TEXT NOT NULL,
  proposal_id UUID,
  scheduled_duration_minutes INTEGER DEFAULT 60,
  meeting_type TEXT NOT NULL DEFAULT 'general' CHECK (meeting_type IN ('general','emergency','budget','public_safety','platform_update','election','community','court_review')),
  seat_roles JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  room_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_ended BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES public.user_profiles(id),
  livekit_room_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.town_meeting_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.town_meetings(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  display_role TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES public.user_profiles(id),
  participant_identity TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, seat_number),
  UNIQUE (meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.town_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.town_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.government_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  submitted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  submitter_role TEXT NOT NULL,
  mayor_term_id UUID REFERENCES public.mayor_terms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','under_review','public_vote','approved','rejected','implemented','expired','revoked')),
  public_visibility BOOLEAN NOT NULL DEFAULT true,
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  staff_review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.user_profiles(id),
  review_notes TEXT,
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.government_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.government_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('for','against')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.city_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  application_route TEXT,
  posted_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.user_profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','filled','cancelled')),
  opening_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_date TIMESTAMPTZ,
  number_of_positions INTEGER NOT NULL DEFAULT 1,
  role_type TEXT NOT NULL DEFAULT 'community',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.city_newspaper_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  article_type TEXT NOT NULL DEFAULT 'announcement',
  mayor_term_id UUID REFERENCES public.mayor_terms(id) ON DELETE SET NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.government_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.user_profiles(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mayor_terms_status ON public.mayor_terms(status);
CREATE INDEX IF NOT EXISTS idx_mayor_terms_user ON public.mayor_terms(user_id);
CREATE INDEX IF NOT EXISTS idx_mayor_eligibility_total ON public.mayor_eligibility(qualification_coin_total DESC);
CREATE INDEX IF NOT EXISTS idx_mayor_coin_txn_term ON public.mayor_coin_transactions(mayor_term_id);
CREATE INDEX IF NOT EXISTS idx_town_meetings_active ON public.town_meetings(is_active, is_ended);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON public.government_proposals(status);
CREATE INDEX IF NOT EXISTS idx_city_openings_status ON public.city_openings(status);

ALTER TABLE public.mayor_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayor_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayor_coin_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayor_coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayor_frontend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.town_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.town_meeting_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.town_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_newspaper_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active mayor terms" ON public.mayor_terms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can view mayor eligibility" ON public.mayor_eligibility FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view mayor coin transactions" ON public.mayor_coin_transactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view town meetings" ON public.town_meetings FOR SELECT USING (true);
CREATE POLICY "Anyone can view meeting seats" ON public.town_meeting_seats FOR SELECT USING (true);
CREATE POLICY "Anyone can view meeting participants" ON public.town_meeting_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can view proposals" ON public.government_proposals FOR SELECT USING (public_visibility = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view votes" ON public.government_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can view openings" ON public.city_openings FOR SELECT USING (status IN ('open','closed','filled'));
CREATE POLICY "Anyone can view newspaper articles" ON public.city_newspaper_articles FOR SELECT USING (true);
CREATE POLICY "Staff can manage mayor records" ON public.mayor_terms FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
        OR up.is_admin = true
        OR up.is_staff = true
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
        OR up.is_admin = true
        OR up.is_staff = true
      )
  )
);

CREATE POLICY "Staff can manage proposals" ON public.government_proposals FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
        OR up.is_admin = true
        OR up.is_staff = true
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
        OR up.is_admin = true
        OR up.is_staff = true
      )
  )
);

CREATE POLICY "Users can create their own votes" ON public.government_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own votes" ON public.government_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own openings" ON public.city_openings FOR INSERT WITH CHECK (auth.uid() = posted_by);

CREATE OR REPLACE FUNCTION public.get_mayor_eligibility_total(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(gl.amount), 0)::bigint
  FROM public.gift_ledger gl
  WHERE gl.receiver_id = p_user_id
    AND gl.sender_id IS DISTINCT FROM p_user_id
    AND gl.status = 'processed'
    AND COALESCE(gl.metadata->>'reversed', 'false')::boolean = false
    AND COALESCE(gl.metadata->>'is_test', 'false')::boolean = false
    AND COALESCE(gl.metadata->>'is_admin', 'false')::boolean = false
    AND COALESCE(gl.metadata->>'is_promotional', 'false')::boolean = false
    AND COALESCE(gl.metadata->>'is_mayor_promo', 'false')::boolean = false;
$$;

CREATE OR REPLACE FUNCTION public._user_is_mayor_blocked(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND (
        up.username IS NULL
        OR length(trim(up.username)) = 0
      )
  ) INTO v_exists;
  IF v_exists THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_banned'
  ) THEN
    EXECUTE format('SELECT COALESCE(BOOL_OR(is_banned), false) FROM public.user_profiles WHERE id = %L', p_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN true;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'broadcast_suspended'
  ) THEN
    EXECUTE format('SELECT COALESCE(BOOL_OR(broadcast_suspended), false) FROM public.user_profiles WHERE id = %L', p_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN true;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'fraud_investigation'
  ) THEN
    EXECUTE format('SELECT COALESCE(BOOL_OR(fraud_investigation), false) FROM public.user_profiles WHERE id = %L', p_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN true;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'coin_manipulation_flagged'
  ) THEN
    EXECUTE format('SELECT COALESCE(BOOL_OR(coin_manipulation_flagged), false) FROM public.user_profiles WHERE id = %L', p_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN true;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_test_account'
  ) THEN
    EXECUTE format('SELECT COALESCE(BOOL_OR(is_test_account), false) FROM public.user_profiles WHERE id = %L', p_user_id) INTO v_exists;
    IF v_exists THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mayor_eligibility(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_total bigint;
  v_ref_id uuid;
  v_existing uuid;
BEGIN
  FOR v_user_id IN
    SELECT up.id
    FROM public.user_profiles up
    WHERE p_user_id IS NULL OR up.id = p_user_id
  LOOP
    IF public._user_is_mayor_blocked(v_user_id) THEN
      CONTINUE;
    END IF;

    v_total := public.get_mayor_eligibility_total(v_user_id);
    IF v_total < 10000 THEN
      DELETE FROM public.mayor_eligibility WHERE user_id = v_user_id;
      CONTINUE;
    END IF;

    SELECT gl.id INTO v_ref_id
    FROM public.gift_ledger gl
    WHERE gl.receiver_id = v_user_id
      AND gl.sender_id IS DISTINCT FROM v_user_id
      AND gl.status = 'processed'
      AND COALESCE(gl.metadata->>'reversed', 'false')::boolean = false
    ORDER BY gl.created_at ASC
    LIMIT 1;

    INSERT INTO public.mayor_eligibility (user_id, qualification_coin_total, qualification_timestamp, account_standing, rank_position, created_at, updated_at)
    VALUES (v_user_id, v_total, NOW(), 'good', 0, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      qualification_coin_total = EXCLUDED.qualification_coin_total,
      qualification_timestamp = EXCLUDED.qualification_timestamp,
      updated_at = NOW();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_mayor(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_term public.mayor_terms%ROWTYPE;
  v_user public.user_profiles%ROWTYPE;
  v_total bigint;
  v_ref_id uuid;
  v_term_id uuid;
BEGIN
  SELECT * INTO v_active_term
  FROM public.mayor_terms
  WHERE status = 'active'
    AND term_ended_at > NOW()
  ORDER BY term_started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'active_mayor_exists');
  END IF;

  SELECT * INTO v_user
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;

  IF public._user_is_mayor_blocked(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_blocked');
  END IF;

  v_total := public.get_mayor_eligibility_total(p_user_id);
  IF v_total < 10000 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_qualification', 'qualification_total', v_total);
  END IF;

  SELECT gl.id INTO v_ref_id
  FROM public.gift_ledger gl
  WHERE gl.receiver_id = p_user_id
    AND gl.sender_id IS DISTINCT FROM p_user_id
    AND gl.status = 'processed'
    AND COALESCE(gl.metadata->>'reversed', 'false')::boolean = false
  ORDER BY gl.created_at ASC
  LIMIT 1;

  INSERT INTO public.mayor_terms (user_id, qualification_coin_total, qualification_transaction_id, term_started_at, term_ended_at, status, created_at, updated_at)
  VALUES (p_user_id, v_total, v_ref_id, NOW(), NOW() + INTERVAL '30 days', 'active', NOW(), NOW())
  RETURNING id INTO v_term_id;

  INSERT INTO public.mayor_eligibility (user_id, qualification_coin_total, qualification_timestamp, account_standing, mayor_term_id, rank_position, created_at, updated_at)
  VALUES (p_user_id, v_total, NOW(), 'good', v_term_id, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    qualification_coin_total = EXCLUDED.qualification_coin_total,
    mayor_term_id = EXCLUDED.mayor_term_id,
    rank_position = EXCLUDED.rank_position,
    updated_at = NOW();

  INSERT INTO public.mayor_coin_allowances (mayor_term_id, allowance_amount, remaining_allowance, status, created_at, updated_at)
  VALUES (v_term_id, 5000, 5000, 'active', NOW(), NOW());

  INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
  VALUES (p_user_id, 'mayor_activated', 'mayor_terms', v_term_id, jsonb_build_object('user_id', p_user_id, 'qualification_total', v_total), NOW());

  RETURN jsonb_build_object('success', true, 'term_id', v_term_id, 'qualification_total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_mayor_terms()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term public.mayor_terms%ROWTYPE;
  v_next_user uuid;
BEGIN
  FOR v_term IN
    SELECT *
    FROM public.mayor_terms
    WHERE status = 'active'
      AND term_ended_at <= NOW()
    ORDER BY term_started_at ASC
  LOOP
    UPDATE public.mayor_terms
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_term.id;

    UPDATE public.mayor_coin_allowances
    SET status = 'expired', updated_at = NOW()
    WHERE mayor_term_id = v_term.id;

    INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
    VALUES (v_term.user_id, 'mayor_expired', 'mayor_terms', v_term.id, jsonb_build_object('ended_at', v_term.term_ended_at), NOW());
  END LOOP;

  SELECT user_id INTO v_next_user
  FROM public.mayor_eligibility
  WHERE qualification_coin_total >= 10000
  ORDER BY qualification_coin_total DESC, qualification_timestamp ASC
  LIMIT 1;

  IF v_next_user IS NOT NULL THEN
    PERFORM public.activate_mayor(v_next_user);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_mayor_promotional_coins(
  p_recipient_id uuid,
  p_amount bigint,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mayor_term public.mayor_terms%ROWTYPE;
  v_allowance public.mayor_coin_allowances%ROWTYPE;
  v_recipient public.user_profiles%ROWTYPE;
  v_total bigint;
  v_tx_id uuid;
  v_remaining bigint;
BEGIN
  IF p_recipient_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_request');
  END IF;

  IF p_recipient_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cannot_send_to_self');
  END IF;

  SELECT * INTO v_mayor_term
  FROM public.mayor_terms
  WHERE user_id = auth.uid()
    AND status = 'active'
    AND term_started_at <= NOW()
    AND term_ended_at > NOW()
  ORDER BY term_started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_active_mayor');
  END IF;

  SELECT * INTO v_allowance
  FROM public.mayor_coin_allowances
  WHERE mayor_term_id = v_mayor_term.id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'allowance_missing');
  END IF;

  IF v_allowance.remaining_allowance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'allowance_insufficient');
  END IF;

  SELECT * INTO v_recipient
  FROM public.user_profiles
  WHERE id = p_recipient_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'recipient_not_found');
  END IF;

  v_remaining := v_allowance.remaining_allowance - p_amount;

  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id)
  VALUES (p_recipient_id, p_amount, 'promo', 'mayor_promo', gen_random_uuid());

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + p_amount
  WHERE id = p_recipient_id;

  UPDATE public.mayor_coin_allowances
  SET remaining_allowance = v_remaining,
      status = CASE WHEN v_remaining <= 0 THEN 'used' ELSE 'active' END,
      updated_at = NOW()
  WHERE id = v_allowance.id;

  INSERT INTO public.mayor_coin_transactions (
    mayor_term_id,
    sender_id,
    recipient_id,
    amount,
    reason,
    remaining_allowance,
    transaction_id,
    created_at
  )
  VALUES (
    v_mayor_term.id,
    auth.uid(),
    p_recipient_id,
    p_amount,
    p_reason,
    v_remaining,
    gen_random_uuid(),
    NOW()
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
  VALUES (auth.uid(), 'mayor_coin_sent', 'mayor_coin_transactions', v_tx_id, jsonb_build_object('recipient_id', p_recipient_id, 'amount', p_amount), NOW());

  RETURN jsonb_build_object('success', true, 'remaining_allowance', v_remaining, 'transaction_id', v_tx_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_town_meeting(
  p_title text,
  p_topic text,
  p_agenda text,
  p_meeting_type text,
  p_scheduled_duration_minutes integer,
  p_seat_roles jsonb,
  p_proposal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_existing public.town_meetings%ROWTYPE;
  v_meeting_id uuid;
  v_role text;
BEGIN
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF NOT (
    v_profile.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
    OR v_profile.is_admin = true
    OR v_profile.is_staff = true
    OR v_profile.is_secretary = true
    OR v_profile.is_troll_officer = true
    OR v_profile.is_lead_officer = true
    OR v_profile.is_prosecutor = true
    OR v_profile.is_attorney = true
    OR EXISTS (
      SELECT 1 FROM public.mayor_terms mt
      WHERE mt.user_id = auth.uid() AND mt.status = 'active' AND mt.term_ended_at > NOW()
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO v_existing
  FROM public.town_meetings
  WHERE is_active = true AND is_ended = false
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND NOT (
    v_profile.role IN ('admin','owner','ceo') OR v_profile.is_admin = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'meeting_already_active');
  END IF;

  INSERT INTO public.town_meetings (
    title,
    topic,
    agenda,
    proposal_id,
    scheduled_duration_minutes,
    meeting_type,
    seat_roles,
    started_by,
    room_name,
    is_active,
    is_ended,
    started_at,
    livekit_room_name,
    created_at,
    updated_at
  )
  VALUES (
    p_title,
    p_topic,
    p_agenda,
    p_proposal_id,
    COALESCE(p_scheduled_duration_minutes, 60),
    COALESCE(p_meeting_type, 'general'),
    COALESCE(p_seat_roles, '{}'::jsonb),
    auth.uid(),
    'town-meeting-' || gen_random_uuid()::text,
    true,
    false,
    NOW(),
    'town-meeting-' || gen_random_uuid()::text,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_meeting_id;

  INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
  VALUES (auth.uid(), 'town_meeting_started', 'town_meetings', v_meeting_id, jsonb_build_object('title', p_title), NOW());

  RETURN jsonb_build_object('success', true, 'meeting_id', v_meeting_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_town_meeting_seat(
  p_meeting_id uuid,
  p_seat_number integer,
  p_display_role text,
  p_participant_identity text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.town_meetings%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
  v_existing public.town_meeting_seats%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting
  FROM public.town_meetings
  WHERE id = p_meeting_id AND is_active = true AND is_ended = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'meeting_not_active');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF NOT (
    v_profile.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
    OR v_profile.is_admin = true
    OR v_profile.is_staff = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO v_existing
  FROM public.town_meeting_seats
  WHERE meeting_id = p_meeting_id AND user_id = auth.uid() AND left_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  INSERT INTO public.town_meeting_seats (meeting_id, seat_number, user_id, display_role, participant_identity, joined_at, created_at)
  VALUES (p_meeting_id, p_seat_number, auth.uid(), COALESCE(p_display_role, v_profile.role), COALESCE(p_participant_identity, auth.uid()::text), NOW(), NOW());

  INSERT INTO public.town_meeting_participants (meeting_id, user_id, role, joined_at, created_at)
  VALUES (p_meeting_id, auth.uid(), COALESCE(p_display_role, v_profile.role), NOW(), NOW())
  ON CONFLICT (meeting_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.end_town_meeting(p_meeting_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.town_meetings%ROWTYPE;
  v_profile public.user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting
  FROM public.town_meetings
  WHERE id = p_meeting_id AND is_active = true AND is_ended = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'meeting_not_found');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF NOT (
    v_meeting.started_by = auth.uid()
    OR v_profile.role IN ('admin','owner','ceo')
    OR v_profile.is_admin = true
    OR EXISTS (
      SELECT 1 FROM public.mayor_terms mt
      WHERE mt.user_id = auth.uid() AND mt.status = 'active' AND mt.term_ended_at > NOW()
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  UPDATE public.town_meetings
  SET is_active = false, is_ended = true, ended_at = NOW(), ended_by = auth.uid(), updated_at = NOW()
  WHERE id = p_meeting_id;

  UPDATE public.town_meeting_seats
  SET left_at = NOW()
  WHERE meeting_id = p_meeting_id AND left_at IS NULL;

  INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
  VALUES (auth.uid(), 'town_meeting_ended', 'town_meetings', p_meeting_id, jsonb_build_object('ended_by', auth.uid()), NOW());

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_government_proposal(
  p_title text,
  p_description text,
  p_category text,
  p_submitter_role text,
  p_public_visibility boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_proposal_id uuid;
BEGIN
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  IF NOT (
    v_profile.role IN ('admin','owner','ceo','staff','secretary','lead_troll_officer','troll_officer','prosecutor','attorney')
    OR v_profile.is_admin = true
    OR v_profile.is_staff = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  INSERT INTO public.government_proposals (
    title,
    description,
    category,
    submitted_by,
    submitter_role,
    public_visibility,
    created_at,
    updated_at
  )
  VALUES (
    p_title,
    p_description,
    COALESCE(p_category, 'general'),
    auth.uid(),
    COALESCE(p_submitter_role, v_profile.role),
    COALESCE(p_public_visibility, true),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_proposal_id;

  INSERT INTO public.government_audit_log (actor_id, action, target_type, target_id, details, created_at)
  VALUES (auth.uid(), 'proposal_submitted', 'government_proposals', v_proposal_id, jsonb_build_object('title', p_title), NOW());

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_mayor_frontend_request(
  p_change_type text,
  p_change_payload jsonb,
  p_mayor_term_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term public.mayor_terms%ROWTYPE;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_term
  FROM public.mayor_terms
  WHERE user_id = auth.uid() AND status = 'active' AND term_ended_at > NOW()
  ORDER BY term_started_at DESC
  LIMIT 1;

  IF NOT FOUND AND p_mayor_term_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_active_mayor');
  END IF;

  INSERT INTO public.mayor_frontend_requests (
    requested_by,
    mayor_term_id,
    change_type,
    change_payload,
    status,
    created_at,
    updated_at
  )
  VALUES (
    auth.uid(),
    COALESCE(p_mayor_term_id, v_term.id),
    p_change_type,
    COALESCE(p_change_payload, '{}'::jsonb),
    'submitted',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES ('mayor_term_coin_allowance', '{"value": 5000, "enabled": true}', 'Mayor free promotional coin allowance per active term')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

GRANT EXECUTE ON FUNCTION public.get_mayor_eligibility_total(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._user_is_mayor_blocked(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_mayor_eligibility(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_mayor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_mayor_terms() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_mayor_promotional_coins(uuid, bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_town_meeting(text, text, text, text, integer, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_town_meeting_seat(uuid, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.end_town_meeting(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_government_proposal(text, text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_mayor_frontend_request(text, jsonb, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
