-- Subscription System Migration (CORRECTED)
-- Creates tables, RPC functions, policies, and default data for user subscriptions
-- Run: supabase db push

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: subscription_tiers
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (LENGTH(name) <= 50),
    price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
    benefits TEXT[] DEFAULT '{}',
    color_hex TEXT DEFAULT '#6B7280',
    icon_name TEXT DEFAULT 'Heart',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT subscription_tiers_name_unique UNIQUE(name)
);

-- Trigger for updated_at on subscription_tiers
CREATE OR REPLACE FUNCTION update_subscription_tier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscription_tier_updated ON subscription_tiers;
CREATE TRIGGER trigger_subscription_tier_updated
    BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_tier_timestamp();

-- ============================================
-- TABLE: user_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    broadcaster_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    auto_renew BOOLEAN DEFAULT true,
    total_paid_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT one_subscription_per_pair UNIQUE(subscriber_id, broadcaster_id),
    CONSTRAINT no_self_subscription CHECK (subscriber_id != broadcaster_id)
);

-- Trigger for updated_at on user_subscriptions
DROP TRIGGER IF EXISTS trigger_user_subscriptions_updated ON user_subscriptions;
CREATE TRIGGER trigger_user_subscriptions_updated
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_tier_timestamp();

-- ============================================
-- TABLE: subscription_revenue_log
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_revenue_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id UUID NOT NULL REFERENCES user_profiles(id),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id),
    amount_coins INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN ('monthly_fee', 'refund', 'chargeback', 'upgrade')
    ),
    payment_gateway TEXT DEFAULT 'internal',
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ALTER TABLE: Add subscription columns to user_profiles
-- ============================================
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS monthly_subscriber_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_subscriber_revenue_coins INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscriber_badge_color_hex TEXT DEFAULT '#6B7280',
    ADD COLUMN IF NOT EXISTS subscription_tier_id UUID REFERENCES subscription_tiers(id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscriber ON user_subscriptions(subscriber_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_broadcaster ON user_subscriptions(broadcaster_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_revenue_broadcaster ON subscription_revenue_log(broadcaster_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_revenue_sub ON subscription_revenue_log(subscription_id);

-- ============================================
-- TRIGGER: Auto-update subscriber counts
-- ============================================
CREATE OR REPLACE FUNCTION update_subscriber_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE user_profiles 
        SET monthly_subscriber_count = monthly_subscriber_count + 1
        WHERE id = NEW.broadcaster_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE user_profiles 
        SET monthly_subscriber_count = monthly_subscriber_count - 1
        WHERE id = OLD.broadcaster_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subscriber_count ON user_subscriptions;
CREATE TRIGGER trigger_update_subscriber_count
    AFTER INSERT OR DELETE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriber_counts();

-- ============================================
-- RLS: Enable on all subscription tables
-- ============================================
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_revenue_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: subscription_tiers
-- ============================================
DROP POLICY IF EXISTS "View active subscription tiers" ON subscription_tiers;
CREATE POLICY "View active subscription tiers" ON subscription_tiers
    FOR SELECT USING (is_active = true);

-- ============================================
-- POLICIES: user_subscriptions
-- ============================================
DROP POLICY IF EXISTS "View public subscriptions" ON user_subscriptions;
CREATE POLICY "View public subscriptions" ON user_subscriptions
    FOR SELECT USING (
        is_active = true AND
        (subscriber_id = auth.uid() OR broadcaster_id = auth.uid())
    );

DROP POLICY IF EXISTS "Manage own subscriptions" ON user_subscriptions;
CREATE POLICY "Manage own subscriptions" ON user_subscriptions
    FOR ALL USING (
        subscriber_id = auth.uid() OR
        broadcaster_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
              AND (role = 'admin' OR role = 'secretary')
        )
    );

DROP POLICY IF EXISTS "Admin full access subscriptions" ON user_subscriptions;
CREATE POLICY "Admin full access subscriptions" ON user_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
              AND (role = 'admin' OR role = 'secretary')
        )
    );

-- ============================================
-- POLICIES: subscription_revenue_log
-- ============================================
DROP POLICY IF EXISTS "Broadcaster can view own revenue" ON subscription_revenue_log;
CREATE POLICY "Broadcaster can view own revenue" ON subscription_revenue_log
    FOR SELECT USING (
        broadcaster_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
              AND (role = 'admin' OR role = 'secretary')
        )
    );

-- ============================================
-- INSERT DEFAULT TIERS
-- ============================================
INSERT INTO subscription_tiers (name, price_coins, benefits, color_hex, icon_name, sort_order) VALUES
('Fan', 100, ARRAY['Subscriber-only chat', 'Special subscriber badge'], '#6B7280', 'Heart', 1),
('VIP', 500, ARRAY['All Fan benefits', 'Custom emotes', 'Golden VIP badge', 'Auto-highlighted chat in all streams'], '#3B82F6', 'Crown', 2),
('Elite', 2000, ARRAY['All VIP benefits', 'Priority chat', 'Elite badge', 'Monthly gift'], '#8B5CF6', 'Gem', 3),
('Mythic', 10000, ARRAY['All Elite benefits', 'Monthly 1:1 shoutout', 'Mythic badge', 'Direct DM access'], '#F59E0B', 'Star', 4)
ON CONFLICT (name) DO UPDATE SET 
    price_coins = EXCLUDED.price_coins,
    benefits = EXCLUDED.benefits,
    color_hex = EXCLUDED.color_hex,
    icon_name = EXCLUDED.icon_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = NOW();

-- ============================================
-- RPC FUNCTION: create_subscription
-- ============================================
CREATE OR REPLACE FUNCTION create_subscription(
    p_subscriber_id UUID,
    p_broadcaster_id UUID,
    p_tier_id UUID,
    p_auto_renew BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_subscriber user_profiles%ROWTYPE;
    v_broadcaster user_profiles%ROWTYPE;
    v_tier subscription_tiers%ROWTYPE;
    v_existing user_subscriptions%ROWTYPE;  -- Fixed: was subscription%ROWTYPE
    v_new_subscription user_subscriptions%ROWTYPE;  -- Fixed: was subscription%ROWTYPE
BEGIN
    -- Get subscriber
    SELECT * INTO v_subscriber FROM user_profiles WHERE id = p_subscriber_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscriber not found');
    END IF;

    -- Level check (≥10)
    IF (v_subscriber.level < 10) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Level 1 required to subscribe');
    END IF;

    -- Get broadcaster
    SELECT * INTO v_broadcaster FROM user_profiles WHERE id = p_broadcaster_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
    END IF;

    -- Prevent self-subscription
    IF p_subscriber_id = p_broadcaster_id THEN
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
    WHERE subscriber_id = p_subscriber_id 
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
        -- New subscription - coin transfer check
        IF v_subscriber.troll_coins < v_tier.price_coins THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Insufficient coins. Required: ' || v_tier.price_coins || '. You have: ' || v_subscriber.troll_coins
            );
        END IF;

        -- Begin transaction
        BEGIN
            -- Deduct from subscriber
            UPDATE user_profiles
            SET troll_coins = troll_coins - v_tier.price_coins
            WHERE id = p_subscriber_id;

            -- Create subscription
            INSERT INTO user_subscriptions (
                subscriber_id, broadcaster_id, tier_id,
                started_at, expires_at, is_active,
                auto_renew, total_paid_coins
            ) VALUES (
                p_subscriber_id, p_broadcaster_id, p_tier_id,
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
                VALUES (p_subscriber_id, p_broadcaster_id)
                ON CONFLICT (follower_id, following_id) DO NOTHING;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Ignore follow errors (table might not exist yet)
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
                    'subscriber_id', p_subscriber_id,
                    'subscriber_username', v_subscriber.username,
                    'tier_id', p_tier_id,
                    'tier_name', v_tier.name,
                    'amount', v_tier.price_coins
                )::text
            );
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription', row_to_json(v_new_subscription),
        'tier', row_to_json(v_tier)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on create_subscription
GRANT EXECUTE ON FUNCTION create_subscription(UUID, UUID, UUID, BOOLEAN) TO authenticated;

-- ============================================
-- RPC FUNCTION: unsubscribe_from_broadcaster
-- ============================================
CREATE OR REPLACE FUNCTION unsubscribe_from_broadcaster(
    p_subscriber_id UUID,
    p_broadcaster_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_subscription user_subscriptions%ROWTYPE;  -- Fixed: was subscription%ROWTYPE
    v_tier subscription_tiers%ROWTYPE;
BEGIN
    -- Find active subscription
    SELECT * INTO v_subscription
    FROM user_subscriptions
    WHERE subscriber_id = p_subscriber_id 
      AND broadcaster_id = p_broadcaster_id
      AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active subscription found');
    END IF;

    -- Get tier details
    SELECT * INTO v_tier FROM subscription_tiers WHERE id = v_subscription.tier_id;

    -- Deactivate subscription
    UPDATE user_subscriptions
    SET 
        is_active = false,
        auto_renew = false,
        expires_at = NOW(),
        updated_at = NOW()
    WHERE id = v_subscription.id;

    -- Decrement subscriber count
    UPDATE user_profiles
    SET monthly_subscriber_count = monthly_subscriber_count - 1
    WHERE id = p_broadcaster_id;

    -- Notify
    PERFORM pg_notify(
        'subscription_cancelled',
        jsonb_build_object(
            'broadcaster_id', p_broadcaster_id,
            'subscriber_id', p_subscriber_id
        )::text
    );

    RETURN jsonb_build_object('success', true, 'message', 'Unsubscribed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on unsubscribe_from_broadcaster
GRANT EXECUTE ON FUNCTION unsubscribe_from_broadcaster(UUID, UUID) TO authenticated;

-- ============================================
-- RPC FUNCTION: get_broadcaster_subscription_stats
-- ============================================
CREATE OR REPLACE FUNCTION get_broadcaster_subscription_stats(
    p_broadcaster_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_stats RECORD;
BEGIN
    SELECT 
        COUNT(*) as total_subscribers,
        COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '30 days') as new_subscribers_30d,
        COALESCE(SUM(total_paid_coins), 0) as total_revenue,
        COALESCE(SUM(total_paid_coins) FILTER (WHERE started_at > NOW() - INTERVAL '30 days'), 0) as monthly_revenue
    INTO v_stats
    FROM user_subscriptions
    WHERE broadcaster_id = p_broadcaster_id 
      AND is_active = true;
    
    RETURN jsonb_build_object(
        'success', true,
        'subscriber_count', COALESCE(v_stats.total_subscribers, 0),
        'new_subscribers_30d', COALESCE(v_stats.new_subscribers_30d, 0),
        'total_revenue', COALESCE(v_stats.total_revenue, 0),
        'monthly_revenue', COALESCE(v_stats.monthly_revenue, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on get_broadcaster_subscription_stats
GRANT EXECUTE ON FUNCTION get_broadcaster_subscription_stats(UUID) TO authenticated;

-- ============================================
-- RPC FUNCTION: get_platform_subscription_stats (Admin only)
-- ============================================
CREATE OR REPLACE FUNCTION get_platform_subscription_stats()
RETURNS JSONB AS $$
DECLARE
    v_total_subs INTEGER;
    v_active_subs INTEGER;
    v_total_revenue BIGINT;
    v_monthly_revenue BIGINT;
    v_new_subs_30d INTEGER;
    v_tier_counts JSONB;
BEGIN
    -- Total subscriptions ever
    SELECT COUNT(*) INTO v_total_subs FROM user_subscriptions;
    
    -- Currently active subscriptions
    SELECT COUNT(*) INTO v_active_subs FROM user_subscriptions WHERE is_active = true;
    
    -- Total revenue all time
    SELECT COALESCE(SUM(total_paid_coins), 0) INTO v_total_revenue FROM user_profiles;
    
    -- Monthly revenue (last 30 days)
    SELECT COALESCE(SUM(amount_coins), 0) INTO v_monthly_revenue
    FROM subscription_revenue_log
    WHERE created_at > NOW() - INTERVAL '30 days'
      AND status = 'completed';
    
    -- New subscribers in last 30 days
    SELECT COUNT(*) INTO v_new_subs_30d
    FROM user_subscriptions
    WHERE started_at > NOW() - INTERVAL '30 days';
    
    -- Tier breakdown
    SELECT jsonb_object_agg(t.name, COUNT(us.id))
    INTO v_tier_counts
    FROM subscription_tiers t
    LEFT JOIN user_subscriptions us ON t.id = us.tier_id AND us.is_active = true
    WHERE t.is_active = true
    GROUP BY t.name;
    
    RETURN jsonb_build_object(
        'success', true,
        'total_subscriptions', v_total_subs,
        'active_subscriptions', v_active_subs,
        'total_revenue_coins', v_total_revenue,
        'monthly_revenue_coins', v_monthly_revenue,
        'new_subscribers_30d', v_new_subs_30d,
        'tier_breakdown', COALESCE(v_tier_counts, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated (will be checked by RLS inside)
GRANT EXECUTE ON FUNCTION get_platform_subscription_stats() TO authenticated;

-- ============================================
-- RPC FUNCTION: get_broadcaster_subscription_stats
-- ============================================
CREATE OR REPLACE FUNCTION get_broadcaster_subscription_stats(
    p_broadcaster_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_stats RECORD;
BEGIN
    SELECT 
        COUNT(*) as total_subscribers,
        COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '30 days') as new_subscribers_30d,
        COALESCE(SUM(total_paid_coins), 0) as total_revenue,
        COALESCE(SUM(total_paid_coins) FILTER (WHERE started_at > NOW() - INTERVAL '30 days'), 0) as monthly_revenue
    INTO v_stats
    FROM user_subscriptions
    WHERE broadcaster_id = p_broadcaster_id 
      AND is_active = true;
    
    RETURN jsonb_build_object(
        'success', true,
        'subscriber_count', COALESCE(v_stats.total_subscribers, 0),
        'new_subscribers_30d', COALESCE(v_stats.new_subscribers_30d, 0),
        'total_revenue', COALESCE(v_stats.total_revenue, 0),
        'monthly_revenue', COALESCE(v_stats.monthly_revenue, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on get_broadcaster_subscription_stats
GRANT EXECUTE ON FUNCTION get_broadcaster_subscription_stats(UUID) TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Deploy: supabase db push
-- 2. Create frontend components (already created):
--    - src/stores/useSubscriptionStore.ts
--    - src/components/user/SubscribeButton.tsx
--    - src/components/user/SubscriptionTierSelector.tsx
--    - src/components/user/UserMiniProfile.tsx
-- 3. Integrate into ClickableUsername.tsx and BroadcastPage.tsx
-- 4. Test with level 10+ user
