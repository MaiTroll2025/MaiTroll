// =============================================================================
// ACADEMY TYPE DEFINITIONS
// =============================================================================

export type EnrollmentStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  | 'completed'
  | 'dropped'
  | string;

export type TeacherApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | string;

export type AdmissionsStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | string;

export interface AcademyCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyTeacher {
  id: string;
  user_id: string;
  teacher_id?: string;
  is_approved?: boolean;
  is_active?: boolean;
  approved_by?: string;
  approved_at?: string;
  bio?: string;
  expertise?: string[];
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyTeacherApplication {
  id: string;
  user_id: string;
  status: TeacherApplicationStatus;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyCourse {
  id: string;
  teacher_id: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  status?: string;
  max_students?: number;
  enrollment_fee?: number;
  currency_type?: string;
  teacher_name?: string;
  teacher_avatar?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  academy_teachers?: any;
  academy_categories?: any;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyClassroom {
  id: string;
  course_id: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  coins_paid?: number;
  loan_balance?: number;
  weekly_due?: number;
  access_paused?: boolean;
  course_name?: string;
  course_slug?: string;
  teacher_name?: string;
  user_profiles?: any;
  course?: any;
  created_at?: string;
  [key: string]: any;
}

export interface AcademySession {
  id: string;
  course_id: string;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  title?: string;
  description?: string;
  academy_courses?: any;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyAttendance {
  id: string;
  session_id: string;
  student_id: string;
  course_id: string;
  status?: string;
  check_in_time?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyAssignment {
  id: string;
  course_id: string;
  title?: string;
  description?: string;
  due_date?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademySubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  content?: string;
  submitted_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyQuiz {
  id: string;
  course_id: string;
  title?: string;
  description?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyQuizQuestion {
  id: string;
  quiz_id: string;
  question_text?: string;
  options?: any[];
  correct_answer?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyQuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  answers?: any;
  score?: number;
  attempted_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyGrade {
  id: string;
  student_id: string;
  course_id: string;
  grade?: string;
  score?: number;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyCertificate {
  id: string;
  student_id: string;
  course_id: string;
  issued_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyMaterial {
  id: string;
  course_id: string;
  title?: string;
  url?: string;
  material_type?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyAnnouncement {
  id: string;
  course_id: string;
  title?: string;
  body?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyCoinReward {
  id: string;
  student_id: string;
  course_id: string;
  amount?: number;
  reason?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyAdmissionsApplication {
  id: string;
  student_id: string;
  status: AdmissionsStatus;
  loan_approved?: boolean;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyLearningPathway {
  id: string;
  title?: string;
  description?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyGraduateBadge {
  id: string;
  student_id: string;
  badge_name?: string;
  awarded_at?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyTeacherRating {
  id: string;
  teacher_id: string;
  student_id: string;
  rating?: number;
  review?: string;
  created_at?: string;
  [key: string]: any;
}

export interface AcademyMetrics {
  id?: string;
  total_students?: number;
  total_courses?: number;
  total_revenue?: number;
  created_at?: string;
  [key: string]: any;
}
