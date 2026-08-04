-- Allow admins/secretaries to view all manual coin orders (guard for missing tables)
DO $$
DECLARE
  v_manual boolean;
  v_profiles boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='manual_coin_orders'
  ) INTO v_manual;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles'
  ) INTO v_profiles;

  IF NOT v_manual THEN
    RAISE NOTICE 'manual_coin_orders table missing; skipping admin policy';
    RETURN;
  END IF;

  IF NOT v_profiles THEN
    RAISE NOTICE 'user_profiles table missing; skipping admin policy';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_coin_orders'
      AND policyname = 'admin_or_secretary_select_manual_orders'
  ) THEN
    CREATE POLICY admin_or_secretary_select_manual_orders ON public.manual_coin_orders
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.role IN ('admin','secretary') OR up.is_admin = true)
        )
      );
  END IF;
END $$;
