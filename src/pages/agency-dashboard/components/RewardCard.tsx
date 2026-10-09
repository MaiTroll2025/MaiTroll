import React from 'react';
import { AgencyReward, AgencyRewardStatus, TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';
import { Gift, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const statusConfig: Record<AgencyRewardStatus, { icon: React.ElementType; label: string; className: string }> = {
  pending: { icon: Clock, label: 'Pending', className: 'border-amber-300/30 bg-amber-500/10 text-amber-100' },
  available: { icon: Gift, label: 'Available', className: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' },
  claimed: { icon: CheckCircle2, label: 'Claimed', className: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' },
  expired: { icon: XCircle, label: 'Expired', className: 'border-red-300/30 bg-red-500/10 text-red-100' },
  revoked: { icon: AlertTriangle, label: 'Revoked', className: 'border-red-300/30 bg-red-500/10 text-red-100' },
};

interface RewardCardProps {
  reward: AgencyReward;
  onClaim?: (id: string) => void;
}

export default function RewardCard({ reward, onClaim }: RewardCardProps) {
  const status = statusConfig[reward.status];
  const StatusIcon = status.icon;
  const tierConfig = TIER_CONFIG[reward.tier_requirement];
  const isAvailable = reward.status === 'available';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl',
        'shadow-2xl shadow-black/20 transition-all duration-300',
        'hover:border-white/20 hover:bg-white/[0.06]',
        isAvailable && 'hover:shadow-lg hover:shadow-purple-500/10',
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider', status.className)}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span className={cn('rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider', tierConfig.borderColor, tierConfig.bgColor, tierConfig.color)}>
                {tierConfig.icon} {tierConfig.label}
              </span>
            </div>
            <h4 className="mt-3 text-base font-black text-white">{reward.title}</h4>
            {reward.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{reward.description}</p>
            )}
          </div>
          <div className="rounded-xl bg-white/[0.06] p-3 text-2xl">
            🎁
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
            <span className="text-slate-500">Cost: </span>
            <span className="font-bold text-white">{reward.points_cost.toLocaleString()} pts</span>
          </div>
          {reward.coin_value > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
              <span className="text-slate-500">Value: </span>
              <span className="font-bold text-amber-300">{reward.coin_value.toLocaleString()} coins</span>
            </div>
          )}
          {reward.expires_at && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
              <span className="text-slate-500">Expires: </span>
              <span className="font-bold text-slate-300">
                {new Date(reward.expires_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        {isAvailable && onClaim && (
          <button
            type="button"
            onClick={() => onClaim(reward.id)}
            className={cn(
              'mt-4 w-full rounded-xl border border-purple-300/40 bg-purple-500/15 px-4 py-2.5 text-sm font-black uppercase tracking-wider text-purple-100',
              'transition-all duration-200 hover:bg-purple-500/25 hover:shadow-lg hover:shadow-purple-500/20',
              'active:scale-[0.98]',
            )}
          >
            Claim Reward
          </button>
        )}
      </div>
    </div>
  );
}
