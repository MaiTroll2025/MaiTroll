-- ============================================================
-- XTROLLZ ADMIN RLS POLICIES
-- Fix: allow staff/admins to view and manage all XTrollz
-- applications, streams, and moderation actions.
-- ============================================================

BEGIN;

-- xtrollz_applications
DROP POLICY IF EXISTS "Admins can manage all XTrollz applications"
ON public.xtrollz_applications;

CREATE POLICY "Admins can manage all XTrollz applications"
ON public.xtrollz_applications
FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can update XTrollz applications"
ON public.xtrollz_applications;

CREATE POLICY "Admins can update XTrollz applications"
ON public.xtrollz_applications
FOR UPDATE
TO authenticated
USING (public.is_staff());

-- xtrollz_streams
DROP POLICY IF EXISTS "Admins can view all XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Admins can view all XTrollz streams"
ON public.xtrollz_streams
FOR SELECT
TO authenticated
USING (public.is_staff());

-- xtrollz_moderation_actions
DROP POLICY IF EXISTS "Admins can view all XTrollz moderation actions"
ON public.xtrollz_moderation_actions;

CREATE POLICY "Admins can view all XTrollz moderation actions"
ON public.xtrollz_moderation_actions
FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can insert XTrollz moderation actions"
ON public.xtrollz_moderation_actions;

CREATE POLICY "Admins can insert XTrollz moderation actions"
ON public.xtrollz_moderation_actions
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff());

-- xtrollz_staff_monitoring
DROP POLICY IF EXISTS "Admins can view all XTrollz staff monitoring"
ON public.xtrollz_staff_monitoring;

CREATE POLICY "Admins can view all XTrollz staff monitoring"
ON public.xtrollz_staff_monitoring
FOR SELECT
TO authenticated
USING (public.is_staff());

-- xtrollz_access_logs
DROP POLICY IF EXISTS "Admins can view all XTrollz access logs"
ON public.xtrollz_access_logs;

CREATE POLICY "Admins can view all XTrollz access logs"
ON public.xtrollz_access_logs
FOR SELECT
TO authenticated
USING (public.is_staff());

-- xtrollz_security_events
DROP POLICY IF EXISTS "Admins can view all XTrollz security events"
ON public.xtrollz_security_events;

CREATE POLICY "Admins can view all XTrollz security events"
ON public.xtrollz_security_events
FOR SELECT
TO authenticated
USING (public.is_staff());

-- xtrollz_reports
DROP POLICY IF EXISTS "Admins can view all XTrollz reports"
ON public.xtrollz_reports;

CREATE POLICY "Admins can view all XTrollz reports"
ON public.xtrollz_reports
FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "Admins can update XTrollz reports"
ON public.xtrollz_reports;

CREATE POLICY "Admins can update XTrollz reports"
ON public.xtrollz_reports
FOR UPDATE
TO authenticated
USING (public.is_staff());

COMMIT;

NOTIFY pgrst, 'reload schema';
