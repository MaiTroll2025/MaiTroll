-- =============================================================================
-- BATTLE LEAGUE POINTS LINK
-- =============================================================================
-- When a battle ends, automatically:
--   - Award +1 league point to winner's family (via standings)
--   - Deduct -10 league points from loser's family (via standings)
--   - Award +1 agency point to winner (via add_agency_points)
--   - Deduct -10 agency points from loser (direct SQL, min 0)
-- Works for ALL battle types: manual, random_queue, forfeit
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ADD battle_won / battle_lost TO agency_transaction_type ENUM
-- =============================================================================

ALTER TYPE public.agency_transaction_type ADD VALUE IF NOT EXISTS 'battle_won';
ALTER TYPE public.agency_transaction_type ADD VALUE IF NOT EXISTS 'battle_lost';

-- =============================================================================
-- 2. HELPER: Award family league points directly to standings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.award_family_battle_points(
    p_user_id uuid,
    p_points_delta integer,
    p_battle_id uuid DEFAULT NULL,
    p_event_type text DEFAULT 'battle_won'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_family_id uuid;
    v_season_id uuid;
BEGIN
    SELECT fm.family_id INTO v_family_id
    FROM public.family_members fm
    WHERE fm.user_id = p_user_id
      AND fm.approval_status = 'approved'
    LIMIT 1;

    IF v_family_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO v_season_id
    FROM public.troll_family_league_seasons
    WHERE is_active = true
      AND CURRENT_DATE BETWEEN season_start_date AND season_end_date
    LIMIT 1;

    IF v_season_id IS NULL THEN
        INSERT INTO public.troll_family_league_seasons (
            season_number, season_start_date, season_end_date, is_active, name
        ) VALUES (
            COALESCE((SELECT MAX(season_number) FROM public.troll_family_league_seasons) + 1, 1),
            DATE_TRUNC('month', CURRENT_DATE)::date,
            (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
            true,
            'Season ' || COALESCE((SELECT MAX(season_number) FROM public.troll_family_league_seasons) + 1, 1)
        )
        RETURNING id INTO v_season_id;
    END IF;

    INSERT INTO public.troll_family_activity_events (
        family_id, user_id, event_type, amount, metadata, recorded_at
    ) VALUES (
        v_family_id, p_user_id, p_event_type, ABS(p_points_delta),
        jsonb_build_object(
            'battle_id', p_battle_id,
            'points_delta', p_points_delta,
            'dedup_key', 'battle_league_' || p_battle_id || '_' || p_user_id
        ),
        NOW()
    )
    ON CONFLICT DO NOTHING;

    IF p_points_delta > 0 THEN
        INSERT INTO public.troll_family_league_standings (season_id, family_id, points, wins)
        VALUES (v_season_id, v_family_id, p_points_delta, 1)
        ON CONFLICT (season_id, family_id) DO UPDATE SET
            points = troll_family_league_standings.points + p_points_delta,
            wins = troll_family_league_standings.wins + 1,
            updated_at = NOW();
    ELSIF p_points_delta < 0 THEN
        INSERT INTO public.troll_family_league_standings (season_id, family_id, points, losses)
        VALUES (v_season_id, v_family_id, 0, 1)
        ON CONFLICT (season_id, family_id) DO UPDATE SET
            points = GREATEST(troll_family_league_standings.points + p_points_delta, 0),
            losses = troll_family_league_standings.losses + 1,
            updated_at = NOW();
    END IF;
END;
$$;

-- =============================================================================
-- 3. HELPER: Award agency battle points (uses add_agency_points for wins,
--    direct deduction for losses since add_agency_points doesn't support negative)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.award_agency_battle_points(
    p_user_id uuid,
    p_points_delta integer,
    p_battle_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_member boolean;
    v_current_total integer;
    v_new_total integer;
    v_current_tier public.agency_tier;
    v_new_tier public.agency_tier;
    v_week_start date;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.agency_members WHERE user_id = p_user_id AND is_active = true
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RETURN;
    END IF;

    IF p_points_delta > 0 THEN
        INSERT INTO public.agency_point_transactions (
            user_id, transaction_type, points, source_id, source_table, verified, verification_data, week_start
        ) VALUES (
            p_user_id, 'battle_won'::public.agency_transaction_type, p_points_delta,
            p_battle_id::text, 'battles', true,
            jsonb_build_object('battle_id', p_battle_id, 'points_delta', p_points_delta),
            date_trunc('week', NOW())::date
        );

        SELECT COALESCE(total_points, 0), current_tier INTO v_current_total, v_current_tier
        FROM public.agency_members WHERE user_id = p_user_id;

        v_new_total := v_current_total + p_points_delta;
        v_new_tier := public.calculate_agency_tier(v_new_total);

        UPDATE public.agency_members
        SET total_points = v_new_total,
            lifetime_points = lifetime_points + p_points_delta,
            current_tier = v_new_tier,
            last_active_at = NOW(),
            updated_at = NOW(),
            notified_tier_change = CASE WHEN v_new_tier != v_current_tier THEN false ELSE notified_tier_change END
        WHERE user_id = p_user_id;

    ELSIF p_points_delta < 0 THEN
        v_week_start := date_trunc('week', NOW())::date;

        INSERT INTO public.agency_point_transactions (
            user_id, transaction_type, points, source_id, source_table, verified, verification_data, week_start
        ) VALUES (
            p_user_id, 'battle_lost'::public.agency_transaction_type, p_points_delta,
            p_battle_id::text, 'battles', true,
            jsonb_build_object('battle_id', p_battle_id, 'points_delta', p_points_delta),
            v_week_start
        );

        SELECT COALESCE(total_points, 0), current_tier INTO v_current_total, v_current_tier
        FROM public.agency_members WHERE user_id = p_user_id;

        v_new_total := GREATEST(v_current_total + p_points_delta, 0);
        v_new_tier := public.calculate_agency_tier(v_new_total);

        UPDATE public.agency_members
        SET total_points = v_new_total,
            current_tier = v_new_tier,
            last_active_at = NOW(),
            updated_at = NOW(),
            notified_tier_change = CASE WHEN v_new_tier != v_current_tier THEN false ELSE notified_tier_change END
        WHERE user_id = p_user_id;
    END IF;
END;
$$;

-- =============================================================================
-- 4. RECREATE end_battle_guarded WITH LEAGUE POINT TRACKING
-- =============================================================================

DROP FUNCTION IF EXISTS public.end_battle_guarded(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.end_battle_guarded(
  p_battle_id UUID,
  p_min_duration_seconds INTEGER DEFAULT 180,
  p_sudden_death_seconds INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle RECORD;
  v_required INTERVAL;
  v_winner_stream_id UUID;
  v_winner_user_id UUID;
  v_loser_user_id UUID;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id FOR UPDATE;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not active');
  END IF;

  IF v_battle.started_at IS NULL OR v_battle.started_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not started');
  END IF;

  v_required := make_interval(secs => p_min_duration_seconds + p_sudden_death_seconds - 10);

  IF now() < v_battle.started_at + v_required THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle timer not elapsed');
  END IF;

  IF v_battle.score_challenger > v_battle.score_opponent THEN
    v_winner_stream_id := v_battle.challenger_stream_id;
  ELSIF v_battle.score_opponent > v_battle.score_challenger THEN
    v_winner_stream_id := v_battle.opponent_stream_id;
  END IF;

  IF v_winner_stream_id IS NOT NULL THEN
    SELECT user_id INTO v_winner_user_id FROM public.streams WHERE id = v_winner_stream_id;

    IF v_winner_stream_id = v_battle.challenger_stream_id THEN
      SELECT user_id INTO v_loser_user_id FROM public.streams WHERE id = v_battle.opponent_stream_id;
    ELSE
      SELECT user_id INTO v_loser_user_id FROM public.streams WHERE id = v_battle.challenger_stream_id;
    END IF;
  END IF;

  UPDATE public.battles
  SET status = 'ended', ended_at = now(), winner_stream_id = v_winner_stream_id
  WHERE id = p_battle_id;

  IF v_winner_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_wins = COALESCE(battle_wins, 0) + 1
    WHERE id = v_winner_user_id;

    PERFORM public.award_family_battle_points(v_winner_user_id, 1, p_battle_id, 'battle_won');
    PERFORM public.award_agency_battle_points(v_winner_user_id, 1, p_battle_id);
  END IF;

  IF v_loser_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_losses = COALESCE(battle_losses, 0) + 1,
        battle_crown_streak = 0
    WHERE id = v_loser_user_id;

    PERFORM public.award_family_battle_points(v_loser_user_id, -10, p_battle_id, 'battle_lost');
    PERFORM public.award_agency_battle_points(v_loser_user_id, -10, p_battle_id);
  END IF;

  UPDATE public.streams
  SET battle_id = NULL, is_battle = false,
      battle_status = 'waiting', battle_mode = 'manual'
  WHERE battle_id = p_battle_id;

  DELETE FROM public.battle_participants WHERE battle_id = p_battle_id;
  DELETE FROM public.battle_queue WHERE battle_id = p_battle_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =============================================================================
-- 5. RECREATE finish_random_battle WITH LEAGUE POINT TRACKING
-- =============================================================================

CREATE OR REPLACE FUNCTION public.finish_random_battle(
  p_battle_id uuid,
  p_end_reason text DEFAULT 'timer_expired'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_winner_stream_id uuid;
  v_winner_id uuid;
  v_loser_stream_id uuid;
  v_loser_id uuid;
BEGIN
  SELECT *
    INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status = 'ended' THEN
    RETURN jsonb_build_object('success', true, 'winner_stream_id', v_battle.winner_stream_id, 'already_ended', true);
  END IF;

  IF v_battle.started_at IS NULL OR now() < v_battle.started_at + interval '90 seconds' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle minimum duration not elapsed');
  END IF;

  IF COALESCE(v_battle.score_challenger, 0) > COALESCE(v_battle.score_opponent, 0) THEN
    v_winner_stream_id := v_battle.challenger_stream_id;
    v_loser_stream_id := v_battle.opponent_stream_id;
  ELSIF COALESCE(v_battle.score_opponent, 0) > COALESCE(v_battle.score_challenger, 0) THEN
    v_winner_stream_id := v_battle.opponent_stream_id;
    v_loser_stream_id := v_battle.challenger_stream_id;
  END IF;

  IF v_winner_stream_id IS NOT NULL THEN
    SELECT user_id INTO v_winner_id
    FROM public.streams
    WHERE id = v_winner_stream_id;
  END IF;

  IF v_loser_stream_id IS NOT NULL THEN
    SELECT user_id INTO v_loser_id
    FROM public.streams
    WHERE id = v_loser_stream_id;
  END IF;

  UPDATE public.battles
  SET status = 'ended',
      ended_at = now(),
      winner_stream_id = v_winner_stream_id,
      winner_id = v_winner_id
  WHERE id = p_battle_id;

  UPDATE public.streams
  SET is_battle = false,
      battle_id = null,
      battle_mode = 'manual',
      battle_status = 'waiting',
      battle_start_time = null,
      battle_end_time = now(),
      battle_end_reason = p_end_reason,
      battle_winner_id = v_winner_id,
      battle_forfeited_by = null,
      random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      random_battle_cooldown_until = null
  WHERE battle_id = p_battle_id
    AND battle_mode = 'random_queue';

  DELETE FROM public.battle_participants WHERE battle_id = p_battle_id;

  IF v_winner_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
        battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1,
        total_battle_wins = COALESCE(total_battle_wins, 0) + 1
    WHERE id = v_winner_id;

    PERFORM public.award_family_battle_points(v_winner_id, 1, p_battle_id, 'battle_won');
    PERFORM public.award_agency_battle_points(v_winner_id, 1, p_battle_id);
  END IF;

  IF v_loser_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_crown_streak = 0
    WHERE id = v_loser_id;

    PERFORM public.award_family_battle_points(v_loser_id, -10, p_battle_id, 'battle_lost');
    PERFORM public.award_agency_battle_points(v_loser_id, -10, p_battle_id);
  END IF;

  IF v_winner_stream_id IS NULL THEN
    UPDATE public.user_profiles
    SET battle_crown_streak = 0
    WHERE id IN (SELECT user_id FROM public.streams WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'winner_stream_id', v_winner_stream_id,
    'winner_id', v_winner_id,
    'loser_id', v_loser_id
  );
END;
$$;

-- =============================================================================
-- 6. RECREATE forfeit_random_battle WITH LEAGUE POINT TRACKING
-- =============================================================================

CREATE OR REPLACE FUNCTION public.forfeit_random_battle(
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle record;
  v_forfeiter_stream_id uuid;
  v_winner_stream_id uuid;
  v_winner_id uuid;
  v_loser_id uuid;
BEGIN
  SELECT b.*
    INTO v_battle
  FROM public.battles b
  JOIN public.streams s ON s.id IN (b.challenger_stream_id, b.opponent_stream_id)
  WHERE s.id = p_stream_id
    AND s.user_id = p_broadcaster_id
    AND s.battle_mode = 'random_queue'
    AND b.status <> 'ended'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Random battle not found');
  END IF;

  v_forfeiter_stream_id := p_stream_id;
  v_winner_stream_id := CASE
    WHEN v_battle.challenger_stream_id = p_stream_id THEN v_battle.opponent_stream_id
    ELSE v_battle.challenger_stream_id
  END;

  SELECT user_id INTO v_winner_id
  FROM public.streams
  WHERE id = v_winner_stream_id
  FOR UPDATE;

  v_loser_id := p_broadcaster_id;

  UPDATE public.battles
  SET status = 'ended',
      ended_at = now(),
      winner_stream_id = v_winner_stream_id
  WHERE id = v_battle.id;

  UPDATE public.streams
  SET is_battle = false,
      battle_id = null,
      battle_mode = 'manual',
      battle_status = 'waiting',
      battle_start_time = null,
      battle_end_time = now(),
      battle_end_reason = 'forfeit',
      battle_winner_id = v_winner_id,
      battle_forfeited_by = p_broadcaster_id,
      random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      random_battle_cooldown_until = null
  WHERE id = v_forfeiter_stream_id;

  DELETE FROM public.battle_participants WHERE battle_id = v_battle.id;

  UPDATE public.user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + 2,
      battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1
  WHERE id = v_winner_id;

  UPDATE public.user_profiles
  SET battle_crown_streak = 0
  WHERE id = v_loser_id;

  PERFORM public.award_family_battle_points(v_winner_id, 1, v_battle.id, 'battle_won');
  PERFORM public.award_agency_battle_points(v_winner_id, 1, v_battle.id);

  PERFORM public.award_family_battle_points(v_loser_id, -10, v_battle.id, 'battle_lost');
  PERFORM public.award_agency_battle_points(v_loser_id, -10, v_battle.id);

  RETURN jsonb_build_object(
    'success', true,
    'battle_id', v_battle.id,
    'winner_id', v_winner_id,
    'winner_stream_id', v_winner_stream_id,
    'coins_awarded_to_forfeiter', 0,
    'crowns_awarded_to_winner', 2
  );
END;
$$;

-- =============================================================================
-- 7. GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.award_family_battle_points(uuid, integer, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_agency_battle_points(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_battle_guarded(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_random_battle(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_random_battle(uuid, uuid) TO authenticated;

-- =============================================================================
-- 8. UPDATE AGENCY SETTINGS POINT VALUES TO INCLUDE BATTLE TYPES
-- =============================================================================

UPDATE public.agency_settings
SET value = value || '{"battle_won": 1, "battle_lost": -10}'::jsonb
WHERE key = 'point_values';

COMMIT;
