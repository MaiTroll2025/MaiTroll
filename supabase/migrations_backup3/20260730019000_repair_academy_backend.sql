-- ============================================================================
-- Migration: repair_academy_backend
-- Ensures academy system tables have proper columns and relationships
-- Applied: 2026-07-30
-- ============================================================================

-- academy_teachers: ensure columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'academy_teachers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.academy_teachers ADD COLUMN user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'academy_teachers' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.academy_teachers ADD COLUMN display_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_academy_teachers_user_id ON public.academy_teachers(user_id);

-- academy_courses: ensure teacher_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_courses' AND constraint_name = 'academy_courses_teacher_id_fkey'
  ) THEN
    ALTER TABLE public.academy_courses
      ADD CONSTRAINT academy_courses_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.academy_teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- academy_enrollments: ensure student_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_enrollments' AND constraint_name = 'academy_enrollments_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_enrollments
      ADD CONSTRAINT academy_enrollments_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_grades: ensure proper FK and upsert capability
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_grades' AND constraint_name = 'academy_grades_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_grades
      ADD CONSTRAINT academy_grades_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_assignments: ensure course_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_assignments' AND constraint_name = 'academy_assignments_course_id_fkey'
  ) THEN
    ALTER TABLE public.academy_assignments
      ADD CONSTRAINT academy_assignments_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.academy_courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_questions and academy_quiz_attempts: ensure course_id FK
CREATE TABLE IF NOT EXISTS public.academy_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_questions_quiz_id ON public.academy_questions(quiz_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_questions' AND constraint_name = 'academy_questions_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.academy_questions
      ADD CONSTRAINT academy_questions_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.academy_quizzes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_submissions: ensure proper FKs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_submissions' AND constraint_name = 'academy_submissions_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_submissions
      ADD CONSTRAINT academy_submissions_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_submissions' AND constraint_name = 'academy_submissions_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.academy_submissions
      ADD CONSTRAINT academy_submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.academy_assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_certificates: ensure student_id FK (NOT user_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_certificates' AND constraint_name = 'academy_certificates_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_certificates
      ADD CONSTRAINT academy_certificates_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_attendance: ensure student_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_attendance' AND constraint_name = 'academy_attendance_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_attendance
      ADD CONSTRAINT academy_attendance_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_classrooms: ensure course_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_classrooms' AND constraint_name = 'academy_classrooms_course_id_fkey'
  ) THEN
    ALTER TABLE public.academy_classrooms
      ADD CONSTRAINT academy_classrooms_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.academy_courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_coin_rewards: ensure student_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_coin_rewards' AND constraint_name = 'academy_coin_rewards_student_id_fkey'
  ) THEN
    ALTER TABLE public.academy_coin_rewards
      ADD CONSTRAINT academy_coin_rewards_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_materials: ensure course_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_materials' AND constraint_name = 'academy_materials_course_id_fkey'
  ) THEN
    ALTER TABLE public.academy_materials
      ADD CONSTRAINT academy_materials_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.academy_courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- academy_announcements: ensure course_id FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'academy_announcements' AND constraint_name = 'academy_announcements_course_id_fkey'
  ) THEN
    ALTER TABLE public.academy_announcements
      ADD CONSTRAINT academy_announcements_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.academy_courses(id) ON DELETE CASCADE;
  END IF;
END $$;