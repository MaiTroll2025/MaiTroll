-- Fix court_sessions missing case_id column and ensure required relationships
-- This prevents 406 Not Acceptable errors from PostgREST

-- ============================================================================
-- 1. Add case_id to court_sessions if missing
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_sessions' AND column_name = 'case_id'
    ) THEN
        ALTER TABLE court_sessions ADD COLUMN case_id UUID REFERENCES court_cases(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. Add court_session_id to court_participants if missing (should already exist)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_participants' AND column_name = 'court_session_id'
    ) THEN
        ALTER TABLE court_participants ADD COLUMN court_session_id UUID REFERENCES court_sessions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 3. Add is_live and started_by to court_session_state if missing
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_session_state' AND column_name = 'is_live'
    ) THEN
        ALTER TABLE court_session_state ADD COLUMN is_live BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_session_state' AND column_name = 'started_by'
    ) THEN
        ALTER TABLE court_session_state ADD COLUMN started_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_session_state' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE court_session_state ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_session_state' AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE court_session_state ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_session_state' AND column_name = 'ai_enabled'
    ) THEN
        ALTER TABLE court_session_state ADD COLUMN ai_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

-- ============================================================================
-- 4. Handle orphaned court_session_state rows (no matching case_id)
-- Note: Skip FK constraint - orphaned rows may exist
-- ============================================================================

-- ============================================================================
-- 5. Grant permissions for new columns
-- ============================================================================
GRANT SELECT ON public.court_sessions TO authenticated;
GRANT SELECT ON public.court_participants TO authenticated;
GRANT SELECT ON public.court_session_state TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';