-- =============================================================================
-- Fix: Public read access for user_profiles
-- -----------------------------------------------------------------------------
-- Problem: The universal RLS system only allows users to read their OWN profile
-- (id = auth.uid()), which blocks all public profile viewing. This causes
-- cover photos, avatars, and all other profile data to be invisible to other
-- users.
--
-- Fix: Add a public/anonymous read policy so anyone can view user_profiles.
-- =============================================================================

DROP POLICY IF EXISTS "Public can read user_profiles" ON public.user_profiles;

CREATE POLICY "Public can read user_profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);
