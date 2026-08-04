-- ============================================================================
-- Mai Troll PROFILE SYSTEM OVERHAUL
-- Complete career-based profile system with subscriptions, role cards, and dynamic rendering
-- ============================================================================

-- 1. SUBSCRIPTION SYSTEM TABLES
-- Creator subscription settings (global per creator)
CREATE TABLE IF NOT EXISTS public.creator_subscription_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    payout_percentage INT NOT NULL DEFAULT 70 CHECK (payout_percentage BETWEEN 0 AND 100),
    stripe_account_id TEXT,
    stripe_account_enabled BOOLEAN NOT NULL DEFAULT false,
    subscriber_count INT NOT NULL DEFAULT 0,
    monthly_revenue_coins INT NOT NULL DEFAULT 0,
    total_revenue_coins INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_subscription_settings_creator_id 
    ON public.creator_subscription_settings(creator_id);

-- Creator subscription tiers (up to 5 per creator)
CREATE TABLE IF NOT EXISTS public.creator_subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_number INT NOT NULL CHECK (tier_number BETWEEN 1 AND 5),
    name TEXT NOT NULL,
    description TEXT,
    monthly_price_coins INT NOT NULL DEFAULT 0,
    monthly_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    subscriber_count INT NOT NULL DEFAULT 0,
    badge_icon TEXT,
    badge_color TEXT,
    benefits JSONB DEFAULT '[]'::jsonb,
    exclusive_content_access BOOLEAN NOT NULL DEFAULT false,
    subscriber_chat_access BOOLEAN NOT NULL DEFAULT false,
    subscriber_broadcast_access BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(creator_id, tier_number)
);

CREATE INDEX IF NOT EXISTS idx_creator_subscription_tiers_creator_id 
    ON public.creator_subscription_tiers(creator_id);

-- Active subscribers
CREATE TABLE IF NOT EXISTS public.creator_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.creator_subscription_tiers(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    total_paid_coins INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subscriber_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_subscribers_subscriber_id 
    ON public.creator_subscribers(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscribers_creator_id 
    ON public.creator_subscribers(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_subscribers_status 
    ON public.creator_subscribers(creator_id, status) WHERE status = 'active';

-- Subscription payment history
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES public.creator_subscription_tiers(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT,
    stripe_subscription_id TEXT,
    amount_coins INT NOT NULL,
    amount_usd NUMERIC(10,2),
    currency TEXT NOT NULL DEFAULT 'TC',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_type TEXT NOT NULL DEFAULT 'subscription' CHECK (payment_type IN ('subscription', 'one_time', 'gift')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscriber_id 
    ON public.subscription_payments(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_creator_id 
    ON public.subscription_payments(creator_id);

-- Subscription benefits definition
CREATE TABLE IF NOT EXISTS public.subscription_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID NOT NULL REFERENCES public.creator_subscription_tiers(id) ON DELETE CASCADE,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('badge', 'emoji', 'access', 'discount', 'custom')),
    benefit_name TEXT NOT NULL,
    benefit_description TEXT,
    benefit_value TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_benefits_tier_id 
    ON public.subscription_benefits(tier_id);

-- 2. ROLE-SPECIFIC STATISTICS TABLES
-- Auctioneer statistics
CREATE TABLE IF NOT EXISTS public.stats_auctioneer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    auctions_hosted INT NOT NULL DEFAULT 0,
    items_sold INT NOT NULL DEFAULT 0,
    coins_generated INT NOT NULL DEFAULT 0,
    upcoming_auctions INT NOT NULL DEFAULT 0,
    reputation_score NUMERIC(5,2) DEFAULT 0,
    total_revenue INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_auctioneer_user_id ON public.stats_auctioneer(user_id);

-- Attorney statistics
CREATE TABLE IF NOT EXISTS public.stats_attorney (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    cases_handled INT NOT NULL DEFAULT 0,
    cases_won INT NOT NULL DEFAULT 0,
    appeals_won INT NOT NULL DEFAULT 0,
    rating NUMERIC(5,2) DEFAULT 0,
    total_earnings INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_attorney_user_id ON public.stats_attorney(user_id);

-- Prosecutor statistics
CREATE TABLE IF NOT EXISTS public.stats_prosecutor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    cases_prosecuted INT NOT NULL DEFAULT 0,
    successful_prosecutions INT NOT NULL DEFAULT 0,
    conviction_rate NUMERIC(5,2) DEFAULT 0,
    total_earnings INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_prosecutor_user_id ON public.stats_prosecutor(user_id);

-- Journalist statistics
CREATE TABLE IF NOT EXISTS public.stats_journalist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    articles_published INT NOT NULL DEFAULT 0,
    investigations_completed INT NOT NULL DEFAULT 0,
    followers_count INT NOT NULL DEFAULT 0,
    total_views INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_journalist_user_id ON public.stats_journalist(user_id);

-- Pastor statistics
CREATE TABLE IF NOT EXISTS public.stats_pastor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    services_hosted INT NOT NULL DEFAULT 0,
    community_members_helped INT NOT NULL DEFAULT 0,
    church_followers INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_pastor_user_id ON public.stats_pastor(user_id);

-- Seller statistics
CREATE TABLE IF NOT EXISTS public.stats_seller (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    items_sold INT NOT NULL DEFAULT 0,
    active_listings INT NOT NULL DEFAULT 0,
    seller_rating NUMERIC(5,2) DEFAULT 0,
    total_reviews INT NOT NULL DEFAULT 0,
    store_followers INT NOT NULL DEFAULT 0,
    total_revenue INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_seller_user_id ON public.stats_seller(user_id);

-- Broadcaster statistics
CREATE TABLE IF NOT EXISTS public.stats_broadcaster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    followers_count INT NOT NULL DEFAULT 0,
    broadcast_hours INT NOT NULL DEFAULT 0,
    total_broadcasts INT NOT NULL DEFAULT 0,
    highest_viewers INT NOT NULL DEFAULT 0,
    total_gifts_received INT NOT NULL DEFAULT 0,
    total_gift_coins INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_broadcaster_user_id ON public.stats_broadcaster(user_id);

-- 3. PROFILE ROLE ASSIGNMENTS (for role cards)
CREATE TABLE IF NOT EXISTS public.user_profile_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN (
        'auctioneer', 'attorney', 'prosecutor', 'journalist', 'news_caster',
        'chief_news_caster', 'troll_officer', 'lead_troll_officer', 'pastor',
        'agency_leader', 'agency_hr', 'agency_hr_manager', 'secretary',
        'ceo_assistant', 'noah_assistant', 'troller', 'seller', 'broadcaster'
    )),
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_roles_user_id ON public.user_profile_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_roles_active ON public.user_profile_roles(user_id, is_active) WHERE is_active = true;

-- 4. PROFILE TAB VISIBILITY (which tabs to show)
CREATE TABLE IF NOT EXISTS public.profile_tab_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tab_key TEXT NOT NULL CHECK (tab_key IN (
        'social', 'broadcasts', 'marketplace', 'auctions', 'court',
        'agency', 'church', 'subscriptions', 'badges', 'inventory',
        'purchases', 'settings'
    )),
    is_visible BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_profile_tab_visibility_user_id ON public.profile_tab_visibility(user_id);

-- 5. TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
    trig_name TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['creator_subscription_settings', 'creator_subscription_tiers', 'creator_subscribers', 'stats_auctioneer', 'stats_attorney', 'stats_prosecutor', 'stats_journalist', 'stats_pastor', 'stats_seller', 'stats_broadcaster'])
    LOOP
        trig_name := 'trg_' || t || '_updated_at';
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I; CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', trig_name, t, trig_name, t);
    END LOOP;
END $$;

-- 6. FUNCTION: Get creator subscription tiers
CREATE OR REPLACE FUNCTION public.get_creator_subscription_tiers(p_creator_id UUID)
RETURNS TABLE (
    id UUID,
    tier_number INT,
    name TEXT,
    description TEXT,
    monthly_price_coins INT,
    monthly_price_usd NUMERIC,
    is_enabled BOOLEAN,
    subscriber_count INT,
    badge_icon TEXT,
    badge_color TEXT,
    benefits JSONB,
    exclusive_content_access BOOLEAN,
    subscriber_chat_access BOOLEAN,
    subscriber_broadcast_access BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id, ct.tier_number, ct.name, ct.description,
        ct.monthly_price_coins, ct.monthly_price_usd, ct.is_enabled,
        ct.subscriber_count, ct.badge_icon, ct.badge_color,
        ct.benefits, ct.exclusive_content_access,
        ct.subscriber_chat_access, ct.subscriber_broadcast_access
    FROM public.creator_subscription_tiers ct
    WHERE ct.creator_id = p_creator_id
    ORDER BY ct.tier_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNCTION: Get user's active subscription to a creator
CREATE OR REPLACE FUNCTION public.get_user_active_subscription(p_subscriber_id UUID, p_creator_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    tier_id UUID,
    tier_name TEXT,
    tier_number INT,
    status TEXT,
    current_period_end TIMESTAMPTZ,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id, cs.tier_id, ct.name, ct.tier_number,
        cs.status, cs.current_period_end, cs.started_at
    FROM public.creator_subscribers cs
    JOIN public.creator_subscription_tiers ct ON ct.id = cs.tier_id
    WHERE cs.subscriber_id = p_subscriber_id 
      AND cs.creator_id = p_creator_id
      AND cs.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNCTION: Get user's active roles
CREATE OR REPLACE FUNCTION public.get_user_active_roles(p_user_id UUID)
RETURNS TABLE (
    role_type TEXT,
    is_active BOOLEAN,
    assigned_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT upr.role_type, upr.is_active, upr.assigned_at, upr.metadata
    FROM public.user_profile_roles upr
    WHERE upr.user_id = p_user_id AND upr.is_active = true
    ORDER BY upr.assigned_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FUNCTION: Get role statistics
CREATE OR REPLACE FUNCTION public.get_role_statistics(p_user_id UUID, p_role_type TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    CASE p_role_type
        WHEN 'auctioneer' THEN
            SELECT jsonb_build_object(
                'auctions_hosted', sa.auctions_hosted,
                'items_sold', sa.items_sold,
                'coins_generated', sa.coins_generated,
                'upcoming_auctions', sa.upcoming_auctions,
                'reputation_score', sa.reputation_score
            ) INTO result
            FROM public.stats_auctioneer sa WHERE sa.user_id = p_user_id;
        WHEN 'attorney' THEN
            SELECT jsonb_build_object(
                'cases_handled', sa.cases_handled,
                'cases_won', sa.cases_won,
                'appeals_won', sa.appeals_won,
                'rating', sa.rating
            ) INTO result
            FROM public.stats_attorney sa WHERE sa.user_id = p_user_id;
        WHEN 'prosecutor' THEN
            SELECT jsonb_build_object(
                'cases_prosecuted', sa.cases_prosecuted,
                'successful_prosecutions', sa.successful_prosecutions,
                'conviction_rate', sa.conviction_rate
            ) INTO result
            FROM public.stats_prosecutor sa WHERE sa.user_id = p_user_id;
        WHEN 'journalist' THEN
            SELECT jsonb_build_object(
                'articles_published', sj.articles_published,
                'investigations_completed', sj.investigations_completed,
                'followers_count', sj.followers_count
            ) INTO result
            FROM public.stats_journalist sj WHERE sj.user_id = p_user_id;
        WHEN 'pastor' THEN
            SELECT jsonb_build_object(
                'services_hosted', sp.services_hosted,
                'community_members_helped', sp.community_members_helped,
                'church_followers', sp.church_followers
            ) INTO result
            FROM public.stats_pastor sp WHERE sp.user_id = p_user_id;
        WHEN 'seller' THEN
            SELECT jsonb_build_object(
                'items_sold', ss.items_sold,
                'active_listings', ss.active_listings,
                'seller_rating', ss.seller_rating,
                'total_reviews', ss.total_reviews,
                'store_followers', ss.store_followers
            ) INTO result
            FROM public.stats_seller ss WHERE ss.user_id = p_user_id;
        WHEN 'broadcaster' THEN
            SELECT jsonb_build_object(
                'followers_count', sb.followers_count,
                'broadcast_hours', sb.broadcast_hours,
                'total_broadcasts', sb.total_broadcasts,
                'highest_viewers', sb.highest_viewers,
                'total_gifts_received', sb.total_gifts_received
            ) INTO result
            FROM public.stats_broadcaster sb WHERE sb.user_id = p_user_id;
        ELSE
            result := NULL;
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. FUNCTION: Get profile tabs to display
CREATE OR REPLACE FUNCTION public.get_profile_tabs(p_user_id UUID)
RETURNS TABLE (
    tab_key TEXT,
    is_visible BOOLEAN,
    display_order INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ptv.tab_key, ptv.is_visible, ptv.display_order
    FROM public.profile_tab_visibility ptv
    WHERE ptv.user_id = p_user_id
    ORDER BY ptv.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNCTION: Initialize default profile tabs for user
CREATE OR REPLACE FUNCTION public.initialize_profile_tabs(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    has_auctioneer BOOLEAN := false;
    has_attorney BOOLEAN := false;
    has_prosecutor BOOLEAN := false;
    has_journalist BOOLEAN := false;
    has_pastor BOOLEAN := false;
    has_seller BOOLEAN := false;
    has_broadcaster BOOLEAN := false;
    has_subscription BOOLEAN := false;
BEGIN
    -- Check user roles (COALESCE to handle NULL from bool_or)
    SELECT COALESCE(bool_or(role_type = 'auctioneer'), false) INTO has_auctioneer
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type IN ('attorney', 'prosecutor')), false) INTO has_attorney
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type = 'prosecutor'), false) INTO has_prosecutor
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type IN ('journalist', 'news_caster', 'chief_news_caster')), false) INTO has_journalist
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type = 'pastor'), false) INTO has_pastor
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type = 'seller'), false) INTO has_seller
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COALESCE(bool_or(role_type = 'broadcaster'), false) INTO has_broadcaster
    FROM public.user_profile_roles WHERE user_id = p_user_id AND is_active = true;
    
    -- Check if user has subscription settings
    SELECT COALESCE(EXISTS(SELECT 1 FROM public.creator_subscription_settings WHERE creator_id = p_user_id), false) INTO has_subscription;
    
    -- Insert default tab visibility
    INSERT INTO public.profile_tab_visibility (user_id, tab_key, is_visible, display_order) VALUES
        (p_user_id, 'social', true, 1),
        (p_user_id, 'broadcasts', has_broadcaster, 2),
        (p_user_id, 'marketplace', has_seller, 3),
        (p_user_id, 'auctions', has_auctioneer, 4),
        (p_user_id, 'court', has_attorney OR has_prosecutor, 5),
        (p_user_id, 'agency', false, 6),
        (p_user_id, 'church', has_pastor, 7),
        (p_user_id, 'subscriptions', has_subscription, 8),
        (p_user_id, 'badges', true, 9),
        (p_user_id, 'inventory', true, 10),
        (p_user_id, 'purchases', true, 11),
        (p_user_id, 'settings', true, 12)
    ON CONFLICT (user_id, tab_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. FUNCTION: Initialize default subscription tiers for creator
CREATE OR REPLACE FUNCTION public.initialize_subscription_tiers(p_creator_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.creator_subscription_tiers 
        (creator_id, tier_number, name, description, monthly_price_coins, monthly_price_usd, badge_icon, badge_color, benefits)
    VALUES
        (p_creator_id, 1, 'Supporter', 'Show your support and get a badge', 300, 2.99, '💜', '#9333ea', '["Supporter Badge"]'::jsonb),
        (p_creator_id, 2, 'Bronze', 'Unlock bronze perks and exclusive content', 500, 4.99, '🥉', '#CD7F32', '["Bronze Badge", "Exclusive Posts"]'::jsonb),
        (p_creator_id, 3, 'Silver', 'Access to subscriber chat and broadcasts', 1000, 9.99, '🥈', '#C0C0C0', '["Silver Badge", "Subscriber Chat", "Exclusive Broadcasts"]'::jsonb),
        (p_creator_id, 4, 'Gold', 'Premium benefits and priority support', 2000, 19.99, '🥇', '#FFD700', '["Gold Badge", "All Lower Perks", "Priority Support"]'::jsonb),
        (p_creator_id, 5, 'VIP', 'Ultimate access and exclusive VIP content', 5000, 49.99, '👑', '#FF4500', '["VIP Badge", "All Perks", "VIP Content", "Direct Message Access"]'::jsonb)
    ON CONFLICT (creator_id, tier_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. FUNCTION: Update subscriber count
CREATE OR REPLACE FUNCTION public.update_subscriber_count()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id UUID;
    v_tier_id UUID;
BEGIN
    -- Get creator_id from tier
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        SELECT ct.creator_id INTO v_creator_id
        FROM public.creator_subscription_tiers ct
        WHERE ct.id = NEW.tier_id;
        
        v_tier_id := NEW.tier_id;
    ELSE
        SELECT ct.creator_id INTO v_creator_id
        FROM public.creator_subscription_tiers ct
        WHERE ct.id = OLD.tier_id;
        
        v_tier_id := OLD.tier_id;
    END IF;
    
    IF v_creator_id IS NOT NULL THEN
        -- Update tier subscriber count
        UPDATE public.creator_subscription_tiers
        SET subscriber_count = (
            SELECT COUNT(*) FROM public.creator_subscribers 
            WHERE tier_id = v_tier_id AND status = 'active'
        ),
        updated_at = NOW()
        WHERE id = v_tier_id;
        
        -- Update global settings
        UPDATE public.creator_subscription_settings
        SET subscriber_count = (
            SELECT COUNT(*) FROM public.creator_subscribers cs
            JOIN public.creator_subscription_tiers ct ON ct.id = cs.tier_id
            WHERE ct.creator_id = v_creator_id AND cs.status = 'active'
        ),
        updated_at = NOW()
        WHERE creator_id = v_creator_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_subscriber_count ON public.creator_subscribers;
CREATE TRIGGER trg_update_subscriber_count
    AFTER INSERT OR UPDATE OR DELETE ON public.creator_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_subscriber_count();

-- 14. RLS POLICIES
-- Subscription settings
ALTER TABLE public.creator_subscription_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can manage own subscription settings" ON public.creator_subscription_settings;
CREATE POLICY "Creators can manage own subscription settings" ON public.creator_subscription_settings
    FOR ALL USING (creator_id = auth.uid());
DROP POLICY IF EXISTS "Anyone can view subscription settings" ON public.creator_subscription_settings;
CREATE POLICY "Anyone can view subscription settings" ON public.creator_subscription_settings
    FOR SELECT USING (true);

-- Subscription tiers
ALTER TABLE public.creator_subscription_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can manage own tiers" ON public.creator_subscription_tiers;
CREATE POLICY "Creators can manage own tiers" ON public.creator_subscription_tiers
    FOR ALL USING (creator_id = auth.uid());
DROP POLICY IF EXISTS "Anyone can view tiers" ON public.creator_subscription_tiers;
CREATE POLICY "Anyone can view tiers" ON public.creator_subscription_tiers
    FOR SELECT USING (true);

-- Subscribers
ALTER TABLE public.creator_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subscribers can view own subscriptions" ON public.creator_subscribers;
CREATE POLICY "Subscribers can view own subscriptions" ON public.creator_subscribers
    FOR SELECT USING (subscriber_id = auth.uid() OR creator_id = auth.uid());
DROP POLICY IF EXISTS "Subscribers can manage own subscriptions" ON public.creator_subscribers;
CREATE POLICY "Subscribers can manage own subscriptions" ON public.creator_subscribers
    FOR ALL USING (subscriber_id = auth.uid());

-- Payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.subscription_payments;
CREATE POLICY "Users can view own payments" ON public.subscription_payments
    FOR SELECT USING (subscriber_id = auth.uid() OR creator_id = auth.uid());

-- Role statistics RLS
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['stats_auctioneer', 'stats_attorney', 'stats_prosecutor', 'stats_journalist', 'stats_pastor', 'stats_seller', 'stats_broadcaster'])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "Users can view all stats" ON public.%I; CREATE POLICY "Users can view all stats" ON public.%I FOR SELECT USING (true); DROP POLICY IF EXISTS "Users can manage own stats" ON public.%I; CREATE POLICY "Users can manage own stats" ON public.%I FOR ALL USING (user_id = auth.uid());', t, t, t, t, t);
    END LOOP;
END $$;

-- Profile roles
ALTER TABLE public.user_profile_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all roles" ON public.user_profile_roles;
CREATE POLICY "Users can view all roles" ON public.user_profile_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own roles" ON public.user_profile_roles;
CREATE POLICY "Users can manage own roles" ON public.user_profile_roles FOR ALL USING (user_id = auth.uid());

-- Tab visibility
ALTER TABLE public.profile_tab_visibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all tab settings" ON public.profile_tab_visibility;
CREATE POLICY "Users can view all tab settings" ON public.profile_tab_visibility FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage own tab settings" ON public.profile_tab_visibility;
CREATE POLICY "Users can manage own tab settings" ON public.profile_tab_visibility FOR ALL USING (user_id = auth.uid());

-- 15. GRANTS
GRANT SELECT ON public.creator_subscription_settings TO anon, authenticated;
GRANT SELECT ON public.creator_subscription_tiers TO anon, authenticated;
GRANT SELECT ON public.creator_subscribers TO authenticated;
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT SELECT ON public.stats_auctioneer TO anon, authenticated;
GRANT SELECT ON public.stats_attorney TO anon, authenticated;
GRANT SELECT ON public.stats_prosecutor TO anon, authenticated;
GRANT SELECT ON public.stats_journalist TO anon, authenticated;
GRANT SELECT ON public.stats_pastor TO anon, authenticated;
GRANT SELECT ON public.stats_seller TO anon, authenticated;
GRANT SELECT ON public.stats_broadcaster TO anon, authenticated;
GRANT SELECT ON public.user_profile_roles TO anon, authenticated;
GRANT SELECT ON public.profile_tab_visibility TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.creator_subscription_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_subscription_tiers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_subscribers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_auctioneer TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_attorney TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_prosecutor TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_journalist TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_pastor TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_seller TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stats_broadcaster TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_profile_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_tab_visibility TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_creator_subscription_tiers TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_roles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_statistics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_tabs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_profile_tabs TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_subscription_tiers TO authenticated;

-- 16. INITIALIZE EXISTING USERS
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM public.user_profiles
    LOOP
        -- Initialize subscription settings
        INSERT INTO public.creator_subscription_settings (creator_id)
        VALUES (user_record.id)
        ON CONFLICT (creator_id) DO NOTHING;
        
        -- Initialize default tiers
        PERFORM public.initialize_subscription_tiers(user_record.id);
        
        -- Initialize profile tabs
        PERFORM public.initialize_profile_tabs(user_record.id);
    END LOOP;
END $$;

-- ============================================================================
-- 17. ADD MISSING COLUMNS AND TABLES FROM BUG REPORT
-- ============================================================================

-- 17b. Ensure jail_transactions table exists (BUG #10)
-- Frontend references jail_transactions but it might not be in schema cache.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'jail_transactions'
    ) THEN
        CREATE TABLE public.jail_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            jail_id UUID REFERENCES public.jail(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('message_fee', 'bond', 'appeal_fee', 'refund', 'attorney_fee')),
            amount INTEGER NOT NULL,
            recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
            recipient_type TEXT CHECK (recipient_type IN ('public_pool', 'admin', 'attorney')),
            status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_jail_transactions_jail ON public.jail_transactions(jail_id);
        CREATE INDEX idx_jail_transactions_user ON public.jail_transactions(user_id);

        ALTER TABLE public.jail_transactions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own jail transactions" ON public.jail_transactions
            FOR SELECT USING (user_id = auth.uid());

        GRANT SELECT ON public.jail_transactions TO authenticated;
        GRANT INSERT, UPDATE, DELETE ON public.jail_transactions TO authenticated;

        RAISE NOTICE 'Created jail_transactions table with RLS';
    ELSE
        RAISE NOTICE 'jail_transactions table already exists';
    END IF;
END $$;

-- 17c. Add FK relationships for neighbors tables to user_profiles (BUG #62, #63, #64)
-- neighbors_hiring, neighbors_events, neighbors_businesses need FK to user_profiles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'neighbors_businesses') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'neighbors_businesses' AND column_name = 'owner_user_id'
        ) THEN
            ALTER TABLE public.neighbors_businesses ADD COLUMN owner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added owner_user_id FK to neighbors_businesses';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'neighbors_businesses_owner_user_id_fkey'
              AND conrelid = 'public.neighbors_businesses'::regclass
        ) THEN
            BEGIN
                ALTER TABLE public.neighbors_businesses
                    ADD CONSTRAINT neighbors_businesses_owner_user_id_fkey
                    FOREIGN KEY (owner_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            EXCEPTION WHEN others THEN
                RAISE NOTICE 'Could not add FK to neighbors_businesses: %', SQLERRM;
            END;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'neighbors_events') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'neighbors_events' AND column_name = 'created_by_user_id'
        ) THEN
            ALTER TABLE public.neighbors_events ADD COLUMN created_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added created_by_user_id FK to neighbors_events';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'neighbors_events_created_by_user_id_fkey'
              AND conrelid = 'public.neighbors_events'::regclass
        ) THEN
            BEGIN
                ALTER TABLE public.neighbors_events
                    ADD CONSTRAINT neighbors_events_created_by_user_id_fkey
                    FOREIGN KEY (created_by_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            EXCEPTION WHEN others THEN
                RAISE NOTICE 'Could not add FK to neighbors_events: %', SQLERRM;
            END;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'neighbors_hiring') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'neighbors_hiring' AND column_name = 'posted_by_user_id'
        ) THEN
            ALTER TABLE public.neighbors_hiring ADD COLUMN posted_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added posted_by_user_id FK to neighbors_hiring';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'neighbors_hiring_posted_by_user_id_fkey'
              AND conrelid = 'public.neighbors_hiring'::regclass
        ) THEN
            BEGIN
                ALTER TABLE public.neighbors_hiring
                    ADD CONSTRAINT neighbors_hiring_posted_by_user_id_fkey
                    FOREIGN KEY (posted_by_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            EXCEPTION WHEN others THEN
                RAISE NOTICE 'Could not add FK to neighbors_hiring: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- 17d. Seed system_roles for president and vice_president (BUG #56)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_roles') THEN
        CREATE TABLE public.system_roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Anyone can view system roles" ON public.system_roles FOR SELECT USING (true);
        CREATE POLICY "Admins can manage system roles" ON public.system_roles FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
        );
        GRANT SELECT ON public.system_roles TO anon, authenticated;
        GRANT INSERT, UPDATE, DELETE ON public.system_roles TO authenticated;
        RAISE NOTICE 'Created system_roles table';
    END IF;

    INSERT INTO public.system_roles (name, display_name, description)
    VALUES
        ('president', 'President', 'Elected President of Mai Troll'),
        ('vice_president', 'Vice President', 'Elected Vice President of Mai Troll')
    ON CONFLICT (name) DO NOTHING;

    RAISE NOTICE 'Seeded president/vice_president system roles';
END $$;

-- 17e. Ensure user_follows unique constraint (BUG #32, #35, #71 - 42P10 errors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'user_follows'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 2
          AND EXISTS (
              SELECT 1 FROM pg_attribute a1
              WHERE a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1] AND a1.attname = 'follower_id'
          )
          AND EXISTS (
              SELECT 1 FROM pg_attribute a2
              WHERE a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2] AND a2.attname = 'following_id'
          )
    ) THEN
        BEGIN
            DELETE FROM user_follows uf
            WHERE uf.id NOT IN (
                SELECT MIN(uf2.id) FROM user_follows uf2
                GROUP BY uf2.follower_id, uf2.following_id
            );
            ALTER TABLE user_follows ADD CONSTRAINT user_follows_follower_following_unique UNIQUE (follower_id, following_id);
            RAISE NOTICE 'Added UNIQUE(follower_id, following_id) on user_follows';
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add user_follows constraint: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'user_follows unique constraint already exists';
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Profile system overhaul complete!';
END $$;
