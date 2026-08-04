-- Allow officers, lead officers, admins, and secretaries to view all shift slots
-- Required for global shift calendar visibility across dashboards

DO $$ BEGIN
  CREATE POLICY "Officers and secretaries can view all shift slots"
  ON public.officer_shift_slots
  FOR SELECT
  TO authenticated
  USING (
    public.is_officer_or_admin()
    OR public.is_admin_or_secretary()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
