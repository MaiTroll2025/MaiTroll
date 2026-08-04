-- Reliable broadcast moderation actions.
-- Keeps authorization in SECURITY DEFINER RPCs so client buttons are not blocked by RLS drift.

CREATE TABLE IF NOT EXISTS public.chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  blocked_by uuid REFERENCES public.user_profiles(id),
  expires_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_kicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  kicked_by uuid REFERENCES public.user_profiles(id),
  created_by uuid REFERENCES public.user_profiles(id),
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stream_mutes
  ADD COLUMN IF NOT EXISTS muted_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.stream_kicks
  ADD COLUMN IF NOT EXISTS kicked_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.stream_bans
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_moderate_stream(
  p_stream_id uuid,
  p_actor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
  v_allowed boolean := false;
BEGIN
  IF p_stream_id IS NULL OR p_actor_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_host_id
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_host_id = p_actor_id THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_actor_id
      AND (
        role IN ('admin', 'moderator', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney', 'ceo')
        OR troll_role IN ('admin', 'moderator', 'lead_troll_officer', 'troll_officer')
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_troll_officer, false) = true
        OR COALESCE(is_lead_officer, false) = true
      )
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.stream_moderators
    WHERE broadcaster_id = v_host_id
      AND user_id = p_actor_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_mute_user(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_duration_minutes integer DEFAULT 5,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_host_id uuid;
  v_expires_at timestamptz := now() + make_interval(mins => GREATEST(COALESCE(p_duration_minutes, 5), 1));
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT user_id INTO v_host_id FROM public.streams WHERE id = p_stream_id;

  UPDATE public.stream_mutes
  SET muted_by = v_actor_id,
      expires_at = v_expires_at,
      reason = COALESCE(p_reason, 'Muted by moderator'),
      created_at = now()
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.stream_mutes (stream_id, user_id, muted_by, expires_at, reason)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires_at, COALESCE(p_reason, 'Muted by moderator'));
  END IF;

  IF p_target_user_id = v_host_id THEN
    UPDATE public.user_profiles
    SET broadcast_mic_muted = true
    WHERE id = p_target_user_id;
  END IF;

  UPDATE public.stream_participants
  SET mic_muted = true
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_unmute_user(
  p_stream_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_host_id uuid;
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  SELECT user_id INTO v_host_id FROM public.streams WHERE id = p_stream_id;

  DELETE FROM public.stream_mutes
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  IF p_target_user_id = v_host_id THEN
    UPDATE public.user_profiles
    SET broadcast_mic_muted = false
    WHERE id = p_target_user_id;
  END IF;

  UPDATE public.stream_participants
  SET mic_muted = false
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_disable_chat(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_duration_minutes integer DEFAULT 5,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_expires_at timestamptz := now() + make_interval(mins => GREATEST(COALESCE(p_duration_minutes, 5), 1));
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  UPDATE public.chat_blocks
  SET blocked_by = v_actor_id,
      expires_at = v_expires_at,
      reason = COALESCE(p_reason, 'Chat disabled by moderator'),
      created_at = now()
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.chat_blocks (stream_id, user_id, blocked_by, expires_at, reason)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires_at, COALESCE(p_reason, 'Chat disabled by moderator'));
  END IF;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.moderator_delete_stream_message(
  p_stream_id uuid,
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  DELETE FROM public.stream_messages
  WHERE id = p_message_id
    AND stream_id = p_stream_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_moderate_stream(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_mute_user(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_unmute_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_disable_chat(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_kick_user(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_delete_stream_message(uuid, uuid) TO authenticated;
