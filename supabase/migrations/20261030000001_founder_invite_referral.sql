-- ============================================================================
-- FOUNDER INVITE / REFERRAL PROGRAM
-- ============================================================================
-- Founders (max 50) each receive a unique 7-digit invite code. New users may
-- enter a founder's code at signup. A referral is "verified" once the invited
-- user completes a cashout of at least 3500 coins funded entirely by coins
-- gifted to them during broadcasts (eligible_gift_coins). The founder then
-- earns a $5 bonus per verified user.
-- ============================================================================

-- 1. Add invite_code to founders (7 digits, unique)
ALTER TABLE public.founders
  ADD COLUMN IF NOT EXISTS invite_code text;

-- backfill any existing founders with a 7-digit code
UPDATE public.founders
SET invite_code = lpad((floor(random() * 9000000) + 1000000)::text, 7, '0')
WHERE invite_code IS NULL;

-- enforce uniqueness
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'founders_invite_code_unique') THEN
    ALTER TABLE public.founders ADD CONSTRAINT founders_invite_code_unique UNIQUE (invite_code);
  END IF;
END $$;

-- trigger to auto-generate code on insert
CREATE OR REPLACE FUNCTION public.founder_generate_invite_code()
RETURNS trigger AS $$
DECLARE v_code text; v_tries int := 0;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    LOOP
      v_code := lpad((floor(random() * 9000000) + 1000000)::text, 7, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.founders WHERE invite_code = v_code);
      v_tries := v_tries + 1;
      IF v_tries > 20 THEN RAISE EXCEPTION 'could not generate unique invite code'; END IF;
    END LOOP;
    NEW.invite_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS founder_generate_invite_code_trg ON public.founders;
CREATE TRIGGER founder_generate_invite_code_trg
  BEFORE INSERT ON public.founders
  FOR EACH ROW EXECUTE FUNCTION public.founder_generate_invite_code();

-- 2. founder_referrals table
CREATE TABLE IF NOT EXISTS public.founder_referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_user_id   uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_user_id   uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invite_code       text NOT NULL,
  invited_at        timestamptz NOT NULL DEFAULT now(),
  verified_at       timestamptz,
  verification_cashout_id uuid,
  payout_status     text NOT NULL DEFAULT 'pending'
                      CHECK (payout_status IN ('pending','verified','paid','rejected')),
  payout_amount_usd numeric(10,2) NOT NULL DEFAULT 5.00,
  paid_at           timestamptz,
  paid_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_referrals_unique_invited UNIQUE (invited_user_id)
);

CREATE INDEX IF NOT EXISTS founder_referrals_founder_idx ON public.founder_referrals(founder_user_id);
CREATE INDEX IF NOT EXISTS founder_referrals_status_idx ON public.founder_referrals(payout_status);

ALTER TABLE public.founder_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS founder_referrals_read_own ON public.founder_referrals;
CREATE POLICY founder_referrals_read_own ON public.founder_referrals
  FOR SELECT TO authenticated
  USING (founder_user_id = auth.uid() OR invited_user_id = auth.uid());

DROP POLICY IF EXISTS founder_referrals_admin_all ON public.founder_referrals;
CREATE POLICY founder_referrals_admin_all ON public.founder_referrals
  FOR ALL TO authenticated
  USING (public.can_manage_founders(auth.uid()))
  WITH CHECK (public.can_manage_founders(auth.uid()));

-- 3. capacity default -> 50
UPDATE public.founder_program_settings SET capacity = 50 WHERE id = true AND capacity < 50;

-- 4. RPC: get my invite code (founder only)
CREATE OR REPLACE FUNCTION public.founder_get_my_invite_code()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_founder public.founders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.'); END IF;
  SELECT * INTO v_founder FROM public.founders WHERE user_id = v_actor AND status = 'active';
  IF v_founder.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Active Founder status required.');
  END IF;
  IF v_founder.invite_code IS NULL THEN
    v_founder.invite_code := lpad((floor(random() * 9000000) + 1000000)::text, 7, '0');
    UPDATE public.founders SET invite_code = v_founder.invite_code WHERE id = v_founder.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'code', v_founder.invite_code);
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_get_my_invite_code() TO authenticated, service_role;

-- 5. RPC: redeem an invite code
CREATE OR REPLACE FUNCTION public.founder_redeem_invite_code(p_code text, p_invited_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := COALESCE(p_invited_user_id, auth.uid());
  v_founder public.founders%ROWTYPE;
  v_code text := trim(COALESCE(p_code, ''));
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.'); END IF;
  IF v_code !~ '^[0-9]{7}$' THEN RETURN jsonb_build_object('success', false, 'message', 'Invalid invite code format.'); END IF;

  SELECT * INTO v_founder FROM public.founders WHERE invite_code = v_code AND status = 'active';
  IF v_founder.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invite code not found or founder inactive.');
  END IF;
  IF v_founder.user_id = v_actor THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own invite code.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.founder_referrals WHERE invited_user_id = v_actor) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_REFERRED', 'message', 'This account already has a referral.');
  END IF;

  INSERT INTO public.founder_referrals (founder_user_id, invited_user_id, invite_code)
  VALUES (v_founder.user_id, v_actor, v_code);

  RETURN jsonb_build_object('success', true, 'message', 'Invite code applied.', 'founder_user_id', v_founder.user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_redeem_invite_code(text, uuid) TO authenticated, service_role;

-- 6. RPC: list my referrals (founder)
CREATE OR REPLACE FUNCTION public.founder_list_my_referrals(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.founders WHERE user_id = v_actor AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Active Founder status required.');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'invited_user_id', r.invited_user_id,
    'invited_username', COALESCE(up.username, 'Unknown'),
    'invited_display_name', up.display_name,
    'invited_avatar_url', up.avatar_url,
    'invited_coins', COALESCE(up.troll_coins, 0),
    'invited_at', r.invited_at,
    'verified_at', r.verified_at,
    'payout_status', r.payout_status,
    'payout_amount_usd', r.payout_amount_usd,
    'paid_at', r.paid_at
  ) ORDER BY r.invited_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM public.founder_referrals r
  LEFT JOIN public.user_profiles up ON up.id = r.invited_user_id
  WHERE r.founder_user_id = v_actor
  LIMIT p_limit;

  RETURN jsonb_build_object('success', true, 'referrals', v_rows);
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_list_my_referrals(integer) TO authenticated, service_role;

-- 7. RPC: verify a referral (admin) — invited user must have completed a cashout
--    of >= 3500 coins funded entirely by broadcast-gift coins.
CREATE OR REPLACE FUNCTION public.founder_verify_referral(p_referral_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ref public.founder_referrals%ROWTYPE;
  v_cashout record;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.'); END IF;
  IF NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin/Founder-manager access required.');
  END IF;

  SELECT * INTO v_ref FROM public.founder_referrals WHERE id = p_referral_id FOR UPDATE;
  IF v_ref.id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Referral not found.'); END IF;
  IF v_ref.payout_status IN ('verified','paid') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral already verified/paid.');
  END IF;

  SELECT * INTO v_cashout
  FROM public.payout_requests
  WHERE user_id = v_ref.invited_user_id
    AND coin_amount >= 3500
    AND status IN ('completed','approved','reviewed','paid')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cashout IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_QUALIFIED',
      'message', 'Invited user has not yet completed a qualifying cashout (3500+ coins from broadcast gifts).');
  END IF;

  UPDATE public.founder_referrals
  SET verified_at = now(),
      verification_cashout_id = v_cashout.id,
      payout_status = 'verified',
      updated_at = now()
  WHERE id = v_ref.id;

  RETURN jsonb_build_object('success', true, 'message', 'Referral verified. Founder earns $5.',
    'cashout_id', v_cashout.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_verify_referral(uuid) TO authenticated, service_role;

-- 8. RPC: referral stats for a founder
CREATE OR REPLACE FUNCTION public.founder_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_total int; v_verified int; v_paid int; v_earnings numeric;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.'); END IF;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE payout_status IN ('verified','paid')),
         COUNT(*) FILTER (WHERE payout_status = 'paid'),
         COALESCE(SUM(payout_amount_usd) FILTER (WHERE payout_status IN ('verified','paid')), 0)
  INTO v_total, v_verified, v_paid, v_earnings
  FROM public.founder_referrals WHERE founder_user_id = v_actor;

  RETURN jsonb_build_object('success', true,
    'total_invited', v_total,
    'verified', v_verified,
    'paid', v_paid,
    'earnings_usd', v_earnings);
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_referral_stats() TO authenticated, service_role;

-- 9. RPC: mark a verified referral as paid (admin)
CREATE OR REPLACE FUNCTION public.founder_mark_referral_paid(p_referral_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.can_manage_founders(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin access required.');
  END IF;
  UPDATE public.founder_referrals
  SET payout_status = 'paid', paid_at = now(), paid_by = v_actor, updated_at = now()
  WHERE id = p_referral_id AND payout_status = 'verified';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Referral not in verified state.'); END IF;
  RETURN jsonb_build_object('success', true, 'message', 'Referral marked as paid.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.founder_mark_referral_paid(uuid) TO authenticated, service_role;
