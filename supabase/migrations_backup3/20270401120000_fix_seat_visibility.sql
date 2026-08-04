-- Fix seat visibility for other users
-- Previously, a policy restricted visibility to only the user who owns the seat session.
-- This policy allows anyone (public) to view ACTIVE seat sessions, which is required for the BroadcastGrid to render them.

-- 1. Drop the restrictive policy if it exists (or we can just add a new permissive one)
-- The existing policy "Users view own seat session" can remain for viewing historical/inactive sessions.

-- 2. Add policy for public access to active sessions
DROP POLICY IF EXISTS "Public view active seat sessions" ON public.stream_seat_sessions;

CREATE POLICY "Public view active seat sessions" ON public.stream_seat_sessions
    FOR SELECT
    USING (status = 'active');

-- 3. Ensure changes take effect
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;
