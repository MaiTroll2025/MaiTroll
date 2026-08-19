-- Migration: Allow broadcasters to use Mod Actions
-- Description: Updates is_modo_role() to also return true for users with
--              is_broadcaster=true in user_profiles, so stream owners can
--              use mod actions even if their role/troll_role fields don't
--              match the expected role strings.

CREATE OR REPLACE FUNCTION public.is_modo_role(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        LOWER(COALESCE(role, '')) IN (
          'ceo','admin','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
        OR LOWER(COALESCE(troll_role, '')) IN (
          'ceo','admin','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
        OR is_broadcaster = true
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_modo_role(uuid) TO authenticated, service_role;
