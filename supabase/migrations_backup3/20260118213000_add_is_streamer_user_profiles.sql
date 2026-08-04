-- Ensure user_profiles has is_streamer flag expected by seed
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS is_streamer boolean NOT NULL DEFAULT false;
