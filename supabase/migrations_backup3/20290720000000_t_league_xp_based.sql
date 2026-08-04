-- ============================================================
-- T LEAGUE XP-BASED SYSTEM
-- ============================================================
-- T League now reads from the user XP/level system.
-- When users receive gifts in broadcast, their XP increases
-- (via existing trg_award_stream_gift_xp on stream_gifts),
-- and the T league tier is calculated from total_xp.
-- ============================================================

-- 1. Add total_xp column to broadcast_league_stats
ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS total_xp BIGINT NOT NULL DEFAULT 0;

-- 2. Sync league stats when a gift is received (receiver's xp already
--    updated by trg_award_stream_gift_xp, so we just read it here)
CREATE OR REPLACE FUNCTION public.sync_league_on_gift_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_receiver_id UUID;
    v_total_xp BIGINT;
    v_season TEXT;
BEGIN
    v_receiver_id := COALESCE(NEW.receiver_id, NEW.recipient_id);
    IF v_receiver_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_season := to_char(CURRENT_DATE, 'YYYY-MM');

    SELECT COALESCE(total_xp, 0) INTO v_total_xp
    FROM public.user_profiles
    WHERE id = v_receiver_id;

    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_score, league_tier,
        total_xp, gift_count, updated_at
    )
    VALUES (
        v_receiver_id, v_season, v_total_xp,
        public.calculate_t_league_tier(v_total_xp),
        v_total_xp, 1, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        gift_count = broadcast_league_stats.gift_count + 1,
        total_xp = v_total_xp,
        league_score = v_total_xp,
        updated_at = NOW();

    UPDATE public.broadcast_league_stats
    SET league_tier = public.calculate_t_league_tier(total_xp)
    WHERE broadcaster_id = v_receiver_id AND season_key = v_season;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_league_on_gift_xp ON public.stream_gifts;
CREATE TRIGGER trg_sync_league_on_gift_xp
    AFTER INSERT ON public.stream_gifts
    FOR EACH ROW EXECUTE FUNCTION public.sync_league_on_gift_xp();

-- 3. Sync league stats when xp changes from other sources (chat, watch time, etc.)
CREATE OR REPLACE FUNCTION public.sync_league_on_xp_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_season TEXT;
BEGIN
    IF NEW.xp_total = OLD.xp_total THEN
        RETURN NEW;
    END IF;

    v_season := to_char(CURRENT_DATE, 'YYYY-MM');

    UPDATE public.broadcast_league_stats
    SET total_xp = NEW.xp_total,
        league_score = NEW.xp_total,
        league_tier = public.calculate_t_league_tier(NEW.xp_total),
        updated_at = NOW()
    WHERE broadcaster_id = NEW.user_id AND season_key = v_season;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_league_on_xp_change ON public.user_stats;
CREATE TRIGGER trg_sync_league_on_xp_change
    AFTER UPDATE OF xp_total ON public.user_stats
    FOR EACH ROW EXECUTE FUNCTION public.sync_league_on_xp_change();

-- 4. Update existing functions to use total_xp as the league score
CREATE OR REPLACE FUNCTION public.update_league_on_gift(
    p_broadcaster_id UUID,
    p_gift_coins NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_season TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_total_xp BIGINT;
    v_new_tier TEXT;
BEGIN
    SELECT COALESCE(total_xp, 0) INTO v_total_xp
    FROM public.user_profiles
    WHERE id = p_broadcaster_id;

    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_score, league_tier,
        gift_coins_received, gift_count, total_xp, updated_at
    )
    VALUES (
        p_broadcaster_id, v_season, v_total_xp,
        public.calculate_t_league_tier(v_total_xp),
        p_gift_coins, 1, v_total_xp, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        gift_coins_received = public.broadcast_league_stats.gift_coins_received + p_gift_coins,
        gift_count = public.broadcast_league_stats.gift_count + 1,
        total_xp = v_total_xp,
        league_score = v_total_xp,
        updated_at = NOW();

    v_new_tier := public.calculate_t_league_tier(v_total_xp);
    UPDATE public.broadcast_league_stats
    SET league_tier = v_new_tier
    WHERE broadcaster_id = p_broadcaster_id AND season_key = v_season;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_league_on_stream_end(
    p_broadcaster_id UUID,
    p_live_minutes NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_season TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
    v_total_xp BIGINT;
    v_new_tier TEXT;
BEGIN
    SELECT COALESCE(total_xp, 0) INTO v_total_xp
    FROM public.user_profiles
    WHERE id = p_broadcaster_id;

    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_score, league_tier,
        total_live_minutes, stream_count, total_xp, updated_at
    )
    VALUES (
        p_broadcaster_id, v_season, v_total_xp,
        public.calculate_t_league_tier(v_total_xp),
        p_live_minutes, 1, v_total_xp, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        total_live_minutes = public.broadcast_league_stats.total_live_minutes + p_live_minutes,
        stream_count = public.broadcast_league_stats.stream_count + 1,
        total_xp = v_total_xp,
        league_score = v_total_xp,
        updated_at = NOW();

    v_new_tier := public.calculate_t_league_tier(v_total_xp);
    UPDATE public.broadcast_league_stats
    SET league_tier = v_new_tier
    WHERE broadcaster_id = p_broadcaster_id AND season_key = v_season;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.sync_league_on_gift_xp TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_league_on_xp_change TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_league_on_gift TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_league_on_stream_end TO authenticated;
