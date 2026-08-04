-- Drop admin_pool_transactions FK to auth.users and point to user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'admin_pool_transactions_user_id_fkey'
      AND tc.table_name = 'admin_pool_transactions'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.admin_pool_transactions
      DROP CONSTRAINT admin_pool_transactions_user_id_fkey;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_pool_transactions'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.admin_pool_transactions
      ADD CONSTRAINT admin_pool_transactions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.user_profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;
