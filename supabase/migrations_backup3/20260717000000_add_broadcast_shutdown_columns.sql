-- Add columns used by the shared broadcast shutdown sequence so the browser can
-- report authoritative device/RTC state and end reason to the database, and so the
-- server-side stale-session cleanup can detect crashed browsers.
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS rtc_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS microphone_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ DEFAULT now();

-- Index used by the stale-session cleanup job (live streams with a stale heartbeat).
CREATE INDEX IF NOT EXISTS idx_streams_heartbeat
  ON public.streams (last_heartbeat_at)
  WHERE is_live = true AND status = 'live';

-- Keep last_heartbeat_at fresh on any update so it doubles as activity signal.
CREATE OR REPLACE FUNCTION public.touch_stream_heartbeat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_heartbeat_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_stream_heartbeat ON public.streams;
CREATE TRIGGER trg_touch_stream_heartbeat
  BEFORE UPDATE ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_stream_heartbeat();
