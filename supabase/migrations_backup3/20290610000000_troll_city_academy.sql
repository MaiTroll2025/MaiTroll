-- ============================================================
-- Mai Troll ACADEMY - COMPLETE DATABASE SCHEMA
-- ============================================================
-- Creates all 22+ Academy tables with RLS, indexes, and triggers
-- All tables reference user_profiles.id via auth.users(id)
-- ============================================================

-- ============================================================
-- 1. ACADEMY CATEGORIES (lookup table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  color text DEFAULT '#a855f7',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_categories IS 'Course categories for Mai Troll Academy (Trades, Healthcare, Business, Technology, Life Skills, Refreshers)';

-- Seed default categories
INSERT INTO public.academy_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Trades', 'trades', 'Skilled trade programs including welding, plumbing, electrical, HVAC, carpentry, and automotive', '🔧', '#f97316', 1),
  ('Healthcare', 'healthcare', 'Healthcare certification prep including nursing, CNA, CPR, and medical basics', '🏥', '#ef4444', 2),
  ('Business', 'business', 'Business education including entrepreneurship, marketing, finance, and real estate', '📈', '#3b82f6', 3),
  ('Technology', 'technology', 'Technology courses including computer basics, programming, cybersecurity, and AI', '💻', '#8b5cf6', 4),
  ('Life Skills', 'life_skills', 'Essential life skills including credit scores, budgeting, home ownership, insurance, and taxes', '🏠', '#22c55e', 5),
  ('Refreshers', 'refreshers', 'Academic refresher courses in reading, writing, math, and science', '📚', '#eab308', 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. ACADEMY TEACHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  teacher_id text NOT NULL UNIQUE,
  bio text,
  specialties text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES public.user_profiles(id),
  approved_at timestamptz,
  total_students integer DEFAULT 0,
  total_graduates integer DEFAULT 0,
  total_certificates_issued integer DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0.00,
  total_ratings integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_teachers IS 'Teacher profiles for Mai Troll Academy';

CREATE INDEX IF NOT EXISTS idx_academy_teachers_user_id ON public.academy_teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_teacher_id ON public.academy_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_is_approved ON public.academy_teachers(is_approved);

-- ============================================================
-- 3. ACADEMY TEACHER APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teacher_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  qualifications text,
  experience text,
  teaching_subjects text[] DEFAULT '{}',
  motivation text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'suspended')),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_teacher_applications IS 'Teacher applications for Mai Troll Academy';

CREATE INDEX IF NOT EXISTS idx_academy_teacher_apps_user_id ON public.academy_teacher_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_apps_status ON public.academy_teacher_applications(status);

-- ============================================================
-- 4. ACADEMY COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.academy_categories(id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  thumbnail_url text,
  difficulty_level text DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  max_students integer DEFAULT 20,
  enrollment_fee integer DEFAULT 1000,
  currency_type text DEFAULT 'troll_coins' CHECK (currency_type IN ('troll_coins', 'free')),
  registration_open_date timestamptz,
  registration_close_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  meeting_days text[] DEFAULT '{}',
  meeting_time text,
  timezone text DEFAULT 'America/New_York',
  enrollment_type text DEFAULT 'open' CHECK (enrollment_type IN ('open', 'approval_required')),
  minimum_attendance_pct integer DEFAULT 80,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived', 'cancelled')),
  total_sessions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_courses IS 'Courses offered by Mai Troll Academy';

CREATE INDEX IF NOT EXISTS idx_academy_courses_teacher_id ON public.academy_courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_category_id ON public.academy_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_status ON public.academy_courses(status);
CREATE INDEX IF NOT EXISTS idx_academy_courses_slug ON public.academy_courses(slug);

-- ============================================================
-- 5. ACADEMY CLASSROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  livekit_room_name text UNIQUE,
  max_capacity integer DEFAULT 20,
  is_locked boolean DEFAULT false,
  is_active boolean DEFAULT true,
  current_session_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_classrooms IS 'Virtual classrooms for Academy courses';

CREATE INDEX IF NOT EXISTS idx_academy_classrooms_course_id ON public.academy_classrooms(course_id);

-- ============================================================
-- 6. ACADEMY LEARNING PATHWAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_learning_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.academy_categories(id),
  badge_name text,
  badge_icon text,
  badge_color text,
  courses uuid[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_learning_pathways IS 'Learning pathways that group courses into career tracks';

-- ============================================================
-- 7. ACADEMY TEACHER RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teacher_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, student_id, course_id)
);

COMMENT ON TABLE public.academy_teacher_ratings IS 'Student ratings for Academy teachers';

CREATE INDEX IF NOT EXISTS idx_academy_teacher_ratings_teacher_id ON public.academy_teacher_ratings(teacher_id);

-- ============================================================
-- 8. ACADEMY ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES public.academy_classrooms(id),
  student_id_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'waitlisted', 'denied', 'withdropped', 'completed', 'failed')),
  enrollment_date timestamptz DEFAULT now(),
  completion_date timestamptz,
  final_grade text,
  final_percentage numeric(5,2),
  certificate_issued boolean DEFAULT false,
  certificate_id uuid,
  coins_paid integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

COMMENT ON TABLE public.academy_enrollments IS 'Student enrollments in Academy courses';

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_student_id ON public.academy_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course_id ON public.academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_status ON public.academy_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_student_number ON public.academy_enrollments(student_id_number);

-- ============================================================
-- 9. ACADEMY WAITLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  waitlist_position integer NOT NULL,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'expired', 'withdrawn')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

COMMENT ON TABLE public.academy_waitlists IS 'Waitlist for full Academy courses';

CREATE INDEX IF NOT EXISTS idx_academy_waitlists_course_id ON public.academy_waitlists(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_waitlists_student_id ON public.academy_waitlists(student_id);

-- ============================================================
-- 10. ACADEMY SESSIONS (class meetings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES public.academy_classrooms(id),
  title text NOT NULL,
  description text,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  livekit_room_name text,
  recording_url text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_sessions IS 'Individual class sessions within a course';

CREATE INDEX IF NOT EXISTS idx_academy_sessions_course_id ON public.academy_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_sessions_date ON public.academy_sessions(session_date);

-- ============================================================
-- 11. ACADEMY ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  check_in_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

COMMENT ON TABLE public.academy_attendance IS 'Student attendance records for class sessions';

CREATE INDEX IF NOT EXISTS idx_academy_attendance_session_id ON public.academy_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_academy_attendance_student_id ON public.academy_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_attendance_course_id ON public.academy_attendance(course_id);

-- ============================================================
-- 12. ACADEMY ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignment_type text NOT NULL DEFAULT 'homework' CHECK (assignment_type IN ('homework', 'project', 'essay', 'practical', 'presentation')),
  max_points integer DEFAULT 100,
  due_date timestamptz,
  allowed_submissions text[] DEFAULT '{text,pdf,image}',
  is_published boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_assignments IS 'Assignments created by teachers for courses';

CREATE INDEX IF NOT EXISTS idx_academy_assignments_course_id ON public.academy_assignments(course_id);

-- ============================================================
-- 13. ACADEMY SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.academy_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content text,
  file_urls text[] DEFAULT '{}',
  submission_type text DEFAULT 'text' CHECK (submission_type IN ('text', 'pdf', 'image', 'link')),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned', 'late')),
  score numeric(5,2),
  max_points integer DEFAULT 100,
  feedback text,
  graded_by uuid REFERENCES public.user_profiles(id),
  graded_at timestamptz,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_submissions IS 'Student submissions for assignments';

CREATE INDEX IF NOT EXISTS idx_academy_submissions_assignment_id ON public.academy_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_academy_submissions_student_id ON public.academy_submissions(student_id);

-- ============================================================
-- 14. ACADEMY QUIZZES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quiz_type text DEFAULT 'quiz' CHECK (quiz_type IN ('quiz', 'exam', 'practice', 'assessment')),
  time_limit_minutes integer,
  max_attempts integer DEFAULT 1,
  passing_score integer DEFAULT 70,
  total_points integer DEFAULT 100,
  shuffle_questions boolean DEFAULT false,
  show_results boolean DEFAULT true,
  is_published boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_quizzes IS 'Quizzes and exams for Academy courses';

CREATE INDEX IF NOT EXISTS idx_academy_quizzes_course_id ON public.academy_quizzes(course_id);

-- ============================================================
-- 15. ACADEMY QUIZ QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'matching', 'essay', 'practical')),
  options jsonb DEFAULT '[]',
  correct_answer text,
  correct_answers text[] DEFAULT '{}',
  points integer DEFAULT 1,
  explanation text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_quiz_questions IS 'Individual questions within a quiz';

CREATE INDEX IF NOT EXISTS idx_academy_quiz_questions_quiz_id ON public.academy_quiz_questions(quiz_id);

-- ============================================================
-- 16. ACADEMY QUIZ ATTEMPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  answers jsonb DEFAULT '{}',
  score numeric(5,2),
  percentage numeric(5,2),
  passed boolean DEFAULT false,
  time_taken_seconds integer,
  attempt_number integer DEFAULT 1,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_quiz_attempts IS 'Student quiz/exam attempts with scores';

CREATE INDEX IF NOT EXISTS idx_academy_quiz_attempts_quiz_id ON public.academy_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_academy_quiz_attempts_student_id ON public.academy_quiz_attempts(student_id);

-- ============================================================
-- 17. ACADEMY GRADES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.academy_assignments(id) ON DELETE SET NULL,
  quiz_id uuid REFERENCES public.academy_quizzes(id) ON DELETE SET NULL,
  grade_type text NOT NULL CHECK (grade_type IN ('assignment', 'quiz', 'exam', 'attendance', 'final', 'participation')),
  score numeric(5,2),
  max_points numeric(5,2) DEFAULT 100,
  percentage numeric(5,2),
  letter_grade text CHECK (letter_grade IN ('A', 'B', 'C', 'D', 'F')),
  weight numeric(5,2) DEFAULT 1.00,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_grades IS 'Grade records for students across all graded items';

CREATE INDEX IF NOT EXISTS idx_academy_grades_student_id ON public.academy_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_grades_course_id ON public.academy_grades(course_id);

-- ============================================================
-- 18. ACADEMY CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  verification_id text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.academy_teachers(id),
  enrollment_id uuid REFERENCES public.academy_enrollments(id),
  final_grade text,
  final_percentage numeric(5,2),
  status text DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.user_profiles(id),
  revoke_reason text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_certificates IS 'Certificates issued to students upon course completion';

CREATE INDEX IF NOT EXISTS idx_academy_certificates_student_id ON public.academy_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_course_id ON public.academy_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_number ON public.academy_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_verification ON public.academy_certificates(verification_id);

-- ============================================================
-- 19. ACADEMY MATERIALS (resources/OER)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id),
  title text NOT NULL,
  description text,
  material_type text NOT NULL CHECK (material_type IN ('pdf', 'presentation', 'worksheet', 'study_guide', 'link', 'video', 'oer')),
  file_url text,
  external_url text,
  source text,
  is_oer boolean DEFAULT false,
  is_published boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_materials IS 'Course materials and open educational resources';

CREATE INDEX IF NOT EXISTS idx_academy_materials_course_id ON public.academy_materials(course_id);

-- ============================================================
-- 20. ACADEMY ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id),
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_announcements IS 'Announcements posted by teachers for their courses';

CREATE INDEX IF NOT EXISTS idx_academy_announcements_course_id ON public.academy_announcements(course_id);

-- ============================================================
-- 21. ACADEMY NOTES (student notes during class)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_notes IS 'Student notes taken during class sessions';

CREATE INDEX IF NOT EXISTS idx_academy_notes_student_id ON public.academy_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_notes_course_id ON public.academy_notes(course_id);

-- ============================================================
-- 22. ACADEMY COIN REWARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_coin_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.academy_courses(id),
  reward_type text NOT NULL CHECK (reward_type IN ('quiz_passed', 'exam_passed', 'perfect_score', 'course_completed', 'certificate_earned', 'daily_streak', 'attendance_milestone', 'assignment_submitted')),
  reward_reason text NOT NULL,
  coins_awarded integer NOT NULL,
  reference_id uuid,
  reference_type text,
  is_duplicate_check boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_coin_rewards IS 'Troll Coin rewards earned through Academy activities';

CREATE INDEX IF NOT EXISTS idx_academy_coin_rewards_student_id ON public.academy_coin_rewards(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_coin_rewards_course_id ON public.academy_coin_rewards(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_coin_rewards_type ON public.academy_coin_rewards(reward_type);

-- ============================================================
-- 23. ACADEMY STUDENT BANS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_student_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.user_profiles(id),
  reason text NOT NULL,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_student_bans IS 'Student bans from specific Academy courses';

CREATE INDEX IF NOT EXISTS idx_academy_student_bans_student_id ON public.academy_student_bans(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_student_bans_course_id ON public.academy_student_bans(course_id);

-- ============================================================
-- 24. ACADEMY STUDENT ID NUMBERS (generated on first enrollment)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_student_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_id_number text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_student_ids IS 'Unique Academy student ID numbers (TCA-YYYY-XXXXXX)';

CREATE INDEX IF NOT EXISTS idx_academy_student_ids_number ON public.academy_student_ids(student_id_number);

-- ============================================================
-- 25. ACADEMY ADMISSIONS APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_admissions_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  first_choice_course_id uuid REFERENCES public.academy_courses(id),
  second_choice_course_id uuid REFERENCES public.academy_courses(id),
  third_choice_course_id uuid REFERENCES public.academy_courses(id),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'accepted', 'waitlisted', 'denied', 'withdrawn')),
  assigned_course_id uuid REFERENCES public.academy_courses(id),
  assigned_classroom_id uuid REFERENCES public.academy_classrooms(id),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  acceptance_letter_sent boolean DEFAULT false,
  denial_letter_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_admissions_applications IS 'Student applications processed by the Admissions department';

CREATE INDEX IF NOT EXISTS idx_academy_admissions_student_id ON public.academy_admissions_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_admissions_status ON public.academy_admissions_applications(status);

-- ============================================================
-- 26. ACADEMY ADMISSIONS AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_admissions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES public.user_profiles(id),
  action text NOT NULL,
  student_id uuid REFERENCES public.user_profiles(id),
  course_id uuid REFERENCES public.academy_courses(id),
  details text,
  reason text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_admissions_log IS 'Audit log for all Admissions department actions';

CREATE INDEX IF NOT EXISTS idx_academy_admissions_log_officer ON public.academy_admissions_log(officer_id);
CREATE INDEX IF NOT EXISTS idx_academy_admissions_log_student ON public.academy_admissions_log(student_id);

-- ============================================================
-- 27. ACADEMY BOARD ACTIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_board_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  target_name text,
  reason text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_board_actions_log IS 'Permanent audit log for all Board of Education actions';

CREATE INDEX IF NOT EXISTS idx_academy_board_log_admin ON public.academy_board_actions_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_academy_board_log_action ON public.academy_board_actions_log(action);

-- ============================================================
-- 28. ACADEMY TEACHER REFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teacher_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  reference_type text NOT NULL CHECK (reference_type IN ('recommendation', 'employment_reference', 'skill_endorsement')),
  category text CHECK (category IN ('attendance', 'participation', 'professionalism', 'technical_skill', 'leadership', 'communication')),
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_teacher_references IS 'Teacher references and recommendations for students';

CREATE INDEX IF NOT EXISTS idx_academy_teacher_refs_teacher ON public.academy_teacher_references(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_refs_student ON public.academy_teacher_references(student_id);

-- ============================================================
-- 29. ACADEMY GRADUATE BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_graduate_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL CHECK (badge_type IN ('academy_graduate', 'verified_certificate', 'automotive_graduate', 'credit_specialist', 'healthcare_graduate', 'business_graduate', 'technology_graduate', 'pathway_complete')),
  badge_name text NOT NULL,
  badge_icon text,
  badge_color text,
  course_id uuid REFERENCES public.academy_courses(id),
  pathway_id uuid REFERENCES public.academy_learning_pathways(id),
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.academy_graduate_badges IS 'Verified graduate badges earned by Academy students';

CREATE INDEX IF NOT EXISTS idx_academy_badges_student ON public.academy_graduate_badges(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_badges_type ON public.academy_graduate_badges(badge_type);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to generate teacher ID
CREATE OR REPLACE FUNCTION public.generate_teacher_id()
RETURNS text AS $$
DECLARE
  new_id text;
  year_part text;
  sequence_num integer;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO sequence_num FROM public.academy_teachers;
  
  new_id := 'TCH-' || year_part || '-' || LPAD(sequence_num::text, 6, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate student ID number
CREATE OR REPLACE FUNCTION public.generate_academy_student_id()
RETURNS text AS $$
DECLARE
  new_id text;
  year_part text;
  sequence_num integer;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO sequence_num FROM public.academy_student_ids;
  
  new_id := 'TCA-' || year_part || '-' || LPAD(sequence_num::text, 6, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS text AS $$
DECLARE
  new_id text;
  year_part text;
  sequence_num integer;
BEGIN
  year_part := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO sequence_num FROM public.academy_certificates;
  
  new_id := 'CERT-' || year_part || '-' || LPAD(sequence_num::text, 6, '0');
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate verification ID
CREATE OR REPLACE FUNCTION public.generate_verification_id()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := 'V-';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate student ID on first enrollment
CREATE OR REPLACE FUNCTION public.ensure_academy_student_id()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.academy_student_ids WHERE student_id = NEW.student_id) THEN
    INSERT INTO public.academy_student_ids (student_id, student_id_number)
    VALUES (NEW.student_id, public.generate_academy_student_id());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure student ID exists
DROP TRIGGER IF EXISTS trg_ensure_academy_student_id ON public.academy_enrollments;
CREATE TRIGGER trg_ensure_academy_student_id
  AFTER INSERT ON public.academy_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_academy_student_id();

-- Function to update teacher rating average
CREATE OR REPLACE FUNCTION public.update_teacher_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.academy_teachers
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.academy_teacher_ratings
      WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM public.academy_teacher_ratings
      WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.teacher_id, OLD.teacher_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_teacher_rating ON public.academy_teacher_ratings;
CREATE TRIGGER trg_update_teacher_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.academy_teacher_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_teacher_rating();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_academy_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all academy tables (explicit for each table)
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_categories;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_categories FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teachers;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teachers FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_applications;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_applications FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_courses;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_courses FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_classrooms;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_classrooms FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_learning_pathways;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_learning_pathways FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_ratings;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_ratings FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_enrollments;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_waitlists;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_waitlists FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_sessions;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_sessions FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_attendance;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_attendance FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_assignments;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_assignments FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_submissions;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_submissions FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_quizzes;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_quiz_questions;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_quiz_questions FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_quiz_attempts;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_grades;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_grades FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_certificates;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_certificates FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_materials;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_materials FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_announcements;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_announcements FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_notes;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_notes FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_coin_rewards;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_coin_rewards FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_student_bans;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_student_bans FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_student_ids;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_student_ids FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_admissions_applications;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_admissions_applications FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_admissions_log;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_admissions_log FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_board_actions_log;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_board_actions_log FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_references;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_references FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_graduate_badges;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_graduate_badges FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all academy tables (explicit for each table)
ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teacher_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_learning_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teacher_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_coin_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_student_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_student_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_admissions_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_admissions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_board_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teacher_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_graduate_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for academy_categories (public read)
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.academy_categories;
CREATE POLICY "Categories are viewable by everyone" ON public.academy_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage categories" ON public.academy_categories;
CREATE POLICY "Only admins can manage categories" ON public.academy_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_teachers
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON public.academy_teachers;
CREATE POLICY "Teachers are viewable by everyone" ON public.academy_teachers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can update own profile" ON public.academy_teachers;
CREATE POLICY "Teachers can update own profile" ON public.academy_teachers FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage teachers" ON public.academy_teachers;
CREATE POLICY "Admins can manage teachers" ON public.academy_teachers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_teacher_applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.academy_teacher_applications;
CREATE POLICY "Users can view own applications" ON public.academy_teacher_applications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create applications" ON public.academy_teacher_applications;
CREATE POLICY "Users can create applications" ON public.academy_teacher_applications FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage applications" ON public.academy_teacher_applications;
CREATE POLICY "Admins can manage applications" ON public.academy_teacher_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_courses
DROP POLICY IF EXISTS "Published courses are viewable by everyone" ON public.academy_courses;
CREATE POLICY "Published courses are viewable by everyone" ON public.academy_courses FOR SELECT USING (
  status = 'published' OR 
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_courses.teacher_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own courses" ON public.academy_courses;
CREATE POLICY "Teachers can manage own courses" ON public.academy_courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_courses.teacher_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all courses" ON public.academy_courses;
CREATE POLICY "Admins can manage all courses" ON public.academy_courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_classrooms
DROP POLICY IF EXISTS "Classrooms viewable by enrolled students and teachers" ON public.academy_classrooms;
CREATE POLICY "Classrooms viewable by enrolled students and teachers" ON public.academy_classrooms FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_enrollments e
    JOIN public.academy_courses c ON e.course_id = c.id
    WHERE e.classroom_id = academy_classrooms.id AND e.student_id = auth.uid() AND e.status = 'accepted'
  ) OR
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_classrooms.course_id AND t.user_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own classrooms" ON public.academy_classrooms;
CREATE POLICY "Teachers can manage own classrooms" ON public.academy_classrooms FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_classrooms.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all classrooms" ON public.academy_classrooms;
CREATE POLICY "Admins can manage all classrooms" ON public.academy_classrooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_enrollments
DROP POLICY IF EXISTS "Students can view own enrollments" ON public.academy_enrollments;
CREATE POLICY "Students can view own enrollments" ON public.academy_enrollments FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create enrollments" ON public.academy_enrollments;
CREATE POLICY "Students can create enrollments" ON public.academy_enrollments FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view course enrollments" ON public.academy_enrollments;
CREATE POLICY "Teachers can view course enrollments" ON public.academy_enrollments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_enrollments.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can update course enrollments" ON public.academy_enrollments;
CREATE POLICY "Teachers can update course enrollments" ON public.academy_enrollments FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_enrollments.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all enrollments" ON public.academy_enrollments;
CREATE POLICY "Admins can manage all enrollments" ON public.academy_enrollments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_waitlists
DROP POLICY IF EXISTS "Students can view own waitlist entries" ON public.academy_waitlists;
CREATE POLICY "Students can view own waitlist entries" ON public.academy_waitlists FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage waitlists" ON public.academy_waitlists;
CREATE POLICY "Admins can manage waitlists" ON public.academy_waitlists FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_sessions
DROP POLICY IF EXISTS "Sessions viewable by course members" ON public.academy_sessions;
CREATE POLICY "Sessions viewable by course members" ON public.academy_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_enrollments e
    WHERE e.course_id = academy_sessions.course_id AND e.student_id = auth.uid() AND e.status = 'accepted'
  ) OR
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_sessions.course_id AND t.user_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own sessions" ON public.academy_sessions;
CREATE POLICY "Teachers can manage own sessions" ON public.academy_sessions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_sessions.course_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_attendance
DROP POLICY IF EXISTS "Students can view own attendance" ON public.academy_attendance;
CREATE POLICY "Students can view own attendance" ON public.academy_attendance FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can manage attendance" ON public.academy_attendance;
CREATE POLICY "Teachers can manage attendance" ON public.academy_attendance FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_attendance.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.academy_attendance;
CREATE POLICY "Admins can view all attendance" ON public.academy_attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_assignments
DROP POLICY IF EXISTS "Assignments viewable by course members" ON public.academy_assignments;
CREATE POLICY "Assignments viewable by course members" ON public.academy_assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_enrollments e
    WHERE e.course_id = academy_assignments.course_id AND e.student_id = auth.uid() AND e.status = 'accepted'
  ) OR
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_assignments.course_id AND t.user_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own assignments" ON public.academy_assignments;
CREATE POLICY "Teachers can manage own assignments" ON public.academy_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_assignments.course_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_submissions
DROP POLICY IF EXISTS "Students can view own submissions" ON public.academy_submissions;
CREATE POLICY "Students can view own submissions" ON public.academy_submissions FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create submissions" ON public.academy_submissions;
CREATE POLICY "Students can create submissions" ON public.academy_submissions FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view and grade submissions" ON public.academy_submissions;
CREATE POLICY "Teachers can view and grade submissions" ON public.academy_submissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_assignments a
    JOIN public.academy_courses c ON a.course_id = c.id
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE a.id = academy_submissions.assignment_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_quizzes
DROP POLICY IF EXISTS "Quizzes viewable by course members" ON public.academy_quizzes;
CREATE POLICY "Quizzes viewable by course members" ON public.academy_quizzes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_enrollments e
    WHERE e.course_id = academy_quizzes.course_id AND e.student_id = auth.uid() AND e.status = 'accepted'
  ) OR
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_quizzes.course_id AND t.user_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own quizzes" ON public.academy_quizzes;
CREATE POLICY "Teachers can manage own quizzes" ON public.academy_quizzes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_quizzes.course_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_quiz_questions
DROP POLICY IF EXISTS "Questions viewable by course members" ON public.academy_quiz_questions;
CREATE POLICY "Questions viewable by course members" ON public.academy_quiz_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_quizzes q
    JOIN public.academy_enrollments e ON q.course_id = e.course_id
    WHERE q.id = academy_quiz_questions.quiz_id AND e.student_id = auth.uid() AND e.status = 'accepted'
  ) OR
  EXISTS (
    SELECT 1 FROM public.academy_quizzes q
    JOIN public.academy_courses c ON q.course_id = c.id
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE q.id = academy_quiz_questions.quiz_id AND t.user_id = auth.uid()
  ) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "Teachers can manage own questions" ON public.academy_quiz_questions;
CREATE POLICY "Teachers can manage own questions" ON public.academy_quiz_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_quizzes q
    JOIN public.academy_courses c ON q.course_id = c.id
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE q.id = academy_quiz_questions.quiz_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_quiz_attempts
DROP POLICY IF EXISTS "Students can view own attempts" ON public.academy_quiz_attempts;
CREATE POLICY "Students can view own attempts" ON public.academy_quiz_attempts FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create attempts" ON public.academy_quiz_attempts;
CREATE POLICY "Students can create attempts" ON public.academy_quiz_attempts FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view course attempts" ON public.academy_quiz_attempts;
CREATE POLICY "Teachers can view course attempts" ON public.academy_quiz_attempts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_quiz_attempts.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all attempts" ON public.academy_quiz_attempts;
CREATE POLICY "Admins can view all attempts" ON public.academy_quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_grades
DROP POLICY IF EXISTS "Students can view own grades" ON public.academy_grades;
CREATE POLICY "Students can view own grades" ON public.academy_grades FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can manage course grades" ON public.academy_grades;
CREATE POLICY "Teachers can manage course grades" ON public.academy_grades FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_grades.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all grades" ON public.academy_grades;
CREATE POLICY "Admins can view all grades" ON public.academy_grades FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_certificates
DROP POLICY IF EXISTS "Certificates are viewable by everyone" ON public.academy_certificates;
CREATE POLICY "Certificates are viewable by everyone" ON public.academy_certificates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage certificates" ON public.academy_certificates;
CREATE POLICY "Admins can manage certificates" ON public.academy_certificates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_materials
DROP POLICY IF EXISTS "Materials viewable by course members" ON public.academy_materials;
CREATE POLICY "Materials viewable by course members" ON public.academy_materials FOR SELECT USING (
  is_published = true AND (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.course_id = academy_materials.course_id AND e.student_id = auth.uid() AND e.status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM public.academy_courses c
      JOIN public.academy_teachers t ON c.teacher_id = t.id
      WHERE c.id = academy_materials.course_id AND t.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
  )
);

DROP POLICY IF EXISTS "Teachers can manage own materials" ON public.academy_materials;
CREATE POLICY "Teachers can manage own materials" ON public.academy_materials FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_materials.course_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_announcements
DROP POLICY IF EXISTS "Announcements viewable by course members" ON public.academy_announcements;
CREATE POLICY "Announcements viewable by course members" ON public.academy_announcements FOR SELECT USING (
  is_published = true AND (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.course_id = academy_announcements.course_id AND e.student_id = auth.uid() AND e.status = 'accepted'
    ) OR
    EXISTS (
      SELECT 1 FROM public.academy_courses c
      JOIN public.academy_teachers t ON c.teacher_id = t.id
      WHERE c.id = academy_announcements.course_id AND t.user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
  )
);

DROP POLICY IF EXISTS "Teachers can manage own announcements" ON public.academy_announcements;
CREATE POLICY "Teachers can manage own announcements" ON public.academy_announcements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_announcements.course_id AND t.user_id = auth.uid()
  )
);

-- RLS Policies for academy_notes
DROP POLICY IF EXISTS "Students can manage own notes" ON public.academy_notes;
CREATE POLICY "Students can manage own notes" ON public.academy_notes FOR ALL USING (student_id = auth.uid());

-- RLS Policies for academy_coin_rewards
DROP POLICY IF EXISTS "Students can view own rewards" ON public.academy_coin_rewards;
CREATE POLICY "Students can view own rewards" ON public.academy_coin_rewards FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "System can create rewards" ON public.academy_coin_rewards;
CREATE POLICY "System can create rewards" ON public.academy_coin_rewards FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all rewards" ON public.academy_coin_rewards;
CREATE POLICY "Admins can view all rewards" ON public.academy_coin_rewards FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_student_bans
DROP POLICY IF EXISTS "Teachers can manage bans in own courses" ON public.academy_student_bans;
CREATE POLICY "Teachers can manage bans in own courses" ON public.academy_student_bans FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    JOIN public.academy_teachers t ON c.teacher_id = t.id
    WHERE c.id = academy_student_bans.course_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all bans" ON public.academy_student_bans;
CREATE POLICY "Admins can manage all bans" ON public.academy_student_bans FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_student_ids
DROP POLICY IF EXISTS "Students can view own ID" ON public.academy_student_ids;
CREATE POLICY "Students can view own ID" ON public.academy_student_ids FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all student IDs" ON public.academy_student_ids;
CREATE POLICY "Admins can view all student IDs" ON public.academy_student_ids FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "System can create student IDs" ON public.academy_student_ids;
CREATE POLICY "System can create student IDs" ON public.academy_student_ids FOR INSERT WITH CHECK (true);

-- RLS Policies for academy_admissions_applications
DROP POLICY IF EXISTS "Students can view own applications" ON public.academy_admissions_applications;
CREATE POLICY "Students can view own applications" ON public.academy_admissions_applications FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create applications" ON public.academy_admissions_applications;
CREATE POLICY "Students can create applications" ON public.academy_admissions_applications FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage applications" ON public.academy_admissions_applications;
CREATE POLICY "Admins can manage applications" ON public.academy_admissions_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_admissions_log
DROP POLICY IF EXISTS "Admins can view admissions log" ON public.academy_admissions_log;
CREATE POLICY "Admins can view admissions log" ON public.academy_admissions_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "System can create admissions log entries" ON public.academy_admissions_log;
CREATE POLICY "System can create admissions log entries" ON public.academy_admissions_log FOR INSERT WITH CHECK (true);

-- RLS Policies for academy_board_actions_log
DROP POLICY IF EXISTS "Admins can view board log" ON public.academy_board_actions_log;
CREATE POLICY "Admins can view board log" ON public.academy_board_actions_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

DROP POLICY IF EXISTS "System can create board log entries" ON public.academy_board_actions_log;
CREATE POLICY "System can create board log entries" ON public.academy_board_actions_log FOR INSERT WITH CHECK (true);

-- RLS Policies for academy_teacher_ratings
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.academy_teacher_ratings;
CREATE POLICY "Ratings are viewable by everyone" ON public.academy_teacher_ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Students can create own ratings" ON public.academy_teacher_ratings;
CREATE POLICY "Students can create own ratings" ON public.academy_teacher_ratings FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own ratings" ON public.academy_teacher_ratings;
CREATE POLICY "Students can update own ratings" ON public.academy_teacher_ratings FOR UPDATE USING (student_id = auth.uid());

-- RLS Policies for academy_teacher_references
DROP POLICY IF EXISTS "References are viewable by everyone" ON public.academy_teacher_references;
CREATE POLICY "References are viewable by everyone" ON public.academy_teacher_references FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Teachers can manage own references" ON public.academy_teacher_references;
CREATE POLICY "Teachers can manage own references" ON public.academy_teacher_references FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_teacher_references.teacher_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all references" ON public.academy_teacher_references;
CREATE POLICY "Admins can manage all references" ON public.academy_teacher_references FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_graduate_badges
DROP POLICY IF EXISTS "Badges are viewable by everyone" ON public.academy_graduate_badges;
CREATE POLICY "Badges are viewable by everyone" ON public.academy_graduate_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can create badges" ON public.academy_graduate_badges;
CREATE POLICY "System can create badges" ON public.academy_graduate_badges FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage badges" ON public.academy_graduate_badges;
CREATE POLICY "Admins can manage badges" ON public.academy_graduate_badges FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- RLS Policies for academy_learning_pathways
DROP POLICY IF EXISTS "Pathways are viewable by everyone" ON public.academy_learning_pathways;
CREATE POLICY "Pathways are viewable by everyone" ON public.academy_learning_pathways FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage pathways" ON public.academy_learning_pathways;
CREATE POLICY "Admins can manage pathways" ON public.academy_learning_pathways FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'superadmin'))
);

-- ============================================================
-- GRANTS
-- ============================================================
-- Grant authenticated access to all academy tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_teacher_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_classrooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_learning_pathways TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_teacher_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_waitlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_quiz_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_grades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_certificates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_coin_rewards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_student_bans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_student_ids TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_admissions_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_admissions_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_board_actions_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_teacher_references TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_graduate_badges TO authenticated;

-- Grant anon read access for public-facing tables
GRANT SELECT ON public.academy_categories TO anon;
GRANT SELECT ON public.academy_courses TO anon;
GRANT SELECT ON public.academy_teachers TO anon;
GRANT SELECT ON public.academy_certificates TO anon;
GRANT SELECT ON public.academy_graduate_badges TO anon;
GRANT SELECT ON public.academy_learning_pathways TO anon;

-- Grant usage on sequences for auto-generated IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
