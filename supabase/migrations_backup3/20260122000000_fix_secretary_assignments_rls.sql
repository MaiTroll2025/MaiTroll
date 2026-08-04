-- Fix RLS conflict on secretary_assignments
-- The deny_all policy was blocking admin insertions despite the "Admin can manage secretaries" policy
-- Remove deny_all and rely on the more granular policies

DROP POLICY IF EXISTS "deny_all" ON public.secretary_assignments;
