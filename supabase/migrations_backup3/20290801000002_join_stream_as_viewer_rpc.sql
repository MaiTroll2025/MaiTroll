-- Authoritative, concurrency-safe viewer admission for the broadcast viewer cap.
--
-- Enforces the admin-configured broadcast viewer cap at the database boundary.
-- No client-side array length, ref, or realtime count is trusted. The whole
-- admission (validate stream -> read cap config -> count active rows under a
-- FOR UPDATE row lock -> reject-or-insert) happens in one transaction so two
-- viewers racing for the final slot cannot both succeed.
--
-- One slot per viewer is guaranteed by the unique constraints on stream_viewers
-- (stream_viewers_stream_user_uniq / stream_viewers_stream_guest_uniq), and the
-- INSERT ... ON CONFLICT DO NOTHING makes re-joins idempotent (no double slot).
--
-- Capacity ledger = public.stream_viewers (covers both authenticated users and
-- anonymous guests). The gifting-focused stream_audience_presence table is NOT
-- used for capacity counting.

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
  v_fallback_cap constant integer := 20; -- safe fallback if settings missing
  v_hard_cap constant integer := 100;    -- absolute ceiling regardless of config
BEGIN
  -- At least one stable identity must be supplied.
  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'missing_identity',
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    -- Caller must be the authenticated user they claim to be.
    IF p_user_id <> auth.uid() THEN
      RETURN jsonb_build_object(
        'allowed', false, 'reason', 'identity_mismatch',
        'viewer_count', 0, 'viewer_cap', v_fallback_cap
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
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  -- Only live, joinable streams accept viewers.
  IF v_stream.is_live IS DISTINCT FROM true
     OR COALESCE(v_stream.status, '') <> 'live' THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'stream_not_live',
      'viewer_count', 0, 'viewer_cap', v_fallback_cap
    );
  END IF;

  -- Read configured restrictions (same settings used by useBroadcastViewerCap).
  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_viewer_cap_enabled', false);
  v_cap := LEAST(
    v_hard_cap,
    GREATEST(
      1,
      COALESCE(public._cap_setting_numeric('broadcast_viewer_cap_max', v_fallback_cap)::integer, v_fallback_cap)
    )
  );

  -- If all restrictions disabled, allow regardless of cap.
  IF NOT v_restrictions_disabled AND v_cap_enabled THEN
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

  -- Recompute authoritative occupancy for the response.
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

-- Release a viewer's capacity slot (used when LiveKit join fails or viewer leaves).
-- A user can only release their own slot (user_id) or their own guest slot.
CREATE OR REPLACE FUNCTION public.leave_stream_as_viewer(
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
  v_deleted integer := 0;
BEGIN
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('released', false, 'reason', 'identity_mismatch');
  END IF;

  DELETE FROM public.stream_viewers sv
  WHERE sv.stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND sv.user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND sv.guest_id = p_guest_id)
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('released', true, 'rows', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(uuid, uuid, text) TO authenticated, anon, service_role;
