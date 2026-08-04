-- Force fix court_cases and jail schema

-- Fix court_cases: ensure id is UUID
ALTER TABLE public.court_cases 
ALTER COLUMN id TYPE UUID USING id::UUID;

-- Make sure all required columns exist with correct types
DO $$
BEGIN
    -- Add reason if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'reason'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN reason TEXT;
    END IF;
    
    -- Add case_type if not exists  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'case_type'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN case_type TEXT DEFAULT 'criminal';
    END IF;
END $$;

-- Fix jail table
DO $$
BEGIN
    -- Add arrested_by if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jail' AND column_name = 'arrested_by'
    ) THEN
        ALTER TABLE public.jail ADD COLUMN arrested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
    
    -- Add court_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jail' AND column_name = 'court_date'
    ) THEN
        ALTER TABLE public.jail ADD COLUMN court_date DATE;
    END IF;
    
    -- Add status if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jail' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.jail ADD COLUMN status TEXT DEFAULT 'jailed';
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Fixed court_cases and jail schema' as result;