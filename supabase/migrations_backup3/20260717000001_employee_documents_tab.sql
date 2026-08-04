BEGIN;

-- =========================================================================
-- Employee Page — Documents tab (post-hire required documents)
-- Separated from the jobs_hiring_system migration per build plan.
-- Reuses hr_onboarding_items (created in 20260716000002_*) and
-- extends it for a real HR document workflow, plus a configurable
-- document-template table so required docs are data-driven per role.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Extend hr_onboarding_items for real HR document tracking
-- -------------------------------------------------------------------------
ALTER TABLE public.hr_onboarding_items
  ADD COLUMN IF NOT EXISTS reviewed_reason text,
  ADD COLUMN IF NOT EXISTS resubmit_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS category text;

-- Expand status to include 'needs_correction' used by the Documents tab.
ALTER TABLE public.hr_onboarding_items
  DROP CONSTRAINT IF EXISTS hr_onboarding_items_status_check;

ALTER TABLE public.hr_onboarding_items
  ADD CONSTRAINT hr_onboarding_items_status_check
  CHECK (
    status = ANY (ARRAY[
      'not_sent'::text,
      'sent'::text,
      'submitted'::text,
      'needs_correction'::text,
      'approved'::text,
      'rejected'::text,
      'waived'::text,
      'completed'::text
    ])
  );

-- Widen write RLS to the full hiring HR group (matches jobs_hiring_system).
DROP POLICY IF EXISTS "hr_onboarding_items_write_hr" ON public.hr_onboarding_items;
CREATE POLICY "hr_onboarding_items_write_hr"
  ON public.hr_onboarding_items FOR ALL
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
  )
  WITH CHECK (
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

CREATE INDEX IF NOT EXISTS idx_hr_onboarding_items_category
  ON public.hr_onboarding_items(category);

-- -------------------------------------------------------------------------
-- 2. employee_document_templates — configurable required documents
--    Drives the Documents tab. HR can assign templates (by category
--    and/or role) to a hired employee, creating hr_onboarding_items rows.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_document_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_key text NOT NULL,
  document_name text NOT NULL,
  category text NOT NULL,
  description text,
  required boolean DEFAULT true,
  applies_to_roles text[],
  applies_to_categories text[],
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_document_templates_pkey PRIMARY KEY (id),
  CONSTRAINT employee_document_templates_key_unique UNIQUE (document_key)
);

ALTER TABLE public.employee_document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_document_templates_read" ON public.employee_document_templates;
CREATE POLICY "employee_document_templates_read"
  ON public.employee_document_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "employee_document_templates_write_hr" ON public.employee_document_templates;
CREATE POLICY "employee_document_templates_write_hr"
  ON public.employee_document_templates FOR ALL
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
  )
  WITH CHECK (
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

CREATE INDEX IF NOT EXISTS idx_emp_doc_templates_active
  ON public.employee_document_templates(active, sort_order);

-- Seed the standard real-business new-hire document set.
INSERT INTO public.employee_document_templates (
  document_key, document_name, category, description, required, applies_to_roles, applies_to_categories, sort_order
)
VALUES
  ('offer_letter', 'Offer Letter', 'onboarding',
   'Signed employment offer letter confirming role, pay, and start date.', true, NULL, ARRAY['onboarding'], 10),
  ('form_i9', 'Form I-9 (Employment Eligibility Verification)', 'legal',
   'Federal identity and work-authorization verification. Completed in first 3 days of employment.', true, NULL, ARRAY['legal'], 20),
  ('i9_identity_documents', 'I-9 Identity Documents', 'legal',
   'Upload acceptable identity + work-authorization documents (e.g., passport, DL + SSN card).', true, NULL, ARRAY['legal'], 30),
  ('form_w4', 'Form W-4 (Employee Withholding Certificate)', 'tax',
   'Federal income tax withholding election.', true, NULL, ARRAY['tax'], 40),
  ('state_withholding', 'State Withholding Form', 'tax',
   'State income tax withholding election, if applicable.', true, NULL, ARRAY['tax'], 50),
  ('state_new_hire_reporting', 'State New Hire Reporting', 'legal',
   'State new hire report required by state law within 20 days of hire.', true, NULL, ARRAY['legal'], 55),
  ('direct_deposit', 'Direct Deposit Authorization', 'payroll',
   'Banking details for Friday payroll via the proprietary payroll provider.', true, NULL, ARRAY['payroll'], 60),
  ('emergency_contact', 'Emergency Contact Form', 'hr',
   'Named contact in case of workplace emergency.', true, NULL, ARRAY['hr'], 70),
  ('handbook_acknowledgement', 'Employee Handbook Acknowledgement', 'policy',
   'Signed acknowledgement of the Mai Troll Employee Handbook and policies.', true, NULL, ARRAY['policy'], 80),
  ('code_of_conduct', 'Code of Conduct Agreement', 'policy',
   'Signed agreement to the employee code of conduct.', true, NULL, ARRAY['policy'], 90),
  ('confidentiality', 'Confidentiality & NDA', 'policy',
   'Agreement to protect proprietary and user data.', true, NULL, ARRAY['policy'], 100),
  ('acceptable_use', 'Acceptable Use Policy', 'policy',
   'Acknowledgement of acceptable use of company systems.', true, NULL, ARRAY['policy'], 110),
  ('harassment_policy', 'Anti-Harassment Policy Acknowledgement', 'policy',
   'Acknowledgement of the anti-harassment and workplace-respect policy.', true, NULL, ARRAY['policy'], 120),
  ('background_authorization', 'Background Check Authorization', 'legal',
   'Signed authorization for a background screening (where permitted by law).', false, NULL, ARRAY['legal'], 130),
  ('tc_enrollment', 'Mai Troll Enrollment & E-Verify Consent', 'legal',
   'Enrollment in company systems and E-Verify/work-authorization consent.', true, NULL, ARRAY['legal'], 140),
  ('role_training', 'Role-Specific Training Certification', 'training',
   'Completion certificate for role-specific training module.', true, NULL, ARRAY['training'], 150)
ON CONFLICT (document_key) DO NOTHING;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.employee_document_templates TO authenticated;
GRANT ALL ON TABLE public.employee_document_templates TO service_role;

COMMIT;
