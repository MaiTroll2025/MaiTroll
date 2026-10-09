import React from 'react'
import { cn } from '@/lib/utils'
import { PhoneBadge } from './PhoneBadge'
import { useUserBadges } from '@/hooks/useBadges'

interface PhoneBadgeDisplayProps {
  userId: string
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PhoneBadgeDisplay({
  userId,
  maxVisible = 4,
  size = 'md',
  className,
}: PhoneBadgeDisplayProps) {
  const { badges, loading } = useUserBadges(userId)

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {[...Array(maxVisible)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse flex-shrink-0 flex items-center justify-center rounded-xl',
              'bg-white/5 border border-white/10',
              SIZE_CLASSES[size]
            )}
          />
        ))}
      </div>
    )
  }

  if (badges.length === 0) {
    return null
  }

  const visibleBadges = badges.slice(0, maxVisible)
  const remainingCount = badges.length - maxVisible

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {visibleBadges.map((badge) => (
        <PhoneBadge key={badge.slug} badge={badge} size={size} />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-xl',
            'border border-white/20 bg-white/5 text-white/50',
            SIZE_CLASSES[size],
            'font-black'
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
}

interface PhoneBadgeListProps {
  userId: string
  category?: string
  className?: string
}

export function PhoneBadgeList({
  userId,
  category,
  className,
}: PhoneBadgeListProps) {
  const { badges, loading } = useUserBadges(userId)

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-white/10" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-white/10 rounded" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const filteredBadges = category
    ? badges.filter(b => b.category === category)
    : badges

  if (filteredBadges.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-10 text-center', className)}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <span className="text-2xl">🏅</span>
        </div>
        <p className="mt-3 text-sm font-black text-zinc-400">
          {category ? `No ${category} badges yet` : 'No badges earned yet'}
        </p>
        <p className="mt-1 text-[9px] text-zinc-600">
          Complete milestones, level up, and participate in events to earn badges!
        </p>
      </div>
    )
  }

  // Group by category
  const categories = ['gender', 'level', 'league', 'milestone', 'special', 'event', 'role']
  const badgesByCategory = categories.map(cat => ({
    category: cat,
    badges: filteredBadges.filter(b => b.category === cat)
  })).filter(g => g.badges.length > 0)

  return (
    <div className={cn('space-y-6', className)}>
      {badgesByCategory.map(({ category, badges: catBadges }) => (
        <div key={category} className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: getCategoryColor(category) }}
            />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
            <span className="text-[9px] font-black text-zinc-500">
              ({catBadges.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {catBadges.map((badge) => (
              <PhoneBadge key={badge.slug} badge={badge} size="sm" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'gender': return '#EC4899'
    case 'level': return '#FBBF24'
    case 'league': return '#3B82F6'
    case 'milestone': return '#22C55E'
    case 'special': return '#A855F7'
    case 'event': return '#F59E0B'
    case 'role': return '#EF4444'
    default: return '#94A3B8'
  }
}

export default PhoneBadgeDisplay