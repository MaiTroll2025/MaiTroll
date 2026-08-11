-- Ensure stream_gifts is included in the Supabase realtime publication
-- so that Postgres INSERT events are delivered to all subscribers.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stream_gifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.stream_gifts;
  END IF;
END
$$;

-- Use full replica identity so UPDATE payloads are complete if updates are used later.
ALTER TABLE public.stream_gifts REPLICA IDENTITY FULL;
