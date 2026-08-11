-- Migration: Allow public anonymous viewing of streams and enforce auth for chat
-- Date: 2026-08-04
-- Purpose: Public/anonymous users can view streams (broadcast, podcast, hytro)
--          but cannot send chat messages without authentication.

-- 1. stream_settings: Allow public read access for stream configuration
ALTER TABLE IF EXISTS public.stream_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stream_settings' AND policyname = 'public_stream_settings_select'
  ) THEN
    CREATE POLICY "public_stream_settings_select" ON public.stream_settings
      FOR SELECT USING (true);
  END IF;
END
$$;

-- 2. stream_moderators: Allow public read access for moderation status
ALTER TABLE IF EXISTS public.stream_moderators ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stream_moderators' AND policyname = 'public_stream_moderators_select'
  ) THEN
    CREATE POLICY "public_stream_moderators_select" ON public.stream_moderators
      FOR SELECT USING (true);
  END IF;
END
$$;

-- 3. stream_bans: Allow public read access for ban checks
ALTER TABLE IF EXISTS public.stream_bans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stream_bans' AND policyname = 'public_stream_bans_select'
  ) THEN
    CREATE POLICY "public_stream_bans_select" ON public.stream_bans
      FOR SELECT USING (true);
  END IF;
END
$$;

-- 6. streams: Ensure public view policy exists (idempotent)
ALTER TABLE IF EXISTS public.streams ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'streams' AND policyname = 'Anyone can view streams'
  ) THEN
    CREATE POLICY "Anyone can view streams" ON public.streams
      FOR SELECT USING (true);
  END IF;
END
$$;

-- 7. stream_messages: Ensure public read and authenticated insert policies exist (idempotent)
ALTER TABLE IF EXISTS public.stream_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stream_messages' AND policyname = 'stream_messages_select_all'
  ) THEN
    CREATE POLICY "stream_messages_select_all" ON public.stream_messages
      FOR SELECT USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stream_messages' AND policyname = 'stream_messages_insert_own'
  ) THEN
    CREATE POLICY "stream_messages_insert_own" ON public.stream_messages
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END
$$;