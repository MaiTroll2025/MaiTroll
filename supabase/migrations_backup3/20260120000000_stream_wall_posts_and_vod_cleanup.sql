-- ============================================================================
-- Mai Troll — Stream Wall Posts for Ended Streams + VOD Auto-Cleanup
-- ============================================================================
-- 1. Add 'stream_ended' post type support and auto-post on stream end
-- 2. Add 'stream_highlight' post type for VOD replays
-- 3. Function to auto-delete VOD recordings older than 2 days
-- 4. Function to create wall post when stream ends
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Auto-post to troll_wall_posts when a stream ends
--    Creates a "stream_ended" post so users can click through to the VOD
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_post_stream_ended()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_stream_title TEXT;
BEGIN
  -- Only trigger when status changes to 'ended'
  IF NEW.status = 'ended' AND (OLD.status IS NULL OR OLD.status != 'ended') THEN
    -- Get broadcaster username
    SELECT username INTO v_username
    FROM public.user_profiles
    WHERE id = NEW.broadcaster_id;

    v_stream_title := COALESCE(NEW.title, 'Untitled Stream');

    -- Insert wall post for the ended stream
    INSERT INTO public.troll_wall_posts (
      user_id,
      post_type,
      content,
      metadata,
      is_system_generated,
      created_at
    ) VALUES (
      NEW.broadcaster_id,
      'stream_ended',
      '📺 ' || COALESCE(v_username, 'A broadcaster') || '''s stream "' || v_stream_title || '" has ended. Watch the replay!',
      jsonb_build_object(
        'stream_id', NEW.id,
        'stream_title', v_stream_title,
        'ended_at', NEW.ended_at,
        'duration', EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::integer,
        'recording_url', NEW.recording_url
      ),
      true,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS trg_auto_post_stream_ended ON public.streams;
CREATE TRIGGER trg_auto_post_stream_ended
  AFTER UPDATE OF status ON public.streams
  FOR EACH ROW
  WHEN (NEW.status = 'ended')
  EXECUTE FUNCTION public.auto_post_stream_ended();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Auto-delete VOD recordings older than 2 days
--    Run via Supabase pg_cron or manually: SELECT cleanup_old_vods();
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_vods()
RETURNS TABLE(deleted_count INTEGER, deleted_files TEXT[]) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '2 days';
  v_count INTEGER := 0;
  v_files TEXT[] := ARRAY[]::TEXT[];
  v_record RECORD;
BEGIN
  -- Find streams with recordings older than 2 days
  FOR v_record IN
    SELECT id, recording_url, recording_storage_path, title
    FROM public.streams
    WHERE ended_at IS NOT NULL
      AND ended_at < v_cutoff
      AND (recording_url IS NOT NULL OR recording_storage_path IS NOT NULL)
  LOOP
    -- Delete the recording file from storage if path exists
    IF v_record.recording_storage_path IS NOT NULL THEN
      -- Note: Actual storage deletion happens via the storage API
      -- This function just marks the recording as cleaned up
      v_files := array_append(v_files, v_record.recording_storage_path);
    END IF;

    -- Clear the recording URLs from the stream record
    UPDATE public.streams
    SET recording_url = NULL,
        recording_storage_path = NULL,
        save_requested = false,
        save_requested_at = NULL,
        saved_to_admin_archive = false,
        saved_at = NULL
    WHERE id = v_record.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count, v_files;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Add stream_ended to the post type comment for documentation
-- ────────────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.auto_post_stream_ended IS 'Creates a troll_wall_posts entry when a stream status changes to ended, allowing users to click through to the VOD replay';
COMMENT ON FUNCTION public.cleanup_old_vods IS 'Removes recording_url and recording_storage_path from streams older than 2 days. Returns count of cleaned records and array of file paths to delete from storage.';
