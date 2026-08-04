-- Create broadcast_officers table
CREATE TABLE IF NOT EXISTS broadcast_officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broadcaster_id, officer_id)
);

-- RLS Policies
ALTER TABLE broadcast_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Broadcasters can manage their officers"
  ON broadcast_officers
  FOR ALL
  USING (auth.uid() = broadcaster_id);

CREATE POLICY "Everyone can view officers"
  ON broadcast_officers
  FOR SELECT
  USING (true);

-- RPC: Is user an officer?
CREATE OR REPLACE FUNCTION is_broadofficer(p_broadcaster_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM broadcast_officers
    WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_user_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get all officers for a broadcaster
CREATE OR REPLACE FUNCTION get_broadofficers(p_broadcaster_id UUID)
RETURNS TABLE (
  officer_id UUID,
  username TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bo.officer_id,
    up.username,
    up.avatar_url
  FROM broadcast_officers bo
  JOIN user_profiles up ON up.id = bo.officer_id
  WHERE bo.broadcaster_id = p_broadcaster_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Assign officer (Max 10)
CREATE OR REPLACE FUNCTION assign_broadofficer(p_broadcaster_id UUID, p_officer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_count INT;
BEGIN
  -- Check if requester is the broadcaster
  IF auth.uid() != p_broadcaster_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can assign officers');
  END IF;

  -- Check limit
  SELECT COUNT(*) INTO v_count FROM broadcast_officers WHERE broadcaster_id = p_broadcaster_id;
  
  IF v_count >= 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum 10 officers allowed');
  END IF;

  INSERT INTO broadcast_officers (broadcaster_id, officer_id)
  VALUES (p_broadcaster_id, p_officer_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Remove officer
CREATE OR REPLACE FUNCTION remove_broadofficer(p_broadcaster_id UUID, p_officer_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF auth.uid() != p_broadcaster_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the broadcaster can remove officers');
  END IF;

  DELETE FROM broadcast_officers
  WHERE broadcaster_id = p_broadcaster_id AND officer_id = p_officer_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
