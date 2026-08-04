-- =============================================================================
-- AGENCY ACHIEVEMENT SYSTEM
-- =============================================================================
-- Parallel to family achievement system (achievement_tiers, achievement_definitions,
-- family_achievements). Creates agency-specific achievement tables.
--
-- Tables:
--   - agency_achievement_tiers
--   - agency_achievement_definitions
--   - agency_achievements
--   - agency_achievement_progress
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: agency_achievement_tiers
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agency_achievement_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_number integer NOT NULL UNIQUE,
    tier_name text NOT NULL,
    tier_description text,
    tier_color text DEFAULT '#FFFFFF',
    tier_icon text DEFAULT '🏆',
    base_points integer DEFAULT 0,
    xp_reward integer DEFAULT 0,
    coin_reward integer DEFAULT 0,
    created_at timestamptz DEFAULT NOW()
);

-- =============================================================================
-- TABLE: agency_achievement_definitions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agency_achievement_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key text NOT NULL UNIQUE,
    tier_number integer NOT NULL DEFAULT 1,
    title text NOT NULL,
    description text,
    hint text,
    secret boolean DEFAULT false,
    metric_type text NOT NULL DEFAULT 'battle_wins',
    -- metric_type values: battle_wins, battles_count, gift_earnings, live_hours,
    --   creator_count, agency_points, weekly_rank, streak
    base_requirement integer NOT NULL DEFAULT 1,
    xp_reward integer DEFAULT 0,
    coin_reward integer DEFAULT 0,
    icon text DEFAULT '⚔️',
    color text DEFAULT '#FFD700',
    rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    created_at timestamptz DEFAULT NOW()
);

-- =============================================================================
-- TABLE: agency_achievements (unlocked achievements per agency)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agency_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    achievement_key text NOT NULL REFERENCES public.agency_achievement_definitions(achievement_key) ON DELETE CASCADE,
    unlocked_at timestamptz DEFAULT NOW(),
    unlocked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(agency_id, achievement_key)
);

-- =============================================================================
-- TABLE: agency_achievement_progress (tracking progress toward achievements)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.agency_achievement_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    achievement_key text NOT NULL REFERENCES public.agency_achievement_definitions(achievement_key) ON DELETE CASCADE,
    current_value integer DEFAULT 0,
    target_value integer NOT NULL DEFAULT 1,
    completed boolean DEFAULT false,
    updated_at timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(agency_id, achievement_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_agency_achievements_agency_id ON public.agency_achievements(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_achievement_progress_agency_id ON public.agency_achievement_progress(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_achievement_progress_completed ON public.agency_achievement_progress(completed);
CREATE INDEX IF NOT EXISTS idx_agency_achievement_defs_tier ON public.agency_achievement_definitions(tier_number);
CREATE INDEX IF NOT EXISTS idx_agency_achievement_defs_metric ON public.agency_achievement_definitions(metric_type);

-- =============================================================================
-- SEED DATA: Achievement Tiers
-- =============================================================================
INSERT INTO public.agency_achievement_tiers (tier_number, tier_name, tier_description, tier_color, tier_icon, base_points, xp_reward, coin_reward)
VALUES
    (1, 'Rookie Agency', 'Just getting started in the agency wars.', '#4CAF50', '🌱', 0, 0, 0),
    (2, 'Rising Agency', 'Building a reputation on the battlefield.', '#2196F3', '⚡', 100, 50, 500),
    (3, 'Established Agency', 'A known force in the community.', '#9C27B0', '🛡️', 500, 200, 2000),
    (4, 'Elite Agency', 'Among the top agencies in Mai Troll.', '#FF9800', '👑', 2000, 500, 5000),
    (5, 'Legendary Agency', 'A dynasty that will be remembered forever.', '#E91E63', '🏆', 10000, 2000, 20000)
ON CONFLICT (tier_number) DO NOTHING;

-- =============================================================================
-- SEED DATA: Achievement Definitions
-- =============================================================================
INSERT INTO public.agency_achievement_definitions
    (achievement_key, tier_number, title, description, hint, secret, metric_type, base_requirement, xp_reward, coin_reward, icon, color, rarity)
VALUES
    ('first_agency_battle_win', 1, 'First Blood', 'Win your first battle as an agency member.', 'Win a random battle during a broadcast.', false, 'battle_wins', 1, 10, 100, '⚔️', '#4CAF50', 'common'),
    ('agency_100_battles', 2, 'Battle Hardened', 'Win 100 battles as an agency.', 'Keep battling — consistency is key.', false, 'battle_wins', 100, 100, 1000, '🛡️', '#2196F3', 'uncommon'),
    ('agency_1000_battles', 3, 'Battle Dynasty', 'Win 1,000 battles as an agency.', 'A true legacy of combat.', false, 'battle_wins', 1000, 500, 5000, '🏰', '#9C27B0', 'rare'),
    ('top_weekly_agency', 3, 'Top Weekly Agency', 'Finish as the top agency in weekly rankings.', 'Accumulate the most points in a week.', false, 'weekly_rank', 1, 200, 2000, '👑', '#FF9800', 'rare'),
    ('gift_empire', 2, 'Gift Empire', 'Earn 100,000 gift coins through agency battles.', 'Gifts fuel the war machine.', false, 'gift_earnings', 100000, 150, 1500, '🎁', '#E91E63', 'uncommon'),
    ('creator_recruiter', 2, 'Creator Recruiter', 'Have 10 active creators in your agency.', 'Build your roster.', false, 'creator_count', 10, 100, 1000, '👥', '#00BCD4', 'uncommon'),
    ('battle_dynasty', 4, 'Battle Dynasty', 'Maintain a 30-day battle win streak as an agency.', 'Consistency at the highest level.', false, 'streak', 30, 1000, 10000, '🔥', '#FF5722', 'epic'),
    ('million_coin_agency', 5, 'Million Coin Agency', 'Earn 1,000,000 total coins as an agency.', 'The ultimate economic power.', false, 'gift_earnings', 1000000, 2000, 20000, '💰', '#FFD700', 'legendary')
ON CONFLICT (achievement_key) DO NOTHING;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE public.agency_achievement_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_achievement_progress ENABLE ROW LEVEL SECURITY;

-- Tiers and definitions are readable by all authenticated users
CREATE POLICY "Anyone can read achievement tiers"
    ON public.agency_achievement_tiers FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Anyone can read achievement definitions"
    ON public.agency_achievement_definitions FOR SELECT
    TO authenticated USING (true);

-- Achievements are readable by all, insertable by service role
CREATE POLICY "Anyone can read agency achievements"
    ON public.agency_achievements FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Service role can insert agency achievements"
    ON public.agency_achievements FOR INSERT
    TO service_role WITH CHECK (true);

-- Progress is readable by agency members, writable by service role
CREATE POLICY "Anyone can read agency achievement progress"
    ON public.agency_achievement_progress FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Service role can manage agency achievement progress"
    ON public.agency_achievement_progress FOR ALL
    TO service_role USING (true) WITH CHECK (true);

COMMIT;
