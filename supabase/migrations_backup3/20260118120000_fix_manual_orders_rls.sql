-- Fix manual_coin_orders RLS policies to properly use user_profiles.id

-- Drop old policies that use auth.uid() directly
drop policy if exists "manual_orders_select_own" on public.manual_coin_orders;
drop policy if exists "manual_orders_insert_own" on public.manual_coin_orders;

-- Create new policies that check if the user_id (user_profiles.id) matches the authenticated user
-- Users can SELECT their own orders
create policy "manual_orders_select_own" on public.manual_coin_orders
for select to authenticated
using (user_id = auth.uid());

-- Users can INSERT their own orders (with check that user_id matches their auth.uid)
create policy "manual_orders_insert_own" on public.manual_coin_orders
for insert to authenticated
with check (user_id = auth.uid());

-- Admins and secretaries can view all orders
DO $$
DECLARE
  v_profiles boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) INTO v_profiles;

  IF NOT v_profiles THEN
    RAISE NOTICE 'user_profiles missing; skipping manual_orders_select_admin policy';
  ELSE
    BEGIN
      CREATE POLICY manual_orders_select_admin ON public.manual_coin_orders
      FOR SELECT TO authenticated
      USING (
        exists (
          select 1 from public.user_profiles up
          where up.id = auth.uid()
          and (up.role = 'admin' or up.role = 'secretary' or up.is_admin = true)
        )
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- Admins and secretaries can update all orders
DO $$
DECLARE
  v_profiles boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) INTO v_profiles;

  IF NOT v_profiles THEN
    RAISE NOTICE 'user_profiles missing; skipping manual_orders_update_admin policy';
  ELSE
    BEGIN
      CREATE POLICY manual_orders_update_admin ON public.manual_coin_orders
      FOR UPDATE TO authenticated
      USING (
        exists (
          select 1 from public.user_profiles up
          where up.id = auth.uid()
          and (up.role = 'admin' or up.role = 'secretary' or up.is_admin = true)
        )
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
