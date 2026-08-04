BEGIN;

-- hr_onboarding_items was referenced in HiringTab.tsx but missing from migrations.
-- This migration creates the table and seeds default onboarding documents.

CREATE TABLE IF NOT EXISTS public.hr_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  document_name text NOT NULL,
  category text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'not_sent'
    CHECK (status IN ('not_sent','sent','submitted','approved','rejected','waived')),
  due_date date,
  sent_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, document_key)
);

ALTER TABLE public.hr_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_onboarding_items_read_self"
  ON public.hr_onboarding_items FOR SELECT
  TO authenticated
  USING (
    auth.uid() = employee_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin','secretary','lead_troll_officer','ceo_assistant','noah_assistant') OR is_admin = true)
    )
  );

CREATE POLICY "hr_onboarding_items_write_hr"
  ON public.hr_onboarding_items FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin','secretary','lead_troll_officer','ceo_assistant','noah_assistant') OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (role IN ('admin','secretary','lead_troll_officer','ceo_assistant','noah_assistant') OR is_admin = true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_items_employee
  ON public.hr_onboarding_items(employee_id);

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_items_status
  ON public.hr_onboarding_items(status);

COMMIT;
