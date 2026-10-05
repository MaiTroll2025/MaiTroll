BEGIN;

ALTER TABLE public.maipiks_posts
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

UPDATE public.maipiks_posts
SET storage_path = NULLIF(split_part(media_url, '/maipiks/', 2), '')
WHERE storage_path IS NULL
  AND media_url LIKE '%/maipiks/%';

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'maipiks';

DROP POLICY IF EXISTS "maipiks_public_read" ON storage.objects;
DROP POLICY IF EXISTS "maipiks_authorized_read" ON storage.objects;
CREATE POLICY "maipiks_authorized_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'maipiks'
    AND (
      EXISTS (
        SELECT 1
        FROM public.maipiks_posts p
        WHERE p.storage_path = name
          AND p.deleted_at IS NULL
          AND (
            p.user_id = auth.uid()
            OR p.visibility = 'everyone'
            OR (
              p.visibility = 'followers'
              AND EXISTS (
                SELECT 1 FROM public.user_follows f
                WHERE f.follower_id = auth.uid()
                  AND f.following_id = p.user_id
              )
            )
            OR (
              p.visibility = 'private'
              AND EXISTS (
                SELECT 1 FROM public.user_subscriptions s
                WHERE s.subscriber_id = auth.uid()
                  AND s.broadcaster_id = p.user_id
                  AND s.is_active = TRUE
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.maipiks_story_items i
        JOIN public.maipiks_stories s ON s.id = i.story_id
        WHERE i.storage_path = name
          AND i.deleted_at IS NULL
          AND i.expires_at > NOW()
          AND s.deleted_at IS NULL
          AND s.expires_at > NOW()
          AND (
            s.user_id = auth.uid()
            OR s.visibility = 'everyone'
            OR (
              s.visibility = 'followers'
              AND EXISTS (
                SELECT 1 FROM public.user_follows f
                WHERE f.follower_id = auth.uid()
                  AND f.following_id = s.user_id
              )
            )
            OR (
              s.visibility = 'private'
              AND EXISTS (
                SELECT 1 FROM public.user_subscriptions sub
                WHERE sub.subscriber_id = auth.uid()
                  AND sub.broadcaster_id = s.user_id
                  AND sub.is_active = TRUE
              )
            )
          )
      )
    )
  );

COMMIT;