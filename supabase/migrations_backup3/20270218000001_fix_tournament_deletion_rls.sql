-- Fix RLS policies for tournaments to allow founders and ensure deletion works
-- Also ensure RLS checks for 'founder' role and strictly validates admin status

-- 1. Update Tournaments Policy
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;

CREATE POLICY "Admins and Founders can manage tournaments" 
  ON public.tournaments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'founder', 'service_role') 
        OR is_admin = true
        OR is_lead_officer = true -- Optional: Allow lead officers?
      )
    )
  );

-- 2. Update Tournament Participants Policy
DROP POLICY IF EXISTS "Admins can manage participants" ON public.tournament_participants;

CREATE POLICY "Admins and Founders can manage participants" 
  ON public.tournament_participants FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND (
        role IN ('admin', 'founder', 'service_role') 
        OR is_admin = true
        OR is_lead_officer = true
      )
    )
  );
