-- ==========================================
-- Universal Cashout: All earned coins are cashable
-- + Fast Pay Program Application
-- ==========================================

-- ==========================================
-- 1. Update deposit_to_cashout_escrow to accept ALL earned coins
--    (marketplace, auction, gifts, treasury, etc.)
-- ==========================================

CREATE OR REPLACE FUNCTION public.deposit_to_cashout_escrow(p_amount bigint)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_cashout bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT COALESCE(cashout_coins, 0) INTO v_current_cashout
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Deposit the coins (non-reversible)
  UPDATE public.user_profiles
  SET cashout_coins = cashout_coins + p_amount,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deposited', p_amount,
    'new_balance', v_current_cashout + p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.deposit_to_cashout_escrow(bigint) TO authenticated;

-- ==========================================
-- 2. Auto-deposit earned coins to cashout escrow
--    Trigger on coin_ledger inserts for cashout-eligible sources
-- ==========================================

CREATE OR REPLACE FUNCTION auto_deposit_earned_coins_to_cashout()
RETURNS TRIGGER AS $$
DECLARE
  v_deposit_amount bigint := 0;
BEGIN
  -- Only process positive deltas (coin gains)
  IF NEW.delta <= 0 THEN
    RETURN NEW;
  END IF;

  -- Determine if this source should auto-deposit to cashout escrow
  -- Eligible: marketplace, auction, gifts (earned), treasury, freelancer, stream earnings
  -- Not eligible: admin grants, free coins, purchased coins, cashout payouts
  v_deposit_amount := CASE
    -- Marketplace earnings
    WHEN NEW.bucket = 'marketplace_earnings' THEN NEW.delta
    -- Auction winnings
    WHEN NEW.bucket = 'auction_earnings' THEN NEW.delta
    WHEN NEW.bucket = 'auction_winnings' THEN NEW.delta
    -- Gifts received from other users (these represent earned value)
    WHEN NEW.bucket = 'gift_received' THEN NEW.delta
    WHEN NEW.source = 'gift_received' THEN NEW.delta
    -- Treasury/official payouts
    WHEN NEW.bucket = 'treasury_weekly_payout' THEN NEW.delta
    WHEN NEW.bucket = 'treasury_payout' THEN NEW.delta
    WHEN NEW.source = 'treasury' THEN NEW.delta
    -- Freelancer earnings
    WHEN NEW.bucket = 'freelancer_earnings' THEN NEW.delta
    WHEN NEW.source = 'freelancer' THEN NEW.delta
    -- Stream/broadcast earnings
    WHEN NEW.bucket = 'broadcast_earnings' THEN NEW.delta
    WHEN NEW.bucket = 'stream_earnings' THEN NEW.delta
    WHEN NEW.source = 'broadcast' THEN NEW.delta
    -- Job/quest rewards
    WHEN NEW.bucket = 'quest_rewards' THEN NEW.delta
    WHEN NEW.bucket = 'job_earnings' THEN NEW.delta
    WHEN NEW.source = 'quest' THEN NEW.delta
    -- Referral bonuses
    WHEN NEW.bucket = 'referral_bonus' THEN NEW.delta
    WHEN NEW.source = 'referral' THEN NEW.delta
    -- Marketplace payout releases
    WHEN NEW.source = 'marketplace_payout' THEN NEW.delta
    -- Any source containing 'earn' or 'payout'
    WHEN NEW.source ILIKE '%earn%' OR NEW.source ILIKE '%payout%' THEN NEW.delta
    WHEN NEW.bucket ILIKE '%earn%' OR NEW.bucket ILIKE '%payout%' THEN NEW.delta
    -- Default: do NOT auto-deposit (free coins, admin grants, etc.)
    ELSE 0
  END;

  IF v_deposit_amount > 0 THEN
    UPDATE public.user_profiles
    SET cashout_coins = COALESCE(cashout_coins, 0) + v_deposit_amount,
        updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_deposit_cashout ON public.coin_ledger;
CREATE TRIGGER trg_auto_deposit_cashout
  AFTER INSERT ON public.coin_ledger
  FOR EACH ROW
  EXECUTE FUNCTION auto_deposit_earned_coins_to_cashout();

-- ==========================================
-- 3. Fast Pay Program Application System
-- ==========================================

-- Applications table
CREATE TABLE IF NOT EXISTS public.fast_pay_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Application details
  payout_method text NOT NULL CHECK (payout_method IN ('cash_app', 'paypal', 'venmo')),
  payout_username text NOT NULL,
  payout_email text,
  cashtag text,
  venmo_handle text,

  -- Terms acceptance
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_fees boolean NOT NULL DEFAULT false,
  accepted_identity_verification boolean NOT NULL DEFAULT false,

  -- Eligibility snapshot at time of application
  user_level int NOT NULL,
  account_age_days int NOT NULL,
  has_verified_identity boolean NOT NULL DEFAULT false,
  has_violations boolean NOT NULL DEFAULT false,
  has_fraud_history boolean NOT NULL DEFAULT false,

  -- Status flow: pending -> under_review -> approved -> rejected
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),

  -- Admin review
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  rejection_reason text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_fast_pay_apps_user_id ON public.fast_pay_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_fast_pay_apps_status ON public.fast_pay_applications(status);
CREATE INDEX IF NOT EXISTS idx_fast_pay_apps_created_at ON public.fast_pay_applications(created_at DESC);

ALTER TABLE public.fast_pay_applications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own application" ON public.fast_pay_applications;
CREATE POLICY "Users can view own application" ON public.fast_pay_applications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own application" ON public.fast_pay_applications;
CREATE POLICY "Users can create own application" ON public.fast_pay_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage applications" ON public.fast_pay_applications;
CREATE POLICY "Admins can manage applications" ON public.fast_pay_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'secretary')
    )
  );

-- ==========================================
-- 4. RPC: Submit Fast Pay application
-- ==========================================

CREATE OR REPLACE FUNCTION public.submit_fast_pay_application(
  p_payout_method text,
  p_payout_username text,
  p_payout_email text DEFAULT null,
  p_cashtag text DEFAULT null,
  p_venmo_handle text DEFAULT null,
  p_accepted_terms boolean DEFAULT false,
  p_accepted_fees boolean DEFAULT false,
  p_accepted_identity_verification boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile user_profiles;
  v_user_stats user_stats;
  v_account_age_days int;
  v_user_level int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate inputs
  IF NOT p_accepted_terms OR NOT p_accepted_fees OR NOT p_accepted_identity_verification THEN
    RETURN jsonb_build_object('success', false, 'error', 'All terms must be accepted');
  END IF;

  IF p_payout_username IS NULL OR trim(p_payout_username) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout username is required');
  END IF;

  -- Get user profile and stats
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  SELECT * INTO v_user_stats FROM public.user_stats WHERE user_id = v_user_id;
  v_user_level := COALESCE(v_user_stats.level, v_profile.level, 1);
  v_account_age_days := COALESCE(EXTRACT(DAY FROM now() - v_profile.created_at), 0);

  -- Check if already has pending/approved application
  IF EXISTS (
    SELECT 1 FROM public.fast_pay_applications
    WHERE user_id = v_user_id
    AND status IN ('pending', 'under_review', 'approved')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending or approved Fast Pay application');
  END IF;

  -- Upsert application
  INSERT INTO public.fast_pay_applications (
    user_id, payout_method, payout_username, payout_email,
    cashtag, venmo_handle, accepted_terms, accepted_fees,
    accepted_identity_verification, user_level, account_age_days,
    has_verified_identity, has_violations, has_fraud_history
  ) VALUES (
    v_user_id, p_payout_method, trim(p_payout_username), p_payout_email,
    p_cashtag, p_venmo_handle, p_accepted_terms, p_accepted_fees,
    p_accepted_identity_verification, v_user_level, v_account_age_days,
    COALESCE(v_profile.verified_since IS NOT NULL, false),
    COALESCE(v_profile.banned_at IS NOT NULL OR v_profile.suspended_until IS NOT NULL, false),
    COALESCE(v_profile.fast_pay_no_fraud_history, false)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    payout_method = EXCLUDED.payout_method,
    payout_username = EXCLUDED.payout_username,
    payout_email = EXCLUDED.payout_email,
    cashtag = EXCLUDED.cashtag,
    venmo_handle = EXCLUDED.venmo_handle,
    accepted_terms = EXCLUDED.accepted_terms,
    accepted_fees = EXCLUDED.accepted_fees,
    accepted_identity_verification = EXCLUDED.accepted_identity_verification,
    user_level = EXCLUDED.user_level,
    account_age_days = EXCLUDED.account_age_days,
    has_verified_identity = EXCLUDED.has_verified_identity,
    has_violations = EXCLUDED.has_violations,
    has_fraud_history = EXCLUDED.has_fraud_history,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_user_id,
    'message', 'Fast Pay application submitted for review'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_fast_pay_application(text, text, text, text, text, boolean, boolean, boolean) TO authenticated;

-- ==========================================
-- 5. RPC: Admin review Fast Pay application
-- ==========================================

CREATE OR REPLACE FUNCTION public.review_fast_pay_application(
  p_application_id uuid,
  p_new_status text,
  p_admin_notes text DEFAULT null,
  p_rejection_reason text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app fast_pay_applications;
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_admin_id
    AND role IN ('admin', 'superadmin', 'secretary')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin role required');
  END IF;

  SELECT * INTO v_app FROM public.fast_pay_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.status NOT IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application is not in a reviewable state');
  END IF;

  IF p_new_status NOT IN ('approved', 'rejected', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  UPDATE public.fast_pay_applications
  SET status = p_new_status,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      rejection_reason = CASE WHEN p_new_status = 'rejected' THEN COALESCE(p_rejection_reason, '') ELSE admin_notes END,
      updated_at = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_new_status = 'approved' THEN 'Fast Pay application approved'
      WHEN p_new_status = 'rejected' THEN 'Fast Pay application rejected'
      ELSE 'Application marked as under review'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_fast_pay_application(uuid, text, text, text) TO authenticated;

-- ==========================================
-- 6. Permissions
-- ==========================================

GRANT ALL ON public.fast_pay_applications TO service_role;
GRANT SELECT, INSERT ON public.fast_pay_applications TO authenticated;

SELECT 'Universal cashout + Fast Pay application migration completed!' as status;
