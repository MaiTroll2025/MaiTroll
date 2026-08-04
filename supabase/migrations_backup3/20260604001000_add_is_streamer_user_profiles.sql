-- Add is_streamer column after baseline creates user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_streamer boolean NOT NULL DEFAULT false;
