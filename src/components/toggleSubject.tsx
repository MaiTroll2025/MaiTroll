// ============================================================
// Mai Troll ACADEMY - TEACHER APPLICATION
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { GraduationCap, Send, CheckCircle } from 'lucide-react';
import { applyForTeacher } from '@/services/academyService';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const SUBJECT_OPTIONS = [
  'Welding', 'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Automotive',
  'Nursing', 'CNA Prep', 'CPR', 'Medical Basics',
  'Entrepreneurship', 'Marketing', 'Finance', 'Real Estate',
  'Computer Basics', 'Programming', 'Cybersecurity', 'AI',
  'Credit Scores', 'Budgeting', 'Home Ownership', 'Insurance', 'Taxes',
  'Reading', 'Writing', 'Math', 'Science',
];

export default function TeacherApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.display_name || '',
    email: '',
    phone: '',
    qualifications: '',
    experience: '',
    teaching_subjects: [] as string[],
    motivation: '',
  });

  const toggleSubject = (subject: string) => {
    setForm(prev => ({
      ...prev,
      teaching_subjects: prev.teaching_subjects.includes(subject)
        ? prev.teaching_subjects.filter(s => s !== subject)
        : [...prev.teaching_subjects, subject],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);
    try {
      await applyForTeacher({
        user_id: user.id,
        ...form,
      });
      setSubmitted(true);
      toast.success('Application submitted! You\'ll be notified when reviewed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <section className={`${glass} rounded-2xl p-8 text-center`}>
          <CheckCircle className="mx-auto h-16 w-16 text-emerald-400" />
          <h2 className="mt-4 text-2xl font-black text-white">Application Submitted!</h2>
          <p className="mt-2 text-sm text-slate-400">Your teacher application is under review. You'll be notified via Tromail when a decision is made.</p>
          <button onClick={() => navigate('/academy')} className="mt-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-black text-white">
            Back to Academy
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <section className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Become a Teacher</h1>
            <p className="text-sm text-slate-400">Share your knowledge with Mai Troll</p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className={`${glass} rounded-2xl p-6 space-y-4`}>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-300">Full Name *</label>
          <input type="text" required value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">Email *</label>
            <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-300">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-300">Qualifications *</label>
          <textarea required rows={3} value={form.qualifications} onChange={e => setForm(p => ({ ...p, qualifications: e.target.value }))}
            placeholder="Certifications, degrees, licenses..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-300">Teaching Experience *</label>
          <textarea required rows={3} value={form.experience} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
            placeholder="Describe your teaching experience..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold text-slate-300">Teaching Subjects *</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map(subject => (
              <button key={subject} type="button" onClick={() => toggleSubject(subject)}
                className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${form.teaching_subjects.includes(subject) ? 'bg-amber-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>
                {subject}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-300">Why do you want to teach? *</label>
          <textarea required rows={3} value={form.motivation} onChange={e => setForm(p => ({ ...p, motivation: e.target.value }))}
            placeholder="Tell us your motivation..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
        </div>
        <button type="submit" disabled={loading || form.teaching_subjects.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50">
          <Send className="h-4 w-4" /> {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
