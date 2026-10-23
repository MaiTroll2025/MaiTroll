-- Add cover_url column to user_profiles for profile cover photos

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS cover_url TEXT;

COMMENT ON COLUMN public.user_profiles.cover_url IS 'Public URL of the user\'s profile cover photo';
