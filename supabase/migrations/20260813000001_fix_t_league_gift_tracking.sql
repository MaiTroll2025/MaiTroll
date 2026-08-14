-- ============================================================================
-- Fix T-League Gift Tracking System
-- ============================================================================
-- Issues fixed:
-- 1. broadcast_league_stats.total_gifts_sent was never updated because
--    trg_update_total_gifts_sent only fired on public.gifts, not stream_gifts
-- 2. send_gift_in_stream already calls grant_xp directly (confirmed in
--    20260808000002_trollmond_gift_logic.sql)
-- 3. Competing/duplicate triggers on stream_gifts cleaned up to prevent
--    race conditions and double-counting
-- 4. broadcast_league_stats.gift_coins_received was never updated by the
--    XP-based system
-- ============================================================================

-- ============================================================================
-- 1. Ensure broadcast_league_stats has required columns
-- ============================================================================

ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS total_xp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gifts_sent INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Ensure calculate_t_league_tier function exists
-- ============================================================================

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

GRANT EXECUTE ON FUNCTION public.calculate_t_league_tier(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_t_league_tier(NUMERIC) TO anon;

-- ============================================================================
-- 3. Drop conflicting triggers on stream_gifts to prevent double-counting
-- ============================================================================

DROP TRIGGER IF EXISTS trg_award_stream_gift_xp ON public.stream_gifts;
DROP TRIGGER IF EXISTS trg_sync_league_on_gift_xp ON public.stream_gifts;
DROP TRIGGER IF EXISTS trg_update_total_gifts_sent ON public.gifts;

-- ============================================================================
-- 4. Create update_league_on_gift_insert trigger function
-- ============================================================================
-- Fires AFTER INSERT on stream_gifts.
-- - Calls grant_xp for sender (110%) and receiver (55%).
--   Idempotent via xp_ledger check inside grant_xp.
-- - Updates broadcast_league_stats using actual user_stats.xp_total values
--   so league metrics stay accurate even if grant_xp is blocked.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_league_on_gift_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_id UUID;
    v_receiver_id UUID;
    v_gift_amount BIGINT;
    v_sender_xp BIGINT;
    v_receiver_xp BIGINT;
    v_season TEXT;
    v_sender_xp_award BIGINT;
    v_receiver_xp_award BIGINT;
BEGIN
    v_sender_id := NEW.sender_id;
    v_receiver_id := COALESCE(NEW.receiver_id, NEW.recipient_id);
    v_gift_amount := COALESCE(NEW.amount, NEW.coins_spent, 0);

    IF v_sender_id IS NULL OR v_receiver_id IS NULL
       OR v_sender_id = v_receiver_id OR v_gift_amount <= 0 THEN
        RETURN NEW;
    END IF;

    v_season := to_char(CURRENT_DATE, 'YYYY-MM');
    v_sender_xp_award := FLOOR(v_gift_amount * 1.1);
    v_receiver_xp_award := FLOOR(v_gift_amount * 0.55);

    -- Award XP (idempotent via xp_ledger check in grant_xp)
    BEGIN
        PERFORM public.grant_xp(
            v_sender_id,
            v_sender_xp_award,
            'gift_sent',
            'gift_sent_' || NEW.id::text,
            jsonb_build_object(
                'receiver_id', v_receiver_id,
                'stream_id', NEW.stream_id,
                'stream_gift_id', NEW.id
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'update_league_on_gift_insert: sender XP grant failed for stream_gift %: %',
            NEW.id, SQLERRM;
    END;

    BEGIN
        PERFORM public.grant_xp(
            v_receiver_id,
            v_receiver_xp_award,
            'gift_received',
            'gift_received_' || NEW.id::text,
            jsonb_build_object(
                'sender_id', v_sender_id,
                'stream_id', NEW.stream_id,
                'stream_gift_id', NEW.id
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'update_league_on_gift_insert: receiver XP grant failed for stream_gift %: %',
            NEW.id, SQLERRM;
    END;

    -- Read actual XP totals from user_stats
    SELECT COALESCE(xp_total, 0) INTO v_sender_xp FROM public.user_stats WHERE user_id = v_sender_id;
    SELECT COALESCE(xp_total, 0) INTO v_receiver_xp FROM public.user_stats WHERE user_id = v_receiver_id;

    -- Update sender league stats
    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_tier, league_score,
        total_xp, gift_count, total_gifts_sent, updated_at
    )
    VALUES (
        v_sender_id, v_season,
        public.calculate_t_league_tier(v_sender_xp),
        v_sender_xp,
        v_sender_xp, 1, 1, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        total_xp = v_sender_xp,
        league_score = v_sender_xp,
        league_tier = public.calculate_t_league_tier(v_sender_xp),
        gift_count = public.broadcast_league_stats.gift_count + 1,
        total_gifts_sent = public.broadcast_league_stats.total_gifts_sent + 1,
        updated_at = NOW();

    -- Update receiver league stats
    INSERT INTO public.broadcast_league_stats (
        broadcaster_id, season_key, league_tier, league_score,
        total_xp, gift_count, gift_coins_received, updated_at
    )
    VALUES (
        v_receiver_id, v_season,
        public.calculate_t_league_tier(v_receiver_xp),
        v_receiver_xp,
        v_receiver_xp, 1, v_gift_amount, NOW()
    )
    ON CONFLICT (broadcaster_id, season_key)
    DO UPDATE SET
        total_xp = v_receiver_xp,
        league_score = v_receiver_xp,
        league_tier = public.calculate_t_league_tier(v_receiver_xp),
        gift_count = public.broadcast_league_stats.gift_count + 1,
        gift_coins_received = public.broadcast_league_stats.gift_coins_received + v_gift_amount,
        updated_at = NOW();

    -- Also update gifted_coins_received if that column exists
    BEGIN
        UPDATE public.broadcast_league_stats
        SET gifted_coins_received = COALESCE(gifted_coins_received, 0) + v_gift_amount,
            updated_at = NOW()
        WHERE broadcaster_id = v_receiver_id AND season_key = v_season;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. Create trigger on stream_gifts
-- ============================================================================

CREATE TRIGGER trg_update_league_on_gift_insert
    AFTER INSERT ON public.stream_gifts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_league_on_gift_insert();

-- ============================================================================
-- 6. Create sync_league_on_xp_change trigger on user_stats
-- ============================================================================
-- Keeps broadcast_league_stats in sync when XP changes from other sources
-- (chat, watch time, etc.) via the user_stats table.
-- ============================================================================

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
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_league_on_xp_change();

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_league_on_gift_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_league_on_xp_change() TO authenticated;
