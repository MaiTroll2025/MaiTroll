-- User-Created Leagues System
-- SAFE TO RUN MULTIPLE TIMES - fully idempotent
-- Run ENTIRE script at once in Supabase SQL Editor

-- Step 1: Drop constraints if they exist (handles partial runs)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_league_missions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_league_missions_league' AND table_name = 'user_league_missions') THEN
            ALTER TABLE public.user_league_missions DROP CONSTRAINT fk_league_missions_league;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_league_missions' AND column_name = 'league_id') THEN
            ALTER TABLE public.user_league_missions ADD COLUMN league_id UUID;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_league_members') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_league_members_league' AND table_name = 'user_league_members') THEN
            ALTER TABLE public.user_league_members DROP CONSTRAINT fk_league_members_league;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_league_members' AND column_name = 'league_id') THEN
            ALTER TABLE public.user_league_members ADD COLUMN league_id UUID;
        END IF;
    END IF;
END $$;

-- Step 2: Create tables safely
CREATE TABLE IF NOT EXISTS public.user_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    max_members INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    league_type TEXT DEFAULT 'standard' CHECK (league_type IN ('standard', 'competitive', 'casual', 'tournament')),
    icon_emoji TEXT DEFAULT '🏆',
    color TEXT DEFAULT '#8b5cf6',
    league_score BIGINT DEFAULT 0,
    league_level INT DEFAULT 1,
    member_count INT DEFAULT 1,
    requirements JSONB DEFAULT '{"min_level": 0, "invite_only": false}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_league_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'moderator', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked', 'banned', 'left')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    contribution_score BIGINT DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

ALTER TABLE public.user_league_members
    ADD CONSTRAINT fk_league_members_league
    FOREIGN KEY (league_id) REFERENCES public.user_leagues(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.user_league_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    mission_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    target_value INT NOT NULL DEFAULT 1,
    current_value INT NOT NULL DEFAULT 0,
    reward_points INT DEFAULT 0,
    reward_xp INT DEFAULT 0,
    reward_coins INT DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'claimed', 'expired', 'failed')),
    generated_by TEXT DEFAULT 'system',
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_league_missions
    ADD CONSTRAINT fk_league_missions_league
    FOREIGN KEY (league_id) REFERENCES public.user_leagues(id) ON DELETE CASCADE;
