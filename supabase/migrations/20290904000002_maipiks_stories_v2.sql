-- =============================================================================
-- MIGRATION: MAI Piks Stories v2
-- Date: 2026-09-04
-- =============================================================================
-- 1. Per-item 24h expiry + hard delete (no soft-delete leftovers, storage cleaned)
-- 2. New media captured inside the 24h window is COMBINED into the same story
-- 3. Owner delete helpers (single item or the whole story)
-- 4. View tracking helper
-- 5. pg_cron purge job that hard deletes expired stories + storage objects
-- 6. maipiks storage bucket + storage policies (idempotent)
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Schema additions
-- =============================================================================

ALTER TABLE public.maipiks_story_items
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  ADD COLUMN IF NOT EXISTS tips_received_coins BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.maipiks_stories
  ADD COLUMN IF NOT EXISTS last_item_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tips_received_coins BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_maipiks_story_items_expires_at
  ON public.maipiks_story_items(expires_at);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_items_story_sort
  ON public.maipiks_story_items(story_id, sort_order);

COMMENT ON COLUMN public.maipiks_story_items.expires_at IS
  'Each piece of story media expires exactly 24h after it was added, then is hard deleted.';
COMMENT ON COLUMN public.maipiks_story_items.storage_path IS
  'Object path inside the maipiks storage bucket, used to hard delete the file on expiry.';

-- Backfill expiry for pre-existing items from their creation time
UPDATE public.maipiks_story_items
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL
   OR expires_at > created_at + INTERVAL '24 hours' + INTERVAL '1 minute';

-- Backfill storage path from the public URL when possible
UPDATE public.maipiks_story_items
SET storage_path = NULLIF(split_part(media_url, '/maipiks/', 2), '')
WHERE storage_path IS NULL
  AND media_url LIKE '%/maipiks/%';

-- =============================================================================
-- PART 2: Storage bucket + policies (idempotent, safe when already present)
-- =============================================================================

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'maipiks',
    'maipiks',
    TRUE,
    268435456, -- 256 MB, enough for a 3 minute phone video
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = TRUE,
        file_size_limit = GREATEST(COALESCE(buckets.file_size_limit, 0), 268435456),
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'maipiks bucket not configured automatically: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "maipiks_owner_insert" ON storage.objects;
  CREATE POLICY "maipiks_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maipiks' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "maipiks_public_read" ON storage.objects;
  CREATE POLICY "maipiks_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'maipiks');

  DROP POLICY IF EXISTS "maipiks_owner_update" ON storage.objects;
  CREATE POLICY "maipiks_owner_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'maipiks' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "maipiks_owner_delete" ON storage.objects;
  CREATE POLICY "maipiks_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'maipiks' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'maipiks storage policies not applied automatically: %', SQLERRM;
END $$;

-- =============================================================================
-- PART 3: Add media to a story - combines into the active 24h story
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maipiks_add_story_item(
  p_media_url TEXT,
  p_media_type TEXT DEFAULT 'photo',
  p_visibility TEXT DEFAULT 'everyone',
  p_storage_path TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_caption TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_story_id UUID;
  v_item_id UUID;
  v_sort INTEGER;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '24 hours';
  v_combined BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_media_url IS NULL OR btrim(p_media_url) = '' THEN
    RAISE EXCEPTION 'media_url is required';
  END IF;

  IF COALESCE(p_media_type, 'photo') NOT IN ('photo', 'video') THEN
    RAISE EXCEPTION 'media_type must be photo or video';
  END IF;

  IF COALESCE(p_visibility, 'everyone') NOT IN ('everyone', 'followers', 'private') THEN
    RAISE EXCEPTION 'invalid visibility';
  END IF;

  -- Reuse the story the user is already building inside the 24h window
  SELECT s.id INTO v_story_id
  FROM public.maipiks_stories s
  WHERE s.user_id = v_user_id
    AND s.deleted_at IS NULL
    AND s.visibility = COALESCE(p_visibility, 'everyone')
    AND s.created_at > NOW() - INTERVAL '24 hours'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_story_id IS NULL THEN
    INSERT INTO public.maipiks_stories (user_id, visibility, expires_at, last_item_at)
    VALUES (v_user_id, COALESCE(p_visibility, 'everyone'), v_expires_at, NOW())
    RETURNING id INTO v_story_id;
  ELSE
    v_combined := TRUE;
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_sort
  FROM public.maipiks_story_items
  WHERE story_id = v_story_id;

  INSERT INTO public.maipiks_story_items (
    story_id, media_url, media_type, thumbnail_url, caption,
    duration_ms, sort_order, storage_path, expires_at
  ) VALUES (
    v_story_id, p_media_url, COALESCE(p_media_type, 'photo'), p_thumbnail_url, p_caption,
    p_duration_ms, v_sort, p_storage_path, v_expires_at
  )
  RETURNING id INTO v_item_id;

  -- The container lives as long as its newest piece of media
  UPDATE public.maipiks_stories
  SET expires_at = GREATEST(expires_at, v_expires_at),
      last_item_at = NOW(),
      updated_at = NOW()
  WHERE id = v_story_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'story_id', v_story_id,
    'item_id', v_item_id,
    'sort_order', v_sort,
    'combined', v_combined,
    'expires_at', v_expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.maipiks_add_story_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) IS
  'Adds photo/video to the caller''s story. Media added within 24h is combined into the same story.';

GRANT EXECUTE ON FUNCTION public.maipiks_add_story_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)
  TO authenticated, service_role;

-- =============================================================================
-- PART 4: Owner deletes (hard delete + storage cleanup)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maipiks_delete_story_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_story_id UUID;
  v_path TEXT;
  v_remaining INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT i.story_id,
         COALESCE(i.storage_path, NULLIF(split_part(i.media_url, '/maipiks/', 2), ''))
  INTO v_story_id, v_path
  FROM public.maipiks_story_items i
  JOIN public.maipiks_stories s ON s.id = i.story_id
  WHERE i.id = p_item_id
    AND s.user_id = v_user_id;

  IF v_story_id IS NULL THEN
    RAISE EXCEPTION 'Story media not found or not yours';
  END IF;

  DELETE FROM public.maipiks_story_items WHERE id = p_item_id;

  IF v_path IS NOT NULL THEN
    BEGIN
      DELETE FROM storage.objects WHERE bucket_id = 'maipiks' AND name = v_path;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.maipiks_story_items
  WHERE story_id = v_story_id;

  IF v_remaining = 0 THEN
    DELETE FROM public.maipiks_stories WHERE id = v_story_id;
  ELSE
    UPDATE public.maipiks_stories s
    SET expires_at = COALESCE((
          SELECT MAX(i.expires_at) FROM public.maipiks_story_items i WHERE i.story_id = s.id
        ), s.expires_at),
        updated_at = NOW()
    WHERE s.id = v_story_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'story_id', v_story_id, 'story_deleted', v_remaining = 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_delete_story_item(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_delete_story(p_story_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owner UUID;
  v_paths TEXT[];
  v_deleted INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM public.maipiks_stories WHERE id = p_story_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Story not found';
  END IF;

  IF v_owner <> v_user_id THEN
    RAISE EXCEPTION 'You can only delete your own story';
  END IF;

  SELECT COALESCE(array_agg(p), ARRAY[]::TEXT[]) INTO v_paths
  FROM (
    SELECT COALESCE(i.storage_path, NULLIF(split_part(i.media_url, '/maipiks/', 2), '')) AS p
    FROM public.maipiks_story_items i
    WHERE i.story_id = p_story_id
  ) q
  WHERE q.p IS NOT NULL;

  SELECT COUNT(*) INTO v_deleted FROM public.maipiks_story_items WHERE story_id = p_story_id;

  DELETE FROM public.maipiks_stories WHERE id = p_story_id;

  IF array_length(v_paths, 1) > 0 THEN
    BEGIN
      DELETE FROM storage.objects WHERE bucket_id = 'maipiks' AND name = ANY(v_paths);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'items_deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.maipiks_delete_story(UUID) IS
  'Hard deletes the caller''s own story, all of its media rows, and the underlying storage objects.';

GRANT EXECUTE ON FUNCTION public.maipiks_delete_story(UUID) TO authenticated, service_role;

-- =============================================================================
-- PART 5: View tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maipiks_record_story_view(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_item_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.maipiks_story_views (story_item_id, viewer_user_id)
  VALUES (p_item_id, v_user_id)
  ON CONFLICT (story_item_id, viewer_user_id) DO UPDATE
    SET last_viewed_at = NOW(),
        view_count = maipiks_story_views.view_count + 1;

  UPDATE public.maipiks_story_items i
  SET view_count = (
    SELECT COUNT(*) FROM public.maipiks_story_views v WHERE v.story_item_id = i.id
  )
  WHERE i.id = p_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_record_story_view(UUID) TO authenticated, service_role;

-- =============================================================================
-- PART 6: Automatic hard delete of expired stories
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maipiks_purge_expired_stories()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
  v_items_deleted INTEGER := 0;
  v_stories_deleted INTEGER := 0;
BEGIN
  -- Collect storage paths before the rows disappear
  SELECT COALESCE(array_agg(p), ARRAY[]::TEXT[]) INTO v_paths
  FROM (
    SELECT COALESCE(i.storage_path, NULLIF(split_part(i.media_url, '/maipiks/', 2), '')) AS p
    FROM public.maipiks_story_items i
    WHERE i.expires_at <= NOW()
       OR i.deleted_at IS NOT NULL
  ) q
  WHERE q.p IS NOT NULL;

  DELETE FROM public.maipiks_story_items
  WHERE expires_at <= NOW() OR deleted_at IS NOT NULL;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- Containers with no live media left are removed entirely
  DELETE FROM public.maipiks_stories s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.maipiks_story_items i WHERE i.story_id = s.id
  )
  AND (s.expires_at <= NOW() OR s.deleted_at IS NOT NULL OR s.created_at < NOW() - INTERVAL '24 hours');
  GET DIAGNOSTICS v_stories_deleted = ROW_COUNT;

  -- Keep remaining containers aligned with their newest media
  UPDATE public.maipiks_stories s
  SET expires_at = sub.max_expiry
  FROM (
    SELECT story_id, MAX(expires_at) AS max_expiry
    FROM public.maipiks_story_items
    GROUP BY story_id
  ) sub
  WHERE s.id = sub.story_id
    AND s.expires_at <> sub.max_expiry;

  IF array_length(v_paths, 1) > 0 THEN
    BEGIN
      DELETE FROM storage.objects WHERE bucket_id = 'maipiks' AND name = ANY(v_paths);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'items_deleted', v_items_deleted,
    'stories_deleted', v_stories_deleted,
    'files_deleted', COALESCE(array_length(v_paths, 1), 0),
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.maipiks_purge_expired_stories() IS
  'Hard deletes MAI Piks story media older than 24h plus the underlying storage objects.';

GRANT EXECUTE ON FUNCTION public.maipiks_purge_expired_stories() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('maipiks-purge-expired-stories');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'maipiks-purge-expired-stories',
    '*/5 * * * *',
    $cron$SELECT public.maipiks_purge_expired_stories();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, MAI Piks purge must be scheduled externally: %', SQLERRM;
END $$;

COMMIT;
