-- ============================================================================
-- FIX COURT TABLES TYPE MISMATCHES AND RELATIONSHIPS
-- ============================================================================

-- ============================================================================
-- 1. Fix jail foreign key relationship (PGRST200 error)
-- ============================================================================

-- Ensure jail table exists with proper structure
CREATE TABLE IF NOT EXISTS public.jail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    release_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    sentence_days INTEGER DEFAULT 1,
    bond_amount INTEGER DEFAULT 0,
    bond_posted BOOLEAN DEFAULT false,
    message_minutes INTEGER DEFAULT 1,
    message_minutes_used INTEGER DEFAULT 0,
    free_message_used BOOLEAN DEFAULT false
);

-- Add foreign key from jail to user_profiles (this is what's needed for PostgREST)
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

-- Enable RLS on jail if not already
ALTER TABLE public.jail ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Ensure court_cases has all required columns with correct types
-- ============================================================================

-- Ensure plaintiff_id column is UUID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN plaintiff_id UUID;
    END IF;
END $$;

-- Ensure defendant_id column is UUID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'defendant_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN defendant_id UUID;
    END IF;
END $$;

-- Ensure docket_id column is UUID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'docket_id'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN docket_id UUID;
    END IF;
END $$;

-- Ensure users_involved column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'users_involved'
    ) THEN
        ALTER TABLE court_cases ADD COLUMN users_involved TEXT[];
    END IF;
END $$;

-- Add foreign keys if they don't exist (check by constraint name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'court_cases_plaintiff_id_fkey'
    ) THEN
        ALTER TABLE court_cases 
        ADD CONSTRAINT court_cases_plaintiff_id_fkey 
        FOREIGN KEY (plaintiff_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'court_cases_defendant_id_fkey'
    ) THEN
        ALTER TABLE court_cases 
        ADD CONSTRAINT court_cases_defendant_id_fkey 
        FOREIGN KEY (defendant_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'court_cases_docket_id_fkey'
    ) THEN
        ALTER TABLE court_cases 
        ADD CONSTRAINT court_cases_docket_id_fkey 
        FOREIGN KEY (docket_id) REFERENCES court_dockets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix status constraint - handle case where enum exists vs CHECK constraint
DO $$
BEGIN
    -- Check if it's an enum type
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'court_case_status'
    ) THEN
        -- It's an enum - add the missing value if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'in_session' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'court_case_status')
        ) THEN
            ALTER TYPE court_case_status ADD VALUE 'in_session';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'scheduled' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'court_case_status')
        ) THEN
            ALTER TYPE court_case_status ADD VALUE 'scheduled';
        END IF;
    ELSE
        -- It's a CHECK constraint - drop and recreate
        ALTER TABLE court_cases DROP CONSTRAINT IF EXISTS court_cases_status_check;
        ALTER TABLE court_cases ADD CONSTRAINT court_cases_status_check 
        CHECK (status IN ('pending', 'in_session', 'resolved', 'closed', 'dismissed', 'warrant_issued', 'inactive', 'scheduled', 'appealed', 'waiting', 'adjourned'));
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 3. Fix court_summons table - ensure case_id is UUID
-- ============================================================================

-- Ensure case_id column exists and is UUID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_summons' AND column_name = 'case_id'
    ) THEN
        ALTER TABLE court_summons ADD COLUMN case_id UUID;
    END IF;
END $$;

-- Add foreign key from court_summons to court_cases (this enables the relationship)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'court_summons_case_id_fkey'
    ) THEN
        ALTER TABLE court_summons 
        ADD CONSTRAINT court_summons_case_id_fkey 
        FOREIGN KEY (case_id) REFERENCES court_cases(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 4. Fix neighbors_events table - add missing columns
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
-- 5. Fix get_nearby_neighbors_events function return type (structure mismatch)
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
    COALESCE(ne.images, ARRAY[]::TEXT[])::TEXT[] AS images,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000::DOUBLE PRECISION AS distance
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
GRANT EXECUTE ON FUNCTION get_nearby_neighbors_events TO service_role;