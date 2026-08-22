BEGIN;

-- Enable RLS on career_applications if not already enabled
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can insert own career applications" ON public.career_applications;
DROP POLICY IF EXISTS "Users can view own career applications" ON public.career_applications;
DROP POLICY IF EXISTS "Users can update own pending career applications" ON public.career_applications;
DROP POLICY IF EXISTS "Admins and staff can manage all career applications" ON public.career_applications;

-- Policy: Users can insert their own career applications
CREATE POLICY "Users can insert own career applications"
  ON public.career_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own career applications
CREATE POLICY "Users can view own career applications"
  ON public.career_applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'hr_admin', 'agency_hr_manager', 'ceo_assistant', 'noah_assistant')
          OR is_lead_officer = true
          OR is_ceo_assistant = true
          OR is_noah_assistant = true
        )
    )
  );

-- Policy: Users can update their own pending career applications
CREATE POLICY "Users can update own pending career applications"
  ON public.career_applications FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'hr_admin', 'agency_hr_manager', 'ceo_assistant', 'noah_assistant')
          OR is_lead_officer = true
          OR is_ceo_assistant = true
          OR is_noah_assistant = true
        )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'hr_admin', 'agency_hr_manager', 'ceo_assistant', 'noah_assistant')
          OR is_lead_officer = true
          OR is_ceo_assistant = true
          OR is_noah_assistant = true
        )
    )
  );

-- Policy: Admins and staff can delete career applications
CREATE POLICY "Admins and staff can delete career applications"
  ON public.career_applications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'hr_admin', 'agency_hr_manager')
          OR is_lead_officer = true
        )
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
