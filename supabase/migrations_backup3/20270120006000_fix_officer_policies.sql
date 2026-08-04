ALTER TABLE public.officer_work_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Officers can view own work sessions" ON public.officer_work_sessions;
DROP POLICY IF EXISTS "Admins and Leads can view all work sessions" ON public.officer_work_sessions;

-- Officers can view their own sessions
CREATE POLICY "Officers can view own work sessions"
ON public.officer_work_sessions
FOR SELECT
USING (
  auth.uid() = officer_id
);

-- Admins and Lead Officers can view all sessions
CREATE POLICY "Admins and Leads can view all work sessions"
ON public.officer_work_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (
      role = 'admin' 
      OR is_admin = true
      OR role = 'lead_troll_officer'
      OR is_lead_officer = true
    )
  )
);
