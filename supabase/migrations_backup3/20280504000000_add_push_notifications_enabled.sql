-- Add push_notifications_enabled column to user_profiles
-- This allows users to opt-out of push notifications while keeping in-app notifications

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN user_profiles.push_notifications_enabled IS 
  'Whether the user wants to receive push notifications (Web Push). Default true.';

-- Create index for faster filtering (optional but useful)
CREATE INDEX IF NOT EXISTS idx_user_profiles_push_notifications_enabled 
ON user_profiles(push_notifications_enabled) 
WHERE push_notifications_enabled = true;
