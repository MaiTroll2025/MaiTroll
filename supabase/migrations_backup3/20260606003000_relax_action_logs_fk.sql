-- Point action_logs actor_id to user_profiles instead of auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'action_logs_actor_id_fkey'
      AND tc.table_name = 'action_logs'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.action_logs
      DROP CONSTRAINT action_logs_actor_id_fkey;
  END IF;
END$$;

ALTER TABLE public.action_logs
  ADD CONSTRAINT action_logs_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;
