-- Migration: Mai Business — Foundation tables
-- All tables use the `mai_business_` prefix.
-- Authentication reuses existing MaTROLL Supabase auth (auth.uid()).
-- Role scoping: `mai_business_profiles.program_role` tracks student/instructor.
-- Admin/CEO checks reference user_profiles columns (server-side only).

BEGIN;

-- =========================================================================
-- Helper: program role check enum-like constraint
-- =========================================================================
-- We store program_role as text with a CHECK constraint for safety.

-- =========================================================================
-- 1. mai_business_profiles
--    Tracks enrollment and program role (student / instructor) for every
--    authenticated MaTROLL user who participates in Mai Business.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    program_role    TEXT NOT NULL DEFAULT 'student'
                    CHECK (program_role IN ('student', 'instructor')),
    enrollment_date TIMESTAMPTZ,
    completion_date TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 2. mai_business_applications
--    Instructor and admin applications (signup flow).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type            TEXT NOT NULL DEFAULT 'instructor'
                    CHECK (type IN ('instructor', 'admin')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
    name            TEXT,
    email           TEXT,
    expertise       TEXT,
    bio             TEXT,
    credential_info JSONB,
    statement       TEXT,
    experience      TEXT,
    reviewed_by     UUID REFERENCES public.user_profiles(id),
    reviewed_at     TIMESTAMPTZ,
    decision_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 3. mai_business_businesses
--    User business profile / idea.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_businesses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    business_name       TEXT,
    business_idea       TEXT,
    business_stage      TEXT
                        CHECK (business_stage IN ('exploring', 'preparing', 'starting', 'existing')),
    industry            TEXT,
    monthly_budget      NUMERIC(12,2) DEFAULT 0,
    funding_requested   NUMERIC(12,2) DEFAULT 0,
    founder_name        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 4. mai_business_courses
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    duration_weeks  INTEGER NOT NULL DEFAULT 8,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    final_exam_id   UUID,
    passing_score   NUMERIC(5,2) DEFAULT 60.00,
    max_attempts    INTEGER DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 5. mai_business_course_modules
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_course_modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES public.mai_business_courses(id) ON DELETE CASCADE,
    week_number     INTEGER NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    order_index     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(course_id, week_number),
    UNIQUE(course_id, order_index)
);

-- =========================================================================
-- 6. mai_business_lessons
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES public.mai_business_course_modules(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         JSONB,
    objectives      TEXT[],
    examples        TEXT[],
    key_terms       TEXT[],
    order_index     INTEGER NOT NULL DEFAULT 0,
    is_knowledge_check BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(module_id, order_index)
);

-- =========================================================================
-- 7. mai_business_progress
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    course_id       UUID NOT NULL REFERENCES public.mai_business_courses(id) ON DELETE CASCADE,
    module_id       UUID REFERENCES public.mai_business_course_modules(id) ON DELETE SET NULL,
    lesson_id       UUID REFERENCES public.mai_business_lessons(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'locked'
                    CHECK (status IN ('available', 'in_progress', 'completed', 'locked')),
    progress_percent NUMERIC(5,2) DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id, lesson_id)
);

-- =========================================================================
-- 8. mai_business_assessments
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES public.mai_business_course_modules(id) ON DELETE CASCADE,
    is_final_exam   BOOLEAN NOT NULL DEFAULT false,
    title           TEXT NOT NULL,
    questions       JSONB,
    passing_score   NUMERIC(5,2) DEFAULT 60.00,
    max_attempts    INTEGER DEFAULT 3,
    time_limit_min  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 9. mai_business_assessment_attempts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_assessment_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    assessment_id   UUID NOT NULL REFERENCES public.mai_business_assessments(id) ON DELETE CASCADE,
    score           NUMERIC(5,2),
    passed          BOOLEAN NOT NULL DEFAULT false,
    attempt_number  INTEGER NOT NULL,
    answers         JSONB,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, assessment_id, attempt_number)
);

-- =========================================================================
-- 10. mai_business_business_plans
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_business_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'in_progress', 'submitted', 'reviewed', 'approved')),
    submitted_at    TIMESTAMPTZ,
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES public.user_profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 11. mai_business_funding_programs
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_funding_programs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    organization    TEXT NOT NULL,
    funding_type    TEXT NOT NULL
                    CHECK (funding_type IN ('grant', 'government', 'nonprofit', 'private_grant', 'local', 'competition', 'educational', 'other')),
    award_min       NUMERIC(12,2),
    award_max       NUMERIC(12,2),
    eligibility     TEXT,
    geography       TEXT,
    industry_restrictions TEXT,
    requirements    TEXT,
    deadline        DATE,
    official_source TEXT,
    application_url TEXT,
    last_verified_date DATE,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'expired')),
    total_available NUMERIC(12,2),
    total_allocated NUMERIC(12,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 12. mai_business_funding_applications
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_funding_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    program_id      UUID NOT NULL REFERENCES public.mai_business_funding_programs(id),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_information', 'approved', 'denied', 'withdrawn', 'completed')),
    requested_amount NUMERIC(12,2),
    submitted_at    TIMESTAMPTZ,
    decision_at     TIMESTAMPTZ,
    reviewer_id     UUID REFERENCES public.user_profiles(id),
    decision_notes  TEXT,
    supporting_data JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, program_id)
);

-- =========================================================================
-- 13. mai_business_grant_allocations
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_grant_allocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL UNIQUE REFERENCES public.mai_business_funding_applications(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'allocated', 'disbursed', 'cancelled')),
    reviewer_id     UUID NOT NULL REFERENCES public.user_profiles(id),
    allocated_at    TIMESTAMPTZ,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 14. mai_business_documents
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type            TEXT NOT NULL
                    CHECK (type IN ('business_plan', 'funding_application', 'supporting_document', 'formation_document', 'funding_decision', 'certificate', 'completion_document', 'correspondence')),
    title           TEXT NOT NULL,
    file_path       TEXT,
    file_name       TEXT,
    file_size       BIGINT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'deleted')),
    version         INTEGER NOT NULL DEFAULT 1,
    related_id      UUID,
    related_type    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 15. mai_business_resources
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,
    official_source TEXT,
    url             TEXT,
    geography       TEXT,
    last_verified_date DATE,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'expired')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 16. mai_business_activity_log
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    actor_id        UUID NOT NULL REFERENCES public.user_profiles(id),
    action          TEXT NOT NULL,
    category        TEXT NOT NULL,
    target_type     TEXT,
    target_id       UUID,
    previous_value  JSONB,
    new_value       JSONB,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- 17. mai_business_certificates
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_certificates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    course_id           UUID NOT NULL REFERENCES public.mai_business_courses(id),
    identifier          TEXT NOT NULL UNIQUE,
    type                TEXT NOT NULL
                        CHECK (type IN ('course_completion', 'final_exam', 'program_completion')),
    title               TEXT NOT NULL,
    issue_date            TIMESTAMPTZ,
    expiry_date           TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'expired')),
    pdf_path            TEXT,
    final_exam_score    NUMERIC(5,2),
    final_exam_passed   BOOLEAN DEFAULT false,
    course_completion_date TIMESTAMPTZ,
    eligibility         JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id, type)
);

-- =========================================================================
-- Updated trigger (inline, no external dependency)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mai_business_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_mai_business_profiles_updated
    BEFORE UPDATE ON public.mai_business_profiles
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_businesses_updated
    BEFORE UPDATE ON public.mai_business_businesses
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_courses_updated
    BEFORE UPDATE ON public.mai_business_courses
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_modules_updated
    BEFORE UPDATE ON public.mai_business_course_modules
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_lessons_updated
    BEFORE UPDATE ON public.mai_business_lessons
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_progress_updated
    BEFORE UPDATE ON public.mai_business_progress
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_assessments_updated
    BEFORE UPDATE ON public.mai_business_assessments
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_business_plans_updated
    BEFORE UPDATE ON public.mai_business_business_plans
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_funding_programs_updated
    BEFORE UPDATE ON public.mai_business_funding_programs
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_funding_apps_updated
    BEFORE UPDATE ON public.mai_business_funding_applications
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_grant_allocations_updated
    BEFORE UPDATE ON public.mai_business_grant_allocations
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_documents_updated
    BEFORE UPDATE ON public.mai_business_documents
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_resources_updated
    BEFORE UPDATE ON public.mai_business_resources
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_certificates_updated
    BEFORE UPDATE ON public.mai_business_certificates
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

COMMIT;
