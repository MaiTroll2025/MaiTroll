-- Add battles and battle_sessions to Supabase realtime publication
-- so postgres_changes listeners receive battle state updates.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'battles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'battle_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_sessions;
  END IF;
END
$$;
