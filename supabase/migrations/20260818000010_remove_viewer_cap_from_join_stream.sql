-- Remove artificial MaiTroll viewer cap enforcement from join_stream_as_viewer.
-- Audience presence tracking (stream_viewers insert) is preserved.
-- The function now always allows joining and always records the viewer slot.

CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_count integer;
BEGIN
  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'missing_identity',
      'viewer_count', 0, 'viewer_cap', NULL
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF p_user_id <> auth.uid() THEN
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'identity_mismatch',
        'viewer_count', 0, 'viewer_cap', NULL
      );
    END IF;
  END IF;

  SELECT *
    INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_found',
      'viewer_count', 0, 'viewer_cap', NULL
    );
  END IF;

  IF v_stream.is_live IS DISTINCT FROM true
     OR COALESCE(v_stream.status, '') <> 'live' THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_live',
      'viewer_count', 0, 'viewer_cap', NULL
    );
  END IF;

  -- Admit: insert an idempotent capacity row (one slot per viewer).
  BEGIN
    INSERT INTO public.stream_viewers (stream_id, user_id, guest_id, joined_at)
    VALUES (p_stream_id, p_user_id, NULLIF(p_guest_id, ''), now());
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  SELECT COUNT(*)
    INTO v_count
  FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', null,
    'viewer_count', v_count, 'viewer_cap', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;
