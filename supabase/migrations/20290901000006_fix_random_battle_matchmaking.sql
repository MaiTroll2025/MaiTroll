-- ============================================================================
-- Fix random battle matchmaking SQL bugs
-- ============================================================================
-- 1. find_random_battle_match had malformed interval: `interval ' seconds'`
--    which causes the RPC to error out and never match opponents.
-- 2. activate_due_random_battles only handled `battles` table, but state
--    battles are stored in `troll_battles`, so state battles got stuck in
--    'starting' forever.
-- ============================================================================

-- ============================================================================
-- Fix 1: canonical find_random_battle_match
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_random_battle_match(
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self public.streams%ROWTYPE;
  v_opponent public.streams%ROWTYPE;
  v_battle_id uuid;
  v_started_at timestamptz := now() + interval '10 seconds';
  v_ends_at timestamptz := now() + interval '3 minutes 10 seconds';
BEGIN
  SELECT *
    INTO v_self
  FROM public.streams
  WHERE id = p_stream_id
    AND user_id = p_broadcaster_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'message', 'Stream not found');
  END IF;

  IF v_self.category <> 'general'
    OR v_self.status <> 'live'
    OR COALESCE(v_self.random_battle_queue_enabled, false) = false
    OR COALESCE(v_self.is_battle, false) = true
    OR v_self.battle_id IS NOT NULL
    OR (v_self.random_battle_cooldown_until IS NOT NULL AND v_self.random_battle_cooldown_until > now())
  THEN
    RETURN jsonb_build_object('matched', false, 'message', 'Stream not eligible');
  END IF;

  SELECT *
    INTO v_opponent
  FROM public.streams
  WHERE id <> p_stream_id
    AND category = 'general'
    AND status = 'live'
    AND COALESCE(random_battle_queue_enabled, false) = true
    AND COALESCE(is_battle, false) = false
    AND battle_id IS NULL
    AND user_id <> p_broadcaster_id
    AND (random_battle_cooldown_until IS NULL OR random_battle_cooldown_until <= now())
  ORDER BY random_battle_queued_at NULLS FIRST, started_at NULLS LAST, created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    UPDATE public.streams
    SET random_battle_queue_enabled = true,
        random_battle_queued_at = COALESCE(random_battle_queued_at, now())
    WHERE id = p_stream_id;

    RETURN jsonb_build_object('matched', false, 'message', 'No opponent available');
  END IF;

  INSERT INTO public.battles (
    challenger_stream_id,
    opponent_stream_id,
    status,
    started_at,
    ends_at,
    score_challenger,
    score_opponent
  )
  VALUES (
    p_stream_id,
    v_opponent.id,
    'active',
    v_started_at,
    v_ends_at,
    0,
    0
  )
  RETURNING id INTO v_battle_id;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  VALUES
    (v_battle_id, v_self.user_id, 'challenger', 'host', v_self.id, 0),
    (v_battle_id, v_opponent.user_id, 'opponent', 'host', v_opponent.id, 0)
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  SELECT v_battle_id, user_id, 'challenger', 'stage', v_self.id, seat_index
  FROM public.stream_seat_sessions
  WHERE stream_id = v_self.id
    AND status = 'active'
    AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  SELECT v_battle_id, user_id, 'opponent', 'stage', v_opponent.id, seat_index
  FROM public.stream_seat_sessions
  WHERE stream_id = v_opponent.id
    AND status = 'active'
    AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  UPDATE public.streams
  SET random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      battle_mode = 'random_queue',
      battle_status = 'starting',
      is_battle = true,
      battle_id = v_battle_id,
      battle_start_time = v_started_at,
      battle_end_time = v_ends_at,
      battle_end_reason = null,
      battle_winner_id = null,
      battle_forfeited_by = null
  WHERE id IN (p_stream_id, v_opponent.id);

  RETURN jsonb_build_object(
    'matched', true,
    'battle_id', v_battle_id,
    'opponent_stream_id', v_opponent.id,
    'opponent_broadcaster_id', v_opponent.user_id,
    'battle_started_at', v_started_at,
    'battle_ends_at', v_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_random_battle_match(uuid, uuid) TO authenticated;

-- ============================================================================
-- Fix 2: extend activate_due_random_battles to also handle troll_battles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.activate_due_random_battles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated integer := 0;
  v_cancelled integer := 0;
  v_battle record;
  v_stale_threshold constant interval := '5 minutes';
BEGIN
  -- 1) Activate due battles from `battles` table (world random battles)
  FOR v_battle IN
    SELECT b.id AS battle_id,
           b.challenger_stream_id AS c_stream,
           b.opponent_stream_id AS o_stream,
           b.started_at
    FROM public.battles b
    JOIN public.streams s ON s.battle_id = b.id
    WHERE s.battle_status = 'starting'
      AND COALESCE(b.status, 'pending') <> 'ended'
      AND (b.started_at IS NULL OR b.started_at <= now())
    FOR UPDATE OF b, s
  LOOP
    UPDATE public.battles
    SET status = 'active',
        started_at = COALESCE(started_at, now())
    WHERE id = v_battle.battle_id
      AND status <> 'active'
      AND status <> 'ended';

    UPDATE public.streams
    SET battle_status = 'active',
        is_battle = true
    WHERE battle_id = v_battle.battle_id
      AND battle_mode = 'random_queue';

    v_activated := v_activated + 1;
  END LOOP;

  -- 1b) Activate due battles from `troll_battles` table (state battles)
  FOR v_battle IN
    SELECT tb.id AS battle_id,
           tb.stream_id AS c_stream,
           tb.stream_id AS o_stream,
           tb.start_time
    FROM public.troll_battles tb
    JOIN public.streams s ON s.battle_id = tb.id
    WHERE s.battle_status = 'starting'
      AND COALESCE(tb.status, 'pending') <> 'ended'
      AND (tb.start_time IS NULL OR tb.start_time <= now())
    FOR UPDATE OF tb, s
  LOOP
    UPDATE public.troll_battles
    SET status = 'active',
        start_time = COALESCE(start_time, now())
    WHERE id = v_battle.battle_id
      AND status <> 'active'
      AND status <> 'ended';

    UPDATE public.streams
    SET battle_status = 'active',
        is_battle = true
    WHERE battle_id = v_battle.battle_id
      AND battle_mode = 'random_queue';

    v_activated := v_activated + 1;
  END LOOP;

  -- 2) Stale recovery for `battles` table
  FOR v_battle IN
    SELECT b.id AS battle_id,
           b.started_at,
           b.challenger_stream_id AS c_stream,
           b.opponent_stream_id AS o_stream
    FROM public.battles b
    JOIN public.streams s ON s.battle_id = b.id
    WHERE s.battle_status = 'starting'
      AND COALESCE(b.status, 'pending') <> 'ended'
    FOR UPDATE OF b, s
  LOOP
    DECLARE
      v_c_stream_live boolean := false;
      v_o_stream_live boolean := false;
      v_is_stale boolean := false;
    BEGIN
      v_is_stale := (v_battle.started_at IS NOT NULL
                     AND v_battle.started_at < (now() - v_stale_threshold));

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status, '') = 'live')
        INTO v_c_stream_live
        FROM public.streams
        WHERE id = v_battle.c_stream;

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status, '') = 'live')
        INTO v_o_stream_live
        FROM public.streams
        WHERE id = v_battle.o_stream;

      IF v_is_stale OR (NOT v_c_stream_live AND NOT v_o_stream_live) THEN
        UPDATE public.battles
        SET status = 'ended',
            ended_at = now()
        WHERE id = v_battle.battle_id
          AND status <> 'ended';

        UPDATE public.streams
        SET is_battle = false,
            battle_status = 'ended',
            battle_end_time = now(),
            battle_end_reason = 'activation_timeout',
            battle_id = NULL,
            random_battle_queue_enabled = false,
            random_battle_queued_at = null,
            random_battle_cooldown_until = now() + interval '20 seconds'
        WHERE id IN (v_battle.c_stream, v_battle.o_stream)
          AND battle_mode = 'random_queue';

        v_cancelled := v_cancelled + 1;
      END IF;
    END;
  END LOOP;

  -- 2b) Stale recovery for `troll_battles` table
  FOR v_battle IN
    SELECT tb.id AS battle_id,
           tb.start_time,
           tb.stream_id AS c_stream,
           tb.stream_id AS o_stream
    FROM public.troll_battles tb
    JOIN public.streams s ON s.battle_id = tb.id
    WHERE s.battle_status = 'starting'
      AND COALESCE(tb.status, 'pending') <> 'ended'
    FOR UPDATE OF tb, s
  LOOP
    DECLARE
      v_c_stream_live boolean := false;
      v_o_stream_live boolean := false;
      v_is_stale boolean := false;
    BEGIN
      v_is_stale := (v_battle.start_time IS NOT NULL
                     AND v_battle.start_time < (now() - v_stale_threshold));

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status, '') = 'live')
        INTO v_c_stream_live
        FROM public.streams
        WHERE id = v_battle.c_stream;

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status, '') = 'live')
        INTO v_o_stream_live
        FROM public.streams
        WHERE id = v_battle.o_stream;

      IF v_is_stale OR (NOT v_c_stream_live AND NOT v_o_stream_live) THEN
        UPDATE public.troll_battles
        SET status = 'ended',
            end_time = now()
        WHERE id = v_battle.battle_id
          AND status <> 'ended';

        UPDATE public.streams
        SET is_battle = false,
            battle_status = 'ended',
            battle_end_time = now(),
            battle_end_reason = 'activation_timeout',
            battle_id = NULL,
            random_battle_queue_enabled = false,
            random_battle_queued_at = null,
            random_battle_cooldown_until = now() + interval '20 seconds'
        WHERE id IN (v_battle.c_stream, v_battle.o_stream)
          AND battle_mode = 'random_queue';

        v_cancelled := v_cancelled + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'activated', v_activated,
    'cancelled', v_cancelled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_due_random_battles() TO authenticated, service_role;

-- Schedule the safety net to run every minute via pg_cron when available.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activate-due-random-battles') THEN
      PERFORM cron.schedule(
        'activate-due-random-battles',
        '* * * * *',
        'SELECT public.activate_due_random_battles()'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available -- schedule activate_due_random_battles() manually (every 30s).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'battle activation cron schedule skipped: %', SQLERRM;
END;
$$;
