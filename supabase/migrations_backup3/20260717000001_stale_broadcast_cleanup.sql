-- Server-side stale-session cleanup for broadcasts.
--
-- The browser emits a `broadcast_ended` realtime event and marks the stream ended
-- on every normal shutdown path. But a browser can crash, lose power, or be killed
-- without firing pagehide/beforeunload. This function detects live streams whose
-- heartbeat has stopped for ~45s (well past the 20s client heartbeat window) and
-- marks them ended/disconnected so a crashed browser cannot remain falsely visible
-- as live. It also returns the affected stream ids so a caller (edge function or
-- cron) can fan out the `broadcast_ended` realtime event to the admin monitor.

CREATE OR REPLACE FUNCTION public.cleanup_stale_broadcasts(
  p_stale_after_seconds INTEGER DEFAULT 45
)
RETURNS TABLE (
  stream_id UUID,
  broadcaster_id UUID,
  ended_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := now() - (p_stale_after_seconds || ' seconds')::INTERVAL;

  RETURN QUERY
  WITH stale AS (
    SELECT
      s.id,
      s.user_id,
      now() AS ended_at_ts
    FROM public.streams s
    WHERE s.is_live = true
      AND s.status = 'live'
      AND (
        s.last_heartbeat_at IS NULL
        OR s.last_heartbeat_at < v_cutoff
      )
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.streams s
    SET
      status = 'ended',
      is_live = false,
      ended_at = stale.ended_at_ts,
      rtc_connected = false,
      camera_enabled = false,
      microphone_enabled = false,
      end_reason = 'disconnect',
      last_heartbeat_at = stale.ended_at_ts
    FROM stale
    WHERE s.id = stale.id
    RETURNING s.id, s.user_id, stale.ended_at_ts
  )
  SELECT
    updated.id AS stream_id,
    updated.user_id AS broadcaster_id,
    updated.ended_at_ts AS ended_at
  FROM updated;
END;
$$;

-- Schedule the cleanup to run every minute when pg_cron is available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-broadcasts') THEN
      PERFORM cron.schedule(
        'cleanup-stale-broadcasts',
        '* * * * *',
        'SELECT public.cleanup_stale_broadcasts(45);'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule cleanup_stale_broadcasts manually.';
  END IF;
END $$;
