-- Hot-path realtime guardrails.
-- Ticker clients now listen only to global_events, so allow authenticated app
-- code to enqueue lightweight city events without subscribing to hot tables.

ALTER TABLE IF EXISTS public.global_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "Authenticated users can insert city events" ON public.global_events;
CREATE POLICY "Authenticated users can insert city events"
  ON public.global_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Global events are readable" ON public.global_events;
CREATE POLICY "Global events are readable"
  ON public.global_events
  FOR SELECT
  USING (true);

GRANT SELECT, INSERT ON public.global_events TO authenticated;
GRANT SELECT ON public.global_events TO anon;

CREATE INDEX IF NOT EXISTS idx_global_events_priority_created_at
  ON public.global_events(priority DESC, created_at DESC);

NOTIFY pgrst, 'reload schema';
