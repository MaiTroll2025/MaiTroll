-- =============================================================================
-- MIGRATION: MAI Piks story durability + real 24h expiry
-- Date: 2026-10-05
-- =============================================================================
-- Problems this fixes:
--
-- 1. LOST CAPTURES. `maipiks_add_story_item` is the only thing that creates a
--    story row, but the file lands in storage first. When that RPC failed
--    (expired access token after a long recording, transient network failure)
--    the upload was left behind with no row pointing at it, so the capture was
--    invisible and the object leaked forever. The client now rolls the upload
--    back, and `maipiks_server_now` lets the UI use the database clock.
--
-- 2. NOTHING EVER EXPIRED. `maipiks_purge_expired_stories` was only ever
--    scheduled through pg_cron, which is not enabled on this project. The
--    migration swallowed the failure with `RAISE NOTICE`, so the 24h hard
--    delete silently never happened: expired containers, expired items and
--    their files accumulated indefinitely. `maipiks_purge_own_expired_stories`
--    gives the app an owner-scoped self-heal that needs no pg_cron at all.
--
-- 3. ORPHANED FILES. Uploads whose story row was never created are now
--    reclaimed by the purge once they are older than the 24h window.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Authoritative clock for the client
-- =============================================================================

-- Returned as ISO-8601 so the browser can parse it without guessing a zone.
CREATE OR REPLACE FUNCTION public.maipiks_server_now()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

COMMENT ON FUNCTION public.maipiks_server_now() IS
  'Current database time as ISO-8601. Used by the app to evaluate story expiry against the server clock rather than the device clock.';

GRANT EXECUTE ON FUNCTION public.maipiks_server_now() TO authenticated, service_role;

-- =============================================================================
-- PART 2: Owner-scoped 24h purge (works without pg_cron)
-- =============================================================================

-- Deliberately scoped to auth.uid(): the app can always clean up the caller's
-- own expired stories, and a normal user can never delete anybody else's media.
CREATE OR REPLACE FUNCTION public.maipiks_purge_own_expired_stories()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_paths TEXT[];
  v_items_deleted INTEGER := 0;
  v_stories_deleted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Collect storage paths before the rows disappear.
  SELECT COALESCE(array_agg(p), ARRAY[]::TEXT[]) INTO v_paths
  FROM (
    SELECT COALESCE(i.storage_path, NULLIF(split_part(i.media_url, '/maipiks/', 2), '')) AS p
    FROM public.maipiks_story_items i
    JOIN public.maipiks_stories s ON s.id = i.story_id
    WHERE s.user_id = v_user_id
      AND (
        i.deleted_at IS NOT NULL
        OR (i.expires_at <= NOW() AND NOT EXISTS (
          SELECT 1 FROM public.maipiks_story_purchases p
          WHERE p.story_id = s.id
            AND p.status = 'completed'
            AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
        ))
      )
  ) q
  WHERE q.p IS NOT NULL;

  DELETE FROM public.maipiks_story_items i
  USING public.maipiks_stories s
  WHERE s.id = i.story_id
    AND s.user_id = v_user_id
    AND (
      i.deleted_at IS NOT NULL
      OR (i.expires_at <= NOW() AND NOT EXISTS (
        SELECT 1 FROM public.maipiks_story_purchases p
        WHERE p.story_id = s.id
          AND p.status = 'completed'
          AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
      ))
    );
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

  -- Containers with no live media left go away entirely.
  DELETE FROM public.maipiks_stories s
  WHERE s.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.maipiks_story_items i WHERE i.story_id = s.id
    );
  GET DIAGNOSTICS v_stories_deleted = ROW_COUNT;

  -- Keep surviving containers aligned with their newest media.
  UPDATE public.maipiks_stories s
  SET expires_at = sub.max_expiry,
      updated_at = NOW()
  FROM (
    SELECT story_id, MAX(expires_at) AS max_expiry
    FROM public.maipiks_story_items
    GROUP BY story_id
  ) sub
  WHERE s.id = sub.story_id
    AND s.user_id = v_user_id
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

COMMENT ON FUNCTION public.maipiks_purge_own_expired_stories() IS
  'Hard deletes the caller''s own expired story media plus the underlying storage objects. Safe to call from the app, needs no pg_cron.';

GRANT EXECUTE ON FUNCTION public.maipiks_purge_own_expired_stories() TO authenticated, service_role;

-- =============================================================================
-- PART 3: Global purge also reclaims orphaned uploads
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
  v_files_deleted INTEGER := 0;
  v_orphans_deleted INTEGER := 0;
BEGIN
  -- Collect storage paths before the rows disappear
  SELECT COALESCE(array_agg(p), ARRAY[]::TEXT[]) INTO v_paths
  FROM (
    SELECT COALESCE(i.storage_path, NULLIF(split_part(i.media_url, '/maipiks/', 2), '')) AS p
    FROM public.maipiks_story_items i
     JOIN public.maipiks_stories s ON s.id = i.story_id
     WHERE i.deleted_at IS NOT NULL
       OR (i.expires_at <= NOW() AND NOT EXISTS (
        SELECT 1 FROM public.maipiks_story_purchases p
        WHERE p.story_id = s.id
          AND p.status = 'completed'
          AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
       ))
  ) q
  WHERE q.p IS NOT NULL;

  DELETE FROM public.maipiks_story_items i
  USING public.maipiks_stories s
  WHERE s.id = i.story_id
    AND (
      i.deleted_at IS NOT NULL
      OR (i.expires_at <= NOW() AND NOT EXISTS (
        SELECT 1 FROM public.maipiks_story_purchases p
        WHERE p.story_id = s.id
          AND p.status = 'completed'
          AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
      ))
    );
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
  v_files_deleted := COALESCE(array_length(v_paths, 1), 0);

  /*
   * Reclaim uploads that never became a story row (a save that failed after the
   * file was written). These are invisible to the user and otherwise leak
   * forever. Feed posts share this bucket, so anything still referenced by a
   * post is left alone.
   */
  BEGIN
    DELETE FROM storage.objects o
    WHERE o.bucket_id = 'maipiks'
      AND o.created_at < NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.maipiks_story_items i
        WHERE i.storage_path = o.name
           OR split_part(i.media_url, '/maipiks/', 2) = o.name
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.maipiks_posts p
        WHERE p.media_url LIKE '%/maipiks/%'
          AND split_part(p.media_url, '/maipiks/', 2) = o.name
      );
    GET DIAGNOSTICS v_orphans_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_orphans_deleted := 0;
  END;

  RETURN jsonb_build_object(
    'items_deleted', v_items_deleted,
    'stories_deleted', v_stories_deleted,
    'files_deleted', v_files_deleted,
    'orphans_deleted', v_orphans_deleted,
    'ran_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.maipiks_purge_expired_stories() IS
  'Hard deletes MAI Piks story media older than 24h, the underlying storage objects, and uploads that never became a story row.';

GRANT EXECUTE ON FUNCTION public.maipiks_purge_expired_stories() TO service_role;

-- =============================================================================
-- PART 4: Best-effort pg_cron (optional — the app self-heals without it)
-- =============================================================================

-- pg_cron is not enabled on this project, so this block is expected to no-op.
-- The app calls `maipiks_purge_own_expired_stories` on load, and the
-- `maipiks-story-cleanup` edge function covers everyone else, so behaviour is
-- correct whether or not cron ever becomes available.
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
  RAISE NOTICE 'pg_cron not available; MAI Piks expiry relies on maipiks_purge_own_expired_stories and the maipiks-story-cleanup edge function: %', SQLERRM;
END $$;

COMMIT;