-- Initial Schema Part 06
-- Tables 321 to 383
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: academy_categories
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

-- Table: academy_teachers
CREATE TABLE IF NOT EXISTS public.academy_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_id text NOT NULL UNIQUE,
  bio text,
  specialties text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  total_students integer DEFAULT 0,
  total_graduates integer DEFAULT 0,
  total_certificates_issued integer DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0.00,
  total_ratings integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_teacher_applications
CREATE TABLE IF NOT EXISTS public.academy_teacher_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  qualifications text,
  experience text,
  teaching_subjects text[] DEFAULT '{}',
  motivation text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'suspended')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_courses
CREATE TABLE IF NOT EXISTS public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  category_id uuid,
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

-- Table: academy_classrooms
CREATE TABLE IF NOT EXISTS public.academy_classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  name text NOT NULL,
  livekit_room_name text UNIQUE,
  max_capacity integer DEFAULT 20,
  is_locked boolean DEFAULT false,
  is_active boolean DEFAULT true,
  current_session_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_learning_pathways
CREATE TABLE IF NOT EXISTS public.academy_learning_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  category_id uuid,
  badge_name text,
  badge_icon text,
  badge_color text,
  courses uuid[] DEFAULT '{}',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_teacher_ratings
CREATE TABLE IF NOT EXISTS public.academy_teacher_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, student_id, course_id)
);

-- Table: academy_enrollments
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  classroom_id uuid,
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

-- Table: academy_waitlists
CREATE TABLE IF NOT EXISTS public.academy_waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  waitlist_position integer NOT NULL,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'expired', 'withdrawn')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Table: academy_sessions
CREATE TABLE IF NOT EXISTS public.academy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  classroom_id uuid,
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

-- Table: academy_attendance
CREATE TABLE IF NOT EXISTS public.academy_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  check_in_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Table: academy_assignments
CREATE TABLE IF NOT EXISTS public.academy_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
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

-- Table: academy_submissions
CREATE TABLE IF NOT EXISTS public.academy_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  content text,
  file_urls text[] DEFAULT '{}',
  submission_type text DEFAULT 'text' CHECK (submission_type IN ('text', 'pdf', 'image', 'link')),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned', 'late')),
  score numeric(5,2),
  max_points integer DEFAULT 100,
  feedback text,
  graded_by uuid,
  graded_at timestamptz,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_quizzes
CREATE TABLE IF NOT EXISTS public.academy_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
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

-- Table: academy_quiz_questions
CREATE TABLE IF NOT EXISTS public.academy_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
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

-- Table: academy_quiz_attempts
CREATE TABLE IF NOT EXISTS public.academy_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
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

-- Table: academy_grades
CREATE TABLE IF NOT EXISTS public.academy_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  assignment_id uuid,
  quiz_id uuid,
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

-- Table: academy_certificates
CREATE TABLE IF NOT EXISTS public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  verification_id text NOT NULL UNIQUE,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  teacher_id uuid,
  enrollment_id uuid,
  final_grade text,
  final_percentage numeric(5,2),
  status text DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_materials
CREATE TABLE IF NOT EXISTS public.academy_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
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

-- Table: academy_announcements
CREATE TABLE IF NOT EXISTS public.academy_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_notes
CREATE TABLE IF NOT EXISTS public.academy_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  session_id uuid,
  course_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_coin_rewards
CREATE TABLE IF NOT EXISTS public.academy_coin_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid,
  reward_type text NOT NULL CHECK (reward_type IN ('quiz_passed', 'exam_passed', 'perfect_score', 'course_completed', 'certificate_earned', 'daily_streak', 'attendance_milestone', 'assignment_submitted')),
  reward_reason text NOT NULL,
  coins_awarded integer NOT NULL,
  reference_id uuid,
  reference_type text,
  is_duplicate_check boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Table: academy_student_ids
CREATE TABLE IF NOT EXISTS public.academy_student_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  student_id_number text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Table: academy_admissions_applications
CREATE TABLE IF NOT EXISTS public.academy_admissions_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  first_choice_course_id uuid,
  second_choice_course_id uuid,
  third_choice_course_id uuid,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'accepted', 'waitlisted', 'denied', 'withdrawn')),
  assigned_course_id uuid,
  assigned_classroom_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  acceptance_letter_sent boolean DEFAULT false,
  denial_letter_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_admissions_log
CREATE TABLE IF NOT EXISTS public.academy_admissions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL,
  action text NOT NULL,
  student_id uuid,
  course_id uuid,
  details text,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Table: academy_graduate_badges
CREATE TABLE IF NOT EXISTS public.academy_graduate_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  badge_type text NOT NULL CHECK (badge_type IN ('academy_graduate', 'verified_certificate', 'automotive_graduate', 'credit_specialist', 'healthcare_graduate', 'business_graduate', 'technology_graduate', 'pathway_complete')),
  badge_name text NOT NULL,
  badge_icon text,
  badge_color text,
  course_id uuid,
  pathway_id uuid,
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table: shareathon_events
CREATE TABLE IF NOT EXISTS public.shareathon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Share-A-Thon Weekend',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'waiting', 'active', 'completed')),
  goal_live_broadcasters INTEGER NOT NULL DEFAULT 10,
  current_live_broadcasters INTEGER NOT NULL DEFAULT 0,
  event_start_at TIMESTAMPTZ,
  event_end_at TIMESTAMPTZ,
  restrict_new_broadcasters BOOLEAN NOT NULL DEFAULT true,
  bonus_amount NUMERIC NOT NULL DEFAULT 5.00,
  cashout_fee_waived BOOLEAN NOT NULL DEFAULT true,
  badge_slug TEXT DEFAULT 'shareathon-weekend',
  peak_simultaneous_broadcasters INTEGER NOT NULL DEFAULT 0,
  total_battles_during_event INTEGER NOT NULL DEFAULT 0,
  total_shares_submitted INTEGER NOT NULL DEFAULT 0,
  new_user_registrations INTEGER NOT NULL DEFAULT 0,
  tips_earned_during_event NUMERIC NOT NULL DEFAULT 0,
  bonus_payout_total NUMERIC NOT NULL DEFAULT 0,
  cashout_fees_waived_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: shareathon_eligible_broadcasters
CREATE TABLE IF NOT EXISTS public.shareathon_eligible_broadcasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_qualified BOOLEAN NOT NULL DEFAULT false,
  qualified_at TIMESTAMPTZ,
  stream_duration_minutes INTEGER NOT NULL DEFAULT 0,
  battles_participated INTEGER NOT NULL DEFAULT 0,
  shares_submitted INTEGER NOT NULL DEFAULT 0,
  shares_approved INTEGER NOT NULL DEFAULT 0,
  bonus_paid BOOLEAN NOT NULL DEFAULT false,
  bonus_paid_at TIMESTAMPTZ,
  cashout_fee_waived BOOLEAN NOT NULL DEFAULT false,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  disqualification_reason TEXT,
  UNIQUE(event_id, user_id)
);

-- Table: shareathon_submissions
CREATE TABLE IF NOT EXISTS public.shareathon_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'facebook', 'instagram', 'x', 'youtube', 'discord', 'reddit')),
  share_url TEXT,
  screenshot_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'more_info_requested')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Table: shareathon_verification_log
CREATE TABLE IF NOT EXISTS public.shareathon_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'more_info_requested', 'revoked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: utromail_accounts
CREATE TABLE IF NOT EXISTS public.utromail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  mail_address text NOT NULL UNIQUE,
  display_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: tromail_role_accounts
CREATE TABLE IF NOT EXISTS public.tromail_role_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mail_address text NOT NULL UNIQUE,
  role_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: utromail_threads
CREATE TABLE IF NOT EXISTS public.utromail_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text,
  is_group boolean DEFAULT false,
  created_by uuid,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: utromail_thread_members
CREATE TABLE IF NOT EXISTS public.utromail_thread_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  folder text DEFAULT 'inbox' CHECK (folder IN ('inbox', 'sent', 'archive', 'trash', 'requests', 'starred', 'drafts')),
  is_muted boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Table: utromail_messages
CREATE TABLE IF NOT EXISTS public.utromail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_mail_address text NOT NULL,
  recipient_id uuid,
  recipient_mail_address text,
  subject text,
  body text NOT NULL,
  body_html text,
  message_type text DEFAULT 'normal' CHECK (message_type IN ('normal', 'academy_notification', 'government', 'system', 'report')),
  is_starred boolean DEFAULT false,
  is_draft boolean DEFAULT false,
  parent_message_id uuid,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: utromail_read_status
CREATE TABLE IF NOT EXISTS public.utromail_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Table: utromail_attachments
CREATE TABLE IF NOT EXISTS public.utromail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- Table: utromail_blocks
CREATE TABLE IF NOT EXISTS public.utromail_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Table: utromail_requests
CREATE TABLE IF NOT EXISTS public.utromail_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: utromail_reports
CREATE TABLE IF NOT EXISTS public.utromail_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_id uuid NOT NULL,
  message_id uuid,
  thread_id uuid,
  report_reason text NOT NULL,
  screenshot_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: utromail_notifications
CREATE TABLE IF NOT EXISTS public.utromail_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid,
  notification_type text NOT NULL CHECK (notification_type IN ('new_message', 'message_request', 'academy_mail', 'government_mail', 'report_update')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Table: academy_discussions
CREATE TABLE IF NOT EXISTS public.academy_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  parent_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_teacher_credentials
CREATE TABLE IF NOT EXISTS public.academy_teacher_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  credential_type text NOT NULL CHECK (credential_type IN ('certification', 'degree', 'license', 'award', 'other')),
  title text NOT NULL,
  issuing_organization text,
  issue_date date,
  expiry_date date,
  credential_id text,
  document_url text,
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_teacher_payouts
CREATE TABLE IF NOT EXISTS public.academy_teacher_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  amount integer NOT NULL,
  payout_type text NOT NULL CHECK (payout_type IN ('enrollment', 'bonus', 'adjustment')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  reference_id text,
  reference_type text,
  period_start date,
  period_end date,
  processed_by uuid,
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_loan_payments
CREATE TABLE IF NOT EXISTS public.academy_loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  enrollment_id uuid,
  amount integer NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('automatic', 'manual', 'admin_adjustment')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  created_at timestamptz DEFAULT now()
);

-- Table: academy_accreditation_orgs
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

-- Table: academy_accreditation_requests
CREATE TABLE IF NOT EXISTS public.academy_accreditation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  org_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'revoked')),
  request_notes text,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: academy_pathway_enrollments
CREATE TABLE IF NOT EXISTS public.academy_pathway_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  pathway_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'dropped')),
  current_course_index integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, pathway_id)
);

-- Table: call_minutes
CREATE TABLE IF NOT EXISTS public.call_minutes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    audio_minutes INTEGER DEFAULT 0 NOT NULL,
    video_minutes INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT call_minutes_audio_minutes_check CHECK (audio_minutes >= 0),
    CONSTRAINT call_minutes_video_minutes_check CHECK (video_minutes >= 0),
    CONSTRAINT call_minutes_user_id_key UNIQUE (user_id)
);

-- Table: weekly_league_goals
CREATE TABLE IF NOT EXISTS public.weekly_league_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    season_key TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    main_tier TEXT NOT NULL,
    sub_tier TEXT NOT NULL DEFAULT 'a',
    goal_type TEXT NOT NULL CHECK (goal_type IN ('gift_weekly','live_weekly','chat_weekly','viewer_weekly')),
    target_value NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    reward_score NUMERIC NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    claimed BOOLEAN NOT NULL DEFAULT false,
    week_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('week', NOW()),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, season_key, main_tier, sub_tier, goal_type)
);

-- Table: visibility_scores
CREATE TABLE IF NOT EXISTS visibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),
  user_id UUID NOT NULL,

  -- Component scores (0-100 each)
  viewer_score NUMERIC(8,2) DEFAULT 0,
  chat_score NUMERIC(8,2) DEFAULT 0,
  reaction_score NUMERIC(8,2) DEFAULT 0,
  share_score NUMERIC(8,2) DEFAULT 0,
  watch_time_score NUMERIC(8,2) DEFAULT 0,
  recent_activity_score NUMERIC(8,2) DEFAULT 0,
  reputation_modifier NUMERIC(8,2) DEFAULT 1.0,
  momentum_boost NUMERIC(8,2) DEFAULT 1.0,
  new_user_boost NUMERIC(8,2) DEFAULT 1.0,
  abuse_penalty NUMERIC(8,2) DEFAULT 1.0,

  -- Computed scores
  base_score NUMERIC(10,2) DEFAULT 0,
  hot_score NUMERIC(10,2) DEFAULT 0,
  final_visibility_score NUMERIC(10,2) DEFAULT 0,

  -- Metadata
  is_rising BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_id, content_type)
);

-- Table: momentum_tracking
CREATE TABLE IF NOT EXISTS momentum_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),

  -- Velocity windows (counts per time window)
  viewers_1min INTEGER DEFAULT 0,
  viewers_2min INTEGER DEFAULT 0,
  viewers_5min INTEGER DEFAULT 0,
  chat_1min INTEGER DEFAULT 0,
  chat_2min INTEGER DEFAULT 0,
  reactions_1min INTEGER DEFAULT 0,
  reactions_2min INTEGER DEFAULT 0,
  bids_1min INTEGER DEFAULT 0,
  bids_5min INTEGER DEFAULT 0,
  crowns_1min INTEGER DEFAULT 0,
  crowns_5min INTEGER DEFAULT 0,
  shares_5min INTEGER DEFAULT 0,

  -- Momentum state
  momentum_level NUMERIC(5,2) DEFAULT 0,  -- 0-100
  is_boosted BOOLEAN DEFAULT FALSE,
  boost_expires_at TIMESTAMPTZ,
  boost_multiplier NUMERIC(5,2) DEFAULT 1.0,
  velocity_trend TEXT DEFAULT 'stable' CHECK (velocity_trend IN ('accelerating', 'stable', 'decelerating')),

  -- Timestamps
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  last_decay_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_id, content_type)
);

-- Table: xtrollz_applications
CREATE TABLE IF NOT EXISTS public.xtrollz_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  legal_first_name text NOT NULL,
  legal_last_name text NOT NULL,
  date_of_birth date NOT NULL,
  troll_city_username text NOT NULL,
  troll_city_user_id uuid NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  state_province text NOT NULL,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'draft',
  payment_status text NOT NULL DEFAULT 'pending',
  paypal_order_id text,
  paypal_capture_id text,
  payment_amount numeric(10,2),
  payment_currency text DEFAULT 'USD',
  payment_timestamp timestamptz,
  reviewer_id uuid,
  reviewer_notes text,
  denial_reason text,
  approval_timestamp timestamptz,
  last_status_change timestamptz NOT NULL DEFAULT now(),
  rules_version_accepted text,
  age_agreement_version text,
  security_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: xtrollz_streams
CREATE TABLE IF NOT EXISTS public.xtrollz_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  is_private boolean NOT NULL DEFAULT false,
  password_hash text,
  password_created_at timestamptz,
  password_updated_at timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  viewer_count integer NOT NULL DEFAULT 0,
  total_likes integer NOT NULL DEFAULT 0,
  xcoin_earnings numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: xtrollz_moderation_actions
CREATE TABLE IF NOT EXISTS public.xtrollz_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stream_id uuid,
  action_type text NOT NULL,
  reason text,
  target_user_id uuid,
  moderator_id uuid NOT NULL,
  moderator_role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: xtrollz_application_documents
CREATE TABLE IF NOT EXISTS public.xtrollz_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size integer,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Table: xtrollz_favorites
CREATE TABLE IF NOT EXISTS public.xtrollz_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  streamer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, streamer_id)
);

-- Table: xtrollz_rules_acceptance
CREATE TABLE IF NOT EXISTS public.xtrollz_rules_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rules_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Table: city_ads
CREATE TABLE IF NOT EXISTS public.city_ads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text NOT NULL,
  cta_text text,
  cta_link text,
  placement text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  priority integer DEFAULT 0 NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  label text,
  campaign_type text,
  background_style text,
  impressions_count integer DEFAULT 0 NOT NULL,
  clicks_count integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  maitalent_campaign_id text,
  maitalent_platform text DEFAULT 'maitalent'::text,
  maitalent_target_audience jsonb
);

-- Table: neighborhood_members
CREATE TABLE IF NOT EXISTS public.neighborhood_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'follower' CHECK (role IN ('leader', 'officer', 'follower')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(neighborhood_id, user_id)
);

-- Table: neighborhood_invites
CREATE TABLE IF NOT EXISTS public.neighborhood_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_user_id UUID NOT NULL,
  follower_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMPTZ,
  UNIQUE(leader_user_id, follower_user_id)
);

-- Table: payout_runs
CREATE TABLE IF NOT EXISTS public.payout_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      total_payouts INTEGER DEFAULT 0,
      total_coins BIGINT DEFAULT 0,
      total_usd NUMERIC(10,2) DEFAULT 0,
      paypal_batch_id TEXT,
      logs JSONB
    );

-- Table: payouts
CREATE TABLE IF NOT EXISTS public.payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID,
      user_id UUID,
      tier_id TEXT,
      amount_coins BIGINT NOT NULL,
      amount_usd NUMERIC(10,2) NOT NULL,
      paypal_email TEXT NOT NULL,
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'success', 'failed', 'returned')),
      paypal_payout_item_id TEXT,
      paypal_batch_id TEXT,
      failure_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      CONSTRAINT unique_run_user UNIQUE (run_id, user_id)
    );

-- Table: broadcast_replays
create table if not exists public.broadcast_replays (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null,
  user_id uuid not null,
  title text,
  cloudflare_r2_key text not null,
  replay_url text not null,
  thumbnail_url text,
  duration_seconds integer,
  file_size bigint,
  created_at timestamptz not null default now()
);

-- Table: purchasable_items
CREATE TABLE IF NOT EXISTS public.purchasable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('coin_pack', 'gift', 'seat', 'stream_feature', 'badge', 'vehicle', 'house', 'upgrade', 'admin_feature', 'other')),
  coin_price integer,
  usd_price numeric,
  is_coin_pack boolean DEFAULT false,
  is_active boolean DEFAULT true,
  frontend_source text,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Table: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Table: court_dockets
CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL,
    max_cases INTEGER DEFAULT 20,
    status TEXT DEFAULT 'open', -- open, full, closed, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(court_date)
);

-- Table: career_positions
CREATE TABLE IF NOT EXISTS public.career_positions (
  id text PRIMARY KEY,
  title text NOT NULL,
  department text NOT NULL,
  description text,
  max_applications integer NOT NULL DEFAULT 10,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: marketplace_items
CREATE TABLE IF NOT EXISTS public.marketplace_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    subcategory TEXT,
    condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    delivery_type TEXT CHECK (delivery_type IN ('shipping', 'pickup', 'both')) DEFAULT 'both',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    images JSONB DEFAULT '[]',
    stock INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('active', 'sold', 'hidden', 'flagged')) DEFAULT 'active',
    is_vehicle BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: president_candidates
create table if not exists president_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null,
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  banner_path text not null,
  display_name text,
  slogan text,
  statement text,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  unique(election_id, user_id)
);

-- Table: user_leagues
CREATE TABLE IF NOT EXISTS public.user_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    creator_id UUID NOT NULL,
    max_members INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    league_type TEXT DEFAULT 'standard' CHECK (league_type IN ('standard', 'competitive', 'casual', 'tournament')),
    icon_emoji TEXT DEFAULT '🏆',
    color TEXT DEFAULT '#8b5cf6',
    league_score BIGINT DEFAULT 0,
    league_level INT DEFAULT 1,
    member_count INT DEFAULT 1,
    requirements JSONB DEFAULT '{"min_level": 0, "invite_only": false}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: marketplace_purchases
CREATE TABLE IF NOT EXISTS marketplace_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES user_profiles(id),
    item_id UUID REFERENCES marketplace_items(id),
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
