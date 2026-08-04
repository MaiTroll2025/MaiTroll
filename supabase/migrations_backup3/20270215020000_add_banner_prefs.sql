-- Add banner_notifications_enabled to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS banner_notifications_enabled BOOLEAN DEFAULT true;

-- Update existing banners logic (frontend) to respect this column
-- No other DB changes needed for the notification itself if we use client-side listeners on pod_rooms
