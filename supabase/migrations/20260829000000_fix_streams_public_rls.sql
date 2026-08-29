-- Fix streams RLS to allow public anonymous viewing of all streams
-- Password protection is enforced at the application layer (BroadcastRouter)

BEGIN;

DROP POLICY IF EXISTS public_read_streams ON public.streams;
DROP POLICY IF EXISTS authenticated_read ON public.streams;
DROP POLICY IF EXISTS "Public read live streams" ON public.streams;
DROP POLICY IF EXISTS "Anyone can view streams" ON public.streams;

CREATE POLICY "Anyone can view streams" ON public.streams
  FOR SELECT
  TO public
  USING (true);

COMMIT;
