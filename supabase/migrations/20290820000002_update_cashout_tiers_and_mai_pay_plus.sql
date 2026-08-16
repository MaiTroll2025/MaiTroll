-- ============================================================================
-- Migration: Update Cashout Tiers and Add Mai Pay Plus RPC Support
-- Date: 2026-08-20
-- Purpose: Replace stale cashout tiers with canonical set and make
--          request_cashout aware of Mai Pay Plus double-coin requirement.
-- ============================================================================

-- Remove old tiers and insert new canonical tiers
DELETE FROM public.cashout_tiers;

INSERT INTO public.cashout_tiers (coin_amount, cash_amount, processing_fee_percentage, is_active, created_at)
VALUES
  (4000,   5,    0, TRUE, NOW()),
  (8000,   10,   0, TRUE, NOW()),
  (16000,  20,   0, TRUE, NOW()),
  (24000,  30,   0, TRUE, NOW()),
  (40000,  50,   0, TRUE, NOW()),
  (80000,  100,  0, TRUE, NOW()),
  (200000, 250,  0, TRUE, NOW()),
  (400000, 500,  0, TRUE, NOW()),
  (880000, 1100, 0, TRUE, NOW());

-- Replace request_cashout with Mai Pay Plus aware logic
CREATE OR REPLACE FUNCTION public.request_cashout(
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
    v_cashout_count_24h BIGINT;
    v_daily_limit BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount NUMERIC(12,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_base_coins BIGINT;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    v_available_coins := COALESCE(v_user.troll_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coin balance for cashout.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    v_daily_limit := CASE WHEN COALESCE(v_user.mai_pay_plus, false) THEN 20 ELSE 10 END;
    SELECT COUNT(*) INTO v_cashout_count_24h
    FROM public.payout_requests
    WHERE user_id = p_user_id
      AND status IN ('approved', 'paid', 'completed')
      AND created_at > v_now - INTERVAL '24 hours';

    IF v_cashout_count_24h >= v_daily_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You have reached the daily cashout limit. Please try again later.',
            'code', 'daily_limit_reached',
            'count', v_cashout_count_24h,
            'limit', v_daily_limit
        );
    END IF;

    IF COALESCE(v_user.mai_pay_plus, false) THEN
        IF p_coins_to_redeem <= 0 OR (p_coins_to_redeem % 2) <> 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid Mai Pay Plus cashout amount. Plus tiers require double the standard coin amount.',
                'code', 'invalid_plus_amount'
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
                'error', format('Invalid Mai Pay Plus cashout amount. %s coins does not match any active tier (base: %s).', p_coins_to_redeem, v_base_coins),
                'code', 'tier_not_found'
            );
        END IF;
    ELSE
        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE coin_amount <= p_coins_to_redeem
          AND is_active = TRUE
        ORDER BY coin_amount DESC
        LIMIT 1;

        IF NOT FOUND THEN
            SELECT * INTO v_tier
            FROM public.cashout_tiers
            WHERE is_active = TRUE
            ORDER BY coin_amount ASC
            LIMIT 1;

            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'No active cashout tiers configured.');
            END IF;
        END IF;
    END IF;

    v_cash_amount := v_tier.cash_amount;
    v_fee_amount := ROUND(p_coins_to_redeem * 0.029, 0);
    v_net_amount := v_cash_amount;

    UPDATE public.user_profiles
    SET troll_coins = GREATEST(0, COALESCE(troll_coins, 0) - p_coins_to_redeem),
        cashout_coins = GREATEST(0, COALESCE(cashout_coins, 0) - p_coins_to_redeem),
        cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
        updated_at = v_now
    WHERE id = p_user_id;

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
        updated_at
    ) VALUES (
        p_user_id,
        p_coins_to_redeem,
        v_cash_amount,
        v_net_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN v_now ELSE NULL END,
        v_now,
        v_now
    ) RETURNING id INTO v_payout_id;

    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        p_user_id,
        -p_coins_to_redeem,
        'cashout',
        'Cashout request submitted - coins reserved for payout',
        jsonb_build_object(
            'payout_request_id', v_payout_id,
            'provider_type', p_provider_type,
            'provider_username', p_provider_username,
            'user_tag', p_user_tag,
            'cash_amount', v_cash_amount
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'usd_amount', v_cash_amount,
        'fee_coins', v_fee_amount,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO service_role;
