-- Restore public.is_staff(uuid) for policies and RPCs that pass auth.uid()
-- explicitly. Keep the no-argument caller-based overload for newer code.

CREATE OR REPLACE FUNCTION public.is_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND up.banned_at IS NULL
      AND (up.suspended_until IS NULL OR up.suspended_until < now())
      AND (
        up.is_admin = true
        OR up.is_lead_officer = true
        OR up.is_troll_officer = true
        OR up.role IN ('admin', 'officer', 'lead_officer', 'secretary', 'pastor', 'temp_city_admin')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_role_grants urg
    JOIN public.system_roles sr ON sr.id = urg.role_id
    WHERE urg.user_id = p_user_id
      AND sr.is_staff = true
      AND urg.revoked_at IS NULL
      AND (urg.expires_at IS NULL OR urg.expires_at > now())
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND up.staff_override_until IS NOT NULL
      AND up.staff_override_until > now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;
