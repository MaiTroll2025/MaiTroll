-- =============================================================================
-- TROLL FAMILY LEAGUES SYSTEM
-- =============================================================================
-- Migration to wire Family Goals + Monthly Leagues system
-- Creates activity events tracking, league seasons, standings, and RPC for recording activity
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ADD APPROVAL_STATUS TO family_members
-- =============================================================================

ALTER TABLE public.family_members 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'denied'));

CREATE INDEX IF NOT EXISTS idx_family_members_approval_status ON public.family_members(family_id, approval_status);

-- =============================================================================
-- 2. CREATE troll_family_activity_events TABLE
-- =============================================================================
-- Normalized event log for all user activity contributing to family goals
-- Events from: gifts, watch time, battles, messages, streams, hype coins, etc.

CREATE TABLE IF NOT EXISTS public.troll_family_activity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Event type identifies the activity category
    event_type text NOT NULL CHECK (event_type IN (
        'broadcast_gift_earned',      -- User received gift coins in broadcast
        'broadcast_gift_sent',        -- User sent gift coins in broadcast
        'broadcast_watch_time',       -- User watched a broadcast
        'battle_joined',              -- User participated in battle
        'battle_won',                 -- User won a battle
        'battle_lost',                -- User lost a battle
        'stream_started',             -- User started a stream
        'chat_message_sent',          -- User sent chat message
        'hype_coin_earned',           -- User earned Hype Coins from watching
        'troll_coin_earned',          -- User earned Troll Coins (catch-all)
        'supporter_activity',         -- Generic supporter activity
        'family_contribution'         -- Generic family contribution
    )),
    
    -- Amount/count for the event
    amount numeric NOT NULL DEFAULT 1,
    
    -- Metadata for context
    metadata jsonb DEFAULT '{}'::jsonb,
    -- Common metadata fields:
    -- - stream_id, gift_id, sender_id, receiver_id (for gifts)
    -- - watch_duration_seconds, watch_end_time (for watch events)
    -- - battle_id, opponent_id, win_side (for battles)
    -- - message_length (for chat)
    -- - dedup_key (unique key to prevent duplicate counting)
    
    -- Timestamps
    recorded_at timestamp with time zone DEFAULT NOW(),
    created_at timestamp with time zone DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_troll_family_activity_events_family_id 
    ON public.troll_family_activity_events(family_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_activity_events_user_id 
    ON public.troll_family_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_activity_events_event_type 
    ON public.troll_family_activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_troll_family_activity_events_recorded_at 
    ON public.troll_family_activity_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_troll_family_activity_events_family_date 
    ON public.troll_family_activity_events(family_id, recorded_at DESC);

-- Unique constraint to prevent duplicate events (using dedup_key in metadata)
CREATE UNIQUE INDEX IF NOT EXISTS idx_troll_family_activity_events_dedup 
    ON public.troll_family_activity_events(family_id, user_id, event_type, (metadata->>'dedup_key'))
    WHERE metadata->>'dedup_key' IS NOT NULL;

-- =============================================================================
-- 3. CREATE troll_family_league_seasons TABLE
-- =============================================================================
-- Monthly seasons for family competitions

CREATE TABLE IF NOT EXISTS public.troll_family_league_seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Season identity
    season_number integer NOT NULL,
    season_start_date date NOT NULL,
    season_end_date date NOT NULL,
    
    -- Status
    is_active boolean DEFAULT true,
    is_completed boolean DEFAULT false,
    
    -- Season metadata
    name text,
    description text,
    theme text,  -- e.g., 'spring', 'summer', 'autumn', 'winter'
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT NOW(),
    ended_at timestamp with time zone,
    
    UNIQUE(season_number),
    UNIQUE(season_start_date, season_end_date)
);

-- Index for current season lookup
CREATE INDEX IF NOT EXISTS idx_troll_family_league_seasons_active 
    ON public.troll_family_league_seasons(is_active, season_start_date DESC);

-- =============================================================================
-- 4. CREATE troll_family_league_standings TABLE
-- =============================================================================
-- Family rankings per season

CREATE TABLE IF NOT EXISTS public.troll_family_league_standings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid NOT NULL REFERENCES public.troll_family_league_seasons(id) ON DELETE CASCADE,
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Rankings and points
    rank integer,
    points integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    goals_completed integer DEFAULT 0,
    goals_failed integer DEFAULT 0,
    
    -- Activity tracking
    members_active integer DEFAULT 0,
    total_member_activity numeric DEFAULT 0,
    participation_rate numeric DEFAULT 0,  -- 0.0 to 1.0
    
    -- Rewards earned
    coins_earned integer DEFAULT 0,
    xp_earned integer DEFAULT 0,
    bonus_coins integer DEFAULT 0,
    
    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(season_id, family_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_troll_family_league_standings_season_id 
    ON public.troll_family_league_standings(season_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_league_standings_family_id 
    ON public.troll_family_league_standings(family_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_league_standings_rank 
    ON public.troll_family_league_standings(season_id, rank);

-- =============================================================================
-- 5. ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE public.troll_family_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_family_league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_family_league_standings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

-- Activity Events: Approved members can view their family's events
CREATE POLICY "Members can view family activity events" ON public.troll_family_activity_events
    FOR SELECT USING (
        family_id IN (
            SELECT fm.family_id FROM public.family_members fm
            WHERE fm.user_id = auth.uid() AND fm.approval_status = 'approved'
        )
    );

-- Activity Events: Only RPC can insert (write is via RPC only)
CREATE POLICY "Only RPC can record activity events" ON public.troll_family_activity_events
    FOR INSERT WITH CHECK (false);  -- Will be inserted via RPC with SECURITY DEFINER

-- League Seasons: Public read (or restricted if needed)
CREATE POLICY "Anyone can view league seasons" ON public.troll_family_league_seasons
    FOR SELECT USING (true);

-- League Standings: Members can view their family standings
CREATE POLICY "Members can view league standings" ON public.troll_family_league_standings
    FOR SELECT USING (
        family_id IN (
            SELECT fm.family_id FROM public.family_members fm
            WHERE fm.user_id = auth.uid() AND fm.approval_status = 'approved'
        )
        OR true  -- Also allow public viewing of standings
    );

-- =============================================================================
-- 7. RPC FUNCTION: record_troll_family_activity
-- =============================================================================
-- Central function to record family activity from any event source
-- - Validates user is approved member of family
-- - Records event to activity_events table
-- - Updates goal progress based on event type
-- - Awards league points
-- - Returns result for client-side feedback

CREATE OR REPLACE FUNCTION public.record_troll_family_activity(
    p_user_id uuid,
    p_event_type text,
    p_amount numeric DEFAULT 1,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_family_id uuid;
    v_event_id uuid;
    v_current_season_id uuid;
    v_goals_matched integer := 0;
    v_progress_updated integer := 0;
    v_result jsonb;
    v_goal record;
    v_current_progress integer;
    v_target_value integer;
    v_is_duplicate boolean := false;
    v_dedup_key text;
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL OR p_event_type IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Missing required parameters'
        );
    END IF;

    -- Get user's family and verify approval status
    SELECT fm.family_id INTO v_family_id
    FROM public.family_members fm
    WHERE fm.user_id = p_user_id
    AND fm.approval_status = 'approved'
    LIMIT 1;

    IF v_family_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User is not an approved member of any Troll Family'
        );
    END IF;

    -- Get current active season
    SELECT id INTO v_current_season_id
    FROM public.troll_family_league_seasons
    WHERE is_active = true
    AND CURRENT_DATE BETWEEN season_start_date AND season_end_date
    LIMIT 1;

    IF v_current_season_id IS NULL THEN
        -- Create a new season if none exists
        INSERT INTO public.troll_family_league_seasons (
            season_number,
            season_start_date,
            season_end_date,
            is_active,
            name
        ) VALUES (
            COALESCE((SELECT MAX(season_number) FROM public.troll_family_league_seasons) + 1, 1),
            DATE_TRUNC('month', CURRENT_DATE)::date,
            (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
            true,
            'Season ' || COALESCE((SELECT MAX(season_number) FROM public.troll_family_league_seasons) + 1, 1)
        )
        RETURNING id INTO v_current_season_id;
    END IF;

    -- Check for duplicates using dedup_key in metadata
    v_dedup_key := p_metadata->>'dedup_key';
    IF v_dedup_key IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.troll_family_activity_events
            WHERE family_id = v_family_id
            AND user_id = p_user_id
            AND event_type = p_event_type
            AND metadata->>'dedup_key' = v_dedup_key
        ) INTO v_is_duplicate;

        IF v_is_duplicate THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Duplicate event detected'
            );
        END IF;
    END IF;

    -- Record the activity event
    INSERT INTO public.troll_family_activity_events (
        family_id,
        user_id,
        event_type,
        amount,
        metadata,
        recorded_at
    ) VALUES (
        v_family_id,
        p_user_id,
        p_event_type,
        p_amount,
        p_metadata,
        NOW()
    )
    RETURNING id INTO v_event_id;

    -- Find and update relevant goals
    FOR v_goal IN
        SELECT id, target_value, current_value, category, goal_type
        FROM public.family_goals
        WHERE family_id = v_family_id
        AND status = 'active'
        AND (
            -- Match goals to event types
            (p_event_type = 'broadcast_gift_earned' AND goal_type IN ('broadcast', 'coins'))
            OR (p_event_type = 'broadcast_gift_sent' AND goal_type IN ('broadcast', 'generosity'))
            OR (p_event_type = 'broadcast_watch_time' AND goal_type IN ('watch', 'engagement'))
            OR (p_event_type = 'battle_won' AND goal_type IN ('battle', 'competition'))
            OR (p_event_type = 'battle_joined' AND goal_type IN ('battle', 'participation'))
            OR (p_event_type = 'stream_started' AND goal_type IN ('broadcast', 'creation'))
            OR (p_event_type = 'hype_coin_earned' AND goal_type IN ('engagement', 'watch'))
            OR (p_event_type = 'troll_coin_earned' AND goal_type IN ('coins', 'earnings'))
            OR (p_event_type = 'chat_message_sent' AND goal_type IN ('engagement', 'activity'))
        )
    LOOP
        v_target_value := v_goal.target_value;

        -- Update or insert goal progress for this user
        INSERT INTO public.family_goal_progress (
            goal_id,
            user_id,
            family_id,
            contribution_value,
            last_activity_at
        ) VALUES (
            v_goal.id,
            p_user_id,
            v_family_id,
            p_amount::integer,
            NOW()
        )
        ON CONFLICT (goal_id, user_id) DO UPDATE SET
            contribution_value = family_goal_progress.contribution_value + EXCLUDED.contribution_value,
            last_activity_at = NOW();

        -- Update goal's current_value (sum of all contributions)
        UPDATE public.family_goals
        SET current_value = (
            SELECT COALESCE(SUM(contribution_value), 0)::integer
            FROM public.family_goal_progress
            WHERE goal_id = v_goal.id
        )
        WHERE id = v_goal.id;

        -- Check if goal is now complete
        IF (SELECT current_value FROM public.family_goals WHERE id = v_goal.id) >= v_target_value THEN
            UPDATE public.family_goals
            SET status = 'completed', completed_at = NOW()
            WHERE id = v_goal.id;

            -- Award coins/XP and league points
            UPDATE public.troll_family_league_standings
            SET 
                points = points + v_goal.target_value,
                goals_completed = goals_completed + 1,
                coins_earned = coins_earned + COALESCE((SELECT reward_coins FROM public.family_goals WHERE id = v_goal.id), 0)
            WHERE season_id = v_current_season_id AND family_id = v_family_id;
        END IF;

        v_goals_matched := v_goals_matched + 1;
    END LOOP;

    -- Update family standings for this season
    INSERT INTO public.troll_family_league_standings (season_id, family_id)
    VALUES (v_current_season_id, v_family_id)
    ON CONFLICT (season_id, family_id) DO UPDATE SET
        updated_at = NOW(),
        total_member_activity = troll_family_league_standings.total_member_activity + p_amount;

    v_result := jsonb_build_object(
        'success', true,
        'message', 'Activity recorded successfully',
        'event_id', v_event_id,
        'family_id', v_family_id,
        'event_type', p_event_type,
        'amount', p_amount,
        'goals_matched', v_goals_matched,
        'season_id', v_current_season_id
    );

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Error recording activity: ' || SQLERRM
    );
END;
$$;

-- =============================================================================
-- 8. GRANT EXECUTE PERMISSION ON RPC
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.record_troll_family_activity(uuid, text, numeric, jsonb) TO authenticated;

COMMIT;
