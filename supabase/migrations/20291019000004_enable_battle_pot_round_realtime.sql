BEGIN;

DO $$
BEGIN
  IF to_regclass('public.battle_pot_rounds') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_publication
       WHERE pubname = 'supabase_realtime'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'battle_pot_rounds'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_pot_rounds;
  END IF;
END;
$$;

COMMIT;
