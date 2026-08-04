-- ============================================================================
-- Migration: repair_stream_backend
-- Ensures stream chat, participants, viewers, seats, and realtime
-- tables have proper columns and relationships
-- Applied: 2026-07-30
-- ============================================================================

-- stream_messages: ensure user_id FK and added_by column for username derivation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_messages' AND column_name = 'added_by'
  ) THEN
    ALTER TABLE public.stream_messages ADD COLUMN added_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_messages' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.stream_messages ADD COLUMN username text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_messages' AND constraint_name = 'stream_messages_user_id_fkey'
  ) THEN
    ALTER TABLE public.stream_messages ADD CONSTRAINT stream_messages_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_id ON public.stream_messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_user_id ON public.stream_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_messages_created_at ON public.stream_messages(created_at DESC);

-- stream_chat: create if missing (alias for stream_messages for battle chat)
CREATE TABLE IF NOT EXISTS public.stream_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'message' CHECK (type IN ('message', 'announcement', 'system', 'gift')),
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stream_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read stream chat"
  ON public.stream_chat FOR SELECT
  USING (true);

CREATE POLICY "Participants can send chat messages"
  ON public.stream_chat FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stream_chat_stream_id ON public.stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chat_user_id ON public.stream_chat(user_id);

-- stream_seats: ensure FK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_seats' AND constraint_name = 'stream_seats_stream_id_fkey'
  ) THEN
    ALTER TABLE public.stream_seats
      ADD CONSTRAINT stream_seats_stream_id_fkey
      FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- stream_participants: ensure FK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_participants' AND constraint_name = 'stream_participants_stream_id_fkey'
  ) THEN
    ALTER TABLE public.stream_participants
      ADD CONSTRAINT stream_participants_stream_id_fkey
      FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_participants' AND constraint_name = 'stream_participants_user_id_fkey'
  ) THEN
    ALTER TABLE public.stream_participants
      ADD CONSTRAINT stream_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- stream_viewers: ensure FK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_viewers' AND constraint_name = 'stream_viewers_stream_id_fkey'
  ) THEN
    ALTER TABLE public.stream_viewers
      ADD CONSTRAINT stream_viewers_stream_id_fkey
      FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'stream_viewers' AND constraint_name = 'stream_viewers_user_id_fkey'
  ) THEN
    ALTER TABLE public.stream_viewers
      ADD CONSTRAINT stream_viewers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;