-- ============================================================================
-- Migration: repair_podcast_backend
-- Ensures podcast system tables and columns exist
-- Applied: 2026-07-30
-- ============================================================================

-- podcasts.status check constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'podcasts' AND constraint_name = 'podcasts_status_check'
  ) THEN
    ALTER TABLE public.podcasts
      ADD CONSTRAINT podcasts_status_check
      CHECK (status IN ('draft', 'scheduled', 'live', 'active', 'ended', 'cancelled'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'host_user_id'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN host_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN started_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN ended_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'peak_listener_count'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN peak_listener_count integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN recording_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcasts' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.podcasts ADD COLUMN visibility text DEFAULT 'public'
      CHECK (visibility IN ('public', 'private'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_podcasts_host_user_id ON public.podcasts(host_user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_user_id ON public.podcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_status ON public.podcasts(status);

-- podcast_episodes columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcast_episodes' AND column_name = 'recorded_at'
  ) THEN
    ALTER TABLE public.podcast_episodes ADD COLUMN recorded_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcast_episodes' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE public.podcast_episodes ADD COLUMN video_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcast_episodes' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.podcast_episodes ADD COLUMN duration_seconds integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'podcast_episodes' AND column_name = 'listener_count'
  ) THEN
    ALTER TABLE public.podcast_episodes ADD COLUMN listener_count integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_podcast_id ON public.podcast_episodes(podcast_id);

-- saved_streams unique constraint for podcast recording upserts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'saved_streams' AND constraint_name = 'saved_streams_user_id_stream_id_key'
  ) THEN
    ALTER TABLE public.saved_streams
      ADD CONSTRAINT saved_streams_user_id_stream_id_key
      UNIQUE (user_id, stream_id);
  END IF;
END $$;

-- podcast_rtc_logs table
CREATE TABLE IF NOT EXISTS public.podcast_rtc_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id UUID NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username text,
  role text DEFAULT 'listener' CHECK (role IN ('host', 'guest', 'listener', 'moderator')),
  level text DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  event_type text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.podcast_rtc_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Podcast host can view logs"
  ON public.podcast_rtc_logs FOR SELECT
  USING (auth.uid() = user_id OR podcast_id = (
    SELECT id FROM public.podcasts WHERE host_user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_podcast_rtc_logs_podcast_id ON public.podcast_rtc_logs(podcast_id);