-- Fix user_follows RLS policies
-- Reported issue: "when a user follows someone then leave and go back to that user profile it then dont say they follow them"
-- Cause: UI optimistically updates but INSERT likely fails due to missing RLS, or SELECT fails due to missing RLS.

BEGIN;

-- 1. Ensure table exists and RLS is enabled
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    following_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies

-- SELECT: Users can see who they follow and who follows them
-- We also need to allow public read if we want to show "Followers" counts to everyone, 
-- or lists of followers to everyone. Usually follower lists are public.
-- If we want strict privacy:
-- CREATE POLICY "Users can view related follows" ON public.user_follows
--     FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);
-- But usually:
DROP POLICY IF EXISTS "Public view follows" ON public.user_follows;
CREATE POLICY "Public view follows" ON public.user_follows
    FOR SELECT USING (true);

-- INSERT: Authenticated users can follow others (must be the follower)
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
CREATE POLICY "Users can follow others" ON public.user_follows
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = follower_id);

-- DELETE: Users can unfollow (must be the follower)
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
CREATE POLICY "Users can unfollow" ON public.user_follows
    FOR DELETE
    USING (auth.role() = 'authenticated' AND auth.uid() = follower_id);

COMMIT;
