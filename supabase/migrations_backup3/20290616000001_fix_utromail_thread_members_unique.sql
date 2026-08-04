-- Fix utromail_thread_members unique constraint
-- The old UNIQUE(thread_id, user_id) prevented a user from having multiple folder
-- memberships (e.g. both 'sent' and 'inbox' for the sender).
-- Change to UNIQUE(thread_id, user_id, folder) so a user can appear in multiple folders.

DO $$
BEGIN
  -- Drop the old unique constraint if it exists
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

  -- Add the new unique constraint including folder
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
