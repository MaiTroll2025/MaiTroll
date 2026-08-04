import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getStudentEnrollments, getStudentCertificates, calculateGPA, getStudentBadges } from '@/services/academyService';
import type { AcademyEnrollment, AcademyCertificate, AcademyGraduateBadge } from '@/types/academy';
import {
  ChevronLeft, FileText, Award, Star, Download, Printer, GraduationCap,
  BookOpen, TrendingUp, CheckCircle,
} from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function TranscriptPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [certificates, setCertificates] = useState<AcademyCertificate[]>([]);
  const [badges, setBadges] = useState<AcademyGraduateBadge[]>([]);
  const [gpa, setGpa] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        const [enrollmentsData, certsData, badgesData, gpaData] = await Promise.all([
          getStudentEnrollments(user.id),
          getStudentCertificates(user.id),
          getStudentBadges(user.id),
          calculateGPA(user.id),
        ]);
        setEnrollments(enrollmentsData);
        setCertificates(certsData);
        setBadges(badgesData);
        setGpa(gpaData);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user?.id]);

  const completedCourses = enrollments.filter(e => e.status === 'completed');
  const totalCredits = completedCourses.length * 3;
  const academicStanding = gpa >= 3.5 ? 'Honors' : gpa >= 3.0 ? 'Good Standing' : gpa >= 2.0 ? 'Probation' : 'At Risk';

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/academy')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Academy
        </button>
        <button onClick={handlePrint} className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.1]">
          <Printer className="h-3 w-3" /> Print Transcript
        </button>
      </div>

      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Official Academic Transcript</h1>
            <p className="text-sm text-slate-400">{profile?.display_name || profile?.username} • Mai Troll Academy</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <Star className="mx-auto h-5 w-5 text-yellow-400" />
          <p className="mt-1 text-xl font-black text-white">{gpa.toFixed(2)}</p>
          <p className="text-[9px] text-slate-400">Cumulative GPA</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <BookOpen className="mx-auto h-5 w-5 text-blue-400" />
          <p className="mt-1 text-xl font-black text-white">{completedCourses.length}</p>
          <p className="text-[9px] text-slate-400">Courses Completed</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <Award className="mx-auto h-5 w-5 text-purple-400" />
          <p className="mt-1 text-xl font-black text-white">{certificates.length}</p>
          <p className="text-[9px] text-slate-400">Certificates</p>
        </div>
        <div className={`${glass} rounded-xl p-4 text-center`}>
          <TrendingUp className="mx-auto h-5 w-5 text-emerald-400" />
          <p className="mt-1 text-xl font-black text-white">{totalCredits}</p>
          <p className="text-[9px] text-slate-400">Credits Earned</p>
        </div>
      </div>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-white">Academic Standing</h2>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${academicStanding === 'Honors' ? 'bg-yellow-500/20 text-yellow-300' : academicStanding === 'Good Standing' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
            {academicStanding}
          </span>
        </div>
      </section>

      <section className={`${glass} rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-black text-white">Course History</h2>
        {enrollments.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-6">No courses on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 text-left text-slate-400">Course</th>
                  <th className="p-2 text-left text-slate-400">Status</th>
                  <th className="p-2 text-left text-slate-400">Grade</th>
                  <th className="p-2 text-left text-slate-400">%</th>
                  <th className="p-2 text-left text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(e => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="p-2 font-bold text-white">{e.course_name || 'Course'}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${e.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : e.status === 'accepted' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-slate-400'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="p-2 font-bold text-white">{e.final_grade || '—'}</td>
                    <td className="p-2 text-slate-300">{e.final_percentage !== null ? `${e.final_percentage}%` : '—'}</td>
                    <td className="p-2 text-slate-500">{e.completion_date ? new Date(e.completion_date).toLocaleDateString() : e.enrollment_date ? new Date(e.enrollment_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {certificates.length > 0 && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Certificates Earned</h2>
          <div className="space-y-2">
            {certificates.map(cert => (
              <div key={cert.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{cert.course_name}</p>
                    <p className="text-[9px] text-slate-500">{cert.certificate_number} • {cert.final_grade} ({cert.final_percentage}%)</p>
                  </div>
                </div>
                <span className="text-[9px] text-slate-500">{new Date(cert.issued_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {badges.length > 0 && (
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 text-sm font-black text-white">Graduate Badges</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map(badge => (
              <div key={badge.id} className="rounded-xl border border-purple-400/20 bg-purple-500/10 p-3 text-center">
                <span className="text-2xl">{badge.badge_icon || '🎓'}</span>
                <p className="mt-1 text-[10px] font-bold text-purple-300">{badge.badge_name}</p>
                <p className="text-[8px] text-slate-500">{new Date(badge.issued_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
