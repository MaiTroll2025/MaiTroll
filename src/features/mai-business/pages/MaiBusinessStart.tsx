import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket,
  ChevronLeft,
  Building2,
  DollarSign,
  ShoppingCart,
  BarChart3,
  Target,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';
const cardHover = 'hover:border-cyan-400/30 hover:bg-white/[0.03]';

interface StarterOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  navigateTo: string;
}

export default function MaiBusinessStart() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const starterOptions: StarterOption[] = [
    {
      id: 'business-plan',
      title: 'Write Business Plan',
      description: 'Create a comprehensive business plan with AI assistance',
      icon: <Lightbulb size={24} className="text-cyan-400" />,
      navigateTo: '/mai-business/business-plan',
    },
    {
      id: 'marketplace',
      title: 'Explore Marketplace',
      description: 'Browse products and services for your business',
      icon: <ShoppingCart size={24} className="text-purple-400" />,
      navigateTo: '/mai-business/marketplace',
    },
    {
      id: 'credit',
      title: 'Check Credit',
      description: 'View your credit score and available funding',
      icon: <BarChart3 size={24} className="text-amber-400" />,
      navigateTo: '/mai-business/credit',
    },
    {
      id: 'funding',
      title: 'Apply for Funding',
      description: 'Submit funding applications to investors',
      icon: <DollarSign size={24} className="text-emerald-400" />,
      navigateTo: '/mai-business/funding',
    },
    {
      id: 'profile',
      title: 'Set Business Profile',
      description: 'Define your business name, idea, and stage',
      icon: <Building2 size={24} className="text-rose-400" />,
      navigateTo: '/mai-business/profile',
    },
    {
      id: 'track-progress',
      title: 'Track Progress',
      description: 'Monitor your startup journey and milestones',
      icon: <Target size={24} className="text-indigo-400" />,
      navigateTo: '/mai-business/progress',
    },
  ];

  const handleNavigate = async (option: StarterOption) => {
    if (option.id === 'profile') {
      navigate(option.navigateTo);
      return;
    }
    setLoading(true);
    try {
      navigate(option.navigateTo);
    } catch {
      toast.error('Failed to navigate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black mb-2">
            <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              Start Your Business
            </span>
          </h1>
          <p className="text-zinc-400 text-lg max-w2xl">
            Follow the structured path to launch your business. Each step will guide you through
            the essentials you need to get from idea to launch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {starterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleNavigate(option)}
              disabled={loading}
              className={`p-6 rounded-2xl border transition-all text-left group ${glass} ${cardHover}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-zinc-800/50 rounded-xl group-hover:scale-110 transition-transform">
                  {option.icon}
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {option.title}
                </h3>
              </div>
              <p className="text-sm text-zinc-400 group-hover:text-zinc-300">
                {option.description}
              </p>
            </button>
          ))}
        </div>

        <div className={`mt-12 p-6 rounded-2xl ${glass} text-center`}>
          <Rocket size={48} className="mx-auto text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Ready to Launch?</h2>
          <p className="text-zinc-400 mb-4">
            Complete all onboarding steps to unlock full MAI Business features.
          </p>
          <button
            onClick={() => navigate('/mai-business/education')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all"
          >
            Start with Education First
          </button>
        </div>
      </div>
    </div>
  );
}
