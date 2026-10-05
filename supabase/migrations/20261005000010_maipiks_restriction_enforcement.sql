BEGIN;

DROP POLICY IF EXISTS "maipiks_posts_view" ON public.maipiks_posts;
CREATE POLICY "maipiks_posts_view" ON public.maipiks_posts
  FOR SELECT USING (
    NOT public.user_is_restricted(auth.uid(), 'maipiks')
    AND deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = maipiks_posts.user_id)
           OR (b.blocker_id = maipiks_posts.user_id AND b.blocked_id = auth.uid()))
    )
    AND (
      auth.uid() = user_id
      OR visibility = 'everyone'
      OR (visibility = 'followers' AND EXISTS (
        SELECT 1 FROM public.user_follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = maipiks_posts.user_id
      ))
      OR (visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.subscriber_id = auth.uid()
          AND s.broadcaster_id = maipiks_posts.user_id
          AND s.is_active = TRUE
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ))
    )
  );

DROP POLICY IF EXISTS "maipiks_stories_view" ON public.maipiks_stories;
CREATE POLICY "maipiks_stories_view" ON public.maipiks_stories
  FOR SELECT USING (
    NOT public.user_is_restricted(auth.uid(), 'maipiks')
    AND deleted_at IS NULL
    AND (
      expires_at > NOW()
      OR EXISTS (
        SELECT 1 FROM public.maipiks_story_purchases p
        WHERE p.story_id = maipiks_stories.id
          AND p.purchaser_id = auth.uid()
          AND p.status = 'completed'
          AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
      )
    )
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = maipiks_stories.user_id)
           OR (b.blocker_id = maipiks_stories.user_id AND b.blocked_id = auth.uid()))
    )
    AND (
      auth.uid() = user_id
      OR visibility = 'everyone'
      OR (visibility = 'followers'
        AND EXISTS (SELECT 1 FROM public.user_follows f
                    WHERE f.follower_id = auth.uid() AND f.following_id = maipiks_stories.user_id)
        )
      OR (visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.subscriber_id = auth.uid()
          AND s.broadcaster_id = maipiks_stories.user_id
          AND s.is_active = TRUE
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
      ))
    )
  );

DROP POLICY IF EXISTS "maipiks_story_items_read" ON public.maipiks_story_items;
CREATE POLICY "maipiks_story_items_read" ON public.maipiks_story_items
  FOR SELECT USING (
    NOT public.user_is_restricted(auth.uid(), 'maipiks')
    AND deleted_at IS NULL
    AND expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM public.maipiks_stories s
      WHERE s.id = maipiks_story_items.story_id
        AND s.deleted_at IS NULL
        AND s.expires_at > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
             OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid())
        )
        AND (
          s.user_id = auth.uid()
          OR (s.visibility = 'everyone'
            AND public.maipiks_story_pricing(s.id)->>'has_access' = 'true')
          OR (s.visibility = 'followers' AND EXISTS (
            SELECT 1 FROM public.user_follows f
            WHERE f.follower_id = auth.uid() AND f.following_id = s.user_id
          ) AND public.maipiks_story_pricing(s.id)->>'has_access' = 'true')
          OR (s.visibility = 'private' AND public.maipiks_story_pricing(s.id)->>'has_access' = 'true')
        )
    )
  );

DROP POLICY IF EXISTS "maipiks_authorized_read" ON storage.objects;
CREATE POLICY "maipiks_authorized_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'maipiks'
    AND NOT public.user_is_restricted(auth.uid(), 'maipiks')
    AND (
      name LIKE 'moderation-evidence/%'
      AND public.can_review_maipiks_reports(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.maipiks_posts p
        WHERE p.storage_path = name
          AND p.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.user_id)
               OR (b.blocker_id = p.user_id AND b.blocked_id = auth.uid()))
          AND (p.user_id = auth.uid() OR p.visibility = 'everyone'
            OR (p.visibility = 'followers' AND EXISTS (
              SELECT 1 FROM public.user_follows f
              WHERE f.follower_id = auth.uid() AND f.following_id = p.user_id))
            OR (p.visibility = 'private' AND EXISTS (
              SELECT 1 FROM public.user_subscriptions s
              WHERE s.subscriber_id = auth.uid() AND s.broadcaster_id = p.user_id
                AND s.is_active = TRUE AND (s.expires_at IS NULL OR s.expires_at > NOW()))))
      )
      OR EXISTS (
        SELECT 1 FROM public.maipiks_story_items i
        JOIN public.maipiks_stories s ON s.id = i.story_id
        WHERE i.storage_path = name
          AND i.deleted_at IS NULL AND i.expires_at > NOW()
          AND s.deleted_at IS NULL AND s.expires_at > NOW()
          AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
            WHERE (b.blocker_id = auth.uid() AND b.blocked_id = s.user_id)
               OR (b.blocker_id = s.user_id AND b.blocked_id = auth.uid()))
          AND public.maipiks_story_pricing(s.id)->>'has_access' = 'true'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.maipiks_guard_restricted_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'maipiks_story_views' THEN
    v_user_id := NEW.viewer_user_id;
  ELSIF TG_TABLE_NAME = 'maipiks_story_tips' THEN
    v_user_id := NEW.tipper_user_id;
  ELSIF TG_TABLE_NAME = 'maipiks_story_purchases' THEN
    v_user_id := NEW.purchaser_id;
  END IF;

  IF public.user_is_restricted(v_user_id, 'maipiks') THEN
    RAISE EXCEPTION 'MAI Piks access is restricted';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_guard_restricted_interaction() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_views_restriction_guard ON public.maipiks_story_views;
CREATE TRIGGER maipiks_views_restriction_guard
  BEFORE INSERT OR UPDATE ON public.maipiks_story_views
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_guard_restricted_interaction();

DROP TRIGGER IF EXISTS maipiks_tips_restriction_guard ON public.maipiks_story_tips;
CREATE TRIGGER maipiks_tips_restriction_guard
  BEFORE INSERT ON public.maipiks_story_tips
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_guard_restricted_interaction();

DROP TRIGGER IF EXISTS maipiks_purchases_restriction_guard ON public.maipiks_story_purchases;
CREATE TRIGGER maipiks_purchases_restriction_guard
  BEFORE INSERT ON public.maipiks_story_purchases
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_guard_restricted_interaction();

CREATE OR REPLACE FUNCTION public.search_maipiks_by_hashtag(
  p_tag TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  content_type TEXT,
  content_id UUID,
  creator_id UUID,
  username TEXT,
  avatar_url TEXT,
  media_path TEXT,
  media_type TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag TEXT := LOWER(BTRIM(COALESCE(p_tag, '')));
  v_pattern TEXT;
  v_viewer UUID := auth.uid();
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
BEGIN
  v_tag := REGEXP_REPLACE(v_tag, '^#', '');
  IF v_tag !~ '^[a-z0-9_]{1,50}$' THEN
    RAISE EXCEPTION 'Invalid hashtag';
  END IF;
  IF v_viewer IS NOT NULL AND public.user_is_restricted(v_viewer, 'maipiks') THEN
    RETURN;
  END IF;
  v_pattern := '(^|[^[:alnum:]_])#' || v_tag || '([^[:alnum:]_]|$)';

  RETURN QUERY
  SELECT result.content_type, result.content_id, result.creator_id,
         result.username, result.avatar_url, result.media_path,
         result.media_type, result.caption, result.created_at, result.expires_at
  FROM (
    SELECT 'post'::TEXT AS content_type, p.id AS content_id, p.user_id AS creator_id,
           up.username, up.avatar_url,
           COALESCE(p.storage_path, NULLIF(SPLIT_PART(p.media_url, '/maipiks/', 2), '')) AS media_path,
           p.media_type, p.caption, p.created_at, NULL::TIMESTAMPTZ AS expires_at
    FROM public.maipiks_posts p
    JOIN public.user_profiles up ON up.id = p.user_id
    WHERE p.deleted_at IS NULL AND p.visibility = 'everyone' AND p.caption ~* v_pattern
      AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_viewer AND b.blocked_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_id = v_viewer))
    UNION ALL
    SELECT 'story'::TEXT AS content_type, i.id AS content_id, s.user_id AS creator_id,
           up.username, up.avatar_url,
           COALESCE(i.storage_path, NULLIF(SPLIT_PART(i.media_url, '/maipiks/', 2), '')) AS media_path,
           i.media_type, i.caption, i.created_at, i.expires_at
    FROM public.maipiks_story_items i
    JOIN public.maipiks_stories s ON s.id = i.story_id
    JOIN public.user_profiles up ON up.id = s.user_id
    WHERE i.deleted_at IS NULL AND i.expires_at > NOW()
      AND s.deleted_at IS NULL AND s.expires_at > NOW()
      AND s.visibility = 'everyone' AND s.monetization_mode = 'free'
      AND i.caption ~* v_pattern
      AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_viewer AND b.blocked_id = s.user_id)
           OR (b.blocker_id = s.user_id AND b.blocked_id = v_viewer))
  ) result
  ORDER BY result.created_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_maipiks_by_hashtag(TEXT, INTEGER) TO anon, authenticated, service_role;

COMMIT;