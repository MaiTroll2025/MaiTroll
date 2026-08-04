-- Remove hardcoded beta capacity restrictions from broadcast RPCs.
-- Caps are now controlled entirely through admin_settings.
-- If no admin cap is configured, no limit is enforced.
-- Camera quality cap (720p) and token TTL remain in the livekit-token edge function.

-- =============================================================================
-- 1. Update join_stream_as_viewer to enforce admin-configured viewer cap only
-- =============================================================================

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
  v_cap integer;
  v_cap_enabled boolean;
  v_restrictions_disabled boolean;
BEGIN
  -- At least one stable identity must be supplied.
  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'missing_identity',
      'viewer_count', 0, 'viewer_cap', NULL
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    -- Caller must be the authenticated user they claim to be.
    IF p_user_id <> auth.uid() THEN
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'identity_mismatch',
        'viewer_count', 0, 'viewer_cap', NULL
      );
    END IF;
  END IF;

  -- Lock the stream row so concurrent joins serialize on it.
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

  -- Only live, joinable streams accept viewers.
  IF v_stream.is_live IS DISTINCT FROM true
     OR COALESCE(v_stream.status, '') <> 'live' THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_live',
      'viewer_count', 0, 'viewer_cap', NULL
    );
  END IF;

  -- Read configured restrictions (same settings used by useBroadcastViewerCap).
  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_viewer_cap_enabled', false);
  v_cap := COALESCE(public._cap_setting_numeric('broadcast_viewer_cap_max', NULL)::integer, NULL);

  -- If all restrictions disabled, allow regardless of cap.
  IF NOT v_restrictions_disabled AND v_cap_enabled AND v_cap IS NOT NULL THEN
    -- Authoritative count of currently seated viewers in this stream.
    SELECT COUNT(*)
      INTO v_count
    FROM public.stream_viewers sv
    WHERE sv.stream_id = p_stream_id
      AND (
        (p_user_id IS NOT NULL AND sv.user_id = p_user_id)
        OR (p_guest_id IS NOT NULL AND sv.guest_id = p_guest_id)
      );

    -- Already present? Count them in the total (they already occupy a slot).
    -- If not present, count distinct other viewers and add 1 for the candidate.
    IF v_count = 0 THEN
      SELECT COUNT(*)
        INTO v_count
      FROM public.stream_viewers sv
      WHERE sv.stream_id = p_stream_id;

      IF v_count >= v_cap THEN
        RETURN jsonb_build_object(
          'allowed', false, 'reason', 'viewer_cap_reached',
          'viewer_count', v_count, 'viewer_cap', v_cap
        );
      END IF;
    END IF;
  END IF;

  -- Admit: insert an idempotent capacity row (one slot per viewer).
  BEGIN
    INSERT INTO public.stream_viewers (stream_id, user_id, guest_id, joined_at)
    VALUES (p_stream_id, p_user_id, NULLIF(p_guest_id, ''), now());
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- Count of seated viewers for the response.
  SELECT COUNT(*)
    INTO v_count
  FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', null,
    'viewer_count', v_count, 'viewer_cap', v_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;

-- =============================================================================
-- 2. Update start_broadcast_with_capacity_check to enforce admin-configured
--    start cap only (no hardcoded beta limit)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.start_broadcast_with_capacity_check(
  p_stream_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_active integer;
  v_cap integer;
  v_cap_enabled boolean;
  v_restrictions_disabled boolean;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'missing_stream_id',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Lock the caller's stream row (also enforces ownership below).
  SELECT *
    INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'stream_not_found',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Only the owner (or a service role) may start/activate this stream.
  IF v_stream.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_stream_owner',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Reconnecting to an already-active owned stream: never block.
  IF v_stream.is_live IS NOT DISTINCT FROM true
     AND COALESCE(v_stream.status, '') = 'live' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'already_live',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Read configured restrictions (same settings used by useBroadcastViewerCap).
  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_start_cap_enabled', false);
  v_cap := COALESCE(public._cap_setting_numeric('broadcast_start_cap_max', NULL)::integer, NULL);

  -- Count currently active broadcasts under a shared lock so concurrent starts
  -- serialize. Lock an arbitrary but stable settings row (the start cap max)
  -- to obtain a single serialization point without scanning every stream row.
  PERFORM 1
  FROM public.admin_settings
  WHERE setting_key = 'broadcast_start_cap_max'
  FOR UPDATE;

  SELECT COUNT(*)
    INTO v_active
  FROM public.streams s
  WHERE s.is_live IS NOT DISTINCT FROM true
    AND COALESCE(s.status, '') = 'live';

  IF NOT v_restrictions_disabled AND v_cap_enabled AND v_cap IS NOT NULL AND v_active >= v_cap THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'broadcast_start_cap_reached',
      'active_broadcasts', v_active, 'start_cap', v_cap
    );
  END IF;

  -- Atomically transition this stream to live. No hardcoded duration cap.
  UPDATE public.streams
  SET is_live = true,
      status = 'live',
      started_at = COALESCE(started_at, now())
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'started',
    'active_broadcasts', v_active,
    'start_cap', v_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_broadcast_with_capacity_check(uuid) TO authenticated, service_role;
