-- ============================================================
-- XTROLLZ RLS POLICIES
-- Secures access to XTrollz streams, favorites, and access checks.
-- ============================================================

BEGIN;

-- xtrollz_streams: allow approved users to view public live streams
DROP POLICY IF EXISTS "Approved users can view live XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Approved users can view live XTrollz streams"
ON public.xtrollz_streams
FOR SELECT
TO authenticated
USING (
  is_private = false
  AND status = 'live'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.age_verified = true
    AND up.identity_verified = true
    AND up.xtrollz_access_status IN ('approved')
    AND up.is_banned = false
    AND up.account_state NOT IN ('banned', 'jailed')
  )
);

-- xtrollz_streams: streamers can view their own streams
DROP POLICY IF EXISTS "Streamers can view own XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Streamers can view own XTrollz streams"
ON public.xtrollz_streams
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- xtrollz_streams: streamers can insert their own streams
DROP POLICY IF EXISTS "Streamers can insert own XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Streamers can insert own XTrollz streams"
ON public.xtrollz_streams
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- xtrollz_streams: streamers can update their own streams
DROP POLICY IF EXISTS "Streamers can update own XTrollz streams"
ON public.xtrollz_streams;

CREATE POLICY "Streamers can update own XTrollz streams"
ON public.xtrollz_streams
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- xtrollz_favorites: users can view their own favorites
DROP POLICY IF EXISTS "Users can view own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can view own XTrollz favorites"
ON public.xtrollz_favorites
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- xtrollz_favorites: users can insert their own favorites
DROP POLICY IF EXISTS "Users can insert own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can insert own XTrollz favorites"
ON public.xtrollz_favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- xtrollz_favorites: users can delete their own favorites
DROP POLICY IF EXISTS "Users can delete own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can delete own XTrollz favorites"
ON public.xtrollz_favorites
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- xtrollz_rules_acceptance: users can view their own
DROP POLICY IF EXISTS "Users can view own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance;

CREATE POLICY "Users can view own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- xtrollz_rules_acceptance: users can insert their own
DROP POLICY IF EXISTS "Users can insert own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance;

CREATE POLICY "Users can insert own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- user_profiles: allow service_role to update xtrollz fields
-- (already covered by broader policies, but ensure these specific columns are updatable)
-- Note: existing user_profiles RLS policies should already allow users to update their own profile

COMMIT;

NOTIFY pgrst, 'reload schema';
