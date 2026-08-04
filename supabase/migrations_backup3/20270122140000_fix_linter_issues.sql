-- Fix linter issues from pleasefix file

-- 1. Enable RLS on tables and add basic policies

-- Helper macro-like approach using DO blocks

-- Table: daily_logins
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logins' AND table_schema = 'public') THEN
    ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_logins' AND policyname = 'Users can read own daily logins') THEN
      CREATE POLICY "Users can read own daily logins" ON public.daily_logins FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: perk_catalog (Public Read)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'perk_catalog' AND table_schema = 'public') THEN
    ALTER TABLE public.perk_catalog ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perk_catalog' AND policyname = 'Public read perk_catalog') THEN
      CREATE POLICY "Public read perk_catalog" ON public.perk_catalog FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: entrance_effect_catalog (Public Read)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entrance_effect_catalog' AND table_schema = 'public') THEN
    ALTER TABLE public.entrance_effect_catalog ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'entrance_effect_catalog' AND policyname = 'Public read entrance_effect_catalog') THEN
      CREATE POLICY "Public read entrance_effect_catalog" ON public.entrance_effect_catalog FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: user_active_entrance_effect
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_active_entrance_effect' AND table_schema = 'public') THEN
    ALTER TABLE public.user_active_entrance_effect ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_active_entrance_effect' AND policyname = 'Users manage own active effect') THEN
      CREATE POLICY "Users manage own active effect" ON public.user_active_entrance_effect FOR ALL USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: trollmond_transactions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trollmond_transactions' AND table_schema = 'public') THEN
    ALTER TABLE public.trollmond_transactions ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trollmond_transactions' AND policyname = 'Users read own transactions') THEN
      CREATE POLICY "Users read own transactions" ON public.trollmond_transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: trollmond_store_items (Public Read)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trollmond_store_items' AND table_schema = 'public') THEN
    ALTER TABLE public.trollmond_store_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trollmond_store_items' AND policyname = 'Public read trollmond_store_items') THEN
      CREATE POLICY "Public read trollmond_store_items" ON public.trollmond_store_items FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: trollmond_gifts
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trollmond_gifts' AND table_schema = 'public') THEN
    ALTER TABLE public.trollmond_gifts ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trollmond_gifts' AND policyname = 'Public read trollmond_gifts') THEN
      CREATE POLICY "Public read trollmond_gifts" ON public.trollmond_gifts FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: coin_audit_log (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_audit_log' AND table_schema = 'public') THEN
    ALTER TABLE public.coin_audit_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: properties
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties' AND table_schema = 'public') THEN
    ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Public read properties') THEN
      CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Owners update properties') THEN
      CREATE POLICY "Owners update properties" ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
    END IF;
  END IF;
END $$;

-- Table: property_upgrades
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_upgrades' AND table_schema = 'public') THEN
    ALTER TABLE public.property_upgrades ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_upgrades' AND policyname = 'Owners read upgrades') THEN
      CREATE POLICY "Owners read upgrades" ON public.property_upgrades FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.properties WHERE id = property_upgrades.property_id AND owner_id = auth.uid())
      );
    END IF;
  END IF;
END $$;

-- Table: admin_pool (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_pool' AND table_schema = 'public') THEN
    ALTER TABLE public.admin_pool ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: wallets
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets' AND table_schema = 'public') THEN
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Users read own wallet') THEN
      CREATE POLICY "Users read own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: coin_orders
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_orders' AND table_schema = 'public') THEN
    ALTER TABLE public.coin_orders ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_orders' AND policyname = 'Users read own orders') THEN
      CREATE POLICY "Users read own orders" ON public.coin_orders FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: stripe_customers
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_customers' AND table_schema = 'public') THEN
    ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stripe_customers' AND policyname = 'Users read own stripe customer') THEN
      CREATE POLICY "Users read own stripe customer" ON public.stripe_customers FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: admin_allocation_buckets (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_allocation_buckets' AND table_schema = 'public') THEN
    ALTER TABLE public.admin_allocation_buckets ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: live_sessions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'live_sessions' AND table_schema = 'public') THEN
    ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'Users manage own live sessions') THEN
      CREATE POLICY "Users manage own live sessions" ON public.live_sessions FOR ALL USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: platform_profit (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_profit' AND table_schema = 'public') THEN
    ALTER TABLE public.platform_profit ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: officer_payroll_logs (Admin/Officer Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officer_payroll_logs' AND table_schema = 'public') THEN
    ALTER TABLE public.officer_payroll_logs ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'officer_payroll_logs' AND policyname = 'Officers read own logs') THEN
      CREATE POLICY "Officers read own logs" ON public.officer_payroll_logs 
      FOR SELECT USING (auth.uid() = officer_id);
    END IF;
  END IF;
END $$;

-- Table: admin_coin_pool (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_coin_pool' AND table_schema = 'public') THEN
    ALTER TABLE public.admin_coin_pool ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: admin_pool_buckets (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_pool_buckets' AND table_schema = 'public') THEN
    ALTER TABLE public.admin_pool_buckets ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: admin_app_settings (Public Read)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_app_settings' AND table_schema = 'public') THEN
    ALTER TABLE public.admin_app_settings ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_app_settings' AND policyname = 'Public read admin settings') THEN
      CREATE POLICY "Public read admin settings" ON public.admin_app_settings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_app_settings' AND policyname = 'Admins manage admin settings') THEN
      CREATE POLICY "Admins manage admin settings" ON public.admin_app_settings
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR role = 'secretary')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR role = 'secretary')
          )
        );
    END IF;
  END IF;
END $$;

-- Table: stream_viewers
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_viewers' AND table_schema = 'public') THEN
    ALTER TABLE public.stream_viewers ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stream_viewers' AND policyname = 'Public read stream viewers') THEN
      CREATE POLICY "Public read stream viewers" ON public.stream_viewers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stream_viewers' AND policyname = 'Users insert self as viewer') THEN
      CREATE POLICY "Users insert self as viewer" ON public.stream_viewers FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- Table: platform_revenue (Admin Only)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_revenue' AND table_schema = 'public') THEN
    ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Table: houses
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'houses' AND table_schema = 'public') THEN
    ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'houses' AND policyname = 'Public read houses') THEN
      CREATE POLICY "Public read houses" ON public.houses FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: car_models (Public Read)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'car_models' AND table_schema = 'public') THEN
    ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'car_models' AND policyname = 'Public read car_models') THEN
      CREATE POLICY "Public read car_models" ON public.car_models FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Table: matchmaking_queue
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matchmaking_queue' AND table_schema = 'public') THEN
    ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matchmaking_queue' AND policyname = 'Users manage own queue entry') THEN
      CREATE POLICY "Users manage own queue entry" ON public.matchmaking_queue FOR ALL USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;


-- 2. Fix SECURITY DEFINER Views
-- We attempt to set security_invoker = true for all identified views.
-- This requires Postgres 15+. If it fails, the user needs to update Postgres or we need another strategy.
-- We use DO blocks to avoid errors if views don't exist.

DO $$
BEGIN
    -- active_troll_officers
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'active_troll_officers') THEN
        ALTER VIEW public.active_troll_officers SET (security_invoker = true);
    END IF;

    -- v_broadcast_themes_for_user
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_broadcast_themes_for_user') THEN
        ALTER VIEW public.v_broadcast_themes_for_user SET (security_invoker = true);
    END IF;

    -- v_current_stream_ranking
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_current_stream_ranking') THEN
        ALTER VIEW public.v_current_stream_ranking SET (security_invoker = true);
    END IF;

    -- v_active_streams_with_rank
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_active_streams_with_rank') THEN
        ALTER VIEW public.v_active_streams_with_rank SET (security_invoker = true);
    END IF;

    -- v_user_balances_secure
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_user_balances_secure') THEN
        ALTER VIEW public.v_user_balances_secure SET (security_invoker = true);
    END IF;
END $$;
