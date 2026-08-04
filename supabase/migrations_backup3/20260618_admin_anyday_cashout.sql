-- Allow admin users to request cashouts on any day/time
-- Non-admin users still restricted to Fri/Sat/Sun 1:00 AM - 7:00 PM Mountain Time

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
BEGIN
    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Check if user is admin (any admin role)
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

    -- Block trollers from cashout (they don't earn coins)
    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    -- Check weekend restriction (cashouts only on Fri/Sat/Sun) — skip for admins
    IF NOT v_is_admin THEN
        IF NOT (EXTRACT(ISODOW FROM v_now AT TIME ZONE 'America/Denver') IN (5, 6, 7)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only available on Fridays, Saturdays, and Sundays.');
        END IF;

        -- Check payout time window (1:00 AM - 7:00 PM Mountain Time) — skip for admins
        IF NOT (EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Denver') BETWEEN 1 AND 18) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only accepted between 1:00 AM and 7:00 PM Mountain Time on weekends.');
        END IF;
    END IF;

    -- Require ID upload for first cashout or when last approved payout is older than 30 days
    IF p_id_verification_url IS NULL THEN
        SELECT created_at INTO v_last_approved_at
        FROM public.payout_requests
        WHERE user_id = p_user_id
          AND status IN ('approved', 'completed')
        ORDER BY created_at DESC
        LIMIT 1;

        IF NOT FOUND OR v_last_approved_at < (v_now - INTERVAL '30 days') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Please upload a government-issued ID. Once you have an approved payout, you may skip ID upload for 30 days.'
            );
        END IF;
    END IF;

    -- Check available cashout_coins balance (only coins in cashout escrow are eligible for payout)
    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient cashout coin balance. Please move eligible coins to Cashout Escrow first.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    -- Find matching cashout tier
    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount <= p_coins_to_redeem
      AND is_active = TRUE
    ORDER BY coin_amount DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Use the minimum tier
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

    -- Reserve the coins in cashout escrow
    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
        updated_at = v_now
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
