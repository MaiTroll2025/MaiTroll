-- Migration: Add can_set_to_user RPC for moderation-actions Edge Function
-- This RPC enforces authorization for the "Set to User" moderation action

CREATE OR REPLACE FUNCTION public.can_set_to_user(
  p_actor_id uuid,
  p_target_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_target record;
BEGIN
  -- Allow service_role to bypass (used by edge functions)
  IF auth.role() = 'service_role' THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Load actor profile
  SELECT role, is_admin, is_lead_officer, is_troll_officer, is_secretary
  INTO v_actor
  FROM user_profiles
  WHERE id = p_actor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Actor not found');
  END IF;

  -- Only Lead Troll Officer, Admin, or Secretary can set users to user role
  IF NOT (
    v_actor.is_admin = true
    OR v_actor.role IN ('admin', 'superadmin', 'secretary')
    OR v_actor.is_lead_officer = true
    OR v_actor.role = 'lead_troll_officer'
    OR v_actor.is_secretary = true
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Unauthorized: Lead Officer, Admin, or Secretary role required');
  END IF;

  -- Load target profile
  SELECT role, is_admin, is_lead_officer, is_troll_officer, is_secretary
  INTO v_target
  FROM user_profiles
  WHERE id = p_target_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Target user not found');
  END IF;

  -- Cannot demote admin/CEO/owner
  IF v_target.is_admin = true
    OR v_target.role IN ('admin', 'superadmin', 'ceo', 'owner')
    OR v_target.is_lead_officer = true
    OR v_target.role = 'lead_troll_officer'
  THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Cannot demote elevated staff roles');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_set_to_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_set_to_user(uuid, uuid) TO service_role;
