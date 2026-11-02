-- ============================================================
-- Migration: 20261031000001_add_maicam_connect_tables.sql
-- Purpose: MaiCam Connect — phone-to-PC wireless camera/mic system
-- Tables: maicam_devices, maicam_pairing_codes, maicam_sessions, maicam_preferences
-- ============================================================

-- maicam_devices: registered phones/desktops a user has paired with MaiCam
CREATE TABLE IF NOT EXISTS public.maicam_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name     TEXT NOT NULL,
  device_type     TEXT NOT NULL CHECK (device_type IN ('phone', 'desktop', 'tablet')),
  browser_name    TEXT,
  last_connected_at TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- maicam_pairing_codes: single-use, time-limited pairing codes
CREATE TABLE IF NOT EXISTS public.maicam_pairing_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash         TEXT NOT NULL,        -- bcrypt/argon2 hash of the short code
  originating_device_id UUID REFERENCES public.maicam_devices(id) ON DELETE SET NULL,
  intended_role     TEXT NOT NULL CHECK (intended_role IN ('phone', 'desktop')),
  expires_at        TIMESTAMPTZ NOT NULL,
  consumed_at       TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- maicam_sessions: active/paired phone<->desktop media sessions
CREATE TABLE IF NOT EXISTS public.maicam_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_device_id   UUID REFERENCES public.maicam_devices(id) ON DELETE SET NULL,
  desktop_device_id UUID REFERENCES public.maicam_devices(id) ON DELETE SET NULL,
  livekit_room_name TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'connected', 'disconnected', 'expired', 'revoked')),
  connected_at      TIMESTAMPTZ,
  disconnected_at   TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- maicam_preferences: per-user MaiCam camera/mic/quality preferences
CREATE TABLE IF NOT EXISTS public.maicam_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_camera  TEXT NOT NULL DEFAULT '720p',
  preferred_microphone TEXT NOT NULL DEFAULT 'phone',
  preferred_resolution TEXT NOT NULL DEFAULT '720p',
  preferred_fps     INTEGER NOT NULL DEFAULT 30,
  mirror_preview    BOOLEAN NOT NULL DEFAULT false,
  battery_friendly  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maicam_devices_user ON public.maicam_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_maicam_devices_revoked ON public.maicam_devices(revoked_at);
CREATE INDEX IF NOT EXISTS idx_maicam_pairing_codes_user ON public.maicam_pairing_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_maicam_pairing_codes_hash ON public.maicam_pairing_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_maicam_pairing_codes_expires ON public.maicam_pairing_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_maicam_pairing_codes_consumed ON public.maicam_pairing_codes(consumed_at);
CREATE INDEX IF NOT EXISTS idx_maicam_sessions_user ON public.maicam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_maicam_sessions_status ON public.maicam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_maicam_sessions_room ON public.maicam_sessions(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_maicam_preferences_user ON public.maicam_preferences(user_id);

-- Enable RLS on all new user-facing tables
ALTER TABLE public.maicam_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maicam_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maicam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maicam_preferences ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/modify their own rows
CREATE POLICY maicam_devices_own ON public.maicam_devices
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY maicam_pairing_codes_own ON public.maicam_pairing_codes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY maicam_sessions_own ON public.maicam_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY maicam_preferences_own ON public.maicam_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Updated_at triggers are not required for MVP; created_at/updated_at set via application layer.
