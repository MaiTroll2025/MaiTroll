-- Add missing enum values to court_case_status
-- This ensures 'scheduled' and other required values exist

DO $$
BEGIN
    -- Check if the enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'court_case_status') THEN
        -- Add 'scheduled' if missing
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'scheduled';
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Already exists
        END;
        
        -- Also add 'in_session' if missing
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'in_session';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        -- Add 'warrant_issued' if missing
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'warrant_issued';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
        
        -- Add 'appealed' if missing
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'appealed';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;