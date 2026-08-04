-- ============================================================
-- XTROLLZ CORE TABLES
-- ============================================================

BEGIN;

-- Applications table
CREATE TABLE IF NOT EXISTS public.xtrollz_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_first_name text NOT NULL,
  legal_last_name text NOT NULL,
  date_of_birth date NOT NULL,
  troll_city_username text NOT NULL,
  troll_city_user_id uuid NOT NULL REFERENCES auth.users(id),
  email text NOT NULL,
  country text NOT NULL,
  state_province text NOT NULL,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'draft',
  payment_status text NOT NULL DEFAULT 'pending',
  paypal_order_id text,
  paypal_capture_id text,
  payment_amount numeric(10,2),
  payment_currency text DEFAULT 'USD',
  payment_timestamp timestamptz,
  reviewer_id uuid REFERENCES auth.users(id),
  reviewer_notes text,
  denial_reason text,
  approval_timestamp timestamptz,
  last_status_change timestamptz NOT NULL DEFAULT now(),
  rules_version_accepted text,
  age_agreement_version text,
  security_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_applications_user_id
ON public.xtrollz_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_applications_status
ON public.xtrollz_applications(status);

ALTER TABLE public.xtrollz_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz applications"
ON public.xtrollz_applications;

CREATE POLICY "Users can view own XTrollz applications"
ON public.xtrollz_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_applications
TO authenticated;

GRANT ALL
ON public.xtrollz_applications
TO service_role;

-- Streams table
CREATE TABLE IF NOT EXISTS public.xtrollz_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  is_private boolean NOT NULL DEFAULT false,
  password_hash text,
  password_created_at timestamptz,
  password_updated_at timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  viewer_count integer NOT NULL DEFAULT 0,
  total_likes integer NOT NULL DEFAULT 0,
  xcoin_earnings numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_streams_user_id
ON public.xtrollz_streams(user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_streams_is_live
ON public.xtrollz_streams(is_live);

ALTER TABLE public.xtrollz_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Users can view public XTrollz streams"
ON public.xtrollz_streams
FOR SELECT
TO authenticated
USING (is_private = false OR user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_streams
TO authenticated;

GRANT ALL
ON public.xtrollz_streams
TO service_role;

-- Moderation actions table
CREATE TABLE IF NOT EXISTS public.xtrollz_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.xtrollz_streams(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  reason text,
  target_user_id uuid REFERENCES auth.users(id),
  moderator_id uuid NOT NULL REFERENCES auth.users(id),
  moderator_role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_moderation_actions_user_id
ON public.xtrollz_moderation_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_moderation_actions_stream_id
ON public.xtrollz_moderation_actions(stream_id);

ALTER TABLE public.xtrollz_moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz moderation actions"
ON public.xtrollz_moderation_actions;

CREATE POLICY "Users can view own XTrollz moderation actions"
ON public.xtrollz_moderation_actions
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR target_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_moderation_actions
TO authenticated;

GRANT ALL
ON public.xtrollz_moderation_actions
TO service_role;

-- Staff monitoring table
CREATE TABLE IF NOT EXISTS public.xtrollz_staff_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.xtrollz_streams(id) ON DELETE CASCADE,
  entry_timestamp timestamptz NOT NULL DEFAULT now(),
  exit_timestamp timestamptz,
  monitoring_reason text,
  private_bypass_used boolean NOT NULL DEFAULT false,
  moderation_actions_performed jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_staff_monitoring_stream_id
ON public.xtrollz_staff_monitoring(stream_id);

ALTER TABLE public.xtrollz_staff_monitoring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own monitoring records"
ON public.xtrollz_staff_monitoring;

CREATE POLICY "Staff can view own monitoring records"
ON public.xtrollz_staff_monitoring
FOR SELECT
TO authenticated
USING (staff_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_staff_monitoring
TO authenticated;

GRANT ALL
ON public.xtrollz_staff_monitoring
TO service_role;

-- Access logs table
CREATE TABLE IF NOT EXISTS public.xtrollz_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type text NOT NULL,
  access_result text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_access_logs_user_id
ON public.xtrollz_access_logs(user_id);

ALTER TABLE public.xtrollz_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz access logs"
ON public.xtrollz_access_logs;

CREATE POLICY "Users can view own XTrollz access logs"
ON public.xtrollz_access_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT
ON public.xtrollz_access_logs
TO authenticated;

GRANT ALL
ON public.xtrollz_access_logs
TO service_role;

-- Security events table
CREATE TABLE IF NOT EXISTS public.xtrollz_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_security_events_user_id
ON public.xtrollz_security_events(user_id);

ALTER TABLE public.xtrollz_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz security events"
ON public.xtrollz_security_events;

CREATE POLICY "Users can view own XTrollz security events"
ON public.xtrollz_security_events
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT
ON public.xtrollz_security_events
TO authenticated;

GRANT ALL
ON public.xtrollz_security_events
TO service_role;

-- Reports table
CREATE TABLE IF NOT EXISTS public.xtrollz_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.xtrollz_streams(id) ON DELETE SET NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_reports_target_user_id
ON public.xtrollz_reports(target_user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_reports_stream_id
ON public.xtrollz_reports(stream_id);

ALTER TABLE public.xtrollz_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz reports"
ON public.xtrollz_reports;

CREATE POLICY "Users can view own XTrollz reports"
ON public.xtrollz_reports
FOR SELECT
TO authenticated
USING (reporter_id = auth.uid() OR target_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE
ON public.xtrollz_reports
TO authenticated;

GRANT ALL
ON public.xtrollz_reports
TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
