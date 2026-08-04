// ============================================================
// Mai Troll ACADEMY - COURSE DETAIL PAGE
// ============================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { buildOGImageUrl } from '@/lib/og';
import {
  BookOpen,
  GraduationCap,
  Users,
  Clock,
  Coins,
  Calendar,
  FileText,
  Award,
  ChevronLeft,
  Star,
  MessageSquare,
  Play,
} from 'lucide-react';
import { getCourseBySlug, getCourseSessions, getCourseAnnouncements, getCourseMaterials, getStudentAdmissionsApplication, enrollInCourse } from '@/services/academyService';
import type { AcademyCourse, AcademySession, AcademyAnnouncement, AcademyMaterial, AcademyAdmissionsApplication } from '@/types/academy';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [loanApplication, setLoanApplication] = useState<AcademyAdmissionsApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'announcements' | 'materials' | 'assignments' | 'discussions'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      try {
        const courseData = await getCourseBySlug(slug);
        if (!courseData) {
          navigate('/academy/courses');
          return;
        }
        setCourse(courseData);
        const [sessionsData, announcementsData, materialsData, studentLoan] = await Promise.all([
          getCourseSessions(courseData.id),
          getCourseAnnouncements(courseData.id),
          getCourseMaterials(courseData.id),
          user?.id ? getStudentAdmissionsApplication(user.id) : Promise.resolve(null),
        ]);
        setSessions(sessionsData);
        setAnnouncements(announcementsData);
        setMaterials(materialsData);
        setLoanApplication(studentLoan);
      } catch (err) {
        console.error('Error fetching course:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug, user?.id]);

  useEffect(() => {
    if (!course) return;

    const title = `${course.name} | Mai Troll Academy`;
    const description = course.short_description || course.description || 'Learn new skills with Mai Troll Academy.';
    const url = `${window.location.origin}/academy/course/${encodeURIComponent(course.slug || course.id)}`;
    const ogImageUrl = buildOGImageUrl({ kind: 'academy', slug: course.slug || course.id });

    const updateMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (el) {
        el.setAttribute(attr, value);
      } else {
        el = document.createElement('meta');
        const nameAttr = selector.includes('name=') ? 'name' : 'property';
        const match = selector.match(/"([^\"]+)"/);
        el.setAttribute(nameAttr, match?.[1] || '');
        el.setAttribute(attr, value);
        document.head.appendChild(el);
      }
    };

    document.title = title;
    updateMeta('meta[name="description"]', 'content', description);
    updateMeta('meta[property="og:title"]', 'content', title);
    updateMeta('meta[property="og:description"]', 'content', description);
    updateMeta('meta[property="og:url"]', 'content', url);
    updateMeta('meta[property="og:type"]', 'content', 'article');
    updateMeta('meta[property="og:image"]', 'content', ogImageUrl);
    updateMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    updateMeta('meta[name="twitter:title"]', 'content', title);
    updateMeta('meta[name="twitter:description"]', 'content', description);
    updateMeta('meta[name="twitter:image"]', 'content', ogImageUrl);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = url;
    } else {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.href = url;
      document.head.appendChild(canonical);
    }
  }, [course]);

  const handleEnroll = async () => {
if (!profile?.id || !course) return;
    const coinBalance = (profile as any)?.troll_coins || 0;
    const hasLoanApproval = loanApplication?.loan_approved === true;

    if (course.enrollment_fee > 0) {
      if (coinBalance < course.enrollment_fee && !hasLoanApproval) {
        toast.error(`Not enough Troll Coins. Need ${course.enrollment_fee.toLocaleString()}. Apply for an Academy loan to enroll.`);
        return;
      }
    }

    setEnrolling(true);
    try {
      const result = await enrollInCourse(profile.id, course.id, coinBalance);
      if (result.waitlisted) {
        toast.success('Added to waitlist!');
      } else {
        toast.success(`Enrolled in ${course.name}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
      </div>
    );
  }

  if (!course) return null;

  const isFull = (course.enrolled_count || 0) >= course.max_students;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      {/* Back Button */}
      <button onClick={() => navigate('/academy/courses')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Courses
      </button>

      {/* Course Header */}
      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-3xl">
              {course.category_icon || '📚'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{course.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  course.difficulty_level === 'beginner' ? 'bg-green-500/20 text-green-300' :
                  course.difficulty_level === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {course.difficulty_level}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{course.category_name} • {course.short_description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5 text-purple-400" /> {course.teacher_name || 'TBA'}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {course.enrolled_count || 0}/{course.max_students} students</span>
                {course.meeting_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {course.meeting_time}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-lg font-black text-amber-400">
              {course.enrollment_fee === 0 ? 'Free' : `${course.enrollment_fee.toLocaleString()} coins`}
            </span>
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:scale-[1.02] disabled:opacity-50"
            >
              {enrolling ? 'Enrolling...' : isFull ? 'Join Waitlist' : 'Enroll Now'}
            </button>
            {isFull && <span className="text-[10px] text-amber-400">Course is full — join the waitlist</span>}
            {course.enrollment_fee > 0 && (profile as any)?.troll_coins < course.enrollment_fee && !loanApplication?.loan_approved && !isFull && (
              <button
                onClick={() => navigate(`/academy/admissions?loan=true&courseId=${course.id}`)}
                className="mt-2 rounded-xl border border-amber-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-amber-300 transition hover:bg-amber-500/10"
              >
                Apply for Loan
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {(['overview', 'sessions', 'announcements', 'materials', 'assignments', 'discussions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === tab ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-3 text-sm font-black text-white">About This Course</h2>
              <p className="text-sm leading-relaxed text-slate-300">{course.description || 'No description available.'}</p>
            </section>

            {course.meeting_days?.length > 0 && (
              <section className={`${glass} rounded-2xl p-5`}>
                <h2 className="mb-3 text-sm font-black text-white">Schedule</h2>
                <div className="flex flex-wrap gap-2">
                  {course.meeting_days.map(day => (
                    <span key={day} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-300">{day}</span>
                  ))}
                </div>
                {course.meeting_time && <p className="mt-2 text-xs text-slate-400">Time: {course.meeting_time} ({course.timezone})</p>}
                {course.start_date && <p className="text-xs text-slate-400">Starts: {new Date(course.start_date).toLocaleDateString()}</p>}
                {course.end_date && <p className="text-xs text-slate-400">Ends: {new Date(course.end_date).toLocaleDateString()}</p>}
              </section>
            )}
          </div>

          <div className="space-y-4">
            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-3 text-sm font-black text-white">Requirements</h2>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2"><Star className="h-3 w-3 text-amber-400" /> Minimum {course.minimum_attendance_pct}% attendance</li>
                <li className="flex items-center gap-2"><FileText className="h-3 w-3 text-blue-400" /> Complete all assignments</li>
                <li className="flex items-center gap-2"><Award className="h-3 w-3 text-purple-400" /> Pass final exam</li>
              </ul>
            </section>

            <section className={`${glass} rounded-2xl p-5`}>
              <h2 className="mb-3 text-sm font-black text-white">Rewards</h2>
              <div className="space-y-2 text-xs text-slate-400">
                <p>🎯 Quiz Passed: <span className="font-bold text-amber-400">+10 coins</span></p>
                <p>📝 Exam Passed: <span className="font-bold text-amber-400">+50 coins</span></p>
                <p>⭐ Perfect Score: <span className="font-bold text-amber-400">+100 coins</span></p>
                <p>🎓 Course Complete: <span className="font-bold text-amber-400">+250 coins</span></p>
                <p>📜 Certificate: <span className="font-bold text-amber-400">+500 coins</span></p>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Class Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No sessions scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, i) => (
                <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-500/10">
                    <span className="text-[9px] font-bold text-emerald-400">Session</span>
                    <span className="text-sm font-black text-white">{i + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">{session.title}</p>
                    <p className="text-[10px] text-slate-400">{new Date(session.session_date).toLocaleDateString()} • {session.start_time} - {session.end_time}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    session.status === 'live' ? 'bg-red-500/20 text-red-300' :
                    session.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                    'bg-white/10 text-slate-400'
                  }`}>
                    {session.status === 'live' ? '● LIVE' : session.status}
                  </span>
                  {session.status === 'live' && (
                    <button className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-1 text-[9px] font-bold text-red-300">
                      <Play className="h-3 w-3" /> Join
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'announcements' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className={`rounded-xl border p-3 ${a.is_pinned ? 'border-amber-400/30 bg-amber-400/[0.05]' : 'border-white/10 bg-white/[0.04]'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">{a.title}</h3>
                    {a.is_pinned && <span className="text-[9px] font-bold text-amber-400">📌 PINNED</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{a.content}</p>
                  <p className="mt-2 text-[9px] text-slate-500">{a.author_name} • {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'materials' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Course Materials</h2>
          {materials.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No materials available yet.</p>
          ) : (
            <div className="space-y-2">
              {materials.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <FileText className="h-4 w-4 shrink-0 text-blue-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{m.title}</p>
                    <p className="text-[10px] text-slate-400">{m.material_type.toUpperCase()}{m.is_oer ? ' • OER' : ''}{m.source ? ` • ${m.source}` : ''}</p>
                  </div>
                  {m.external_url && (
                    <a href={m.external_url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[9px] font-bold text-emerald-400">
                      Open →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {activeTab === 'assignments' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-white">Assignments</h2>
            <button onClick={() => navigate(`/academy/course/${slug}/assignments`)} className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-[10px] font-bold text-purple-300">View All</button>
          </div>
          <CourseAssignments courseId={course?.id} />
        </section>
      )}

      {activeTab === 'discussions' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-white">Discussions</h2>
            <button onClick={() => navigate(`/academy/course/${slug}/communication`)} className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-300">Open Forum</button>
          </div>
          <p className="text-xs text-slate-400">Join the conversation with your teacher and classmates.</p>
        </section>
      )}
    </div>
  );
}

function CourseAssignments({ courseId }: { courseId?: string }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetch = async () => {
      if (!courseId) { setLoading(false); return; }
      const { data } = await supabase.from('academy_assignments').select('*').eq('course_id', courseId).eq('is_published', true).order('due_date', { ascending: true }).limit(5);
      setAssignments(data || []);
      setLoading(false);
    };
    fetch();
  }, [courseId]);
  if (loading) return <p className="text-center text-xs text-slate-500 py-4">Loading...</p>;
  if (assignments.length === 0) return <p className="text-center text-xs text-slate-500 py-6">No assignments yet.</p>;
  return (
    <div className="space-y-2">
      {assignments.map(a => (
        <div key={a.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3">
          <div>
            <p className="text-xs font-bold text-white">{a.title}</p>
            <p className="text-[9px] text-slate-500">{a.assignment_type} • {a.max_points} pts{a.due_date ? ` • Due ${new Date(a.due_date).toLocaleDateString()}` : ''}</p>
          </div>
          <button onClick={() => navigate(`/academy/course/${courseId}/assignments`)} className="rounded-lg bg-purple-500/20 px-2 py-1 text-[8px] font-bold text-purple-300">View</button>
        </div>
      ))}
    </div>
  );
}
