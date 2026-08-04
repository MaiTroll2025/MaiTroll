-- ============================================================================
-- Migration: fix_family_members_rls_recursion
-- Fixes infinite recursion in family_members RLS policies
-- The self-referencing policies on family_members cause infinite recursion
-- when other tables (e.g. family_invites) query family_members in their
-- own RLS policies. This migration replaces them with SECURITY DEFINER
-- helper functions that bypass RLS.
-- Applied: 2026-07-30
-- ============================================================================

-- 1. Create SECURITY DEFINER helper functions to bypass RLS for membership checks
-- These functions run as the table owner, avoiding the RLS loop

CREATE OR REPLACE FUNCTION public.is_family_member_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members
    WHERE family_id = p_family_id
    AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_leader_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members
    WHERE family_id = p_family_id
    AND user_id = p_user_id
    AND role = 'leader'
  );
$$;

-- 2. Drop the recursive policies on family_members
DROP POLICY IF EXISTS "Family leaders can view all members" ON public.family_members;
DROP POLICY IF EXISTS "Family leaders can update member roles" ON public.family_members;

-- 3. Recreate non-recursive policies using the secure helper functions

-- Allow users to view their own membership OR any member if they are a family leader
CREATE POLICY "Family leaders can view all members"
  ON public.family_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );

-- Allow users to update their own membership OR any member if they are a family leader
CREATE POLICY "Family leaders can update member roles"
  ON public.family_members FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );

-- 4. Fix family_members_extended policies that also self-reference family_members
DROP POLICY IF EXISTS "Family leaders can view all extended profiles" ON public.family_members_extended;

CREATE POLICY "Family leaders can view all extended profiles"
  ON public.family_members_extended FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );
