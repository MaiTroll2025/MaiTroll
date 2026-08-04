-- Create ghost_stream_sessions table for CEO Ghost Mode
-- Ghost sessions allow CEOs to silently join broadcasts without appearing in public UI
CREATE TABLE IF NOT EXISTS ghost_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  microphone_enabled BOOLEAN NOT NULL DEFAULT true,
  camera_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ghost_sessions_stream_id ON ghost_stream_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_ghost_sessions_user_id ON ghost_stream_sessions(user_id);

-- Create function to clean up expired ghost sessions
CREATE OR REPLACE FUNCTION cleanup_expired_ghost_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM ghost_stream_sessions 
  WHERE joined_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create policy: Only CEOs can access ghost sessions
DROP POLICY IF EXISTS ghost_sessions_policy ON ghost_stream_sessions;

CREATE POLICY ghost_sessions_policy ON ghost_stream_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = ghost_stream_sessions.user_id 
      AND (user_profiles.role = 'ceo' OR user_profiles.is_ceo = true OR user_profiles.is_admin = true)
    )
  );