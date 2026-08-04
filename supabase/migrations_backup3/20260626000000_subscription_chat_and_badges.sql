-- Subscription System Update: Subscriber-only chat, auto-highlight, badges
-- Adds subscriber_only_chat to streams, updates tier benefits, adds badge support

-- ============================================
-- Add subscriber_only_chat to streams table
-- ============================================
ALTER TABLE streams
    ADD COLUMN IF NOT EXISTS subscriber_only_chat BOOLEAN DEFAULT false;

-- RLS: keep existing policies (public read, broadcaster manage)

-- ============================================
-- Update subscription tier benefits
-- Fan: subscriber-only chat + special subscriber badge
-- VIP: all Fan benefits + custom emotes + golden VIP badge + auto-highlighted chat
-- Elite: all VIP benefits + priority chat + elite badge + monthly gift
-- Mythic: all Elite benefits + monthly 1:1 shoutout + mythic badge + direct DM access
-- ============================================
UPDATE subscription_tiers SET benefits = ARRAY['Subscriber-only chat', 'Special subscriber badge'] WHERE name = 'Fan';
UPDATE subscription_tiers SET benefits = ARRAY['All Fan benefits', 'Custom emotes', 'Golden VIP badge', 'Auto-highlighted chat in all streams'] WHERE name = 'VIP';
UPDATE subscription_tiers SET benefits = ARRAY['All VIP benefits', 'Priority chat', 'Elite badge', 'Monthly gift'] WHERE name = 'Elite';
UPDATE subscription_tiers SET benefits = ARRAY['All Elite benefits', 'Monthly 1:1 shoutout', 'Mythic badge', 'Direct DM access'] WHERE name = 'Mythic';

-- ============================================
-- Add subscription_tier_id to user_profiles if not exists
-- (stores the highest tier the user holds, for quick badge lookups)
-- ============================================
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS highest_subscription_tier_id UUID REFERENCES subscription_tiers(id);

-- Index for fast subscriber badge lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_highest_sub_tier
    ON user_profiles(highest_subscription_tier_id)
    WHERE highest_subscription_tier_id IS NOT NULL;

-- ============================================
-- RPC: Update subscriber's highest tier (called on subscribe/unsubscribe)
-- ============================================
CREATE OR REPLACE FUNCTION update_user_highest_subscription_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_highest_tier_id UUID;
BEGIN
    SELECT tier_id INTO v_highest_tier_id
    FROM user_subscriptions
    WHERE subscriber_id = p_user_id AND is_active = true
    ORDER BY (
        SELECT sort_order FROM subscription_tiers WHERE id = user_subscriptions.tier_id
    ) DESC
    LIMIT 1;

    UPDATE user_profiles
    SET highest_subscription_tier_id = v_highest_tier_id
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC: Check if user can chat in a stream (subscriber-only enforcement)
-- ============================================
CREATE OR REPLACE FUNCTION can_user_chat_in_stream(
    p_user_id UUID,
    p_stream_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_subscriber_only_chat BOOLEAN;
    v_stream_user_id UUID;
    v_is_subscribed BOOLEAN;
    v_is_staff BOOLEAN;
BEGIN
    -- Get stream settings
    SELECT subscriber_only_chat, user_id
    INTO v_subscriber_only_chat, v_stream_user_id
    FROM streams WHERE id = p_stream_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_chat', true, 'reason', 'Stream not found, allowing chat');
    END IF;

    -- Broadcaster can always chat
    IF v_stream_user_id = p_user_id THEN
        RETURN jsonb_build_object('can_chat', true, 'reason', 'Broadcaster');
    END IF;

    -- Staff can always chat
    SELECT EXISTS(
        SELECT 1 FROM user_profiles
        WHERE id = p_user_id AND (role = 'admin' OR role = 'troll_officer' OR is_admin = true OR is_troll_officer = true)
    ) INTO v_is_staff;

    IF v_is_staff THEN
        RETURN jsonb_build_object('can_chat', true, 'reason', 'Staff');
    END IF;

    -- If subscriber-only chat is not enabled, everyone can chat
    IF v_subscriber_only_chat IS NOT TRUE THEN
        RETURN jsonb_build_object('can_chat', true, 'reason', 'Chat is open');
    END IF;

    -- Check if user is subscribed to the broadcaster
    SELECT EXISTS(
        SELECT 1 FROM user_subscriptions
        WHERE subscriber_id = p_user_id
          AND broadcaster_id = v_stream_user_id
          AND is_active = true
    ) INTO v_is_subscribed;

    IF v_is_subscribed THEN
        RETURN jsonb_build_object('can_chat', true, 'reason', 'Subscriber');
    ELSE
        RETURN jsonb_build_object('can_chat', false, 'reason', 'Subscriber-only chat — subscribe to chat in this stream');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC: Get subscriber badge info for a user in a broadcaster's context
-- ============================================
CREATE OR REPLACE FUNCTION get_subscriber_badge(
    p_username TEXT,
    p_broadcaster_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_tier_name TEXT;
    v_tier_color TEXT;
    v_tier_icon TEXT;
    v_sort_order INTEGER;
BEGIN
    SELECT st.name, st.color_hex, st.icon_name, st.sort_order
    INTO v_tier_name, v_tier_color, v_tier_icon, v_sort_order
    FROM user_subscriptions us
    JOIN user_profiles up ON up.id = us.subscriber_id
    JOIN subscription_tiers st ON st.id = us.tier_id
    WHERE up.username = p_username
      AND us.broadcaster_id = p_broadcaster_id
      AND us.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'tier_name', v_tier_name,
        'tier_color', v_tier_color,
        'tier_icon', v_tier_icon,
        'sort_order', v_sort_order
    );
END;
$$ LANGUAGE plpgsql;
