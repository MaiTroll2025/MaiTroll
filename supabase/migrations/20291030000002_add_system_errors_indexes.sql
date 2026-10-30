-- Add indexes to system_errors to prevent statement timeouts on large tables
CREATE INDEX IF NOT EXISTS system_errors_created_at_idx
  ON public.system_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS system_errors_status_created_at_idx
  ON public.system_errors (status, created_at DESC);
