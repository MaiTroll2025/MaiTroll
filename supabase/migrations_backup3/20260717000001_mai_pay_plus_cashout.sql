-- ============================================================================
-- MAI PAY PLUS INTEGRATION (Cashout System Extension)
-- Date: 2026-07-17
-- Purpose: Extend the simplified beta cashout system to support MAI Pay Plus:
--          - Add mai_pay_plus flag to user accounts
--          - MAI Pay Plus users get 20 (vs 10) rolling 24h cashouts
--          - MAI Pay Plus users require DOUBLE the coin amount per tier,
--            but receive the exact same USD payout
--          - No cashout fees, no level requirements (unchanged)
--          - All limits enforced server-side
-- ============================================================================

-- ============================================================================
-- STEP 1: Add mai_pay_plus flag to user_profiles
-- ============================================================================

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS mai_pay_plus BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- STEP 2: Replace request_friday_cashout with MAI Pay Plus aware logic
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
    v_daily_limit INT;
    v_coin_requirement BIGINT;
    v_base_coins BIGINT;
BEGIN
    -- Get user profile (includes mai_pay_plus)
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

    -- Rolling 24-hour cashout limit
    -- Standard users: 10. MAI Pay Plus users: 20.
    v_daily_limit := CASE WHEN v_user.mai_pay_plus = TRUE THEN 20 ELSE 10 END;

    SELECT COUNT(*) INTO v_cashout_count_24h
    FROM public.payout_requests
    WHERE user_id = p_user_id
      AND status IN ('approved', 'paid', 'completed')
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_cashout_count_24h >= v_daily_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You have reached the daily cashout limit. You may cash out again after one of your previous cashouts becomes older than 24 hours.',
            'code', 'daily_limit_reached',
            'daily_limit', v_daily_limit,
            'remaining', 0
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

    -- Resolve cashout tier (no fees, exact match or nearest tier).
    -- Standard users redeem the exact coin_amount.
    -- MAI Pay Plus users redeem coin_amount * 2 (double coin requirement),
    -- and still receive the same cash_amount.
    IF v_user.mai_pay_plus = TRUE THEN
        -- Only accept even, doubled amounts that map to an active tier.
        IF p_coins_to_redeem <= 0 OR (p_coins_to_redeem % 2) <> 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Invalid MAI Pay Plus cashout amount. %s coins does not match any active cashout tier (Plus tiers require double the standard coin amount).', p_coins_to_redeem)
            );
        END IF;

        v_base_coins := p_coins_to_redeem / 2;

        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE coin_amount = v_base_coins
          AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Invalid MAI Pay Plus cashout amount. %s coins does not match any active cashout tier (Plus tiers require double the standard coin amount).', p_coins_to_redeem)
            );
        END IF;
    ELSE
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
    END IF;

    v_cash_amount := v_tier.cash_amount;

    -- Reserve coins from escrow (exact tier amount requested, no fee)
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
        'status', 'pending',
        'daily_limit', v_daily_limit,
        'remaining', (v_daily_limit - v_cashout_count_24h - 1)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- STEP 3: Replace request_payout with MAI Pay Plus aware logic
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
  v_daily_limit int;
  v_base_coins bigint;
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
  v_daily_limit := CASE WHEN v_profile.mai_pay_plus = TRUE THEN 20 ELSE 10 END;

  SELECT COUNT(*) INTO v_cashout_count_24h
  FROM public.payout_requests
  WHERE user_id = p_user_id
    AND status IN ('approved', 'paid', 'completed')
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_cashout_count_24h >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have reached the daily cashout limit. Please try again later.',
      'code', 'daily_limit_reached',
      'daily_limit', v_daily_limit,
      'remaining', 0
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

  -- Resolve cashout tier (MAI Pay Plus requires double the coin amount)
  IF v_profile.mai_pay_plus = TRUE THEN
    IF p_requested_coins <= 0 OR (p_requested_coins % 2) <> 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Invalid MAI Pay Plus cashout amount. %s coins does not match any active cashout tier (Plus tiers require double the standard coin amount).', p_requested_coins)
      );
    END IF;

    v_base_coins := p_requested_coins / 2;

    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount = v_base_coins
      AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Invalid MAI Pay Plus cashout amount. %s coins does not match any active cashout tier (Plus tiers require double the standard coin amount).', p_requested_coins)
      );
    END IF;
  ELSE
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
    'usd_amount', v_cash_amount,
    'daily_limit', v_daily_limit,
    'remaining', (v_daily_limit - v_cashout_count_24h - 1)
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
-- END OF MIGRATION
-- ============================================================================
