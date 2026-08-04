-- ============================================================================
-- Migration: 20260801060000_fix_bug_center_schema_issues
-- Fixes all open bugs reported by the Bug Center on 2026-08-01
--   Bug #2,3: Missing founder_rewards_grants table
--   Bug #5:    Missing FK relationship fast_pay_applications -> user_profiles
--   Bug #6:    Missing auctioneer_applications table
--   Bug #7:    Missing attorney_applications table
--   Bug #8:    Missing prosecutor_applications table
--   Bug #9:    Missing president_elections.title column
--   Bug #10:   Missing coin_transactions.paypal_order_id column
--   Bug #11,12: Missing admin_finance_feed table
-- Also adds missing FK constraints for payout_requests (used by edge function
-- get_payout_requests) and additional columns queried by the frontend.
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE MISSING TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: founder_rewards
-- Tracks exclusive founder rewards granted to users by Secretaries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ceo_fam_badge BOOLEAN NOT NULL DEFAULT FALSE,
  agency_fee_waived BOOLEAN NOT NULL DEFAULT FALSE,
  early_supporter BOOLEAN NOT NULL DEFAULT FALSE,
  founder_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_founder_rewards_user_id ON public.founder_rewards(user_id);

-- ----------------------------------------------------------------------------
-- Table: founder_rewards_grants
-- Audit log of all founder reward grants (Bug #2, #3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_rewards_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ceo_fam_badge', 'agency_fee_waived', 'early_supporter', 'founder_status')),
  admin_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  admin_username TEXT,
  target_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founder_rewards_grants_user_id ON public.founder_rewards_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_rewards_grants_created_at ON public.founder_rewards_grants(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: auctioneer_applications  (Bug #6)
-- Users apply to become approved auctioneers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auctioneer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  display_name TEXT NOT NULL,
  application_text TEXT NOT NULL,
  selling_plan TEXT,
  experience TEXT,
  agreement_accepted BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_status ON public.auctioneer_applications(status);
CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_user_id ON public.auctioneer_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_auctioneer_applications_created_at ON public.auctioneer_applications(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: attorney_applications  (Bug #7)
-- Users apply to become attorneys for the court system
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attorney_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  attorney_fee INTEGER DEFAULT 0,
  is_pro_bono BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attorney_applications_user_id ON public.attorney_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_attorney_applications_status ON public.attorney_applications(status);
CREATE INDEX IF NOT EXISTS idx_attorney_applications_created_at ON public.attorney_applications(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: prosecutor_applications  (Bug #8)
-- Users apply to become prosecutors for the court system
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prosecutor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  experience TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosecutor_applications_user_id ON public.prosecutor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_prosecutor_applications_status ON public.prosecutor_applications(status);
CREATE INDEX IF NOT EXISTS idx_prosecutor_applications_created_at ON public.prosecutor_applications(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: admin_finance_feed  (Bug #11, #12)
-- Aggregated finance event log consumed by the admin finance dashboard.
-- record_type distinguishes 'transaction' and 'coin_transaction' rows
-- (see useAdminFinanceRealtime.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_finance_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('transaction', 'coin_transaction')),
  transaction_type TEXT,
  amount NUMERIC(14,2),
  coins BIGINT,
  description TEXT,
  payment_method TEXT,
  external_transaction_id TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_finance_feed_record_type ON public.admin_finance_feed(record_type);
CREATE INDEX IF NOT EXISTS idx_admin_finance_feed_created_at ON public.admin_finance_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_finance_feed_user_id ON public.admin_finance_feed(user_id);

-- ============================================================================
-- PART 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Add title column to president_elections  (Bug #9)
-- Frontend PresidentialOversightPanel.tsx and SecretaryDashboard.tsx
-- both select/display election.title
-- ----------------------------------------------------------------------------
ALTER TABLE public.president_elections
  ADD COLUMN IF NOT EXISTS title TEXT;

-- ----------------------------------------------------------------------------
-- Add paypal_order_id and related columns to coin_transactions  (Bug #10)
-- Frontend queries these columns directly on coin_transactions:
--   - EconomyDashboard.tsx     : paypal_order_id, paypal_capture_id, source, usd_amount, platform_profit
--   - PaymentsDashboard.tsx    : paypal_order_id, paypal_capture_id, source, usd_amount, external_id, status
--   - AdminDashboard.tsx       : paypal_order_id (via useAdminDashboardMetrics)
--   - CoinPackPurchasesLedger  : paypal_order_id, paypal_capture_id, source
-- ----------------------------------------------------------------------------
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS usd_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS coins BIGINT,
  ADD COLUMN IF NOT EXISTS from_user_id UUID,
  ADD COLUMN IF NOT EXISTS from_user_name TEXT,
  ADD COLUMN IF NOT EXISTS to_user_id UUID,
  ADD COLUMN IF NOT EXISTS to_user_name TEXT;

CREATE INDEX IF NOT EXISTS idx_coin_transactions_paypal_order_id
  ON public.coin_transactions(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_transactions_paypal_capture_id
  ON public.coin_transactions(paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_transactions_source
  ON public.coin_transactions(source);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_status
  ON public.coin_transactions(status);

-- ----------------------------------------------------------------------------
-- Add missing FK constraint for fast_pay_applications  (Bug #5)
-- PostgREST needs a foreign-key relationship between fast_pay_applications
-- and user_profiles to resolve the user_profiles!user_id join used in
-- AdminApplications.tsx:172
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'fast_pay_applications' AND constraint_name = 'fast_pay_applications_user_id_fkey'
  ) THEN
    ALTER TABLE public.fast_pay_applications
      ADD CONSTRAINT fast_pay_applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Add missing FK constraints for payout_requests
-- The admin-actions edge function get_payout_requests action joins
-- payout_requests to user_profiles via named FK constraints:
--   payout_requests_user_id_fkey
--   payout_requests_admin_id_fkey
--   payout_requests_processed_by_fkey
-- First ensure the referenced columns exist, then add the FK constraints.
-- ----------------------------------------------------------------------------
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS admin_id UUID,
  ADD COLUMN IF NOT EXISTS processed_by UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payout_requests' AND constraint_name = 'payout_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payout_requests' AND constraint_name = 'payout_requests_admin_id_fkey'
  ) THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'payout_requests' AND constraint_name = 'payout_requests_processed_by_fkey'
  ) THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_processed_by_fkey
      FOREIGN KEY (processed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Add missing columns to executive_intake for the executive intake feature
-- (Bugs #1 edge function + frontend ExecutiveIntakeList.tsx)
-- The table was created with a generic schema (id, user_id, data, timestamps)
-- but both the edge function and frontend expect individual columns.
-- ----------------------------------------------------------------------------
ALTER TABLE public.executive_intake
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'escalated')),
  ADD COLUMN IF NOT EXISTS assigned_secretary UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secretary_notes TEXT,
  ADD COLUMN IF NOT EXISTS escalated_to_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_executive_intake_status ON public.executive_intake(status);
CREATE INDEX IF NOT EXISTS idx_executive_intake_category ON public.executive_intake(category);
CREATE INDEX IF NOT EXISTS idx_executive_intake_assigned_secretary ON public.executive_intake(assigned_secretary);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY & POLICIES FOR NEW TABLES
-- ============================================================================

-- founder_rewards: users can read own, admins/secretaries can read all
ALTER TABLE public.founder_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_rewards" ON public.founder_rewards;
CREATE POLICY "users_read_own_rewards" ON public.founder_rewards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_all_rewards" ON public.founder_rewards;
CREATE POLICY "admin_read_all_rewards" ON public.founder_rewards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

DROP POLICY IF EXISTS "admin_manage_rewards" ON public.founder_rewards;
CREATE POLICY "admin_manage_rewards" ON public.founder_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- founder_rewards_grants: admins can read and insert
ALTER TABLE public.founder_rewards_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_grants" ON public.founder_rewards_grants;
CREATE POLICY "admin_read_grants" ON public.founder_rewards_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

DROP POLICY IF EXISTS "admin_create_grants" ON public.founder_rewards_grants;
CREATE POLICY "admin_create_grants" ON public.founder_rewards_grants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- auctioneer_applications: users can create own, admins can manage, public can view
ALTER TABLE public.auctioneer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view auctioneer applications" ON public.auctioneer_applications;
CREATE POLICY "Anyone can view auctioneer applications" ON public.auctioneer_applications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create auctioneer applications" ON public.auctioneer_applications;
CREATE POLICY "Users can create auctioneer applications" ON public.auctioneer_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage auctioneer applications" ON public.auctioneer_applications;
CREATE POLICY "Admin can manage auctioneer applications" ON public.auctioneer_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
  );

-- attorney_applications: users can create own, admins can manage, public can view
ALTER TABLE public.attorney_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view attorney applications" ON public.attorney_applications;
CREATE POLICY "Anyone can view attorney applications" ON public.attorney_applications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create attorney applications" ON public.attorney_applications;
CREATE POLICY "Users can create attorney applications" ON public.attorney_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage attorney applications" ON public.attorney_applications;
CREATE POLICY "Admin can manage attorney applications" ON public.attorney_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
  );

-- prosecutor_applications: users can create own, admins can manage, public can view
ALTER TABLE public.prosecutor_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view prosecutor applications" ON public.prosecutor_applications;
CREATE POLICY "Anyone can view prosecutor applications" ON public.prosecutor_applications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create prosecutor applications" ON public.prosecutor_applications;
CREATE POLICY "Users can create prosecutor applications" ON public.prosecutor_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage prosecutor applications" ON public.prosecutor_applications;
CREATE POLICY "Admin can manage prosecutor applications" ON public.prosecutor_applications
  FOR ALL USING (
    EXISTS (
 SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
  );

-- admin_finance_feed: admins/secretaries can read
ALTER TABLE public.admin_finance_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read finance feed" ON public.admin_finance_feed;
CREATE POLICY "Admin can read finance feed" ON public.admin_finance_feed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'secretary', 'executive_secretary', 'troll_city_secretary'))
    )
  );

-- ============================================================================
-- PART 4: REALTIME PUBLICATION (add new tables so realtime listeners work)
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT * FROM unnest(array[
      'founder_rewards', 'founder_rewards_grants',
      'auctioneer_applications', 'attorney_applications', 'prosecutor_applications',
      'admin_finance_feed'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 5: GRANT SELECT to authenticated role for new tables
-- ============================================================================
GRANT SELECT ON public.founder_rewards, public.founder_rewards_grants,
  public.auctioneer_applications, public.attorney_applications,
  public.prosecutor_applications, public.admin_finance_feed
TO authenticated;

-- ============================================================================
-- PART 6: REFRESH SCHEMA CACHE
-- ============================================================================
SELECT pg_notify('pgrst', 'reload schema');
