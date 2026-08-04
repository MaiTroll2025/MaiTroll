-- Enable Realtime on utromail tables
-- Without this, postgres_changes subscriptions never fire for these tables

DO $$
BEGIN
  -- Add utromail_messages to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_messages;
    RAISE NOTICE 'Added utromail_messages to supabase_realtime';
  END IF;

  -- Add utromail_notifications to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_notifications;
    RAISE NOTICE 'Added utromail_notifications to supabase_realtime';
  END IF;

  -- Add utromail_threads to realtime publication (for thread list updates)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_threads;
    RAISE NOTICE 'Added utromail_threads to supabase_realtime';
  END IF;

  -- Add utromail_thread_members to realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'utromail_thread_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.utromail_thread_members;
    RAISE NOTICE 'Added utromail_thread_members to supabase_realtime';
  END IF;
END $$;
