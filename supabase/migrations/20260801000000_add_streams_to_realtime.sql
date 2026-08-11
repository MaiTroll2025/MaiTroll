-- Add streams table to Supabase realtime publication so postgres_changes
-- UPDATE events are delivered to viewers when a broadcast ends.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'streams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
  END IF;
END
$$;

-- Use full replica identity so UPDATE payloads contain the complete row.
ALTER TABLE public.streams REPLICA IDENTITY FULL;
