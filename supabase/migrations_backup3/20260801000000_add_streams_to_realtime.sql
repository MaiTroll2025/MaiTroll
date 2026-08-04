-- Ensure streams table is included in Supabase realtime publication
-- so postgres_changes UPDATE events are delivered to viewers when
-- broadcasters change box_count / seat_count / seat_prices.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'streams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
  END IF;
END
$$;
