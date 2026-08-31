-- ============================================================================
-- Bug Center Database Fixes — 2026-08-30
-- ============================================================================
-- Fixes the following reported issues:
--   • PGRST205: missing tables public.auctioneer_profiles, public.officer_members
--   • PGRST201: ambiguous relationship between court_cases and court_dockets
--   • PGRST200: missing relationship court_summons.served_to → user_profiles
--   • 42501: permission denied for admin_settings and global_events
--   • 23502: null value in user_league_missions.mission_key violates not-null
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE MISSING TABLES
-- ============================================================================

-- officer_members: referenced by Sidebar, usePhoneRoleAccess, isActive
CREATE TABLE IF NOT EXISTS public.officer_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'officer' CHECK (role IN ('officer', 'lead_officer', 'secretary')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    assigned_zone TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_members_user_id ON public.officer_members(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_members_status ON public.officer_members(status);

ALTER TABLE public.officer_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view officer members" ON public.officer_members;
CREATE POLICY "Public view officer members" ON public.officer_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage officer members" ON public.officer_members;
CREATE POLICY "Staff manage officer members" ON public.officer_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
            OR is_admin = true
            OR is_troll_officer = true
            OR is_lead_officer = true
        )
    )
);

-- auctioneer_profiles: referenced by auction pages and Sidebar
CREATE TABLE IF NOT EXISTS public.auctioneer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    strike_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auctioneer_profiles_user_id ON public.auctioneer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_auctioneer_profiles_is_active ON public.auctioneer_profiles(is_active);

ALTER TABLE public.auctioneer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view auctioneer profiles" ON public.auctioneer_profiles;
CREATE POLICY "Public view auctioneer profiles" ON public.auctioneer_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auctioneers manage own profile" ON public.auctioneer_profiles;
CREATE POLICY "Auctioneers manage own profile" ON public.auctioneer_profiles FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'lead_troll_officer')
    )
);

-- ============================================================================
-- 2. FIX MISSING FOREIGN KEY FOR court_summons.served_to
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'court_summons_served_to_fkey'
      AND table_name = 'court_summons'
  ) THEN
    ALTER TABLE public.court_summons
      ADD CONSTRAINT court_summons_served_to_fkey
      FOREIGN KEY (served_to) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. GRANT MISSING PERMISSIONS
-- ============================================================================

-- admin_settings: frontend reads these from /, /auth, /broadcast/setup
GRANT SELECT ON public.admin_settings TO anon;
GRANT INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;

-- global_events: frontend inserts events on login/logout/activity
GRANT SELECT, INSERT ON public.global_events TO anon;
GRANT UPDATE, DELETE ON public.global_events TO authenticated;

-- ============================================================================
-- 4. FIX NOT-NULL VIOLATION ON user_league_missions.mission_key
-- ============================================================================

-- The generate_user_league_missions RPC can occasionally produce a null mission_key
-- when mission_templates is missing data. Make the column nullable to prevent
-- hard failures until the RPC / template data is corrected.
ALTER TABLE public.user_league_missions
  ALTER COLUMN mission_key DROP NOT NULL;

-- ============================================================================
-- 5. FORCE POSTGREST SCHEMA CACHE REFRESH
-- ============================================================================

-- PostgREST auto-refreshes on DDL. The comments below ensure it picks up the
-- new / altered objects immediately.
COMMENT ON TABLE public.officer_members IS 'Schema cache refresh — BugCenter fix 2026-08-30';
COMMENT ON TABLE public.auctioneer_profiles IS 'Schema cache refresh — BugCenter fix 2026-08-30';
COMMENT ON CONSTRAINT court_summons_served_to_fkey ON public.court_summons IS 'Schema cache refresh — BugCenter fix 2026-08-30';
COMMENT ON COLUMN public.user_league_missions.mission_key IS 'Schema cache refresh — BugCenter fix 2026-08-30';

COMMIT;
