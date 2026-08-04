-- ============================================================
-- BROADCAST LEAGUE SYSTEM (T LEAGUE)
-- ============================================================
-- Replaces the old "Broadcast Level" system with T League (T0-T10)
-- League score = gift_coins_received + floor(total_live_minutes / 5)
-- ============================================================

-- 1. Broadcast League Stats Table
-- Tracks per-broadcaster league stats per season
CREATE TABLE IF NOT EXISTS public.broadcast_league_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    season_key TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    league_tier TEXT NOT NULL DEFAULT 'T0' CHECK (league_tier IN ('T0','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10')),
    league_score NUMERIC NOT NULL DEFAULT 0,
    gift_coins_received NUMERIC NOT NULL DEFAULT 0,
    total_live_minutes NUMERIC NOT NULL DEFAULT 0,
    gift_count INTEGER NOT NULL DEFAULT 0,
    stream_count INTEGER NOT NULL DEFAULT 0,
    best_stream_score NUMERIC NOT NULL DEFAULT 0,
    last_stream_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(broadcaster_id, season_key)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_bls_broadcaster_id ON public.broadcast_league_stats(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_bls_season_key ON public.broadcast_league_stats(season_key);
CREATE INDEX IF NOT EXISTS idx_bls_league_tier ON public.broadcast_league_stats(league_tier);
CREATE INDEX IF NOT EXISTS idx_bls_league_score ON public.broadcast_league_stats(league_score DESC);
CREATE INDEX IF NOT EXISTS idx_bls_broadcaster_season ON public.broadcast_league_stats(broadcaster_id, season_key);

-- 3. Enable RLS
ALTER TABLE public.broadcast_league_stats ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Anyone can read broadcast league stats" ON public.broadcast_league_stats
    FOR SELECT USING (true);

CREATE POLICY "System can insert league stats" ON public.broadcast_league_stats
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update league stats" ON public.broadcast_league_stats
    FOR UPDATE USING (true);

-- 5. Grant permissions
GRANT SELECT ON public.broadcast_league_stats TO authenticated;
GRANT SELECT ON public.broadcast_league_stats TO anon;
GRANT INSERT ON public.broadcast_league_stats TO authenticated;
GRANT UPDATE ON public.broadcast_league_stats TO authenticated;

-- 6. Function: Calculate league tier from score
CREATE OR REPLACE FUNCTION public.calculate_t_league_tier(p_score NUMERIC)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_score >= 100000000000 THEN 'T10'
        WHEN p_score >= 50000000000  THEN 'T9'
        WHEN p_score >= 2500000000   THEN 'T8'
        WHEN p_score >= 120000000    THEN 'T7'
        WHEN p_score >= 60000000     THEN 'T6'
        WHEN p_score >= 3000000      THEN 'T5'
        WHEN p_score >= 150000       THEN 'T4'
        WHEN p_score >= 75000        THEN 'T3'
        WHEN p_score >= 2500         THEN 'T2'
        WHEN p_score >= 500          THEN 'T1'
        ELSE 'T0'
    END;
$$;

-- 7. Function: Update league stats when a gift is received
CREATE OR REPLACE FUNCTION public.update_league_on_gift(
    p_broadcaster_id UUID,
    p_gift_coins NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_season TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_new_score NUMERIC;
    v_new_tier TEXT;
BEGIN
    -- Upsert the league stats row
    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_score, league_tier,
        gift_coins_received, gift_count, updated_at
    )
    VALUES (
        p_broadcaster_id, v_season,
        p_gift_coins, public.calculate_t_league_tier(p_gift_coins),
        p_gift_coins, 1, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        gift_coins_received = public.broadcast_league_stats.gift_coins_received + p_gift_coins,
        gift_count = public.broadcast_league_stats.gift_count + 1,
        league_score = public.broadcast_league_stats.gift_coins_received + p_gift_coins + floor(public.broadcast_league_stats.total_live_minutes / 5),
        updated_at = NOW()
    RETURNING league_score INTO v_new_score;

    -- Recalculate tier
    v_new_tier := public.calculate_t_league_tier(v_new_score);

    UPDATE public.broadcast_league_stats
    SET league_tier = v_new_tier
    WHERE broadcaster_id = p_broadcaster_id AND season_key = v_season;
END;
$$;

-- 8. Function: Update league stats when a stream ends
CREATE OR REPLACE FUNCTION public.update_league_on_stream_end(
    p_broadcaster_id UUID,
    p_live_minutes NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_season TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_new_score NUMERIC;
    v_new_tier TEXT;
BEGIN
    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_score, league_tier,
        total_live_minutes, stream_count, last_stream_at, updated_at
    )
    VALUES (
        p_broadcaster_id, v_season,
        floor(p_live_minutes / 5), public.calculate_t_league_tier(floor(p_live_minutes / 5)),
        p_live_minutes, 1, NOW(), NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        total_live_minutes = public.broadcast_league_stats.total_live_minutes + p_live_minutes,
        stream_count = public.broadcast_league_stats.stream_count + 1,
        last_stream_at = NOW(),
        league_score = public.broadcast_league_stats.gift_coins_received + floor((public.broadcast_league_stats.total_live_minutes + p_live_minutes) / 5),
        updated_at = NOW()
    RETURNING league_score INTO v_new_score;

    v_new_tier := public.calculate_t_league_tier(v_new_score);

    UPDATE public.broadcast_league_stats
    SET league_tier = v_new_tier
    WHERE broadcaster_id = p_broadcaster_id AND season_key = v_season;
END;
$$;

-- 9. Grant execute on functions
GRANT EXECUTE ON FUNCTION public.calculate_t_league_tier TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_t_league_tier TO anon;
GRANT EXECUTE ON FUNCTION public.update_league_on_gift TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_league_on_stream_end TO authenticated;
