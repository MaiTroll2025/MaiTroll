-- Agora Stream Sessions Table
-- Tracks Agora streaming sessions for HytroGaming
-- Architecture: OBS → Agora RTMP Ingest → Agora Channel → Mai Troll Viewers
--
-- NOTE: This is a NEW table (agora_stream_sessions), separate from the existing
-- stream_sessions table which is used by the backend API for regular broadcasts.
-- This avoids any conflicts with the main broadcast system.

-- Ensure streams table has Agora-related fields
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS stream_key TEXT;

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS game_title TEXT DEFAULT '';

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'grid';

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS battle_id UUID;

-- Create Agora stream sessions table (separate from existing stream_sessions)
CREATE TABLE IF NOT EXISTS public.agora_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id UUID NOT NULL,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,

  -- Agora streaming credentials
  agora_channel TEXT NOT NULL UNIQUE,
  stream_key TEXT NOT NULL,
  host_uid INTEGER NOT NULL DEFAULT 0,

  -- Stream status: starting | waiting | signal_detected | ready | live | ended | error
  status TEXT NOT NULL DEFAULT 'starting',

  -- Viewer tracking
  viewer_count INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Agora session metadata (for future co-hosting, PK battles, multi-guest, voice chats, live events)
  session_metadata JSONB DEFAULT '{}'::jsonb,

  -- Recording
  recording_url TEXT,
  is_recording BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agora_stream_sessions_streamer_id ON public.agora_stream_sessions(streamer_id);
CREATE INDEX IF NOT EXISTS idx_agora_stream_sessions_stream_id ON public.agora_stream_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_agora_stream_sessions_status ON public.agora_stream_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agora_stream_sessions_agora_channel ON public.agora_stream_sessions(agora_channel);
CREATE INDEX IF NOT EXISTS idx_agora_stream_sessions_created_at ON public.agora_stream_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.agora_stream_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop existing first to allow re-running)
DROP POLICY IF EXISTS "Anyone can view all agora stream sessions" ON public.agora_stream_sessions;
DROP POLICY IF EXISTS "Users can create their own agora stream sessions" ON public.agora_stream_sessions;
DROP POLICY IF EXISTS "Users can update their own agora stream sessions" ON public.agora_stream_sessions;
DROP POLICY IF EXISTS "Users can delete their own agora stream sessions" ON public.agora_stream_sessions;

-- Anyone can view all stream sessions (for browsing)
CREATE POLICY "Anyone can view all agora stream sessions"
  ON public.agora_stream_sessions
  FOR SELECT
  USING (true);

-- Authenticated users can create their own stream sessions
CREATE POLICY "Users can create their own agora stream sessions"
  ON public.agora_stream_sessions
  FOR INSERT
  WITH CHECK (streamer_id = auth.uid());

-- Users can update their own stream sessions
CREATE POLICY "Users can update their own agora stream sessions"
  ON public.agora_stream_sessions
  FOR UPDATE
  USING (streamer_id = auth.uid())
  WITH CHECK (streamer_id = auth.uid());

-- Users can delete their own stream sessions
CREATE POLICY "Users can delete their own agora stream sessions"
  ON public.agora_stream_sessions
  FOR DELETE
  USING (streamer_id = auth.uid());

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_agora_stream_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS agora_stream_sessions_updated_at ON public.agora_stream_sessions;
CREATE TRIGGER agora_stream_sessions_updated_at
  BEFORE UPDATE ON public.agora_stream_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_agora_stream_session_updated_at();

-- Function to increment viewer count
CREATE OR REPLACE FUNCTION public.increment_agora_stream_session_viewers(session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.agora_stream_sessions
  SET viewer_count = viewer_count + 1,
      peak_viewers = GREATEST(peak_viewers, viewer_count + 1)
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement viewer count
CREATE OR REPLACE FUNCTION public.decrement_agora_stream_session_viewers(session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.agora_stream_sessions
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.agora_stream_sessions TO authenticated;
GRANT SELECT ON public.agora_stream_sessions TO anon;
GRANT EXECUTE ON FUNCTION public.increment_agora_stream_session_viewers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_agora_stream_session_viewers(UUID) TO authenticated;
