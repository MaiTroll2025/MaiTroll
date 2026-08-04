-- ============================================================================
-- Migration: repair_all_missing_backend_systems
-- Comprehensive repair migration covering all missing backend systems
-- Applied: 2026-07-30
-- ============================================================================

-- ============================================================================
-- 1. STORAGE BUCKETS
-- ============================================================================

-- Replays bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('replays', 'replays', true, 2147483648, ARRAY['video/webm', 'video/mp4', 'video/x-msvideo'])
ON CONFLICT (id) DO NOTHING;

-- Auction items bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auction-items', 'auction-items', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Family banners bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('family-banners', 'family-banners', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Podcast covers bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('podcast-covers', 'podcast-covers', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Podcast audio bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('podcast-audio', 'podcast-audio', false, 52428800, ARRAY['audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'])
ON CONFLICT (id) DO NOTHING;

-- Academy files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-files', 'academy-files', false, 104857600, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Assignment submissions bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assignment-submissions', 'assignment-submissions', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Certificates bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 5242880, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Evidence files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence-files', 'evidence-files', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4', 'audio/mp3'])
ON CONFLICT (id) DO NOTHING;

-- Court documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('court-documents', 'court-documents', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for all buckets (using DO blocks since CREATE POLICY doesn't support IF NOT EXISTS)
DO $$
BEGIN
  -- Replays bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Public can view replays') THEN
    CREATE POLICY "Public can view replays" ON storage.objects FOR SELECT USING (bucket_id = 'replays');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload replays') THEN
    CREATE POLICY "Authenticated users can upload replays" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'replays' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can update replays') THEN
    CREATE POLICY "Owner can update replays" ON storage.objects FOR UPDATE USING (bucket_id = 'replays' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can delete replays') THEN
    CREATE POLICY "Owner can delete replays" ON storage.objects FOR DELETE USING (bucket_id = 'replays' AND owner = auth.uid());
  END IF;

  -- Auction items bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view auction items') THEN
    CREATE POLICY "Authenticated users can view auction items" ON storage.objects FOR SELECT USING (bucket_id = 'auction-items');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload auction items') THEN
    CREATE POLICY "Authenticated users can upload auction items" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'auction-items' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can update auction items') THEN
    CREATE POLICY "Owner can update auction items" ON storage.objects FOR UPDATE USING (bucket_id = 'auction-items' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can delete auction items') THEN
    CREATE POLICY "Owner can delete auction items" ON storage.objects FOR DELETE USING (bucket_id = 'auction-items' AND owner = auth.uid());
  END IF;

  -- Family banners bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Public can view family banners') THEN
    CREATE POLICY "Public can view family banners" ON storage.objects FOR SELECT USING (bucket_id = 'family-banners');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can upload family banners') THEN
    CREATE POLICY "Owner can upload family banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'family-banners' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can update family banners') THEN
    CREATE POLICY "Owner can update family banners" ON storage.objects FOR UPDATE USING (bucket_id = 'family-banners' AND owner = auth.uid());
  END IF;

  -- Podcast covers bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Public can view podcast covers') THEN
    CREATE POLICY "Public can view podcast covers" ON storage.objects FOR SELECT USING (bucket_id = 'podcast-covers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload podcast covers') THEN
    CREATE POLICY "Authenticated users can upload podcast covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'podcast-covers' AND auth.uid() IS NOT NULL);
  END IF;

  -- Podcast audio bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can view podcast audio') THEN
    CREATE POLICY "Owner can view podcast audio" ON storage.objects FOR SELECT USING (bucket_id = 'podcast-audio' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can upload podcast audio') THEN
    CREATE POLICY "Owner can upload podcast audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'podcast-audio' AND auth.uid() IS NOT NULL);
  END IF;

  -- Academy files bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view academy files') THEN
    CREATE POLICY "Authenticated users can view academy files" ON storage.objects FOR SELECT USING (bucket_id = 'academy-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload academy files') THEN
    CREATE POLICY "Authenticated users can upload academy files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'academy-files' AND auth.uid() IS NOT NULL);
  END IF;

  -- Assignment submissions bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can view submissions') THEN
    CREATE POLICY "Authenticated users can view submissions" ON storage.objects FOR SELECT USING (bucket_id = 'assignment-submissions');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload submissions') THEN
    CREATE POLICY "Authenticated users can upload submissions" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assignment-submissions' AND auth.uid() IS NOT NULL);
  END IF;

  -- Certificates bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Owner can view certificates') THEN
    CREATE POLICY "Owner can view certificates" ON storage.objects FOR SELECT USING (bucket_id = 'certificates' AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload certificates') THEN
    CREATE POLICY "Authenticated users can upload certificates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificates' AND auth.uid() IS NOT NULL);
  END IF;

  -- Evidence files bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Court participants can view evidence') THEN
    CREATE POLICY "Court participants can view evidence" ON storage.objects FOR SELECT USING (bucket_id = 'evidence-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload evidence') THEN
    CREATE POLICY "Authenticated users can upload evidence" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'evidence-files' AND auth.uid() IS NOT NULL);
  END IF;

  -- Court documents bucket policies
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Court participants can view documents') THEN
    CREATE POLICY "Court participants can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'court-documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can upload court documents') THEN
    CREATE POLICY "Authenticated users can upload court documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'court-documents' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================================
-- 2. REALTIME PUBLICATIONS
-- ============================================================================

-- Helper function to add tables to publication safely
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT * FROM unnest(array[
      'streams', 'stream_participants', 'stream_viewers', 'stream_messages',
      'stream_seats', 'stream_chat', 'broadcast_replays',
      'auction_shows', 'auction_lots', 'auction_bids', 'auction_wins',
      'auction_orders', 'auction_presence', 'auction_watchlist',
      'troll_families', 'family_members', 'family_invites', 'family_calls',
      'family_call_members', 'family_chat_messages', 'family_notifications',
      'family_wars', 'family_war_scores',
      'court_sessions', 'court_participants', 'court_cases', 'court_events',
      'court_ai_messages', 'court_summons',
      'podcasts', 'podcast_episodes', 'podcast_rtc_logs',
      'properties', 'neighborhoods', 'houses', 'user_insurances', 'user_credit',
      'leases', 'house_rentals',
      'stream_recordings'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Ensure replica identity for tables that need old row values in update/delete events
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT * FROM unnest(array[
      'streams', 'stream_messages', 'stream_chat', 'stream_viewers',
      'stream_participants', 'auction_shows', 'auction_lots', 'auction_bids',
      'auction_orders', 'auction_presence', 'troll_families', 'family_members',
      'family_invites', 'family_calls', 'family_chat_messages',
      'court_sessions', 'court_participants', 'court_cases', 'court_events',
      'court_ai_messages', 'podcasts', 'podcast_episodes',
      'properties', 'neighborhoods', 'houses', 'broadcast_replays',
      'stream_recordings'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. REFRESH SCHEMA CACHE
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');