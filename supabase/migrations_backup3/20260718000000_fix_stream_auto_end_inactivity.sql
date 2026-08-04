-- Migration: Fix inactivity-based stream auto-end.
--
-- Problem being fixed:
--   * Streams were ending "before they fully started". The previous
--     `auto_end_inactive_streams` treated `last_activity_at IS NULL` as inactive
--     and ended the stream on the very first cron pass, because a freshly-live
--     stream has no activity yet.
--   * The heartbeat-based `cleanup_stale_broadcasts` job (every minute, 45s
--     window) also ended healthy streams whenever the broadcaster's tab was
--     backgrounded (browsers throttle timers, so the heartbeat lapses).
--   * Neither mechanism exempted admin / staff broadcasts.
--
-- New behaviour (matches product requirement):
--   * A stream auto-ends only after N minutes (default 3) with NO chat AND NO
--     gifts. Any chat message or gift bumps `last_activity_at`.
--   * A brand-new stream is given the full grace window: when
--     `last_activity_at` is NULL we fall back to `started_at` / `created_at`,
--     so a stream can never be ended before it has been live for N minutes.
--   * Admin and staff (officers, secretary, president, moderators, etc.)
--     broadcasts are NEVER auto-ended.
--   * The fragile heartbeat-based `cleanup_stale_broadcasts` cron is removed so
--     backgrounded broadcaster tabs no longer kill live streams.

-- ---------------------------------------------------------------------------
-- 1. Activity bump: seed last_activity_at so the grace window is deterministic.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_stream_last_activity(p_stream_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streams
  SET last_activity_at = NOW()
  WHERE id = p_stream_id
    AND is_live = true
    AND status = 'live';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Staff detection helper (mirrors src/lib/userUtils.ts isStaffUser).
--    Admin + staff broadcasts are exempt from auto-end.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_broadcaster(p_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        up.is_admin = true
        OR up.is_troll_officer = true
        OR up.is_lead_officer = true
        OR LOWER(COALESCE(up.role, '')) IN (
          'admin', 'owner', 'secretary', 'moderator',
          'lead_troll_officer', 'troll_officer',
          'agency_hr', 'agency_hr_manager', 'hr_admin',
          'temp_city_admin', 'temp_admin',
          'executive_secretary', 'troll_city_secretary',
          'troll_city_treasurer', 'president', 'vice_president', 'ceo'
        )
        OR LOWER(COALESCE(up.troll_role, '')) IN (
          'secretary', 'lead_officer', 'owner', 'admin',
          'moderator', 'pastor', 'troll_officer', 'president'
        )
      FROM public.user_profiles up
      WHERE up.id = p_user_id
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Auto-end inactive streams (called by cron every minute).
--    * NULL last_activity_at falls back to started_at / created_at (grace).
--    * Admin / staff broadcasts are never ended.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_end_inactive_streams(inactivity_minutes INT DEFAULT 3)
RETURNS TABLE(ended_stream_id UUID, broadcaster_id UUID, last_activity TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (inactivity_minutes || ' minutes')::INTERVAL;

  RETURN QUERY
  WITH ended AS (
    UPDATE public.streams s
    SET
      is_live = false,
      status = 'ended',
      ended_at = NOW(),
      end_reason = 'auto',
      updated_at = NOW()
    WHERE s.is_live = true
      AND s.status = 'live'
      -- Never auto-end admin / staff broadcasts.
      AND NOT public.is_staff_broadcaster(COALESCE(s.broadcaster_id, s.user_id))
      -- Effective "last activity" for grace: real activity, else when the
      -- stream started, else when the row was created. This guarantees a fresh
      -- stream gets the full inactivity window before it can ever be ended.
      AND COALESCE(s.last_activity_at, s.started_at, s.created_at) < v_cutoff
    RETURNING s.id, s.broadcaster_id, s.last_activity_at
  )
  SELECT ended.id, ended.broadcaster_id, ended.last_activity_at FROM ended;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cron wiring.
--    * Schedule the inactivity auto-end every minute (3-minute window).
--    * Remove the heartbeat-based stale cleanup that was prematurely ending
--      healthy streams whose broadcaster tab was backgrounded.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop the fragile heartbeat cleanup job if it exists.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-broadcasts') THEN
      PERFORM cron.unschedule('cleanup-stale-broadcasts');
    END IF;

    -- (Re)schedule the inactivity auto-end.
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-inactive-streams') THEN
      PERFORM cron.schedule(
        'auto-end-inactive-streams',
        '* * * * *',
        'SELECT public.auto_end_inactive_streams(3);'
      );
    END IF;
  ELSE
    RAISE NOTICE 'pg_cron not available - schedule auto_end_inactive_streams(3) manually.';
  END IF;
END $$;
