-- Add display_name column to user_profiles if it doesn't exist
-- This allows users to have a display name different from their username
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create index for faster lookups on display_name
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name) WHERE display_name IS NOT NULL AND display_name != '';