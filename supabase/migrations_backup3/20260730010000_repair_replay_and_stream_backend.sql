-- ============================================================================
-- Migration: repair_replay_and_stream_backend
-- Fixes replay system, stream recording, and gaming backend
-- Applied: 2026-07-30
-- ============================================================================

-- ============================================================================
-- 1. REPLAY SYSTEM: Add missing columns to broadcast_replays
-- ============================================================================

-- Add file_size_bytes column if missing (frontend uses this name)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'file_size_bytes'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN file_size_bytes bigint;
  END IF;
END $$;

-- Add recording_status column for replay visibility/status tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'recording_status'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN recording_status text DEFAULT 'completed'
      CHECK (recording_status IN ('recording', 'processing', 'completed', 'failed', 'unavailable', 'deleted'));
  END IF;
END $$;

-- Add thumbnail column alias if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'thumbnail'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN thumbnail text;
  END IF;
END $$;

-- Add view_count column for replay view tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN view_count integer DEFAULT 0;
  END IF;
END $$;

-- Add hls_url column for HLS playback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'hls_url'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN hls_url text;
  END IF;
END $$;

-- Add storage_path column for internal storage reference
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_replays' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.broadcast_replays ADD COLUMN storage_path text;
  END IF;
END $$;

-- Ensure stream_id FK exists on broadcast_replays
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'broadcast_replays' AND constraint_name = 'broadcast_replays_stream_id_fkey'
  ) THEN
    ALTER TABLE public.broadcast_replays
      ADD CONSTRAINT broadcast_replays_stream_id_fkey
      FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure user_id FK exists on broadcast_replays
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'broadcast_replays' AND constraint_name = 'broadcast_replays_user_id_fkey'
  ) THEN
    ALTER TABLE public.broadcast_replays
      ADD CONSTRAINT broadcast_replays_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for replay lookups by stream_id
CREATE INDEX IF NOT EXISTS idx_broadcast_replays_stream_id ON public.broadcast_replays(stream_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_replays_user_id ON public.broadcast_replays(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_replays_status ON public.broadcast_replays(recording_status);

-- ============================================================================
-- 2. STREAMS TABLE: Add recording-related columns
-- ============================================================================

-- recording_url already exists in some schema versions; add if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN recording_url text;
  END IF;
END $$;

-- Add stream_type column for gaming/hytro streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'stream_type'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN stream_type text DEFAULT 'standard'
      CHECK (stream_type IN ('standard', 'gaming', 'hytro', 'podcast', 'talk', 'music'));
  END IF;
END $$;

-- Add game_title column for gaming streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'game_title'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN game_title text;
  END IF;
END $$;

-- Add game_category column for gaming streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'game_category'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN game_category text;
  END IF;
END $$;

-- Add gaming_platform column for gaming streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'gaming_platform'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN gaming_platform text;
  END IF;
END $$;

-- Add mature_content column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'mature_content'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN mature_content boolean DEFAULT false;
  END IF;
END $$;

-- Add chat_enabled column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'chat_enabled'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN chat_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Add community_enabled column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'community_enabled'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN community_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Add monetization_enabled column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'monetization_enabled'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN monetization_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Add tags column for stream tags
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

-- Add thumbnail_url column to streams if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- Add stream_category column for broader categorization
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'stream_category'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN stream_category text DEFAULT 'general';
  END IF;
END $$;

-- Add is_featured column for gaming/broadcast streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_featured boolean DEFAULT false;
  END IF;
END $$;

-- Add featured_at column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'featured_at'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN featured_at timestamptz;
  END IF;
END $$;

-- Ensure broadcaster_id column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'broadcaster_id'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN broadcaster_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure current_viewers column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'current_viewers'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN current_viewers integer DEFAULT 0;
  END IF;
END $$;

-- Ensure peak_viewer_count column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'peak_viewer_count'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN peak_viewer_count integer DEFAULT 0;
  END IF;
END $$;

-- Ensure total_coins column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'total_coins'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN total_coins bigint DEFAULT 0;
  END IF;
END $$;

-- Ensure gift_count column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'gift_count'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN gift_count integer DEFAULT 0;
  END IF;
END $$;

-- Ensure chat_message_count column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'chat_message_count'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN chat_message_count integer DEFAULT 0;
  END IF;
END $$;

-- Ensure hls_url column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'hls_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN hls_url text;
  END IF;
END $$;

-- Ensure agora_channel column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'agora_channel'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN agora_channel text;
  END IF;
END $$;

-- Ensure is_live column exists on streams
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'is_live'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN is_live boolean DEFAULT false;
  END IF;
END $$;

-- Re-add/update indexes for streams
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON public.streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_broadcaster_id ON public.streams(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON public.streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_stream_type ON public.streams(stream_type);
CREATE INDEX IF NOT EXISTS idx_streams_game_title ON public.streams(game_title);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON public.streams(created_at DESC);

-- ============================================================================
-- 3. STREAM RECORDINGS TABLE (separate from broadcast_replays for clarity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stream_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  recording_url TEXT NOT NULL,
  hls_url TEXT,
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  storage_path TEXT,
  recording_status TEXT DEFAULT 'completed'
    CHECK (recording_status IN ('recording', 'processing', 'completed', 'failed', 'unavailable', 'deleted')),
  view_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stream_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view available recordings"
  ON public.stream_recordings FOR SELECT
  USING (is_public = true AND recording_status = 'completed');

CREATE POLICY "Stream owner can view all recordings"
  ON public.stream_recordings FOR SELECT
  USING (auth.uid() = user_id OR stream_id IN (
    SELECT id FROM public.streams WHERE user_id = auth.uid()
  ));

CREATE POLICY "Stream owner can insert recordings"
  ON public.stream_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Stream owner can update own recordings"
  ON public.stream_recordings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Stream owner can delete own recordings"
  ON public.stream_recordings FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stream_recordings_stream_id ON public.stream_recordings(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_user_id ON public.stream_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_status ON public.stream_recordings(recording_status);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_created_at ON public.stream_recordings(created_at DESC);

-- Add comment to distinguish from broadcast_replays
COMMENT ON TABLE public.stream_recordings IS 'Separate recording table for stream recordings; broadcast_replays is the legacy name for replay records linked to streams';
