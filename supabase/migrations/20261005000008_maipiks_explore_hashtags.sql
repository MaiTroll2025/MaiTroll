BEGIN;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_blocker_blocked_unique UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_read_participants" ON public.user_blocks;
CREATE POLICY "user_blocks_read_participants" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "user_blocks_insert_own" ON public.user_blocks;
CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

DROP POLICY IF EXISTS "user_blocks_delete_own" ON public.user_blocks;
CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

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
  v_pattern := '(^|[^[:alnum:]_])#' || v_tag || '([^[:alnum:]_]|$)';

  RETURN QUERY
  SELECT result.content_type, result.content_id, result.creator_id,
         result.username, result.avatar_url, result.media_path,
         result.media_type, result.caption, result.created_at, result.expires_at
  FROM (
    SELECT 'post'::TEXT AS content_type,
           p.id AS content_id,
           p.user_id AS creator_id,
           up.username,
           up.avatar_url,
           COALESCE(p.storage_path, NULLIF(SPLIT_PART(p.media_url, '/maipiks/', 2), '')) AS media_path,
           p.media_type,
           p.caption,
           p.created_at,
           NULL::TIMESTAMPTZ AS expires_at
    FROM public.maipiks_posts p
    JOIN public.user_profiles up ON up.id = p.user_id
    WHERE p.deleted_at IS NULL
      AND p.visibility = 'everyone'
      AND p.caption ~* v_pattern
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_viewer AND b.blocked_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_id = v_viewer)
      )

    UNION ALL

    SELECT 'story'::TEXT AS content_type,
           i.id AS content_id,
           s.user_id AS creator_id,
           up.username,
           up.avatar_url,
           COALESCE(i.storage_path, NULLIF(SPLIT_PART(i.media_url, '/maipiks/', 2), '')) AS media_path,
           i.media_type,
           i.caption,
           i.created_at,
           i.expires_at
    FROM public.maipiks_story_items i
    JOIN public.maipiks_stories s ON s.id = i.story_id
    JOIN public.user_profiles up ON up.id = s.user_id
    WHERE i.deleted_at IS NULL
      AND i.expires_at > NOW()
      AND s.deleted_at IS NULL
      AND s.expires_at > NOW()
      AND s.visibility = 'everyone'
      AND s.monetization_mode = 'free'
      AND i.caption ~* v_pattern
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_viewer AND b.blocked_id = s.user_id)
           OR (b.blocker_id = s.user_id AND b.blocked_id = v_viewer)
      )
  ) result
  ORDER BY result.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_maipiks_by_hashtag(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_maipiks_by_hashtag(TEXT, INTEGER) TO anon, authenticated, service_role;

COMMIT;