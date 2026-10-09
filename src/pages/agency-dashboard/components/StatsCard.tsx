import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const trendConfig = {
  up: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  down: {
    icon: TrendingDown,
    color: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  neutral: {
    icon: Minus,
    color: 'text-slate-400',
    glow: 'shadow-slate-500/20',
  },
};

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export default function StatsCard({ icon, label, value, subValue, trend }: StatsCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null;
  const TrendIcon = trendInfo?.icon;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl',
        'shadow-2xl shadow-black/20 transition-all duration-300',
        'hover:border-white/20 hover:bg-white/[0.06]',
        trendInfo && `hover:shadow-lg ${trendInfo.glow}`,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {subValue && (
            <p className="mt-1 text-xs text-slate-500">{subValue}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-xl bg-white/[0.06] p-2.5 text-cyan-300">
            {icon}
          </div>
          {trendInfo && TrendIcon && (
            <TrendIcon className={cn('h-4 w-4', trendInfo.color)} />
          )}
        </div>
      </div>
    </div>
  );
}
