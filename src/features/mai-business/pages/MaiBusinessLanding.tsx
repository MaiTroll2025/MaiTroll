import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  TrendingUp,
  Award,
  FileText,
  LifeBuoy,
  GraduationCap,
  Briefcase,
  Building2,
  Scale,
  Shield,
  Globe,
} from 'lucide-react';
import { maiBusinessApi } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function MaiBusinessLanding() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const loading = false;

  useEffect(() => {
    if (user) {
      maiBusinessApi.ensureProfile().catch(console.error);
    }
  }, [user]);

  const handleGetStarted = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate('/mai-business/dashboard');
  };

  const features = [
    { icon: GraduationCap, title: 'Entrepreneurship Education', desc: '8-week fundamentals course covering business formation, finance, credit, planning, and more.' },
    { icon: Briefcase, title: 'Business Plan Builder', desc: 'Create, save, version, and export professional business plans as PDF documents.' },
    { icon: TrendingUp, title: 'Credit Education', desc: 'Learn about personal and business credit, credit scores, and building business credit responsibly.' },
    { icon: Scale, title: 'Funding Opportunities', desc: 'Discover verified grants, government programs, and legitimate funding opportunities for startups.' },
    { icon: Award, title: 'Certificates', desc: 'Earn certificates for course completion and final exam mastery.' },
    { icon: FileText, title: 'Professional Documents', desc: 'Generate official PDF documents with secure Mai stamp for business plans, certificates, and applications.' },
    { icon: Building2, title: 'Local Resources', desc: 'Find SBDCs, colleges, universities, and local entrepreneur resources in your area.' },
    { icon: LifeBuoy, title: 'Instructor Support', desc: 'Apply to become an instructor or work with approved instructors for guidance.' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-slate-950 to-cyan-950/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-500/10 to-transparent rounded-full blur-3xl" />

        <div className="relative container mx-auto px-4 pt-20 pb-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm font-medium text-purple-300 mb-6">
              <GraduationCap size={16} />
              <span>A MAiTROLL Program</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-black mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400">
                MAI BUSINESS
              </span>
            </h1>

            <p className="text-2xl text-zinc-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Learn. Build. Grow.
            </p>

            <p className="text-lg text-zinc-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Learn how to start a business, create a business plan, understand business credit,
              discover legitimate funding opportunities, and prepare for growth.
            </p>

            <button
              onClick={handleGetStarted}
              disabled={loading}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white font-bold rounded-2xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(136,84,236,0.3)] disabled:opacity-50"
            >
              <span className="text-lg">{user ? 'Go to Dashboard' : 'Get Started'}</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 max-w-6xl mx-auto">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className={`p-6 rounded-2xl ${glass}`}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mb-4 border border-white/10">
                    <Icon size={24} className="text-cyan-400" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>

          <div className={`p-8 rounded-3xl ${glass} max-w-5xl mx-auto`}>
            <h2 className="text-2xl font-bold text-white mb-6 text-center">What MAI Business Offers</h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300 mb-2">8</div>
                <p className="text-zinc-400 text-sm">Week curriculum</p>
              </div>
              <div>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300 mb-2">56</div>
                <p className="text-zinc-400 text-sm">Lessons + assessments</p>
              </div>
              <div>
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-300 mb-2">100%</div>
                <p className="text-zinc-400 text-sm">Verified resources</p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center text-xs text-zinc-500 max-w-3xl mx-auto">
            <p className="mb-2">
              <Shield size={12} className="inline mr-1" />
              MAI Business is a nonprofit entrepreneur-development program.
            </p>
            <p className="mb-2">
              <Scale size={12} className="inline mr-1" />
              Funding is NOT guaranteed. Course completion does not guarantee grants, loans, funding, approval, or business success.
            </p>
            <p>
              <Globe size={12} className="inline mr-1" />
              All funding opportunities and resources are verified against official sources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
