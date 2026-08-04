-- Migration: Fix More Court FKs
-- Description: Updates remaining court-related FKs to ON DELETE SET NULL

DO $$
BEGIN
    ----------------------------------------------------------------
    -- 1. troll_court_cases (Remaining fields)
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_court_cases') THEN
        
        -- defendant_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'defendant_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'troll_court_cases_defendant_id_fkey') THEN
                ALTER TABLE troll_court_cases DROP CONSTRAINT troll_court_cases_defendant_id_fkey;
            END IF;
            ALTER TABLE troll_court_cases ADD CONSTRAINT troll_court_cases_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- judge_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'judge_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'troll_court_cases_judge_id_fkey') THEN
                ALTER TABLE troll_court_cases DROP CONSTRAINT troll_court_cases_judge_id_fkey;
            END IF;
            ALTER TABLE troll_court_cases ADD CONSTRAINT troll_court_cases_judge_id_fkey 
            FOREIGN KEY (judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- assigned_judge_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'assigned_judge_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'troll_court_cases_assigned_judge_id_fkey') THEN
                ALTER TABLE troll_court_cases DROP CONSTRAINT troll_court_cases_assigned_judge_id_fkey;
            END IF;
            ALTER TABLE troll_court_cases ADD CONSTRAINT troll_court_cases_assigned_judge_id_fkey 
            FOREIGN KEY (assigned_judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

         -- prosecutor_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_court_cases' AND column_name = 'prosecutor_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'troll_court_cases_prosecutor_id_fkey') THEN
                ALTER TABLE troll_court_cases DROP CONSTRAINT troll_court_cases_prosecutor_id_fkey;
            END IF;
            ALTER TABLE troll_court_cases ADD CONSTRAINT troll_court_cases_prosecutor_id_fkey 
            FOREIGN KEY (prosecutor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

    END IF;

    ----------------------------------------------------------------
    -- 2. court_cases
    ----------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases') THEN
        
        -- defendant_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'defendant_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_cases_defendant_id_fkey') THEN
                ALTER TABLE court_cases DROP CONSTRAINT court_cases_defendant_id_fkey;
            END IF;
            ALTER TABLE court_cases ADD CONSTRAINT court_cases_defendant_id_fkey 
            FOREIGN KEY (defendant_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- accuser_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'accuser_id') THEN
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_cases_accuser_id_fkey') THEN
                ALTER TABLE court_cases DROP CONSTRAINT court_cases_accuser_id_fkey;
            END IF;
            ALTER TABLE court_cases ADD CONSTRAINT court_cases_accuser_id_fkey 
            FOREIGN KEY (accuser_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

        -- plaintiff_id
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id') THEN
             IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'court_cases_plaintiff_id_fkey') THEN
                ALTER TABLE court_cases DROP CONSTRAINT court_cases_plaintiff_id_fkey;
            END IF;
            ALTER TABLE court_cases ADD CONSTRAINT court_cases_plaintiff_id_fkey 
            FOREIGN KEY (plaintiff_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
        END IF;

    END IF;
END $$;
