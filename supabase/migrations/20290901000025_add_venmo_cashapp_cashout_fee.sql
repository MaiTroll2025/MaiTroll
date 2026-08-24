-- ============================================================================
-- Migration: Add Venmo/CashApp 5% cashout fee and PayPal $0.25 coin fee
-- Date: 2026-09-01
-- Purpose: Charge provider-specific fees in coins for cashouts:
--          - Venmo and Cash App: 5% of coins redeemed (using 200 coins = $1 ratio)
--          - PayPal: $0.25 equivalent in coins = 50 coins (at 200:1 ratio)
--          - ACH, check, and others: $0 fee
--          Fees are deducted from troll_coins and stored on payout_requests.fee_coins.
-- ============================================================================

-- 1. Add fee_coins column to payout_requests if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payout_requests' AND column_name = 'fee_coins'
  ) THEN
    ALTER TABLE public.payout_requests
      ADD COLUMN fee_coins BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Recreate request_cashout with provider-specific fee logic
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
    v_fee_amount BIGINT := 0;
    v_fee_pct NUMERIC(5,2) := 0;
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

    -- Determine fee based on provider
    -- Venmo/CashApp: 5% of coins redeemed (200 coins = $1 ratio)
    -- PayPal: $0.25 equivalent = 50 coins (at 200:1 cashout ratio)
    -- Others (ACH, check): $0
    v_fee_amount := CASE
        WHEN LOWER(p_provider_type) IN ('venmo', 'cash_app') THEN ROUND(p_coins_to_redeem * 0.05)
        WHEN LOWER(p_provider_type) = 'paypal' THEN 50
        ELSE 0
    END;

    v_fee_pct := CASE
        WHEN LOWER(p_provider_type) IN ('venmo', 'cash_app') THEN 5.0
        WHEN LOWER(p_provider_type) = 'paypal' THEN ROUND(50::numeric * 100.0 / p_coins_to_redeem, 2)
        ELSE 0.0
    END;

    -- Total coins needed: tier coins + fee coins
    v_available_coins := COALESCE(v_user.troll_coins, 0);

    IF v_available_coins < (p_coins_to_redeem + v_fee_amount) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coin balance for cashout (including fee).',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem,
            'fee_coins', v_fee_amount,
            'total_required', p_coins_to_redeem + v_fee_amount
        );
    END IF;

    v_weekly_limit := CASE WHEN COALESCE(v_user.mai_pay_plus, false) THEN 20 ELSE 10 END;
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
    v_net_amount := v_cash_amount;

    -- Deduct coins + fee from troll_coins
    UPDATE public.user_profiles
    SET troll_coins = GREATEST(0, COALESCE(troll_coins, 0) - p_coins_to_redeem - v_fee_amount),
        updated_at = v_now
    WHERE id = p_user_id;

    -- Create payout request with fee_coins
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        net_amount,
        fee_coins,
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
        v_fee_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN v_now ELSE NULL END,
        v_now,
        v_now
    ) RETURNING id INTO v_payout_id;

    -- Log coin transaction for the deduction (coins + fee)
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        p_user_id,
        -(p_coins_to_redeem + v_fee_amount),
        'cashout',
        'Cashout request submitted - coins and fee deducted',
        jsonb_build_object(
            'payout_request_id', v_payout_id,
            'provider_type', p_provider_type,
            'provider_username', p_provider_username,
            'user_tag', p_user_tag,
            'cash_amount', v_cash_amount,
            'fee_coins', v_fee_amount,
            'fee_percentage', v_fee_pct
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'fee_coins', v_fee_amount,
        'fee_percentage', v_fee_pct,
        'total_coins_charged', p_coins_to_redeem + v_fee_amount,
        'usd_amount', v_cash_amount,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 3. Update troll_bank_deny_cashout to refund both coins and fee
CREATE OR REPLACE FUNCTION public.troll_bank_deny_cashout(
    p_request_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout RECORD;
    v_coins_to_return BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
    END IF;

    IF v_payout.status IN ('paid', 'completed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel a paid payout');
    END IF;

    v_coins_to_return := COALESCE(v_payout.coin_amount, 0) + COALESCE(v_payout.fee_coins, 0);

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_coins_to_return,
        updated_at = v_now
    WHERE id = v_payout.user_id;

    UPDATE public.payout_requests
    SET status = 'denied',
        updated_at = v_now,
        processed_by = p_admin_id,
        rejection_reason = p_reason
    WHERE id = p_request_id;

    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        v_payout.user_id,
        v_coins_to_return,
        'refund',
        'Cashout denied - coins and fee returned',
        jsonb_build_object(
            'payout_request_id', p_request_id,
            'admin_id', p_admin_id,
            'reason', p_reason
        ),
        v_now
    );

    RETURN jsonb_build_object('success', true, 'coins_returned', v_coins_to_return);
END;
$$;

GRANT EXECUTE ON FUNCTION public.troll_bank_deny_cashout(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_bank_deny_cashout(UUID, UUID, TEXT) TO service_role;
