// ============================================================
// Mai Troll ACADEMY - BOARD OF EDUCATION ADMIN DASHBOARD
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  Users, BookOpen, Award, Coins, Star, TrendingUp, FileText, Shield,
  ChevronRight, ChevronDown, CheckCircle, XCircle, AlertTriangle,
  BarChart3, GraduationCap, DollarSign, UserPlus, UserX, Clock,
  Search, Plus, Edit3, Trash2, Settings, Mail, Eye,
} from 'lucide-react';
import { getAcademyMetrics, getTeacherApplications, getAdmissionsApplications, reviewTeacherApplication, getApprovedTeachers, getPublishedCourses } from '@/services/academyService';
import type { AcademyMetrics, AcademyTeacherApplication, AcademyAdmissionsApplication, AcademyTeacher, AcademyCourse } from '@/types/academy';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<AcademyMetrics | null>(null);
  const [pendingTeachers, setPendingTeachers] = useState<AcademyTeacherApplication[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<AcademyAdmissionsApplication[]>([]);
  const [allTeachers, setAllTeachers] = useState<AcademyTeacher[]>([]);
  const [allCourses, setAllCourses] = useState<AcademyCourse[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'admissions' | 'courses' | 'coins'>('overview');
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsData, teachersData, admissionsData, allTeachersData, allCoursesData] = await Promise.all([
          getAcademyMetrics(),
          getTeacherApplications('pending'),
          getAdmissionsApplications('pending_review'),
          getApprovedTeachers(),
          getPublishedCourses(),
        ]);
        setMetrics(metricsData);
        setPendingTeachers(teachersData);
        setPendingAdmissions(admissionsData);
        setAllTeachers(allTeachersData);
        setAllCourses(allCoursesData);
      } catch (err) {
        console.error('Error fetching admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleApproveTeacher = async (appId: string) => {
    try {
      await reviewTeacherApplication(appId, 'approved', 'Approved by Board of Education', user?.id || '');
      toast.success('Teacher approved!');
      setPendingTeachers(prev => prev.filter(a => a.id !== appId));
    } catch { toast.error('Failed to approve'); }
  };

  const handleDenyTeacher = async (appId: string) => {
    try {
      await reviewTeacherApplication(appId, 'denied', 'Denied by Board of Education', user?.id || '');
      toast.success('Application denied');
      setPendingTeachers(prev => prev.filter(a => a.id !== appId));
    } catch { toast.error('Failed to deny'); }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {/* Header */}
      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600"><Shield className="h-6 w-6 text-white" /></div>
          <div><h1 className="text-2xl font-black text-white">Board of Education</h1><p className="text-sm text-slate-400">Academy Administration Dashboard</p></div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {(['overview', 'teachers', 'admissions', 'courses', 'coins'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === tab ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'}`}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-4">
          {/* Student Stats - Clickable */}
          <section className={`${glass} rounded-2xl p-5`}>
            <button onClick={() => toggleSection('students')} className="flex w-full items-center justify-between mb-2">
              <h2 className="text-sm font-black text-white">Student Statistics</h2>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expandedSection === 'students' ? 'rotate-180' : ''}`} />
            </button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('students')}>
                <Users className="mx-auto h-5 w-5 text-blue-400" /><p className="mt-1 text-lg font-black text-white">{metrics.totalStudents}</p><p className="text-[10px] text-slate-400">Total Students</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('students')}>
                <TrendingUp className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-lg font-black text-white">{metrics.activeStudents}</p><p className="text-[10px] text-slate-400">Active Students</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('students')}>
                <Award className="mx-auto h-5 w-5 text-purple-400" /><p className="mt-1 text-lg font-black text-white">{metrics.graduatedStudents}</p><p className="text-[10px] text-slate-400">Graduated</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('students')}>
                <BarChart3 className="mx-auto h-5 w-5 text-cyan-400" /><p className="mt-1 text-lg font-black text-white">{metrics.averageGpa.toFixed(1)}</p><p className="text-[10px] text-slate-400">Average GPA</p>
              </div>
            </div>
            {expandedSection === 'students' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Students on Waitlists</span><span className="font-bold text-white">{metrics.studentsOnWaitlists}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Students At Risk</span><span className="font-bold text-red-400">{metrics.studentsAtRisk}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Average Attendance</span><span className="font-bold text-white">{metrics.averageAttendance}%</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Total Enrollments</span><span className="font-bold text-white">{metrics.totalEnrollments}</span></div>
              </div>
            )}
          </section>

          {/* Teacher Stats - Clickable */}
          <section className={`${glass} rounded-2xl p-5`}>
            <button onClick={() => toggleSection('teachers')} className="flex w-full items-center justify-between mb-2">
              <h2 className="text-sm font-black text-white">Teacher Statistics</h2>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expandedSection === 'teachers' ? 'rotate-180' : ''}`} />
            </button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('teachers')}>
                <Users className="mx-auto h-5 w-5 text-amber-400" /><p className="mt-1 text-lg font-black text-white">{metrics.totalTeachers}</p><p className="text-[10px] text-slate-400">Total Teachers</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('teachers')}>
                <CheckCircle className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-lg font-black text-white">{metrics.activeTeachers}</p><p className="text-[10px] text-slate-400">Active Teachers</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('teachers')}>
                <AlertTriangle className="mx-auto h-5 w-5 text-yellow-400" /><p className="mt-1 text-lg font-black text-white">{metrics.pendingApplications}</p><p className="text-[10px] text-slate-400">Pending Apps</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('teachers')}>
                <Star className="mx-auto h-5 w-5 text-purple-400" /><p className="mt-1 text-lg font-black text-white">{metrics.suspendedTeachers}</p><p className="text-[10px] text-slate-400">Suspended</p>
              </div>
            </div>
            {expandedSection === 'teachers' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Certificates Issued</span><span className="font-bold text-white">{metrics.certificatesIssued}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Exams Completed</span><span className="font-bold text-white">{metrics.examsCompleted}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Assignments Submitted</span><span className="font-bold text-white">{metrics.assignmentsSubmitted}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Attendance Rate</span><span className="font-bold text-white">{metrics.averageAttendance}%</span></div>
              </div>
            )}
          </section>

          {/* Academy Stats - Clickable */}
          <section className={`${glass} rounded-2xl p-5`}>
            <button onClick={() => toggleSection('academy')} className="flex w-full items-center justify-between mb-2">
              <h2 className="text-sm font-black text-white">Academy Statistics</h2>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expandedSection === 'academy' ? 'rotate-180' : ''}`} />
            </button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('academy')}>
                <BookOpen className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-lg font-black text-white">{metrics.activeCourses}</p><p className="text-[10px] text-slate-400">Active Courses</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('academy')}>
                <FileText className="mx-auto h-5 w-5 text-blue-400" /><p className="mt-1 text-lg font-black text-white">{metrics.totalEnrollments}</p><p className="text-[10px] text-slate-400">Total Enrollments</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('academy')}>
                <Award className="mx-auto h-5 w-5 text-yellow-400" /><p className="mt-1 text-lg font-black text-white">{metrics.certificatesIssued}</p><p className="text-[10px] text-slate-400">Certificates</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center cursor-pointer hover:bg-white/[0.08] transition" onClick={() => toggleSection('academy')}>
                <Coins className="mx-auto h-5 w-5 text-amber-400" /><p className="mt-1 text-lg font-black text-white">{metrics.totalCoinsIssued}</p><p className="text-[10px] text-slate-400">Coins Issued</p>
              </div>
            </div>
            {expandedSection === 'academy' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Coins Issued Today</span><span className="font-bold text-white">{metrics.coinsIssuedToday}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Coins This Week</span><span className="font-bold text-white">{metrics.coinsIssuedThisWeek}</span></div>
                <div className="flex items-center justify-between text-xs"><span className="text-slate-400">Coins This Month</span><span className="font-bold text-white">{metrics.coinsIssuedThisMonth}</span></div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===== TEACHERS TAB ===== */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Pending Applications */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 text-sm font-black text-white">Pending Teacher Applications ({pendingTeachers.length})</h2>
            {pendingTeachers.length === 0 ? <p className="text-center text-sm text-slate-500">No pending applications.</p> : (
              <div className="space-y-3">
                {pendingTeachers.map(app => (
                  <div key={app.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between">
                      <div><p className="text-sm font-bold text-white">{app.full_name}</p><p className="text-xs text-slate-400">{app.email}</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveTeacher(app.id)} className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-300"><CheckCircle className="h-3 w-3" /> Approve</button>
                        <button onClick={() => handleDenyTeacher(app.id)} className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-bold text-red-300"><XCircle className="h-3 w-3" /> Deny</button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">{app.teaching_subjects.map(s => <span key={s} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">{s}</span>)}</div>
                    {app.qualifications && <p className="mt-2 text-xs text-slate-400"><strong>Qualifications:</strong> {app.qualifications}</p>}
                    {app.experience && <p className="mt-1 text-xs text-slate-400"><strong>Experience:</strong> {app.experience}</p>}
                    {app.motivation && <p className="mt-1 text-xs text-slate-400"><strong>Motivation:</strong> {app.motivation}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* All Teachers */}
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-4 text-sm font-black text-white">All Teachers ({allTeachers.length})</h2>
            {allTeachers.length === 0 ? <p className="text-center text-sm text-slate-500">No teachers yet.</p> : (
              <div className="space-y-2">
                {allTeachers.map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-black text-amber-300">{(t.display_name || t.username || 'T')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{t.display_name || t.username}</p><p className="text-[10px] text-slate-400">{t.teacher_id} • {t.total_students} students • Rating: {t.average_rating.toFixed(1)}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${t.is_active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===== ADMISSIONS TAB ===== */}
      {activeTab === 'admissions' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Pending Admissions ({pendingAdmissions.length})</h2>
          {pendingAdmissions.length === 0 ? <p className="text-center text-sm text-slate-500">No pending admissions.</p> : (
            <div className="space-y-3">
              {pendingAdmissions.map(app => (
                <div key={app.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-bold text-white">{app.student_name} ({app.student_username})</p>
                  <div className="mt-1 text-xs text-slate-400"><p>1st: {app.first_choice_name || 'N/A'}</p><p>2nd: {app.second_choice_name || 'N/A'}</p><p>3rd: {app.third_choice_name || 'N/A'}</p></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== COURSES TAB ===== */}
      {activeTab === 'courses' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">All Courses ({allCourses.length})</h2>
          {allCourses.length === 0 ? <p className="text-center text-sm text-slate-500">No courses yet.</p> : (
            <div className="space-y-2">
              {allCourses.map(course => (
                <div key={course.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <BookOpen className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{course.name}</p><p className="text-[10px] text-slate-400">{course.teacher_name || 'TBA'} • {course.status} • {course.enrolled_count || 0}/{course.max_students} students</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${course.status === 'published' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{course.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== COINS TAB ===== */}
      {activeTab === 'coins' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Coin Reward Statistics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><Coins className="mx-auto h-5 w-5 text-amber-400" /><p className="mt-1 text-lg font-black text-white">{metrics?.totalCoinsIssued || 0}</p><p className="text-[10px] text-slate-400">Total Awarded</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><DollarSign className="mx-auto h-5 w-5 text-green-400" /><p className="mt-1 text-lg font-black text-white">{metrics?.coinsIssuedToday || 0}</p><p className="text-[10px] text-slate-400">Today</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><TrendingUp className="mx-auto h-5 w-5 text-blue-400" /><p className="mt-1 text-lg font-black text-white">{metrics?.coinsIssuedThisWeek || 0}</p><p className="text-[10px] text-slate-400">This Week</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><BarChart3 className="mx-auto h-5 w-5 text-purple-400" /><p className="mt-1 text-lg font-black text-white">{metrics?.coinsIssuedThisMonth || 0}</p><p className="text-[10px] text-slate-400">This Month</p></div>
          </div>
        </section>
      )}
    </div>
  );
}
