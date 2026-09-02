-- Add camera_off_image_url column to user_profiles
-- Stores the URL of an image to display when broadcaster's camera is off

BEGIN;

-- Add camera_off_image_url column if it doesn't exist
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS camera_off_image_url TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_camera_off_image_url 
ON public.user_profiles(camera_off_image_url) 
WHERE camera_off_image_url IS NOT NULL;

COMMIT;
