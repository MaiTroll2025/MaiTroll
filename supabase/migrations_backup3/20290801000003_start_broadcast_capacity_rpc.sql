-- Authoritative, concurrency-safe broadcast START capacity check.
--
-- Before a broadcaster creates a new live broadcast, this counts currently
-- active broadcasts (canonical definition: is_live = true AND status = 'live')
-- under a row lock on a shared settings/capacity row, and rejects the start
-- when the configured limit is reached. When allowed, it atomically transitions
-- the owner's target stream to live. Reconnecting the owner to their already
-- live stream is NOT blocked.
--
-- The count + activation are a single transaction so two broadcasters racing for
-- the final start slot cannot both succeed.

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
  v_hard_cap constant integer := 200; -- absolute ceiling regardless of config
  v_fallback_cap constant integer := 25;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'missing_stream_id',
      'active_broadcasts', 0, 'start_cap', v_fallback_cap);
  END IF;

  -- Lock the caller's stream row (also enforces ownership below).
  SELECT *
    INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'stream_not_found',
      'active_broadcasts', 0, 'start_cap', v_fallback_cap);
  END IF;

  -- Only the owner (or a service role) may start/activate this stream.
  IF v_stream.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_stream_owner',
      'active_broadcasts', 0, 'start_cap', v_fallback_cap);
  END IF;

  -- Reconnecting to an already-active owned stream: never block.
  IF v_stream.is_live IS NOT DISTINCT FROM true
     AND COALESCE(v_stream.status, '') = 'live' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'already_live',
      'active_broadcasts', 0, 'start_cap', v_fallback_cap);
  END IF;

  -- Read configured restrictions (same settings used by useBroadcastViewerCap).
  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_start_cap_enabled', false);
  v_cap := LEAST(
    v_hard_cap,
    GREATEST(
      1,
      COALESCE(public._cap_setting_numeric('broadcast_start_cap_max', v_fallback_cap)::integer, v_fallback_cap)
    )
  );

  -- Count currently active broadcasts under a shared lock so concurrent starts
  -- serialize. Lock an arbitrary but stable settings row (the viewer cap max)
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

  IF NOT v_restrictions_disabled AND v_cap_enabled AND v_active >= v_cap THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'broadcast_start_cap_reached',
      'active_broadcasts', v_active, 'start_cap', v_cap
    );
  END IF;

  -- Atomically transition this stream to live.
  UPDATE public.streams
  SET is_live = true,
      status = 'live',
      started_at = COALESCE(started_at, now())
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true, 'reason', 'started',
    'active_broadcasts', v_active, 'start_cap', v_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_broadcast_with_capacity_check(uuid) TO authenticated, service_role;
