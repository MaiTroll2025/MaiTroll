-- LiveKit Beta Limits configuration for MAI Troll.
-- Sets platform-level limits that apply to every broadcast, including admin/owner/staff/test accounts.

-- Ensure admin_settings table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB DEFAULT '{}',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta limit settings (stored as JSONB for structured config)
INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES
  ('livekit_beta_max_concurrent_broadcasts', '{"value": 6, "enabled": true}', 'Maximum simultaneous broadcast rooms during beta'),
  ('livekit_beta_max_broadcast_duration_minutes', '{"value": 360, "enabled": true}', 'Maximum duration per broadcast in minutes (6 hours)'),
  ('livekit_beta_max_regular_viewers', '{"value": 30, "enabled": true}', 'Maximum regular viewers per broadcast room'),
  ('livekit_beta_max_guest_seats', '{"value": 4, "enabled": true}', 'Maximum guest seats per broadcast room'),
  ('livekit_beta_max_hosts', '{"value": 1, "enabled": true}', 'Maximum host seats per broadcast room'),
  ('livekit_beta_max_participants', '{"value": 35, "enabled": true}', 'Maximum total participants per room (1 host + 4 guests + 30 viewers)'),
  ('livekit_beta_camera_max_width', '{"value": 1280, "enabled": true}', 'Maximum camera width in pixels'),
  ('livekit_beta_camera_max_height', '{"value": 720, "enabled": true}', 'Maximum camera height in pixels'),
  ('livekit_beta_camera_max_framerate', '{"value": 30, "enabled": true}', 'Maximum camera frame rate'),
  ('livekit_beta_camera_max_bitrate', '{"value": 2000000, "enabled": true}', 'Maximum camera publishing bitrate in bits per second'),
  ('livekit_beta_screen_share_enabled', '{"value": false, "enabled": true}', 'Screen sharing disabled during beta'),
  ('livekit_monthly_rtc_allowance', '{"value": 150000, "enabled": true}', 'Monthly RTC participant minute allowance'),
  ('livekit_usage_warning_threshold', '{"value": 120000, "enabled": true}', 'Warning threshold for monthly RTC usage'),
  ('livekit_usage_restriction_threshold', '{"value": 135000, "enabled": true}', 'Restriction threshold for monthly RTC usage'),
  ('livekit_usage_emergency_threshold', '{"value": 145000, "enabled": true}', 'Emergency threshold for monthly RTC usage')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- Create RTC usage tracking table
CREATE TABLE IF NOT EXISTS public.livekit_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL,
  participant_identity TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('host', 'seat', 'viewer', 'moderator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livekit_usage_tracking_room_name ON public.livekit_usage_tracking(room_name);
CREATE INDEX IF NOT EXISTS idx_livekit_usage_tracking_participant_identity ON public.livekit_usage_tracking(participant_identity);
CREATE INDEX IF NOT EXISTS idx_livekit_usage_tracking_joined_at ON public.livekit_usage_tracking(joined_at);

-- Create broadcast duration tracking columns on streams table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'started_at') THEN
    ALTER TABLE public.streams ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'scheduled_end_at') THEN
    ALTER TABLE public.streams ADD COLUMN scheduled_end_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'ended_by') THEN
    ALTER TABLE public.streams ADD COLUMN ended_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'end_reason') THEN
    ALTER TABLE public.streams ADD COLUMN end_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'livekit_room_sid') THEN
    ALTER TABLE public.streams ADD COLUMN livekit_room_sid TEXT;
  END IF;
END
$$;

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.livekit_usage_tracking TO authenticated, service_role;
GRANT SELECT ON public.admin_settings TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';