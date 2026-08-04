
-- Fix Court Foreign Key Constraint
-- The defendant_id was incorrectly referencing 'profiles' (legacy?) instead of 'user_profiles'

DO $$
BEGIN
    -- Only proceed if the table 'court_cases' exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases' AND table_schema = 'public') THEN
        
        -- Drop the incorrect constraint if it exists (referencing profiles)
        IF EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'court_cases_defendant_id_fkey' 
            AND table_name = 'court_cases'
        ) THEN
            -- Check if it points to the wrong table (optional, but safer just to drop and recreate if we are sure)
            -- Or just assume we want to enforce it points to user_profiles
            ALTER TABLE public.court_cases DROP CONSTRAINT court_cases_defendant_id_fkey;
        END IF;

        -- Add the correct constraint referencing user_profiles
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'court_cases_defendant_id_fkey' 
            AND table_name = 'court_cases'
        ) THEN
            ALTER TABLE public.court_cases 
            ADD CONSTRAINT court_cases_defendant_id_fkey 
            FOREIGN KEY (defendant_id) 
            REFERENCES public.user_profiles(id)
            ON DELETE SET NULL;
        END IF;
        
    END IF;
END $$;
