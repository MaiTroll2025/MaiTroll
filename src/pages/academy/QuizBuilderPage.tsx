import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getTeacherByUserId, getTeacherCourses, getCourseQuizzes, createAssignment } from '@/services/academyService';
import type { AcademyTeacher, AcademyCourse, AcademyQuiz, AcademyQuizQuestion, QuizType, QuestionType } from '@/types/academy';
import {
  ChevronLeft, Save, Loader2, Plus, Trash2, HelpCircle, Clock, Award,
  CheckCircle, ToggleLeft, ToggleRight, GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '🔘' },
  { value: 'true_false', label: 'True / False', icon: '✅' },
  { value: 'fill_blank', label: 'Fill in Blank', icon: '✏️' },
  { value: 'essay', label: 'Essay', icon: '📝' },
  { value: 'matching', label: 'Matching', icon: '🔗' },
  { value: 'practical', label: 'Practical', icon: '🔧' },
];

interface QuestionForm {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string;
  correct_answers: string[];
  points: number;
  explanation: string;
}

export default function QuizBuilderPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    course_id: courseId || '',
    title: '',
    description: '',
    quiz_type: 'quiz' as QuizType,
    time_limit_minutes: 0,
    max_attempts: 1,
    passing_score: 70,
    shuffle_questions: false,
    show_results: true,
    is_published: false,
  });

  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  useEffect(() => {
    const init = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);
        const coursesData = await getTeacherCourses(teacherData.id);
        setCourses(coursesData);
        if (courseId) setForm(f => ({ ...f, course_id: courseId }));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [user?.id]);

  const addQuestion = (type: QuestionType = 'multiple_choice') => {
    const newQ: QuestionForm = {
      id: `q-${Date.now()}`,
      question_text: '',
      question_type: type,
      options: type === 'multiple_choice' ? ['', '', '', ''] : type === 'true_false' ? ['True', 'False'] : [],
      correct_answer: '',
      correct_answers: [],
      points: 1,
      explanation: '',
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionForm>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addOption = (qId: string) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: [...q.options, ''] } : q));
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: q.options.map((o, i) => i === idx ? value : o) } : q));
  };

  const removeOption = (qId: string, idx: number) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Quiz title is required'); return; }
    if (!form.course_id) { toast.error('Please select a course'); return; }
    if (questions.length === 0) { toast.error('Add at least one question'); return; }
    setSaving(true);
    try {
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const { data: quiz, error } = await supabase.from('academy_quizzes').insert({
        ...form,
        total_points: totalPoints,
      }).select().single();
      if (error) throw error;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await supabase.from('academy_quiz_questions').insert({
          quiz_id: quiz.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer || null,
          correct_answers: q.correct_answers,
          points: q.points,
          explanation: q.explanation || null,
          sort_order: i,
        });
      }

      toast.success(`Quiz created with ${questions.length} questions!`);
      navigate('/academy/teacher/dashboard');
    } catch (err: any) { toast.error(err.message || 'Failed to create quiz'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
        <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <HelpCircle className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Quiz Builder</h1>
            <p className="text-xs text-slate-400">{questions.length} questions • {questions.reduce((s, q) => s + q.points, 0)} total points</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className={`${glass} rounded-2xl p-5 space-y-4`}>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Course *</label>
              <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-indigo-400/50">
                <option value="">Select course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Chapter 3 Quiz"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Quiz instructions..."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-400/50" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Type</label>
                <select value={form.quiz_type} onChange={e => setForm(f => ({ ...f, quiz_type: e.target.value as QuizType }))}
                  className="w-full rounded-xl border border-white/10 bg-[#050710] px-3 py-2 text-xs text-white outline-none appearance-none">
                  <option value="quiz">Quiz</option>
                  <option value="exam">Exam</option>
                  <option value="practice">Practice</option>
                  <option value="assessment">Assessment</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Time Limit (min)</label>
                <input type="number" min={0} value={form.time_limit_minutes} onChange={e => setForm(f => ({ ...f, time_limit_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Max Attempts</label>
                <input type="number" min={1} value={form.max_attempts} onChange={e => setForm(f => ({ ...f, max_attempts: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Passing %</label>
                <input type="number" min={0} max={100} value={form.passing_score} onChange={e => setForm(f => ({ ...f, passing_score: parseInt(e.target.value) || 70 }))}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none" />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-black text-indigo-300">{idx + 1}</span>
                     <select value={q.question_type} onChange={e => updateQuestion(q.id, { question_type: (e.target as HTMLSelectElement).value as QuestionType })}
                      className="rounded-lg border border-white/10 bg-[#050710] px-2 py-1 text-[10px] text-white outline-none appearance-none">
                      {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={q.points} onChange={e => updateQuestion(q.id, { points: parseInt(e.target.value) || 1 })}
                      className="w-14 rounded border border-white/10 bg-[#050710] px-2 py-1 text-[10px] text-white text-center outline-none" />
                    <span className="text-[10px] text-slate-400">pts</span>
                    <button onClick={() => removeQuestion(q.id)} className="rounded-lg p-1 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <input type="text" value={q.question_text} onChange={e => updateQuestion(q.id, { question_text: e.target.value })}
                  placeholder="Enter your question..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/50 mb-3" />

                {(q.question_type === 'multiple_choice' || q.question_type === 'matching') && (
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <button onClick={() => updateQuestion(q.id, { correct_answer: String(optIdx) })}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${q.correct_answer === String(optIdx) ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/20'}`}>
                          {q.correct_answer === String(optIdx) && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                        </button>
                        <input type="text" value={opt} onChange={e => updateOption(q.id, optIdx, e.target.value)}
                          placeholder={`Option ${optIdx + 1}`}
                          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none" />
                        {q.options.length > 2 && <button onClick={() => removeOption(q.id, optIdx)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>}
                      </div>
                    ))}
                    <button onClick={() => addOption(q.id)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">+ Add Option</button>
                  </div>
                )}

                {q.question_type === 'true_false' && (
                  <div className="flex gap-3 mb-3">
                    {['True', 'False'].map(val => (
                      <button key={val} onClick={() => updateQuestion(q.id, { correct_answer: val })}
                        className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${q.correct_answer === val ? 'bg-emerald-500 text-white' : 'bg-white/[0.06] text-slate-400'}`}>
                        {val}
                      </button>
                    ))}
                  </div>
                )}

                {q.question_type === 'fill_blank' && (
                  <input type="text" value={q.correct_answer} onChange={e => updateQuestion(q.id, { correct_answer: e.target.value })}
                    placeholder="Correct answer..."
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none mb-3" />
                )}

                {q.question_type === 'essay' && (
                  <p className="text-[10px] text-slate-500 mb-3">Essay questions require manual grading.</p>
                )}

                <input type="text" value={q.explanation} onChange={e => updateQuestion(q.id, { explanation: e.target.value })}
                  placeholder="Explanation (shown after submission)..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-400 outline-none" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map(t => (
              <button key={t.value} onClick={() => addQuestion(t.value)}
                className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.1]">
                <Plus className="h-3 w-3" /> {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => navigate('/academy/teacher/dashboard')} className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-bold text-slate-400">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create Quiz
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${glass} rounded-2xl p-4`}>
            <h3 className="text-xs font-black text-white mb-3">Settings</h3>
            <div className="space-y-3">
              <button onClick={() => setForm(f => ({ ...f, shuffle_questions: !f.shuffle_questions }))}
                className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-white/[0.04]">
                <span className="text-xs text-slate-300">Shuffle Questions</span>
                {form.shuffle_questions ? <ToggleRight className="h-5 w-5 text-indigo-400" /> : <ToggleLeft className="h-5 w-5 text-slate-500" />}
              </button>
              <button onClick={() => setForm(f => ({ ...f, show_results: !f.show_results }))}
                className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-white/[0.04]">
                <span className="text-xs text-slate-300">Show Results</span>
                {form.show_results ? <ToggleRight className="h-5 w-5 text-indigo-400" /> : <ToggleLeft className="h-5 w-5 text-slate-500" />}
              </button>
              <button onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-white/[0.04]">
                <span className="text-xs text-slate-300">Published</span>
                {form.is_published ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-slate-500" />}
              </button>
            </div>
          </div>
          <div className={`${glass} rounded-2xl p-4`}>
            <h3 className="text-xs font-black text-white mb-2">💡 Tips</h3>
            <ul className="space-y-1 text-[10px] text-slate-400">
              <li>• Click the circle to mark correct answer</li>
              <li>• Set time limits for timed quizzes</li>
              <li>• Add explanations for learning</li>
              <li>• Shuffle questions for integrity</li>
              <li>• Save as draft before publishing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
