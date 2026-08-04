-- Treat executive secretary roles like secretary for bug center staff surfaces (finance RPC, reads).

CREATE OR REPLACE FUNCTION public.is_bug_center_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        role IN (
          'admin', 'superadmin', 'ceo', 'moderator',
          'lead_troll_officer', 'troll_officer', 'secretary',
          'executive_secretary', 'troll_city_secretary'
        )
        OR troll_role IN (
          'admin', 'superadmin', 'ceo', 'moderator',
          'lead_troll_officer', 'troll_officer', 'secretary',
          'executive_secretary', 'troll_city_secretary'
        )
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_lead_officer, false) = true
        OR COALESCE(is_troll_officer, false) = true
        OR COALESCE(is_secretary, false) = true
      )
  );
$$;
