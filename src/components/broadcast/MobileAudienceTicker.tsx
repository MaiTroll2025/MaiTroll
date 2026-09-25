import React, { useMemo } from 'react'
import { Users, Heart } from 'lucide-react'
import { cn } from '../../lib/utils'
import { StreamAudienceMember } from '../../hooks/useStreamAudiencePresence'

export function formatCoins(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${(k % 1 === 0 ? k.toFixed(0) : k.toFixed(1))}k`
  }
  const m = value / 1_000_000
  return `${(m % 1 === 0 ? m.toFixed(0) : m.toFixed(1))}m`
}

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
}: MobileAudienceTickerProps) {
  const isStaff = useMemo(() => {
    return Boolean(
      currentUserId &&
        audience.some(
          (m) => m.user_id === currentUserId && (m.role === 'broadcaster' || m.role === 'seat'),
        ),
    )
  }, [audience, currentUserId])

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
    <div className={cn('flex w-full items-center gap-2', className)}>
      {/* Viewer count chip */}
      <button
        type="button"
        onClick={onViewerCountClick}
        className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md hover:bg-white/10 transition-colors"
      >
        <Users className="h-3 w-3 text-cyan-300" />
        {viewerCount}
      </button>

      {/* Likes chip */}
      {likes > 0 && (
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md">
          <Heart className="h-3 w-3 text-pink-400" />
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
                  'relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-white/10 shadow-[0_0_8px_rgba(34,211,238,0.18)] backdrop-blur-sm',
                  isCurrent ? 'border-cyan-400/60 ring-1 ring-cyan-400/60' : 'border-cyan-400/30',
                )}
              >
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.username} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11px] font-black text-cyan-100">{firstLetter}</span>
                )}
                {m.role === 'broadcaster' && (
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-yellow-300/30 bg-yellow-500 px-1 text-[6px] font-black uppercase leading-3 text-white">
                    H
                  </span>
                )}
              </div>
              {coinLabel && (
                <span className="mt-0.5 text-[7px] font-black leading-none text-cyan-300">
                  {coinLabel}💎
                </span>
              )}
            </button>
          )
        })}
        {overflow > 0 && (
          <div className="flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-black uppercase text-white/80">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}
