-- ============================================================================
-- Migration: Integrate First Cashout Match into cashout flow
-- Date: 2026-09-07
-- Purpose: Hooks the first-cashout-match promotion into request_cashout,
--          troll_bank_finalize_cashout, and troll_bank_deny_cashout.
-- ============================================================================

-- 1. Extend request_cashout to atomically reserve a promotion slot
--    This runs AFTER the payout request is created, so a failed reservation
--    does not roll back the cashout request itself.
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
    v_promo_result JSONB;
    v_promo_eligible BOOLEAN := false;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Determine fee based on provider
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

    -- Create payout request
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

    -- Best-effort promotion slot reservation (non-blocking)
    BEGIN
      v_promo_result := public.reserve_first_cashout_match_slot(
        p_user_id => p_user_id,
        p_payout_request_id => v_payout_id,
        p_qualifying_amount => v_cash_amount
      );
      v_promo_eligible := (v_promo_result->>'success')::BOOLEAN;
    EXCEPTION
      WHEN OTHERS THEN
        v_promo_eligible := false;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'fee_coins', v_fee_amount,
        'fee_percentage', v_fee_pct,
        'total_coins_charged', p_coins_to_redeem + v_fee_amount,
        'usd_amount', v_cash_amount,
        'status', 'pending',
        'promotion_eligible', v_promo_eligible,
        'promotion', CASE WHEN v_promo_eligible THEN v_promo_result ELSE NULL END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 2. Extend troll_bank_finalize_cashout to issue promotion matches
CREATE OR REPLACE FUNCTION public.troll_bank_finalize_cashout(
    p_request_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_claim RECORD;
    v_promo_result JSONB;
BEGIN
    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
    END IF;

    IF v_payout.status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already paid');
    END IF;

    -- Mark payout as paid
    UPDATE public.payout_requests
    SET status = 'paid',
        paid_at = v_now,
        updated_at = v_now,
        processed_by = p_admin_id
    WHERE id = p_request_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        v_payout.user_id,
        0,
        'cashout',
        'Cashout finalized - payout processed',
        jsonb_build_object(
            'payout_request_id', p_request_id,
            'admin_id', p_admin_id,
            'action', 'finalize'
        ),
        v_now
    );

    -- Check for pending promotion claim and issue match
    SELECT * INTO v_claim
    FROM public.cashout_promotion_claims
    WHERE payout_request_id = p_request_id
      AND status IN ('pending', 'approved')
    LIMIT 1;

    IF FOUND THEN
      BEGIN
        v_promo_result := public.issue_first_cashout_match(v_claim.id, p_admin_id);
      EXCEPTION
        WHEN OTHERS THEN
          v_promo_result := jsonb_build_object('success', false, 'error', SQLERRM);
      END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', p_request_id,
        'promotion_issued', COALESCE((v_promo_result->>'success')::BOOLEAN, false),
        'promotion', v_promo_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.troll_bank_finalize_cashout(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_bank_finalize_cashout(UUID, UUID) TO service_role;

-- 3. Extend troll_bank_deny_cashout to return promotion slot
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
    v_claim RECORD;
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

    -- Return promotion slot if one was reserved
    SELECT * INTO v_claim
    FROM public.cashout_promotion_claims
    WHERE payout_request_id = p_request_id
      AND status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.cashout_promotions
      SET winners_claimed = GREATEST(winners_claimed - 1, 0),
          updated_at = v_now
      WHERE id = v_claim.promotion_id;

      UPDATE public.cashout_promotion_claims
      SET status = 'rejected',
          review_status = 'rejected',
          reviewed_by = p_admin_id,
          reviewed_at = v_now,
          review_reason = COALESCE(p_reason, 'Payout denied - promotion slot returned'),
          metadata = jsonb_build_object('denied_at', v_now, 'admin_id', p_admin_id) || metadata
      WHERE id = v_claim.id;
    END IF;

    RETURN jsonb_build_object('success', true, 'coins_returned', v_coins_to_return);
END;
$$;

GRANT EXECUTE ON FUNCTION public.troll_bank_deny_cashout(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_bank_deny_cashout(UUID, UUID, TEXT) TO service_role;
