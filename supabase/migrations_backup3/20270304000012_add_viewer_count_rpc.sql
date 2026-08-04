-- Function to allow Host or Officers to update stream viewer count safely
-- This bypasses RLS for the update but enforces logic check

CREATE OR REPLACE FUNCTION update_stream_viewer_count(p_stream_id UUID, p_count INTEGER)
RETURNS VOID AS $$
DECLARE
  v_user_role TEXT;
  v_is_troll_officer BOOLEAN;
  v_troll_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Get current user info
  SELECT role, is_troll_officer, troll_role, is_admin 
  INTO v_user_role, v_is_troll_officer, v_troll_role, v_is_admin
  FROM user_profiles
  WHERE id = auth.uid();

  -- Check permissions: Must be Broadcaster (Host) OR Officer OR Admin
  IF (
    -- Is Host (Broadcaster)
    EXISTS (SELECT 1 FROM streams WHERE id = p_stream_id AND (broadcaster_id = auth.uid() OR user_id = auth.uid()))
    OR 
    -- Is Admin/Officer
    v_user_role IN ('admin', 'troll_officer', 'lead_troll_officer')
    OR
    v_is_troll_officer = true
    OR
    v_is_admin = true
    OR
    v_troll_role IN ('admin', 'troll_officer', 'moderator')
  ) THEN
    UPDATE streams 
    SET current_viewers = p_count 
    WHERE id = p_stream_id;
  ELSE
    -- Silent fail or raise exception? Silent is better for client hooks to avoid noise
    -- But strict is better for debugging. Let's raise.
    RAISE EXCEPTION 'Unauthorized to update viewer count';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_stream_viewer_count TO authenticated;
