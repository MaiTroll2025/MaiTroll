// ============================================================
// Mai Troll ACADEMY - FULL TEACHER DASHBOARD
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  BookOpen, Users, Star, Award, Plus, ChevronRight, ChevronDown, GraduationCap,
  Calendar, FileText, ClipboardList, Clock, TrendingUp, UserPlus, Settings,
  MessageSquare, CheckCircle, AlertCircle, Eye, Edit3, Trash2, Save, X,
  Loader2, Search, Filter, Download, Bell, BarChart3, UserCheck, UserX,
  DollarSign,
} from 'lucide-react';
import { getTeacherByUserId, getTeacherCourses, getCourseEnrollments, getAssignmentSubmissions } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse, AcademyEnrollment, AcademySubmission, AcademySession } from '@/types/academy';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';
type DashboardTab = 'overview' | 'courses' | 'students' | 'assignments' | 'gradebook' | 'calendar' | 'settings';

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [submissions, setSubmissions] = useState<AcademySubmission[]>([]);
  const [sessions, setSessions] = useState<AcademySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [savingGrade, setSavingGrade] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sessionForm, setSessionForm] = useState({ title: '', description: '', start_time: '09:00', end_time: '10:00' });
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const teacherData = await getTeacherByUserId(user.id);
      if (!teacherData) { setLoading(false); return; }
      setTeacher(teacherData);
      const coursesData = await getTeacherCourses(teacherData.id);
      setCourses(coursesData);
      const { data: sessionsData } = await supabase.from('academy_sessions').select('*').in('course_id', coursesData.map(c => c.id)).order('session_date').limit(20);
      setSessions(sessionsData || []);
      const allEnrollments: AcademyEnrollment[] = [];
      for (const course of coursesData) { allEnrollments.push(...await getCourseEnrollments(course.id)); }
      setEnrollments(allEnrollments);
      const allSubmissions: AcademySubmission[] = [];
      for (const course of coursesData) {
        const { data: courseAssignments } = await supabase.from('academy_assignments').select('id').eq('course_id', course.id);
        if (courseAssignments) { for (const a of courseAssignments) { allSubmissions.push(...await getAssignmentSubmissions(a.id)); } }
      }
      setSubmissions(allSubmissions);
    } catch (err) { console.error('Error fetching teacher data:', err); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveGrade = async (enrollmentId: string, grade: string) => {
    setSavingGrade(enrollmentId);
    try {
      await supabase.from('academy_grades').upsert({ student_id: enrollmentId, course_id: expandedCourse || '', grade_type: 'final', letter_grade: grade, score: grade === 'A' ? 95 : grade === 'B' ? 85 : grade === 'C' ? 75 : grade === 'D' ? 65 : 50, max_points: 100, percentage: grade === 'A' ? 95 : grade === 'B' ? 85 : grade === 'C' ? 75 : grade === 'D' ? 65 : 50 }, { onConflict: 'student_id,course_id,grade_type' });
      setGrades(prev => ({ ...prev, [enrollmentId]: grade }));
      toast.success('Grade saved');
    } catch { toast.error('Failed to save grade'); }
    setSavingGrade(null);
  };

  const handleSaveNote = async (studentId: string) => {
    setSavingNote(studentId);
    try { await supabase.from('academy_notes').upsert({ student_id: studentId, course_id: expandedCourse || '', content: notes[studentId] || '' }, { onConflict: 'student_id,course_id' }); toast.success('Note saved'); }
    catch { toast.error('Failed to save note'); }
    setSavingNote(null);
  };

  const handleCreateSession = async (courseId: string) => {
    if (!sessionForm.title.trim()) { toast.error('Session title required'); return; }
    setSavingSession(true);
    try { await supabase.from('academy_sessions').insert({ course_id: courseId, title: sessionForm.title, description: sessionForm.description, session_date: selectedDate, start_time: sessionForm.start_time, end_time: sessionForm.end_time, status: 'scheduled' }); toast.success('Session scheduled!'); setShowSessionForm(false); setSessionForm({ title: '', description: '', start_time: '09:00', end_time: '10:00' }); fetchData(); }
    catch { toast.error('Failed to create session'); }
    setSavingSession(false);
  };

  const handleDropStudent = async (enrollmentId: string) => {
    if (!confirm('Are you sure you want to drop this student?')) return;
    try { await supabase.from('academy_enrollments').update({ status: 'dropped' }).eq('id', enrollmentId); setEnrollments(prev => prev.filter(e => e.id !== enrollmentId)); toast.success('Student dropped'); }
    catch { toast.error('Failed to drop student'); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;

  if (!teacher) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <section className={`${glass} rounded-2xl p-8 text-center`}>
          <GraduationCap className="mx-auto h-16 w-16 text-amber-400/50" />
          <h2 className="mt-4 text-xl font-black text-white">Teacher Account Not Set Up</h2>
          <p className="mt-2 text-sm text-slate-400">Your teacher profile hasn't been created yet.</p>
          <button onClick={() => navigate('/academy/teacher/apply')} className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-black text-white">Apply to Become a Teacher</button>
        </section>
      </div>
    );
  }

  const totalStudents = enrollments.filter(e => e.status === 'accepted').length;
  const pendingStudents = enrollments.filter(e => e.status === 'pending').length;
  const pendingSubmissions = submissions.filter(s => s.status === 'submitted').length;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* Header */}
      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600"><GraduationCap className="h-6 w-6 text-white" /></div>
            <div><h1 className="text-xl font-black text-white">Teacher Dashboard</h1><p className="text-xs text-slate-400">{teacher.teacher_id} • {teacher.is_approved ? '✅ Approved' : '⏳ Pending'}</p></div>
          </div>
          <button onClick={() => navigate('/academy/teacher/course/new')} className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-black text-white"><Plus className="h-3.5 w-3.5" /> New Course</button>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className={`${glass} rounded-xl p-3 text-center`}><BookOpen className="mx-auto h-5 w-5 text-emerald-400" /><p className="mt-1 text-xl font-black text-white">{courses.length}</p><p className="text-[10px] text-slate-400">Courses</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><Users className="mx-auto h-5 w-5 text-blue-400" /><p className="mt-1 text-xl font-black text-white">{totalStudents}</p><p className="text-[10px] text-slate-400">Students</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><UserPlus className="mx-auto h-5 w-5 text-yellow-400" /><p className="mt-1 text-xl font-black text-white">{pendingStudents}</p><p className="text-[10px] text-slate-400">Pending</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><ClipboardList className="mx-auto h-5 w-5 text-purple-400" /><p className="mt-1 text-xl font-black text-white">{pendingSubmissions}</p><p className="text-[10px] text-slate-400">To Grade</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><Star className="mx-auto h-5 w-5 text-amber-400" /><p className="mt-1 text-xl font-black text-white">{teacher.average_rating.toFixed(1)}</p><p className="text-[10px] text-slate-400">Rating</p></div>
        <div className={`${glass} rounded-xl p-3 text-center`}><Award className="mx-auto h-5 w-5 text-cyan-400" /><p className="mt-1 text-xl font-black text-white">{teacher.total_certificates_issued}</p><p className="text-[10px] text-slate-400">Certificates</p></div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-2">
        {([
          { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { id: 'courses' as const, label: 'Courses', icon: BookOpen },
          { id: 'students' as const, label: 'Students', icon: Users },
          { id: 'assignments' as const, label: 'Assignments', icon: ClipboardList },
          { id: 'gradebook' as const, label: 'Gradebook', icon: FileText },
          { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
          { id: 'settings' as const, label: 'Settings', icon: Settings },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'}`}>
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 text-sm font-black text-white">Recent Activity</h2>
            {submissions.length === 0 ? <p className="text-center text-xs text-slate-500 py-6">No recent activity</p> : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {submissions.slice(0, 10).map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-2">
                    <ClipboardList className="h-4 w-4 shrink-0 text-purple-400" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{sub.student_name || 'Student'} submitted an assignment</p><p className="text-[9px] text-slate-500">{new Date(sub.submitted_at).toLocaleString()}</p></div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${sub.status === 'graded' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{sub.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 text-sm font-black text-white">Upcoming Sessions</h2>
            {sessions.length === 0 ? <p className="text-center text-xs text-slate-500 py-6">No upcoming sessions</p> : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sessions.slice(0, 10).map(session => (
                  <div key={session.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-2">
                    <Calendar className="h-4 w-4 shrink-0 text-cyan-400" />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{session.title}</p><p className="text-[9px] text-slate-500">{session.session_date} • {session.start_time}-{session.end_time}</p></div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${session.status === 'live' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-400'}`}>{session.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 text-sm font-black text-white">New Students</h2>
            {enrollments.length === 0 ? <p className="text-center text-xs text-slate-500 py-6">No students enrolled yet</p> : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {enrollments.filter(e => e.status === 'accepted').slice(0, 10).map(enrollment => (
                  <div key={enrollment.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-black text-blue-300">{(enrollment.student_name || 'S')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{enrollment.student_name || 'Student'}</p><p className="text-[9px] text-slate-500">{enrollment.course_name} • {new Date(enrollment.enrollment_date).toLocaleDateString()}</p></div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 text-sm font-black text-white">Course Performance</h2>
            {courses.length === 0 ? <p className="text-center text-xs text-slate-500 py-6">No courses yet</p> : (
              <div className="space-y-2">
                {courses.slice(0, 5).map(course => {
                  const ce = enrollments.filter(e => e.course_id === course.id && e.status === 'accepted');
                  return (
                    <button key={course.id} onClick={() => { setExpandedCourse(course.id); setActiveTab('students'); }} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]">
                      <BookOpen className="h-4 w-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{course.name}</p><p className="text-[9px] text-slate-500">{ce.length} students • {course.status}</p></div>
                      <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* COURSES TAB */}
      {activeTab === 'courses' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">My Courses ({courses.length})</h2>
            <button onClick={() => navigate('/academy/teacher/course/new')} className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-[10px] font-bold text-amber-300"><Plus className="h-3 w-3" /> New Course</button>
          </div>
          {courses.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center"><BookOpen className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No courses yet. Create your first course!</p></div>
          ) : (
            <div className="space-y-2">
              {courses.map(course => {
                const isExpanded = expandedCourse === course.id;
                const ce = enrollments.filter(e => e.course_id === course.id);
                return (
                  <div key={course.id} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <button onClick={() => setExpandedCourse(isExpanded ? null : course.id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/[0.03]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"><BookOpen className="h-5 w-5 text-amber-400" /></div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{course.name}</p><p className="text-[10px] text-slate-400">{course.status} • {ce.length} students • {course.difficulty_level}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/academy/teacher/course/${course.id}`); }} className="rounded-lg bg-white/[0.06] p-1.5 text-slate-400 hover:text-white"><Edit3 className="h-3.5 w-3.5" /></button>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/5 p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg bg-white/[0.04] p-2 text-center"><p className="text-lg font-black text-white">{ce.filter(e => e.status === 'accepted').length}</p><p className="text-[9px] text-slate-400">Active</p></div>
                          <div className="rounded-lg bg-white/[0.04] p-2 text-center"><p className="text-lg font-black text-white">{ce.filter(e => e.status === 'pending').length}</p><p className="text-[9px] text-slate-400">Pending</p></div>
                          <div className="rounded-lg bg-white/[0.04] p-2 text-center"><p className="text-lg font-black text-white">{ce.filter(e => e.status === 'completed').length}</p><p className="text-[9px] text-slate-400">Completed</p></div>
                          <div className="rounded-lg bg-white/[0.04] p-2 text-center"><p className="text-lg font-black text-white">{course.enrollment_fee === 0 ? 'Free' : `${course.enrollment_fee}`}</p><p className="text-[9px] text-slate-400">Fee</p></div>
                        </div>
                        {course.description && <p className="text-xs text-slate-400">{course.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => setActiveTab('students')} className="rounded-lg bg-blue-500/20 px-2 py-1 text-[9px] font-bold text-blue-300"><Users className="inline h-3 w-3 mr-1" />Students</button>
                          <button onClick={() => setActiveTab('assignments')} className="rounded-lg bg-purple-500/20 px-2 py-1 text-[9px] font-bold text-purple-300"><ClipboardList className="inline h-3 w-3 mr-1" />Assignments</button>
                          <button onClick={() => setActiveTab('gradebook')} className="rounded-lg bg-green-500/20 px-2 py-1 text-[9px] font-bold text-green-300"><FileText className="inline h-3 w-3 mr-1" />Gradebook</button>
                          <button onClick={() => setActiveTab('calendar')} className="rounded-lg bg-cyan-500/20 px-2 py-1 text-[9px] font-bold text-cyan-300"><Calendar className="inline h-3 w-3 mr-1" />Schedule</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">Students ({enrollments.length})</h2>
            <div className="relative"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.05] py-1.5 pl-7 pr-3 text-xs text-white outline-none" /></div>
          </div>
          {enrollments.length === 0 ? <p className="text-center text-xs text-slate-500 py-8">No students enrolled</p> : (
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {enrollments.filter(e => !searchQuery || e.student_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(enrollment => (
                <div key={enrollment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-sm font-black text-blue-300">{(enrollment.student_name || 'S')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{enrollment.student_name || 'Student'}</p><p className="text-[10px] text-slate-400">{enrollment.course_name} • {new Date(enrollment.enrollment_date).toLocaleDateString()}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${enrollment.status === 'accepted' ? 'bg-green-500/20 text-green-300' : enrollment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : enrollment.status === 'completed' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>{enrollment.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button onClick={() => handleDropStudent(enrollment.id)} className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-300 hover:bg-red-500/20"><UserX className="h-3 w-3" /> Drop Student</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ASSIGNMENTS TAB */}
      {activeTab === 'assignments' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Student Submissions ({submissions.length})</h2>
          {submissions.length === 0 ? <p className="text-center text-xs text-slate-500 py-8">No submissions yet</p> : (
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {submissions.map(sub => (
                <div key={sub.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-sm font-black text-purple-300">{(sub.student_name || 'S')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white">{sub.student_name || 'Student'}</p>
                      <p className="text-[10px] text-slate-400">Submitted {new Date(sub.submitted_at).toLocaleString()}</p>
                      {sub.content && <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">{sub.content}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.score !== null && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold text-green-300">{sub.score}/{sub.max_points}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sub.status === 'graded' ? 'bg-green-500/20 text-green-300' : sub.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 text-slate-400'}`}>{sub.status}</span>
                    </div>
                  </div>
                  {sub.status === 'submitted' && (
                    <div className="mt-2 flex items-center gap-2">
                      <input type="text" placeholder="Grade (A/B/C/D/F)..." onKeyDown={async (e) => { if (e.key === 'Enter') { const g = (e.target as HTMLInputElement).value.toUpperCase(); if (['A','B','C','D','F'].includes(g)) { const s = g === 'A' ? 95 : g === 'B' ? 85 : g === 'C' ? 75 : g === 'D' ? 65 : 50; await supabase.from('academy_submissions').update({ status: 'graded', score: s, max_points: 100, graded_by: user?.id, graded_at: new Date().toISOString() }).eq('id', sub.id); toast.success(`Graded ${g}`); fetchData(); } } }} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white outline-none w-32" />
                      <button onClick={async () => { await supabase.from('academy_submissions').update({ status: 'graded', score: 100, max_points: 100, graded_by: user?.id, graded_at: new Date().toISOString() }).eq('id', sub.id); toast.success('Graded 100%'); fetchData(); }} className="rounded-lg bg-green-500/20 px-2 py-1 text-[9px] font-bold text-green-300">Quick 100%</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* GRADEBOOK TAB */}
      {activeTab === 'gradebook' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-white">Gradebook</h2>
            {courses.length > 0 && (
              <select value={expandedCourse || ''} onChange={e => setExpandedCourse(e.target.value || null)} className="rounded-lg border border-white/10 bg-[#050710] px-3 py-1.5 text-xs text-white outline-none appearance-none">
                <option className="bg-[#050710] text-slate-200" value="">Select Course</option>
                {courses.map(c => <option className="bg-[#050710] text-slate-200" key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {!expandedCourse ? <p className="text-center text-xs text-slate-500 py-8">Select a course to view its gradebook</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/10"><th className="p-2 text-left text-slate-400">Student</th><th className="p-2 text-left text-slate-400">Status</th><th className="p-2 text-left text-slate-400">Grade</th><th className="p-2 text-left text-slate-400">Notes</th></tr></thead>
                <tbody>
                  {enrollments.filter(e => e.course_id === expandedCourse).map(enrollment => (
                    <tr key={enrollment.id} className="border-b border-white/5">
                      <td className="p-2 font-bold text-white">{enrollment.student_name || 'Student'}</td>
                      <td className="p-2"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${enrollment.status === 'accepted' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{enrollment.status}</span></td>
                      <td className="p-2">
                        <select value={grades[enrollment.id] || ''} onChange={e => handleSaveGrade(enrollment.id, e.target.value)} className="rounded border border-white/10 bg-[#050710] px-1 py-0.5 text-xs text-white appearance-none">
                          <option className="bg-[#050710] text-slate-200" value="">—</option><option className="bg-[#050710] text-slate-200" value="A">A</option><option className="bg-[#050710] text-slate-200" value="B">B</option><option className="bg-[#050710] text-slate-200" value="C">C</option><option className="bg-[#050710] text-slate-200" value="D">D</option><option className="bg-[#050710] text-slate-200" value="F">F</option>
                        </select>
                        {savingGrade === enrollment.id && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input type="text" placeholder="Notes..." value={notes[enrollment.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [enrollment.id]: e.target.value }))} className="rounded border border-white/10 bg-white/[0.05] px-1 py-0.5 text-[10px] text-white w-32" />
                          <button onClick={() => handleSaveNote(enrollment.id)} className="rounded bg-amber-500/20 p-1 text-amber-300">{savingNote === enrollment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* CALENDAR TAB */}
      {activeTab === 'calendar' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <section className={`${glass} rounded-2xl p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-black text-white">Class Calendar</h2>
                <button onClick={() => setShowSessionForm(!showSessionForm)} className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-[10px] font-bold text-amber-300"><Plus className="h-3 w-3" /> Schedule Session</button>
              </div>
              {showSessionForm && (
                <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-3 space-y-2">
                  <input type="text" placeholder="Session Title *" value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none" />
                  <input type="text" placeholder="Description" value={sessionForm.description} onChange={e => setSessionForm(p => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none" />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-xs text-white outline-none" />
                    <input type="time" value={sessionForm.start_time} onChange={e => setSessionForm(p => ({ ...p, start_time: e.target.value }))} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-xs text-white outline-none" />
                    <input type="time" value={sessionForm.end_time} onChange={e => setSessionForm(p => ({ ...p, end_time: e.target.value }))} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-xs text-white outline-none" />
                  </div>
                  <select value={expandedCourse || ''} onChange={e => setExpandedCourse(e.target.value || null)} className="w-full rounded-lg border border-white/10 bg-[#050710] px-3 py-2 text-xs text-white outline-none appearance-none">
                    <option className="bg-[#050710] text-slate-200" value="">Select Course</option>
                    {courses.map(c => <option className="bg-[#050710] text-slate-200" key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => expandedCourse && handleCreateSession(expandedCourse)} disabled={savingSession || !expandedCourse} className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{savingSession ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save</button>
                    <button onClick={() => setShowSessionForm(false)} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-400">Cancel</button>
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {sessions.length === 0 ? <p className="text-center text-xs text-slate-500 py-8">No sessions scheduled</p> : sessions.map(session => (
                  <div key={session.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-cyan-500/10"><span className="text-[9px] font-bold text-cyan-400">{new Date(session.session_date).toLocaleDateString('en-US', { month: 'short' })}</span><span className="text-sm font-black text-white">{new Date(session.session_date).getDate()}</span></div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white">{session.title}</p><p className="text-[10px] text-slate-400">{session.start_time} - {session.end_time}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold ${session.status === 'live' ? 'bg-red-500/20 text-red-300' : session.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-slate-400'}`}>{session.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className={`${glass} rounded-2xl p-5`}>
            <h2 className="mb-3 text-sm font-black text-white">Quick Schedule</h2>
            <div className="space-y-2">
              {courses.map(course => (
                <button key={course.id} onClick={() => { setExpandedCourse(course.id); setShowSessionForm(true); }} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]">
                  <BookOpen className="h-4 w-4 shrink-0 text-amber-400" /><span className="truncate text-xs font-bold text-white">{course.name}</span><Plus className="ml-auto h-3 w-3 shrink-0 text-slate-500" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Teacher Settings</h2>
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-bold text-slate-300">Bio</label><textarea rows={3} value={teacher.bio || ''} onChange={e => setTeacher(prev => prev ? { ...prev, bio: e.target.value } : prev)} placeholder="Tell students about yourself..." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
            <div><label className="mb-1 block text-xs font-bold text-slate-300">Specialties</label><input type="text" value={(teacher.specialties || []).join(', ')} onChange={e => setTeacher(prev => prev ? { ...prev, specialties: e.target.value.split(',').map(s => s.trim()) } : prev)} placeholder="e.g., Welding, Automotive" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
            <button onClick={async () => { try { await supabase.from('academy_teachers').update({ bio: teacher.bio, specialties: teacher.specialties }).eq('id', teacher.id); toast.success('Profile updated!'); } catch { toast.error('Failed to update'); } }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-black text-white"><Save className="h-4 w-4" /> Save Profile</button>
          </div>
        </section>
      )}
    </div>
  );
}
