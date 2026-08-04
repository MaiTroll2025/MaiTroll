-- Drop Mux streaming columns and table
-- This migration removes Mux integration from the backend

-- Drop Mux columns from streams table
ALTER TABLE streams DROP COLUMN IF EXISTS mux_stream_id;
ALTER TABLE streams DROP COLUMN IF EXISTS mux_playback_id;
ALTER TABLE streams DROP COLUMN IF EXISTS mux_rtmp_url;
ALTER TABLE streams DROP COLUMN IF EXISTS mux_stream_key;

-- Drop the stream_mux_outputs table (was used for Mux tracking)
DROP TABLE IF EXISTS stream_mux_outputs CASCADE;