-- Migration: Remove Mai School system
-- Date: 2026-10-05
-- Description: Drops all Mai School/Academy tables, functions, triggers, enums, and columns

-- Drop academy tables (dependents first)
DROP TABLE IF EXISTS public.academy_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.academy_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.academy_quizzes CASCADE;
DROP TABLE IF EXISTS public.academy_submissions CASCADE;
DROP TABLE IF EXISTS public.academy_assignments CASCADE;
DROP TABLE IF EXISTS public.academy_attendance CASCADE;
DROP TABLE IF EXISTS public.academy_sessions CASCADE;
DROP TABLE IF EXISTS public.academy_waitlists CASCADE;
DROP TABLE IF EXISTS public.academy_enrollments CASCADE;
DROP TABLE IF EXISTS public.academy_teacher_ratings CASCADE;
DROP TABLE IF EXISTS public.academy_classrooms CASCADE;
DROP TABLE IF EXISTS public.academy_learning_pathways CASCADE;
DROP TABLE IF EXISTS public.academy_courses CASCADE;
DROP TABLE IF EXISTS public.academy_teachers CASCADE;
DROP TABLE IF EXISTS public.academy_teacher_applications CASCADE;
DROP TABLE IF EXISTS public.academy_categories CASCADE;

-- Drop Mai Class system tables
DROP TABLE IF EXISTS public.mai_class_enrollments CASCADE;
DROP TABLE IF EXISTS public.mai_classes CASCADE;

-- Drop organization school linking tables
DROP TABLE IF EXISTS public.organization_students CASCADE;
DROP TABLE IF EXISTS public.organization_admins CASCADE;

-- Drop Mai Class functions and triggers
DROP TRIGGER IF EXISTS trg_enforce_mai_class_student_limit ON public.mai_class_enrollments;
DROP FUNCTION IF EXISTS public.enforce_mai_class_student_limit();
DROP FUNCTION IF EXISTS public.get_available_mai_class_slots(UUID, UUID);

-- Drop school-specific columns from user_profiles
ALTER TABLE public.user_profiles 
    DROP COLUMN IF EXISTS institution_verified,
    DROP COLUMN IF EXISTS institution_name,
    DROP COLUMN IF EXISTS institution_type,
    DROP COLUMN IF EXISTS institution_domain,
    DROP COLUMN IF EXISTS institution_verified_at,
    DROP COLUMN IF EXISTS institution_verification_status;

-- Drop school enums
DROP TYPE IF EXISTS verification_status CASCADE;
DROP TYPE IF EXISTS institution_type CASCADE;

-- Drop school tables
DROP TABLE IF EXISTS public.user_institution_verifications CASCADE;
DROP TABLE IF EXISTS public.institution_domains CASCADE;
DROP TABLE IF EXISTS public.institutions CASCADE;
