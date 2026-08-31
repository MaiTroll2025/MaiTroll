-- Enable Supabase Realtime for UTroMail messages table
-- utromail_messages must be in the supabase_realtime publication
-- or postgres_changes subscriptions will never fire.

DO $$

BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_messages;
    RAISE NOTICE 'Added utromail_messages to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_notifications;
    RAISE NOTICE 'Added utromail_notifications to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_threads;
    RAISE NOTICE 'Added utromail_threads to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_thread_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_thread_members;
    RAISE NOTICE 'Added utromail_thread_members to supabase_realtime';
  END IF;

END $$;
