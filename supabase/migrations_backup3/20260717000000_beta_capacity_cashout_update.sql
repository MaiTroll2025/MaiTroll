-- ============================================================================
-- BETA CAPACITY & CASHOUT SYSTEM UPDATE
-- Date: 2026-07-17
-- Purpose: Simplify cashout system, remove fees and level restrictions,
--          enforce beta capacity limits.
-- ============================================================================

-- ============================================================================
-- STEP 1: Update cashout_tiers with new beta values
-- ============================================================================

-- Remove old tiers
DELETE FROM public.cashout_tiers;

-- Insert new beta cashout tiers
INSERT INTO public.cashout_tiers (coin_amount, cash_amount, processing_fee_percentage, is_active) VALUES
  (2000, 5, 0, TRUE),
  (7000, 10, 0, TRUE),
  (12000, 30, 0, TRUE),
  (18000, 50, 0, TRUE),
  (23000, 85, 0, TRUE),
  (34000, 115, 0, TRUE),
  (42000, 150, 0, TRUE),
  (56000, 215, 0, TRUE),
  (69000, 300, 0, TRUE),
  (77000, 350, 0, TRUE),
  (88000, 415, 0, TRUE),
  (96000, 475, 0, TRUE),
  (106000, 600, 0, TRUE);

-- ============================================================================
-- STEP 2: Replace request_friday_cashout with simplified beta cashout RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_friday_cashout(
    p_user_id UUID,
    p_coins_to_redeem BIGINT,
    p_provider_type TEXT,
    p_provider_username TEXT,
    p_user_tag TEXT DEFAULT NULL,
    p_id_verification_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_available_coins BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_cashout_count_24h INT;
BEGIN
    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Trollers cannot cashout
    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    -- Check rolling 24-hour cashout limit (max 10 successful cashouts)
    SELECT COUNT(*) INTO v_cashout_count_24h
    FROM public.payout_requests
    WHERE user_id = p_user_id
      AND status IN ('approved', 'paid', 'completed')
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_cashout_count_24h >= 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You have reached the daily cashout limit. You may cash out again after one of your previous cashouts becomes older than 24 hours.',
            'code', 'daily_limit_reached'
        );
    END IF;

    -- Check available balance (cashout_coins - cashout_reserved_coins)
    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Insufficient cashout coin balance. You need %s coins but only %s available.', p_coins_to_redeem, v_available_coins),
            'available_coins', v_available_coins,
            'required_coins', p_coins_to_redeem
        );
    END IF;

    -- Get cashout tier (no fees, exact match or nearest tier)
    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount = p_coins_to_redeem
      AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Invalid cashout amount. %s coins does not match any active cashout tier.', p_coins_to_redeem)
        );
    END IF;

    v_cash_amount := v_tier.cash_amount;

    -- Reserve coins from escrow (exact tier amount, no fee)
    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Create payout request
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        net_amount,
        status,
        provider_type,
        provider_username,
        user_tag,
        id_verification_url,
        id_verification_uploaded_at,
        created_at,
        updated_at,
        fee_coins,
        payout_coins
    ) VALUES (
        p_user_id,
        p_coins_to_redeem,
        v_cash_amount,
        v_cash_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN NOW() ELSE NULL END,
        NOW(),
        NOW(),
        0,
        p_coins_to_redeem
    )
    RETURNING id INTO v_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'payout_coins', p_coins_to_redeem,
        'fee_coins', 0,
        'usd_amount', v_cash_amount,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- STEP 3: Update admin_process_payout for no-fee system
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_process_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout RECORD;
    v_user RECORD;
    v_payout_coins BIGINT;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id
        AND (role IN ('admin', 'superadmin', 'secretary') OR is_admin = TRUE)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin role required');
    END IF;

    -- Get the payout request
    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found.');
    END IF;

    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_payout.user_id;

    -- In the no-fee system, coin_amount = payout_coins (exact tier amount)
    v_payout_coins := COALESCE(v_payout.payout_coins, v_payout.coin_amount);

    IF p_action = 'approve' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout is not in a reviewable status.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'approved',
            approved_by = p_admin_id::text,
            approved_at = NOW(),
            admin_id = p_admin_id,
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_approved',
            'Cashout Approved',
            format('Your cashout request for $%s has been approved and is being processed.', v_payout.cash_amount),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout approved.');

    ELSIF p_action = 'pay' THEN
        IF v_payout.status != 'approved' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout must be approved before marking as paid.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'paid',
            paid_at = NOW(),
            processed_at = NOW(),
            processed_by = p_admin_id,
            payment_reference = COALESCE(p_payment_reference, payment_reference),
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        -- Release reserved cashout coins (exact tier amount, no fee)
        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout_coins),
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_paid',
            'Cashout Paid!',
            format('Your cashout of $%s has been sent via %s to %s.', v_payout.cash_amount, v_payout.provider_type, v_payout.provider_username),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout marked as paid.');

    ELSIF p_action = 'reject' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed', 'approved') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot reject payout in current status.');
        END IF;

        -- Return reserved coins to cashout escrow (exact tier amount)
        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout_coins),
            cashout_coins = COALESCE(cashout_coins, 0) + v_payout_coins,
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        UPDATE public.payout_requests
        SET status = 'rejected',
            rejection_reason = COALESCE(p_rejection_reason, 'Rejected by admin.'),
            processed_at = NOW(),
            processed_by = p_admin_id,
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_rejected',
            'Cashout Rejected',
            format('Your cashout request was rejected. Reason: %s. Your coins have been returned to your balance.', COALESCE(p_rejection_reason, 'No reason provided.')),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout rejected and coins returned.');

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve, pay, or reject.');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_payout(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- STEP 4: Update request_payout to use new tier system
-- ============================================================================

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
  v_available_coins bigint;
  v_tier record;
  v_cash_amount numeric(10,2);
  v_payout_id uuid;
  v_cashout_count_24h int;
BEGIN
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Rolling 24-hour cashout limit
  SELECT COUNT(*) INTO v_cashout_count_24h
  FROM public.payout_requests
  WHERE user_id = p_user_id
    AND status IN ('approved', 'paid', 'completed')
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_cashout_count_24h >= 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have reached the daily cashout limit. Please try again later.',
      'code', 'daily_limit_reached'
    );
  END IF;

  -- Check available cashout escrow balance
  v_available_coins := COALESCE(v_profile.cashout_coins, 0) - COALESCE(v_profile.cashout_reserved_coins, 0);

  IF v_available_coins < p_requested_coins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient cashout balance. You need %s coins but only %s available.', p_requested_coins, v_available_coins)
    );
  END IF;

  -- Validate against cashout tiers
  SELECT * INTO v_tier
  FROM public.cashout_tiers
  WHERE coin_amount = p_requested_coins
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid cashout amount. %s coins does not match any active cashout tier.', p_requested_coins)
    );
  END IF;

  v_cash_amount := v_tier.cash_amount;

  IF p_paypal_email IS NULL OR TRIM(p_paypal_email) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PayPal email is required'
    );
  END IF;

  v_payout_id := gen_random_uuid();

  -- Reserve coins from escrow
  UPDATE public.user_profiles
  SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_requested_coins,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert payout request
  INSERT INTO public.payout_requests (
    id,
    user_id,
    coin_amount,
    cash_amount,
    net_amount,
    provider_type,
    provider_username,
    user_tag,
    status,
    created_at,
    updated_at,
    fee_coins,
    payout_coins
  ) VALUES (
    v_payout_id,
    p_user_id,
    p_requested_coins,
    v_cash_amount,
    v_cash_amount,
    'paypal',
    p_paypal_email,
    NULL,
    'pending',
    NOW(),
    NOW(),
    0,
    p_requested_coins
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'coins_redeemed', p_requested_coins,
    'usd_amount', v_cash_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_payout(uuid, bigint, text) TO authenticated;

-- ============================================================================
-- STEP 5: Ensure payout_requests has all needed columns
-- ============================================================================

ALTER TABLE public.payout_requests
    ADD COLUMN IF NOT EXISTS fee_coins BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_coins BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS user_level_at_request INT DEFAULT 1;

-- ============================================================================
-- STEP 6: Ensure cashout_approved columns exist (for backward compat)
-- ============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS cashout_approved BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS cashout_approved_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- STEP 7: Ensure admin_settings keys exist for broadcast caps
-- ============================================================================

INSERT INTO public.admin_settings (key, value, updated_at)
VALUES
  ('broadcast_viewer_cap_enabled', '{"enabled": true}', NOW()),
  ('broadcast_viewer_cap_max', '{"value": 20}', NOW()),
  ('broadcast_viewer_cap_hours', '{"value": 24}', NOW()),
  ('broadcast_start_cap_enabled', '{"enabled": true}', NOW()),
  ('broadcast_start_cap_max', '{"value": 25}', NOW()),
  ('broadcast_all_restrictions_disabled', '{"enabled": false}', NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
