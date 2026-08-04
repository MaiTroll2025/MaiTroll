-- P1 Reliability Fix: Schedule Gift Ledger Batch (Every 10 seconds)
-- Removed pg_sleep to prevent blocking. Batch processor runs every minute via single job.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs if any to avoid duplicates
DO $$
BEGIN
    PERFORM cron.unschedule('process_gifts_00');
    PERFORM cron.unschedule('process_gifts_10');
    PERFORM cron.unschedule('process_gifts_20');
    PERFORM cron.unschedule('process_gifts_30');
    PERFORM cron.unschedule('process_gifts_40');
    PERFORM cron.unschedule('process_gifts_50');
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
END $$;

-- Single job running every minute (not every 10s) to prevent DB blocking
-- Batch processor handles SKIP LOCKED for safe parallelism
SELECT cron.schedule('process_gifts', '*/1 * * * *', $$SELECT public.process_gift_ledger_batch()$$);
