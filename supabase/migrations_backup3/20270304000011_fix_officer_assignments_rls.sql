-- Fix RLS for Officer Assignments and Work Sessions

-- 1. Enable RLS on officer_live_assignments
ALTER TABLE public.officer_live_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Officers can view own assignments" ON public.officer_live_assignments;
DROP POLICY IF EXISTS "Admins can view all assignments" ON public.officer_live_assignments;

-- 3. Create policies
-- Officers can view their own assignments
CREATE POLICY "Officers can view own assignments"
ON public.officer_live_assignments
FOR SELECT
USING (auth.uid() = officer_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
ON public.officer_live_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 4. Enable RLS on officer_work_sessions (if not already)
ALTER TABLE public.officer_work_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies
DROP POLICY IF EXISTS "Officers can view own work sessions" ON public.officer_work_sessions;

-- 6. Create policies for work sessions
CREATE POLICY "Officers can view own work sessions"
ON public.officer_work_sessions
FOR SELECT
USING (auth.uid() = officer_id);

-- Note: Insert/Update is handled via RPC or Edge Functions with Service Role, so no need for Insert/Update policies for users unless manual editing is allowed.
