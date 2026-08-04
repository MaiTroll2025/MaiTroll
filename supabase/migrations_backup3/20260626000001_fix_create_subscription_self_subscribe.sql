-- Fix create_subscription: use auth.uid() instead of client-provided p_subscriber_id
-- This migration replaces the old 4-param function with a 3-param version

-- Step 1: Drop the old function (handles all possible signatures)
DO $$
BEGIN
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID, UUID, BOOLEAN)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION IF EXISTS create_subscription(UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Step 2: Create the new function with auth.uid()
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
BEGIN
    -- Get subscriber from auth (NOT from client parameter)
    SELECT * INTO v_subscriber FROM user_profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
    END IF;

    -- Level check (≥1) from user_profiles
    IF COALESCE(v_subscriber.level, 1) < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level 1 required to subscribe. Your level: ' || COALESCE(v_subscriber.level, 1));
    END IF;

    -- Get broadcaster
    SELECT * INTO v_broadcaster FROM user_profiles WHERE id = p_broadcaster_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
    END IF;

    -- Prevent self-subscription
    IF v_subscriber.id = v_broadcaster.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
    END IF;

    -- Get tier
    SELECT * INTO v_tier FROM subscription_tiers 
    WHERE id = p_tier_id AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription tier');
    END IF;

    -- Check existing subscription
    SELECT * INTO v_existing
    FROM user_subscriptions
    WHERE subscriber_id = v_subscriber.id 
      AND broadcaster_id = p_broadcaster_id 
      AND is_active = true;

    IF FOUND THEN
        -- Upgrade/Downgrade logic
        IF v_existing.tier_id = p_tier_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Already subscribed at this tier');
        END IF;
        
        -- Update subscription tier
        UPDATE user_subscriptions
        SET 
            tier_id = p_tier_id,
            total_paid_coins = total_paid_coins + v_tier.price_coins,
            updated_at = NOW()
        WHERE id = v_existing.id
        RETURNING * INTO v_new_subscription;
        
        -- Use try_pay_coins for upgrade payment
        v_pay_success := public.try_pay_coins(v_subscriber.id, v_tier.price_coins, 'subscription_upgrade', jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'tier_id', p_tier_id,
            'type', 'tier_upgrade'
        ));
        
        IF NOT v_pay_success THEN
            -- Rollback the tier update
            UPDATE user_subscriptions
            SET 
                tier_id = v_existing.tier_id,
                total_paid_coins = total_paid_coins - v_tier.price_coins,
                updated_at = NOW()
            WHERE id = v_existing.id;
            
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for upgrade');
        END IF;
        
        -- Add upgrade revenue
        UPDATE user_profiles
        SET total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins
        WHERE id = p_broadcaster_id;
        
        INSERT INTO subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status, notes
        ) VALUES (
            p_broadcaster_id, v_existing.id, v_tier.price_coins,
            'upgrade', 'completed', 'Tier upgrade'
        );
    ELSE
        -- New subscription - use try_pay_coins
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

        -- Create subscription
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

        -- Auto-follow: create follow relationship if not exists
        BEGIN
            INSERT INTO user_follows (follower_id, following_id)
            VALUES (v_subscriber.id, p_broadcaster_id)
            ON CONFLICT (follower_id, following_id) DO NOTHING;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Follow creation failed: %', SQLERRM;
        END;

        -- Credit broadcaster's revenue balance
        UPDATE user_profiles
        SET 
            total_subscriber_revenue_coins = total_subscriber_revenue_coins + v_tier.price_coins,
            monthly_subscriber_count = monthly_subscriber_count + 1,
            subscriber_badge_color_hex = v_tier.color_hex
        WHERE id = p_broadcaster_id;

        -- Log transaction
        INSERT INTO subscription_revenue_log (
            broadcaster_id, subscription_id, amount_coins,
            transaction_type, status
        ) VALUES (
            p_broadcaster_id, v_new_subscription.id, v_tier.price_coins,
            'monthly_fee', 'completed'
        );

        -- Notify broadcaster via realtime
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
