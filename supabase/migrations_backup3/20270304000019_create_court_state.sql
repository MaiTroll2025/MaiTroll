
-- Create court_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.court_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL,
    status TEXT DEFAULT 'waiting',
    started_by UUID,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create court_session_state table
CREATE TABLE IF NOT EXISTS public.court_session_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL UNIQUE,
    phase TEXT DEFAULT 'waiting',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key from court_sessions to court_cases
ALTER TABLE public.court_sessions
ADD CONSTRAINT fk_court_sessions_case_id
FOREIGN KEY (case_id)
REFERENCES public.court_cases(id)
ON DELETE CASCADE;

-- Add foreign key from court_session_state to court_cases
ALTER TABLE public.court_session_state
ADD CONSTRAINT fk_court_session_state_case_id
FOREIGN KEY (case_id)
REFERENCES public.court_cases(id)
ON DELETE CASCADE;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
