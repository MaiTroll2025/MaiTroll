-- Add gaming stream columns to streams table

-- Add game_title column for storing the game being played
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'game_title'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN game_title TEXT;
  END IF;
END $$;

-- Add broadcaster_id column if missing (should reference user_id for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'broadcaster_id'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN broadcaster_id UUID REFERENCES public.user_profiles(id);
    UPDATE public.streams SET broadcaster_id = user_id WHERE broadcaster_id IS NULL;
  END IF;
END $$;

-- Add current_viewers column for live viewer count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'current_viewers'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN current_viewers INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add viewer_count column (alias for current_viewers for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'viewer_count'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN viewer_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add category column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN category TEXT DEFAULT 'gaming';
  END IF;
END $$;

-- Add started_at column for stream start time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add ended_at column for stream end time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add agora_channel column for Agora RTC integration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'agora_channel'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN agora_channel TEXT;
  END IF;
END $$;

-- Add hls_url for HLS playback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'hls_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN hls_url TEXT;
  END IF;
END $$;

-- Add playback_url for playback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'playback_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN playback_url TEXT;
  END IF;
END $$;

-- Add obs_playback_url for OBS playback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'obs_playback_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN obs_playback_url TEXT;
  END IF;
END $$;

-- Add stream_url as an alias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'stream_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN stream_url TEXT;
  END IF;
END $$;

-- Add battle_mode column for battle streams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'battle_mode'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN battle_mode TEXT;
  END IF;
END $$;

-- Add battle_format column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'battle_format'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN battle_format TEXT;
  END IF;
END $$;

-- Add battle_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'battle_status'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN battle_status TEXT;
  END IF;
END $$;

-- Add battle_id for linking to stream_battles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'battle_id'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN battle_id UUID REFERENCES public.stream_battles(id);
  END IF;
END $$;

-- Add is_live boolean column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'is_live'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_live BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add status column if missing (should be 'pending', 'starting', 'connected', 'live', 'ended')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Create indexes for efficient gaming stream queries
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_streams_category ON streams(category);
CREATE INDEX IF NOT EXISTS idx_streams_broadcaster ON streams(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_streams_started_at ON streams(started_at) WHERE started_at IS NOT NULL;

-- Add cloudflare_recording_id for Cloudflare Stream recording reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'cloudflare_recording_id'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN cloudflare_recording_id TEXT;
  END IF;
END $$;

-- Add cloudflare_playback_url for Cloudflare Stream playback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'cloudflare_playback_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN cloudflare_playback_url TEXT;
  END IF;
END $$;

-- Update existing streams to have proper broadcaster_id
UPDATE public.streams 
SET broadcaster_id = user_id,
    category = COALESCE(category, 'gaming'),
    is_live = (status = 'live' OR is_live = true)
WHERE broadcaster_id IS NULL;