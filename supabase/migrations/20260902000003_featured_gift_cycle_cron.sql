-- ============================================================
-- MaiTroll Featured Gift Cycle Cron
-- Advances the featured gift every 1 minute.
-- Requires pg_cron extension.
-- ============================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;

-- Drop existing job if present to allow re-runs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'advance_featured_gift_cycle'
  ) THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'advance_featured_gift_cycle';
    DELETE FROM cron.job WHERE jobname = 'advance_featured_gift_cycle';
  END IF;
END
$$;

SELECT cron.schedule(
  'advance_featured_gift_cycle',
  '* * * * *',
  $$SELECT public.advance_featured_gift_cycle();$$
);
