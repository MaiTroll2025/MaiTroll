// ============================================================
// Mai Troll ACADEMY - HOMEPAGE TAB WIDGET
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  BookOpen,
  GraduationCap,
  Award,
  Coins,
  ChevronRight,
  Users,
  Clock,
  Star,
} from 'lucide-react';
import { getPublishedCourses, getStudentEnrollments, getStudentCertificates, getStudentCoinRewards } from '@/services/academyService';
import type { AcademyCourse, AcademyEnrollment, AcademyCertificate, AcademyCoinReward } from '@/types/academy';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyTab() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [certificates, setCertificates] = useState<AcademyCertificate[]>([]);
  const [coinRewards, setCoinRewards] = useState<AcademyCoinReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const [coursesData, enrollmentsData, certsData, rewardsData] = await Promise.all([
          getPublishedCourses(),
          getStudentEnrollments(user.id),
          getStudentCertificates(user.id),
          getStudentCoinRewards(user.id),
        ]);
        setCourses(coursesData.slice(0, 6));
        setEnrollments(enrollmentsData.filter(e => e.status === 'accepted').slice(0, 3));
        setCertificates(certsData.slice(0, 3));
        setCoinRewards(rewardsData);
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
    .filter(r => {
      const d = new Date(r.created_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    })
    .reduce((sum, r) => sum + r.coins_awarded, 0);

  if (loading) {
    return (
      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Mai Troll Academy</h2>
              <p className="text-xs text-slate-400">Learn. Earn. Graduate.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/academy')}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:scale-[1.02]"
          >
            Enter Academy
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <BookOpen className="mx-auto h-5 w-5 text-emerald-400" />
          <p className="mt-1 text-lg font-black text-white">{enrollments.length}</p>
          <p className="text-[10px] text-slate-400">Enrolled</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Award className="mx-auto h-5 w-5 text-yellow-400" />
          <p className="mt-1 text-lg font-black text-white">{certificates.length}</p>
          <p className="text-[10px] text-slate-400">Certificates</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Coins className="mx-auto h-5 w-5 text-amber-400" />
          <p className="mt-1 text-lg font-black text-white">{totalCoinsEarned > 0 ? `${Math.floor(totalCoinsEarned / 1000)}K` : '0'}</p>
          <p className="text-[10px] text-slate-400">Coins Earned</p>
        </div>
        <div className={`${glass} rounded-xl p-3 text-center`}>
          <Star className="mx-auto h-5 w-5 text-purple-400" />
          <p className="mt-1 text-lg font-black text-white">{thisWeekCoins}</p>
          <p className="text-[10px] text-slate-400">This Week</p>
        </div>
      </div>

      {/* Continue Learning */}
      {enrollments.length > 0 && (
        <section className={`${glass} rounded-2xl p-4`}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
            <Clock className="h-4 w-4 text-cyan-400" />
            Continue Learning
          </h3>
          <div className="space-y-2">
            {enrollments.map((enrollment) => (
              <button
                key={enrollment.id}
                onClick={() => navigate(`/academy/course/${enrollment.course_slug || enrollment.course_id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <BookOpen className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{enrollment.course_name || 'Course'}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${enrollment.progress_pct || 0}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-slate-400">
                  {enrollment.progress_pct || 0}%
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Featured Courses */}
      {courses.length > 0 && (
        <section className={`${glass} rounded-2xl p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              <Users className="h-4 w-4 text-purple-400" />
              Available Courses
            </h3>
            <button
              onClick={() => navigate('/academy/courses')}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => navigate(`/academy/course/${course.slug}`)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.08]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{course.category_icon || '📚'}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{course.name}</p>
                    <p className="truncate text-[10px] text-slate-400">{course.teacher_name || 'TBA'}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">
                    {course.enrolled_count || 0}/{course.max_students} students
                  </span>
                  <span className="font-bold text-amber-400">
                    {course.enrollment_fee === 0 ? 'Free' : `${course.enrollment_fee.toLocaleString()} coins`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {enrollments.length === 0 && courses.length === 0 && (
        <section className={`${glass} rounded-2xl p-8 text-center`}>
          <GraduationCap className="mx-auto h-16 w-16 text-emerald-400/50" />
          <h3 className="mt-4 text-lg font-black text-white">Welcome to Mai Troll Academy</h3>
          <p className="mt-2 text-sm text-slate-400">
            Browse courses, enroll, and start learning. Earn Troll Coins as you progress!
          </p>
          <button
            onClick={() => navigate('/academy/courses')}
            className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:scale-[1.02]"
          >
            Browse Courses
          </button>
        </section>
      )}

      {/* Become a Teacher CTA */}
      <section className={`${glass} rounded-2xl p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Become a Teacher</p>
              <p className="text-[10px] text-slate-400">Share your knowledge and earn rewards</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/academy/teacher/apply')}
            className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-1.5 text-[10px] font-bold text-purple-300 transition hover:bg-purple-500/20"
          >
            Apply Now
          </button>
        </div>
      </section>
    </div>
  );
}
