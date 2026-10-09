import React from 'react';
import { AgencyTier, TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';
import { Crown, Shield, Award, Star, Circle } from 'lucide-react';

const tierIcons: Record<AgencyTier, React.ElementType> = {
  none: Circle,
  bronze: Award,
  silver: Star,
  gold: Shield,
  legend: Crown,
};

const tierGradientMap: Record<AgencyTier, string> = {
  none: 'from-slate-500/20 to-slate-600/10',
  bronze: 'from-amber-700/25 to-amber-900/10',
  silver: 'from-slate-400/25 to-slate-600/10',
  gold: 'from-yellow-500/25 to-amber-600/10',
  legend: 'from-purple-500/25 to-fuchsia-600/10',
};

const tierTextGlowMap: Record<AgencyTier, string> = {
  none: '',
  bronze: 'drop-shadow-[0_0_6px_rgba(180,120,40,0.5)]',
  silver: 'drop-shadow-[0_0_6px_rgba(192,192,192,0.5)]',
  gold: 'drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]',
  legend: 'drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]',
};

const sizeClasses = {
  sm: 'px-2.5 py-1 text-xs gap-1',
  md: 'px-3.5 py-1.5 text-sm gap-1.5',
  lg: 'px-5 py-2.5 text-base gap-2',
};

const iconSizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

interface TierBadgeProps {
  tier: AgencyTier;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export default function TierBadge({ tier, size = 'md', animated = false }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const Icon = tierIcons[tier];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-black uppercase tracking-wider',
        'bg-gradient-to-r backdrop-blur-sm',
        'transition-all duration-300',
        sizeClasses[size],
        config.borderColor,
        config.bgColor,
        config.color,
        config.glowClass,
        tierTextGlowMap[tier],
        tierGradientMap[tier],
        animated && 'animate-pulse',
      )}
    >
      <Icon className={cn(iconSizeClasses[size], 'flex-shrink-0')} />
      <span>{config.label}</span>
    </span>
  );
}
