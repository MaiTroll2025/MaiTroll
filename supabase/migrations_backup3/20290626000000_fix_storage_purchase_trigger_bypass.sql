-- Fix purchase_storage_upgrade RPC to allow troll_coins updates
-- The restrict_coin_protection trigger blocks troll_coins updates without bypass flag

DROP FUNCTION IF EXISTS public.purchase_storage_upgrade(uuid, integer, text, integer, bigint);

CREATE OR REPLACE FUNCTION public.purchase_storage_upgrade(
    p_user_id UUID,
    p_tier_index INTEGER,
    p_tier_label TEXT,
    p_monthly_fee INTEGER,
    p_bytes_granted BIGINT DEFAULT NULL,
    p_egress_included_bytes BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER;
    v_egress_cost INTEGER := 15;
BEGIN
    -- Check user's current coin balance
    SELECT troll_coins INTO v_current_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    IF v_current_balance < p_monthly_fee THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Insufficient coins. Need %s, have %s', p_monthly_fee, v_current_balance));
    END IF;

    -- Deduct coins (bypass restrict sensitive columns trigger)
    PERFORM set_config('app.bypass_coin_protection', 'true', true);
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_monthly_fee,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Set egress cost based on tier
    CASE p_tier_index
        WHEN 0 THEN v_egress_cost := 15;
        WHEN 1 THEN v_egress_cost := 12;
        WHEN 2 THEN v_egress_cost := 10;
        WHEN 3 THEN v_egress_cost := 8;
        WHEN 4 THEN v_egress_cost := 6;
        WHEN 5 THEN v_egress_cost := 5;
        ELSE v_egress_cost := 15;
    END CASE;

    -- Upsert storage purchase record
    INSERT INTO public.user_storage_purchases (
        user_id, tier_index, tier_label, monthly_fee, bytes_granted,
        egress_included_bytes, egress_per_gb_cost, is_active, purchased_at, next_billing_at, last_payment_at
    ) VALUES (
        p_user_id, p_tier_index, p_tier_label, p_monthly_fee, p_bytes_granted,
        p_egress_included_bytes, v_egress_cost, true, NOW(), NOW() + INTERVAL '30 days', NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        tier_index = p_tier_index,
        tier_label = p_tier_label,
        monthly_fee = p_monthly_fee,
        bytes_granted = p_bytes_granted,
        egress_included_bytes = p_egress_included_bytes,
        egress_per_gb_cost = v_egress_cost,
        is_active = true,
        purchased_at = NOW(),
        next_billing_at = NOW() + INTERVAL '30 days',
        last_payment_at = NOW(),
        payment_failed_at = NULL,
        metadata = jsonb_build_object('last_upgrade', NOW());

    -- Initialize replay balance if not exists
    INSERT INTO public.replay_balances (user_id, balance, status)
    VALUES (p_user_id, 100, 'active')
    ON CONFLICT (user_id) DO UPDATE SET
        status = 'active',
        last_updated = NOW();

    -- Record coin transaction
    INSERT INTO public.coin_transactions (
        user_id, amount, type, description, metadata
    ) VALUES (
        p_user_id, -p_monthly_fee, 'storage_purchase',
        format('Storage upgrade: %s', p_tier_label),
        jsonb_build_object('tier_index', p_tier_index, 'tier_label', p_tier_label, 'bytes_granted', p_bytes_granted, 'egress_included_bytes', p_egress_included_bytes, 'egress_per_gb_cost', v_egress_cost)
    );

    RETURN jsonb_build_object(
        'success', true,
        'tier_index', p_tier_index,
        'tier_label', p_tier_label,
        'monthly_fee', p_monthly_fee,
        'new_balance', v_current_balance - p_monthly_fee,
        'next_billing', (NOW() + INTERVAL '30 days')::TEXT,
        'replay_balance_granted', 100
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
