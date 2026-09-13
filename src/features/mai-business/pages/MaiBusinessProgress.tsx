import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader,
  Award,
  BookOpen,
  BarChart3,
} from 'lucide-react';
import { maiBusinessApi, type BusinessPlanSection } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const steps = [
  { id: 'profile', title: 'Set Business Profile', icon: Award, description: 'Define your business details', route: '/mai-business/profile' },
  { id: 'education', title: 'Complete Education', icon: BookOpen, description: 'Learn entrepreneurship fundamentals', route: '/mai-business/education' },
  { id: 'plan', title: 'Write Business Plan', icon: BookOpen, description: 'Create a comprehensive plan', route: '/mai-business/business-plan' },
  { id: 'funding', title: 'Apply for Funding', icon: Award, description: 'Submit funding applications', route: '/mai-business/funding' },
  { id: 'credit', title: 'Check Credit', icon: BarChart3, description: 'View credit score and account', route: '/mai-business/credit' },
  { id: 'marketplace', title: 'Explore Marketplace', icon: Award, description: 'Browse business products', route: '/mai-business/marketplace' },
];

export default function MaiBusinessProgress() {
  const navigate = useNavigate();
  const [planSections, setPlanSections] = useState<BusinessPlanSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getBusinessPlanSections();
        setPlanSections(data);
      } catch (err) {
        console.error('Error fetching plan:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const completedSections = planSections.filter(s => s.status === 'approved' || s.status === 'review');
  const planProgress = planSections.length > 0 ? Math.round((completedSections.length / planSections.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black">
            Startup Progress
            <span className="block text-zinc-400 text-xl font-medium mt-1">Track Your Journey</span>
          </h1>
        </div>

        <div className={`p-8 rounded-2xl ${glass} mb-8`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Progress Overview</h2>
            <div className="text-right">
              <div className="text-3xl font-black text-cyan-400">{planProgress}%</div>
              <div className="text-sm text-zinc-500">Business Plan Complete</div>
            </div>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${planProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                onClick={() => navigate(step.route)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${glass} hover:border-cyan-400/30`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    idx < 3
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white">{step.title}</h3>
                    <p className="text-sm text-zinc-500">{step.description}</p>
                  </div>
                  <ChevronLeft size={16} className="text-zinc-600 rotate-180" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
