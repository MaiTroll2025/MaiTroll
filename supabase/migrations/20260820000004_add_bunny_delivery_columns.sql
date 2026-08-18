ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS bunny_stream_id TEXT,
  ADD COLUMN IF NOT EXISTS bunny_playback_url TEXT,
  ADD COLUMN IF NOT EXISTS bunny_status TEXT DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS delivery_provider TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_stopped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT;

CREATE INDEX IF NOT EXISTS idx_streams_bunny_stream_id
  ON public.streams (bunny_stream_id);

CREATE INDEX IF NOT EXISTS idx_streams_delivery_provider
  ON public.streams (delivery_provider);
