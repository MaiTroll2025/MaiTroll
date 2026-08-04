-- Update Subscription System for Creator Subscriptions with Troll Coin Payments
-- Adds creator subscription settings and enables 90/10 coin split to CEO

-- Add creator subscription settings columns to user_profiles
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS creator_subscription_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS creator_subscription_price_coins INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS creator_subscription_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add split fields to user_subscriptions for tracking
ALTER TABLE user_subscriptions
    ADD COLUMN IF NOT EXISTS price_paid_coins INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS creator_amount_coins INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ceo_amount_coins INTEGER DEFAULT 0;

-- Add index for faster subscriber lookups for badges
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_broadcaster_active 
    ON user_subscriptions(broadcaster_id, is_active) 
    WHERE is_active = true;

-- ============================================
-- RPC FUNCTION: subscribe_to_creator
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

    -- Begin transaction for coin transfers
    BEGIN
        -- Deduct from subscriber
        UPDATE user_profiles
        SET troll_coins = troll_coins - v_price
        WHERE id = v_subscriber.id;

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
    END;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION subscribe_to_creator(UUID) TO authenticated;

-- Add comment for CEO UUID configuration
COMMENT ON FUNCTION subscribe_to_creator() IS 'Uses first admin/ceo user found as CEO recipient for 10% fee';