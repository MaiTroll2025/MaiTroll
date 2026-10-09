import React, { useMemo } from 'react';
import { AgencyWeeklyStats, TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';

interface WeeklyActivityChartProps {
  data: AgencyWeeklyStats[];
}

const barColors: Record<string, string> = {
  stream_hours_points: 'from-cyan-500 to-blue-500',
  platform_share_points: 'from-purple-500 to-fuchsia-500',
  viewer_points: 'from-emerald-500 to-green-500',
  registration_points: 'from-amber-500 to-orange-500',
  tier_bonus_points: 'from-yellow-400 to-amber-500',
};

const barLabels: Record<string, string> = {
  stream_hours_points: 'Stream',
  platform_share_points: 'Shares',
  viewer_points: 'Viewers',
  registration_points: 'Signups',
  tier_bonus_points: 'Bonus',
};

export default function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  const sortedData = useMemo(
    () => [...data].sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()),
    [data],
  );

  const maxTotal = useMemo(
    () => Math.max(...sortedData.map((d) => d.total_points), 1),
    [sortedData],
  );

  const formatWeek = (weekStart: string) => {
    const date = new Date(weekStart);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (sortedData.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-xl">
        <p className="text-sm text-slate-400">No weekly activity data available yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <h3 className="mb-4 text-lg font-black text-cyan-300">Weekly Activity</h3>
      <div className="flex items-end gap-2 sm:gap-3">
        {sortedData.map((week, _index) => {
          const _heightPercent = (week.total_points / maxTotal) * 100;
          const tierConfig = TIER_CONFIG[week.tier_at_end];

          return (
            <div key={week.id} className="group relative flex flex-1 flex-col items-center">
              <div className="pointer-events-none absolute -top-24 left-1/2 z-10 hidden -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm group-hover:block">
                <p className="mb-1 font-bold text-white">{formatWeek(week.week_start)}</p>
                <div className="space-y-0.5">
                  {Object.entries(barColors).map(([key, _]) => {
                    const val = week[key as keyof AgencyWeeklyStats] as number;
                    if (val <= 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className="text-slate-400">{barLabels[key]}:</span>
                        <span className="font-bold text-white">{val}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 border-t border-white/10 pt-1 font-black" style={{ color: tierConfig.color.includes('amber') ? '#d97706' : tierConfig.color.includes('slate-30') ? '#cbd5e1' : tierConfig.color.includes('yellow') ? '#facc15' : tierConfig.color.includes('purple') ? '#c084fc' : '#94a3b8' }}>
                  Total: {week.total_points}
                </p>
              </div>
              <div className="relative mb-2 flex h-40 w-full flex-col justify-end overflow-hidden rounded-t-lg bg-black/20">
                {Object.entries(barColors).map(([key, gradient]) => {
                  const val = week[key as keyof AgencyWeeklyStats] as number;
                  if (val <= 0) return null;
                  const segmentPercent = (val / maxTotal) * 100;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'w-full bg-gradient-to-t transition-all duration-500',
                        gradient,
                        'opacity-80 group-hover:opacity-100',
                      )}
                      style={{ height: `${segmentPercent}%` }}
                    />
                  );
                })}
                {week.total_points === 0 && (
                  <div className="w-full self-end rounded-t bg-slate-700/40" style={{ height: '4px' }} />
                )}
              </div>
              <span className="text-[0.65rem] font-bold text-slate-500">
                {formatWeek(week.week_start)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 border-t border-white/5 pt-3">
        {Object.entries(barLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('h-2.5 w-2.5 rounded-sm bg-gradient-to-r', barColors[key])} />
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
