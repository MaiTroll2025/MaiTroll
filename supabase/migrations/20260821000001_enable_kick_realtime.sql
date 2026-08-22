-- Migration: Enable realtime for kick/ban tables and fix kick participant flag
-- Description:
--   1. Adds stream_kicks and stream_bans to supabase_realtime publication
--      so ViewerPage kick subscriptions fire instantly.
--   2. Updates moderator_kick_user to set stream_participants.removed = true
--      so the existing onParticipant handler catches kicks immediately.

-- ============================================================================
-- 1. Add tables to realtime publication
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_kicks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_bans;

-- ============================================================================
-- 2. Fix moderator_kick_user to set removed=true on stream_participants
-- ============================================================================
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
  v_target_display text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;
  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;
  IF p_stream_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and target are required."}'::jsonb;
  END IF;
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to moderate this stream."}'::jsonb;
  END IF;

  INSERT INTO public.stream_kicks (stream_id, user_id, kicked_by, created_by, reason, created_at)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.stream_bans
    SET banned_by = v_actor_id, created_by = v_actor_id,
        reason = COALESCE(p_reason, 'Kicked by moderator'), expires_at = v_expires_at
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.stream_bans (stream_id, user_id, banned_by, created_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), v_expires_at);
  END IF;

  UPDATE public.stream_seat_sessions
    SET status = 'kicked', kick_reason = COALESCE(p_reason, 'Kicked by moderator'), left_at = now()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active';

  UPDATE public.stream_participants
    SET status = 'kicked', removed = true, left_at = now()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  UPDATE public.user_profiles
    SET is_kicked = true, kicked_until = v_expires_at, last_kicked_at = now(), updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'kicked_from_live', 'Kicked from Stream',
    COALESCE(p_reason, 'Kicked by moderator'),
    jsonb_build_object('stream_id', p_stream_id, 'expires_at', v_expires_at)
  );

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'kick', 'Kick', v_actor_id, p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    COALESCE(p_reason, 'Kicked by moderator'), NULL,
    'active', 'kicked', v_expires_at, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'User kicked successfully.',
    'data', jsonb_build_object('expires_at', v_expires_at)
  );
END;
$$;
