-- ============================================================================
-- Random Battle Activation Safety Net
-- ============================================================================
-- Problem: The random battle queue relies on the broadcaster's browser tab
-- staying open through a 10s client-side countdown to call activate_random_battle.
-- If the tab is backgrounded/closed, the broadcaster navigates away, or the
-- client-side activate_random_battle call races the `started_at > now()` guard
-- ("Countdown still running"), the battle is left stuck in 'starting'/'pending'
-- forever. Stuck broadcasters carry is_battle=true / a non-null battle_id, which
-- find_random_battle_match excludes from ever being matched again -- so the
-- opponent pool drains and new queues fall through to "Searching for Random
-- Opponent" / "Finding a worthy challenger..." indefinitely (never starts).
--
-- Fix: a server-authoritative, idempotent function that:
--   1) activates any random-queue battle whose 10s countdown has elapsed
--      (started_at <= now()), and
--   2) cancels battles that are stale or whose streams are no longer live,
--      resetting them with a short cooldown so they can re-queue.
-- It runs on a pg_cron schedule every minute and may also be called on demand
-- by the client as a fallback. Only touches battles where battle_status =
-- 'starting' and the battle is not already active/ended, using FOR UPDATE so
-- concurrent invocations cannot double-activate.
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
  -- 1) Activate due battles: stream battle_status = 'starting',
  --    battle_start_time / started_at <= now(), not yet active/ended.
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

  -- 2) Stale recovery: battles stuck in 'starting' beyond the stale threshold,
  --    or whose streamers are no longer live/eligible, are cancelled/expired
  --    rather than left pending forever.
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
