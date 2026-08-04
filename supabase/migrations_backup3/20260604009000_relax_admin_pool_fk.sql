-- Relax admin_pool_transactions FK for local/dev seeding
ALTER TABLE IF EXISTS public.admin_pool_transactions
  DROP CONSTRAINT IF EXISTS admin_pool_transactions_user_id_fkey;

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
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
