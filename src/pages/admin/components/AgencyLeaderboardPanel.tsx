import { useAdminAgencyLeaderboard } from '@/hooks/useAdminAgency';
import { TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';
import { Trophy, Loader2, Medal, Crown, Star, TrendingUp } from 'lucide-react';

const rankStyles: Record<number, { bg: string; border: string; text: string; glow: string; icon: typeof Trophy }> = {
  1: {
    bg: 'bg-gradient-to-r from-yellow-500/15 to-amber-600/10',
    border: 'border-yellow-400/40',
    text: 'text-yellow-300',
    glow: 'shadow-[0_0_30px_rgba(255,215,0,0.15)]',
    icon: Trophy,
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-400/15 to-slate-500/10',
    border: 'border-slate-300/40',
    text: 'text-slate-200',
    glow: 'shadow-[0_0_25px_rgba(192,192,192,0.12)]',
    icon: Medal,
  },
  3: {
    bg: 'bg-gradient-to-r from-amber-700/15 to-amber-800/10',
    border: 'border-amber-600/40',
    text: 'text-amber-500',
    glow: 'shadow-[0_0_20px_rgba(180,120,40,0.12)]',
    icon: Medal,
  },
};

export default function AgencyLeaderboardPanel() {
  const { leaderboard, loading, error, refresh } = useAdminAgencyLeaderboard();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/20 p-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Weekly Leaderboard</h2>
            <p className="text-sm text-slate-400">Top performers ranked by weekly points</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Loader2 className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading && !leaderboard.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-300">
          <p className="font-bold">Error loading leaderboard</p>
          <p className="mt-1 text-sm text-red-400">{error}</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No leaderboard data</h3>
          <p className="mt-1 text-sm text-slate-500">Leaderboard entries will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry) => {
            const tierConfig = TIER_CONFIG[entry.current_tier as keyof typeof TIER_CONFIG];
            const top3Style = rankStyles[entry.rank];
            const isTop3 = entry.rank <= 3;

            return (
              <div
                key={entry.user_id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border backdrop-blur-xl',
                  'shadow-2xl shadow-black/20 transition-all duration-300',
                  isTop3
                    ? cn(top3Style.bg, top3Style.border, top3Style.glow, 'hover:bg-white/[0.08]')
                    : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]',
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex items-center gap-4 p-5">
                  <div className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-black text-lg',
                    isTop3
                      ? cn(top3Style.bg, top3Style.border, top3Style.text, 'border')
                      : 'border border-white/10 bg-black/30 text-slate-400',
                  )}>
                    {isTop3 ? (
                      entry.rank === 1 ? <Crown className="w-6 h-6" /> :
                      <Star className="w-5 h-5" />
                    ) : (
                      `#${entry.rank}`
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn(
                        'font-black truncate',
                        isTop3 ? top3Style.text : 'text-white',
                      )}>
                        @{entry.display_name}
                      </h3>
                      {tierConfig && (
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider',
                          tierConfig.borderColor,
                          tierConfig.bgColor,
                          tierConfig.color,
                        )}>
                          {tierConfig.icon} {tierConfig.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-500">
                        Total: <span className="font-bold text-slate-300">{entry.total_points.toLocaleString()}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        Lifetime: <span className="font-bold text-slate-300">{entry.lifetime_points.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={cn(
                      'flex items-center gap-1',
                      isTop3 ? top3Style.text : 'text-cyan-300',
                    )}>
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xl font-black">{entry.weekly_points.toLocaleString()}</span>
                    </div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Weekly Pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
