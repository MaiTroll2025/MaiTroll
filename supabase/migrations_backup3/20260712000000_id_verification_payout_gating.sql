-- ============================================================================
-- ID Verification Gating for Payouts
-- ============================================================================

-- 1. Add id_verified_at timestamp to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'id_verified_at'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN id_verified_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.id_verified_at IS
  'Timestamp when ID verification was last approved by admin. Used to enforce 30-day re-verification for payouts.';

-- 2. Drop the old request_payout signature and create the gated version
DROP FUNCTION IF EXISTS public.request_payout(uuid, bigint, text);

CREATE OR REPLACE FUNCTION public.request_payout(
  p_user_id uuid,
  p_requested_coins bigint,
  p_paypal_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_min_payout bigint := 12000;
  v_conversion_rate numeric := 0.0020833333; -- $25 / 12000 coins
  v_usd_amount numeric(10,2);
  v_payout_id uuid;
BEGIN
  -- Only allow users to request their own payouts
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- ID verification gate: must be approved
  IF COALESCE(v_profile.id_verification_status, 'not_submitted') != 'approved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ID verification required. Please upload your ID to cash out.',
      'code', 'id_verification_required'
    );
  END IF;

  -- ID verification gate: must be within 30 days
  IF v_profile.id_verified_at IS NULL OR
     v_profile.id_verified_at < NOW() - INTERVAL '30 days' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ID verification expired. Please re-upload your ID to continue cashing out.',
      'code', 'id_verification_expired'
    );
  END IF;

  -- Minimum payout check
  IF p_requested_coins < v_min_payout THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Minimum payout is %s coins', v_min_payout)
    );
  END IF;

  -- Balance check
  IF COALESCE(v_profile.troll_coins, 0) < p_requested_coins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- PayPal email required
  IF p_paypal_email IS NULL OR TRIM(p_paypal_email) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PayPal email is required'
    );
  END IF;

  -- Calculate USD amount
  v_usd_amount := ROUND(p_requested_coins * v_conversion_rate, 2);
  v_payout_id := gen_random_uuid();

  -- Deduct coins
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_requested_coins
  WHERE id = p_user_id;

  -- Insert payout request
  INSERT INTO public.payout_requests (
    id,
    user_id,
    requested_coins,
    coin_amount,
    cash_amount,
    paypal_email,
    status,
    requested_at
  ) VALUES (
    v_payout_id,
    p_user_id,
    p_requested_coins,
    p_requested_coins,
    v_usd_amount,
    p_paypal_email,
    'pending',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'coins_redeemed', p_requested_coins,
    'usd_amount', v_usd_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 3. Admin RPC to verify or reject ID verification
CREATE OR REPLACE FUNCTION public.admin_verify_id(
  p_target_user_id uuid,
  p_action text, -- 'approve' or 'reject'
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_new_status text;
BEGIN
  -- Only admins can call this
  SELECT role INTO v_admin_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'lead_troll_officer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve or reject.');
  END IF;

  UPDATE public.user_profiles
  SET
    id_verification_status = v_new_status,
    id_verified_at = CASE WHEN v_new_status = 'approved' THEN NOW() ELSE id_verified_at END,
    updated_at = NOW()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'new_status', v_new_status
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. Grants
GRANT EXECUTE ON FUNCTION public.request_payout(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_id(uuid, text, text) TO authenticated;
