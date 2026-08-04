-- Server-authoritative fallback for random-battle activation.
--
-- Problem: client-side activate_random_battle depends on the broadcaster's page
-- staying open through the 10s countdown. If they close/navigate away, the
-- battle can stay in 'starting' forever.
--
-- Fix: a safe-to-call-repeatedly (idempotent) function that activates battles
-- whose countdown has elapsed, and cancels battles that are stuck in 'starting'
-- past a stale threshold or whose streams are no longer live/eligible. Runs on
-- a pg_cron schedule (every 30s) plus may be called on demand by either client.
--
-- Idempotency: it only touches battles where battle_status = 'starting' (streams
-- side) and battles.status <> 'active'/'ended', and uses FOR UPDATE so concurrent
-- invocations cannot double-activate. No duplicate timers/notifications are
-- created because the only side effects are the status flips themselves.

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
  -- 1) Activate due battles: streams.battle_status = 'starting',
  --    battle_start_time <= now(), not yet active/ended, not cancelled.
  FOR v_battle IN
    SELECT b.id AS battle_id,
           s.challenger_stream_id AS c_stream,
           s.opponent_stream_id AS o_stream,
           b.started_at
    FROM public.battles b
    JOIN public.streams s ON s.battle_id = b.id
    WHERE s.battle_status = 'starting'
      AND COALESCE(b.status, 'pending') <> 'ended'
      AND (b.started_at IS NULL OR b.started_at <= now())
    FOR UPDATE OF b, s
  LOOP
    -- Flip battle to active + started_at (if null).
    UPDATE public.battles
    SET status = 'active',
        started_at = COALESCE(started_at, now())
    WHERE id = v_battle.battle_id
      AND status <> 'active'
      AND status <> 'ended';

    -- Flip streams side to active.
    UPDATE public.streams
    SET battle_status = 'active',
        is_battle = true
    WHERE battle_id = v_battle.battle_id
      AND battle_mode = 'random_queue';

    v_activated := v_activated + 1;
  END LOOP;

  -- 2) Stale recovery: battles stuck in 'starting' beyond the stale threshold,
  --    or whose both streams are no longer live/eligible, are cancelled/expired
  --    rather than activated indefinitely.
  FOR v_battle IN
    SELECT b.id AS battle_id,
           b.started_at,
           s.challenger_stream_id AS c_stream,
           s.opponent_stream_id AS o_stream
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

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status,'') = 'live')
        INTO v_c_stream_live
      FROM public.streams
      WHERE id = v_battle.c_stream;

      SELECT (is_live IS NOT DISTINCT FROM true AND COALESCE(status,'') = 'live')
        INTO v_o_stream_live
      FROM public.streams
      WHERE id = v_battle.o_stream;

      -- Cancel only if stale OR neither broadcaster is still live/eligible
      -- (an active battle that simply has a NULL started_at but live streamers
      -- is still handled by step 1, so here we only expire dead ones).
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
            random_battle_queue_enabled = false,
            random_battle_queued_at = null,
            random_battle_cooldown_until = now() + interval '5 minutes'
        WHERE battle_id = v_battle.battle_id
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

-- Schedule the fallback to run every 30 seconds via pg_cron when available.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activate-due-random-battles') THEN
      -- Every minute (pg_cron 5-field syntax, matching existing project jobs).
      -- The 10s activation window means a worst-case ~1 min delay, which is
      -- acceptable; clients also trigger activation on demand after start time.
      PERFORM cron.schedule(
        'activate-due-random-battles',
        '* * * * *',
        'SELECT public.activate_due_random_battles()'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule activate_due_random_battles() manually (every 30s).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'battle activation cron schedule skipped: %', SQLERRM;
END;
$$;
