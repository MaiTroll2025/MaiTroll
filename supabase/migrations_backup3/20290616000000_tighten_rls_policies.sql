-- ============================================================
-- Tighten RLS on system_errors, system_roles, user_role_grants
-- Uses SECURITY DEFINER helper to avoid policy recursion
-- ============================================================

-- Helper: check if caller is staff/admin (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR is_troll_officer = true
      OR role IN ('admin', 'secretary')
    )
  );
$$;

-- ============================================================
-- 1. system_errors: Replace overly permissive INSERT policy
-- Remove: WITH CHECK (true) — any authenticated user could insert anything
-- Add: Require message IS NOT NULL, user_id must match caller (if set)
-- Note: created_at has DEFAULT now(), so we don't check it (would fail
--       because WITH CHECK runs before defaults are applied)
-- ============================================================

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.system_errors;

CREATE POLICY "Users can insert error logs"
ON public.system_errors
FOR INSERT
TO authenticated
WITH CHECK (
  message IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- ============================================================
-- 2. system_roles: Only staff/admin can read role definitions
-- Remove: USING (true) — everyone could see all role definitions
-- ============================================================

DROP POLICY IF EXISTS "Public read system roles" ON public.system_roles;

CREATE POLICY "Only staff can read system roles"
ON public.system_roles
FOR SELECT
TO authenticated
USING (public.is_staff());

-- ============================================================
-- 3. user_role_grants: Only staff can read all grants; users can read own
-- Remove: USING (true) — everyone could see who has what role
-- Add: Staff can see all; regular users can only see their own grants
-- ============================================================

DROP POLICY IF EXISTS "Public read role grants" ON public.user_role_grants;

-- Staff can read all role grants
CREATE POLICY "Staff can read all role grants"
ON public.user_role_grants
FOR SELECT
TO authenticated
USING (public.is_staff());

-- Users can read their own role grants
CREATE POLICY "Users can read their own role grants"
ON public.user_role_grants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
