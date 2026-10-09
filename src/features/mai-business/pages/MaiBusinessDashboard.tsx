import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { Briefcase, BookOpen, TrendingUp, FileText, LifeBuoy, CreditCard, Scale, GraduationCap, Users, Lightbulb, ShoppingBag, ChevronRight, Loader } from 'lucide-react';
import { maiBusinessApi, type MaiBusinessProfile, type Course, type BusinessProfile } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

interface DashboardCardProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  to: string;
  tone?: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
  description?: string;
}

function DashboardCard({ icon: Icon, label, to, tone = 'cyan', badge, onClick, disabled, description }: DashboardCardProps) {
  const navigate = useNavigate();
  const toneColors: Record<string, string> = {
    purple: 'from-purple-500/20 to-cyan-500/20 text-purple-300 border-purple-500/20',
    green: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/20',
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/20',
    blue: 'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/20',
    pink: 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/20',
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/20',
    teal: 'from-teal-500/20 to-cyan-500/20 text-teal-300 border-teal-500/20',
  };

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    else navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`group relative p-6 rounded-2xl text-left transition-all hover:scale-[1.02] ${glass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} hover:border-${tone}-400/40`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${toneColors[tone]} border flex items-center justify-center flex-shrink-0`}>
          <Icon size={24} className={`text-${tone}-400`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-lg group-hover:text-cyan-300 transition-colors">{label}</h3>
            {badge && (
              <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{description}</p>}
        </div>
        <ChevronRight size={18} className="text-zinc-600 group-hover:text-zinc-400 transition-opacity" />
      </div>
    </button>
  );
}

export default function MaiBusinessDashboard() {
  const { user, profile } = useAuthStore();
  const [mbProfile, setMbProfile] = useState<MaiBusinessProfile | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [profileData, courseData, businessData, progressData] = await Promise.all([
          maiBusinessApi.ensureProfile(),
          maiBusinessApi.getDefaultCourse(),
          maiBusinessApi.getBusiness(),
          maiBusinessApi.getProgress(),
        ]);
        setMbProfile(profileData);
        setCourse(courseData);
        setBusiness(businessData);

        if (courseData) {
          const lessons = await maiBusinessApi.getLessons(courseData.id);
          const completed = lessons.filter(l => progressData.some(p => p.lesson_id === l.id && p.status === 'completed'));
          setProgress(completed);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, course?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader size={24} className="animate-spin" />
          <span>Loading your entrepreneur journey...</span>
        </div>
      </div>
    );
  }

  const totalLessons = progress.length;
  const totalCourseLessons = 21;
  const progressPct = Math.round((totalLessons / totalCourseLessons) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">
            MAI BUSINESS
            <span className="block text-zinc-300 text-xl font-medium mt-2">
              / Your Entrepreneur Journey
            </span>
          </h1>
          {profile && (
            <p className="text-zinc-400 mt-2">
              Welcome back, {profile.display_name || profile.username || 'Student'}.
              {mbProfile?.program_role === 'instructor' && ' (Instructor)'}
            </p>
          )}
        </div>

        {/* Progress Overview */}
        <div className={`p-6 rounded-2xl ${glass} mb-8`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Entrepreneurship Fundamentals</h2>
            <span className="text-sm text-zinc-400">8-week program</span>
          </div>
          <div className="w-full bg-zinc-800/30 rounded-full h-3 mb-2">
            <div
              className="h-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-zinc-400">
            <span>{totalLessons} of {totalCourseLessons} lessons completed</span>
            <span>{progressPct}% complete</span>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard
            icon={Briefcase}
            label="My Business"
            to="/mai-business/profile"
            tone="green"
            description={business ? `${business.business_name || 'Business profile set up'}` : "Set up your business profile"}
          />
          <DashboardCard
            icon={BookOpen}
            label="Start My Business"
            to="/mai-business/start"
            tone="cyan"
            description="Educational guide to forming a business"
          />
          <DashboardCard
            icon={FileText}
            label="Business Plan"
            to="/mai-business/business-plan"
            tone="blue"
            description="Build and manage your business plan"
          />
          <DashboardCard
            icon={GraduationCap}
            label="Education"
            to="/mai-business/education"
            tone="purple"
            description="8-week entrepreneurship fundamentals course"
          />
          <DashboardCard
            icon={CreditCard}
            label="Credit Education"
            to="/mai-business/credit"
            tone="teal"
            description="Personal and business credit fundamentals"
          />
          <DashboardCard
            icon={Scale}
            label="Funding Opportunities"
            to="/mai-business/funding"
            tone="amber"
            description="Verified grants and funding programs"
          />
          <DashboardCard
            icon={FileText}
            label="My Application"
            to="/mai-business/funding/apply"
            tone="pink"
            description="Funding application workflow"
          />
          <DashboardCard
            icon={TrendingUp}
            label="My Progress"
            to="/mai-business/progress"
            tone="cyan"
            description="Track your learning progress"
          />
          <DashboardCard
            icon={BookOpen}
            label="Business Resources"
            to="/mai-business/resources"
            tone="green"
            description="Verified tools and resource guides"
          />
          <DashboardCard
            icon={FileText}
            label="Documents"
            to="/mai-business/documents"
            tone="blue"
            description="Your generated and uploaded documents"
          />
          <DashboardCard
            icon={Lightbulb}
            label="Idea Exchange"
            to="/mai-business/idea-exchange"
            tone="purple"
            description="Share and discover business ideas"
          />
          <DashboardCard
            icon={Users}
            label="Find Collaborators"
            to="/mai-business/collaborators"
            tone="pink"
            description="Connect with students like you"
          />
          <DashboardCard
            icon={ShoppingBag}
            label="Marketplace"
            to="/mai-business/marketplace"
            tone="amber"
            description="Student-to-student marketplace"
          />
         
        
          <DashboardCard
            icon={LifeBuoy}
            label="Help & Resources"
            to="/mai-business/help"
            tone="cyan"
            description="Get help and support"
          />
        </div>
      </div>
    </div>
  );
}
