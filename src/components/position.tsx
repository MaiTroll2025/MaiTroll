// ============================================================
// Mai Troll ACADEMY - DATABASE SERVICE
// ============================================================

import { supabase } from '@/lib/supabase';
import { addCoins } from '@/lib/coinTransactions';
import type {
  AcademyCategory,
  AcademyTeacher,
  AcademyTeacherApplication,
  AcademyCourse,
  AcademyClassroom,
  AcademyEnrollment,
  AcademyWaitlist,
  AcademySession,
  AcademyAttendance,
  AcademyAssignment,
  AcademySubmission,
  AcademyQuiz,
  AcademyQuizQuestion,
  AcademyQuizAttempt,
  AcademyGrade,
  AcademyCertificate,
  AcademyMaterial,
  AcademyAnnouncement,
  AcademyNote,
  AcademyCoinReward,
  AcademyStudentId,
  AcademyAdmissionsApplication,
  AcademyLearningPathway,
  AcademyGraduateBadge,
  AcademyTeacherRating,
  AcademyTeacherReference,
  AcademyMetrics,
  EnrollmentStatus,
  TeacherApplicationStatus,
  AdmissionsStatus,
  CourseStatus,
} from '@/types/academy';

// ============================================================
// CATEGORIES
// ============================================================
export const getCategories = async (): Promise<AcademyCategory[]> => {
  const { data, error } = await supabase
    .from('academy_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

// ============================================================
// TEACHERS
// ============================================================
export const getApprovedTeachers = async (): Promise<AcademyTeacher[]> => {
  const { data, error } = await supabase
    .from('academy_teachers')
    .select('*, teacher_user:user_profiles!academy_teachers_user_id_fkey(username, display_name, avatar_url)')
    .eq('is_approved', true)
    .eq('is_active', true);
  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    username: t.teacher_user?.username,
    display_name: t.teacher_user?.display_name,
    avatar_url: t.teacher_user?.avatar_url,
  }));
};

export const getTeacherByUserId = async (userId: string): Promise<AcademyTeacher | null> => {
  const { data, error } = await supabase
    .from('academy_teachers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const applyForTeacher = async (application: Partial<AcademyTeacherApplication>): Promise<AcademyTeacherApplication> => {
  const { data, error } = await supabase
    .from('academy_teacher_applications')
    .insert(application)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getTeacherApplications = async (status?: TeacherApplicationStatus): Promise<AcademyTeacherApplication[]> => {
  let query = supabase
    .from('academy_teacher_applications')
    .select('*, applicant:user_profiles!academy_teacher_applications_user_id_fkey(username, display_name, avatar_url)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    username: a.applicant?.username,
    display_name: a.applicant?.display_name,
  }));
};

export const reviewTeacherApplication = async (
  applicationId: string,
  status: TeacherApplicationStatus,
  reviewNotes: string,
  reviewerId: string
): Promise<void> => {
  const { error } = await supabase
    .from('academy_teacher_applications')
    .update({
      status,
      review_notes: reviewNotes,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);
  if (error) throw error;

  // If approved, create teacher record
  if (status === 'approved') {
    const { data: app } = await supabase
      .from('academy_teacher_applications')
      .select('user_id')
      .eq('id', applicationId)
      .single();
    if (app) {
      await supabase
        .from('academy_teachers')
        .insert({
          user_id: app.user_id,
          teacher_id: `TCH-${new Date().getFullYear()}-${Date.now()}`,
          is_approved: true,
          approved_by: reviewerId,
          approved_at: new Date().toISOString(),
        });
    }
  }
};

// ============================================================
// COURSES
// ============================================================
export const getPublishedCourses = async (categorySlug?: string): Promise<AcademyCourse[]> => {
  let query = supabase
    .from('academy_courses')
    .select(`
      *,
      academy_teachers(teacher_id, teacher_user:user_profiles!academy_teachers_user_id_fkey(username, display_name, avatar_url)),
      academy_categories(name, icon, color)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (categorySlug) {
    const { data: cat } = await supabase
      .from('academy_categories')
      .select('id')
      .eq('slug', categorySlug)
      .maybeSingle();
    if (cat) query = query.eq('category_id', cat.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((c: any) => ({
    ...c,
    teacher_name: c.academy_teachers?.teacher_user?.display_name || c.academy_teachers?.teacher_user?.username,
    teacher_avatar: c.academy_teachers?.teacher_user?.avatar_url,
    category_name: c.academy_categories?.name,
    category_icon: c.academy_categories?.icon,
    category_color: c.academy_categories?.color,
  }));
};

export const getCourseBySlug = async (slug: string): Promise<AcademyCourse | null> => {
  const { data, error } = await supabase
    .from('academy_courses')
    .select(`
      *,
      academy_teachers(teacher_id, teacher_user:user_profiles!academy_teachers_user_id_fkey(username, display_name, avatar_url)),
      academy_categories(name, icon, color)
    `)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    teacher_name: data.academy_teachers?.teacher_user?.display_name || data.academy_teachers?.teacher_user?.username,
    teacher_avatar: data.academy_teachers?.teacher_user?.avatar_url,
    category_name: data.academy_categories?.name,
    category_icon: data.academy_categories?.icon,
    category_color: data.academy_categories?.color,
  };
};

export const getTeacherCourses = async (teacherId: string): Promise<AcademyCourse[]> => {
  const { data, error } = await supabase
    .from('academy_courses')
    .select(`
      *,
      academy_categories(name, icon, color)
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createCourse = async (course: Partial<AcademyCourse>): Promise<AcademyCourse> => {
  const preparedCourse = {
    ...course,
    category_id: course.category_id?.trim() ? course.category_id : null,
  };

  const { data, error } = await supabase
    .from('academy_courses')
    .insert(preparedCourse)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCourse = async (courseId: string, updates: Partial<AcademyCourse>): Promise<void> => {
  const preparedUpdates = {
    ...updates,
    category_id: updates.category_id?.trim() ? updates.category_id : null,
  };

  const { error } = await supabase
    .from('academy_courses')
    .update(preparedUpdates)
    .eq('id', courseId);
  if (error) throw error;
};

// ============================================================
// ENROLLMENTS
// ============================================================
export const getStudentEnrollments = async (studentId: string): Promise<AcademyEnrollment[]> => {
  const { data, error } = await supabase
    .from('academy_enrollments')
    .select(`
      *,
      course:academy_courses(slug, name, thumbnail_url, teacher:academy_teachers(teacher_user:user_profiles!academy_teachers_user_id_fkey(display_name, username)))
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((e: any) => ({
    ...e,
    course_name: e.course?.name,
    course_slug: e.course?.slug,
    teacher_name: e.course?.teacher?.teacher_user?.display_name,
  }));
};

export const getCourseClassroomByCourseId = async (courseId: string): Promise<AcademyClassroom | null> => {
  const { data, error } = await supabase
    .from('academy_classrooms')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getCourseEnrollments = async (courseId: string): Promise<AcademyEnrollment[]> => {
  const { data, error } = await supabase
    .from('academy_enrollments')
    .select(`
      *,
      user_profiles(username, display_name, avatar_url)
    `)
    .eq('course_id', courseId)
    .eq('status', 'accepted');
  if (error) throw error;
  return data || [];
};

export const enrollInCourse = async (
  studentId: string,
  courseId: string,
  studentCoinBalance = 0
): Promise<{ enrollment: AcademyEnrollment | null; waitlisted: boolean }> => {
  // Check course capacity and pricing
  const { data: course } = await supabase
    .from('academy_courses')
    .select('max_students, enrollment_fee, currency_type, teacher_id')
    .eq('id', courseId)
    .single();

  if (!course) throw new Error('Course not found');

  const { data: teacher } = await supabase
    .from('academy_teachers')
    .select('user_id')
    .eq('id', course.teacher_id)
    .maybeSingle();

  const teacherUserId = teacher?.user_id;
  if (!teacherUserId) throw new Error('Teacher payout account not found');

  const { data: ongoingEnrollments } = await supabase
    .from('academy_enrollments')
    .select('id', { count: 'exact' })
    .eq('student_id', studentId)
    .eq('status', 'accepted');

  const activeEnrollments = ongoingEnrollments?.length || 0;
  if (activeEnrollments > 0) {
    throw new Error('You may only enroll in one Academy course at a time.');
  }

  const { data: admissions } = await supabase
    .from('academy_admissions_applications')
    .select('status, loan_approved')
    .eq('student_id', studentId)
    .eq('status', 'accepted')
    .maybeSingle();

  const hasLoanApproval = admissions?.loan_approved === true;
  const enoughCoins = studentCoinBalance >= course.enrollment_fee;
  const requiresCoinPayment = course.currency_type === 'troll_coins' && course.enrollment_fee > 0;
  if (requiresCoinPayment && !enoughCoins && !hasLoanApproval) {
    throw new Error('You must have enough Troll Coins or an approved Academy loan to enroll.');
  }

  const { data: enrolledCount } = await supabase
    .from('academy_enrollments')
    .select('id', { count: 'exact' })
    .eq('course_id', courseId)
    .eq('status', 'accepted');

  const currentCount = enrolledCount?.length || 0;
  if (currentCount >= course.max_students) {
    const { data: waitlistCount } = await supabase
      .from('academy_waitlists')
      .select('id', { count: 'exact' })
      .eq('course_id', courseId)
      .eq('status', 'waiting');

    const position = (waitlistCount?.length || 0) + 1;

    await supabase.from('academy_waitlists').insert({
      student_id: studentId,
      course_id: courseId,
      waitlist_position: position,
    });

    const { data: enrollment } = await supabase
      .from('academy_enrollments')
      .insert({
        student_id: studentId,
        course_id: courseId,
        status: 'waitlisted',
        coins_paid: 0,
        loan_balance: 0,
        weekly_due: 0,
      })
      .select()
      .single();

    return { enrollment, waitlisted: true };
  }

  const loanEnrollment = requiresCoinPayment && !enoughCoins && hasLoanApproval;
  const insertPayload: Record<string, any> = {
    student_id: studentId,
    course_id: courseId,
    status: 'accepted',
    coins_paid: loanEnrollment ? 0 : course.enrollment_fee,
    loan_balance: loanEnrollment ? course.enrollment_fee : 0,
    weekly_due: course.enrollment_fee,
    access_paused: false,
  };

  const { data: enrollment, error } = await supabase
    .from('academy_enrollments')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;

  const teacherCreditResult = await addCoins({
    userId: teacherUserId,
    amount: course.enrollment_fee,
    type: 'academy_course',
    description: `Enrollment payout for ${courseId}`,
    metadata: {
      studentId,
      courseId,
      loan: loanEnrollment,
    },
  });

  if (!teacherCreditResult.success) {
    await supabase.from('academy_enrollments').delete().eq('id', enrollment.id);
    throw new Error(teacherCreditResult.error || 'Failed to credit teacher for course enrollment.');
  }

  return { enrollment, waitlisted: false };
};

export const updateEnrollmentStatus = async (
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<void> => {
  const { error } = await supabase
    .from('academy_enrollments')
    .update({ status })
    .eq('id', enrollmentId);
  if (error) throw error;
};

// ============================================================
// STUDENT ID
// ============================================================
export const getStudentIdNumber = async (studentId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('academy_student_ids')
    .select('student_id_number')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data?.student_id_number || null;
};

// ============================================================
// SESSIONS
// ============================================================
export const getCourseSessions = async (courseId: string): Promise<AcademySession[]> => {
  const { data, error } = await supabase
    .from('academy_sessions')
    .select('*')
    .eq('course_id', courseId)
    .order('session_date')
    .order('start_time');
  if (error) throw error;
  return data || [];
};

export const getUpcomingSessions = async (studentId: string): Promise<AcademySession[]> => {
  const { data: enrollments } = await supabase
    .from('academy_enrollments')
    .select('course_id')
    .eq('student_id', studentId)
    .eq('status', 'accepted');

  if (!enrollments?.length) return [];

  const courseIds = enrollments.map(e => e.course_id);
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('academy_sessions')
    .select('*, academy_courses(name)')
    .in('course_id', courseIds)
    .gte('session_date', today)
    .order('session_date')
    .limit(10);
  if (error) throw error;
  return data || [];
};

// ============================================================
// ATTENDANCE
// ============================================================
export const markAttendance = async (
  sessionId: string,
  studentId: string,
  courseId: string,
  status: 'present' | 'late' | 'absent' | 'excused'
): Promise<void> => {
  const { error } = await supabase
    .from('academy_attendance')
    .upsert({
      session_id: sessionId,
      student_id: studentId,
      course_id: courseId,
      status,
      check_in_time: new Date().toISOString(),
    });
  if (error) throw error;
};

export const getStudentAttendance = async (studentId: string, courseId: string): Promise<AcademyAttendance[]> => {
  const { data, error } = await supabase
    .from('academy_attendance')
    .select('*')
    .eq('student_id', studentId)
    .eq('course_id', courseId);
  if (error) throw error;
  return data || [];
};

export const getAttendancePercentage = async (studentId: string, courseId: string): Promise<number> => {
  const records = await getStudentAttendance(studentId, courseId);
  if (!records.length) return 100;
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  return Math.round((present / records.length) * 100);
};

// ============================================================
// ASSIGNMENTS
// ============================================================
export const getCourseAssignments = async (courseId: string): Promise<AcademyAssignment[]> => {
  const { data, error } = await supabase
    .from('academy_assignments')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

export const createAssignment = async (assignment: Partial<AcademyAssignment>): Promise<AcademyAssignment> => {
  const { data, error } = await supabase
    .from('academy_assignments')
    .insert(assignment)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const submitAssignment = async (submission: Partial<AcademySubmission>): Promise<AcademySubmission> => {
  const { data, error } = await supabase
    .from('academy_submissions')
    .insert(submission)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getAssignmentSubmissions = async (assignmentId: string): Promise<AcademySubmission[]> => {
  const { data, error } = await supabase
    .from('academy_submissions')
    .select('*, user_profiles(username, display_name, avatar_url)')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    ...s,
    student_name: s.user_profiles?.display_name || s.user_profiles?.username,
    student_avatar: s.user_profiles?.avatar_url,
  }));
};

export const gradeSubmission = async (
  submissionId: string,
  score: number,
  feedback: string,
  gradedBy: string
): Promise<void> => {
  const { error } = await supabase
    .from('academy_submissions')
    .update({
      score,
      feedback,
      graded_by: gradedBy,
      graded_at: new Date().toISOString(),
      status: 'graded',
    })
    .eq('id', submissionId);
  if (error) throw error;
};

// ============================================================
// QUIZZES
// ============================================================
export const getCourseQuizzes = async (courseId: string): Promise<AcademyQuiz[]> => {
  const { data, error } = await supabase
    .from('academy_quizzes')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

export const getQuizQuestions = async (quizId: string): Promise<AcademyQuizQuestion[]> => {
  const { data, error } = await supabase
    .from('academy_quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

export const submitQuizAttempt = async (attempt: Partial<AcademyQuizAttempt>): Promise<AcademyQuizAttempt> => {
  const { data, error } = await supabase
    .from('academy_quiz_attempts')
    .insert(attempt)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getStudentQuizAttempts = async (studentId: string, quizId: string): Promise<AcademyQuizAttempt[]> => {
  const { data, error } = await supabase
    .from('academy_quiz_attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ============================================================
// GRADES
// ============================================================
export const getStudentGrades = async (studentId: string, courseId: string): Promise<AcademyGrade[]> => {
  const { data, error } = await supabase
    .from('academy_grades')
    .select('*')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .order('created_at');
  if (error) throw error;
  return data || [];
};

export const calculateGPA = async (studentId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('academy_enrollments')
    .select('final_percentage')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .not('final_percentage', 'is', null);
  if (error) throw error;
  if (!data?.length) return 0;
  const total = data.reduce((sum, e) => sum + (e.final_percentage || 0), 0);
  return Math.round((total / data.length) * 100) / 100;
};

// ============================================================
// CERTIFICATES
// ============================================================
export const getStudentCertificates = async (studentId: string): Promise<AcademyCertificate[]> => {
  const { data, error } = await supabase
    .from('academy_certificates')
    .select(`
      *,
      academy_courses(name),
      student_profile:user_profiles!academy_certificates_student_id_fkey(username, display_name),
      academy_teachers(teacher_user:user_profiles!academy_teachers_user_id_fkey(display_name))
    `)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    ...c,
    course_name: c.academy_courses?.name,
    student_name: c.student_profile?.display_name,
    student_username: c.student_profile?.username,
    teacher_name: c.academy_teachers?.teacher_user?.display_name,
  }));
};

export const verifyCertificate = async (certificateNumber: string): Promise<AcademyCertificate | null> => {
  const { data, error } = await supabase
    .from('academy_certificates')
    .select(`
      *,
      academy_courses(name),
      student_profile:user_profiles!academy_certificates_student_id_fkey(username, display_name),
      academy_teachers(teacher_user:user_profiles!academy_teachers_user_id_fkey(display_name))
    `)
    .eq('certificate_number', certificateNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    course_name: data.academy_courses?.name,
    student_name: data.student_profile?.display_name,
    student_username: data.student_profile?.username,
    teacher_name: data.academy_teachers?.teacher_user?.display_name,
  };
};

export const verifyCertificateById = async (verificationId: string): Promise<AcademyCertificate | null> => {
  const { data, error } = await supabase
    .from('academy_certificates')
    .select(`
      *,
      academy_courses(name),
      student_profile:user_profiles!academy_certificates_student_id_fkey(username, display_name),
      academy_teachers(teacher_user:user_profiles!academy_teachers_user_id_fkey(display_name))
    `)
    .eq('verification_id', verificationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    course_name: data.academy_courses?.name,
    student_name: data.student_profile?.display_name,
    student_username: data.student_profile?.username,
    teacher_name: data.academy_teachers?.teacher_user?.display_name,
  };
};

// ============================================================
// COIN REWARDS
// ============================================================
export const awardAcademyCoins = async (
  studentId: string,
  courseId: string | null,
  rewardType: string,
  reason: string,
  coins: number,
  referenceId?: string,
  referenceType?: string
): Promise<boolean> => {
  // Check for duplicate rewards
  if (referenceId && referenceType) {
    const { data: existing } = await supabase
      .from('academy_coin_rewards')
      .select('id')
      .eq('student_id', studentId)
      .eq('reference_id', referenceId)
      .eq('reference_type', referenceType)
      .eq('reward_type', rewardType)
      .maybeSingle();

    if (existing) return false; // Duplicate, don't award
  }

  // Record the reward
  await supabase.from('academy_coin_rewards').insert({
    student_id: studentId,
    course_id: courseId,
    reward_type: rewardType,
    reward_reason: reason,
    coins_awarded: coins,
    reference_id: referenceId,
    reference_type: referenceType,
  });

  // Update user's coin balance
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('troll_coins')
    .eq('id', studentId)
    .single();

  if (profile) {
    await supabase
      .from('user_profiles')
      .update({
        troll_coins: (profile.troll_coins || 0) + coins,
      })
      .eq('id', studentId);
  }

  // Log coin transaction
  await supabase.from('coin_transactions').insert({
    user_id: studentId,
    type: 'reward',
    direction: 'IN',
    amount: coins,
    description: `Academy: ${reason}`,
    metadata: { academy_reward_type: rewardType, course_id: courseId },
  });

  return true;
};

export const getStudentCoinRewards = async (studentId: string): Promise<AcademyCoinReward[]> => {
  const { data, error } = await supabase
    .from('academy_coin_rewards')
    .select('*, course:academy_courses(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ============================================================
// MATERIALS
// ============================================================
export const getCourseMaterials = async (courseId: string): Promise<AcademyMaterial[]> => {
  const { data, error } = await supabase
    .from('academy_materials')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

// ============================================================
// ANNOUNCEMENTS
// ============================================================
export const getCourseAnnouncements = async (courseId: string): Promise<AcademyAnnouncement[]> => {
  const { data, error } = await supabase
    .from('academy_announcements')
    .select('*, user_profiles(username, display_name, avatar_url)')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    author_name: a.user_profiles?.display_name || a.user_profiles?.username,
    author_avatar: a.user_profiles?.avatar_url,
  }));
};

// ============================================================
// LEARNING PATHWAYS
// ============================================================
export const getLearningPathways = async (): Promise<AcademyLearningPathway[]> => {
  const { data, error } = await supabase
    .from('academy_learning_pathways')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

// ============================================================
// GRADUATE BADGES
// ============================================================
export const getStudentBadges = async (studentId: string): Promise<AcademyGraduateBadge[]> => {
  const { data, error } = await supabase
    .from('academy_graduate_badges')
    .select('*, pathway:academy_learning_pathways(name, badge_name, badge_icon, badge_color)')
    .eq('student_id', studentId)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ============================================================
// ADMISSIONS
// ============================================================
export const submitAdmissionsApplication = async (
  application: Partial<AcademyAdmissionsApplication>
): Promise<AcademyAdmissionsApplication> => {
  const preparedApplication = {
    ...application,
    second_choice_course_id: application.second_choice_course_id?.trim() ? application.second_choice_course_id : null,
    third_choice_course_id: application.third_choice_course_id?.trim() ? application.third_choice_course_id : null,
    status: application.status || 'pending_review',
    agreement_signed: application.agreement_signed ?? false,
    agreement_url: application.agreement_url ?? null,
    loan_approved: application.loan_approved ?? false,
    loan_bucket: application.loan_bucket ?? null,
  };

  const { data, error } = await supabase
    .from('academy_admissions_applications')
    .insert(preparedApplication)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAdmissionsApplicationAgreementUrl = async (applicationId: string, agreementUrl: string): Promise<void> => {
  const { error } = await supabase
    .from('academy_admissions_applications')
    .update({ agreement_url: agreementUrl })
    .eq('id', applicationId);
  if (error) throw error;
};

export const uploadLoanApplicationPdf = async (
  studentId: string,
  applicationId: string,
  pdfBlob: Blob
): Promise<string | null> => {
  const filePath = `academy-loan-applications/${studentId}/${applicationId}.pdf`;
  const buckets = ['troll-city-assets', 'verification_docs'];

  for (const bucket of buckets) {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, pdfBlob, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      continue;
    }

    const { data: urlData } = await supabase.storage.from(bucket).getPublicUrl(filePath);
    if (urlData?.publicUrl) {
      return urlData.publicUrl;
    }
  }

  return null;
};

export const getStudentAdmissionsApplication = async (studentId: string): Promise<AcademyAdmissionsApplication | null> => {
  const { data, error } = await supabase
    .from('academy_admissions_applications')
    .select(`
      *,
      first_choice:academy_courses!academy_admissions_applications_first_choice_course_id_fkey(name),
      second_choice:academy_courses!academy_admissions_applications_second_choice_course_id_fkey(name),
      third_choice:academy_courses!academy_admissions_applications_third_choice_course_id_fkey(name),
      assigned_course:academy_courses!academy_admissions_applications_assigned_course_id_fkey(name)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    first_choice_name: data.first_choice?.name,
    second_choice_name: data.second_choice?.name,
    third_choice_name: data.third_choice?.name,
    assigned_course_name: data.assigned_course?.name,
  };
};

export const getAdmissionsApplications = async (status?: AdmissionsStatus): Promise<AcademyAdmissionsApplication[]> => {
  let query = supabase
    .from('academy_admissions_applications')
    .select(`
      *,
      student:user_profiles!academy_admissions_applications_student_id_fkey(username, display_name),
      first_choice:academy_courses!academy_admissions_applications_first_choice_course_id_fkey(name),
      second_choice:academy_courses!academy_admissions_applications_second_choice_course_id_fkey(name),
      third_choice:academy_courses!academy_admissions_applications_third_choice_course_id_fkey(name),
      assigned_course:academy_courses!academy_admissions_applications_assigned_course_id_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    student_name: a.student?.display_name,
    student_username: a.student?.username,
    first_choice_name: a.first_choice?.name,
    second_choice_name: a.second_choice?.name,
    third_choice_name: a.third_choice?.name,
    assigned_course_name: a.assigned_course?.name,
  }));
};

export const reviewAdmissionsApplication = async (
  applicationId: string,
  status: AdmissionsStatus,
  reviewerId: string,
  reviewNotes?: string,
  assignedCourseId?: string,
  assignedClassroomId?: string,
  loanApproved?: boolean
): Promise<void> => {
  const updates: Record<string, any> = {
    status,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: reviewNotes,
    assigned_course_id: assignedCourseId,
    assigned_classroom_id: assignedClassroomId,
  };

  if (status === 'accepted') {
    updates.loan_approved = true;
    updates.loan_bucket = 'academy_loan';
  } else if (typeof loanApproved === 'boolean') {
    updates.loan_approved = loanApproved;
    if (loanApproved) {
      updates.loan_bucket = 'academy_loan';
    }
  }

  const { error } = await supabase
    .from('academy_admissions_applications')
    .update(updates)
    .eq('id', applicationId);
  if (error) throw error;

  // Log the action
  await supabase.from('academy_admissions_log').insert({
    officer_id: reviewerId,
    action: `Application ${status}`,
    details: reviewNotes,
  });
};

// ============================================================
// ADMIN METRICS
// ============================================================
export const getAcademyMetrics = async (): Promise<AcademyMetrics> => {
  const [
    { count: totalStudents },
    { count: activeStudents },
    { count: graduatedStudents },
    { count: waitlistedStudents },
    { count: totalTeachers },
    { count: activeTeachers },
    { count: pendingApps },
    { count: activeCourses },
    { count: totalEnrollments },
    { count: certificatesIssued },
    { count: totalCoins },
  ] = await Promise.all([
    supabase.from('academy_student_ids').select('id', { count: 'exact', head: true }),
    supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
    supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('academy_waitlists').select('id', { count: 'exact', head: true }).eq('status', 'waiting'),
    supabase.from('academy_teachers').select('id', { count: 'exact', head: true }),
    supabase.from('academy_teachers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_approved', true),
    supabase.from('academy_teacher_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('academy_courses').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }),
    supabase.from('academy_certificates').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('academy_coin_rewards').select('coins_awarded', { count: 'exact', head: true }),
  ]);

  return {
    totalStudents: totalStudents || 0,
    activeStudents: activeStudents || 0,
    graduatedStudents: graduatedStudents || 0,
    studentsOnWaitlists: waitlistedStudents || 0,
    studentsAtRisk: 0,
    averageGpa: 0,
    averageAttendance: 0,
    totalTeachers: totalTeachers || 0,
    activeTeachers: activeTeachers || 0,
    pendingApplications: pendingApps || 0,
    suspendedTeachers: 0,
    activeCourses: activeCourses || 0,
    totalEnrollments: totalEnrollments || 0,
    certificatesIssued: certificatesIssued || 0,
    examsCompleted: 0,
    assignmentsSubmitted: 0,
    totalCoinsIssued: totalCoins || 0,
    coinsIssuedToday: 0,
    coinsIssuedThisWeek: 0,
    coinsIssuedThisMonth: 0,
  };
};

// ============================================================
// TEACHER RATINGS
// ============================================================
export const rateTeacher = async (
  teacherId: string,
  studentId: string,
  courseId: string,
  rating: number,
  review?: string
): Promise<void> => {
  const { error } = await supabase
    .from('academy_teacher_ratings')
    .upsert({
      teacher_id: teacherId,
      student_id: studentId,
      course_id: courseId,
      rating,
      review,
    });
  if (error) throw error;
};

export const getTeacherRatings = async (teacherId: string): Promise<AcademyTeacherRating[]> => {
  const { data, error } = await supabase
    .from('academy_teacher_ratings')
    .select('*, rater:user_profiles!academy_teacher_ratings_student_id_fkey(username, display_name, avatar_url)')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    student_name: r.rater?.display_name || r.rater?.username,
    student_avatar: r.rater?.avatar_url,
  }));
};
