-- Compatibility fix for older stream ban notification triggers that read NEW.created_by.
-- The moderation RPC primarily uses banned_by/kicked_by, but created_by must be present too.

ALTER TABLE public.stream_kicks
  ADD COLUMN IF NOT EXISTS kicked_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.stream_bans
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

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

  UPDATE public.stream_seat_sessions
  SET status = 'kicked',
      kick_reason = COALESCE(p_reason, 'Kicked by moderator'),
      left_at = now()
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id
    AND status = 'active';

  DELETE FROM public.stream_participants
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderator_kick_user(uuid, uuid, text) TO authenticated;
