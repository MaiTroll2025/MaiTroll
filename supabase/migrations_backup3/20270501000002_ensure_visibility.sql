
-- Migration: Ensure Visibility for Seats and Profiles
-- Description: Fixes potential RLS issues preventing hosts from seeing guests/users in seats.

-- 1. Stream Seat Sessions: Force Public Visibility
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Public view active seat sessions" ON public.stream_seat_sessions;
DROP POLICY IF EXISTS "Broadcasters view stream sessions" ON public.stream_seat_sessions;

-- Allow EVERYONE to see active sessions (Critical for Grid)
CREATE POLICY "Public view active seat sessions" ON public.stream_seat_sessions
    FOR SELECT
    USING (status = 'active');

-- Allow Broadcasters to see ALL sessions (History/Logs)
CREATE POLICY "Broadcasters view stream sessions" ON public.stream_seat_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.streams s 
            WHERE s.id = stream_seat_sessions.stream_id 
            AND (s.user_id = auth.uid() OR s.broadcaster_id = auth.uid())
        )
    );

-- Allow Users to see their own sessions
DROP POLICY IF EXISTS "Users view own seat sessions" ON public.stream_seat_sessions;
CREATE POLICY "Users view own seat sessions" ON public.stream_seat_sessions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());


-- 2. User Profiles: Ensure Public Visibility
-- If the Host cannot read the Guest's profile, the join in the query might fail or return incomplete data.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.user_profiles;

-- Allow everyone to view basic profile info
CREATE POLICY "Public view profiles" ON public.user_profiles
    FOR SELECT
    USING (true);

