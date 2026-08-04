-- Simplify gaming streams for Agora-based browser screen sharing
-- Only removes columns that were added exclusively for the old HytroGaming
-- OBS/RTMP/Ingest workflow and are NOT used by the main broadcast system.
--
-- SAFE TO DROP (gaming-only, not in baseline, not used by any active code):
--   stream_key        — added by add_broadcast_category_columns.sql for OBS RTMP
--   rtmp_url          — added by 20260607000000_add_livekit_rtmp_url.sql for OBS RTMP
--   rtmp_ingest_url   — added by add_broadcast_category_columns.sql for OBS RTMP
--   is_obs_stream     — added by add_broadcast_category_columns.sql to flag OBS streams
--   obs_playback_url  — added by 20290609000000_add_gaming_stream_columns.sql for OBS playback
--
-- NOT DROPPED (used by main broadcast system):
--   livekit_room_name — core column from baseline, used by ViewerPage, SetupPage, etc.

-- Step 1: Add agora_channel if it doesn't exist (may already be in baseline)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'agora_channel'
  ) THEN
    ALTER TABLE streams ADD COLUMN agora_channel TEXT;
  END IF;
END $$;

-- Step 2: Drop the live_streams view entirely.
-- It currently uses SELECT * which includes stream_key, rtmp_url, obs_playback_url.
-- We must drop the view before dropping those columns, then recreate it after.
DROP VIEW IF EXISTS public.live_streams CASCADE;

-- Step 3: Drop gaming-only OBS/RTMP columns that are no longer needed.
-- These were added by gaming-specific migrations and are not in the baseline schema.
-- Safe to drop now that the live_streams view no longer exists.
DO $$
BEGIN
  -- stream_key: added by add_broadcast_category_columns.sql for OBS RTMP ingest
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'stream_key'
  ) THEN
    ALTER TABLE streams DROP COLUMN stream_key;
  END IF;

  -- rtmp_url: added by 20260607000000_add_livekit_rtmp_url.sql for OBS RTMP ingest
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'rtmp_url'
  ) THEN
    ALTER TABLE streams DROP COLUMN rtmp_url;
  END IF;

  -- obs_playback_url: added by 20290609000000_add_gaming_stream_columns.sql for OBS playback
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'obs_playback_url'
  ) THEN
    ALTER TABLE streams DROP COLUMN obs_playback_url;
  END IF;

  -- rtmp_ingest_url: added by add_broadcast_category_columns.sql for OBS RTMP ingest
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'rtmp_ingest_url'
  ) THEN
    ALTER TABLE streams DROP COLUMN rtmp_ingest_url;
  END IF;

  -- is_obs_stream: added by add_broadcast_category_columns.sql to flag OBS-based streams
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'is_obs_stream'
  ) THEN
    ALTER TABLE streams DROP COLUMN is_obs_stream;
  END IF;
END $$;

-- Step 4: Drop the agora_stream_sessions table — was for old OBS/RTMP ingest workflow, not used by any active code
DROP TABLE IF EXISTS public.agora_stream_sessions CASCADE;

-- Step 5: Recreate the live_streams view with SELECT * (now that the dropped columns are gone)
CREATE VIEW "public"."live_streams" AS
SELECT *
FROM "public"."streams"
WHERE ("status" = 'live'::"text");

ALTER VIEW "public"."live_streams" OWNER TO "postgres";
GRANT ALL ON TABLE "public"."live_streams" TO "anon";
GRANT ALL ON TABLE "public"."live_streams" TO "authenticated";
GRANT ALL ON TABLE "public"."live_streams" TO "service_role";

-- Step 6: Add index on agora_channel for faster lookups
CREATE INDEX IF NOT EXISTS idx_streams_agora_channel ON streams(agora_channel) WHERE agora_channel IS NOT NULL;

-- Step 7: Add index on category for gaming stream filtering
CREATE INDEX IF NOT EXISTS idx_streams_category_gaming ON streams(category) WHERE category = 'gaming';

-- Step 8: Update comment to reflect new architecture
COMMENT ON COLUMN streams.agora_channel IS 'Agora RTC channel name for HytroGaming browser screen sharing';
