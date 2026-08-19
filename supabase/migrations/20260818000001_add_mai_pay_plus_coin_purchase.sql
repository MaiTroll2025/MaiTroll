-- ============================================================================
-- Migration: Add MAI Pay Plus coin purchase and expiration tracking
-- Date: 2026-08-18
-- Purpose: Allow users to purchase MAI Pay Plus with troll coins at the
--          coinstore ratio (100 coins = $1 USD). $9.99 = 999 coins.
--          Also add expiration tracking so coin-purchased Plus status expires
--          after 30 days, while admin-granted Plus remains permanent.
-- ============================================================================

-- 1. Add expiration column to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mai_pay_plus_expires_at TIMESTAMPTZ;

-- 2. Update request_cashout to respect MAI Pay Plus expiration
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
    v_cashout_count_7d BIGINT;
    v_weekly_limit BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount NUMERIC(12,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_base_coins BIGINT;
    v_is_plus BOOLEAN;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    v_available_coins := COALESCE(v_user.troll_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coin balance for cashout.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    v_is_plus := COALESCE(v_user.mai_pay_plus, false)
      AND (v_user.mai_pay_plus_expires_at IS NULL OR v_user.mai_pay_plus_expires_at > v_now);

    v_weekly_limit := CASE WHEN v_is_plus THEN 20 ELSE 10 END;
    SELECT COUNT(*) INTO v_cashout_count_7d
    FROM public.payout_requests
    WHERE user_id = p_user_id
      AND status IN ('approved', 'paid', 'completed')
      AND created_at > v_now - INTERVAL '7 days';

    IF v_cashout_count_7d >= v_weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You have reached the weekly cashout limit. Please try again later.',
            'code', 'weekly_limit_reached',
            'count', v_cashout_count_7d,
            'limit', v_weekly_limit
        );
    END IF;

    IF v_is_plus THEN
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

-- 3. Create RPC to purchase MAI Pay Plus with coins
CREATE OR REPLACE FUNCTION public.purchase_mai_pay_plus_with_coins(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_coin_cost BIGINT := 999;
    v_now TIMESTAMPTZ := NOW();
    v_expires_at TIMESTAMPTZ := v_now + INTERVAL '30 days';
    v_tx_id UUID;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    IF COALESCE(v_user.mai_pay_plus, false)
       AND (v_user.mai_pay_plus_expires_at IS NULL OR v_user.mai_pay_plus_expires_at > v_now) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have an active MAI Pay Plus subscription.');
    END IF;

    IF COALESCE(v_user.troll_coins, 0) < v_coin_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient troll coins.',
            'required', v_coin_cost,
            'available', COALESCE(v_user.troll_coins, 0)
        );
    END IF;

    UPDATE public.user_profiles
    SET
        troll_coins = troll_coins - v_coin_cost,
        mai_pay_plus = true,
        mai_pay_plus_expires_at = v_expires_at,
        updated_at = v_now
    WHERE id = p_user_id;

    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        p_user_id,
        -v_coin_cost,
        'mai_pay_plus_purchase',
        'MAI Pay Plus subscription purchased with troll coins',
        jsonb_build_object(
            'plan', 'mai_pay_plus',
            'coin_cost', v_coin_cost,
            'duration_days', 30,
            'expires_at', v_expires_at
        ),
        v_now
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success', true,
        'coin_cost', v_coin_cost,
        'expires_at', v_expires_at,
        'transaction_id', v_tx_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_mai_pay_plus_with_coins(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_mai_pay_plus_with_coins(UUID) TO service_role;
