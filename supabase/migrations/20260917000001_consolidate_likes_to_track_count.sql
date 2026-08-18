-- ============================================================================
-- Migration: Consolidate likes into track-level count only
-- Date: 2026-08-17
-- Purpose: Remove per-user like rows (song_likes, record_label_track_likes)
--          and use record_label_tracks.like_count as the single source of truth.
-- ============================================================================

-- Drop song_likes trigger/function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'song_likes' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_update_song_likes ON public.song_likes;
    DROP FUNCTION IF EXISTS public.update_song_likes_count();
    DROP TABLE public.song_likes;
  END IF;
END $$;

-- Drop record_label_track_likes triggers/function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'record_label_track_likes' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_record_label_track_like_insert ON public.record_label_track_likes;
    DROP TRIGGER IF EXISTS trg_record_label_track_like_delete ON public.record_label_track_likes;
    DROP FUNCTION IF EXISTS public.sync_record_label_track_like_count();
    DROP TABLE public.record_label_track_likes;
  END IF;
END $$;

-- Drop legacy songs view if it exists (security definer view warning)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'songs' AND table_schema = 'public') THEN
    DROP VIEW public.songs;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
