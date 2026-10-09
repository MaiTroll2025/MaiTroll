import React from 'react';
import { AgencyTier, TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';
import { CheckCircle2, Lock, ArrowRight } from 'lucide-react';

const tierOrder: AgencyTier[] = ['none', 'bronze', 'silver', 'gold', 'legend'];

const tierBenefits: Record<AgencyTier, string[]> = {
  none: [
    'Access to agency application',
    'Basic profile visibility',
    'Community chat access',
  ],
  bronze: [
    'All None tier benefits',
    'Weekly point tracking',
    'Basic reward eligibility',
    'Agency member badge',
    'Priority support queue',
  ],
  silver: [
    'All Bronze tier benefits',
    'Enhanced reward catalog',
    'Monthly bonus points',
    'Custom profile flair',
    'Early access to features',
  ],
  gold: [
    'All Silver tier benefits',
    'Premium reward catalog',
    'Weekly bonus multiplier',
    'Dedicated support channel',
    'Exclusive agency events',
    'Revenue share eligibility',
  ],
  legend: [
    'All Gold tier benefits',
    'VIP reward catalog',
    'Maximum bonus multiplier',
    'Direct line to agency HR',
    'Custom role creation',
    'Highest revenue share tier',
    'Exclusive Legend badge & flair',
  ],
};

interface TierBenefitsProps {
  currentTier: AgencyTier;
}

export default function TierBenefits({ currentTier }: TierBenefitsProps) {
  const currentIndex = tierOrder.indexOf(currentTier);
  const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  const currentConfig = TIER_CONFIG[currentTier];
  const nextConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl',
          currentConfig.borderColor,
          'bg-white/[0.04]',
          currentConfig.glowClass,
        )}
      >
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-30', {
          'from-slate-500/10 to-slate-600/5': currentTier === 'none',
          'from-amber-700/15 to-amber-900/5': currentTier === 'bronze',
          'from-slate-400/15 to-slate-600/5': currentTier === 'silver',
          'from-yellow-500/15 to-amber-600/5': currentTier === 'gold',
          'from-purple-500/15 to-fuchsia-600/5': currentTier === 'legend',
        })} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-xl p-2.5', currentConfig.bgColor)}>
              <span className="text-xl">{currentConfig.icon}</span>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Current Tier</p>
              <h3 className={cn('text-xl font-black', currentConfig.color)}>{currentConfig.label}</h3>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {tierBenefits[currentTier].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5">
                <CheckCircle2 className={cn('h-4 w-4 flex-shrink-0', currentConfig.color)} />
                <span className="text-sm text-slate-200">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {nextConfig && nextTier && (
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-dashed p-5 backdrop-blur-xl',
            nextConfig.borderColor,
            'bg-white/[0.03]',
          )}
        >
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/[0.06] p-2.5">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Next Tier</p>
                <h3 className={cn('text-xl font-black', nextConfig.color)}>
                  {nextConfig.icon} {nextConfig.label}
                </h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Unlock at <span className="font-bold text-slate-300">{nextConfig.threshold.toLocaleString()} points</span></span>
            </div>
            <div className="mt-4 space-y-2">
              {tierBenefits[nextTier].map((benefit) => {
                const isNew = !tierBenefits[currentTier].includes(benefit);
                return (
                  <div key={benefit} className="flex items-center gap-2.5">
                    {isNew ? (
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-purple-400" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className={cn('text-sm', isNew ? 'text-slate-300' : 'text-slate-600')}>
                      {benefit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
