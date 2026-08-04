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
        role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney', 'hr_admin', 'marketing_readonly', 'empire_partner')
        OR troll_role IN ('admin', 'superadmin', 'owner', 'ceo', 'staff', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_troll_officer, false) = true
        OR COALESCE(is_lead_officer, false) = true
        OR public.is_staff(p_actor_id) = true
      )
  ) INTO v_allowed;

  RETURN v_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_moderate_stream(uuid, uuid) TO authenticated;
