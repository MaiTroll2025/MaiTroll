-- Migration: Add last_activity_at to streams for auto-end inactive streams
-- This tracks the last time there was any activity (chat, gift, like) on a stream
-- A server-side cron job will end streams with no activity for 5+ minutes

ALTER TABLE streams ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Create index for efficient querying of live streams by activity
CREATE INDEX IF NOT EXISTS idx_streams_last_activity_at ON streams (last_activity_at) WHERE is_live = true AND status = 'live';

-- Function to update last_activity_at timestamp
CREATE OR REPLACE FUNCTION update_stream_last_activity(p_stream_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE streams 
  SET last_activity_at = NOW()
  WHERE id = p_stream_id AND is_live = true AND status = 'live';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-end inactive streams (called by server cron job)
CREATE OR REPLACE FUNCTION auto_end_inactive_streams(inactivity_minutes INT DEFAULT 5)
RETURNS TABLE(ended_stream_id UUID, broadcaster_id UUID, last_activity TIMESTAMPTZ) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (inactivity_minutes || ' minutes')::INTERVAL;
  
  RETURN QUERY
  WITH ended AS (
    UPDATE streams 
    SET 
      is_live = false,
      status = 'ended',
      ended_at = NOW(),
      updated_at = NOW()
    WHERE is_live = true 
      AND status = 'live'
      AND (
        last_activity_at IS NULL 
        OR last_activity_at < v_cutoff
      )
    RETURNING streams.id, streams.broadcaster_id, streams.last_activity_at
  )
  SELECT * FROM ended;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
