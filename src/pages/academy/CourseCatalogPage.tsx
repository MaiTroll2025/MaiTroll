// ============================================================
// Mai Troll ACADEMY - COURSE CATALOG
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  BookOpen,
  Search,
  Filter,
  Users,
  Clock,
  Coins,
  ChevronRight,
  GraduationCap,
  Star,
} from 'lucide-react';
import { getPublishedCourses, getCategories, getStudentAdmissionsApplication, enrollInCourse } from '@/services/academyService';
import type { AcademyCourse, AcademyCategory, AcademyAdmissionsApplication } from '@/types/academy';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function CourseCatalogPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [categories, setCategories] = useState<AcademyCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loanApplication, setLoanApplication] = useState<AcademyAdmissionsApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesData, categoriesData, studentLoan] = await Promise.all([
          getPublishedCourses(selectedCategory !== 'all' ? selectedCategory : undefined),
          getCategories(),
          user?.id ? getStudentAdmissionsApplication(user.id) : Promise.resolve(null),
        ]);
        setCourses(coursesData);
        setCategories(categoriesData);
        setLoanApplication(studentLoan);
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedCategory, user?.id]);

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEnroll = async (course: AcademyCourse) => {
    if (!profile?.id) {
      navigate('/auth');
      return;
    }
    const coinBalance = (profile as any)?.troll_coins || 0;
    const hasLoanApproval = loanApplication?.loan_approved === true;
    if (course.enrollment_fee > 0) {
      if (coinBalance < course.enrollment_fee && !hasLoanApproval) {
        toast.error(`Not enough Troll Coins. Need ${course.enrollment_fee.toLocaleString()}, have ${coinBalance.toLocaleString()}. Apply for an Academy loan to enroll.`);
        return;
      }
    }
    setEnrolling(course.id);
    try {
      const result = await enrollInCourse(profile.id, course.id, coinBalance);
      if (result.waitlisted) {
        toast.success('Added to waitlist! You\'ll be notified when a seat opens.');
      } else {
        toast.success(`Enrolled in ${course.name}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll');
    } finally {
      setEnrolling(null);
    }
  };

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug);
    if (slug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', slug);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {/* Header */}
      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Course Catalog</h1>
            <p className="text-sm text-slate-400">{courses.length} courses available</p>
          </div>
        </div>
      </section>

      {/* Search & Filter */}
      <section className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => handleCategoryChange(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#050710] px-3 py-2.5 text-sm text-white outline-none appearance-none focus:border-emerald-400/50"
            >
              <option className="bg-[#050710] text-slate-200" value="all">All Categories</option>
              {categories.map(cat => (
                <option className="bg-[#050710] text-slate-200" key={cat.slug} value={cat.slug}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${selectedCategory === 'all' ? 'bg-emerald-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${selectedCategory === cat.slug ? 'text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}
              style={selectedCategory === cat.slug ? { backgroundColor: cat.color } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Course Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <section className={`${glass} rounded-2xl p-12 text-center`}>
          <BookOpen className="mx-auto h-16 w-16 text-slate-600" />
          <h3 className="mt-4 text-lg font-black text-white">No Courses Found</h3>
          <p className="mt-2 text-sm text-slate-400">Try adjusting your search or filter.</p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div key={course.id} className={`${glass} rounded-2xl p-4 transition hover:border-emerald-400/20`}>
              {/* Course Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{course.category_icon || '📚'}</span>
                  <div>
                    <h3 className="text-sm font-black text-white">{course.name}</h3>
                    <p className="text-[10px] text-slate-400">{course.category_name}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  course.difficulty_level === 'beginner' ? 'bg-green-500/20 text-green-300' :
                  course.difficulty_level === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {course.difficulty_level}
                </span>
              </div>

              {/* Description */}
              {course.short_description && (
                <p className="mb-3 text-xs text-slate-400 line-clamp-2">{course.short_description}</p>
              )}

              {/* Teacher */}
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs text-slate-300">{course.teacher_name || 'TBA'}</span>
              </div>

              {/* Stats */}
              <div className="mb-3 flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {course.enrolled_count || 0}/{course.max_students}</span>
                {course.meeting_days?.length > 0 && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {course.meeting_days.join(', ')}</span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">
                  {course.enrollment_fee === 0 ? 'Free' : `${course.enrollment_fee.toLocaleString()} coins`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/academy/course/${course.slug}`)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => handleEnroll(course)}
                    disabled={enrolling === course.id}
                    className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:scale-[1.02] disabled:opacity-50"
                  >
                    {enrolling === course.id ? 'Enrolling...' : (course.enrolled_count || 0) >= course.max_students ? 'Waitlist' : 'Enroll'}
                  </button>
                </div>
              </div>
              {user && course.enrollment_fee > 0 && (profile as any)?.troll_coins < course.enrollment_fee && !loanApplication?.loan_approved && (course.enrolled_count || 0) < course.max_students && (
                <button
                  onClick={() => navigate(`/academy/admissions?loan=true&courseId=${course.id}`)}
                  className="mt-3 w-full rounded-xl border border-amber-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 transition hover:bg-amber-500/10"
                >
                  Apply for Academy Loan
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
