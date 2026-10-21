-- Table for Mai Voice restrictions (similar to kick/disable chat)
CREATE TABLE IF NOT EXISTS public.mai_voice_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  room_kind TEXT CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID,
  reason TEXT,
  restricted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  restricted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mai_voice_restrictions_active_unique UNIQUE (user_id, room_kind, room_id) WHERE revoked_at IS NULL
);

CREATE INDEX IF NOT EXISTS mai_voice_restrictions_user_idx
  ON public.mai_voice_restrictions (user_id, restricted_at DESC);
CREATE INDEX IF NOT EXISTS mai_voice_restrictions_room_idx
  ON public.mai_voice_restrictions (room_kind, room_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mai_voice_restrictions_expires_idx
  ON public.mai_voice_restrictions (expires_at) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE public.mai_voice_restrictions ENABLE ROW LEVEL SECURITY;

-- Users can see their own restrictions
DROP POLICY IF EXISTS mai_voice_restrictions_select_own ON public.mai_voice_restrictions;
CREATE POLICY mai_voice_restrictions_select_own ON public.mai_voice_restrictions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Function to check if user is voice-restricted in a room
CREATE OR REPLACE FUNCTION public.is_mai_voice_restricted(
  p_user_id UUID,
  p_room_kind TEXT DEFAULT NULL,
  p_room_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check for global restriction (room_kind/room_id null)
  IF EXISTS (
    SELECT 1 FROM public.mai_voice_restrictions
    WHERE user_id = p_user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
      AND room_kind IS NULL
      AND room_id IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check for room-specific restriction
  IF p_room_kind IS NOT NULL AND p_room_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.mai_voice_restrictions
      WHERE user_id = p_user_id
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND room_kind = p_room_kind
        AND room_id = p_room_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
;

GRANT EXECUTE ON FUNCTION public.is_mai_voice_restricted(UUID, TEXT, UUID) TO authenticated, service_role;

-- Function to apply mai voice restriction (mod action)
CREATE OR REPLACE FUNCTION public.moderator_mai_voice_restrict(
  p_stream_id UUID DEFAULT NULL,
  p_room_kind TEXT DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_target_user_id UUID,
  p_restricted_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  v_restriction_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_room_kind TEXT;
  v_room_id UUID;
BEGIN
  -- Determine room
  IF p_room_kind IS NOT NULL AND p_room_id IS NOT NULL THEN
    v_room_kind := p_room_kind;
    v_room_id := p_room_id;
  ELSIF p_stream_id IS NOT NULL THEN
    v_room_kind := 'stream';
    v_room_id := p_stream_id;
  ELSE
    v_room_kind := NULL;
    v_room_id := NULL;
  END IF;

  IF p_duration_minutes IS NOT NULL AND p_duration_minutes > 0 THEN
    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::interval;
  END IF;

  -- Revoke existing active restriction if any
  UPDATE public.mai_voice_restrictions
  SET revoked_at = NOW(),
      revoked_by = p_restricted_by,
      revoke_reason = 'Replaced by new restriction',
      updated_at = NOW()
  WHERE user_id = p_target_user_id
    AND revoked_at IS NULL
    AND (
      (room_kind IS NULL AND room_id IS NULL AND v_room_kind IS NULL) OR
      (room_kind = v_room_kind AND room_id = v_room_id)
    );

  -- Create new restriction
  INSERT INTO public.mai_voice_restrictions (
    user_id, room_kind, room_id, reason, restricted_by, expires_at
  ) VALUES (
    p_target_user_id, v_room_kind, v_room_id, p_reason, p_restricted_by, v_expires_at
  )
  RETURNING id INTO v_restriction_id;

  -- Log to broadcast_mod_actions if possible
  BEGIN
    INSERT INTO public.broadcast_mod_actions (
      action_type, action_name, actor_id, target_user_id,
      broadcast_id, stream_id, reason, duration_minutes,
      expires_at, status, success, created_at, updated_at
    ) VALUES (
      'mai_voice_restriction', 'Mai Voice Restriction',
      p_restricted_by, p_target_user_id,
      v_room_id, CASE WHEN v_room_kind = 'stream' THEN v_room_id ELSE NULL END,
      p_reason, p_duration_minutes, v_expires_at, 'active', true, NOW(), NOW()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Ignore audit log errors
      NULL;
  END;

  RETURN jsonb_build_object('success', true, restriction_id: v_restriction_id, expires_at: v_expires_at);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
;

GRANT EXECUTE ON FUNCTION public.moderator_mai_voice_restrict(UUID, TEXT, UUID, UUID, UUID, TEXT, INTEGER) TO authenticated, service_role;

-- Function to remove/revoke mai voice restriction
CREATE OR REPLACE FUNCTION public.moderator_mai_voice_unrestrict(
  p_target_user_id UUID,
  p_revoked_by UUID DEFAULT NULL,
  p_room_kind TEXT DEFAULT NULL,
  p_room_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
BEGIN
  UPDATE public.mai_voice_restrictions
  SET revoked_at = NOW(),
      revoked_by = p_revoked_by,
      revoke_reason = COALESCE(p_reason, 'Removed by moderator'),
      updated_at = NOW()
  WHERE user_id = p_target_user_id
    AND revoked_at IS NULL
    AND (
      (p_room_kind IS NULL AND p_room_id IS NULL) OR
      (room_kind IS NOT DISTINCT FROM p_room_kind AND room_id IS NOT DISTINCT FROM p_room_id)
    );

  -- Log action
  BEGIN
    INSERT INTO public.broadcast_mod_actions (
      action_type, action_name, actor_id, target_user_id,
      reason, status, success, created_at, updated_at
    ) VALUES (
      'mai_voice_unrestrict', 'Mai Voice Restriction Removed',
      p_revoked_by, p_target_user_id,
      p_reason, 'completed', true, NOW(), NOW()
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
;

GRANT EXECUTE ON FUNCTION public.moderator_mai_voice_unrestrict(UUID, UUID, TEXT, UUID, TEXT) TO authenticated, service_role;

-- Update broadcast_mod_actions action_type check to include new actions
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcast_mod_actions_action_type_check'
      AND conrelid = 'public.broadcast_mod_actions'::regclass
  ) THEN
    ALTER TABLE public.broadcast_mod_actions
      DROP CONSTRAINT broadcast_mod_actions_action_type_check;
  END IF;
END $;

ALTER TABLE public.broadcast_mod_actions
  ADD CONSTRAINT broadcast_mod_actions_action_type_check
  CHECK (action_type IN (
    'disable_chat','enable_chat','kick','arrest',
    'disable_broadcast','enable_broadcast',
    'disable_hytrogame','enable_hytrogame',
    'disable_seat_joining','enable_seat_joining',
    'report','mute','unmute','warn','warning','platform_review','fine',
    'suspend_license','grant_license','remove_officer','set_to_user','end_stream',
    'mai_voice_restriction','mai_voice_unrestrict'
  ));
