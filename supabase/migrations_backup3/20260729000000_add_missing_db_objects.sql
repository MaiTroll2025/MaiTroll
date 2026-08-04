-- ============================================================================
-- Comprehensive Migration: Add Missing Database Objects
-- Generated: 2026-07-29
-- Covers: missing tables, functions, columns, and relationships
-- ============================================================================

-- ============================================================================
-- 1. MISSING TABLES
-- ============================================================================

-- Table: tcnn_articles
CREATE TABLE IF NOT EXISTS public.tcnn_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'general',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tcnn_articles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.tcnn_articles TO authenticated;
GRANT ALL ON TABLE public.tcnn_articles TO anon;

-- Table: shop_items
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'general',
  icon TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.shop_items TO authenticated;
GRANT ALL ON TABLE public.shop_items TO anon;

-- Table: user_entrance_effects
CREATE TABLE IF NOT EXISTS public.user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  effect_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, effect_id)
);
ALTER TABLE public.user_entrance_effects ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.user_entrance_effects TO authenticated;

-- Table: user_call_sounds
CREATE TABLE IF NOT EXISTS public.user_call_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sound_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sound_id)
);
ALTER TABLE public.user_call_sounds ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.user_call_sounds TO authenticated;

-- Table: user_insurances
CREATE TABLE IF NOT EXISTS public.user_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  insurance_type TEXT NOT NULL DEFAULT 'homeowners',
  plan_id TEXT,
  status TEXT DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  cost_paid INTEGER DEFAULT 0,
  deductible INTEGER DEFAULT 25,
  coverage_type TEXT DEFAULT 'basic',
  duration_hours INTEGER DEFAULT 720,
  purchased_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_insurances ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.user_insurances TO authenticated;

-- Table: vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'car',
  icon TEXT,
  image_url TEXT,
  speed INTEGER DEFAULT 0,
  armor INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO anon;

-- Table: insurance_options
CREATE TABLE IF NOT EXISTS public.insurance_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  insurance_type TEXT NOT NULL DEFAULT 'homeowners',
  description TEXT DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,
  coverage_type TEXT DEFAULT 'basic',
  deductible INTEGER DEFAULT 25,
  duration_hours INTEGER DEFAULT 720,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.insurance_options ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.insurance_options TO authenticated;
GRANT ALL ON TABLE public.insurance_options TO anon;

-- Table: perks
CREATE TABLE IF NOT EXISTS public.perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT,
  cost INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.perks TO authenticated;
GRANT ALL ON TABLE public.perks TO anon;

-- Table: stocks
CREATE TABLE IF NOT EXISTS public.stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  change_percent NUMERIC(5,2) DEFAULT 0,
  volume BIGINT DEFAULT 0,
  market_cap bigint DEFAULT 0,
  sector TEXT DEFAULT 'technology',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.stocks TO authenticated;
GRANT ALL ON TABLE public.stocks TO anon;

-- Table: troll_court_cases
CREATE TABLE IF NOT EXISTS public.troll_court_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  defendant_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  plaintiff_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  docket_id UUID REFERENCES public.court_dockets(id) ON DELETE SET NULL,
  case_type TEXT DEFAULT 'criminal',
  status TEXT DEFAULT 'pending',
  reason TEXT,
  verdict TEXT,
  sentence TEXT,
  hearing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.troll_court_cases ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.troll_court_cases TO authenticated;

-- Table: user_profiles_1 (subscribers_count column)
-- This is a legacy table reference; ensure subscribers_count exists on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscribers_count INTEGER DEFAULT 0;

-- ============================================================================
-- 2. MISSING COLUMNS
-- ============================================================================

-- system_errors.stack
ALTER TABLE public.system_errors
  ADD COLUMN IF NOT EXISTS stack TEXT;

-- system_errors.url
ALTER TABLE public.system_errors
  ADD COLUMN IF NOT EXISTS url TEXT;

-- user_league_missions.mission_type
ALTER TABLE public.user_league_missions
  ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'solo' CHECK (mission_type IN ('solo', 'community', 'competitive', 'timed'));

-- user_active_items.item_type
ALTER TABLE public.user_active_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'general';

-- podcasts.peak_listener_count
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS peak_listener_count INTEGER DEFAULT 0;

-- podcast_episodes.recorded_at
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;

-- podcasts.started_at
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- user_profiles_1.subscribers_count (already added above to user_profiles)

-- auction_shows.scheduled_for
ALTER TABLE public.auction_shows
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- job_applications.review_notes
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- job_applications.position_id
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS position_id text;

-- user_league_missions.league_event_id
ALTER TABLE public.user_league_missions
  ADD COLUMN IF NOT EXISTS league_event_id UUID;

-- driver_tests.test_date
ALTER TABLE public.driver_tests
  ADD COLUMN IF NOT EXISTS test_date DATE;

-- coin_ledger.reason
ALTER TABLE public.coin_ledger
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- podcasts.user_id
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. MISSING FUNCTIONS
-- ============================================================================

-- is_user_chat_disabled(p_user_id)
CREATE OR REPLACE FUNCTION public.is_user_chat_disabled(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id AND chat_disabled_until > now()
  );
END;
$$;

-- is_user_chat_disabled (no-arg version, uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_user_chat_disabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_user_chat_disabled(auth.uid());
END;
$$;

-- is_beta_feedback_moderator(p_user_id)
CREATE OR REPLACE FUNCTION public.is_beta_feedback_moderator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
    AND (role = 'admin' OR role = 'moderator' OR is_beta_moderator = true)
  );
END;
$$;

-- is_beta_feedback_moderator (no-arg version)
CREATE OR REPLACE FUNCTION public.is_beta_feedback_moderator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_beta_feedback_moderator(auth.uid());
END;
$$;

-- get_user_active_roles(p_user_id)
CREATE OR REPLACE FUNCTION public.get_user_active_roles(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles TEXT[] := '{}';
BEGIN
  SELECT ARRAY_AGG(role) INTO v_roles
  FROM public.user_roles
  WHERE user_id = p_user_id AND is_active = true;

  IF v_roles IS NULL THEN
    v_roles := ARRAY[]::TEXT[];
  END IF;

  RETURN v_roles;
END;
$$;

-- get_portfolio_value(p_user_id)
CREATE OR REPLACE FUNCTION public.get_portfolio_value(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_value', COALESCE((SELECT SUM(price * quantity) FROM public.user_portfolio WHERE user_id = p_user_id), 0),
    'stocks_value', COALESCE((SELECT SUM(s.price * up.quantity) FROM public.user_portfolio up JOIN public.stocks s ON s.symbol = up.asset_symbol WHERE up.user_id = p_user_id), 0),
    'crypto_value', COALESCE((SELECT SUM(c.price * up.quantity) FROM public.user_portfolio up JOIN public.crypto_assets c ON c.symbol = up.asset_symbol WHERE up.user_id = p_user_id), 0)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- cleanup_expired_user_purchases
CREATE OR REPLACE FUNCTION public.cleanup_expired_user_purchases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM public.user_purchases
  WHERE expires_at < now() AND status = 'expired';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Grant execute permissions for all new functions
GRANT EXECUTE ON FUNCTION public.is_user_chat_disabled(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_chat_disabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_beta_feedback_moderator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_beta_feedback_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_value(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_user_purchases() TO authenticated;

-- ============================================================================
-- 4. MISSING RELATIONSHIPS (Foreign Keys)
-- ============================================================================

ALTER TABLE public.church_prayers
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- church_prayers.user_id → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'church_prayers_user_id_fkey'
  ) THEN
    ALTER TABLE public.church_prayers
      ADD CONSTRAINT church_prayers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.church_live_sessions
  ADD COLUMN IF NOT EXISTS pastor_id UUID;

-- church_live_sessions.pastor_id → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'church_live_sessions_pastor_id_fkey'
  ) THEN
    ALTER TABLE public.church_live_sessions
      ADD CONSTRAINT church_live_sessions_pastor_id_fkey
      FOREIGN KEY (pastor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- user_vehicles.vehicles_catalog → vehicles_catalog(id)
-- First ensure the column exists
ALTER TABLE public.user_vehicles
  ADD COLUMN IF NOT EXISTS vehicles_catalog_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_vehicles_vehicles_catalog_fkey'
  ) THEN
    ALTER TABLE public.user_vehicles
      ADD CONSTRAINT user_vehicles_vehicles_catalog_fkey
      FOREIGN KEY (vehicles_catalog_id) REFERENCES public.vehicles_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS docket_id UUID;

-- court_cases.court_dockets → court_dockets(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'court_cases_docket_id_fkey'
  ) THEN
    ALTER TABLE public.court_cases
      ADD CONSTRAINT court_cases_docket_id_fkey
      FOREIGN KEY (docket_id) REFERENCES public.court_dockets(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.court_summons
  ADD COLUMN IF NOT EXISTS case_id UUID;

-- court_summons.court_cases → court_cases(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'court_summons_case_id_fkey'
  ) THEN
    ALTER TABLE public.court_summons
      ADD CONSTRAINT court_summons_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.court_cases(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.court_dockets
  ADD COLUMN IF NOT EXISTS case_id UUID;

-- court_dockets.court_cases → court_cases(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'court_dockets_case_id_fkey'
  ) THEN
    ALTER TABLE public.court_dockets
      ADD CONSTRAINT court_dockets_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.court_cases(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.court_cases
  ADD COLUMN IF NOT EXISTS defendant_id UUID;

-- court_cases.defendant_id → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'court_cases_defendant_id_fkey'
  ) THEN
    ALTER TABLE public.court_cases
      ADD CONSTRAINT court_cases_defendant_id_fkey
      FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.troll_posts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- troll_posts.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'troll_posts_user_id_fkey'
  ) THEN
    ALTER TABLE public.troll_posts
      ADD CONSTRAINT troll_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.treelz_posts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- treelz_posts.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'treelz_posts_user_id_fkey'
  ) THEN
    ALTER TABLE public.treelz_posts
      ADD CONSTRAINT treelz_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.utromail_requests
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- utromail_requests.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'utromail_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.utromail_requests
      ADD CONSTRAINT utromail_requests_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.utromail_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- utromail_accounts.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'utromail_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE public.utromail_accounts
      ADD CONSTRAINT utromail_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.universe_showdown_invites
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- universe_showdown_invites.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'universe_showdown_invites_user_id_fkey'
  ) THEN
    ALTER TABLE public.universe_showdown_invites
      ADD CONSTRAINT universe_showdown_invites_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- job_applications.user_profiles → user_profiles(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_applications_user_id_fkey'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- job_applications.position_id → career_positions(id)
-- First ensure the column exists
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS position_id text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_applications_position_id_fkey'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES public.career_positions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- academy_graduate_badges.academy_learning_pathways → academy_learning_pathways(id)
ALTER TABLE public.academy_graduate_badges
  ADD COLUMN IF NOT EXISTS learning_pathway_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'academy_graduate_badges_pathway_id_fkey'
  ) THEN
    ALTER TABLE public.academy_graduate_badges
      ADD CONSTRAINT academy_graduate_badges_pathway_id_fkey
      FOREIGN KEY (learning_pathway_id) REFERENCES public.academy_learning_pathways(id) ON DELETE SET NULL;
  END IF;
END $$;

-- academy_certificates.academy_teachers → academy_teachers(id)
ALTER TABLE public.academy_certificates
  ADD COLUMN IF NOT EXISTS teacher_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'academy_certificates_teacher_id_fkey'
  ) THEN
    ALTER TABLE public.academy_certificates
      ADD CONSTRAINT academy_certificates_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.academy_teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- academy_courses.academy_categories → academy_categories(id)
ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS category_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'academy_courses_category_id_fkey'
  ) THEN
    ALTER TABLE public.academy_courses
      ADD CONSTRAINT academy_courses_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.academy_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tcnn_articles_published ON public.tcnn_articles(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category, is_active);
CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_user ON public.user_entrance_effects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_call_sounds_user ON public.user_call_sounds(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insurances_user ON public.user_insurances(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_court_cases_docket ON public.troll_court_cases(docket_id);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON public.stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_podcasts_user ON public.podcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_position ON public.job_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_auction_shows_scheduled ON public.auction_shows(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_coin_ledger_reason ON public.coin_ledger(reason);

-- ============================================================================
-- 6. UPDATE EXISTING RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Ensure RLS is enabled on all new tables
ALTER TABLE public.tcnn_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entrance_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_call_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_court_cases ENABLE ROW LEVEL SECURITY;
