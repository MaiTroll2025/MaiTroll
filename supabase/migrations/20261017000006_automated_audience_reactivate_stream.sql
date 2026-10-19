CREATE OR REPLACE FUNCTION public.automated_audience_activate(
  p_stream_id uuid,
  p_admin_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream jsonb;
  v_owner_id text;
  v_session_id uuid;
  v_previous_status text;
BEGIN
  SELECT to_jsonb(s) INTO v_stream
  FROM public.streams s
  WHERE s.id = p_stream_id;

  IF v_stream IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  v_owner_id := COALESCE(v_stream->>'broadcaster_id', v_stream->>'user_id');
  IF v_owner_id IS DISTINCT FROM p_admin_user_id::text THEN
    RAISE EXCEPTION 'Broadcast is not owned by the designated administrator';
  END IF;

  IF lower(COALESCE(v_stream->>'status', '')) <> 'live'
     OR lower(COALESCE(v_stream->>'is_live', 'false')) <> 'true' THEN
    RAISE EXCEPTION 'Broadcast is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.automated_audience_settings
    WHERE singleton AND enabled
  ) THEN
    RAISE EXCEPTION 'Automated audience service is disabled';
  END IF;

  SELECT status INTO v_previous_status
  FROM public.automated_audience_sessions
  WHERE stream_id = p_stream_id;

  INSERT INTO public.automated_audience_sessions (
    stream_id, admin_user_id, status, next_action_at, ended_at, updated_at
  )
  VALUES (p_stream_id, p_admin_user_id, 'active', now(), NULL, now())
  ON CONFLICT (stream_id) DO UPDATE
  SET status = 'active',
      next_action_at = now(),
      ended_at = NULL,
      updated_at = now()
  RETURNING id INTO v_session_id;

  INSERT INTO public.automated_audience_logs (
    session_id, stream_id, actor_id, event_type, details
  )
  VALUES (
    v_session_id, p_stream_id, p_admin_user_id, 'activation_requested',
    jsonb_build_object('previous_status', v_previous_status)
  );

  RETURN v_session_id;
END;
$$;
