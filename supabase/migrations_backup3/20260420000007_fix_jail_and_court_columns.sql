-- Fix jail and court_cases missing columns

-- Add arrested_by to jail table
ALTER TABLE public.jail
ADD COLUMN IF NOT EXISTS arrested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Add reason to court_cases table
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add case_type to court_cases if missing
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS case_type TEXT DEFAULT 'criminal';

-- Make sure updated_at exists on both tables
ALTER TABLE public.jail
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public court_cases
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';