import React, { useState } from 'react';
import { Info } from 'lucide-react';
import LearnAboutMaiTrollModal from './LearnAboutMaiTrollModal';

export default function LearnAboutMaiTrollBanner() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900/60 via-slate-900 to-pink-900/60 px-4 py-3 sm:px-5 sm:py-4 text-left transition-all duration-300 hover:border-purple-400/40 hover:shadow-[0_8px_32px_rgba(147,51,234,0.15)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.12),transparent_40%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-600/20 text-purple-300">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white sm:text-base">Learn About MaiTroll</p>
            <p className="text-xs text-slate-400 sm:text-sm">Click here if you're new to Learn </p>
          </div>
          <div className="shrink-0 rounded-full bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-300 group-hover:bg-purple-600/30 transition-colors">
            Click to explore
          </div>
        </div>
      </button>

      <LearnAboutMaiTrollModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
