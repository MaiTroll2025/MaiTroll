DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'utromail_thread_members'
      AND constraint_name = 'utromail_thread_members_thread_id_user_id_key'
  ) THEN
    ALTER TABLE public.utromail_thread_members
      DROP CONSTRAINT utromail_thread_members_thread_id_user_id_key;
    RAISE NOTICE 'Dropped old UNIQUE(thread_id, user_id) constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'utromail_thread_members'
      AND constraint_name = 'utromail_thread_members_thread_id_user_id_folder_key'
  ) THEN
    ALTER TABLE public.utromail_thread_members
      ADD CONSTRAINT utromail_thread_members_thread_id_user_id_folder_key
      UNIQUE (thread_id, user_id, folder);
    RAISE NOTICE 'Added new UNIQUE(thread_id, user_id, folder) constraint';
  END IF;
END $$;