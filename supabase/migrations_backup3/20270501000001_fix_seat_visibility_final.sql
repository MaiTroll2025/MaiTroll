
-- Migration: Fix Seat Visibility for Broadcasters and Guests
-- Description: Ensures that seat sessions are visible to everyone (for the grid) and broadcasters (for management).

ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive or duplicate policies
DROP POLICY IF EXISTS "View stream seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Public view active seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Anyone can view active seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Users view own seat session" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Users view own seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Broadcasters view stream sessions" ON public.stream_seat_sessions;

-- 1. Public can view ACTIVE sessions (Critical for BroadcastGrid)
-- This allows anyone (guest or auth) to see who is on stage.
CREATE POLICY "Public view active seat sessions" ON public.stream_seat_sessions
    FOR SELECT
    USING (status = 'active');

-- 2. Authenticated users can view their OWN sessions (Active or History)
CREATE POLICY "Users view own seat sessions" ON public.stream_seat_sessions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 3. Broadcasters can view ALL sessions for their streams (Active or History)
-- Checks both user_id and broadcaster_id to cover different stream creation methods.
CREATE POLICY "Broadcasters view stream sessions" ON public.stream_seat_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.streams s 
            WHERE s.id = stream_seat_sessions.stream_id 
            AND (s.user_id = auth.uid() OR s.broadcaster_id = auth.uid())
        )
    );
