-- Fix create_subscription: credit broadcaster troll_coins + admin_pool, remove double subscriber count
-- 90% to broadcaster, 10% to admin_pool

DO $$
BEGIN
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID, UUID, BOOLEAN)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION create_subscription(
    p_broadcaster_id UUID,
    p_tier_id UUID,
    p_auto_renew BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_subscriber user_profiles%ROWTYPE;
    v_broadcaster user_profiles%ROWTYPE;
    v_tier subscription_tiers%ROWTYPE;
    v_existing user_subscriptions%ROWTYPE;
    v_new_subscription user_subscriptions%ROWTYPE;
    v_pay_success BOOLEAN;
    v_creator_amount INTEGER;
    v_admin_amount INTEGER;
    v_pool_id UUID;
BEGIN
    SELECT * INTO v_subscriber FROM user_profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
    END IF;

    IF COALESCE(v_subscriber.level, 1) < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level 1 required to subscribe. Your level: ' || COALESCE(v_subscriber.level, 1));
    END IF;

    SELECT * INTO v_broadcaster FROM user_profiles WHERE id = p_broadcaster_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
    END IF;

    IF v_subscriber.id = v_broadcaster.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
    END IF;

    SELECT * INTO v_tier FROM subscription_tiers
    WHERE id = p_tier_id AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription tier');
    END IF;

    SELECT * INTO v_existing
    FROM user_subscriptions
    WHERE subscriber_id = v_subscriber.id
      AND broadcaster_id = p_broadcaster_id
      AND is_active = true;

    IF FOUND THEN
        IF v_existing.tier_id = p_tier_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Already subscribed at this tier');
        END IF;

        UPDATE user_subscriptions
        SET
            tier_id = p_tier_id,
            total_paid_coins = total_paid_coins + v_tier.price_coins,
            updated_at = NOW()
        WHERE id = v_existing.id
        RETURNING * INTO v_new_subscription;

        v_pay_success := public.try_pay_coins(v_subscriber.id, v_tier.price_coins, 'subscription_upgrade', jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'tier_id', p_tier_id,
            'type', 'tier_upgrade'
        ));

        IF NOT v_pay_success THEN
            UPDATE user_subscriptions
            SET
                tier_id = v_existing.tier_id,
                total_paid_coins = total_paid_coins - v_tier.price_coins,
                updated_at = NOW()
            WHERE id = v_existing.id;

            RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for upgrade');
        END IF;

        v_creator_amount := (v_tier.price_coins * 90 / 100);
        v_admin_amount := (v_tier.price_coins * 10 / 100);

        UPDATE user_profiles
        SET
            total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
            troll_coins = troll_coins + v_creator_amount,
            subscriber_badge_color_hex = v_tier.color_hex
        WHERE id = p_broadcaster_id;

        SELECT id INTO v_pool_id FROM admin_pool LIMIT 1;
        IF v_pool_id IS NOT NULL THEN
            UPDATE admin_pool SET trollcoins_balance = trollcoins_balance + v_admin_amount WHERE id = v_pool_id;
            INSERT INTO admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id)
            VALUES (v_admin_amount, 'Subscription upgrade fee', v_subscriber.id, 'subscription', p_broadcaster_id);
        END IF;

        INSERT INTO subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status, notes
        ) VALUES (
            p_broadcaster_id, v_existing.id, v_tier.price_coins,
            'upgrade', 'completed', 'Tier upgrade - 90% to creator, 10% to admin pool'
        );
    ELSE
        v_pay_success := public.try_pay_coins(v_subscriber.id, v_tier.price_coins, 'subscription', jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'tier_id', p_tier_id,
            'type', 'new_subscription'
        ));

        IF NOT v_pay_success THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Insufficient coins. Required: ' || v_tier.price_coins || '. You have: ' || v_subscriber.troll_coins
            );
        END IF;

        v_creator_amount := (v_tier.price_coins * 90 / 100);
        v_admin_amount := (v_tier.price_coins * 10 / 100);

        INSERT INTO user_subscriptions (
            subscriber_id, broadcaster_id, tier_id,
            started_at, expires_at, is_active,
            auto_renew, total_paid_coins
        ) VALUES (
            v_subscriber.id, p_broadcaster_id, p_tier_id,
            NOW(),
            CASE
                WHEN p_auto_renew THEN (NOW() + INTERVAL '30 days')
                ELSE NULL
            END,
            true,
            p_auto_renew,
            v_tier.price_coins
        ) RETURNING * INTO v_new_subscription;

        BEGIN
            INSERT INTO user_follows (follower_id, following_id)
            VALUES (v_subscriber.id, p_broadcaster_id)
            ON CONFLICT (follower_id, following_id) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Follow creation failed: %', SQLERRM;
        END;

        UPDATE user_profiles
        SET
            total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
            troll_coins = troll_coins + v_creator_amount,
            subscriber_badge_color_hex = v_tier.color_hex
        WHERE id = p_broadcaster_id;

        SELECT id INTO v_pool_id FROM admin_pool LIMIT 1;
        IF v_pool_id IS NOT NULL THEN
            UPDATE admin_pool SET trollcoins_balance = trollcoins_balance + v_admin_amount WHERE id = v_pool_id;
            INSERT INTO admin_pool_ledger (amount, reason, ref_user_id, source_type, streamer_id)
            VALUES (v_admin_amount, 'New subscription fee', v_subscriber.id, 'subscription', p_broadcaster_id);
        END IF;

        INSERT INTO subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status
        ) VALUES (
            p_broadcaster_id, v_new_subscription.id, v_tier.price_coins,
            'monthly_fee', 'completed'
        );

        PERFORM pg_notify(
            'subscription_created',
            jsonb_build_object(
                'broadcaster_id', p_broadcaster_id,
                'subscriber_id', v_subscriber.id,
                'subscriber_username', v_subscriber.username,
                'tier_id', p_tier_id,
                'tier_name', v_tier.name,
                'amount', v_tier.price_coins
            )::text
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription', row_to_json(v_new_subscription),
        'tier', row_to_json(v_tier)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_subscription(UUID, UUID, BOOLEAN) TO authenticated;
