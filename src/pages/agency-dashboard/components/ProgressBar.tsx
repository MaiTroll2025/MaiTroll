import React from 'react';
import { AgencyTier, TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';

const tierFillGradient: Record<AgencyTier, string> = {
  none: 'from-slate-500 to-slate-400',
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-200',
  gold: 'from-yellow-500 to-amber-400',
  legend: 'from-purple-500 to-fuchsia-400',
};

const tierGlowMap: Record<AgencyTier, string> = {
  none: '',
  bronze: 'shadow-[0_0_12px_rgba(180,120,40,0.4)]',
  silver: 'shadow-[0_0_12px_rgba(192,192,192,0.4)]',
  gold: 'shadow-[0_0_14px_rgba(255,215,0,0.5)]',
  legend: 'shadow-[0_0_16px_rgba(168,85,247,0.6)]',
};

interface ProgressBarProps {
  current: number;
  max: number;
  tier: AgencyTier;
  animated?: boolean;
}

export default function ProgressBar({ current, max, tier, animated = false }: ProgressBarProps) {
  const config = TIER_CONFIG[tier];
  const percentage = max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
        <span className={cn('uppercase tracking-wider', config.color)}>
          {current.toLocaleString()} / {max.toLocaleString()} pts
        </span>
        <span className="text-slate-400">{percentage}%</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/40 backdrop-blur-sm">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
            tierFillGradient[tier],
            tierGlowMap[tier],
            animated && 'animate-pulse',
          )}
          style={{ width: `${percentage}%` }}
        />
        <div
          className={cn(
            'absolute inset-0 rounded-full opacity-30',
            'bg-gradient-to-r from-transparent via-white/20 to-transparent',
            animated && 'animate-[shimmer_2s_infinite]',
          )}
        />
      </div>
    </div>
  );
}
