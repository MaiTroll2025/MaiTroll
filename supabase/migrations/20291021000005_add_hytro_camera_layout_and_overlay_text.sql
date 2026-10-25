-- 20291021000005_add_hytro_camera_layout_and_overlay_text
-- Adds camera overlay layout and on-screen text columns to the streams table
-- for HytroGames host/broadcaster camera synchronization with PhoneHytroGameViewer.
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'hytro_camera_layout'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN hytro_camera_layout JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'hytro_overlay_text'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN hytro_overlay_text TEXT DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_streams_hytro_camera_layout ON public.streams USING GIN (hytro_camera_layout);

-- Backfill existing streams so defaults are present.
UPDATE public.streams
SET hytro_camera_layout = COALESCE(hytro_camera_layout, '{}'::jsonb),
    hytro_overlay_text = COALESCE(hytro_overlay_text, '')
WHERE hytro_camera_layout IS NULL OR hytro_overlay_text IS NULL;
