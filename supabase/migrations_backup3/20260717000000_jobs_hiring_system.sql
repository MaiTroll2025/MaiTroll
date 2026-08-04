BEGIN;

-- =========================================================================
-- Jobs / Employee Hiring System — schema extension
-- Extends job_applications with the full hiring vocabulary and adds the
-- interviews table used by Employees > Hiring > Interviews.
-- Reuses existing tables: career_positions, interview_sessions, user_profiles.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Extend job_applications — REAL employment application data
--    This is a real business hiring system, not a game. Fields mirror a
--    lawful U.S. employment application: identity, work authorization
--    (Form I-9), WOTC screening, EEO (voluntary), compensation,
--    availability, education, employment history, references, equipment
--    verification, acknowledgements, and an electronic signature.
--
--    SENSITIVE PII NOTE: full SSN / government IDs are NOT stored in
--    plaintext columns. They are captured by the application, encrypted
--    client-side / at the API boundary, and persisted in `pii_encrypted`
--    (jsonb). Only `ssn_last4` is retained in clear text for payroll
--    matching. Do not add a plaintext ssn column.
-- -------------------------------------------------------------------------
ALTER TABLE public.job_applications
  -- Position / routing
  ADD COLUMN IF NOT EXISTS position_id text,
  ADD COLUMN IF NOT EXISTS department text,
  -- Reviewer / lifecycle
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS timeline jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS interview_notes text,
  -- Contact information
  ADD COLUMN IF NOT EXISTS applicant_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS alternate_phone text,
  -- Personal information
  ADD COLUMN IF NOT EXISTS legal_first_name text,
  ADD COLUMN IF NOT EXISTS legal_last_name text,
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS ssn_last4 text,
  ADD COLUMN IF NOT EXISTS pii_encrypted jsonb,
  -- Address
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  -- Employment eligibility (Form I-9 basis)
  ADD COLUMN IF NOT EXISTS citizenship_status text,
  ADD COLUMN IF NOT EXISTS work_authorization_detail text,
  ADD COLUMN IF NOT EXISTS authorized_to_work boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS convicted_felony boolean,
  ADD COLUMN IF NOT EXISTS felony_explanation text,
  -- Work availability
  ADD COLUMN IF NOT EXISTS available_start_date date,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS desired_pay_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS availability jsonb,
  -- Experience & qualifications
  ADD COLUMN IF NOT EXISTS skills text[],
  ADD COLUMN IF NOT EXISTS education jsonb,
  ADD COLUMN IF NOT EXISTS employment_history jsonb,
  ADD COLUMN IF NOT EXISTS "references" jsonb,
  ADD COLUMN IF NOT EXISTS cover_letter text,
  ADD COLUMN IF NOT EXISTS resume_url text,
  -- Equipment verification (remote employees)
  ADD COLUMN IF NOT EXISTS equipment_verification jsonb,
  -- Role-specific custom questions
  ADD COLUMN IF NOT EXISTS custom_answers jsonb,
  -- WOTC (Work Opportunity Tax Credit) screening — IRS Form 8850 basis
  ADD COLUMN IF NOT EXISTS wotc jsonb,
  -- EEO (Equal Employment Opportunity) — voluntary, self-ID
  ADD COLUMN IF NOT EXISTS eeo jsonb,
  -- Acknowledgements / attestations
  ADD COLUMN IF NOT EXISTS acknowledgements jsonb,
  ADD COLUMN IF NOT EXISTS background_check_consent boolean DEFAULT false,
  -- Electronic signature
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signature_date timestamptz,
  ADD COLUMN IF NOT EXISTS agreed_to_terms boolean DEFAULT false;

-- FK: application -> career_positions (the open position applied for)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_applications_position_id_fkey'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES public.career_positions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK: application -> reviewer (user_profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_applications_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- JSONB sub-schema contracts (documentation for the application form).
-- The frontend MUST populate these shapes:
--
-- availability jsonb:
--   { "days": {"mon":true,...}, "earliest_start":"08:00",
--     "latest_end":"20:00", "hours_per_week":40, "shift_pref":"day" }
-- education jsonb (array of):
--   { "school":text, "degree":text, "field":text,
--     "start_year":int, "end_year":int|null, "completed":bool }
-- employment_history jsonb (array of):
--   { "employer":text, "title":text, "start_date":text,
--     "end_date":text|null, "responsibilities":text,
--     "reason_leaving":text, "phone":text, "supervisor":text,
--     "may_contact":bool }
-- references jsonb (array of):
--   { "name":text, "relationship":text, "title":text,
--     "company":text, "email":text, "phone":text, "years_known":int }
-- equipment_verification jsonb:
--   { "has_desktop":bool, "has_webcam":bool, "has_microphone":bool,
--     "has_speakers":bool, "has_reliable_internet":bool,
--     "internet_speed_mbps":int|null, "verified":bool }
-- custom_answers jsonb: { "<question_id>": <answer> }  (role-specific)
-- wotc jsonb (Work Opportunity Tax Credit — IRS Form 8850):
--   { "received_public_assistance":bool, "snap":bool, "tanf":bool,
--     "ssi":bool, "unemployed_18_39":bool, "summer_youth":bool,
--     "supplemental_nutrition":bool, "vocational_rehab":bool,
--     "ex_felony":bool, "ex_conviction":bool, "supplemental_security":
--     bool, "long_term_family_assistance":bool, "veteran":bool,
--     "disabled_veteran":bool, "guard_reserve":bool,
--     "food_stamp_recipient":bool, "qualified_vet":bool,
--     "unemployed_vet":bool, "authorized_signature":text,
--     "signature_date":text }
-- eeo jsonb (voluntary self-identification — EEOC):
--   { "gender":text, "race_ethnicity":text[], "veteran_status":text,
--     "disability":bool, "decline_to_self_identify":bool }
-- acknowledgements jsonb (array of accepted policy keys):
--   ["handbook","code_of_conduct","at_will","background_check",
--    "e_verify_consent","policy_acknowledgement"]
-- pii_encrypted jsonb (app-encrypted): { "ssn":<enc>, "dob":<enc>? }

CREATE INDEX IF NOT EXISTS idx_job_applications_pii_encrypted
  ON public.job_applications USING gin (pii_encrypted jsonb_path_ops);

-- Expand the status vocabulary to the full hiring lifecycle.
-- Old values: submitted, reviewed, approved, rejected
-- New values add: pending, reviewing, interview, interview_scheduled,
-- hired_pending_documents, onboarding, training, active, withdrawn
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (
    status = ANY (ARRAY[
      'submitted'::text,
      'pending'::text,
      'reviewing'::text,
      'reviewed'::text,
      'interview'::text,
      'interview_scheduled'::text,
      'approved'::text,
      'rejected'::text,
      'hired_pending_documents'::text,
      'onboarding'::text,
      'training'::text,
      'active'::text,
      'withdrawn'::text
    ])
  );

CREATE INDEX IF NOT EXISTS idx_job_applications_position_id
  ON public.job_applications(position_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_status
  ON public.job_applications(status);

-- -------------------------------------------------------------------------
-- 2. interviews table (Employees > Hiring > Interviews)
-- -------------------------------------------------------------------------
-- Create only if missing; otherwise we will ADD COLUMN IF NOT EXISTS below
-- so a pre-existing (stale) interviews table is safely upgraded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interviews'
  ) THEN
    CREATE TABLE public.interviews (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      job_application_id uuid,
      applicant_id uuid NOT NULL,
      position_id text,
      scheduled_date date NOT NULL,
      scheduled_time time without time zone NOT NULL,
      duration_minutes integer DEFAULT 30 NOT NULL,
      interviewer_id uuid,
      instructions text,
      internal_notes text,
      call_room_id uuid,
      status text DEFAULT 'scheduled'::text NOT NULL,
      created_by uuid,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT interviews_pkey PRIMARY KEY (id),
      CONSTRAINT interviews_status_check
        CHECK (status = ANY (ARRAY[
          'scheduled'::text, 'in_progress'::text, 'completed'::text,
          'cancelled'::text, 'no_show'::text
        ]))
    );
  END IF;
END $$;

-- Idempotently ensure every interviews column exists (handles stale tables).
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS job_application_id uuid,
  ADD COLUMN IF NOT EXISTS applicant_id uuid,
  ADD COLUMN IF NOT EXISTS position_id text,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time time without time zone,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS interviewer_id uuid,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS call_room_id uuid,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Add defaults / primary key / status check only if missing.
ALTER TABLE public.interviews ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.interviews ALTER COLUMN duration_minutes SET DEFAULT 30;
ALTER TABLE public.interviews ALTER COLUMN status SET DEFAULT 'scheduled'::text;
ALTER TABLE public.interviews ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.interviews ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_pkey') THEN
    ALTER TABLE public.interviews ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_status_check') THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_status_check
      CHECK (status = ANY (ARRAY[
        'scheduled'::text, 'in_progress'::text, 'completed'::text,
        'cancelled'::text, 'no_show'::text
      ]));
  END IF;
END $$;

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_job_application_id_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS job_application_id uuid;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_job_application_id_fkey
      FOREIGN KEY (job_application_id) REFERENCES public.job_applications(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_applicant_id_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS applicant_id uuid;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_applicant_id_fkey
      FOREIGN KEY (applicant_id) REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_position_id_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS position_id text;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES public.career_positions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_interviewer_id_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS interviewer_id uuid;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_interviewer_id_fkey
      FOREIGN KEY (interviewer_id) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_call_room_id_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS call_room_id uuid;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_call_room_id_fkey
      FOREIGN KEY (call_room_id) REFERENCES public.interview_sessions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interviews_created_by_fkey'
  ) THEN
    ALTER TABLE public.interviews
      ADD COLUMN IF NOT EXISTS created_by uuid;

    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interviews_applicant_id
  ON public.interviews(applicant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_position_id
  ON public.interviews(position_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled
  ON public.interviews(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_id
  ON public.interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status
  ON public.interviews(status);

-- -------------------------------------------------------------------------
-- 3. RLS — interviews
--    Applicants see their own. HR (admin / lead_troll_officer /
--    secretary / hr_admin / agency_hr_manager) see and manage all.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Interviews viewable by applicant or HR" ON public.interviews;
CREATE POLICY "Interviews viewable by applicant or HR"
  ON public.interviews FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'lead_troll_officer', 'secretary', 'hr_admin', 'agency_hr_manager')
          OR is_lead_officer = true
        )
    )
  );

DROP POLICY IF EXISTS "Interviews managed by HR" ON public.interviews;
CREATE POLICY "Interviews managed by HR"
  ON public.interviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'lead_troll_officer', 'secretary', 'hr_admin', 'agency_hr_manager')
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
          OR role IN ('admin', 'superadmin', 'lead_troll_officer', 'secretary', 'hr_admin', 'agency_hr_manager')
          OR is_lead_officer = true
        )
    )
  );

-- -------------------------------------------------------------------------
-- 4. Widen career_positions write RLS to include hr_admin / agency_hr_manager
--    (Careers used admin/secretary/lead_troll_officer only before).
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "career_positions_write_admin" ON public.career_positions;
CREATE POLICY "career_positions_write_admin"
  ON public.career_positions FOR ALL
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

-- -------------------------------------------------------------------------
-- 5. job_applications RLS: allow applicants full ownership of their row and
--    HR read/manage. Existing owner policies remain; add HR oversight.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Job applications managed by HR" ON public.job_applications;
CREATE POLICY "Job applications managed by HR"
  ON public.job_applications FOR UPDATE
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

DROP POLICY IF EXISTS "Job applications viewable by owner or HR" ON public.job_applications;
CREATE POLICY "Job applications viewable by owner or HR"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'superadmin', 'secretary', 'lead_troll_officer', 'hr_admin', 'agency_hr_manager')
          OR is_lead_officer = true
        )
    )
  );

-- -------------------------------------------------------------------------
-- 6. SSN visibility — real-business PII restriction
--    ssn_last4 must NOT be visible to secretary or lead_troll_officer.
--    Only CEO / admin may read it. Postgres RLS is row-level, so the
--    column stays SELECT-able by row-visible roles (owner / HR), but
--    the application MUST read ssn_last4 ONLY through the
--    SECURITY DEFINER RPC below — never by direct column select.
--    The RPC raises unless the caller is admin or role = 'ceo', so
--    secretary / lead_troll_officer cannot retrieve it even though
--    they can see the rest of the (already RLS-gated) row.
--    (Column-level REVOKE is intentionally avoided — Supabase's SQL
--    runner rejects `REVOKE ... ON COLUMN`; the RPC is the gate.)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_application_ssn_last4(p_application_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_is_admin boolean;
  v_is_ceo boolean;
  v_val text;
BEGIN
  SELECT role, COALESCE(is_admin, false)
    INTO v_caller_role, v_is_admin
    FROM public.user_profiles
    WHERE id = auth.uid();

  v_is_ceo := (v_caller_role = 'ceo');

  IF NOT (v_is_admin OR v_is_ceo) THEN
    RAISE EXCEPTION 'Only CEO or admin may view SSN digits.';
  END IF;

  SELECT ssn_last4 INTO v_val
    FROM public.job_applications
    WHERE id = p_application_id;

  RETURN v_val;
END;
$$;

REVOKE ALL ON FUNCTION public.get_application_ssn_last4(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_application_ssn_last4(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_application_ssn_last4(uuid) TO service_role;

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.interviews TO authenticated;
GRANT ALL ON TABLE public.interviews TO service_role;

COMMIT;
