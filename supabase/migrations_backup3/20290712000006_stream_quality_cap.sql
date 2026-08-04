-- A4: Azgora streams are capped at 720p even for admins.
-- Adds a per-stream quality lock. The livekit-token edge function reads
-- is_azgora / quality_cap and returns a server-authoritative qualityCap;
-- BroadcastPage honors it and never exceeds 720p for flagged streams.

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS is_azgora BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS quality_cap TEXT NOT NULL DEFAULT '1080p'
    CHECK (quality_cap IN ('720p', '1080p'));

CREATE INDEX IF NOT EXISTS idx_streams_is_azgora ON public.streams (is_azgora);

COMMENT ON COLUMN public.streams.is_azgora IS 'When true, the stream is locked to 720p for all publishers including admins.';
COMMENT ON COLUMN public.streams.quality_cap IS 'Server-enforced publish cap: 720p or 1080p.';
