-- Migration: Add can_user_broadcast RPC for moderation-actions Edge Function

CREATE OR REPLACE FUNCTION public.can_user_broadcast(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license_status TEXT;
  v_has_restriction BOOLEAN;
BEGIN
  SELECT drivers_license_status INTO v_license_status
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_license_status IS NULL OR v_license_status = 'none' OR v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('can_broadcast', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_broadcast_restrictions
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_has_restriction;

  IF v_has_restriction THEN
    RETURN jsonb_build_object('can_broadcast', false);
  END IF;

  RETURN jsonb_build_object('can_broadcast', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_broadcast(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_broadcast(UUID) TO service_role;
