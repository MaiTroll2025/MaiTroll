-- =============================================================================
-- Migration: Role Invitation System
-- =============================================================================

-- 1. Create role_invites table
CREATE TABLE IF NOT EXISTS public.role_invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone,
  CONSTRAINT role_invites_pkey PRIMARY KEY (id),
  CONSTRAINT role_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT role_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT role_invites_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))
);

ALTER TABLE public.role_invites FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_role_invites_invitee_id ON public.role_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_role_invites_status ON public.role_invites(status);

-- 2. Create RPC to create a role invite
CREATE OR REPLACE FUNCTION public.create_role_invite(
  p_inviter_id uuid,
  p_invitee_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
  v_invite_count integer;
BEGIN
  IF p_inviter_id IS NULL OR p_invitee_id IS NULL OR p_role IS NULL OR trim(p_role) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_required_fields');
  END IF;

  IF p_inviter_id = p_invitee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_invite_self');
  END IF;

  SELECT COUNT(*) INTO v_invite_count
  FROM public.role_invites
  WHERE invitee_id = p_invitee_id
    AND status = 'pending'
    AND created_at > now() - interval '7 days';

  IF v_invite_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_pending_invites');
  END IF;

  INSERT INTO public.role_invites (inviter_id, invitee_id, role)
  VALUES (p_inviter_id, p_invitee_id, trim(p_role))
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('success', true, 'invite_id', v_invite_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_role_invite(uuid, uuid, text) TO authenticated, service_role;

-- 3. Create RPC to respond to a role invite
CREATE OR REPLACE FUNCTION public.respond_role_invite(
  p_invite_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_current_role text;
BEGIN
  IF p_invite_id IS NULL OR p_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_required_fields');
  END IF;

  SELECT * INTO v_invite
  FROM public.role_invites
  WHERE id = p_invite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_already_responded');
  END IF;

  IF v_invite.invitee_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.role_invites
  SET status = p_status,
      responded_at = now()
  WHERE id = p_invite_id;

  IF p_status = 'accepted' THEN
    SELECT role INTO v_current_role FROM public.user_profiles WHERE id = v_invite.invitee_id;
    
    UPDATE public.user_profiles
    SET role = v_invite.role,
        updated_at = now()
    WHERE id = v_invite.invitee_id;

    INSERT INTO public.role_change_log (user_id, old_role, new_role, changed_by, reason)
    VALUES (v_invite.invitee_id, v_current_role, v_invite.role, v_invite.inviter_id, 'Role invite accepted');

    RETURN jsonb_build_object('success', true, 'action', 'accepted', 'new_role', v_invite.role);
  ELSE
    RETURN jsonb_build_object('success', true, 'action', 'declined');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_role_invite(uuid, text) TO authenticated, service_role;

-- 4. Create RPC to get pending role invites for a user
CREATE OR REPLACE FUNCTION public.get_pending_role_invites(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  inviter_username text,
  inviter_avatar_url text,
  role text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ri.id,
    ri.inviter_id,
    up.username AS inviter_username,
    up.avatar_url AS inviter_avatar_url,
    ri.role,
    ri.created_at
  FROM public.role_invites ri
  JOIN public.user_profiles up ON up.id = ri.inviter_id
  WHERE ri.invitee_id = p_user_id
    AND ri.status = 'pending'
    AND ri.created_at > now() - interval '30 days'
  ORDER BY ri.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_role_invites(uuid) TO authenticated, service_role;
