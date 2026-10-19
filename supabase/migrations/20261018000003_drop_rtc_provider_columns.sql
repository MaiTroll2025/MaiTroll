-- Drop rtc_provider column from streams, rtc_sessions, town_meetings
-- and associated indexes, as all RTC now uses LiveKit only.

DROP INDEX IF EXISTS idx_streams_rtc_provider;
DROP INDEX IF EXISTS idx_rtc_sessions_rtc_provider;

ALTER TABLE streams DROP COLUMN IF EXISTS rtc_provider;
ALTER TABLE rtc_sessions DROP COLUMN IF EXISTS rtc_provider;
ALTER TABLE town_meetings DROP COLUMN IF EXISTS rtc_provider;
