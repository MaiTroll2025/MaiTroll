-- Create app_bug_reports table
CREATE TABLE IF NOT EXISTS public.app_bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fixed', 'ignored')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT NOT NULL,
  page_url TEXT,
  route_path TEXT,
  user_id UUID NULL,
  user_email TEXT NULL,
  user_role TEXT NULL,
  stream_id UUID NULL,
  function_name TEXT NULL,
  table_name TEXT NULL,
  error_code TEXT NULL,
  error_message TEXT NOT NULL,
  error_details TEXT NULL,
  error_hint TEXT NULL,
  stack_trace TEXT NULL,
  request_payload JSONB NULL,
  response_payload JSONB NULL,
  browser_info JSONB NULL,
  app_context JSONB NULL,
  fixed_note TEXT NULL,
  fixed_by UUID NULL,
  fixed_at TIMESTAMPTZ NULL,
  occurrence_count INTEGER DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.app_bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON public.app_bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_source ON public.app_bug_reports(source);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at_desc ON public.app_bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.app_bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_stream_id ON public.app_bug_reports(stream_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_error_code ON public.app_bug_reports(error_code);
-- Composite index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_bug_reports_duplicate_check ON public.app_bug_reports(source, route_path, error_message, status, last_seen_at);

-- Enable RLS
ALTER TABLE public.app_bug_reports ENABLE ROW LEVEL SECURITY;

-- Policy: users can insert their own bug reports (or anonymous if no user)
CREATE POLICY "Users can insert own bug reports"
  ON public.app_bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Policy: admins can read all bug reports
CREATE POLICY "Admins can read all bug reports"
  ON public.app_bug_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'superadmin' OR troll_role = 'admin' OR troll_role = 'superadmin')
    )
  );

-- Policy: admins can update bug reports
CREATE POLICY "Admins can update bug reports"
  ON public.app_bug_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'superadmin' OR troll_role = 'admin' OR troll_role = 'superadmin')
    )
  );

-- Policy: admins can delete bug reports
CREATE POLICY "Admins can delete bug reports"
  ON public.app_bug_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'superadmin' OR troll_role = 'admin' OR troll_role = 'superadmin')
    )
  );

-- Grant service role full access
GRANT ALL ON public.app_bug_reports TO supabase_storage_admin;
GRANT ALL ON public.app_bug_reports TO service_role;
