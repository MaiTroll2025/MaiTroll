
-- Fix court_cases_status_check constraint to allow 'inactive' and other statuses
-- This resolves the error: new row for relation "court_cases" violates check constraint "court_cases_status_check"

ALTER TABLE public.court_cases DROP CONSTRAINT IF EXISTS court_cases_status_check;

ALTER TABLE public.court_cases
ADD CONSTRAINT court_cases_status_check
CHECK (status IN ('pending', 'in_session', 'resolved', 'closed', 'dismissed', 'warrant_issued', 'inactive', 'scheduled', 'appealed'));

-- Also update court_dockets if needed (just in case)
-- ALTER TABLE public.court_dockets DROP CONSTRAINT IF EXISTS court_dockets_status_check;
-- ALTER TABLE public.court_dockets ADD CONSTRAINT court_dockets_status_check CHECK (status IN ('open', 'full', 'closed', 'completed', 'active', 'live'));
