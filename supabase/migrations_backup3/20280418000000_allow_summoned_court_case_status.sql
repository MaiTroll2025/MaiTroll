-- Add support for the 'summoned' court case status
-- This resolves invalid enum/value errors when court cases are created or updated with 'summoned'.

DO $$
BEGIN
    -- Add 'summoned' to the enum if it doesn't exist
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'court_case_status'
    ) THEN
        BEGIN
            ALTER TYPE court_case_status ADD VALUE 'summoned';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;
