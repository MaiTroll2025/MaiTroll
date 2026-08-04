// ============================================================
// Mai Troll ACADEMY - TEACHER COURSE CREATION/EDIT WITH OER
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft, Save, Loader2, BookOpen, Plus, Trash2, Search,
  ExternalLink, Globe, FileText, Video, Download, X, Check,
  GraduationCap, Sparkles,
} from 'lucide-react';
import { getTeacherByUserId, createCourse, updateCourse, getCategories } from '@/services/academyService';
import type { AcademyTeacher, AcademyCategory } from '@/types/academy';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// OER Resource types
interface OERResource {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  type: 'textbook' | 'video' | 'worksheet' | 'practice_exam' | 'lecture' | 'interactive';
  subject: string;
  license: string;
}

// Curated OER library by category
const OER_LIBRARY: Record<string, OERResource[]> = {
  trades: [
    { id: 'oer-t1', title: 'Welding Fundamentals', description: 'Comprehensive guide to MIG, TIG, and arc welding techniques', url: 'https://open.umn.edu/opentextbooks/subjects/trades', source: 'OpenStax', type: 'textbook', subject: 'Welding', license: 'CC BY 4.0' },
    { id: 'oer-t2', title: 'Plumbing Basics', description: 'Introduction to residential and commercial plumbing systems', url: 'https://www.oercommons.org/browse?f.keyword=plumbing', source: 'OER Commons', type: 'textbook', subject: 'Plumbing', license: 'CC BY-SA' },
    { id: 'oer-t3', title: 'Electrical Theory', description: 'DC/AC circuits, Ohm\'s law, and electrical safety', url: 'https://open.umn.edu/opentextbooks/subjects/electrical', source: 'OpenStax', type: 'textbook', subject: 'Electrical', license: 'CC BY 4.0' },
    { id: 'oer-t4', title: 'HVAC Systems', description: 'Heating, ventilation, and air conditioning fundamentals', url: 'https://www.oercommons.org/browse?f.keyword=hvac', source: 'OER Commons', type: 'textbook', subject: 'HVAC', license: 'CC BY-SA' },
    { id: 'oer-t5', title: 'Carpentry & Construction', description: 'Building materials, framing, and construction techniques', url: 'https://open.umn.edu/opentextbooks/subjects/construction', source: 'OpenStax', type: 'textbook', subject: 'Carpentry', license: 'CC BY 4.0' },
    { id: 'oer-t6', title: 'Automotive Technology', description: 'Engine systems, diagnostics, and repair procedures', url: 'https://www.oercommons.org/browse?f.keyword=automotive', source: 'OER Commons', type: 'textbook', subject: 'Automotive', license: 'CC BY-SA' },
  ],
  healthcare: [
    { id: 'oer-h1', title: 'Anatomy & Physiology', description: 'Complete human anatomy and physiology textbook', url: 'https://open.umn.edu/opentextbooks/subjects/anatomy', source: 'OpenStax', type: 'textbook', subject: 'Medical Basics', license: 'CC BY 4.0' },
    { id: 'oer-h2', title: 'Nursing Fundamentals', description: 'Patient care, vital signs, and clinical procedures', url: 'https://www.oercommons.org/browse?f.keyword=nursing', source: 'OER Commons', type: 'textbook', subject: 'Nursing', license: 'CC BY-SA' },
    { id: 'oer-h3', title: 'CPR & First Aid', description: 'Emergency response, CPR techniques, and first aid procedures', url: 'https://www.oercommons.org/browse?f.keyword=cpr', source: 'OER Commons', type: 'practice_exam', subject: 'CPR', license: 'CC BY-SA' },
    { id: 'oer-h4', title: 'Medical Terminology', description: 'Latin and Greek roots, medical abbreviations, and terminology', url: 'https://open.umn.edu/opentextbooks/subjects/medical', source: 'OpenStax', type: 'textbook', subject: 'Medical Basics', license: 'CC BY 4.0' },
  ],
  business: [
    { id: 'oer-b1', title: 'Entrepreneurship', description: 'Business planning, startups, and venture development', url: 'https://open.umn.edu/opentextbooks/subjects/entrepreneurship', source: 'OpenStax', type: 'textbook', subject: 'Entrepreneurship', license: 'CC BY 4.0' },
    { id: 'oer-b2', title: 'Marketing Principles', description: 'Digital marketing, branding, and consumer behavior', url: 'https://open.umn.edu/opentextbooks/subjects/marketing', source: 'OpenStax', type: 'textbook', subject: 'Marketing', license: 'CC BY 4.0' },
    { id: 'oer-b3', title: 'Personal Finance', description: 'Budgeting, investing, credit, and financial planning', url: 'https://open.umn.edu/opentextbooks/subjects/finance', source: 'OpenStax', type: 'textbook', subject: 'Finance', license: 'CC BY 4.0' },
    { id: 'oer-b4', title: 'Real Estate Fundamentals', description: 'Property law, transactions, and real estate investment', url: 'https://www.oercommons.org/browse?f.keyword=real+estate', source: 'OER Commons', type: 'textbook', subject: 'Real Estate', license: 'CC BY-SA' },
  ],
  technology: [
    { id: 'oer-tech1', title: 'Computer Science Basics', description: 'Hardware, software, networking, and digital literacy', url: 'https://open.umn.edu/opentextbooks/subjects/computer+science', source: 'OpenStax', type: 'textbook', subject: 'Computer Basics', license: 'CC BY 4.0' },
    { id: 'oer-tech2', title: 'Introduction to Programming', description: 'Python, JavaScript, and programming fundamentals', url: 'https://open.umn.edu/opentextbooks/subjects/programming', source: 'OpenStax', type: 'textbook', subject: 'Programming', license: 'CC BY 4.0' },
    { id: 'oer-tech3', title: 'Cybersecurity Fundamentals', description: 'Network security, encryption, and threat analysis', url: 'https://www.oercommons.org/browse?f.keyword=cybersecurity', source: 'OER Commons', type: 'textbook', subject: 'Cybersecurity', license: 'CC BY-SA' },
    { id: 'oer-tech4', title: 'Artificial Intelligence', description: 'Machine learning, neural networks, and AI ethics', url: 'https://open.umn.edu/opentextbooks/subjects/artificial+intelligence', source: 'OpenStax', type: 'textbook', subject: 'AI', license: 'CC BY 4.0' },
  ],
  life_skills: [
    { id: 'oer-l1', title: 'Personal Finance & Budgeting', description: 'Managing money, credit scores, and financial planning', url: 'https://open.umn.edu/opentextbooks/subjects/personal+finance', source: 'OpenStax', type: 'textbook', subject: 'Budgeting', license: 'CC BY 4.0' },
    { id: 'oer-l2', title: 'Credit Building Guide', description: 'Understanding credit scores, reports, and improvement strategies', url: 'https://www.oercommons.org/browse?f.keyword=credit', source: 'OER Commons', type: 'textbook', subject: 'Credit Scores', license: 'CC BY-SA' },
    { id: 'oer-l3', title: 'Home Ownership', description: 'Buying a home, mortgages, and property management', url: 'https://www.oercommons.org/browse?f.keyword=home+ownership', source: 'OER Commons', type: 'textbook', subject: 'Home Ownership', license: 'CC BY-SA' },
    { id: 'oer-l4', title: 'Insurance Basics', description: 'Health, auto, home, and life insurance explained', url: 'https://www.oercommons.org/browse?f.keyword=insurance', source: 'OER Commons', type: 'textbook', subject: 'Insurance', license: 'CC BY-SA' },
    { id: 'oer-l5', title: 'Tax Preparation', description: 'Federal and state tax filing, deductions, and credits', url: 'https://www.irs.gov/newsroom/free-tax-return-filing', source: 'IRS', type: 'worksheet', subject: 'Taxes', license: 'Public Domain' },
  ],
  refreshers: [
    { id: 'oer-r1', title: 'Reading Comprehension', description: 'Critical reading, analysis, and comprehension strategies', url: 'https://open.umn.edu/opentextbooks/subjects/reading', source: 'OpenStax', type: 'textbook', subject: 'Reading', license: 'CC BY 4.0' },
    { id: 'oer-r2', title: 'Writing & Composition', description: 'Essay writing, grammar, and composition techniques', url: 'https://open.umn.edu/opentextbooks/subjects/writing', source: 'OpenStax', type: 'textbook', subject: 'Writing', license: 'CC BY 4.0' },
    { id: 'oer-r3', title: 'Mathematics Fundamentals', description: 'Algebra, geometry, and practical mathematics', url: 'https://open.umn.edu/opentextbooks/subjects/mathematics', source: 'OpenStax', type: 'textbook', subject: 'Math', license: 'CC BY 4.0' },
    { id: 'oer-r4', title: 'Science Essentials', description: 'Biology, chemistry, and physics fundamentals', url: 'https://open.umn.edu/opentextbooks/subjects/science', source: 'OpenStax', type: 'textbook', subject: 'Science', license: 'CC BY 4.0' },
  ],
};

const ALL_OER_RESOURCES = Object.values(OER_LIBRARY).flat();

export default function TeacherCoursePage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const [teacher, setTeacher] = useState<AcademyTeacher | null>(null);
  const [categories, setCategories] = useState<AcademyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isEdit = !!courseId;

  // OER state
  const [showOERPanel, setShowOERPanel] = useState(false);
  const [oerSearch, setOerSearch] = useState('');
  const [oerResources, setOerResources] = useState<OERResource[]>([]);
  const [selectedOER, setSelectedOER] = useState<OERResource[]>([]);
  const [oerLoading, setOerLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: '', slug: '', description: '', short_description: '', category_id: '',
    difficulty_level: 'beginner', max_students: 20, enrollment_fee: 5000,
    currency_type: 'troll_coins' as 'troll_coins' | 'free',
    enrollment_type: 'open' as 'open' | 'approval_required',
    minimum_attendance_pct: 80, meeting_days: [] as string[],
    meeting_time: '', timezone: 'America/New_York',
    registration_open_date: today,
    registration_close_date: defaultEnd,
    start_date: today,
    end_date: defaultEnd,
    status: 'published' as 'draft' | 'published',
  });

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const teacherData = await getTeacherByUserId(user.id);
        if (!mounted) return;
        if (!teacherData) { navigate('/academy/teacher/dashboard'); return; }
        setTeacher(teacherData);
        const cats = await getCategories();
        if (!mounted) return;
        setCategories(cats);
        if (isEdit && courseId) {
          const { data: course } = await supabase.from('academy_courses').select('*').eq('id', courseId).eq('teacher_id', teacherData.id).maybeSingle();
          if (course && mounted) {
            setForm({
              name: course.name || '', slug: course.slug || '', description: course.description || '',
              short_description: course.short_description || '', category_id: course.category_id || '',
              difficulty_level: course.difficulty_level || 'beginner', max_students: course.max_students || 20,
              enrollment_fee: course.enrollment_fee || 5000, currency_type: course.currency_type || 'troll_coins',
              enrollment_type: course.enrollment_type || 'open', minimum_attendance_pct: course.minimum_attendance_pct || 80,
              meeting_days: course.meeting_days || [], meeting_time: course.meeting_time || '',
              timezone: course.timezone || 'America/New_York',
              registration_open_date: course.registration_open_date || today,
              registration_close_date: course.registration_close_date || defaultEnd,
              start_date: course.start_date || today,
              end_date: course.end_date || defaultEnd,
              status: course.status || 'draft',
            });
          }
        }
      } catch (err) { console.error('Error loading course page:', err); }
      finally { if (mounted) setLoading(false); }
    };
    init();
    return () => { mounted = false; };
  }, [user?.id]);

  // Load OER resources when category changes
  useEffect(() => {
    if (form.category_id) {
      const cat = categories.find(c => c.id === form.category_id);
      if (cat) {
        const resources = OER_LIBRARY[cat.slug] || [];
        setOerResources(resources);
      }
    }
  }, [form.category_id, categories]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Course name is required'); return; }
    if (!form.slug.trim()) { toast.error('Course slug is required'); return; }
    if (!teacher) return;
    setSaving(true);
    try {
      const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      if (isEdit && courseId) {
        await updateCourse(courseId, { ...form, teacher_id: teacher.id });
        toast.success('Course updated!');
      } else {
        await createCourse({ ...form, slug, teacher_id: teacher.id });
        toast.success('Course created!');
      }
      // Save selected OER resources as course materials
      if (selectedOER.length > 0) {
        const courseIdToUse = isEdit ? courseId : (await supabase.from('academy_courses').select('id').eq('slug', slug).single()).data?.id;
        if (courseIdToUse) {
          await supabase.from('academy_materials').insert(
            selectedOER.map(oer => ({
              course_id: courseIdToUse,
              uploaded_by: user!.id,
              title: oer.title,
              description: oer.description,
              material_type: oer.type === 'video' ? 'video' : 'oer',
              external_url: oer.url,
              source: oer.source,
              is_oer: true,
              is_published: true,
            }))
          );
        }
      }
      navigate('/academy/teacher/dashboard');
    } catch (err: any) { toast.error(err.message || 'Failed to save course'); }
    finally { setSaving(false); }
  };

  const toggleDay = (day: string) => {
    setForm(prev => ({ ...prev, meeting_days: prev.meeting_days.includes(day) ? prev.meeting_days.filter(d => d !== day) : [...prev.meeting_days, day] }));
  };

  const toggleOER = (resource: OERResource) => {
    setSelectedOER(prev => {
      const isAlreadySelected = prev.find(r => r.id === resource.id);
      if (!isAlreadySelected && !form.slug.trim()) {
        const generated = slugify(resource.title);
        setForm(p => ({ ...p, slug: generated }));
      }
      return isAlreadySelected ? prev.filter(r => r.id !== resource.id) : [...prev, resource];
    });
  };

  const availableOER = form.category_id ? oerResources : ALL_OER_RESOURCES;
  const query = oerSearch.trim().toLowerCase();

  const filteredOER = availableOER.filter(r => {
    if (!query) return true;
    return [r.title, r.subject, r.description, r.source]
      .some(value => value.toLowerCase().includes(query));
  });

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>;
  if (!teacher) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <button onClick={() => navigate('/academy/teacher/dashboard')} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard</button>

      <section className={`${glass} rounded-2xl p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600"><BookOpen className="h-6 w-6 text-white" /></div>
            <div><h1 className="text-xl font-black text-white">{isEdit ? 'Edit Course' : 'Create New Course'}</h1><p className="text-xs text-slate-400">{teacher.teacher_id}</p></div>
          </div>
          <button onClick={() => setShowOERPanel(!showOERPanel)} className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-2 text-xs font-black text-white">
            <Sparkles className="h-3.5 w-3.5" /> OER Library
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`${glass} rounded-2xl p-5 space-y-4`}>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Course Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Automotive Fundamentals" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">URL Slug *</label>
              <input type="text" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="e.g., automotive-fundamentals" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Short Description</label>
              <input type="text" value={form.short_description} onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))} placeholder="Brief description for course cards" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">Full Description</label>
              <textarea rows={4} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed course description..." className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Category</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50">
                  <option className="bg-[#050710] text-slate-200" value="">Select category</option>
                  {categories.map(cat => <option className="bg-[#050710] text-slate-200" key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-300">Difficulty</label>
                <select value={form.difficulty_level} onChange={e => setForm(p => ({ ...p, difficulty_level: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50">
                  <option className="bg-[#050710] text-slate-200" value="beginner">Beginner</option><option className="bg-[#050710] text-slate-200" value="intermediate">Intermediate</option><option className="bg-[#050710] text-slate-200" value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Max Students</label><input type="number" min={1} max={100} value={form.max_students} onChange={e => setForm(p => ({ ...p, max_students: parseInt(e.target.value) || 20 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Enrollment Fee</label><input type="number" min={0} value={form.enrollment_fee} onChange={e => setForm(p => ({ ...p, enrollment_fee: parseInt(e.target.value) || 0 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Currency</label><select value={form.currency_type} onChange={e => setForm(p => ({ ...p, currency_type: e.target.value as 'troll_coins' | 'free' }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50"><option className="bg-[#050710] text-slate-200" value="troll_coins">Troll Coins</option><option className="bg-[#050710] text-slate-200" value="free">Free</option></select></div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-300">Meeting Days</label>
              <div className="flex flex-wrap gap-2">{DAY_OPTIONS.map(day => (<button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${form.meeting_days.includes(day) ? 'bg-amber-500 text-white' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'}`}>{day}</button>))}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Meeting Time</label><input type="time" value={form.meeting_time} onChange={e => setForm(p => ({ ...p, meeting_time: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Timezone</label><select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50"><option className="bg-[#050710] text-slate-200" value="America/New_York">Eastern (ET)</option><option className="bg-[#050710] text-slate-200" value="America/Chicago">Central (CT)</option><option className="bg-[#050710] text-slate-200" value="America/Denver">Mountain (MT)</option><option className="bg-[#050710] text-slate-200" value="America/Los_Angeles">Pacific (PT)</option></select></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Course Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Course End Date</label><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Enrollment Type</label><select value={form.enrollment_type} onChange={e => setForm(p => ({ ...p, enrollment_type: e.target.value as 'open' | 'approval_required' }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50"><option className="bg-[#050710] text-slate-200" value="open">Open Enrollment</option><option className="bg-[#050710] text-slate-200" value="approval_required">Approval Required</option></select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-300">Min Attendance %</label><input type="number" min={0} max={100} value={form.minimum_attendance_pct} onChange={e => setForm(p => ({ ...p, minimum_attendance_pct: parseInt(e.target.value) || 80 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400/50" /></div>
            </div>
            <div><label className="mb-1 block text-xs font-bold text-slate-300">Status</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as 'draft' | 'published' }))} className="w-full rounded-xl border border-white/10 bg-[#050710] px-4 py-2.5 text-sm text-white outline-none appearance-none focus:border-amber-400/50"><option className="bg-[#050710] text-slate-200" value="draft">Draft</option><option className="bg-[#050710] text-slate-200" value="published">Published</option></select></div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3">
            <button onClick={() => navigate('/academy/teacher/dashboard')} className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isEdit ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </div>

        {/* OER Panel */}
        <div className="space-y-4">
          {showOERPanel && (
            <div className={`${glass} rounded-2xl p-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-1"><Sparkles className="h-4 w-4 text-purple-400" /> OER Library</h3>
                <button onClick={() => setShowOERPanel(false)} className="rounded-lg p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-[10px] text-slate-400">Open Educational Resources — free, licensed materials for your course.</p>
              <div className="relative"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search OER..." value={oerSearch} onChange={e => setOerSearch(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.05] py-1.5 pl-7 pr-3 text-xs text-white outline-none" /></div>
              {!form.category_id && !oerSearch ? (
                <p className="text-center text-[10px] text-slate-500 py-4">Search all OER resources or select a category to narrow results.</p>
              ) : filteredOER.length === 0 ? (
                <p className="text-center text-[10px] text-slate-500 py-4">No OER resources found matching your search.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredOER.map(resource => {
                    const isSelected = selectedOER.find(r => r.id === resource.id);
                    return (
                      <div key={resource.id} className={`rounded-lg border p-2 cursor-pointer transition ${isSelected ? 'border-purple-400/50 bg-purple-500/[0.08]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`} onClick={() => toggleOER(resource)}>
                        <div className="flex items-start gap-2">
                          {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-purple-400 mt-0.5" /> : <div className="h-3.5 w-3.5 shrink-0 rounded border border-white/20 mt-0.5" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-white">{resource.title}</p>
                            <p className="text-[9px] text-slate-400 line-clamp-2">{resource.description}</p>
                            <div className="mt-1 flex items-center gap-1">
                              <span className="rounded bg-purple-500/20 px-1 py-0.5 text-[8px] font-bold text-purple-300">{resource.source}</span>
                              <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] text-slate-400">{resource.license}</span>
                            </div>
                          </div>
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="shrink-0 rounded p-1 text-slate-400 hover:text-white"><ExternalLink className="h-3 w-3" /></a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedOER.length > 0 && (
                <div className="rounded-lg bg-purple-500/[0.08] p-2">
                  <p className="text-[10px] font-bold text-purple-300">{selectedOER.length} resource{selectedOER.length > 1 ? 's' : ''} selected</p>
                  <p className="text-[9px] text-slate-400">These will be added as course materials when you save.</p>
                </div>
              )}
            </div>
          )}

          {/* Selected OER Summary (always visible) */}
          {selectedOER.length > 0 && !showOERPanel && (
            <div className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-white">OER Resources ({selectedOER.length})</h3>
                <button onClick={() => setShowOERPanel(true)} className="text-[10px] font-bold text-purple-300 hover:text-purple-200">Edit</button>
              </div>
              <div className="space-y-1">
                {selectedOER.map(r => (
                  <div key={r.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Check className="h-3 w-3 text-purple-400" /><span className="truncate">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Tips */}
          <div className={`${glass} rounded-2xl p-4`}>
            <h3 className="text-xs font-black text-white mb-2">💡 Course Tips</h3>
            <ul className="space-y-1 text-[10px] text-slate-400">
              <li>• Use OER resources to build your curriculum</li>
              <li>• Set meeting days and times for student scheduling</li>
              <li>• Choose "Approval Required" to review each student</li>
              <li>• Set enrollment fees in Troll Coins</li>
              <li>• Save as Draft before publishing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
