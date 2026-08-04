-- Post retention cleanup for Troll Wall posts and related child rows.
-- This is intended to run server-side via pg_cron every 24 hours.
-- It only targets stale posts older than the configured retention window and skips exempt posts.

CREATE TABLE IF NOT EXISTS public.post_retention_cleanup_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_days INT NOT NULL DEFAULT 90,
    batch_size INT NOT NULL DEFAULT 1000,
    cutoff_at TIMESTAMPTZ NOT NULL,
    candidate_posts INT NOT NULL DEFAULT 0,
    deleted_posts INT NOT NULL DEFAULT 0,
    deleted_likes INT NOT NULL DEFAULT 0,
    deleted_gifts INT NOT NULL DEFAULT 0,
    deleted_reactions INT NOT NULL DEFAULT 0,
    deleted_shares INT NOT NULL DEFAULT 0,
    deleted_daily_login_posts INT NOT NULL DEFAULT 0,
    deleted_storage_objects INT NOT NULL DEFAULT 0,
    exempt_posts INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_wall_posts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'is_system_generated') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN is_system_generated BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'system_actor') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN system_actor TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'actor_user_id') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN actor_user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'stream_id') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN stream_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'activity_type') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN activity_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'expires_at') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN expires_at TIMESTAMPTZ;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'deleted_at') THEN
            ALTER TABLE public.troll_wall_posts ADD COLUMN deleted_at TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_troll_wall_post_retention(
    p_retention_days INT DEFAULT 90,
    p_batch_size INT DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, storage
AS $$
DECLARE
    v_retention_days INT := COALESCE(NULLIF(p_retention_days, 0), 90);
    v_batch_size INT := COALESCE(NULLIF(p_batch_size, 0), 1000);
    v_cutoff_at TIMESTAMPTZ := now() - (v_retention_days || ' days')::interval;
    v_candidate_posts INT := 0;
    v_candidate_count INT := 0;
    v_deleted_posts INT := 0;
    v_deleted_likes INT := 0;
    v_deleted_gifts INT := 0;
    v_deleted_reactions INT := 0;
    v_deleted_shares INT := 0;
    v_deleted_daily_login_posts INT := 0;
    v_deleted_storage_objects INT := 0;
    v_exempt_posts INT := 0;
    v_status TEXT := 'completed';
    v_notes TEXT := NULL;
    v_run_id UUID;
    v_batch_likes INT := 0;
    v_batch_gifts INT := 0;
    v_batch_reactions INT := 0;
    v_batch_shares INT := 0;
    v_batch_daily_login_posts INT := 0;
    v_batch_posts INT := 0;
    v_batch_storage_objects INT := 0;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _cleanup_post_candidates (post_id UUID PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS _cleanup_storage_objects (object_name TEXT PRIMARY KEY) ON COMMIT DROP;

    TRUNCATE _cleanup_post_candidates;
    TRUNCATE _cleanup_storage_objects;

    SELECT COUNT(*) INTO v_exempt_posts
    FROM public.troll_wall_posts
    WHERE created_at < v_cutoff_at
      AND (
          COALESCE(is_pinned, false) = true
          OR COALESCE((metadata->>'retention_exempt')::boolean, false) = true
          OR (
              COALESCE(is_system_generated, false) = true
              AND expires_at IS NOT NULL
              AND expires_at > now()
          )
      );

    LOOP
        TRUNCATE _cleanup_post_candidates;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'troll_wall_posts' AND column_name = 'deleted_at') THEN
            INSERT INTO _cleanup_post_candidates (post_id)
            SELECT id
            FROM public.troll_wall_posts
            WHERE created_at < v_cutoff_at
              AND deleted_at IS NULL
              AND COALESCE(is_pinned, false) IS DISTINCT FROM true
              AND COALESCE((metadata->>'retention_exempt')::boolean, false) IS DISTINCT FROM true
              AND NOT (
                  COALESCE(is_system_generated, false) = true
                  AND expires_at IS NOT NULL
                  AND expires_at > now()
              )
            ORDER BY created_at ASC
            LIMIT v_batch_size;
        ELSE
            INSERT INTO _cleanup_post_candidates (post_id)
            SELECT id
            FROM public.troll_wall_posts
            WHERE created_at < v_cutoff_at
              AND COALESCE(is_pinned, false) IS DISTINCT FROM true
              AND COALESCE((metadata->>'retention_exempt')::boolean, false) IS DISTINCT FROM true
              AND NOT (
                  COALESCE(is_system_generated, false) = true
                  AND expires_at IS NOT NULL
                  AND expires_at > now()
              )
            ORDER BY created_at ASC
            LIMIT v_batch_size;
        END IF;

        GET DIAGNOSTICS v_candidate_count = ROW_COUNT;
        EXIT WHEN v_candidate_count = 0;

        v_candidate_posts := v_candidate_posts + v_candidate_count;

        v_batch_likes := 0;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_wall_likes') THEN
            SELECT COUNT(*) INTO v_batch_likes
            FROM public.troll_wall_likes
            WHERE post_id IN (SELECT post_id FROM _cleanup_post_candidates);
        END IF;
        v_deleted_likes := v_deleted_likes + v_batch_likes;

        v_batch_gifts := 0;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_wall_gifts') THEN
            SELECT COUNT(*) INTO v_batch_gifts
            FROM public.troll_wall_gifts
            WHERE post_id IN (SELECT post_id FROM _cleanup_post_candidates);
        END IF;
        v_deleted_gifts := v_deleted_gifts + v_batch_gifts;

        v_batch_reactions := 0;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_wall_reactions') THEN
            SELECT COUNT(*) INTO v_batch_reactions
            FROM public.troll_wall_reactions
            WHERE post_id IN (SELECT post_id FROM _cleanup_post_candidates);
        END IF;
        v_deleted_reactions := v_deleted_reactions + v_batch_reactions;

        v_batch_shares := 0;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_wall_post_shares') THEN
            SELECT COUNT(*) INTO v_batch_shares
            FROM public.troll_wall_post_shares
            WHERE post_id IN (SELECT post_id FROM _cleanup_post_candidates);
        END IF;
        v_deleted_shares := v_deleted_shares + v_batch_shares;

        v_batch_daily_login_posts := 0;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_login_posts') THEN
            SELECT COUNT(*) INTO v_batch_daily_login_posts
            FROM public.daily_login_posts
            WHERE post_id IN (SELECT post_id FROM _cleanup_post_candidates);
        END IF;
        v_deleted_daily_login_posts := v_deleted_daily_login_posts + v_batch_daily_login_posts;

        INSERT INTO _cleanup_storage_objects (object_name)
        SELECT DISTINCT trim(both '/' from regexp_replace(
            regexp_replace(
                url,
                '^https?://[^/]+/storage/v1/object/public/post-media/',
                ''
            ),
            '[?#].*$',
            ''
        ))
        FROM (
            SELECT COALESCE(
                p.metadata->>'image_url',
                p.metadata->>'video_url'
            ) AS url
            FROM public.troll_wall_posts p
            JOIN _cleanup_post_candidates c ON c.post_id = p.id
            WHERE COALESCE(p.metadata->>'image_url', p.metadata->>'video_url') IS NOT NULL
        ) AS urls
        WHERE url LIKE '%/storage/v1/object/public/post-media/%';

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
            DELETE FROM storage.objects
            WHERE bucket_id = 'post-media'
              AND name IN (SELECT object_name FROM _cleanup_storage_objects)
              AND name IS NOT NULL;

            GET DIAGNOSTICS v_batch_storage_objects = ROW_COUNT;
            v_deleted_storage_objects := v_deleted_storage_objects + v_batch_storage_objects;
        END IF;

        DELETE FROM public.troll_wall_posts p
        USING _cleanup_post_candidates c
        WHERE p.id = c.post_id;

        GET DIAGNOSTICS v_batch_posts = ROW_COUNT;
        v_deleted_posts := v_deleted_posts + v_batch_posts;
    END LOOP;

    INSERT INTO public.post_retention_cleanup_runs (
        retention_days,
        batch_size,
        cutoff_at,
        candidate_posts,
        deleted_posts,
        deleted_likes,
        deleted_gifts,
        deleted_reactions,
        deleted_shares,
        deleted_daily_login_posts,
        deleted_storage_objects,
        exempt_posts,
        status,
        notes
    )
    VALUES (
        v_retention_days,
        v_batch_size,
        v_cutoff_at,
        v_candidate_posts,
        v_deleted_posts,
        v_deleted_likes,
        v_deleted_gifts,
        v_deleted_reactions,
        v_deleted_shares,
        v_deleted_daily_login_posts,
        v_deleted_storage_objects,
        v_exempt_posts,
        v_status,
        v_notes
    )
    RETURNING id INTO v_run_id;

    RETURN jsonb_build_object(
        'status', 'completed',
        'retention_days', v_retention_days,
        'batch_size', v_batch_size,
        'cutoff_at', v_cutoff_at,
        'deleted_posts', v_deleted_posts,
        'deleted_likes', v_deleted_likes,
        'deleted_gifts', v_deleted_gifts,
        'deleted_reactions', v_deleted_reactions,
        'deleted_shares', v_deleted_shares,
        'deleted_daily_login_posts', v_deleted_daily_login_posts,
        'deleted_storage_objects', v_deleted_storage_objects,
        'exempt_posts', v_exempt_posts,
        'run_id', v_run_id
    );
EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_notes := SQLERRM;

    INSERT INTO public.post_retention_cleanup_runs (
        retention_days,
        batch_size,
        cutoff_at,
        candidate_posts,
        deleted_posts,
        deleted_likes,
        deleted_gifts,
        deleted_reactions,
        deleted_shares,
        deleted_daily_login_posts,
        deleted_storage_objects,
        exempt_posts,
        status,
        notes
    )
    VALUES (
        v_retention_days,
        v_batch_size,
        v_cutoff_at,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        v_exempt_posts,
        v_status,
        v_notes
    );

    RETURN jsonb_build_object(
        'status', 'failed',
        'retention_days', v_retention_days,
        'batch_size', v_batch_size,
        'cutoff_at', v_cutoff_at,
        'error', v_notes
    );
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- cron.unschedule() throws if the job name does not exist yet.
        -- Make this migration idempotent across fresh/stale environments.
        IF EXISTS (
            SELECT 1
            FROM cron.job
            WHERE jobname = 'cleanup_troll_wall_post_retention_daily'
        ) THEN
            PERFORM cron.unschedule('cleanup_troll_wall_post_retention_daily');
        END IF;

        PERFORM cron.schedule(
            'cleanup_troll_wall_post_retention_daily',
            '0 3 * * *',
            $cron$SELECT public.cleanup_troll_wall_post_retention(90, 1000);$cron$
        );
    END IF;
END $$;


GRANT EXECUTE ON FUNCTION public.cleanup_troll_wall_post_retention(INT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.cleanup_troll_wall_post_retention(INT, INT) IS 'Deletes stale troll_wall_posts rows in batches, removes related child rows and post-media storage objects, and logs the run without storing post content.';
