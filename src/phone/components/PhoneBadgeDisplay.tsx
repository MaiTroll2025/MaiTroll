import React from 'react'
import { cn } from '@/lib/utils'
import { PhoneBadge } from './PhoneBadge'
import { useUserBadgeLog, useUserBadges } from '@/hooks/useBadges'

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
  const [showBadgeLog, setShowBadgeLog] = React.useState(false)

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
    <>
      <div className={cn('flex items-center gap-1', className)}>
        {visibleBadges.map((badge) => (
          <button
            key={badge.slug}
            type="button"
            aria-label={`View ${badge.name} and badge log`}
            onClick={() => setShowBadgeLog(true)}
            className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <PhoneBadge badge={badge} size={size} />
          </button>
        ))}
        {remainingCount > 0 && (
          <button
            type="button"
            aria-label={`View all ${badges.length} badges`}
            onClick={() => setShowBadgeLog(true)}
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-xl',
              'border border-white/20 bg-white/5 text-white/50',
              SIZE_CLASSES[size],
              'font-black'
            )}
          >
            +{remainingCount}
          </button>
        )}
      </div>
      {showBadgeLog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowBadgeLog(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-badge-log-title"
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#100d19] p-5 text-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="phone-badge-log-title" className="text-lg font-black">Badge Log</h2>
                <p className="text-xs text-white/50">{badges.length} earned badges</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBadgeLog(false)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
            <PhoneBadgeList userId={userId} />
          </section>
        </div>
      )}
    </>
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
  const { badges, loading } = useUserBadgeLog(userId)

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
          {category ? `No ${category} badges available` : 'No badges available yet'}
        </p>
        <p className="mt-1 text-[9px] text-zinc-600">
          Badge definitions will appear here when they are added to the catalog.
        </p>
      </div>
    )
  }

  const categories = [...new Set(filteredBadges.map(badge => badge.category))]
  const badgesByCategory = categories.map(category => ({
    category,
    badges: filteredBadges.filter(badge => badge.category === category),
  }))

  return (
    <div className={cn('space-y-6', className)}>
      <p className="text-xs text-white/55">
        {filteredBadges.filter(badge => badge.earned).length} earned
        {' · '}
        {filteredBadges.filter(badge => !badge.earned).length} not earned
      </p>
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
            {catBadges.map(badge => (
              <div
                key={badge.slug}
                title={badge.earned
                  ? `${badge.name} — earned${badge.earned_at ? ` ${new Date(badge.earned_at).toLocaleDateString()}` : ''}`
                  : `${badge.name} — not earned`}
                className={cn(
                  'flex min-w-20 flex-col items-center gap-1 rounded-xl border p-2 text-center',
                  badge.earned
                    ? 'border-white/10 bg-black/20'
                    : 'border-white/5 bg-white/[0.02] opacity-55 grayscale',
                )}
              >
                <PhoneBadge badge={badge} size="md" showTooltip={false} />
                <span className="max-w-24 truncate text-[10px] font-semibold text-white/80">
                  {badge.name}
                </span>
                <span className={cn(
                  'text-[9px] font-bold',
                  badge.earned ? 'text-emerald-300' : 'text-white/40',
                )}>
                  {badge.earned ? 'Earned' : 'Not earned'}
                </span>
                {badge.earned_at && (
                  <span className="text-[8px] text-white/35">
                    {new Date(badge.earned_at).toLocaleDateString()}
                  </span>
                )}
              </div>
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