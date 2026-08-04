-- ============================================================
-- STATE BATTLE SYSTEM - Migration
-- ============================================================
-- Creates tables, indexes, RLS policies, and RPC functions
-- for the State Battle feature.
-- ============================================================

-- ============================================================
-- 1. STATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code TEXT UNIQUE NOT NULL,
    state_name TEXT NOT NULL,
    battle_points BIGINT DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    representative_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    monthly_points BIGINT DEFAULT 0,
    monthly_wins INTEGER DEFAULT 0,
    monthly_losses INTEGER DEFAULT 0,
    last_month_reset TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed all US states + DC
INSERT INTO public.states (state_code, state_name) VALUES
    ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
    ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
    ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
    ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
    ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
    ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
    ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
    ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
    ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
    ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
    ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
    ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
    ('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia')
ON CONFLICT (state_code) DO NOTHING;

-- ============================================================
-- 2. STATE MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.state_members (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    state_code TEXT NOT NULL REFERENCES public.states(state_code) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    battle_points_earned BIGINT DEFAULT 0,
    battles_participated INTEGER DEFAULT 0,
    battles_won INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_state_members_state_code ON public.state_members(state_code);

-- ============================================================
-- 3. STATE BATTLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.state_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID REFERENCES public.troll_battles(id) ON DELETE SET NULL,
    state_a TEXT NOT NULL REFERENCES public.states(state_code),
    state_b TEXT NOT NULL REFERENCES public.states(state_code),
    winner_state TEXT REFERENCES public.states(state_code),
    points_awarded INTEGER DEFAULT 0,
    host_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    challenger_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_state_battles_state_a ON public.state_battles(state_a);
CREATE INDEX IF NOT EXISTS idx_state_battles_state_b ON public.state_battles(state_b);
CREATE INDEX IF NOT EXISTS idx_state_battles_winner ON public.state_battles(winner_state);
CREATE INDEX IF NOT EXISTS idx_state_battles_created ON public.state_battles(created_at DESC);

-- ============================================================
-- 4. STATE MONTHLY REWARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.state_monthly_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code TEXT NOT NULL REFERENCES public.states(state_code),
    reward_month TEXT NOT NULL, -- 'YYYY-MM' format
    rank INTEGER NOT NULL,
    badge_awarded TEXT,
    profile_frame_awarded TEXT,
    troll_coins_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(state_code, reward_month)
);

-- ============================================================
-- 5. ADD STATE FIELDS TO STREAMS TABLE
-- ============================================================
DO $$
DECLARE
    v_existing_type TEXT;
BEGIN
    SELECT data_type INTO v_existing_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'streams'
      AND column_name = 'state_battle_mode';

    IF v_existing_type IS NULL THEN
        ALTER TABLE public.streams ADD COLUMN state_battle_mode TEXT DEFAULT 'none';
    ELSIF v_existing_type = 'boolean' THEN
        -- Column was created as BOOLEAN by an older untracked migration.
        -- Convert to TEXT so code that writes 'none'/'state' works correctly.
        ALTER TABLE public.streams
            ALTER COLUMN state_battle_mode TYPE TEXT
            USING CASE WHEN state_battle_mode IS TRUE THEN 'state' ELSE 'none' END;
        ALTER TABLE public.streams
            ALTER COLUMN state_battle_mode SET DEFAULT 'none';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='streams' AND column_name='state_battle_state_code') THEN
        ALTER TABLE public.streams ADD COLUMN state_battle_state_code TEXT;
    END IF;
END$$;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- States: readable by all authenticated users, writable only by service/trigger
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "States are viewable by everyone" ON public.states;
DROP POLICY IF EXISTS "System manages states" ON public.states;
CREATE POLICY "States are viewable by everyone" ON public.states FOR SELECT USING (true);

-- State members: users can see all members, insert/update own row
ALTER TABLE public.state_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "State members viewable by all" ON public.state_members;
DROP POLICY IF EXISTS "Users can join a state" ON public.state_members;
DROP POLICY IF EXISTS "Users can update own state membership" ON public.state_members;
DROP POLICY IF EXISTS "Users can leave state" ON public.state_members;
CREATE POLICY "State members viewable by all" ON public.state_members FOR SELECT USING (true);
CREATE POLICY "Users can join a state" ON public.state_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own state membership" ON public.state_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave state" ON public.state_members FOR DELETE USING (auth.uid() = user_id);

-- State battles: readable by all
ALTER TABLE public.state_battles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "State battles viewable by all" ON public.state_battles;
CREATE POLICY "State battles viewable by all" ON public.state_battles FOR SELECT USING (true);
CREATE POLICY "System inserts state battles" ON public.state_battles FOR INSERT WITH CHECK (true);

-- State monthly rewards: readable by all
ALTER TABLE public.state_monthly_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "State monthly rewards viewable by all" ON public.state_monthly_rewards;
CREATE POLICY "State monthly rewards viewable by all" ON public.state_monthly_rewards FOR SELECT USING (true);
CREATE POLICY "System manages state monthly rewards" ON public.state_monthly_rewards FOR ALL USING (true);

-- ============================================================
-- 7. RPC FUNCTIONS
-- ============================================================

-- Get or assign user's state from their profile
CREATE OR REPLACE FUNCTION public.get_user_state(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_state TEXT;
BEGIN
    -- Check if user already has a state assigned
    SELECT state_code INTO v_state
    FROM public.state_members
    WHERE user_id = p_user_id;

    -- If not assigned, try to derive from profile state_region
    IF v_state IS NULL THEN
        SELECT state_region INTO v_state
        FROM public.user_profiles
        WHERE id = p_user_id AND state_region IS NOT NULL AND state_region != '';

        -- If we found a state, assign the user
        IF v_state IS NOT NULL THEN
            INSERT INTO public.state_members (user_id, state_code)
            VALUES (p_user_id, v_state)
            ON CONFLICT (user_id) DO UPDATE SET state_code = v_state;
        END IF;
    END IF;

    RETURN v_state;
END;
$$;

-- Record a completed state battle
CREATE OR REPLACE FUNCTION public.record_state_battle(
    p_battle_id UUID,
    p_host_user_id UUID,
    p_challenger_user_id UUID,
    p_winner_user_id UUID,
    p_host_score INTEGER,
    p_challenger_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_host_state TEXT;
    v_challenger_state TEXT;
    v_winner_state TEXT;
    v_loser_state TEXT;
    v_points INTEGER := 500;
    v_state_battle_id UUID;
BEGIN
    -- Get states for both participants
    SELECT state_code INTO v_host_state FROM public.state_members WHERE user_id = p_host_user_id;
    SELECT state_code INTO v_challenger_state FROM public.state_members WHERE user_id = p_challenger_user_id;

    IF v_host_state IS NULL OR v_challenger_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'One or both users have no state assigned');
    END IF;

    -- Determine winner state
    IF p_winner_user_id = p_host_user_id THEN
        v_winner_state := v_host_state;
        v_loser_state := v_challenger_state;
    ELSIF p_winner_user_id = p_challenger_user_id THEN
        v_winner_state := v_challenger_state;
        v_loser_state := v_host_state;
    ELSE
        -- Draw - no points awarded, just record
        INSERT INTO public.state_battles (battle_id, state_a, state_b, winner_state, points_awarded, host_user_id, challenger_user_id)
        VALUES (p_battle_id, v_host_state, v_challenger_state, NULL, 0, p_host_user_id, p_challenger_user_id)
        RETURNING id INTO v_state_battle_id;

        RETURN jsonb_build_object('success', true, 'draw', true, 'state_battle_id', v_state_battle_id);
    END IF;

    -- Insert state battle record
    INSERT INTO public.state_battles (battle_id, state_a, state_b, winner_state, points_awarded, host_user_id, challenger_user_id)
    VALUES (p_battle_id, v_host_state, v_challenger_state, v_winner_state, v_points, p_host_user_id, p_challenger_user_id)
    RETURNING id INTO v_state_battle_id;

    -- Update winner state
    UPDATE public.states SET
        battle_points = battle_points + v_points,
        wins = wins + 1,
        monthly_points = monthly_points + v_points,
        monthly_wins = monthly_wins + 1,
        updated_at = NOW()
    WHERE state_code = v_winner_state;

    -- Update loser state
    UPDATE public.states SET
        losses = losses + 1,
        monthly_losses = monthly_losses + 1,
        updated_at = NOW()
    WHERE state_code = v_loser_state;

    -- Update winner's state member stats
    UPDATE public.state_members SET
        battle_points_earned = battle_points_earned + v_points,
        battles_participated = battles_participated + 1,
        battles_won = battles_won + 1
    WHERE user_id = p_winner_user_id;

    -- Update loser's state member stats
    UPDATE public.state_members SET
        battles_participated = battles_participated + 1
    WHERE user_id = CASE WHEN p_winner_user_id = p_host_user_id THEN p_challenger_user_id ELSE p_host_user_id END;

    -- Check and update representative for winner state
    PERFORM public.update_state_representative(v_winner_state);

    RETURN jsonb_build_object(
        'success', true,
        'winner_state', v_winner_state,
        'loser_state', v_loser_state,
        'points_awarded', v_points,
        'state_battle_id', v_state_battle_id
    );
END;
$$;

-- Update state representative (user with highest battle_points_earned in that state)
CREATE OR REPLACE FUNCTION public.update_state_representative(p_state_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_top_user_id UUID;
BEGIN
    SELECT user_id INTO v_top_user_id
    FROM public.state_members
    WHERE state_code = p_state_code
    ORDER BY battle_points_earned DESC, battles_won DESC, joined_at ASC
    LIMIT 1;

    IF v_top_user_id IS NOT NULL THEN
        UPDATE public.states SET
            representative_user_id = v_top_user_id,
            updated_at = NOW()
        WHERE state_code = p_state_code;
    END IF;
END;
$$;

-- Get state leaderboard
CREATE OR REPLACE FUNCTION public.get_state_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    rank BIGINT,
    state_code TEXT,
    state_name TEXT,
    battle_points BIGINT,
    wins INTEGER,
    losses INTEGER,
    representative_user_id UUID,
    representative_username TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY s.battle_points DESC, s.wins DESC)::BIGINT as rank,
        s.state_code,
        s.state_name,
        s.battle_points,
        s.wins,
        s.losses,
        s.representative_user_id,
        up.username as representative_username
    FROM public.states s
    LEFT JOIN public.user_profiles up ON up.id = s.representative_user_id
    ORDER BY s.battle_points DESC, s.wins DESC
    LIMIT p_limit;
END;
$$;

-- Reset monthly state points (call at start of each month)
CREATE OR REPLACE FUNCTION public.reset_monthly_state_points()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.states SET
        monthly_points = 0,
        monthly_wins = 0,
        monthly_losses = 0,
        last_month_reset = NOW();
END;
$$;

-- Find state battle match (prefer different states)
CREATE OR REPLACE FUNCTION public.find_state_battle_match(
    p_stream_id UUID,
    p_broadcaster_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_broadcaster_state TEXT;
    v_matched_stream RECORD;
    v_battle_id UUID;
BEGIN
    -- Get broadcaster's state
    SELECT state_code INTO v_broadcaster_state
    FROM public.state_members
    WHERE user_id = p_broadcaster_id;

    IF v_broadcaster_state IS NULL THEN
        RETURN jsonb_build_object('matched', false, 'error', 'No state assigned');
    END IF;

    -- Find a live stream with state_battle_mode enabled, preferring different state
    -- Exclude streams that have been recently matched (cooldown)
    SELECT s.id as stream_id, s.user_id as broadcaster_id, sm.state_code as opponent_state
    INTO v_matched_stream
    FROM public.streams s
    JOIN public.state_members sm ON sm.user_id = s.user_id
    WHERE s.state_battle_mode = 'state'
      AND s.status = 'live'
      AND s.id != p_stream_id
      AND s.user_id != p_broadcaster_id
      AND (s.random_battle_cooldown_until IS NULL OR s.random_battle_cooldown_until < NOW())
    ORDER BY
        -- Prefer different state
        CASE WHEN sm.state_code != v_broadcaster_state THEN 0 ELSE 1 END,
        -- Then by most recent
        s.started_at DESC NULLS LAST
    LIMIT 1;

    IF v_matched_stream IS NULL THEN
        RETURN jsonb_build_object('matched', false, 'error', 'No opponent found');
    END IF;

    -- Create the battle
    INSERT INTO public.troll_battles (host_id, challenger_id, status, stream_id)
    VALUES (p_broadcaster_id, v_matched_stream.broadcaster_id, 'starting', p_stream_id)
    RETURNING id INTO v_battle_id;

    -- Update both streams
    UPDATE public.streams SET
        battle_id = v_battle_id,
        battle_mode = 'random_queue',
        battle_status = 'starting',
        battle_start_time = NOW() + INTERVAL '10 seconds',
        battle_end_time = NOW() + INTERVAL '10 minutes',
        state_battle_mode = 'state',
        random_battle_queue_enabled = false,
        random_battle_queued_at = NULL
    WHERE id = p_stream_id;

    UPDATE public.streams SET
        battle_id = v_battle_id,
        battle_mode = 'random_queue',
        battle_status = 'starting',
        battle_start_time = NOW() + INTERVAL '10 seconds',
        battle_end_time = NOW() + INTERVAL '10 minutes',
        state_battle_mode = 'state',
        random_battle_queue_enabled = false,
        random_battle_queued_at = NULL,
        random_battle_cooldown_until = NOW() + INTERVAL '5 minutes'
    WHERE id = v_matched_stream.stream_id;

    RETURN jsonb_build_object(
        'matched', true,
        'battle_id', v_battle_id,
        'battle_started_at', (NOW() + INTERVAL '10 seconds')::TEXT,
        'battle_ends_at', (NOW() + INTERVAL '10 minutes')::TEXT,
        'opponent_stream_id', v_matched_stream.stream_id,
        'opponent_state', v_matched_stream.opponent_state,
        'broadcaster_state', v_broadcaster_state
    );
END;
$$;
