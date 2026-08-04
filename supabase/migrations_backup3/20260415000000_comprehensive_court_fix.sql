-- ============================================================================
-- COMPREHENSIVE COURT TABLES FIX
-- ============================================================================
-- This migration fixes type mismatches and missing relationships in court tables

-- ============================================================================
-- 1. Fix court_cases table - ensure all ID columns are UUID
-- ============================================================================

-- First, add missing columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'docket_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN docket_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN plaintiff_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'defendant_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN defendant_id UUID;
    END IF;
END $$;

-- Add foreign keys for the new columns (check by constraint name, not column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'docket_id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'court_cases_docket_id_fkey'
        ) THEN
            ALTER TABLE court_cases 
            ADD CONSTRAINT court_cases_docket_id_fkey 
            FOREIGN KEY (docket_id) REFERENCES court_dockets(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'court_cases_plaintiff_id_fkey'
        ) THEN
            ALTER TABLE court_cases 
            ADD CONSTRAINT court_cases_plaintiff_id_fkey 
            FOREIGN KEY (plaintiff_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'defendant_id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'court_cases_defendant_id_fkey'
        ) THEN
            ALTER TABLE court_cases 
            ADD CONSTRAINT court_cases_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Fix status column to allow 'scheduled' and 'in_session' - handle both enum and CHECK
DO $$
DECLARE
    col_exists INTEGER;
    is_enum BOOLEAN := false;
BEGIN
    -- Check if status column exists
    SELECT COUNT(*) INTO col_exists 
    FROM information_schema.columns 
    WHERE table_name = 'court_cases' AND column_name = 'status';
    
    IF col_exists = 0 THEN
        RETURN;
    END IF;
    
    -- Check if it's an enum type
    SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'court_case_status') INTO is_enum;
    
    IF is_enum THEN
        -- It's an enum - add the missing values
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'in_session';
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Value already exists
        END;
        
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'scheduled';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'warrant_issued';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'appealed';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    ELSE
        -- It's a CHECK constraint - drop and recreate
        ALTER TABLE court_cases DROP CONSTRAINT IF EXISTS court_cases_status_check;
        ALTER TABLE court_cases ADD CONSTRAINT court_cases_status_check 
        CHECK (status IN ('pending', 'in_session', 'resolved', 'closed', 'dismissed', 'warrant_issued', 'inactive', 'scheduled', 'appealed', 'waiting', 'adjourned'));
    END IF;
END $$;

-- ============================================================================
-- 2. Fix court_summons table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_summons' AND column_name = 'case_id'
    ) THEN
        ALTER TABLE court_summons ADD COLUMN case_id UUID;
    END IF;
END $$;

-- Add foreign key for case_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_summons' AND column_name = 'case_id' AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'court_summons_case_id_fkey' AND table_name = 'court_summons'
        ) THEN
            ALTER TABLE court_summons 
            ADD CONSTRAINT court_summons_case_id_fkey 
            FOREIGN KEY (case_id) REFERENCES court_cases(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Ensure served_to column exists and is UUID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_summons' AND column_name = 'served_to'
    ) THEN
        ALTER TABLE court_summons ADD COLUMN served_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. Fix jail table - ensure foreign key exists
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) THEN
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Also add user_profiles foreign key to jail (reverse relationship) if needed
-- PostgREST needs the FK from jail to user_profiles, not the other way

-- ============================================================================
-- 4. Fix neighbors_events table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'neighbors_events' AND column_name = 'images'
    ) THEN
        ALTER TABLE neighbors_events ADD COLUMN images TEXT[] DEFAULT '{}';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'neighbors_events' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE neighbors_events ADD COLUMN approval_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- ============================================================================
-- 5. Recreate get_nearby_neighbors_events function with proper return type
-- ============================================================================

DROP FUNCTION IF EXISTS get_nearby_neighbors_events(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION get_nearby_neighbors_events(
    lat DOUBLE PRECISION, 
    lng DOUBLE PRECISION, 
    radius DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  max_participants INTEGER,
  reward_coins INTEGER,
  created_by_user_id UUID,
  business_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  approval_status TEXT,
  images TEXT[],
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ne.id,
    ne.title,
    ne.description,
    ne.category,
    ne.latitude,
    ne.longitude,
    ne.city,
    ne.state,
    ne.start_time,
    ne.end_time,
    ne.duration_minutes,
    ne.max_participants,
    ne.reward_coins,
    ne.created_by_user_id,
    ne.business_id,
    ne.status,
    ne.created_at,
    COALESCE(ne.approval_status, 'pending')::TEXT AS approval_status,
    COALESCE(ne.images, '{}')::TEXT[] AS images,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 AS distance
  FROM neighbors_events ne
  WHERE
    ne.status = 'active'
    AND COALESCE(ne.approval_status, 'pending') IN ('approved', 'pending')
    AND ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 <= radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_nearby_neighbors_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_neighbors_events TO anon;