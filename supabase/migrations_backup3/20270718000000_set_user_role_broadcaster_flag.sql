-- Enhance set_user_role so selecting the "Broadcaster" employee role also
-- sets the is_broadcaster flag. Previously broadcaster status was left false,
-- so users added as broadcasters via the employee directory could not go live,
-- and switching away from broadcaster did not clear the flag.
CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user UUID,
  new_role TEXT,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_role TEXT;
  v_admin_id UUID;
BEGIN
  -- Get current user (admin)
  v_admin_id := auth.uid();

  -- If called by service role and acting_admin_id is provided, use it
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_admin_id := acting_admin_id;
  END IF;

  -- Check permissions (simple check, RLS should handle more)
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can change roles. (Admin ID: %, Role: %)', v_admin_id, auth.role();
  END IF;

  -- Get old role
  SELECT role INTO v_old_role FROM user_profiles WHERE id = target_user;

  -- Update role and the relevant role flags.
  -- is_broadcaster is set when the new role is 'broadcaster' and cleared
  -- for every other role, mirroring the existing officer/secretary flags.
  UPDATE user_profiles
  SET
      role = new_role,
      is_admin = (new_role = 'admin'),
      is_lead_officer = (new_role = 'lead_troll_officer'),
      is_troll_officer = (new_role IN ('troll_officer', 'lead_troll_officer')),
      is_troller = (new_role = 'troller'),
      is_broadcaster = (new_role = 'broadcaster'),
      updated_at = now()
  WHERE id = target_user;

  -- Log change
  INSERT INTO role_change_log (target_user, changed_by, old_role, new_role, reason, created_at)
  VALUES (target_user, v_admin_id, v_old_role, new_role, reason, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID) TO service_role;
