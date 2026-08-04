-- ============================================================================
-- PROFILE CUSTOMIZATION SYSTEM MIGRATION
-- Creates tables and functions for enhanced profile customization
-- ============================================================================

-- 1. Profile Social Links table (normalized)
CREATE TABLE IF NOT EXISTS public.profile_social_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN (
        'tiktok', 'instagram', 'facebook', 'twitter', 'x',
        'youtube', 'twitch', 'kick', 'discord', 'onlyfans',
        'reddit', 'linkedin', 'github', 'website', 'personal_website'
    )),
    url TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_profile_social_links_user_id 
    ON public.profile_social_links(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_social_links_user_visible 
    ON public.profile_social_links(user_id, is_visible) WHERE is_visible = true;

-- 2. Profile Customization Settings table
CREATE TABLE IF NOT EXISTS public.profile_customization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Theme colors
    theme_color TEXT DEFAULT '#9333ea',
    accent_color TEXT DEFAULT '#22d3ee',
    CONSTRAINT valid_theme_color CHECK (theme_color IS NULL OR theme_color ~ '^#[0-9a-fA-F]{6}$'),
    CONSTRAINT valid_accent_color CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
    
    -- Background and card styles
    background_style TEXT DEFAULT 'gradient',
    background_image_url TEXT,
    card_style TEXT DEFAULT 'glass',
    CONSTRAINT valid_background_style CHECK (background_style IN ('solid', 'gradient', 'pattern', 'image')),
    CONSTRAINT valid_card_style CHECK (card_style IN ('glass', 'solid', 'bordered', 'minimal')),
    
    -- Featured content
    featured_badge_id UUID REFERENCES public.badge_definitions(id) ON DELETE SET NULL,
    featured_broadcast_id UUID,
    featured_podcast_id UUID,
    featured_stream_id UUID,
    featured_marketplace_item_id UUID REFERENCES public.marketplace_items(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_customization_user_id 
    ON public.profile_customization(user_id);

-- 3. Profile Statistics table (aggregated stats)
CREATE TABLE IF NOT EXISTS public.profile_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Broadcast stats
    total_broadcasts INT NOT NULL DEFAULT 0,
    total_broadcast_duration_minutes INT NOT NULL DEFAULT 0,
    total_broadcast_viewers INT NOT NULL DEFAULT 0,
    total_broadcast_gifts_received INT NOT NULL DEFAULT 0,
    
    -- Podcast stats
    total_podcasts INT NOT NULL DEFAULT 0,
    total_podcast_episodes INT NOT NULL DEFAULT 0,
    total_podcast_listens INT NOT NULL DEFAULT 0,
    
    -- Marketplace stats
    total_marketplace_items INT NOT NULL DEFAULT 0,
    total_marketplace_sales INT NOT NULL DEFAULT 0,
    total_marketplace_revenue_coins INT NOT NULL DEFAULT 0,
    
    -- Achievement stats
    total_achievements INT NOT NULL DEFAULT 0,
    achievement_points INT NOT NULL DEFAULT 0,
    
    -- Timestamps
    last_broadcast_at TIMESTAMPTZ,
    last_podcast_at TIMESTAMPTZ,
    last_marketplace_sale_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_statistics_user_id 
    ON public.profile_statistics(user_id);

-- 4. Profile Badges junction table (earned badges)
CREATE TABLE IF NOT EXISTS public.user_profile_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    featured_order INT,
    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_badges_user_id 
    ON public.user_profile_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_badges_featured 
    ON public.user_profile_badges(user_id, is_featured) WHERE is_featured = true;

-- 5. Add missing columns to user_profiles if they don't exist
DO $$
BEGIN
    -- Pronouns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'pronouns'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN pronouns TEXT;
        RAISE NOTICE 'Added pronouns column to user_profiles';
    END IF;
    
    -- City
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'city'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN city TEXT;
        RAISE NOTICE 'Added city column to user_profiles';
    END IF;
    
    -- Country
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'country'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN country TEXT;
        RAISE NOTICE 'Added country column to user_profiles';
    END IF;
    
    -- Website
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'website'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN website TEXT;
        RAISE NOTICE 'Added website column to user_profiles';
    END IF;
    
    -- Bio max length check (ensure it's at least 500 chars)
    -- Drop any views that depend on bio column first
    DROP VIEW IF EXISTS public.public_profiles CASCADE;
    DROP VIEW IF EXISTS public.v_user_profiles_complete CASCADE;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'bio'
    ) THEN
        ALTER TABLE public.user_profiles ALTER COLUMN bio TYPE TEXT;
        RAISE NOTICE 'Ensured bio column is TEXT type';
    END IF;
    
    -- Join date (use created_at if not exists)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'join_date'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN join_date TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added join_date column to user_profiles';
    END IF;
END $$;

-- 6. Function to update profile customization updated_at
CREATE OR REPLACE FUNCTION public.update_profile_customization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_customization_updated_at ON public.profile_customization;
CREATE TRIGGER trg_profile_customization_updated_at
    BEFORE UPDATE ON public.profile_customization
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_customization_updated_at();

-- 7. Function to update profile statistics updated_at
CREATE OR REPLACE FUNCTION public.update_profile_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_statistics_updated_at ON public.profile_statistics;
CREATE TRIGGER trg_profile_statistics_updated_at
    BEFORE UPDATE ON public.profile_statistics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_statistics_updated_at();

-- 8. Function to get profile social links
CREATE OR REPLACE FUNCTION public.get_profile_social_links(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    platform TEXT,
    url TEXT,
    display_order INT,
    is_visible BOOLEAN,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psl.id,
        psl.platform,
        psl.url,
        psl.display_order,
        psl.is_visible,
        psl.verified_at,
        psl.created_at,
        psl.updated_at
    FROM public.profile_social_links psl
    WHERE psl.user_id = p_user_id
    ORDER BY psl.display_order ASC, psl.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to upsert social link
CREATE OR REPLACE FUNCTION public.upsert_social_link(
    p_user_id UUID,
    p_platform TEXT,
    p_url TEXT DEFAULT NULL,
    p_display_order INT DEFAULT 0,
    p_is_visible BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.profile_social_links (user_id, platform, url, display_order, is_visible)
    VALUES (p_user_id, p_platform, p_url, p_display_order, p_is_visible)
    ON CONFLICT (user_id, platform)
    DO UPDATE SET
        url = EXCLUDED.url,
        display_order = EXCLUDED.display_order,
        is_visible = EXCLUDED.is_visible,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to delete social link
CREATE OR REPLACE FUNCTION public.delete_social_link(p_user_id UUID, p_platform TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.profile_social_links
    WHERE user_id = p_user_id AND platform = p_platform;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to reorder social links
CREATE OR REPLACE FUNCTION public.reorder_social_links(p_user_id UUID, p_platform_orders JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_record JSONB;
BEGIN
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_platform_orders)
    LOOP
        UPDATE public.profile_social_links
        SET display_order = (v_record->>'order')::INT,
            updated_at = NOW()
        WHERE user_id = p_user_id 
          AND platform = v_record->>'platform';
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to get profile customization
CREATE OR REPLACE FUNCTION public.get_profile_customization(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    theme_color TEXT,
    accent_color TEXT,
    background_style TEXT,
    background_image_url TEXT,
    card_style TEXT,
    featured_badge_id UUID,
    featured_broadcast_id UUID,
    featured_podcast_id UUID,
    featured_stream_id UUID,
    featured_marketplace_item_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.user_id,
        pc.theme_color,
        pc.accent_color,
        pc.background_style,
        pc.background_image_url,
        pc.card_style,
        pc.featured_badge_id,
        pc.featured_broadcast_id,
        pc.featured_podcast_id,
        pc.featured_stream_id,
        pc.featured_marketplace_item_id,
        pc.created_at,
        pc.updated_at
    FROM public.profile_customization pc
    WHERE pc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to upsert profile customization
CREATE OR REPLACE FUNCTION public.upsert_profile_customization(
    p_user_id UUID,
    p_theme_color TEXT DEFAULT NULL,
    p_accent_color TEXT DEFAULT NULL,
    p_background_style TEXT DEFAULT NULL,
    p_background_image_url TEXT DEFAULT NULL,
    p_card_style TEXT DEFAULT NULL,
    p_featured_badge_id UUID DEFAULT NULL,
    p_featured_broadcast_id UUID DEFAULT NULL,
    p_featured_podcast_id UUID DEFAULT NULL,
    p_featured_stream_id UUID DEFAULT NULL,
    p_featured_marketplace_item_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.profile_customization (
        user_id, theme_color, accent_color, background_style, background_image_url,
        card_style, featured_badge_id, featured_broadcast_id, featured_podcast_id,
        featured_stream_id, featured_marketplace_item_id
    ) VALUES (
        p_user_id, p_theme_color, p_accent_color, p_background_style, p_background_image_url,
        p_card_style, p_featured_badge_id, p_featured_broadcast_id, p_featured_podcast_id,
        p_featured_stream_id, p_featured_marketplace_item_id
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        theme_color = COALESCE(p_theme_color, public.profile_customization.theme_color),
        accent_color = COALESCE(p_accent_color, public.profile_customization.accent_color),
        background_style = COALESCE(p_background_style, public.profile_customization.background_style),
        background_image_url = COALESCE(p_background_image_url, public.profile_customization.background_image_url),
        card_style = COALESCE(p_card_style, public.profile_customization.card_style),
        featured_badge_id = COALESCE(p_featured_badge_id, public.profile_customization.featured_badge_id),
        featured_broadcast_id = COALESCE(p_featured_broadcast_id, public.profile_customization.featured_broadcast_id),
        featured_podcast_id = COALESCE(p_featured_podcast_id, public.profile_customization.featured_podcast_id),
        featured_stream_id = COALESCE(p_featured_stream_id, public.profile_customization.featured_stream_id),
        featured_marketplace_item_id = COALESCE(p_featured_marketplace_item_id, public.profile_customization.featured_marketplace_item_id),
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to get profile statistics
CREATE OR REPLACE FUNCTION public.get_profile_statistics(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    total_broadcasts INT,
    total_broadcast_duration_minutes INT,
    total_broadcast_viewers INT,
    total_broadcast_gifts_received INT,
    total_podcasts INT,
    total_podcast_episodes INT,
    total_podcast_listens INT,
    total_marketplace_items INT,
    total_marketplace_sales INT,
    total_marketplace_revenue_coins INT,
    total_achievements INT,
    achievement_points INT,
    last_broadcast_at TIMESTAMPTZ,
    last_podcast_at TIMESTAMPTZ,
    last_marketplace_sale_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.user_id,
        ps.total_broadcasts,
        ps.total_broadcast_duration_minutes,
        ps.total_broadcast_viewers,
        ps.total_broadcast_gifts_received,
        ps.total_podcasts,
        ps.total_podcast_episodes,
        ps.total_podcast_listens,
        ps.total_marketplace_items,
        ps.total_marketplace_sales,
        ps.total_marketplace_revenue_coins,
        ps.total_achievements,
        ps.achievement_points,
        ps.last_broadcast_at,
        ps.last_podcast_at,
        ps.last_marketplace_sale_at,
        ps.created_at,
        ps.updated_at
    FROM public.profile_statistics ps
    WHERE ps.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Function to update profile statistics
CREATE OR REPLACE FUNCTION public.update_profile_statistics(
    p_user_id UUID,
    p_total_broadcasts INT DEFAULT NULL,
    p_total_broadcast_duration_minutes INT DEFAULT NULL,
    p_total_broadcast_viewers INT DEFAULT NULL,
    p_total_broadcast_gifts_received INT DEFAULT NULL,
    p_total_podcasts INT DEFAULT NULL,
    p_total_podcast_episodes INT DEFAULT NULL,
    p_total_podcast_listens INT DEFAULT NULL,
    p_total_marketplace_items INT DEFAULT NULL,
    p_total_marketplace_sales INT DEFAULT NULL,
    p_total_marketplace_revenue_coins INT DEFAULT NULL,
    p_total_achievements INT DEFAULT NULL,
    p_achievement_points INT DEFAULT NULL,
    p_last_broadcast_at TIMESTAMPTZ DEFAULT NULL,
    p_last_podcast_at TIMESTAMPTZ DEFAULT NULL,
    p_last_marketplace_sale_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.profile_statistics (
        user_id, total_broadcasts, total_broadcast_duration_minutes, total_broadcast_viewers,
        total_broadcast_gifts_received, total_podcasts, total_podcast_episodes, total_podcast_listens,
        total_marketplace_items, total_marketplace_sales, total_marketplace_revenue_coins,
        total_achievements, achievement_points, last_broadcast_at, last_podcast_at, last_marketplace_sale_at
    ) VALUES (
        p_user_id, 
        COALESCE(p_total_broadcasts, 0), 
        COALESCE(p_total_broadcast_duration_minutes, 0), 
        COALESCE(p_total_broadcast_viewers, 0),
        COALESCE(p_total_broadcast_gifts_received, 0), 
        COALESCE(p_total_podcasts, 0), 
        COALESCE(p_total_podcast_episodes, 0), 
        COALESCE(p_total_podcast_listens, 0),
        COALESCE(p_total_marketplace_items, 0), 
        COALESCE(p_total_marketplace_sales, 0), 
        COALESCE(p_total_marketplace_revenue_coins, 0),
        COALESCE(p_total_achievements, 0), 
        COALESCE(p_achievement_points, 0),
        p_last_broadcast_at, 
        p_last_podcast_at, 
        p_last_marketplace_sale_at
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_broadcasts = COALESCE(p_total_broadcasts, public.profile_statistics.total_broadcasts),
        total_broadcast_duration_minutes = COALESCE(p_total_broadcast_duration_minutes, public.profile_statistics.total_broadcast_duration_minutes),
        total_broadcast_viewers = COALESCE(p_total_broadcast_viewers, public.profile_statistics.total_broadcast_viewers),
        total_broadcast_gifts_received = COALESCE(p_total_broadcast_gifts_received, public.profile_statistics.total_broadcast_gifts_received),
        total_podcasts = COALESCE(p_total_podcasts, public.profile_statistics.total_podcasts),
        total_podcast_episodes = COALESCE(p_total_podcast_episodes, public.profile_statistics.total_podcast_episodes),
        total_podcast_listens = COALESCE(p_total_podcast_listens, public.profile_statistics.total_podcast_listens),
        total_marketplace_items = COALESCE(p_total_marketplace_items, public.profile_statistics.total_marketplace_items),
        total_marketplace_sales = COALESCE(p_total_marketplace_sales, public.profile_statistics.total_marketplace_sales),
        total_marketplace_revenue_coins = COALESCE(p_total_marketplace_revenue_coins, public.profile_statistics.total_marketplace_revenue_coins),
        total_achievements = COALESCE(p_total_achievements, public.profile_statistics.total_achievements),
        achievement_points = COALESCE(p_achievement_points, public.profile_statistics.achievement_points),
        last_broadcast_at = COALESCE(p_last_broadcast_at, public.profile_statistics.last_broadcast_at),
        last_podcast_at = COALESCE(p_last_podcast_at, public.profile_statistics.last_podcast_at),
        last_marketplace_sale_at = COALESCE(p_last_marketplace_sale_at, public.profile_statistics.last_marketplace_sale_at),
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Function to get user's featured badges
CREATE OR REPLACE FUNCTION public.get_user_featured_badges(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
    badge_id UUID,
    badge_name TEXT,
    badge_icon TEXT,
    badge_color TEXT,
    earned_at TIMESTAMPTZ,
    featured_order INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id AS badge_id,
        b.name AS badge_name,
        b.icon_url AS badge_icon,
        b.badge_type AS badge_color,
        upb.earned_at,
        upb.featured_order
    FROM public.user_profile_badges upb
    JOIN public.badge_definitions b ON b.id = upb.badge_id
    WHERE upb.user_id = p_user_id AND upb.is_featured = true
    ORDER BY upb.featured_order ASC NULLS LAST, upb.earned_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. RLS Policies for profile_social_links
ALTER TABLE public.profile_social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all visible social links" ON public.profile_social_links;
CREATE POLICY "Users can view all visible social links" ON public.profile_social_links
    FOR SELECT USING (is_visible = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own social links" ON public.profile_social_links;
CREATE POLICY "Users can manage own social links" ON public.profile_social_links
    FOR ALL USING (user_id = auth.uid());

-- 18. RLS Policies for profile_customization
ALTER TABLE public.profile_customization ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profile customizations" ON public.profile_customization;
CREATE POLICY "Users can view all profile customizations" ON public.profile_customization
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own profile customization" ON public.profile_customization;
CREATE POLICY "Users can manage own profile customization" ON public.profile_customization
    FOR ALL USING (user_id = auth.uid());

-- 19. RLS Policies for profile_statistics
ALTER TABLE public.profile_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profile statistics" ON public.profile_statistics;
CREATE POLICY "Users can view all profile statistics" ON public.profile_statistics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own profile statistics" ON public.profile_statistics;
CREATE POLICY "Users can manage own profile statistics" ON public.profile_statistics
    FOR ALL USING (user_id = auth.uid());

-- 20. RLS Policies for user_profile_badges
ALTER TABLE public.user_profile_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all user badges" ON public.user_profile_badges;
CREATE POLICY "Users can view all user badges" ON public.user_profile_badges
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own user badges" ON public.user_profile_badges;
CREATE POLICY "Users can manage own user badges" ON public.user_profile_badges
    FOR ALL USING (user_id = auth.uid());

-- 21. Function to initialize profile customization for new users
CREATE OR REPLACE FUNCTION public.initialize_profile_customization()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default profile customization
    INSERT INTO public.profile_customization (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create default profile statistics
    INSERT INTO public.profile_statistics (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initialize_profile_customization ON public.user_profiles;
CREATE TRIGGER trg_initialize_profile_customization
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_profile_customization();

-- 22. Function to validate URL format
CREATE OR REPLACE FUNCTION public.validate_url(p_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_url IS NULL OR p_url = '' THEN
        RETURN true;
    END IF;
    
    -- Basic URL validation
    RETURN p_url ~ '^https?://[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+.*$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 23. View for complete profile data
CREATE OR REPLACE VIEW public.v_user_profiles_complete AS
SELECT 
    up.*,
    pc.theme_color,
    pc.accent_color,
    pc.background_style,
    pc.background_image_url,
    pc.card_style,
    pc.featured_badge_id,
    pc.featured_broadcast_id,
    pc.featured_podcast_id,
    pc.featured_stream_id,
    pc.featured_marketplace_item_id,
    ps.total_broadcasts,
    ps.total_broadcast_duration_minutes,
    ps.total_broadcast_viewers,
    ps.total_broadcast_gifts_received,
    ps.total_podcasts,
    ps.total_podcast_episodes,
    ps.total_podcast_listens,
    ps.total_marketplace_items,
    ps.total_marketplace_sales,
    ps.total_marketplace_revenue_coins,
    ps.total_achievements,
    ps.achievement_points,
    ps.last_broadcast_at,
    ps.last_podcast_at,
    ps.last_marketplace_sale_at
FROM public.user_profiles up
LEFT JOIN public.profile_customization pc ON pc.user_id = up.id
LEFT JOIN public.profile_statistics ps ON ps.user_id = up.id;

-- Grant permissions
GRANT SELECT ON public.v_user_profiles_complete TO anon, authenticated;
GRANT SELECT ON public.profile_social_links TO anon, authenticated;
GRANT SELECT ON public.profile_customization TO anon, authenticated;
GRANT SELECT ON public.profile_statistics TO anon, authenticated;
GRANT SELECT ON public.user_profile_badges TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profile_social_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_customization TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_statistics TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_profile_badges TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_profile_social_links TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_social_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_social_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_social_links TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_customization TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_profile_customization TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_statistics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_featured_badges TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_url TO anon, authenticated;

-- Recreate the v_user_profiles_complete view (was dropped earlier to alter bio column)
CREATE OR REPLACE VIEW public.v_user_profiles_complete AS
SELECT 
    up.*,
    pc.theme_color,
    pc.accent_color,
    pc.background_style,
    pc.background_image_url,
    pc.card_style,
    pc.featured_badge_id,
    pc.featured_broadcast_id,
    pc.featured_podcast_id,
    pc.featured_stream_id,
    pc.featured_marketplace_item_id,
    ps.total_broadcasts,
    ps.total_broadcast_duration_minutes,
    ps.total_broadcast_viewers,
    ps.total_broadcast_gifts_received,
    ps.total_podcasts,
    ps.total_podcast_episodes,
    ps.total_podcast_listens,
    ps.total_marketplace_items,
    ps.total_marketplace_sales,
    ps.total_marketplace_revenue_coins,
    ps.total_achievements,
    ps.achievement_points,
    ps.last_broadcast_at,
    ps.last_podcast_at,
    ps.last_marketplace_sale_at
FROM public.user_profiles up
LEFT JOIN public.profile_customization pc ON pc.user_id = up.id
LEFT JOIN public.profile_statistics ps ON ps.user_id = up.id;

-- Grant permissions on recreated view
GRANT SELECT ON public.v_user_profiles_complete TO anon, authenticated;

-- Recreate the public_profiles view (was dropped earlier to alter bio column)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    username,
    avatar_url,
    bio,
    role,
    created_at,
    is_verified,
    stream_count,
    followers_count,
    following_count,
    is_troll_officer,
    is_admin,
    is_lead_officer
FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Profile customization migration complete!';
END $$;
