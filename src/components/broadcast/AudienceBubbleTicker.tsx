import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../lib/store'
import { isStaffProfile } from '../../lib/staff'
import { StreamAudienceMember } from '../../hooks/useStreamAudiencePresence'

export interface ModerateUserInfo {
  userId: string
  username: string
  role?: string
  createdAt?: string
}

interface AudienceBubbleTickerProps {
  streamId: string
  audience: StreamAudienceMember[]
  currentUserId?: string
  hostUserId?: string
  maxVisible?: number
  className?: string
  onGiftUser?: (userId: string) => void
  onModerateUser?: (info: ModerateUserInfo) => void
}

const LEAVE_ANIMATION_DURATION = 5000

export function AudienceBubbleTicker({
  streamId,
  audience,
  currentUserId,
  hostUserId,
  maxVisible = 10,
  className = '',
  onGiftUser,
  onModerateUser,
}: AudienceBubbleTickerProps) {
  const { profile: currentProfile } = useAuthStore()
  const [leavingAudience, setLeavingAudience] = useState<
    Record<string, StreamAudienceMember & { expireAt: number }>
  >({})
  const previousActiveIdsRef = useRef<string[]>([])

  const isCurrentUserStaff = Boolean(
    currentProfile?.is_troll_officer || currentProfile?.is_admin || currentProfile?.is_lead_officer || currentProfile?.is_ceo || currentProfile?.is_secretary || currentProfile?.is_mod
  )

  const activeAudience = useMemo(() => {
    return audience.filter((member) => {
      if (!member.is_active || member.left_at) return false
      if (member.is_ghost_mode && !isCurrentUserStaff) return false
      return true
    })
  }, [audience, isCurrentUserStaff])

  const sortedAudience = useMemo(() => {
    return [...activeAudience].sort((a, b) => {
      const aGift = a.gift_score ?? a.gift_total ?? 0
      const bGift = b.gift_score ?? b.gift_total ?? 0
      if (bGift !== aGift) {
        return bGift - aGift
      }

      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })
  }, [activeAudience])

  useEffect(() => {
    const activeIds = activeAudience.map((member) => member.id)
    const previousIds = previousActiveIdsRef.current
    const removedIds = previousIds.filter((id) => !activeIds.includes(id))

    if (removedIds.length > 0) {
      const now = Date.now()

      setLeavingAudience((prev) => {
        const next = { ...prev }

        removedIds.forEach((id) => {
          if (next[id]) return

          const leftMember = audience.find((member) => member.id === id)

          if (leftMember) {
            next[id] = {
              ...leftMember,
              expireAt: now + LEAVE_ANIMATION_DURATION,
            }
          }
        })

        return next
      })
    }

    previousActiveIdsRef.current = activeIds
  }, [activeAudience, audience])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()

      setLeavingAudience((prev) => {
        let updated = false
        const next = { ...prev }

        Object.keys(next).forEach((id) => {
          if (next[id].expireAt <= now) {
            delete next[id]
            updated = true
          }
        })

        return updated ? next : prev
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const leavingAudienceArray = useMemo(() => {
    return Object.values(leavingAudience).sort((a, b) => {
      const bTime = new Date(b.left_at || b.last_seen_at).getTime()
      const aTime = new Date(a.left_at || a.last_seen_at).getTime()
      return bTime - aTime
    })
  }, [leavingAudience])

  const displayAudience = useMemo(() => {
    const visible = sortedAudience
      .filter((member) => !leavingAudience[member.id])
      .slice(0, maxVisible)
    const leavingExtras = leavingAudienceArray.slice(0, 2)

    return [...visible, ...leavingExtras]
  }, [sortedAudience, leavingAudienceArray, maxVisible, leavingAudience])

  if (import.meta.env.DEV) {
    console.log('[AudienceBubbleTicker]', {
      audienceLength: audience.length,
      activeAudienceLength: activeAudience.length,
      displayAudienceLength: displayAudience.length,
      sample: displayAudience.slice(0, 3).map(m => ({
        id: m.id,
        user_id: m.user_id,
        username: m.username,
        role: m.role,
        is_active: m.is_active,
        left_at: m.left_at,
        avatar_url: m.avatar_url,
      }))
    })
  }

  const overflowCount = Math.max(0, sortedAudience.length - maxVisible)

  const canModerateMember = (member: StreamAudienceMember) => {
    if (!currentProfile) return false
    if (member.user_id === currentUserId) return false

    return Boolean(
      currentProfile.id === hostUserId ||
      isStaffProfile(currentProfile)
    )
  }

  if (!streamId) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-none relative z-0 flex min-w-0 max-w-full items-start gap-2 overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent',
        className
      )}
    >
      {displayAudience.map((member) => {
        const isLeaving = !!leavingAudience[member.id]
        const isCurrentUser = member.user_id === currentUserId
        const firstLetter = member.username?.charAt(0)?.toUpperCase() || '?'

        return (
          <motion.button
            type="button"
            key={`${member.id}-${isLeaving ? 'leaving' : 'active'}-${member.user_id}`}
            initial={{ x: -18, opacity: 0 }}
            animate={{ x: isLeaving ? 24 : 0, opacity: isLeaving ? 0 : 1 }}
            transition={{ duration: isLeaving ? 0.35 : 0.28, ease: 'easeOut' }}
            className={cn(
              'pointer-events-auto flex w-12 flex-shrink-0 flex-col items-center justify-start gap-1 rounded-xl border border-transparent bg-transparent text-white transition-all duration-300',
              isLeaving && 'scale-95',
              canModerateMember(member) && 'cursor-pointer hover:translate-y-[-1px] hover:bg-white/8 focus:outline-none focus-visible:ring-0'
            )}
            title={isLeaving ? `${member.username} left the stream` : member.username}
            onClick={() => {
              if (!canModerateMember(member)) return
              onModerateUser?.({
                userId: member.user_id,
                username: member.username,
                role: member.role,
              })
            }}
            aria-label={canModerateMember(member) ? `Moderation actions for ${member.username}` : member.username}
          >
            <div
              className={cn(
                'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-400/35 bg-white/10 shadow-[0_0_10px_rgba(34,211,238,0.18)] backdrop-blur-sm',
                isCurrentUser && 'ring-2 ring-cyan-400/60'
              )}
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={`${member.username}'s avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-cyan-100">
                  {firstLetter}
                </div>
              )}

              {(member.role === 'seat' || member.seat_status === 'seated') && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-purple-300/30 bg-purple-500 px-1 text-[7px] font-black uppercase leading-3 text-white shadow">
                  S
                </span>
              )}

              {member.role === 'broadcaster' && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-yellow-300/30 bg-yellow-500 px-1 text-[7px] font-black uppercase leading-3 text-white shadow">
                  H
                </span>
              )}
            </div>

            <div className="w-full text-center">
              <div className="truncate text-[9px] font-bold leading-none text-cyan-100">
                {member.username}
              </div>

              {(member.gift_score ?? member.gift_total ?? 0) > 0 && (
                <div className="mt-0.5 text-[8px] font-black leading-none text-cyan-300">
                  {(member.gift_score ?? member.gift_total ?? 0)}💎
                </div>
              )}

              {isLeaving && (
                <div className="mt-0.5 text-[8px] font-black leading-none text-red-300">
                  Left
                </div>
              )}
            </div>
          </motion.button>
        )
      })}

      {overflowCount > 0 && (
        <div className="pointer-events-none flex-shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
          +{overflowCount} more
        </div>
      )}

    </div>
  )
}

export default AudienceBubbleTicker