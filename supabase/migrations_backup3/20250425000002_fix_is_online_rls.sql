-- ============================================================================
-- FIX: Allow users to update their own is_online status
-- ============================================================================
-- GlobalPresenceTracker needs to PATCH user_profiles.is_online and last_active
-- Without this policy, updates fail silently or with permission errors
-- ============================================================================

-- Policy: Users can update their own online status
DROP POLICY IF EXISTS "Users can update own online status" ON public.user_profiles;
CREATE POLICY "Users can update own online status" ON public.user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- OPTIONAL: Also allow update of last_active via same policy
-- The above policy covers ALL columns, so is_online and last_active updates work

-- ============================================================================
-- END
-- ============================================================================
