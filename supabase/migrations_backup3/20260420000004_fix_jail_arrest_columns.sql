-- Fix jail table columns for arrest functionality

-- Add missing columns to jail table
ALTER TABLE public.jail
ADD COLUMN IF NOT EXISTS arrest_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'jailed',
ADD COLUMN IF NOT EXISTS arrested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Add court_date column if missing
ALTER TABLE public.jail
ADD COLUMN IF NOT EXISTS court_date DATE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jail_status ON public.jail(status);
CREATE INDEX IF NOT EXISTS idx_jail_court_date ON public.jail(court_date);

-- Update existing records that have status = 'jailed'
UPDATE public.jail SET status = 'jailed' WHERE status IS NULL;