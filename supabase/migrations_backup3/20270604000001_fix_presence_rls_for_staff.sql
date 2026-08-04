-- Migration: Fix presence RLS for staff/admin monitoring
-- Timestamp: 20270604000001

-- Allow staff/admin roles to read all user_presence_routes for monitoring
DROP POLICY IF EXISTS "staff can view all presence routes" ON public.user_presence_routes;
CREATE POLICY "staff can view all presence routes"
  ON public.user_presence_routes
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_profiles 
      WHERE is_admin = true OR role IN ('admin', 'superadmin', 'ceo', 'staff', 'officer', 'troll_officer', 'lead_troll_officer', 'secretary', 'moderator')
    )
  );

-- Allow staff/admin roles to read all user_presence for monitoring
DROP POLICY IF EXISTS "staff can view all presence" ON public.user_presence;
CREATE POLICY "staff can view all presence"
  ON public.user_presence
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.user_profiles 
      WHERE is_admin = true OR role IN ('admin', 'superadmin', 'ceo', 'staff', 'officer', 'troll_officer', 'lead_troll_officer', 'secretary', 'moderator')
    )
  );