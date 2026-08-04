-- ============================================================================
-- Migration: repair_diagnostics_backend
-- Creates/repairs the bug center and diagnostic system
-- Applied: 2026-07-30
-- ============================================================================

-- Ensure system_errors has all required columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'frontend_route'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN frontend_route text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'frontend_file'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN frontend_file text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'user_role'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN user_role text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN stream_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'error_code'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN error_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'error_details'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN error_details jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'browser_info'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN browser_info jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN status text DEFAULT 'open'
      CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'severity'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN severity text DEFAULT 'medium'
      CHECK (severity IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'resolution_notes'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN resolution_notes text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_errors_status ON public.system_errors(status);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON public.system_errors(severity);
CREATE INDEX IF NOT EXISTS idx_system_errors_frontend_route ON public.system_errors(frontend_route);
CREATE INDEX IF NOT EXISTS idx_system_errors_user_role ON public.system_errors(user_role);

-- Ensure app_bug_reports has proper RLS for admin review
ALTER TABLE public.app_bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all bug reports"
  ON public.app_bug_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (is_admin OR is_troll_officer OR role = 'admin')
  ));

CREATE POLICY "Users can view own bug reports"
  ON public.app_bug_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert bug reports"
  ON public.app_bug_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update bug reports"
  ON public.app_bug_reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (is_admin OR is_troll_officer OR role = 'admin')
  ));

-- Ensure log_app_bug_report RPC exists and is callable
GRANT EXECUTE ON FUNCTION public.log_app_bug_report TO authenticated;