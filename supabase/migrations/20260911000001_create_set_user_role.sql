-- Migration: Create set_user_role RPC for admin role management
-- Uses user_profiles.role and user_profiles.troll_role as the role source of truth.

CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user UUID,
  new_role TEXT,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get the authenticated user
  v_admin_id := auth.uid();

  -- If called by service role and acting_admin_id is provided, use it
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
    v_admin_id := acting_admin_id;
  END IF;

  -- Only admins can change roles
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = v_admin_id
      AND (role = 'admin' OR is_admin = true)
  ) THEN
    RAISE EXCEPTION
      'Unauthorized: Only admins can change roles. (Admin ID: %, Role: %)',
      v_admin_id,
      auth.role();
  END IF;

  -- Update the two role columns
  UPDATE public.user_profiles
  SET
    role = new_role,
    troll_role = new_role,
    updated_at = now()
  WHERE id = target_user;

  -- Make sure the target user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found: %', target_user;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID)
TO service_role;