-- Add cases_count to court_dockets if missing

ALTER TABLE public.court_dockets
ADD COLUMN IF NOT EXISTS cases_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Run the ensure function to create Tue/Thu dockets
SELECT public.ensure_court_dockets();

-- Notify schema reload
NOTIFY pgrst, 'reload schema';