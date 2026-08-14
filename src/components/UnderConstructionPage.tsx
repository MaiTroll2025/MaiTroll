import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

interface UnderConstructionPageProps {
  pageName?: string;
  openingDate?: string;
}

export default function UnderConstructionPage({ pageName, openingDate }: UnderConstructionPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const path = searchParams.get('path');
  const displayName = pageName || (path ? path.replace('/', '').replace(/-/g, ' ') : 'This page');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white gap-4 overflow-y-auto px-5 py-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-2 border-amber-500/30 flex items-center justify-center">
          <Construction size={36} className="text-amber-400 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-black text-[10px] font-black">!</span>
        </div>
      </div>

      <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 text-center">
        Under Construction
      </h1>

      <p className="text-center text-zinc-400 max-w-sm text-sm leading-relaxed px-2">
        <span className="text-white font-bold capitalize">{displayName}</span> is currently being built and is not accessible yet.
        Check back later!
      </p>

      {openingDate && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Opening {openingDate}</span>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Coming Soon</span>
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-amber-500/20"
      >
        <ArrowLeft size={18} />
        Return Home
      </button>
    </div>
  );
}
