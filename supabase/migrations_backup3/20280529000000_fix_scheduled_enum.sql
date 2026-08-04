-- Fix: Add 'scheduled' and other missing values to court_case_status enum
-- Error: invalid input value for enum court_case_status: "scheduled"
-- This migration ensures all required enum values exist regardless of current state

DO $$
BEGIN
    -- Check if the enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'court_case_status') THEN
        -- Add each value individually, ignoring duplicates
        BEGIN ALTER TYPE court_case_status ADD VALUE 'pending'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'scheduled'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'in_session'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'resolved'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'closed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'dismissed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'warrant_issued'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'inactive'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'appealed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'waiting'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'adjourned'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE court_case_status ADD VALUE 'summoned'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    ELSE
        -- Enum doesn't exist yet — create it with all values
        CREATE TYPE court_case_status AS ENUM (
            'pending', 'scheduled', 'in_session', 'resolved', 'closed',
            'dismissed', 'warrant_issued', 'inactive', 'appealed',
            'waiting', 'adjourned', 'summoned'
        );
    END IF;
END $$;
