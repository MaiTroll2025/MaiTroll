-- Add category-specific columns to streams table
-- This migration adds support for the new broadcast categories

-- Add selected_religion column for Spiritual category broadcasts
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS selected_religion TEXT;

-- Add stream_key column for Gaming category (OBS RTMP)
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS stream_key TEXT;

-- Add rtmp_ingest_url column for Gaming category
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS rtmp_ingest_url TEXT;

-- Add is_obs_stream column to track OBS-based streams
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS is_obs_stream BOOLEAN DEFAULT FALSE;

-- Add layout_mode_override column for category-specific layouts
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS layout_mode_override TEXT;

-- Update indexes for better category queries
CREATE INDEX IF NOT EXISTS idx_streams_category ON streams(category);
CREATE INDEX IF NOT EXISTS idx_streams_selected_religion ON streams(selected_religion) WHERE selected_religion IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN streams.selected_religion IS 'Religion selected for Spiritual category broadcasts';
COMMENT ON COLUMN streams.stream_key IS 'Stream key for OBS/RTMP streaming in Gaming category';
COMMENT ON COLUMN streams.rtmp_ingest_url IS 'RTMP ingest endpoint for OBS streaming';
COMMENT ON COLUMN streams.is_obs_stream IS 'Boolean flag for OBS-based streams';
COMMENT ON COLUMN streams.layout_mode_override IS 'Override layout mode based on category';
