-- Mai Class Extensions
-- Adds LiveKit, Mux, and session management columns to mai_classes
-- Must run after 20290101000002_create_mai_class_system.sql

-- Add columns to mai_classes if they don't exist
ALTER TABLE mai_classes
ADD COLUMN IF NOT EXISTS livekit_room_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS session_status VARCHAR(50) DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'live', 'ended', 'cancelled')),
ADD COLUMN IF NOT EXISTS session_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS session_end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mux_recording_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS mux_playback_id VARCHAR(255);

-- Index for quickly finding live/active classes
CREATE INDEX IF NOT EXISTS idx_mai_classes_live ON mai_classes(session_status, livekit_room_name) WHERE session_status = 'live';

-- RLS: Allow admins to update session metadata
DROP POLICY IF EXISTS "mai_classes_session_update" ON mai_classes;

CREATE POLICY "mai_classes_session_update" ON mai_classes
FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM user_profiles
    WHERE role = 'admin' OR is_admin = true OR role = 'owner'
  )
);

-- RLS: Organizations can view when session is live
CREATE POLICY "mai_classes_live_view" ON mai_classes
FOR SELECT USING (
  session_status = 'live'
  AND organization_id IN (
    SELECT organization_id FROM organization_admins WHERE user_id = auth.uid()
  )
);
