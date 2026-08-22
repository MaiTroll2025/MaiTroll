-- Remove saved_streams table and related triggers/functions
-- Saved broadcasts are no longer persisted; profile broadcasts now show live/upcoming streams directly

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trigger_auto_save_stream_on_end ON public.streams;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.auto_save_stream_on_end();
DROP FUNCTION IF EXISTS public.is_stream_saved(uuid, uuid);

DROP TABLE IF EXISTS public.saved_streams;
