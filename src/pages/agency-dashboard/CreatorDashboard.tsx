import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { Loader } from '../../components/ui/loader';
import { TierBadge } from './components/TierBadge';
import { ProgressBar } from './components/ProgressBar';
import { StatsCard } from './components/StatsCard';
import { WeeklyActivityChart } from './components/WeeklyActivityChart';
import { RewardCard } from './components/RewardCard';
import { TierBenefits } from './components/TierBenefits';
import { useAgencyMember, useAgencyTransactions, useAgencyWeeklyStats, useAgencyRewards, useAgencyLeaderboard } from '../../hooks/useAgency';
import { useAgencyApplication } from '../../hooks/useAgency';
import { TIER_CONFIG } from '../../types/agency';
import type { AgencyTier } from '../../types/agency';
import { Crown, TrendingUp, Zap, Gift, Award, ArrowUpRight, History, Trophy, Clock3 } from 'lucide-react';
import './agency-dashboard.css';

export default function CreatorDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { member, loading: memberLoading, tierInfo, progressPercent, pointsToNext } = useAgencyMember();
  const { transactions, loading: txLoading } = useAgencyTransactions(20);
  const { stats, currentWeek, loading: statsLoading } = useAgencyWeeklyStats(8);
  const { availableRewards, claimReward, loading: rewardsLoading } = useAgencyRewards();
  const { leaderboard, loading: lbLoading } = useAgencyLeaderboard();
  const { application } = useAgencyApplication();

  if (memberLoading) return <Loader />;

  if (!member && !application) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-8 max-w-md w-full text-center">
          <Crown className="mx-auto mb-4 h-16 w-16 text-purple-400" />
          <h2 className="text-2xl font-black mb-3 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Join the Agency
          </h2>
          <p className="text-slate-400 mb-6">
            Apply to become a HytroGaming agency creator and start earning points for your content.
          </p>
          <button
            onClick={() => navigate('/agency-apply')}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-bold text-white transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.4)]"
          >
            Apply Now
          </button>
        </div>
      </div>
    );
  }

  if (!member && application?.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl border border-yellow-400/20 bg-yellow-500/5 backdrop-blur-2xl p-8 max-w-md w-full text-center">
          <Clock3 className="mx-auto mb-4 h-16 w-16 text-yellow-400" />
          <h2 className="text-2xl font-black mb-3 text-yellow-300">Application Pending</h2>
          <p className="text-slate-400 mb-2">
            Your agency application is under review.
          </p>
          <p className="text-sm text-slate-500">
            Submitted: {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  if (!member) return <Loader />;

  const myRank = leaderboard.findIndex(l => l.user_id === member.user_id) + 1;
  const recentTx = transactions.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Creator Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Welcome back, {profile?.username || 'Creator'}</p>
          </div>
          <div className="flex items-center gap-3">
            <TierBadge tier={member.current_tier} size="lg" animated />
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 shadow-[0_0_40px_rgba(147,51,234,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-4xl">{tierInfo.icon}</span>
                <div>
                  <h2 className={`text-2xl font-black ${tierInfo.color}`}>{tierInfo.label} Tier</h2>
                  <p className="text-sm text-slate-400">
                    {member.total_points.toLocaleString()} total points
                    {member.current_tier !== 'legend' && ` · ${pointsToNext.toLocaleString()} to ${TIER_CONFIG[member.current_tier === 'none' ? 'bronze' : member.current_tier === 'bronze' ? 'silver' : member.current_tier === 'silver' ? 'gold' : 'legend'].label}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <ProgressBar
                current={member.total_points}
                max={member.current_tier === 'legend' ? member.total_points : TIER_CONFIG[member.current_tier === 'none' ? 'bronze' : member.current_tier === 'bronze' ? 'silver' : member.current_tier === 'silver' ? 'gold' : 'legend'].threshold}
                tier={member.current_tier}
                animated
              />
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            icon={<Zap className="h-5 w-5 text-cyan-400" />}
            label="Weekly Points"
            value={currentWeek?.total_points || 0}
            subValue="This week"
            trend="up"
          />
          <StatsCard
            icon={<TrendingUp className="h-5 w-10 text-purple-400" />}
            label="Total Points"
            value={member.total_points.toLocaleString()}
            subValue="All time"
          />
          <StatsCard
            icon={<Award className="h-5 w-5 text-yellow-400" />}
            label="Lifetime Points"
            value={member.lifetime_points.toLocaleString()}
            subValue="Earned"
          />
          <StatsCard
            icon={<Trophy className="h-5 w-5 text-amber-400" />}
            label="Rank"
            value={myRank > 0 ? `#${myRank}` : '—'}
            subValue={`of ${leaderboard.length} creators`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6">
              <h3 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-400" />
                Weekly Activity
              </h3>
              <WeeklyActivityChart data={stats.slice().reverse()} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6">
              <h3 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-400" />
                Available Rewards
              </h3>
              {availableRewards.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableRewards.slice(0, 4).map(reward => (
                    <RewardCard key={reward.id} reward={reward} onClaim={claimReward} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-slate-500">No rewards available right now. Keep earning points!</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6">
              <h3 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-blue-400" />
                Recent Activity
              </h3>
              {recentTx.length > 0 ? (
                <div className="space-y-2">
                  {recentTx.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${tx.points >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-white capitalize">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${tx.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.points >= 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-slate-500">No activity yet. Start streaming to earn points!</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6">
              <h3 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                Leaderboard
              </h3>
              {leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry, i) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        entry.user_id === member.user_id
                          ? 'border-purple-500/30 bg-purple-500/10'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                      }`}
                    >
                      <span className={`w-6 text-center text-sm font-black ${
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">{entry.display_name}</p>
                        <TierBadge tier={entry.current_tier} size="sm" />
                      </div>
                      <span className="text-sm font-bold text-cyan-300">{entry.total_points.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-slate-500">No leaderboard data yet.</p>
              )}
            </div>

            <TierBenefits currentTier={member.current_tier} />
          </div>
        </div>
      </div>
    </div>
  );
}
