BEGIN;

CREATE OR REPLACE FUNCTION public.maipiks_add_story_item(
  p_media_url TEXT,
  p_media_type TEXT,
  p_visibility TEXT,
  p_storage_path TEXT,
  p_thumbnail_url TEXT,
  p_caption TEXT,
  p_duration_ms INTEGER,
  p_lifetime_hours INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_story_id UUID;
  v_item_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_lifetime_hours IS NULL OR p_lifetime_hours < 1 OR p_lifetime_hours > 720 THEN
    RAISE EXCEPTION 'Story duration must be between 1 and 720 hours';
  END IF;

  v_result := public.maipiks_add_story_item(
    p_media_url,
    p_media_type,
    p_visibility,
    p_storage_path,
    p_thumbnail_url,
    p_caption,
    p_duration_ms
  );

  v_story_id := (v_result->>'story_id')::UUID;
  v_item_id := (v_result->>'item_id')::UUID;
  v_expires_at := NOW() + make_interval(hours => p_lifetime_hours);

  UPDATE public.maipiks_story_items
  SET expires_at = v_expires_at
  WHERE id = v_item_id;

  UPDATE public.maipiks_stories s
  SET expires_at = (
        SELECT MAX(i.expires_at)
        FROM public.maipiks_story_items i
        WHERE i.story_id = s.id
      ),
      updated_at = NOW()
  WHERE s.id = v_story_id;

  RETURN v_result || jsonb_build_object('expires_at', v_expires_at);
END;
$$;

COMMENT ON FUNCTION public.maipiks_add_story_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) IS
  'Adds story media with a server-validated lifetime between 1 and 720 hours.';

GRANT EXECUTE ON FUNCTION public.maipiks_add_story_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
  TO authenticated, service_role;

COMMIT;