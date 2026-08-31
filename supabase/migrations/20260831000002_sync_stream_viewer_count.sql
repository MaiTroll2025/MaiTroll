-- Sync stream_viewers presence into streams.current_viewers so realtime
-- subscribers (homepage tiles, viewer tracking, etc.) receive live count updates.

-- 1) Ensure the RPC used by the host/officer path exists.
CREATE OR REPLACE FUNCTION public.update_stream_viewer_count(
  p_stream_id UUID,
  p_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.streams
  SET current_viewers = GREATEST(0, p_count),
      updated_at = NOW()
  WHERE id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(UUID, INTEGER) TO authenticated, anon, service_role;

-- 2) Fix join_stream_as_viewer to also sync streams.current_viewers on every join.
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

  UPDATE public.streams
  SET current_viewers = v_count,
      updated_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', null,
    'viewer_count', v_count, 'viewer_cap', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;

-- 3) Create leave_stream_as_viewer so releaseViewerSlot() works.
CREATE OR REPLACE FUNCTION public.leave_stream_as_viewer(
  p_stream_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing stream_id');
  END IF;

  DELETE FROM public.stream_viewers
  WHERE stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND guest_id = p_guest_id)
    );

  SELECT COUNT(*)
    INTO v_count
  FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id;

  UPDATE public.streams
  SET current_viewers = GREATEST(0, v_count),
      updated_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'stream_id', p_stream_id,
    'user_id', p_user_id,
    'guest_id', p_guest_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(UUID, UUID, TEXT) TO authenticated, anon, service_role;
