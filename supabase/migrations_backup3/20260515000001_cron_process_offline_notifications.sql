-- ============================================================================
-- CRON JOB: Process offline push notifications every minute
-- ============================================================================
-- Prerequisites: 
--   1. pg_net and pg_cron extensions must be enabled
--   2. offline_notifications table must exist
--   3. process-offline-notifications Edge Function must be deployed
-- ============================================================================

-- Enable required extensions (run once)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Schedule the cron job
-- NOTE: Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
select cron.schedule(
  'process-offline-push-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/process-offline-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'limit', 25
    )
  );
  $$
);

-- ============================================================================
-- To unschedule (if needed):
-- select cron.unschedule('process-offline-push-notifications-every-minute');
-- ============================================================================