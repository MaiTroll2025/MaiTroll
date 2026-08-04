-- Ensure staff/officer kicks actually remove targets from active broadcast presence.
-- Handles both auth users (user_id) and guest identities (guest_id text).

CREATE OR REPLACE FUNCTION public.moderator_kick_user(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_expires_at timestamptz := now() + interval '24 hours';
  v_identity_text text := p_target_user_id::text;
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  INSERT INTO public.stream_kicks (stream_id, user_id, kicked_by, created_by, reason)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'));

  UPDATE public.stream_bans
  SET banned_by = v_actor_id,
      created_by = v_actor_id,
      reason = COALESCE(p_reason, 'Kicked by moderator'),
      expires_at = v_expires_at
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.stream_bans (stream_id, user_id, banned_by, created_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), v_expires_at);
  END IF;

  -- Mark active seat sessions as kicked (supports both user_id and guest_id identities).
  UPDATE public.stream_seat_sessions
  SET status = 'kicked',
      kick_reason = COALESCE(p_reason, 'Kicked by moderator'),
      left_at = now()
  WHERE stream_id = p_stream_id
    AND status = 'active'
    AND (
      user_id = p_target_user_id
      OR guest_id = v_identity_text
    );

  -- Remove participant rows from legacy presence table.
  DELETE FROM public.stream_participants
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  -- Remove live viewer heartbeat rows so UI updates immediately.
  DELETE FROM public.stream_viewers
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderator_kick_user(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
