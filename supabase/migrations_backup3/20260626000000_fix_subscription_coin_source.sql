-- Fix Subscription & Paid Chat Coin Source
-- Ensures all coin operations use try_pay_coins (same as bottom nav bar)
-- Level checks from user_profiles only (same table as bottom nav bar reads)

-- Drop ALL overloads of create_subscription first (handles signature change)
-- Use exception handling to avoid errors when a signature doesn't exist
DO $$
BEGIN
    BEGIN EXECUTE 'DROP FUNCTION create_subscription(UUID, UUID, UUID, BOOLEAN)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION create_subscription(UUID, UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP FUNCTION create_subscription(UUID, UUID)'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ============================================
-- 1. FIX: subscribe_to_creator RPC
--    - Use try_pay_coins instead of direct UPDATE
--    - Check level from user_profiles (matching bottom nav)
-- ============================================
CREATE OR REPLACE FUNCTION subscribe_to_creator(p_creator_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_subscriber user_profiles%ROWTYPE;
    v_creator user_profiles%ROWTYPE;
    v_existing user_subscriptions%ROWTYPE;
    v_subscription_id UUID;
    v_price INTEGER;
    v_creator_amount INTEGER;
    v_ceo_amount INTEGER;
    v_ceo_id UUID;
    v_pay_success BOOLEAN;
BEGIN
    -- Get subscriber from auth
    SELECT * INTO v_subscriber FROM user_profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
    END IF;

    -- Get creator (broadcaster) - must have subscriptions enabled
    SELECT * INTO v_creator FROM user_profiles WHERE id = p_creator_id;
    IF NOT FOUND OR NOT v_creator.creator_subscription_enabled THEN
        RETURN jsonb_build_object('success', false, 'error', 'Creator subscriptions not available');
    END IF;

    v_price := COALESCE(v_creator.creator_subscription_price_coins, 100);
    v_creator_amount := (v_price * 90 / 100);
    v_ceo_amount := (v_price * 10 / 100);

    -- Prevent self-subscription
    IF v_subscriber.id = v_creator.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
    END IF;

    -- Check for existing active subscription
    SELECT * INTO v_existing
    FROM user_subscriptions
    WHERE subscriber_id = v_subscriber.id 
      AND broadcaster_id = v_creator.id
      AND is_active = true;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already subscribed to this creator');
    END IF;

    -- Level check from user_profiles only
    IF COALESCE(v_subscriber.level, 1) < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level 1 required to subscribe. Your level: ' || COALESCE(v_subscriber.level, 1));
    END IF;

    -- Check coin balance
    IF v_subscriber.troll_coins < v_price THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient coins. Required: ' || v_price || '. You have: ' || v_subscriber.troll_coins
        );
    END IF;

    -- Get CEO ID (admin user)
    SELECT id INTO v_ceo_id
    FROM user_profiles
    WHERE role = 'admin' OR role = 'ceo'
    LIMIT 1;

    -- Use try_pay_coins (canonical coin spending with ledger logging)
    v_pay_success := public.try_pay_coins(v_subscriber.id, v_price, 'subscription', jsonb_build_object(
        'creator_id', p_creator_id,
        'type', 'creator_subscription'
    ));
    
    IF NOT v_pay_success THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment failed. Please try again.');
    END IF;

    -- Credit creator (90%)
    UPDATE user_profiles
    SET troll_coins = troll_coins + v_creator_amount
    WHERE id = v_creator.id;

    -- Credit CEO (10%) if found
    IF v_ceo_id IS NOT NULL THEN
        UPDATE user_profiles
        SET troll_coins = troll_coins + v_ceo_amount
        WHERE id = v_ceo_id;
    END IF;

    -- Create subscription record
    INSERT INTO user_subscriptions (
        subscriber_id, 
        broadcaster_id,
        price_paid_coins,
        creator_amount_coins,
        ceo_amount_coins,
        started_at,
        expires_at,
        is_active
    ) VALUES (
        v_subscriber.id,
        v_creator.id,
        v_price,
        v_creator_amount,
        v_ceo_amount,
        NOW(),
        NOW() + INTERVAL '30 days',
        true
    ) RETURNING id INTO v_subscription_id;

    -- Log revenue for creator
    INSERT INTO subscription_revenue_log (
        broadcaster_id, 
        subscription_id, 
        amount_coins,
        transaction_type, 
        status,
        notes
    ) VALUES (
        v_creator.id, 
        v_subscription_id, 
        v_price,
        'monthly_fee', 
        'completed',
        'Creator subscription - 90% to creator, 10% to CEO'
    );

    -- Update creator stats
    UPDATE user_profiles
    SET monthly_subscriber_count = COALESCE(monthly_subscriber_count, 0) + 1
    WHERE id = v_creator.id;

    -- Notify via realtime
    PERFORM pg_notify(
        'subscription_created',
        jsonb_build_object(
            'broadcaster_id', v_creator.id,
            'subscriber_id', v_subscriber.id,
            'subscriber_username', v_subscriber.username,
            'amount', v_price
        )::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'subscription', jsonb_build_object(
            'id', v_subscription_id,
            'price_paid_coins', v_price,
            'creator_amount_coins', v_creator_amount,
            'ceo_amount_coins', v_ceo_amount
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION subscribe_to_creator(UUID) TO authenticated;

-- ============================================
-- 2. FIX: create_subscription RPC
--    - Use auth.uid() for subscriber (NOT client-provided)
--    - Use try_pay_coins instead of direct UPDATE
--    - Check level from user_profiles only
--    - Add self-subscription check
-- ============================================

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

    -- Level check from user_profiles only
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
