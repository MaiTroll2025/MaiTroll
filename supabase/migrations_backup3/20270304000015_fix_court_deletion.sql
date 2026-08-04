-- Migration: Fix Troll Court Cases Plaintiff FK
-- Description: Updates troll_court_cases plaintiff_id FK to ON DELETE SET NULL

DO $$
BEGIN
    -- troll_court_cases.plaintiff_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_court_cases') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'plaintiff_id') THEN
            
            -- Drop existing if exists
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'troll_court_cases_plaintiff_id_fkey') THEN
                ALTER TABLE troll_court_cases DROP CONSTRAINT troll_court_cases_plaintiff_id_fkey;
            END IF;

            -- Add new with SET NULL
            ALTER TABLE troll_court_cases 
            ADD CONSTRAINT troll_court_cases_plaintiff_id_fkey 
            FOREIGN KEY (plaintiff_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
            
        END IF;
    END IF;
END $$;
