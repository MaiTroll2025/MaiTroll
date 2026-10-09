-- Add rtc_provider column to streams table
-- Values: 'livekit' (default), 'getstream'

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS rtc_provider TEXT DEFAULT 'livekit' CHECK (rtc_provider IN ('livekit', 'getstream'));

-- Add rtc_provider column to rtc_sessions table for monitoring
ALTER TABLE rtc_sessions
ADD COLUMN IF NOT EXISTS rtc_provider TEXT DEFAULT 'livekit' CHECK (rtc_provider IN ('livekit', 'getstream'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_streams_rtc_provider ON streams(rtc_provider);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_rtc_provider ON rtc_sessions(rtc_provider);

-- Add rtc_provider to town_meetings table
ALTER TABLE town_meetings
ADD COLUMN IF NOT EXISTS rtc_provider TEXT DEFAULT 'getstream' CHECK (rtc_provider IN ('livekit', 'getstream'));

-- Update existing town_meetings to use getstream (migrate from Agora)
UPDATE town_meetings SET rtc_provider = 'getstream' WHERE rtc_provider IS NULL;