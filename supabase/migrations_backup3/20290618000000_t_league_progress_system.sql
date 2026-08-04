-- ============================================================
-- T LEAGUE PROGRESS SYSTEM — SUB-TIERS & WEEKLY GOALS
-- ============================================================
-- Adds sub-tier tracking (a/b/c/d within each T0-T10 tier)
-- Adds weekly goals table for mini-missions per sub-tier
-- Adds league level tracking (0-10 based on gifts sent)
-- ============================================================

-- 1. Add sub-tier columns to broadcast_league_stats
ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS sub_tier TEXT NOT NULL DEFAULT 'a' CHECK (sub_tier IN ('a','b','c','d'));

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS weekly_score NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS weekly_goals_completed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS league_level INTEGER NOT NULL DEFAULT 0 CHECK (league_level >= 0 AND league_level <= 10);

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS total_gifts_sent NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS weekly_gifts_sent NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS weekly_reset_at TIMESTAMPTZ;

-- 2. Update the tier calculation function to include sub-tier
CREATE OR REPLACE FUNCTION public.calculate_t_league_tier(p_score NUMERIC)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_score >= 2000000    THEN 'T10'
        WHEN p_score >= 750000     THEN 'T9'
        WHEN p_score >= 300000     THEN 'T8'
        WHEN p_score >= 100000     THEN 'T7'
        WHEN p_score >= 40000      THEN 'T6'
        WHEN p_score >= 15000      THEN 'T5'
        WHEN p_score >= 5000       THEN 'T4'
        WHEN p_score >= 2000       THEN 'T3'
        WHEN p_score >= 500        THEN 'T2'
        WHEN p_score >= 100        THEN 'T1'
        ELSE 'T0'
    END;
$$;

-- 3. Function to calculate sub-tier from score
CREATE OR REPLACE FUNCTION public.calculate_sub_tier(p_score NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_tier_min NUMERIC;
    v_next_tier_min NUMERIC;
    v_range NUMERIC;
    v_progress NUMERIC;
    v_sub_idx INTEGER;
BEGIN
    IF p_score >= 2000000 THEN v_tier_min := 2000000; v_next_tier_min := 4000000;
    ELSIF p_score >= 750000 THEN v_tier_min := 750000; v_next_tier_min := 2000000;
    ELSIF p_score >= 300000 THEN v_tier_min := 300000; v_next_tier_min := 750000;
    ELSIF p_score >= 100000 THEN v_tier_min := 100000; v_next_tier_min := 300000;
    ELSIF p_score >= 40000 THEN v_tier_min := 40000; v_next_tier_min := 100000;
    ELSIF p_score >= 15000 THEN v_tier_min := 15000; v_next_tier_min := 40000;
    ELSIF p_score >= 5000 THEN v_tier_min := 5000; v_next_tier_min := 15000;
    ELSIF p_score >= 2000 THEN v_tier_min := 2000; v_next_tier_min := 5000;
    ELSIF p_score >= 500 THEN v_tier_min := 500; v_next_tier_min := 2000;
    ELSIF p_score >= 100 THEN v_tier_min := 100; v_next_tier_min := 500;
    ELSE v_tier_min := 0; v_next_tier_min := 100;
    END IF;

    v_range := v_next_tier_min - v_tier_min;
    IF v_range <= 0 THEN v_range := 1; END IF;
    v_progress := p_score - v_tier_min;
    v_sub_idx := LEAST(3, GREATEST(0, FLOOR((v_progress / v_range) * 4)));

    RETURN (ARRAY['a','b','c','d'])[v_sub_idx + 1];
END;
$$;

-- 4. Function to calculate league level from gifts sent
CREATE OR REPLACE FUNCTION public.calculate_league_level(p_gifts_sent NUMERIC)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_gifts_sent >= 1000000 THEN 10
        WHEN p_gifts_sent >= 300000  THEN 9
        WHEN p_gifts_sent >= 100000  THEN 8
        WHEN p_gifts_sent >= 40000   THEN 7
        WHEN p_gifts_sent >= 15000   THEN 6
        WHEN p_gifts_sent >= 5000    THEN 5
        WHEN p_gifts_sent >= 1500    THEN 4
        WHEN p_gifts_sent >= 500     THEN 3
        WHEN p_gifts_sent >= 200     THEN 2
        WHEN p_gifts_sent >= 50      THEN 1
        ELSE 0
    END;
$$;

-- 5. Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.calculate_sub_tier TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sub_tier TO anon;
GRANT EXECUTE ON FUNCTION public.calculate_league_level TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_league_level TO anon;

-- 6. Weekly goals tracking table
CREATE TABLE IF NOT EXISTS public.weekly_league_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    season_key TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    main_tier TEXT NOT NULL,
    sub_tier TEXT NOT NULL DEFAULT 'a',
    goal_type TEXT NOT NULL CHECK (goal_type IN ('gift_weekly','live_weekly','chat_weekly','viewer_weekly')),
    target_value NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    reward_score NUMERIC NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    claimed BOOLEAN NOT NULL DEFAULT false,
    week_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', NOW()),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, season_key, main_tier, sub_tier, goal_type)
);

-- 7. Indexes for weekly goals
CREATE INDEX IF NOT EXISTS idx_wlg_user_season ON public.weekly_league_goals(user_id, season_key);
CREATE INDEX IF NOT EXISTS idx_wlg_tier ON public.weekly_league_goals(main_tier, sub_tier);
CREATE INDEX IF NOT EXISTS idx_wlg_completed ON public.weekly_league_goals(completed) WHERE completed = true;

-- 8. Enable RLS on weekly goals
ALTER TABLE public.weekly_league_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weekly goals" ON public.weekly_league_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert weekly goals" ON public.weekly_league_goals
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update weekly goals" ON public.weekly_league_goals
    FOR UPDATE USING (true);

-- 9. Grant permissions
GRANT SELECT ON public.weekly_league_goals TO authenticated;
GRANT INSERT ON public.weekly_league_goals TO authenticated;
GRANT UPDATE ON public.weekly_league_goals TO authenticated;

-- 10. Function to reset weekly goals (call via cron or on first activity of new week)
CREATE OR REPLACE FUNCTION public.reset_weekly_league_goals(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_season TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_score NUMERIC;
    v_tier TEXT;
    v_sub TEXT;
    v_level INTEGER;
    v_gifts_sent NUMERIC;
    v_weekly_gifts NUMERIC;
BEGIN
    -- Get current league score
    SELECT COALESCE(league_score, 0) INTO v_score
    FROM public.broadcast_league_stats
    WHERE broadcaster_id = p_user_id AND season_key = v_season;

    v_tier := public.calculate_t_league_tier(COALESCE(v_score, 0));
    v_sub := public.calculate_sub_tier(COALESCE(v_score, 0));

    -- Get gifts sent
    SELECT COALESCE(total_gifts_sent, 0), COALESCE(weekly_gifts_sent, 0)
    INTO v_gifts_sent, v_weekly_gifts
    FROM public.broadcast_league_stats
    WHERE broadcaster_id = p_user_id AND season_key = v_season;

    v_level := public.calculate_league_level(COALESCE(v_gifts_sent, 0));

    -- Reset weekly counters
    UPDATE public.broadcast_league_stats
    SET weekly_score = 0,
        weekly_goals_completed = 0,
        weekly_gifts_sent = 0,
        weekly_reset_at = NOW(),
        league_level = v_level,
        sub_tier = v_sub
    WHERE broadcaster_id = p_user_id AND season_key = v_season;

    -- Mark all weekly goals as incomplete for new week
    UPDATE public.weekly_league_goals
    SET completed = false,
        claimed = false,
        current_value = 0,
        week_start = date_trunc('week', NOW()),
        updated_at = NOW()
    WHERE user_id = p_user_id AND season_key = v_season;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_weekly_league_goals TO authenticated;
