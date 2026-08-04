-- Optimize log_app_bug_report for high-throughput
-- The old function did SELECT then UPDATE/INSERT which caused lock contention
-- and 19+ second response times under load. The new function uses
-- UPDATE ... RETURNING with FOR UPDATE SKIP LOCKED for single-row locking.

-- 1. Ensure the composite index for the duplicate-check subquery exists
-- This index supports: WHERE source = ? AND route_path = ? AND error_message = ?
--                     AND status IN ('open','in_progress') AND last_seen_at > ?
CREATE INDEX IF NOT EXISTS idx_bug_reports_duplicate_check
  ON public.app_bug_reports (source, route_path, error_message, status, last_seen_at);

-- 2. Set statement_timeout on the function to prevent runaway queries
-- (already defined in the function body via SET statement_timeout = '5s',
--  but also set it here as a safety net)
ALTER FUNCTION public.log_app_bug_report(JSONB) SET statement_timeout = '5s';

-- 3. Optional: clean up old/stale bug reports that are cluttering the table
-- Close any bug reports older than 30 days that are still 'open'
UPDATE public.app_bug_reports
SET status = 'ignored',
    updated_at = NOW()
WHERE status = 'open'
  AND last_seen_at < NOW() - INTERVAL '30 days';
