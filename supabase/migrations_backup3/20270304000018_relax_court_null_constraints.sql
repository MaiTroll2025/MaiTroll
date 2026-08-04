-- Migration: Relax NOT NULL constraints for court cases
-- Description: Allows plaintiff_id and defendant_id to be NULL so users can be deleted.

DO $$
BEGIN
    ----------------------------------------------------------------
    -- troll_court_cases
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_court_cases') THEN
        
        -- plaintiff_id: Allow NULL
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'plaintiff_id' AND is_nullable = 'NO') THEN
            ALTER TABLE troll_court_cases ALTER COLUMN plaintiff_id DROP NOT NULL;
        END IF;

        -- defendant_id: Allow NULL (checking just in case)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'defendant_id' AND is_nullable = 'NO') THEN
            ALTER TABLE troll_court_cases ALTER COLUMN defendant_id DROP NOT NULL;
        END IF;

    END IF;

END $$;
