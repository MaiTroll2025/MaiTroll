-- ============================================================================
-- MAI Record Label Admin Check
-- ============================================================================
-- Provides a reusable RPC/function to check whether the current user is
-- authorized to administer the MAI Record Label. Used by the secretary
-- console and other admin surfaces to gate contract creation and management.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_record_label_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and (
          coalesce(up.is_admin, false)
          or coalesce(up.is_super_admin, false)
          or coalesce(up.is_superadmin, false)
          or coalesce(up.is_ceo, false)
        )
    )
    or exists (
      select 1
      from public.user_profile_roles upr
      where upr.user_id = auth.uid()
        and coalesce(upr.is_active, true) = true
        and lower(upr.role_type) in ('admin', 'super_admin', 'superadmin', 'ceo')
    );
$function$;
