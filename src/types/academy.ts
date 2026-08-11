// ============================================================
// Mai Troll ACADEMY - TYPE DEFINITIONS
// ============================================================

export type CourseStatus = 'draft' | 'published' | 'closed' | 'archived' | 'cancelled';
export type EnrollmentStatus = 'pending' | 'accepted' | 'waitlisted' | 'denied' | 'withdropped' | 'completed' | 'failed';
export type EnrollmentType = 'open' | 'approval_required';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type AssignmentType = 'homework' | 'project' | 'essay' | 'practical' | 'presentation';
export type SubmissionStatus = 'submitted' | 'graded' | 'returned' | 'late';
export type QuizType = 'quiz' | 'exam' | 'practice' | 'assessment';
export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching' | 'essay' | 'practical';
export type GradeType = 'assignment' | 'quiz' | 'exam' | 'attendance' | 'final' | 'participation';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type CertificateStatus = 'active' | 'revoked' | 'expired';
export type TeacherApplicationStatus = 'pending' | 'under_review' | 'approved' | 'denied' | 'suspended';
export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type MaterialType = 'pdf' | 'presentation' | 'worksheet' | 'study_guide' | 'link' | 'video' | 'oer';
export type RewardType = 'quiz_passed' | 'exam_passed' | 'perfect_score' | 'course_completed' | 'certificate_earned' | 'daily_streak' | 'attendance_milestone' | 'assignment_submitted';
export type BadgeType = 'academy_graduate' | 'verified_certificate' | 'automotive_graduate' | 'credit_specialist' | 'healthcare_graduate' | 'business_graduate' | 'technology_graduate' | 'pathway_complete';
export type AdmissionsStatus = 'pending_review' | 'under_review' | 'accepted' | 'waitlisted' | 'denied' | 'withdrawn';
export type ReferenceType = 'recommendation' | 'employment_reference' | 'skill_endorsement';
export type ReferenceCategory = 'attendance' | 'participation' | 'professionalism' | 'technical_skill' | 'leadership' | 'communication';

export interface AcademyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademyTeacher {
  id: string;
  user_id: string;
  teacher_id: string;
  bio: string | null;
  specialties: string[];
  is_active: boolean;
  is_approved: boolean;
  credentials_verified?: boolean;
  approved_by: string | null;
  approved_at: string | null;
  total_students: number;
  total_graduates: number;
  total_certificates_issued: number;
  average_rating: number;
  total_ratings: number;
  total_earnings: number;
  pending_payout: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface AcademyTeacherApplication {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  qualifications: string | null;
  experience: string | null;
  teaching_subjects: string[];
  motivation: string | null;
  status: TeacherApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyCourse {
  id: string;
  teacher_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  difficulty_level: DifficultyLevel;
  max_students: number;
  enrollment_fee: number;
  currency_type: string;
  registration_open_date: string | null;
  registration_close_date: string | null;
  start_date: string | null;
  end_date: string | null;
  meeting_days: string[];
  meeting_time: string | null;
  timezone: string;
  enrollment_type: EnrollmentType;
  minimum_attendance_pct: number;
  status: CourseStatus;
  total_sessions: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  teacher_name?: string;
  teacher_avatar?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  enrolled_count?: number;
  waitlist_count?: number;
}

export interface AcademyClassroom {
  id: string;
  course_id: string;
  name: string;
  livekit_room_name: string | null;
  max_capacity: number;
  is_locked: boolean;
  is_active: boolean;
  current_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyEnrollment {
  id: string;
  student_id: string;
  student_name?: string;
  course_id: string;
  classroom_id: string | null;
  student_id_number: string | null;
  status: EnrollmentStatus;
  enrollment_date: string;
  completion_date: string | null;
  final_grade: string | null;
  final_percentage: number | null;
  certificate_issued: boolean;
  certificate_id: string | null;
  coins_paid: number;
  loan_balance?: number;
  weekly_due?: number;
  access_paused?: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  course_name?: string;
  course_slug?: string;
  teacher_name?: string;
  progress_pct?: number;
}

export interface AcademyWaitlist {
  id: string;
  student_id: string;
  course_id: string;
  waitlist_position: number;
  status: 'waiting' | 'promoted' | 'expired' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface AcademySession {
  id: string;
  course_id: string;
  classroom_id: string | null;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  livekit_room_name: string | null;
  recording_url: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  academy_courses?: any;
}

export interface AcademyAttendance {
  id: string;
  session_id: string;
  student_id: string;
  course_id: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyAssignment {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  assignment_type: AssignmentType;
  max_points: number;
  due_date: string | null;
  allowed_submissions: string[];
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AcademySubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string | null;
  file_urls: string[];
  submission_type: string;
  status: SubmissionStatus;
  score: number | null;
  max_points: number;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  student_name?: string;
  student_avatar?: string;
}

export interface AcademyQuiz {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  quiz_type: QuizType;
  time_limit_minutes: number | null;
  max_attempts: number;
  passing_score: number;
  total_points: number;
  shuffle_questions: boolean;
  show_results: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AcademyQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: any[];
  correct_answer: string | null;
  correct_answers: string[];
  points: number;
  explanation: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AcademyQuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  course_id: string;
  answers: Record<string, any>;
  score: number | null;
  percentage: number | null;
  passed: boolean;
  time_taken_seconds: number | null;
  attempt_number: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AcademyGrade {
  id: string;
  student_id: string;
  course_id: string;
  assignment_id: string | null;
  quiz_id: string | null;
  grade_type: GradeType;
  score: number | null;
  max_points: number;
  percentage: number | null;
  letter_grade: LetterGrade | null;
  weight: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyCertificate {
  id: string;
  certificate_number: string;
  verification_id: string;
  student_id: string;
  course_id: string;
  teacher_id: string | null;
  enrollment_id: string | null;
  final_grade: string | null;
  final_percentage: number | null;
  status: CertificateStatus;
  issued_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  student_name?: string;
  student_username?: string;
  course_name?: string;
  teacher_name?: string;
}

export interface AcademyMaterial {
  id: string;
  course_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_url: string | null;
  external_url: string | null;
  source: string | null;
  is_oer: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AcademyAnnouncement {
  id: string;
  course_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_name?: string;
  author_avatar?: string;
}

export interface AcademyNote {
  id: string;
  student_id: string;
  session_id: string | null;
  course_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AcademyCoinReward {
  id: string;
  student_id: string;
  course_id: string | null;
  reward_type: RewardType;
  reward_reason: string;
  coins_awarded: number;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
  updated_at: string;
  course?: any;
}

export interface AcademyStudentBan {
  id: string;
  student_id: string;
  course_id: string;
  banned_by: string;
  reason: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyStudentId {
  id: string;
  student_id: string;
  student_id_number: string;
  created_at: string;
}

export interface AcademyAdmissionsApplication {
  id: string;
  student_id: string;
  first_choice_course_id: string | null;
  second_choice_course_id: string | null;
  third_choice_course_id: string | null;
  status: AdmissionsStatus;
  assigned_course_id: string | null;
  assigned_classroom_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  acceptance_letter_sent: boolean;
  denial_letter_sent: boolean;
  agreement_signed?: boolean;
  agreement_url?: string | null;
  loan_approved?: boolean;
  loan_bucket?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  first_choice_name?: string;
  second_choice_name?: string;
  third_choice_name?: string;
  assigned_course_name?: string;
  student_name?: string;
  student_username?: string;
}

export interface AcademyLearningPathway {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  badge_name: string | null;
  badge_icon: string | null;
  badge_color: string | null;
  courses: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademyGraduateBadge {
  id: string;
  student_id: string;
  badge_type: BadgeType;
  badge_name: string;
  badge_icon: string | null;
  badge_color: string | null;
  course_id: string | null;
  pathway_id: string | null;
  issued_at: string;
  created_at: string;
}

export interface AcademyTeacherRating {
  id: string;
  teacher_id: string;
  student_id: string;
  course_id: string;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  student_name?: string;
  student_avatar?: string;
}

export interface AcademyTeacherReference {
  id: string;
  teacher_id: string;
  student_id: string;
  course_id: string;
  reference_type: ReferenceType;
  category: ReferenceCategory | null;
  content: string;
  rating: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  teacher_name?: string;
  student_name?: string;
}

// Dashboard summary types
export interface StudentDashboardSummary {
  currentCourses: AcademyEnrollment[];
  gpa: number;
  totalCoinsEarned: number;
  coinsEarnedThisWeek: number;
  certificates: AcademyCertificate[];
  upcomingSessions: AcademySession[];
}

export interface TeacherDashboardSummary {
  courses: AcademyCourse[];
  totalStudents: number;
  totalGraduates: number;
  averageRating: number;
  pendingSubmissions: number;
}

export interface AcademyMetrics {
  totalStudents: number;
  activeStudents: number;
  graduatedStudents: number;
  studentsOnWaitlists: number;
  studentsAtRisk: number;
  averageGpa: number;
  averageAttendance: number;
  totalTeachers: number;
  activeTeachers: number;
  pendingApplications: number;
  suspendedTeachers: number;
  activeCourses: number;
  totalEnrollments: number;
  certificatesIssued: number;
  examsCompleted: number;
  assignmentsSubmitted: number;
  totalCoinsIssued: number;
  coinsIssuedToday: number;
  coinsIssuedThisWeek: number;
  coinsIssuedThisMonth: number;
}
