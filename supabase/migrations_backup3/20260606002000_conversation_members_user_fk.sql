-- Point conversation_members.user_id to user_profiles for Supabase relationship joins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'conversation_members_user_id_fkey'
      AND tc.table_name = 'conversation_members'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.conversation_members
      DROP CONSTRAINT conversation_members_user_id_fkey;
  END IF;
END$$;

ALTER TABLE public.conversation_members
  ADD CONSTRAINT conversation_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.user_profiles(id)
  ON DELETE CASCADE;

