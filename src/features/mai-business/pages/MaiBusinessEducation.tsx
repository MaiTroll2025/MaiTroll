import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  BookOpen,
  Loader,
  Trophy,
} from 'lucide-react';
import { maiBusinessApi, type Course, type CourseModule, type Lesson, type UserProgress } from '@/features/mai-business/lib/maiBusinessApi';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function MaiBusinessEducation() {
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [currentModule, setCurrentModule] = useState<CourseModule | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'course' | 'lesson'>('course');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [courseData, progressData] = await Promise.all([
          maiBusinessApi.getDefaultCourse(),
          maiBusinessApi.getProgress(),
        ]);
        setCourse(courseData);
        setProgress(progressData);
        if (courseData) {
          const mods = await maiBusinessApi.getModules(courseData.id);
          setModules(mods);
          if (mods.length > 0) setCurrentModule(mods[0]);
        }
      } catch (err) {
        console.error('Education fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (currentModule) {
      maiBusinessApi.getLessons(currentModule.id).then(setLessons);
    }
  }, [currentModule]);

  const handleLessonClick = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setActiveTab('lesson');
  };

  const handleComplete = async () => {
    if (!currentLesson || !course || !currentModule) return;
    const result = await maiBusinessApi.updateLessonProgress(
      currentLesson.id,
      course.id,
      currentModule.id,
      'completed',
      100,
    );
    if (result?.success) {
      toast.success('Lesson completed!');
      setProgress(prev => [...prev.filter(p => p.lesson_id !== currentLesson.id), {
        ...prev.find(p => p.lesson_id === currentLesson.id) || {
          id: '', user_id: '', course_id: course?.id || '', module_id: currentModule?.id || '',
          lesson_id: currentLesson.id, status: 'completed', progress_percent: 100, completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        status: 'completed', progress_percent: 100, completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }]);
    } else {
      toast.error('Failed to update progress');
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress.some(p => p.lesson_id === lessonId && p.status === 'completed');
  };

  const getModuleProgress = (module: CourseModule) => {
    const moduleLessons = lessons.filter(l => l.module_id === module.id);
    if (moduleLessons.length === 0) return 0;
    const completed = moduleLessons.filter(l => isLessonCompleted(l.id)).length;
    return Math.round((completed / moduleLessons.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader size={24} className="animate-spin" />
          <span>Loading Entrrepreneurship Fundamentals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-black mb-2">
            {course?.title || 'Entrepreneurship Fundamentals'}
            <span className="block text-zinc-400 text-xl font-medium mt-1">
              8-week / 56-day program
            </span>
          </h1>
        </div>

        <div className="flex gap-6">
          {/* Module Sidebar */}
          <div className="w-72 flex-shrink-0">
            <div className={`p-4 rounded-2xl ${glass} h-[calc(100vh-120px)] overflow-y-auto`}>
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen size={16} /> Course Modules
              </h2>
              <div className="space-y-2">
                {modules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => { setCurrentModule(mod); setActiveTab('course'); }}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      currentModule?.id === mod.id
                        ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-400/40 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold
                        ${currentModule?.id === mod.id ? 'bg-cyan-500 text-black' : 'text-zinc-500'}`}>
                        {mod.week_number}
                      </span>
                      <span className="font-medium">{mod.title}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-1.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                        style={{ width: `${getModuleProgress(mod)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'course' && currentModule && (
              <div className={`p-6 rounded-2xl ${glass} mb-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Week {currentModule.week_number}: {currentModule.title}
                  </h2>
                  <Trophy size={20} className="text-amber-400" />
                </div>
                <p className="text-zinc-300 mb-6">{currentModule.description}</p>

                <h3 className="text-lg font-semibold text-white mb-4">Lessons</h3>
                <div className="space-y-3">
                  {lessons.map((lesson) => {
                    const completed = isLessonCompleted(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 hover:border-cyan-400/30 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {completed ? (
                            <CheckCircle size={20} className="text-emerald-400" />
                          ) : (
                            <Circle size={20} className="text-zinc-600" />
                          )}
                          <span className={completed ? 'text-emerald-300 font-medium' : 'text-white'}>
                            {lesson.title}
                          </span>
                          <ChevronRight size={16} className="ml-auto text-zinc-600" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'lesson' && currentLesson && (
              <div className={`p-8 rounded-2xl ${glass} min-h-[500px]`}>
                <button onClick={() => setActiveTab('course')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
                  <ChevronLeft size={16} /> Back to Modules
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">{currentLesson.title}</h2>

                {currentLesson.content && typeof currentLesson.content === 'object' && (
                  <div
                    className="prose prose-invert prose-cyan max-w-none mb-8 text-zinc-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: (currentLesson.content as any).body || JSON.stringify(currentLesson.content) }}
                  />
                )}

                {currentLesson.objectives && currentLesson.objectives.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Learning Objectives</h3>
                    <ul className="space-y-2">
                      {currentLesson.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle size={16} className="text-cyan-400 mt-0.5" />
                          <span className="text-zinc-300">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentLesson.examples && currentLesson.examples.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Examples</h3>
                    <ul className="space-y-2">
                      {currentLesson.examples.map((ex, i) => (
                        <li key={i} className="text-zinc-400">• {ex}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentLesson.key_terms && currentLesson.key_terms.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">Key Terms</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentLesson.key_terms.map((term, i) => (
                        <span key={i} className="px-3 py-1 bg-zinc-800/50 border border-zinc-700 rounded-full text-sm text-zinc-300">
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-6 border-t border-white/10">
                  <button
                    onClick={() => setActiveTab('course')}
                    className="px-4 py-2 text-zinc-400 hover:text-white"
                  >
                    Back to Modules
                  </button>
                  <button
                    onClick={handleComplete}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all"
                  >
                    Mark Complete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
