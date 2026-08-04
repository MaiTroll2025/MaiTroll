-- Fix missing streams columns referenced by frontend/backend code

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS microphone_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_reason TEXT,
  ADD COLUMN IF NOT EXISTS rtc_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;

-- Fix missing user_profiles.thumbnail_url referenced by frontend
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
