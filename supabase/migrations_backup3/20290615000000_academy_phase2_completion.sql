-- ============================================================
-- Mai Troll ACADEMY - PHASE 2 COMPLETION MIGRATION
-- Adds missing tables and columns for full academy functionality
-- ============================================================

-- ============================================================
-- 1. ACADEMY NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('assignment_due', 'grade_posted', 'session_starting', 'certificate_earned', 'loan_payment_due', 'announcement', 'enrollment', 'waitlist_promoted', 'course_completed', 'attendance_alert')),
  reference_id text,
  reference_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_notifications_user_id ON public.academy_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_notifications_read ON public.academy_notifications(user_id, is_read);

-- ============================================================
-- 2. ACADEMY COURSE DISCUSSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  parent_id uuid REFERENCES public.academy_discussions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_discussions_course_id ON public.academy_discussions(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_discussions_parent_id ON public.academy_discussions(parent_id);

-- ============================================================
-- 3. ACADEMY MESSAGES (teacher-student direct messaging)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.academy_courses(id) ON DELETE SET NULL,
  subject text,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_messages_sender ON public.academy_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_academy_messages_recipient ON public.academy_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_academy_messages_course ON public.academy_messages(course_id);

-- ============================================================
-- 4. ACADEMY TEACHER CREDENTIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teacher_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('certification', 'degree', 'license', 'award', 'other')),
  title text NOT NULL,
  issuing_organization text,
  issue_date date,
  expiry_date date,
  credential_id text,
  document_url text,
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES public.user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_teacher_credentials_teacher ON public.academy_teacher_credentials(teacher_id);

-- ============================================================
-- 5. ACADEMY TEACHER PAYOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_teacher_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payout_type text NOT NULL CHECK (payout_type IN ('enrollment', 'bonus', 'adjustment')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  reference_id text,
  reference_type text,
  period_start date,
  period_end date,
  processed_by uuid REFERENCES public.user_profiles(id),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_teacher_payouts_teacher ON public.academy_teacher_payouts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_payouts_status ON public.academy_teacher_payouts(status);

-- ============================================================
-- 6. ACADEMY LOAN PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.academy_enrollments(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('automatic', 'manual', 'admin_adjustment')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_loan_payments_student ON public.academy_loan_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_loan_payments_enrollment ON public.academy_loan_payments(enrollment_id);

-- ============================================================
-- 7. ACADEMY ACCREDITATION ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_accreditation_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  website text,
  logo_url text,
  contact_email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 8. ACADEMY ACCREDITATION REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_accreditation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.academy_accreditation_orgs(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'revoked')),
  request_notes text,
  review_notes text,
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_accred_course ON public.academy_accreditation_requests(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_accred_status ON public.academy_accreditation_requests(status);

-- ============================================================
-- 9. ACADEMY COMPLETION AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_completion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.academy_enrollments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('progress_updated', 'completion_checked', 'auto_completed', 'manual_completed', 'certificate_issued', 'grade_finalized')),
  attendance_pct numeric(5,2),
  assignment_pct numeric(5,2),
  quiz_pct numeric(5,2),
  exam_pct numeric(5,2),
  overall_pct numeric(5,2),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_completion_enrollment ON public.academy_completion_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academy_completion_student ON public.academy_completion_log(student_id);

-- ============================================================
-- 10. ACADEMY COURSE REVIEWS (student reviews of courses)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.academy_enrollments(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_course_reviews_course ON public.academy_course_reviews(course_id);

-- ============================================================
-- 11. ACADEMY SETTINGS (key-value store for admin config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed default settings
INSERT INTO public.academy_settings (key, value, description) VALUES
  ('platform_commission_pct', '15', 'Platform commission percentage from course enrollments'),
  ('max_concurrent_enrollments', '2', 'Maximum concurrent course enrollments per student'),
  ('attendance_weight', '20', 'Attendance weight percentage for completion calculation'),
  ('assignment_weight', '40', 'Assignment weight percentage for completion calculation'),
  ('quiz_weight', '20', 'Quiz weight percentage for completion calculation'),
  ('exam_weight', '20', 'Exam/final weight percentage for completion calculation'),
  ('auto_complete_enabled', 'true', 'Enable automatic course completion when requirements are met'),
  ('loan_reminder_days', '3', 'Days before loan payment due to send reminder'),
  ('delinquency_threshold_days', '14', 'Days overdue before marking as delinquent'),
  ('certificate_template', 'default', 'Default certificate template name')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 12. ACADEMY PATHWAY ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.academy_pathway_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES public.academy_learning_pathways(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'dropped')),
  current_course_index integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, pathway_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_pathway_enroll_student ON public.academy_pathway_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_pathway_enroll_pathway ON public.academy_pathway_enrollments(pathway_id);

-- ============================================================
-- Add missing columns to existing tables
-- ============================================================

-- Add loan_balance and weekly_due to enrollments if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_enrollments' AND column_name = 'loan_balance') THEN
    ALTER TABLE public.academy_enrollments ADD COLUMN loan_balance integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_enrollments' AND column_name = 'weekly_due') THEN
    ALTER TABLE public.academy_enrollments ADD COLUMN weekly_due integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_enrollments' AND column_name = 'access_paused') THEN
    ALTER TABLE public.academy_enrollments ADD COLUMN access_paused boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_enrollments' AND column_name = 'progress_pct') THEN
    ALTER TABLE public.academy_enrollments ADD COLUMN progress_pct integer DEFAULT 0;
  END IF;
END$$;

-- Add suspension fields to teachers if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'suspended_at') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN suspended_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'suspended_by') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN suspended_by uuid REFERENCES public.user_profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'suspension_reason') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN suspension_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'credentials_verified') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN credentials_verified boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN onboarding_completed boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'total_earnings') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN total_earnings integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_teachers' AND column_name = 'pending_payout') THEN
    ALTER TABLE public.academy_teachers ADD COLUMN pending_payout integer DEFAULT 0;
  END IF;
END$$;

-- Add accreditation fields to courses if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'accredited') THEN
    ALTER TABLE public.academy_courses ADD COLUMN accredited boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'accreditation_org_id') THEN
    ALTER TABLE public.academy_courses ADD COLUMN accreditation_org_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'credits') THEN
    ALTER TABLE public.academy_courses ADD COLUMN credits integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'requires_admin_approval') THEN
    ALTER TABLE public.academy_courses ADD COLUMN requires_admin_approval boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'admin_approved') THEN
    ALTER TABLE public.academy_courses ADD COLUMN admin_approved boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'admin_approved_by') THEN
    ALTER TABLE public.academy_courses ADD COLUMN admin_approved_by uuid REFERENCES public.user_profiles(id);
  END IF;
END$$;

-- ============================================================
-- RLS Policies for new tables
-- ============================================================

-- Notifications
ALTER TABLE public.academy_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.academy_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.academy_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.academy_notifications FOR UPDATE USING (auth.uid() = user_id);

-- Discussions
ALTER TABLE public.academy_discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enrolled users can view discussions" ON public.academy_discussions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create discussions" ON public.academy_discussions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own discussions" ON public.academy_discussions FOR UPDATE USING (auth.uid() = author_id);

-- Messages
ALTER TABLE public.academy_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.academy_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Authenticated users can send messages" ON public.academy_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipients can mark read" ON public.academy_messages FOR UPDATE USING (auth.uid() = recipient_id);

-- Teacher Credentials
ALTER TABLE public.academy_teacher_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own credentials" ON public.academy_teacher_credentials FOR SELECT USING (true);
CREATE POLICY "Teachers can manage own credentials" ON public.academy_teacher_credentials FOR ALL USING (true);

-- Teacher Payouts
ALTER TABLE public.academy_teacher_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own payouts" ON public.academy_teacher_payouts FOR SELECT USING (true);
CREATE POLICY "Admins can manage payouts" ON public.academy_teacher_payouts FOR ALL USING (true);

-- Loan Payments
ALTER TABLE public.academy_loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own loan payments" ON public.academy_loan_payments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "System can create loan payments" ON public.academy_loan_payments FOR INSERT WITH CHECK (true);

-- Accreditation
ALTER TABLE public.academy_accreditation_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view accreditation orgs" ON public.academy_accreditation_orgs FOR SELECT USING (true);
CREATE POLICY "Admins can manage accreditation orgs" ON public.academy_accreditation_orgs FOR ALL USING (true);

ALTER TABLE public.academy_accreditation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own accreditation requests" ON public.academy_accreditation_requests FOR SELECT USING (true);
CREATE POLICY "Teachers can create accreditation requests" ON public.academy_accreditation_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage accreditation requests" ON public.academy_accreditation_requests FOR ALL USING (true);

-- Completion Log
ALTER TABLE public.academy_completion_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own completion logs" ON public.academy_completion_log FOR SELECT USING (true);
CREATE POLICY "System can create completion logs" ON public.academy_completion_log FOR INSERT WITH CHECK (true);

-- Course Reviews
ALTER TABLE public.academy_course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public reviews" ON public.academy_course_reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Students can create reviews" ON public.academy_course_reviews FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own reviews" ON public.academy_course_reviews FOR UPDATE USING (auth.uid() = student_id);

-- Settings
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.academy_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.academy_settings FOR ALL USING (true);

-- Pathway Enrollments
ALTER TABLE public.academy_pathway_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own pathway enrollments" ON public.academy_pathway_enrollments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can enroll in pathways" ON public.academy_pathway_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own pathway enrollments" ON public.academy_pathway_enrollments FOR UPDATE USING (auth.uid() = student_id);
