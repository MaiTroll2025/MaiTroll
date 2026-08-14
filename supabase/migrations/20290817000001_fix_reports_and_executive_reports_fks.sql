-- Fix: Restore user_reports/executive_reports/executive FK relationships to user_profiles
-- and ensure executive_reports has the correct schema (reviewed_by_admin, created_by, etc.)
--
-- Root causes:
--   1. user_reports FK constraints point to auth.users(id) instead of user_profiles(id),
--      causing PostgREST error: "Could not find a relationship between 'user_reports' and
--      'user_profiles' in the schema cache" when the frontend uses explicit FK names
--      (user_reports_reporter_id_fkey, user_reports_reported_user_id_fkey).
--   2. executive_reports may be missing reviewed_by_admin column (backup3 schema defines
--      a different shape with user_id/data instead of the baseline created_by/reviewed_by_admin).
--   3. Same FK issue affects moderation_actions, payout_requests, and role_requests
--      which all use explicit user_profiles!<constraint_name> joins in the dashboard code.
--   4. PostgREST schema cache is stale and needs a reload.

-- ============================================================================
-- 1. Ensure user_reports table exists with correct columns
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_reports'
  ) THEN
    CREATE TABLE public.user_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL,
      reported_user_id UUID,
      reported_id UUID,
      reason TEXT,
      description TEXT,
      stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'pending',
      reviewed_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    ALTER TABLE public.user_reports
      ADD COLUMN IF NOT EXISTS reporter_id UUID,
      ADD COLUMN IF NOT EXISTS reported_user_id UUID,
      ADD COLUMN IF NOT EXISTS reported_id UUID,
      ADD COLUMN IF NOT EXISTS reason TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS stream_id UUID,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS reviewed_by UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 2. Fix FK constraints on user_reports → user_profiles
--    Drop existing constraints (which may reference auth.users) and recreate
--    to reference public.user_profiles(id) with the exact constraint names
--    the frontend code expects.
-- ============================================================================

-- Helper: ensure a column existence check is done before adding FK
-- 2a. reporter_id → user_profiles
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_reports_reporter_id_fkey'
        AND conrelid = 'public.user_reports'::regclass
    ) THEN
      ALTER TABLE public.user_reports DROP CONSTRAINT user_reports_reporter_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_reports' AND column_name = 'reporter_id'
    ) THEN
      ALTER TABLE public.user_reports
        ADD CONSTRAINT user_reports_reporter_id_fkey
        FOREIGN KEY (reporter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2b. reported_user_id → user_profiles
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_reports_reported_user_id_fkey'
        AND conrelid = 'public.user_reports'::regclass
    ) THEN
      ALTER TABLE public.user_reports DROP CONSTRAINT user_reports_reported_user_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_reports' AND column_name = 'reported_user_id'
    ) THEN
      ALTER TABLE public.user_reports
        ADD CONSTRAINT user_reports_reported_user_id_fkey
        FOREIGN KEY (reported_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2c. reviewed_by → user_profiles (if the column/constraint exists)
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_reports_reviewed_by_fkey'
        AND conrelid = 'public.user_reports'::regclass
    ) THEN
      ALTER TABLE public.user_reports DROP CONSTRAINT user_reports_reviewed_by_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_reports' AND column_name = 'reviewed_by'
    ) THEN
      ALTER TABLE public.user_reports
        ADD CONSTRAINT user_reports_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 2d. Sync reported_user_id and reported_id alias columns
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.user_reports
      SET reported_user_id = COALESCE(reported_user_id, reported_id),
          reported_id = COALESCE(reported_id, reported_user_id)
      WHERE (reported_user_id IS NULL OR reported_id IS NULL)
        AND (reported_user_id IS NOT NULL OR reported_id IS NOT NULL)
    $sql$;
  END IF;
END $$;

-- 2e. Indexes for query performance
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON public.user_reports(reported_user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_reports_created ON public.user_reports(created_at DESC)';
  END IF;
END $$;

-- 2f. RLS policies for user_reports
DO $$
BEGIN
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can create reports" ON public.user_reports;
    CREATE POLICY "Anyone can create reports"
      ON public.user_reports FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "Officers can view reports" ON public.user_reports;
    CREATE POLICY "Officers can view reports"
      ON public.user_reports FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (
              user_profiles.role IN ('admin', 'moderator', 'troll_officer', 'ceo', 'ceo_assistant', 'noah_assistant')
              OR user_profiles.is_admin = true
              OR user_profiles.is_troll_officer = true
              OR user_profiles.is_lead_officer = true
              OR user_profiles.is_secretary = true
            )
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. Ensure executive_reports table has correct schema
--    The baseline defines: id, report_date, title, summary, created_by,
--    reviewed_by_admin, created_at. The backup3 "create_all_missing_tables"
--    migration defined a different shape (user_id, data, created_at, updated_at).
--    Ensure ALL expected columns exist so the frontend queries succeed.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'executive_reports'
  ) THEN
    CREATE TABLE public.executive_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      report_date DATE DEFAULT CURRENT_DATE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_by UUID NOT NULL,
      reviewed_by_admin BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    ALTER TABLE public.executive_reports
      ADD COLUMN IF NOT EXISTS report_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS summary TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS reviewed_by_admin BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

    -- If the backup3 schema created user_id instead of created_by, backfill
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'executive_reports' AND column_name = 'user_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'executive_reports' AND column_name = 'created_by'
    ) THEN
      UPDATE public.executive_reports SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;
    END IF;

    -- If created_by was just added (was missing), backfill from user_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'executive_reports' AND column_name = 'user_id'
    ) THEN
      UPDATE public.executive_reports
      SET created_by = user_id
      WHERE created_by IS NULL AND user_id IS NOT NULL;
    END IF;

    -- If the backup3 schema created a data JSONB column, try to extract title/summary
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'executive_reports' AND column_name = 'data'
    ) THEN
      UPDATE public.executive_reports
      SET title = COALESCE(title, data->>'title'),
          summary = COALESCE(summary, data->>'summary'),
          report_date = COALESCE(report_date, (data->>'report_date')::date)
      WHERE (title IS NULL OR summary IS NULL OR report_date IS NULL)
        AND data IS NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. Fix FK on executive_reports.created_by → user_profiles
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.executive_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'executive_reports_created_by_fkey'
        AND conrelid = 'public.executive_reports'::regclass
    ) THEN
      ALTER TABLE public.executive_reports DROP CONSTRAINT executive_reports_created_by_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'executive_reports' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE public.executive_reports
        ADD CONSTRAINT executive_reports_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. Fix FK constraints on moderation_actions → user_profiles
--    (same pattern; the dashboard uses explicit FK names for joins)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.moderation_actions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'moderation_actions_actor_id_fkey'
        AND conrelid = 'public.moderation_actions'::regclass
    ) THEN
      ALTER TABLE public.moderation_actions DROP CONSTRAINT moderation_actions_actor_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'moderation_actions' AND column_name = 'actor_id'
    ) THEN
      ALTER TABLE public.moderation_actions
        ADD CONSTRAINT moderation_actions_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.moderation_actions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'moderation_actions_target_user_id_fkey'
        AND conrelid = 'public.moderation_actions'::regclass
    ) THEN
      ALTER TABLE public.moderation_actions DROP CONSTRAINT moderation_actions_target_user_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'moderation_actions' AND column_name = 'target_user_id'
    ) THEN
      ALTER TABLE public.moderation_actions
        ADD CONSTRAINT moderation_actions_target_user_id_fkey
        FOREIGN KEY (target_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 6. Fix FK constraints on payout_requests → user_profiles
--    (dashboard uses payout_requests_user_id_fkey for embedding)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.payout_requests') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'payout_requests_user_id_fkey'
        AND conrelid = 'public.payout_requests'::regclass
    ) THEN
      ALTER TABLE public.payout_requests DROP CONSTRAINT payout_requests_user_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payout_requests' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.payout_requests
        ADD CONSTRAINT payout_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 7. Fix FK constraint on role_requests → user_profiles
--    (dashboard uses role_requests_user_id_fkey for embedding)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.role_requests') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'role_requests_user_id_fkey'
        AND conrelid = 'public.role_requests'::regclass
    ) THEN
      ALTER TABLE public.role_requests DROP CONSTRAINT role_requests_user_id_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'role_requests' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.role_requests
        ADD CONSTRAINT role_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 8. RLS for executive_reports
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.executive_reports') IS NOT NULL THEN
    ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Admin can view all executive reports" ON public.executive_reports;
    CREATE POLICY "Admin can view all executive reports"
      ON public.executive_reports FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (user_profiles.is_admin = true OR user_profiles.role = 'admin')
        )
      );

    DROP POLICY IF EXISTS "Secretaries can view executive reports" ON public.executive_reports;
    CREATE POLICY "Secretaries can view executive reports"
      ON public.executive_reports FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (
              user_profiles.is_admin = true
              OR user_profiles.role = 'admin'
              OR user_profiles.is_secretary = true
              OR user_profiles.role = 'secretary'
            )
        )
      );

    DROP POLICY IF EXISTS "CEO assistants and NOAH assistants can view executive reports" ON public.executive_reports;
    CREATE POLICY "CEO assistants and NOAH assistants can view executive reports"
      ON public.executive_reports FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (
              user_profiles.is_admin = true
              OR user_profiles.role = 'admin'
              OR user_profiles.role IN ('ceo_assistant', 'noah_assistant')
              OR user_profiles.troll_role IN ('ceo_assistant', 'noah_assistant')
            )
        )
      );

    DROP POLICY IF EXISTS "Secretaries can create executive reports" ON public.executive_reports;
    CREATE POLICY "Secretaries can create executive reports"
      ON public.executive_reports FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (user_profiles.is_admin = true OR user_profiles.is_secretary = true)
        )
      );

    -- Allow staff to update reviewed_by_admin on reports
    DROP POLICY IF EXISTS "staff can update executive reports" ON public.executive_reports;
    CREATE POLICY "staff can update executive reports"
      ON public.executive_reports FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (
              user_profiles.is_admin = true
              OR user_profiles.role = 'admin'
              OR user_profiles.role IN ('ceo_assistant', 'noah_assistant')
              OR (user_profiles.is_secretary = true OR user_profiles.role = 'secretary')
            )
        )
      );

    -- Allow users to insert their own executive reports (secretaries)
    DROP POLICY IF EXISTS "auth_insert_own_executive_reports" ON public.executive_reports;
    CREATE POLICY "auth_insert_own_executive_reports"
      ON public.executive_reports FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());

    DROP POLICY IF EXISTS "auth_select_own_executive_reports" ON public.executive_reports;
    CREATE POLICY "auth_select_own_executive_reports"
      ON public.executive_reports FOR SELECT TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

-- ============================================================================
-- 9. Ensure admin_reports table exists with correct schema
--    Used by CEO Assistant and NOAH Assistant dashboards for count queries.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_reports'
  ) THEN
    CREATE TABLE public.admin_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      category VARCHAR(50),
      severity VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'open',
      submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
      assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolution_notes TEXT
    );
    ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
  ELSE
    ALTER TABLE public.admin_reports
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS category VARCHAR(50),
      ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open',
      ADD COLUMN IF NOT EXISTS submitted_by UUID,
      ADD COLUMN IF NOT EXISTS assigned_to UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
    ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Fix submitted_by FK → user_profiles
  IF to_regclass('public.admin_reports') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'admin_reports_submitted_by_fkey'
        AND conrelid = 'public.admin_reports'::regclass
    ) THEN
      ALTER TABLE public.admin_reports DROP CONSTRAINT admin_reports_submitted_by_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_reports' AND column_name = 'submitted_by'
    ) THEN
      ALTER TABLE public.admin_reports
        ADD CONSTRAINT admin_reports_submitted_by_fkey
        FOREIGN KEY (submitted_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    -- Fix assigned_to FK → user_profiles
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'admin_reports_assigned_to_fkey'
        AND conrelid = 'public.admin_reports'::regclass
    ) THEN
      ALTER TABLE public.admin_reports DROP CONSTRAINT admin_reports_assigned_to_fkey;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_reports' AND column_name = 'assigned_to'
    ) THEN
      ALTER TABLE public.admin_reports
        ADD CONSTRAINT admin_reports_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_admin_reports_status ON public.admin_reports(status);
    CREATE INDEX IF NOT EXISTS idx_admin_reports_created_at ON public.admin_reports(created_at DESC);

    -- RLS policies
    DROP POLICY IF EXISTS "Admins can view all admin reports" ON public.admin_reports;
    CREATE POLICY "Admins can view all admin reports"
      ON public.admin_reports FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator', 'ceo', 'ceo_assistant', 'noah_assistant')
                 OR user_profiles.is_admin = true)
        )
      );

    DROP POLICY IF EXISTS "Staff can create admin reports" ON public.admin_reports;
    CREATE POLICY "Staff can create admin reports"
      ON public.admin_reports FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator', 'troll_officer', 'secretary', 'lead_troll_officer', 'ceo_assistant', 'noah_assistant')
                 OR user_profiles.is_admin = true)
        )
      );

    DROP POLICY IF EXISTS "Staff can update admin reports" ON public.admin_reports;
    CREATE POLICY "Staff can update admin reports"
      ON public.admin_reports FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND (user_profiles.is_admin = true OR user_profiles.role = 'admin')
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 10. Reload PostgREST schema cache
--     Critical: without this, PostgREST won't discover the new FK relationships
--     and will keep returning "Could not find a relationship" errors.
-- ============================================================================

NOTIFY pgrst, 'reload schema';
