-- ============================================================================
-- MAI Record Label Contracts RLS Policies
-- ============================================================================
-- Adds row-level security policies for the record_label_contracts table.
-- ============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "label_contract_admin_manage" ON public.record_label_contracts;
DROP POLICY IF EXISTS "label_contract_read_own" ON public.record_label_contracts;

-- Admin full management policy
CREATE POLICY "label_contract_admin_manage"
  ON public.record_label_contracts
  FOR ALL
  TO authenticated
  USING (
    public.is_record_label_admin()
  )
  WITH CHECK (
    public.is_record_label_admin()
  );

-- Read own contracts policy (via artist profile ownership)
CREATE POLICY "label_contract_read_own"
  ON public.record_label_contracts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.record_label_artist_profiles rap
      WHERE rap.id = record_label_contracts.artist_id
        AND rap.user_id = auth.uid()
    )
  );
