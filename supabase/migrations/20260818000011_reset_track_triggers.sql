-- ============================================================================
-- Migration: Drop and recreate record_label_tracks triggers
-- Date: 2026-08-18
-- Purpose: Eliminate any unknown trigger on record_label_tracks that
--          references NEW.user_id, causing "record 'new' has no field
--          'user_id'" during play_mai_track.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'record_label_tracks'
      AND trigger_schema = 'public'
  )
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.record_label_tracks';
  END LOOP;
END;
$$;

-- Recreate the safe updated_at trigger
CREATE OR REPLACE FUNCTION public.set_record_label_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
set search_path = '';

CREATE TRIGGER trg_record_label_tracks_updated
  BEFORE UPDATE ON public.record_label_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_record_label_updated_at();

-- Recreate the user_id auto-populate trigger (INSERT only)
CREATE OR REPLACE FUNCTION public.set_record_label_track_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.artist_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.record_label_artist_profiles
    WHERE id = NEW.artist_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
set search_path = '';

CREATE TRIGGER trg_set_record_label_track_user_id
  BEFORE INSERT ON public.record_label_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_record_label_track_user_id();
