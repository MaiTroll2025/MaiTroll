-- Allow broadcasters to lock/unlock their own chat via set_broadcaster_moderation_lock.
-- Previously only admins / officers could call this RPC. Broadcasters must be able
-- to control their own broadcast chat lock from BroadcastPage.

CREATE OR REPLACE FUNCTION public.set_broadcaster_moderation_lock(
  p_broadcaster_id UUID,
  p_chat_disabled BOOLEAN DEFAULT NULL,
  p_mic_muted BOOLEAN DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_chat_disabled_until TIMESTAMPTZ DEFAULT NULL,
  p_chat_disable_strike_count INTEGER DEFAULT NULL,
  p_chat_disabled_stream_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor public.user_profiles%ROWTYPE;
  v_is_broadcaster BOOLEAN;
  v_chat_disabled BOOLEAN;
  v_mic_muted BOOLEAN;
  v_chat_disabled_until TIMESTAMPTZ;
  v_chat_disable_strike_count INTEGER;
  v_chat_disabled_stream_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT *
    INTO v_actor
  FROM public.user_profiles
  WHERE id = v_actor_id;

  IF NOT COALESCE(v_actor.is_admin, false)
     AND NOT COALESCE(v_actor.is_troll_officer, false)
     AND NOT COALESCE(v_actor.is_lead_officer, false)
     AND COALESCE(v_actor.role, '') NOT IN ('admin', 'troll_officer', 'lead_troll_officer')
     AND COALESCE(v_actor.troll_role, '') NOT IN ('admin', 'troll_officer', 'lead_troll_officer') THEN
    -- Allow the broadcaster to lock/unlock their own chat.
    SELECT (v_actor_id = p_broadcaster_id) INTO v_is_broadcaster;
    IF NOT v_is_broadcaster THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;
  END IF;

  UPDATE public.user_profiles
  SET
    broadcast_chat_disabled = COALESCE(p_chat_disabled, broadcast_chat_disabled),
    broadcast_chat_disabled_until = CASE
      WHEN p_chat_disabled = false THEN NULL
      ELSE COALESCE(p_chat_disabled_until, broadcast_chat_disabled_until)
    END,
    broadcast_chat_disable_strike_count = CASE
      WHEN p_chat_disabled = false THEN 0
      ELSE COALESCE(p_chat_disable_strike_count, broadcast_chat_disable_strike_count)
    END,
    broadcast_chat_disabled_stream_id = CASE
      WHEN p_chat_disabled = false THEN NULL
      ELSE COALESCE(p_chat_disabled_stream_id, broadcast_chat_disabled_stream_id)
    END,
    broadcast_mic_muted = COALESCE(p_mic_muted, broadcast_mic_muted),
    updated_at = now()
  WHERE id = p_broadcaster_id
  RETURNING
    broadcast_chat_disabled,
    broadcast_mic_muted,
    broadcast_chat_disabled_until,
    broadcast_chat_disable_strike_count,
    broadcast_chat_disabled_stream_id
  INTO
    v_chat_disabled,
    v_mic_muted,
    v_chat_disabled_until,
    v_chat_disable_strike_count,
    v_chat_disabled_stream_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcaster not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'broadcaster_id', p_broadcaster_id,
    'broadcast_chat_disabled', v_chat_disabled,
    'broadcast_mic_muted', v_mic_muted,
    'broadcast_chat_disabled_until', v_chat_disabled_until,
    'broadcast_chat_disable_strike_count', v_chat_disable_strike_count,
    'broadcast_chat_disabled_stream_id', v_chat_disabled_stream_id,
    'reason', COALESCE(p_reason, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_broadcaster_moderation_lock(UUID, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, INTEGER, UUID) TO authenticated;
