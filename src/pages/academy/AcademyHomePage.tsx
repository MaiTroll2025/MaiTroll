// ============================================================
// Mai Troll ACADEMY - MAIN HOMEPAGE
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  BookOpen,
  GraduationCap,
  Award,
  Coins,
  ChevronRight,
  Users,
  Clock,
  Star,
  Trophy,
  FileText,
  Shield,
  TrendingUp,
  Calendar,
  Bell,
} from 'lucide-react';
import { getPublishedCourses, getStudentEnrollments, getStudentCertificates, getStudentCoinRewards, getStudentIdNumber, getUpcomingSessions, getLearningPathways, getStudentBadges, calculateGPA } from '@/services/academyService';
import type { AcademyCourse, AcademyEnrollment, AcademyCertificate, AcademyCoinReward, AcademySession, AcademyLearningPathway, AcademyGraduateBadge } from '@/types/academy';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyHomePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [certificates, setCertificates] = useState<AcademyCertificate[]>([]);
  const [coinRewards, setCoinRewards] = useState<AcademyCoinReward[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<AcademySession[]>([]);
  const [pathways, setPathways] = useState<AcademyLearningPathway[]>([]);
  const [badges, setBadges] = useState<AcademyGraduateBadge[]>([]);
  const [gpa, setGpa] = useState<number>(0);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const [coursesData, enrollmentsData, certsData, rewardsData, idNumber, sessionsData, pathwaysData, badgesData, gpaData, teacherData] = await Promise.all([
          getPublishedCourses(),
          getStudentEnrollments(user.id),
          getStudentCertificates(user.id),
          getStudentCoinRewards(user.id),
          getStudentIdNumber(user.id),
          getUpcomingSessions(user.id),
          getLearningPathways(),
          getStudentBadges(user.id),
          calculateGPA(user.id),
          supabase.from('academy_teachers').select('id').eq('user_id', user.id).maybeSingle(),
        ]);
        setCourses(coursesData.slice(0, 8));
        setEnrollments(enrollmentsData);
        setCertificates(certsData);
        setCoinRewards(rewardsData);
        setStudentId(idNumber);
        setUpcomingSessions(sessionsData.slice(0, 5));
        setPathways(pathwaysData);
        setBadges(badgesData);
        setGpa(gpaData);
        setIsTeacher(!!teacherData.data);
      } catch (err) {
        console.error('Error fetching academy data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const totalCoinsEarned = coinRewards.reduce((sum, r) => sum + r.coins_awarded, 0);
  const thisWeekCoins = coinRewards
    .filter(r => new Date(r.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum, r) => sum + r.coins_awarded, 0);
  const currentEnrollments = enrollments.filter(e => e.status === 'accepted');
  const completedEnrollments = enrollments.filter(e => e.status === 'completed');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {/* Hero Header */}
      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Mai Troll Academy</h1>
              <p className="text-sm text-slate-400">
                {profile?.display_name || profile?.username || 'Student'}
                {studentId && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{studentId}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/academy/courses')} className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-black text-white transition hover:scale-[1.02]">
              <BookOpen className="h-3.5 w-3.5" /> Browse Courses
            </button>
            {!isTeacher && (
              <button onClick={() => navigate('/academy/teacher/apply')} className="flex items-center gap-1 rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 transition hover:bg-purple-500/20">
                <GraduationCap className="h-3.5 w-3.5" /> Become a Teacher
              </button>
            )}
            {isTeacher && (
              <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20">
                <Shield className="h-3.5 w-3.5" /> Teacher Dashboard
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <BookOpen className="mx-auto h-5 w-5 text-emerald-400" />
          <p className="mt-1 text-xl font-black text-white">{currentEnrollments.length}</p>
          <p className="text-[10px] text-slate-400">Current Courses</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Trophy className="mx-auto h-5 w-5 text-blue-400" />
          <p className="mt-1 text-xl font-black text-white">{completedEnrollments.length}</p>
          <p className="text-[10px] text-slate-400">Completed</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Star className="mx-auto h-5 w-5 text-yellow-400" />
          <p className="mt-1 text-xl font-black text-white">{gpa.toFixed(1)}</p>
          <p className="text-[10px] text-slate-400">GPA</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Award className="mx-auto h-5 w-5 text-purple-400" />
          <p className="mt-1 text-xl font-black text-white">{certificates.length}</p>
          <p className="text-[10px] text-slate-400">Certificates</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Coins className="mx-auto h-5 w-5 text-amber-400" />
          <p className="mt-1 text-xl font-black text-white">{totalCoinsEarned > 0 ? `${Math.floor(totalCoinsEarned / 1000)}K` : '0'}</p>
          <p className="text-[10px] text-slate-400">Coins Earned</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <TrendingUp className="mx-auto h-5 w-5 text-cyan-400" />
          <p className="mt-1 text-xl font-black text-white">{thisWeekCoins}</p>
          <p className="text-[10px] text-slate-400">This Week</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue Learning */}
        <div className="lg:col-span-2 space-y-6">
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
              <Clock className="h-5 w-5 text-cyan-400" /> Continue Learning
            </h2>
            {currentEnrollments.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-3 text-sm text-slate-400">You're not enrolled in any courses yet.</p>
                <button onClick={() => navigate('/academy/courses')} className="mt-3 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                  Browse available courses →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentEnrollments.slice(0, 4).map((enrollment) => (
                  <button
                    key={enrollment.id}
                    onClick={() => navigate(`/academy/course/${enrollment.course_slug || enrollment.course_id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/20 hover:bg-white/[0.08]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                      <BookOpen className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{enrollment.course_name || 'Course'}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/10">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${enrollment.progress_pct || 0}%` }} />
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-slate-400">{enrollment.progress_pct || 0}%</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Available Courses */}
          <section className={`${glass} rounded-2xl p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Users className="h-5 w-5 text-purple-400" /> Available Courses
              </h2>
              <button onClick={() => navigate('/academy/courses')} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
                View All →
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => navigate(`/academy/course/${course.slug}`)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/20 hover:bg-white/[0.08]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{course.category_icon || '📚'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{course.name}</p>
                      <p className="truncate text-[10px] text-slate-400">{course.teacher_name || 'TBA'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">{course.enrolled_count || 0}/{course.max_students} students</span>
                    <span className="font-bold text-amber-400">{course.enrollment_fee === 0 ? 'Free' : `${course.enrollment_fee.toLocaleString()} coins`}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Upcoming Classes */}
          {upcomingSessions.length > 0 && (
            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                <Calendar className="h-5 w-5 text-amber-400" /> Upcoming Classes
              </h2>
              <div className="space-y-2">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-500/10">
                      <span className="text-[10px] font-black text-amber-400">{new Date(session.session_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-sm font-black text-white">{new Date(session.session_date).getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{session.title}</p>
                      <p className="text-[10px] text-slate-400">{session.academy_courses?.name || 'Class'} • {session.start_time}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${session.status === 'live' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-400'}`}>
                      {session.status === 'live' ? '● LIVE' : session.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* My Grades */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
              <FileText className="h-4 w-4 text-blue-400" /> My Grades
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Current GPA</span>
                <span className="text-lg font-black text-white">{gpa.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Courses Completed</span>
                <span className="text-sm font-bold text-emerald-400">{completedEnrollments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Attendance Rate</span>
                <span className="text-sm font-bold text-cyan-400">--</span>
              </div>
              <button onClick={() => navigate('/academy/grades')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[10px] font-bold text-slate-300 transition hover:bg-white/[0.08]">
                View Full Gradebook →
              </button>
            </div>
          </section>

          {/* My Certificates */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
              <Award className="h-4 w-4 text-yellow-400" /> My Certificates
            </h2>
            {certificates.length === 0 ? (
              <p className="text-center text-xs text-slate-500">No certificates yet. Complete a course to earn one!</p>
            ) : (
              <div className="space-y-2">
                {certificates.slice(0, 3).map((cert) => (
                  <div key={cert.id} className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.05] p-2.5">
                    <p className="truncate text-xs font-bold text-white">{cert.course_name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400">{cert.final_grade} • {cert.final_percentage}%</span>
                      <span className="text-[9px] text-yellow-400">{new Date(cert.issued_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                <button onClick={() => navigate('/academy/certificates')} className="w-full text-center text-[10px] font-bold text-emerald-400 hover:text-emerald-300">
                  View All ({certificates.length}) →
                </button>
              </div>
            )}
          </section>

          {/* Troll Coin Earnings */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
              <Coins className="h-4 w-4 text-amber-400" /> Troll Coin Earnings
            </h2>
            <div className="space-y-2">
              <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                <p className="text-2xl font-black text-amber-400">{totalCoinsEarned.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">Total Academy Coins</p>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">This Week</span>
                <span className="font-bold text-emerald-400">+{thisWeekCoins}</span>
              </div>
              <button onClick={() => navigate('/academy/coins')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[10px] font-bold text-slate-300 transition hover:bg-white/[0.08]">
                View Reward History →
              </button>
            </div>
          </section>

          {/* Graduate Badges */}
          {badges.length > 0 && (
            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <Star className="h-4 w-4 text-purple-400" /> Graduate Badges
              </h2>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <div key={badge.id} className="rounded-lg border border-purple-400/20 bg-purple-500/10 px-2.5 py-1.5 text-center">
                    <span className="text-sm">{badge.badge_icon || '🎓'}</span>
                    <p className="text-[9px] font-bold text-purple-300">{badge.badge_name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Learning Pathways */}
          {pathways.length > 0 && (
            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <TrendingUp className="h-4 w-4 text-cyan-400" /> Learning Pathways
              </h2>
              <div className="space-y-2">
                {pathways.slice(0, 3).map((pathway) => (
                  <div key={pathway.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                    <p className="text-xs font-bold text-white">{pathway.name}</p>
                    <p className="text-[10px] text-slate-400">{pathway.courses.length} courses</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Links */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Bell className="h-4 w-4 text-slate-400" /> Quick Links
            </h2>
            <div className="space-y-1.5">
              <button onClick={() => navigate('/academy/transcript')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
                📄 Academic Transcript
              </button>
              <button onClick={() => navigate('/academy/admissions')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
                📝 Admissions Application
              </button>
              <button onClick={() => navigate('/academy/classroom')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
                🎒 My Classroom
              </button>
              <button onClick={() => navigate('/academy/verify')} className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]">
                🔍 Verify Certificate
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
