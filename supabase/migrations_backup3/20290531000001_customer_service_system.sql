-- ============================================================
-- CUSTOMER SERVICE SYSTEM
-- CEO-only customer service dashboard tables, RLS, and RPCs
-- ============================================================

-- 1. Customer Service Audit Logs
CREATE TABLE IF NOT EXISTS public.customer_service_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Admin Password Resets
CREATE TABLE IF NOT EXISTS public.admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reset_method TEXT NOT NULL DEFAULT 'email_reset_link',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User Presence Routes (current page tracking)
CREATE TABLE IF NOT EXISTS public.user_presence_routes (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  current_path TEXT,
  current_title TEXT,
  session_id TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Support Screen Sessions
CREATE TABLE IF NOT EXISTS public.support_screen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','active','ended','declined','expired')),
  livekit_room_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_csal_actor_id ON public.customer_service_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_csal_target_user_id ON public.customer_service_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_csal_action ON public.customer_service_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_csal_created_at ON public.customer_service_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apr_target_user_id ON public.admin_password_resets(target_user_id);
CREATE INDEX IF NOT EXISTS idx_apr_requested_by ON public.admin_password_resets(requested_by);
CREATE INDEX IF NOT EXISTS idx_upr_last_seen ON public.user_presence_routes(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_upr_current_path ON public.user_presence_routes(current_path);
CREATE INDEX IF NOT EXISTS idx_sss_target_user_id ON public.support_screen_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_sss_status ON public.support_screen_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sss_requested_by ON public.support_screen_sessions(requested_by);

-- 6. is_admin() helper function (includes admin and CEO roles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.is_admin = true
        OR lower(coalesce(up.role, '')) IN ('admin', 'ceo')
      )
  );
$$;

-- 7. Enable RLS
ALTER TABLE public.customer_service_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_screen_sessions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for customer_service_audit_logs
DROP POLICY IF EXISTS "admin can read customer service audit logs" ON public.customer_service_audit_logs;
CREATE POLICY "admin can read customer service audit logs"
  ON public.customer_service_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin can insert customer service audit logs" ON public.customer_service_audit_logs;
CREATE POLICY "admin can insert customer service audit logs"
  ON public.customer_service_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND actor_id = auth.uid());

-- 9. RLS Policies for admin_password_resets
DROP POLICY IF EXISTS "admin can read admin password resets" ON public.admin_password_resets;
CREATE POLICY "admin can read admin password resets"
  ON public.admin_password_resets
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin can insert admin password resets" ON public.admin_password_resets;
CREATE POLICY "admin can insert admin password resets"
  ON public.admin_password_resets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND requested_by = auth.uid());

-- 10. RLS Policies for user_presence_routes
DROP POLICY IF EXISTS "users can upsert own route presence" ON public.user_presence_routes;
CREATE POLICY "users can upsert own route presence"
  ON public.user_presence_routes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin can read all route presence" ON public.user_presence_routes;
CREATE POLICY "admin can read all route presence"
  ON public.user_presence_routes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Also allow users to read their own presence
DROP POLICY IF EXISTS "users can read own route presence" ON public.user_presence_routes;
CREATE POLICY "users can read own route presence"
  ON public.user_presence_routes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 11. RLS Policies for support_screen_sessions
DROP POLICY IF EXISTS "admin can manage support screen sessions" ON public.support_screen_sessions;
CREATE POLICY "admin can manage support screen sessions"
  ON public.support_screen_sessions
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR target_user_id = auth.uid())
  WITH CHECK (public.is_admin() OR target_user_id = auth.uid());

-- 12. Grant permissions
GRANT SELECT, INSERT ON public.customer_service_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.admin_password_resets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_presence_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_screen_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
