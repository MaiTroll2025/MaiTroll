import React, { useMemo } from 'react'
import { Users, Heart } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StreamAudienceMember } from '../../hooks/useStreamAudiencePresence'
import { formatCoins } from './formatAudienceCoins'
import MaiBag from '@/components/mai-bag/MaiBag'

interface MobileAudienceTickerProps {
  audience: StreamAudienceMember[]
  currentUserId?: string
  hostUserId?: string
  viewerCount?: number
  likes?: number
  maxVisible?: number
  onModerateUser?: (info: { userId: string; username?: string; role?: string }) => void
  onViewerCountClick?: () => void
  className?: string
  streamId?: string
  phone?: boolean
}

export default function MobileAudienceTicker({
  audience,
  currentUserId,
  hostUserId,
  viewerCount = 0,
  likes = 0,
  maxVisible = 8,
  onModerateUser,
  onViewerCountClick,
  className = '',
  streamId,
  phone = false,
}: MobileAudienceTickerProps) {
  const isStaff = useMemo(() => {
    return Boolean(
      currentUserId &&
        audience.some(
          (m) => m.user_id === currentUserId && (m.role === 'broadcaster' || m.role === 'seat'),
        ),
    )
  }, [audience, currentUserId])

  const isBroadcaster = useMemo(() => {
    return Boolean(currentUserId && hostUserId && currentUserId === hostUserId)
  }, [currentUserId, hostUserId])

  const sorted = useMemo(() => {
    const active = audience.filter((m) => m.is_active && !m.left_at)
    return [...active]
      .sort((a, b) => {
        const ag = a.gift_score ?? a.gift_total ?? 0
        const bg = b.gift_score ?? b.gift_total ?? 0
        if (bg !== ag) return bg - ag
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      })
      .slice(0, maxVisible)
  }, [audience, maxVisible])

  const overflow = Math.max(0, audience.filter((m) => m.is_active && !m.left_at).length - maxVisible)

  const canModerate = (m: StreamAudienceMember) => {
    if (m.user_id === currentUserId) return false
    if (!hostUserId) return false
    return currentUserId === hostUserId || isStaff
  }

  return (
    <div className={cn('flex w-full items-center', phone ? 'gap-1.5' : 'gap-2', className)}>
      {/* Viewer count chip */}
      <button
        type="button"
        onClick={onViewerCountClick}
        className={cn(
          'flex shrink-0 items-center rounded-full border border-white/10 bg-black/40 font-bold text-white/80 backdrop-blur-md transition-colors hover:bg-white/10',
          phone ? 'gap-0.5 px-1.5 py-0.5 text-[9px]' : 'gap-1 px-2 py-1 text-[10px]',
        )}
      >
        <Users className={cn('text-cyan-300', phone ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        {viewerCount}
      </button>

      {/* Mai Bag integrated into the viewer counter (broadcaster only).
          Clicking the bag opens Mai Bag gift configuration; clicking the
          viewer count opens the all-viewers list. */}
      {isBroadcaster && streamId && (
        <MaiBag
          streamId={streamId}
          phone={phone}
          className="shrink-0"
        />
      )}

      {/* Likes chip */}
      {likes > 0 && (
        <div className={cn(
          'flex shrink-0 items-center rounded-full border border-white/10 bg-black/40 font-bold text-white/80 backdrop-blur-md',
          phone ? 'gap-0.5 px-1.5 py-0.5 text-[9px]' : 'gap-1 px-2 py-1 text-[10px]',
        )}>
          <Heart className={cn('text-pink-400', phone ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          {likes.toLocaleString()}
        </div>
      )}

      {/* Mini profile pics row */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
        {sorted.map((m) => {
          const coins = m.gift_score ?? m.gift_total ?? 0
          const coinLabel = formatCoins(coins)
          const isCurrent = m.user_id === currentUserId
          const firstLetter = m.username?.charAt(0)?.toUpperCase() || '?'
          return (
            <button
              key={`${m.id}-${m.user_id}`}
              type="button"
              onClick={() => canModerate(m) && onModerateUser?.({ userId: m.user_id, username: m.username, role: m.role })}
              className={cn(
                'relative flex shrink-0 flex-col items-center justify-center',
                canModerate(m) ? 'cursor-pointer' : 'cursor-default',
              )}
              title={m.username}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center overflow-hidden rounded-full border bg-white/10 shadow-[0_0_8px_rgba(34,211,238,0.18)] backdrop-blur-sm',
                  phone ? 'h-6 w-6' : 'h-8 w-8',
                  isCurrent ? 'border-cyan-400/60 ring-1 ring-cyan-400/60' : 'border-cyan-400/30',
                )}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.username} className="h-full w-full object-cover" />
                ) : (
                  <span className={cn('font-black text-cyan-100', phone ? 'text-[9px]' : 'text-[11px]')}>{firstLetter}</span>
                )}
                {m.role === 'broadcaster' && (
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-yellow-300/30 bg-yellow-500 px-1 text-[6px] font-black uppercase leading-3 text-white">
                    H
                  </span>
                )}
              </div>
              {coinLabel && (
                <span className={cn('font-black leading-none text-cyan-300', phone ? 'text-[6px]' : 'mt-0.5 text-[7px]')}>
                  {coinLabel}💎
                </span>
              )}
            </button>
          )
        })}
        {overflow > 0 && (
          <div className={cn(
            'flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 font-black uppercase text-white/80',
            phone ? 'px-1.5 py-0.5 text-[8px]' : 'px-2 py-1 text-[9px]',
          )}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}
