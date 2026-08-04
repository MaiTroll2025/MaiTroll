-- Update the backend cashout RPC so approved users can request payouts anytime via MAI Pay.
-- This avoids applying the full frontend schema SQL and only patches the relevant function.

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
AS $$
DECLARE
    v_user RECORD;
    v_available_coins BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount NUMERIC(12,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_last_approved_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_is_admin BOOLEAN := FALSE;
    v_is_cashout_approved BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    v_is_admin := (
        v_user.role = 'admin'
        OR v_user.is_admin = TRUE
        OR v_user.is_superadmin = TRUE
        OR v_user.role = 'owner'
        OR v_user.role = 'ceo_assistant'
        OR v_user.role = 'noah_assistant'
        OR v_user.role = 'secretary'
        OR v_user.troll_role = 'admin'
    );

    v_is_cashout_approved := COALESCE(v_user.cashout_approved, false);

    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    IF NOT v_is_admin AND NOT v_is_cashout_approved THEN
        -- Approved users may request payouts through MAI Pay anytime;
        -- remove weekend / Friday-only restrictions.
    END IF;

    -- The 30-day cooldown for approved payouts was removed.
    -- Approved users may request payouts anytime, limited only by daily cashout caps.

    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient cashout coin balance. Please move eligible coins to Cashout Escrow first.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

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

    v_cash_amount := v_tier.cash_amount;
    v_fee_amount := ROUND(p_coins_to_redeem * 0.029, 0);
    v_net_amount := v_cash_amount;

    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
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
    )
    RETURNING id INTO v_payout_id;

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

GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
