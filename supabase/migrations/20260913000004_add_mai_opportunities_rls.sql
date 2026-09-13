-- Migration: Mai Business — RLS Policies
-- Enables Row Level Security on every Mai Business table.
-- Normal users access only their own private data (auth.uid() = user_id).
-- Public/shared tables (courses, lessons, modules, resources, funding programs)
-- allow read access to authenticated users.

BEGIN;

-- =========================================================================
-- Enable RLS on all tables
-- =========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_business_profiles') THEN
    ALTER TABLE public.mai_business_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_business_applications') THEN
    ALTER TABLE public.mai_business_applications ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_business_businesses') THEN
    ALTER TABLE public.mai_business_businesses ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mai_business_courses') THEN
    ALTER TABLE public.mai_business_courses ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_course_modules') THEN
    ALTER TABLE public.mai_business_course_modules ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_lessons') THEN
    ALTER TABLE public.mai_business_lessons ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_progress') THEN
    ALTER TABLE public.mai_business_progress ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_assessments') THEN
    ALTER TABLE public.mai_business_assessments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_assessment_attempts') THEN
    ALTER TABLE public.mai_business_assessment_attempts ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_business_plans') THEN
    ALTER TABLE public.mai_business_business_plans ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_funding_programs') THEN
    ALTER TABLE public.mai_business_funding_programs ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_funding_applications') THEN
    ALTER TABLE public.mai_business_funding_applications ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_grant_allocations') THEN
    ALTER TABLE public.mai_business_grant_allocations ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_documents') THEN
    ALTER TABLE public.mai_business_documents ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_resources') THEN
    ALTER TABLE public.mai_business_resources ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_activity_log') THEN
    ALTER TABLE public.mai_business_activity_log ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'r' AND relname = 'mai_business_certificates') THEN
    ALTER TABLE public.mai_business_certificates ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =========================================================================
-- 1. mai_business_profiles
--    Users see only their own profile.
--    Admins can read all (for CEO dashboard).
-- =========================================================================
DROP POLICY IF EXISTS "users can view own mai profile" ON public.mai_business_profiles;
CREATE POLICY "users can view own mai profile"
  ON public.mai_business_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own mai profile" ON public.mai_business_profiles;
CREATE POLICY "users can create own mai profile"
  ON public.mai_business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own mai profile" ON public.mai_business_profiles;
CREATE POLICY "users can update own mai profile"
  ON public.mai_business_profiles FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can read all mai profiles" ON public.mai_business_profiles;
CREATE POLICY "admins can read all mai profiles"
  ON public.mai_business_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid()
              AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 2. mai_business_applications
--    Users view only their own applications.
--    Admins can review all.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own mai application" ON public.mai_business_applications;
CREATE POLICY "users can view own mai application"
  ON public.mai_business_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create mai application" ON public.mai_business_applications;
CREATE POLICY "users can create mai application"
  ON public.mai_business_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own draft mai application" ON public.mai_business_applications;
CREATE POLICY "users can update own draft mai application"
  ON public.mai_business_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "admins can review mai applications" ON public.mai_business_applications;
CREATE POLICY "admins can review mai applications"
  ON public.mai_business_applications FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid()
              AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid()
              AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 3. mai_business_businesses
--    Users access only their own business profile.
--    Admins can read all.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own business" ON public.mai_business_businesses;
CREATE POLICY "users can view own business"
  ON public.mai_business_businesses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can manage own business" ON public.mai_business_businesses;
CREATE POLICY "users can manage own business"
  ON public.mai_business_businesses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can read all businesses" ON public.mai_business_businesses;
CREATE POLICY "admins can read all businesses"
  ON public.mai_business_businesses FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 4-6. mai_business_courses, course_modules, lessons
--    Authenticated users can read. Only admins can write.
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read courses" ON public.mai_business_courses;
CREATE POLICY "authenticated read courses"
  ON public.mai_business_courses FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins manage courses" ON public.mai_business_courses;
CREATE POLICY "admins manage courses"
  ON public.mai_business_courses FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

DROP POLICY IF EXISTS "authenticated read modules" ON public.mai_business_course_modules;
CREATE POLICY "authenticated read modules"
  ON public.mai_business_course_modules FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins manage modules" ON public.mai_business_course_modules;
CREATE POLICY "admins manage modules"
  ON public.mai_business_course_modules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

DROP POLICY IF EXISTS "authenticated read lessons" ON public.mai_business_lessons;
CREATE POLICY "authenticated read lessons"
  ON public.mai_business_lessons FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins and instructors manage lessons" ON public.mai_business_lessons;
CREATE POLICY "admins and instructors manage lessons"
  ON public.mai_business_lessons FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- 7. mai_business_progress
--    Users access only their own progress.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own progress" ON public.mai_business_progress;
CREATE POLICY "users can view own progress"
  ON public.mai_business_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can manage own progress" ON public.mai_business_progress;
CREATE POLICY "users can manage own progress"
  ON public.mai_business_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can read all progress" ON public.mai_business_progress;
CREATE POLICY "admins can read all progress"
  ON public.mai_business_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 8. mai_business_assessments
--    Authenticated users read. Admins/instructors write.
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read assessments" ON public.mai_business_assessments;
CREATE POLICY "authenticated read assessments"
  ON public.mai_business_assessments FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins and instructors manage assessments" ON public.mai_business_assessments;
CREATE POLICY "admins and instructors manage assessments"
  ON public.mai_business_assessments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- 9. mai_business_assessment_attempts
--    Users access only their own attempts. Admins/instructors read all.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own attempts" ON public.mai_business_assessment_attempts;
CREATE POLICY "users can view own attempts"
  ON public.mai_business_assessment_attempts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own attempts" ON public.mai_business_assessment_attempts;
CREATE POLICY "users can create own attempts"
  ON public.mai_business_assessment_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins and instructors read all attempts" ON public.mai_business_assessment_attempts;
CREATE POLICY "admins and instructors read all attempts"
  ON public.mai_business_assessment_attempts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- 10. mai_business_business_plans
--    Users access only their own plans. Admins/instructors (assigned) can review.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own business plan" ON public.mai_business_business_plans;
CREATE POLICY "users can view own business plan"
  ON public.mai_business_business_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can manage own business plan draft" ON public.mai_business_business_plans;
CREATE POLICY "users can manage own business plan draft"
  ON public.mai_business_business_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can review all business plans" ON public.mai_business_business_plans;
CREATE POLICY "admins can review all business plans"
  ON public.mai_business_business_plans FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 11. mai_business_funding_programs
--    Authenticated users read. Admins write.
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read funding programs" ON public.mai_business_funding_programs;
CREATE POLICY "authenticated read funding programs"
  ON public.mai_business_funding_programs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins manage funding programs" ON public.mai_business_funding_programs;
CREATE POLICY "admins manage funding programs"
  ON public.mai_business_funding_programs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 12. mai_business_funding_applications
--    Users access only their own applications. Admins/instructors can review.
--    Status changes validated server-side via RPC (submit_funding_application).
-- =========================================================================
DROP POLICY IF EXISTS "users can view own funding application" ON public.mai_business_funding_applications;
CREATE POLICY "users can view own funding application"
  ON public.mai_business_funding_applications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can manage own draft funding application" ON public.mai_business_funding_applications;
CREATE POLICY "users can manage own draft funding application"
  ON public.mai_business_funding_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own draft funding application" ON public.mai_business_funding_applications;
CREATE POLICY "users can update own draft funding application"
  ON public.mai_business_funding_applications FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (auth.uid() = user_id AND status = 'draft');

DROP POLICY IF EXISTS "admins and instructors can review funding applications" ON public.mai_business_funding_applications;
CREATE POLICY "admins and instructors can review funding applications"
  ON public.mai_business_funding_applications FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- 13. mai_business_grant_allocations
--    Only admins can create/update allocations (via RPC). Users cannot.
-- =========================================================================
DROP POLICY IF EXISTS "admins manage grant allocations" ON public.mai_business_grant_allocations;
CREATE POLICY "admins manage grant allocations"
  ON public.mai_business_grant_allocations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 14. mai_business_documents
--    Users access only their own documents. Admins can read all.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own documents" ON public.mai_business_documents;
CREATE POLICY "users can view own documents"
  ON public.mai_business_documents FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own documents" ON public.mai_business_documents;
CREATE POLICY "users can create own documents"
  ON public.mai_business_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own documents" ON public.mai_business_documents;
CREATE POLICY "users can update own documents"
  ON public.mai_business_documents FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can read all documents" ON public.mai_business_documents;
CREATE POLICY "admins can read all documents"
  ON public.mai_business_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 15. mai_business_resources
--    Authenticated users read. Admins write.
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read resources" ON public.mai_business_resources;
CREATE POLICY "authenticated read resources"
  ON public.mai_business_resources FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins manage resources" ON public.mai_business_resources;
CREATE POLICY "admins manage resources"
  ON public.mai_business_resources FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 16. mai_business_activity_log
--    Only admins/CEOs can read (audit trail). Inserts are server-side only
--    via triggers/functions. No public insert policy.
-- =========================================================================
DROP POLICY IF EXISTS "admins can read activity log" ON public.mai_business_activity_log;
CREATE POLICY "admins can read activity log"
  ON public.mai_business_activity_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- 17. mai_business_certificates
--    Users access only their own certificates. Admins can read all.
-- =========================================================================
DROP POLICY IF EXISTS "users can view own certificates" ON public.mai_business_certificates;
CREATE POLICY "users can view own certificates"
  ON public.mai_business_certificates FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own certificate" ON public.mai_business_certificates;
CREATE POLICY "users can create own certificate"
  ON public.mai_business_certificates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins can read all certificates" ON public.mai_business_certificates;
CREATE POLICY "admins can read all certificates"
  ON public.mai_business_certificates FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

COMMIT;
