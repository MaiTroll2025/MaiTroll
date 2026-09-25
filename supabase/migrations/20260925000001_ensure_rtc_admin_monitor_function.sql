-- Ensure can_access_rtc_admin_monitor exists.
--
-- Migration 20260922000000_troll_time.sql originally defined this function,
-- but a malformed duplicate body (missing CREATE OR REPLACE FUNCTION header)
-- caused the migration to fail, so the function was never created on the
-- live database. As a result, the RPC call errored out and both the web
-- gate (RtcAdminMonitorGate) and the phone gate (PhoneRtcAdminMonitor)
-- treated the error as "denied" — blocking admins from the RTC Admin Monitor.
--
-- This migration is idempotent (CREATE OR REPLACE) so it is safe to run
-- whether or not the function already exists.

CREATE OR REPLACE FUNCTION public.can_access_rtc_admin_monitor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_grant_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Admin / platform owner roles always have access.
  IF v_profile.is_admin = true
     OR v_profile.is_superadmin = true
     OR v_profile.role IN ('admin','superadmin','ceo','owner')
     OR v_profile.troll_role IN ('admin','superadmin','ceo','owner')
  THEN
    RETURN true;
  END IF;

  -- Web route roles (mirrors App.tsx /rtcadminmonitor RequireRole list).
  IF v_profile.role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
     OR v_profile.troll_role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
  THEN
    RETURN true;
  END IF;

  -- Career roles require an explicit, non-expired grant.
  SELECT COUNT(*) INTO v_grant_count
  FROM public.user_rtc_admin_monitor_grants
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());

  RETURN v_grant_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_rtc_admin_monitor(UUID) TO authenticated, service_role;