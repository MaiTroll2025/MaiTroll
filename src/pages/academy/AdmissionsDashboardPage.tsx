import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase, UserRole } from '@/lib/supabase';
import {
  getPublishedCourses,
  getAdmissionsApplications,
  submitAdmissionsApplication,
  reviewAdmissionsApplication,
  uploadLoanApplicationPdf,
  updateAdmissionsApplicationAgreementUrl,
} from '@/services/academyService';
import { downloadLoanApplicationPDF } from '@/lib/loanApplicationPDF';
import type { AcademyAdmissionsApplication, AcademyCourse, AdmissionsStatus } from '@/types/academy';
import { Award, BookOpen, Shield, Users, CheckCircle, XCircle, MessageSquare, ChevronRight, DownloadCloud } from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AdmissionsDashboardPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [pendingApplications, setPendingApplications] = useState<AcademyAdmissionsApplication[]>([]);
  const [studentApplication, setStudentApplication] = useState<AcademyAdmissionsApplication | null>(null);
  const [firstChoice, setFirstChoice] = useState('');
  const [secondChoice, setSecondChoice] = useState('');
  const [thirdChoice, setThirdChoice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [loanAgreementAccepted, setLoanAgreementAccepted] = useState(false);
  const [searchParams] = useSearchParams();
  const loanRequestedCourseId = searchParams.get('courseId') || '';
  const isLoanRequest = searchParams.get('loan') === 'true';

  const isAdmissionsStaff =
    profile?.role === UserRole.ADMISSIONS_OFFICER ||
    profile?.role === 'admissions_officer' ||
    profile?.troll_role === 'admissions_officer' ||
    (profile as any)?.is_admissions_officer ||
    profile?.role === UserRole.ADMIN ||
    profile?.is_admin;

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) return;
      setIsLoading(true);
      try {
        const [courseData, applicationsData, studentApp] = await Promise.all([
          getPublishedCourses(),
          isAdmissionsStaff ? getAdmissionsApplications('pending_review') : Promise.resolve([]),
          supabase
            .from('academy_admissions_applications')
            .select(`
              *,
              first_choice:academy_courses!academy_admissions_applications_first_choice_course_id_fkey(name),
              second_choice:academy_courses!academy_admissions_applications_second_choice_course_id_fkey(name),
              third_choice:academy_courses!academy_admissions_applications_third_choice_course_id_fkey(name),
              assigned_course:academy_courses!academy_admissions_applications_assigned_course_id_fkey(name)
            `)
            .eq('student_id', profile.id)
            .maybeSingle(),
        ]);

        setCourses(courseData);
        setPendingApplications(applicationsData || []);
        if (studentApp.data) {
          const app = studentApp.data as any;
          setStudentApplication({
            ...app,
            first_choice_name: app.first_choice?.name,
            second_choice_name: app.second_choice?.name,
            third_choice_name: app.third_choice?.name,
            assigned_course_name: app.assigned_course?.name,
          });
          setFirstChoice(app.first_choice_course_id || '');
          setSecondChoice(app.second_choice_course_id || '');
          setThirdChoice(app.third_choice_course_id || '');
        } else if (loanRequestedCourseId) {
          setFirstChoice(loanRequestedCourseId);
        }
      } catch (error) {
        console.error(error);
        toast.error('Unable to load admissions data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, isAdmissionsStaff, loanRequestedCourseId]);

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unable to convert PDF blob to data URL.'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmitApplication = async () => {
    if (!profile?.id) {
      toast.error('Missing student profile. Please sign in again.');
      return;
    }
    if (!firstChoice) {
      toast.error('You must choose at least a first course choice.');
      return;
    }

    if (isLoanRequest && !loanAgreementAccepted) {
      toast.error('You must accept the loan payback rules and guidelines to submit.');
      return;
    }

    try {
      const application = await submitAdmissionsApplication({
        student_id: profile.id,
        first_choice_course_id: firstChoice,
        second_choice_course_id: secondChoice || null,
        third_choice_course_id: thirdChoice || null,
        status: 'pending_review',
        agreement_signed: isLoanRequest ? loanAgreementAccepted : false,
      });

      if (isLoanRequest) {
        const firstChoiceCourse = courses.find((course) => course.id === firstChoice);
        const secondChoiceCourse = courses.find((course) => course.id === secondChoice);
        const thirdChoiceCourse = courses.find((course) => course.id === thirdChoice);

        const studentName = profile?.display_name || profile?.username || 'Student';
        const studentUsername = profile?.username || 'unknown';
        const applicationDate = new Date(application.created_at).toLocaleDateString();

        const pdfBlob = await downloadLoanApplicationPDF({
          applicationId: application.id,
          studentId: profile.id,
          studentName,
          studentUsername,
          applicationDate,
          loanAmount: firstChoiceCourse?.enrollment_fee ?? 0,
          firstChoiceName: firstChoiceCourse?.name || null,
          secondChoiceName: secondChoiceCourse?.name || null,
          thirdChoiceName: thirdChoiceCourse?.name || null,
          status: application.status,
        });

        let agreementUrl: string | null = null;
        try {
          agreementUrl = await uploadLoanApplicationPdf(profile.id, application.id, pdfBlob);
        } catch (uploadError) {
          console.error('Loan application upload failed:', uploadError);
        }

        if (!agreementUrl) {
          agreementUrl = await blobToDataUrl(pdfBlob);
        }

        if (agreementUrl) {
          await updateAdmissionsApplicationAgreementUrl(application.id, agreementUrl);
          application.agreement_url = agreementUrl;
        }
      }

      setStudentApplication(application);
      toast.success('Admissions application submitted.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit application.');
    }
  };

  const handleReview = async (applicationId: string, status: AdmissionsStatus) => {
    if (!user?.id) {
      toast.error('Missing reviewer profile.');
      return;
    }
    setReviewingId(applicationId);
    try {
      await reviewAdmissionsApplication(applicationId, status, user.id, reviewNotes);
      const updated = pendingApplications.filter((app) => app.id !== applicationId);
      setPendingApplications(updated);
      toast.success(`Application ${status.replace('_', ' ')}.`);
    } catch (error) {
      console.error(error);
      toast.error('Unable to update application.');
    } finally {
      setReviewingId(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-4 text-center text-slate-300">
        <p className="text-sm">Please sign in to access Academy Admissions.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <section className={`${glass} rounded-3xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-black text-white">Academy Admissions</h1>
                <p className="text-sm text-slate-400">Apply to join Academy courses or manage applications if you are admissions staff.</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/academy')}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
          >
            Back to Academy
          </button>
        </div>
      </section>

      {isAdmissionsStaff && (
        <section className={`${glass} rounded-3xl p-6`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Admissions Review Center</h2>
              <p className="text-sm text-slate-400">Review pending admissions applications for Academy students.</p>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
              {pendingApplications.length} pending application{pendingApplications.length === 1 ? '' : 's'}
            </div>
          </div>

          {pendingApplications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-400">No pending admissions requests at the moment.</div>
          ) : (
            <div className="space-y-4">
              {pendingApplications.map((application) => (
                <div key={application.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{application.student_name || application.student_username || 'Applicant'}</p>
                      <p className="text-xs text-slate-400">Status: {application.status.replace('_', ' ')}</p>
                      <p className="mt-2 text-xs text-slate-400">First Choice: {application.first_choice_name || 'Not selected'}</p>
                      <p className="text-xs text-slate-400">Second Choice: {application.second_choice_name || 'Not selected'}</p>
                      <p className="text-xs text-slate-400">Third Choice: {application.third_choice_name || 'Not selected'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleReview(application.id, 'accepted')}
                        disabled={reviewingId === application.id}
                        className="rounded-xl bg-emerald-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReview(application.id, 'denied')}
                        disabled={reviewingId === application.id}
                        className="rounded-xl bg-red-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Add review notes"
                    className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-[#050710] p-3 text-sm text-slate-200 outline-none focus:border-cyan-400"
                    rows={3}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!isAdmissionsStaff && (
        <section className={`${glass} rounded-3xl p-6`}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Admissions Application</h2>
              <p className="text-sm text-slate-400">Apply for Academy placement and choose your top course preferences.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              <Users className="h-3.5 w-3.5" /> Student Access
            </div>
          </div>

          {isLoanRequest && (
            <div className="mb-5 rounded-3xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">
              <p className="font-black">Loan agreement flow enabled</p>
              <p className="mt-2">By applying for an Academy loan, you agree to the payback rules and guidelines below. A signed loan agreement PDF will be generated and downloaded automatically when you submit.</p>
              {loanRequestedCourseId && (
                <p className="mt-2 text-amber-100">Requested course: {courses.find((course) => course.id === loanRequestedCourseId)?.name || 'Selected course'}</p>
              )}
            </div>
          )}
          {isLoanRequest && (
            <div className="mb-5 rounded-3xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-slate-200">
              <p className="font-black text-white">Loan Payback Rules & Guidelines</p>
              <ul className="mt-3 space-y-2 pl-4 text-slate-300">
                <li>• Loan funds cover the full course enrollment fee only.</li>
                <li>• Approved loans are applied to your course enrollment and allow immediate acceptance even without enough coins.</li>
                <li>• You agree to repay the loan according to the Academy payment schedule tied to the course.</li>
                <li>• Repayment may be collected from future earnings or coin balances if you do not complete the course on time.</li>
                <li>• Failure to repay may affect future Academy loan eligibility and access to Academy courses.</li>
              </ul>
              <label className="mt-4 inline-flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={loanAgreementAccepted}
                  onChange={(event) => setLoanAgreementAccepted(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-500"
                />
                I have read and agree to the Academy loan payback rules and guidelines.
              </label>
            </div>
          )}

          {studentApplication ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-black text-white">Application status</p>
              <p className="mt-2 text-xs text-slate-300">Status: {studentApplication.status.replace('_', ' ')}</p>
              <p className="mt-2 text-xs text-slate-400">First Choice: {studentApplication.first_choice_name || 'Not selected'}</p>
              <p className="text-xs text-slate-400">Second Choice: {studentApplication.second_choice_name || 'Not selected'}</p>
              <p className="text-xs text-slate-400">Third Choice: {studentApplication.third_choice_name || 'Not selected'}</p>
              {studentApplication.assigned_course_name && (
                <p className="mt-2 text-xs text-emerald-300">Assigned Course: {studentApplication.assigned_course_name}</p>
              )}
              <p className="mt-2 text-xs text-slate-400">Loan Agreement Signed: {studentApplication.agreement_signed ? 'Yes' : 'No'}</p>
              {studentApplication.review_notes && (
                <p className="mt-2 text-xs text-slate-500">Review Notes: {studentApplication.review_notes}</p>
              )}
              {studentApplication.agreement_url && (
                <a
                  href={studentApplication.agreement_url}
                  download={`MaiTroll_LoanApplication_${studentApplication.id}.pdf`}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-cyan-500/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-500/30"
                >
                  <DownloadCloud className="h-3.5 w-3.5" /> Download Loan Application PDF
                </a>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">First Choice</label>
                <select
                  value={firstChoice}
                  onChange={(event) => setFirstChoice(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#050710] px-3 py-2 text-sm text-slate-200 outline-none appearance-none"
                >
                  <option className="bg-[#050710] text-slate-200" value="">Choose a course...</option>
                  {courses.map((course) => (
                    <option className="bg-[#050710] text-slate-200" key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Second Choice</label>
                <select
                  value={secondChoice}
                  onChange={(event) => setSecondChoice(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#050710] px-3 py-2 text-sm text-slate-200 outline-none appearance-none"
                >
                  <option className="bg-[#050710] text-slate-200" value="">Choose another course...</option>
                  {courses.map((course) => (
                    <option className="bg-[#050710] text-slate-200" key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Third Choice</label>
                <select
                  value={thirdChoice}
                  onChange={(event) => setThirdChoice(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#050710] px-3 py-2 text-sm text-slate-200 outline-none appearance-none"
                >
                  <option className="bg-[#050710] text-slate-200" value="">Choose another course...</option>
                  {courses.map((course) => (
                    <option className="bg-[#050710] text-slate-200" key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!studentApplication && (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleSubmitApplication}
                className="rounded-2xl bg-cyan-500 px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-cyan-400"
              >
                Submit Application
              </button>
              <button
                onClick={() => navigate('/academy/courses')}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08]"
              >
                Browse Courses
              </button>
            </div>
          )}
        </section>
      )}

      <section className={`${glass} rounded-3xl p-6`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Admissions Resources</h2>
            <p className="text-sm text-slate-400">Learn more about the Academy and how admissions decisions are made.</p>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">{courses.length} open courses</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 6).map((course) => (
            <button
              key={course.id}
              onClick={() => navigate(`/academy/course/${course.slug}`)}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-black text-white">{course.name}</p>
                  <p className="text-xs text-slate-400">{course.teacher_name || 'TBA'}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-500">{course.short_description || course.description || 'No description available.'}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
