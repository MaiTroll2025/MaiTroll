BEGIN;

ALTER TABLE public.maipiks_story_views
  ALTER COLUMN story_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS story_id UUID,
  ADD COLUMN IF NOT EXISTS story_owner_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

UPDATE public.maipiks_story_views v
SET story_id = i.story_id,
    story_owner_id = s.user_id
FROM public.maipiks_story_items i
JOIN public.maipiks_stories s ON s.id = i.story_id
WHERE i.id = v.story_item_id
  AND (v.story_id IS NULL OR v.story_owner_id IS NULL);

ALTER TABLE public.maipiks_story_views
  DROP CONSTRAINT IF EXISTS maipiks_story_views_story_item_id_fkey;

ALTER TABLE public.maipiks_story_views
  ADD CONSTRAINT maipiks_story_views_story_item_id_fkey
  FOREIGN KEY (story_item_id)
  REFERENCES public.maipiks_story_items(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maipiks_story_views_story_owner
  ON public.maipiks_story_views(story_id, story_owner_id, first_viewed_at DESC);

COMMENT ON COLUMN public.maipiks_story_views.story_id IS
  'Retained story identity so analytics survive hard deletion of expired media.';
COMMENT ON COLUMN public.maipiks_story_views.story_owner_id IS
  'Retained owner identity for story analytics after the story and media rows expire.';

CREATE OR REPLACE FUNCTION public.maipiks_validate_story_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story public.maipiks_stories%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.viewer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Viewer must be the authenticated user';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.story_item_id IS NOT NULL
    AND NEW.story_item_id IS NULL THEN
    NEW.story_id := OLD.story_id;
    NEW.story_owner_id := OLD.story_owner_id;
    RETURN NEW;
  END IF;

  SELECT s.* INTO v_story
  FROM public.maipiks_story_items i
  JOIN public.maipiks_stories s ON s.id = i.story_id
  WHERE i.id = NEW.story_item_id
    AND i.deleted_at IS NULL
    AND i.expires_at > NOW()
    AND s.deleted_at IS NULL
    AND s.expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Story media is unavailable';
  END IF;

  IF v_story.user_id <> auth.uid() THEN
    IF v_story.visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.user_follows
      WHERE follower_id = auth.uid()
        AND following_id = v_story.user_id
    ) THEN
      RAISE EXCEPTION 'You cannot view this story';
    END IF;

    IF v_story.visibility = 'private' AND NOT EXISTS (
      SELECT 1 FROM public.user_subscriptions
      WHERE subscriber_id = auth.uid()
        AND broadcaster_id = v_story.user_id
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    ) THEN
      RAISE EXCEPTION 'You cannot view this story';
    END IF;
  END IF;

  NEW.story_id := v_story.id;
  NEW.story_owner_id := v_story.user_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_validate_story_view() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_story_views_validate ON public.maipiks_story_views;
CREATE TRIGGER maipiks_story_views_validate
  BEFORE INSERT OR UPDATE ON public.maipiks_story_views
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_validate_story_view();

DROP POLICY IF EXISTS "maipiks_story_views_read_owner" ON public.maipiks_story_views;
CREATE POLICY "maipiks_story_views_read_owner" ON public.maipiks_story_views
  FOR SELECT USING (
    auth.uid() = viewer_user_id
    OR auth.uid() = story_owner_id
  );

COMMIT;