-- Migration: Remove stream auto-end inactivity system
-- Drops the pg_cron job, RPC functions, and the last_activity_at column
-- that were used to automatically end streams with no chat/gift activity.

-- Drop the pg_cron job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-inactive-streams') THEN
      PERFORM cron.unschedule('auto-end-inactive-streams');
    END IF;
  END IF;
END $$;

-- Drop RPC functions
DROP FUNCTION IF EXISTS public.auto_end_inactive_streams(INT);
DROP FUNCTION IF EXISTS public.is_staff_broadcaster(UUID);
DROP FUNCTION IF EXISTS public.update_stream_last_activity(UUID);

-- Drop the index on last_activity_at
DROP INDEX IF EXISTS idx_streams_last_activity_at;

-- Drop the last_activity_at column from streams
ALTER TABLE streams DROP COLUMN IF EXISTS last_activity_at;
