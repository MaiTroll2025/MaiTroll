import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Coins,
  Crown,
  Gift,
  Plus,
  BadgeCheck,
  UserPlus,
  MessageSquare,
  Flag,
  Heart,
  Circle,
  Users,
} from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { getCategoryConfig } from '../../config/broadcastCategories'
import { Stream } from '../../types/broadcast'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { StreamAudienceMember } from '../../hooks/useStreamAudiencePresence'
import { useNavigate } from 'react-router-dom'
import StaffWalkieTalkieButton from '../StaffWalkieTalkieButton'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useStreamSlaStatus } from '../../hooks/useSlaStatus'
import { SlaStatusIndicator } from './SlaBadge'
import AudienceBubbleTicker from './AudienceBubbleTicker'
import RandomBattleBanner from './RandomBattleBanner'

const LIVE_DOT_CLASS = 'h-2 w-2 rounded-full bg-red-500 animate-pulse'

export interface BroadcastNeonHeaderProps {
   stream: Stream
   broadcasterProfile: {
     username?: string
     avatar_url?: string | null
     display_name?: string
     house_name?: string
     license_plate?: string
     battle_crowns?: number
     trollmonds?: number
     level?: number
   } | null
   audience?: StreamAudienceMember[]
   audienceCurrentUserId?: string
   audienceHostUserId?: string
   audienceMaxVisible?: number
   isHost: boolean
   liveViewerCount?: number
    onGift: () => void
    onSubscribe?: () => void
    onShare?: () => void
   onEndStream?: () => void
   onClose?: () => void
   coinBalance?: number
   onOpenCoinStore?: () => void
   isLive: boolean
   streamStartedAt?: string | null
   handleLike: () => void
   onLiveKitMicMute?: () => void
   onLiveKitMicUnmute?: () => void
   onActiveViewersClick?: () => void
   onGiftUser?: (userId: string) => void
   onModerateUser?: (info: ModerateUserInfo) => void
   randomBattleQueue?: {
     phase: string
     delayUntil?: number | null
     isBusy?: boolean
     startQueue: () => void
     stopQueue: () => void
   }
  }

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function BroadcastNeonHeader({
    stream,
    broadcasterProfile,
    isHost,
    liveViewerCount,
    handleLike,
    onGift,
    onSubscribe,
    coinBalance,
    onOpenCoinStore,
    isLive,
    streamStartedAt,
    onLiveKitMicMute,
    onLiveKitMicUnmute,
    onActiveViewersClick,
    audience,
    audienceCurrentUserId,
    audienceHostUserId,
    audienceMaxVisible = 8,
    onGiftUser,
    onModerateUser,
    randomBattleQueue,
}: BroadcastNeonHeaderProps) {
    const { profile } = useAuthStore()
  const navigate = useNavigate()
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const { isMobileWidth } = useIsMobile()
  const isMobile = isMobileWidth
  const { slaStatus } = useStreamSlaStatus(stream?.id)

  const [now, setNow] = useState(Date.now())
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const broadcasterFrame = useUserFrame(stream?.user_id);

  const coinDisplay = coinBalance ?? profile?.troll_coins ?? 0
  const streamTitle = stream?.title || stream?.category || 'Live'
  const categoryConfig = getCategoryConfig(stream?.category || 'general')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return

    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileMenuOpen])

  useEffect(() => {
    if (!profile?.id) return

    const refresh = async () => {
      await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', profile.id)
        .maybeSingle()
    }

    const interval = window.setInterval(refresh, 30000)

    return () => {
      window.clearInterval(interval)
    }
  }, [profile?.id])

  const timerMs = useMemo(() => {
    if (!streamStartedAt) return 0
    const start = new Date(streamStartedAt).getTime()
    return Math.max(0, now - start)
  }, [now, streamStartedAt])

  const timerStr = useMemo(() => formatTimer(timerMs), [timerMs])

  const handleFollow = useCallback(async () => {
    const { user } = useAuthStore.getState()

    if (!user) {
      navigate('/auth?mode=signup')
      return
    }

    if (!broadcasterProfile?.username) return

    setFollowLoading(true)

    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', stream.user_id)

        setIsFollowing(false)
        toast.success('Unfollowed')
      } else {
        await supabase
          .from('user_follows')
          .insert({
            follower_id: user.id,
            following_id: stream.user_id,
          })

        setIsFollowing(true)
        toast.success(`Following ${broadcasterProfile.username}!`)
      }
    } catch {
      toast.error('Action failed')
    } finally {
      setFollowLoading(false)
    }
  }, [isFollowing, broadcasterProfile, stream?.user_id, navigate])

  const handleMessage = useCallback(() => {
    if (!broadcasterProfile?.username) return

    ;(window as any)._tcOpenUserChat?.(
      stream.user_id,
      broadcasterProfile.username,
      broadcasterProfile.avatar_url
    )

    setProfileMenuOpen(false)
  }, [broadcasterProfile, stream?.user_id])

  const handleReport = useCallback(() => {
    navigate(`/report?targetId=${stream.user_id}&targetType=user&streamId=${stream.id}`)
  }, [navigate, stream?.user_id, stream?.id])

  if (!stream) return null

  const formattedCoins =
    coinDisplay >= 1_000_000
      ? `${(coinDisplay / 1_000_000).toFixed(1)}M`
      : coinDisplay >= 1_000
        ? `${(coinDisplay / 1_000).toFixed(1)}K`
        : coinDisplay.toLocaleString()

  return (
    <header className={cn(
      "relative z-50 shrink-0 border-b border-white/10 bg-black/70 backdrop-blur-xl",
      isMobile ? "px-2 py-1" : "px-4 py-2"
    )}>
      <div className={cn(
        "flex items-center justify-between",
        isMobile ? "h-[44px] gap-2" : "h-[68px] gap-4"
      )}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0" ref={profileMenuRef}>
            <div className={cn("relative", isMobile ? "h-9 w-9" : "h-14 w-14")} style={{ overflow: 'visible' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setProfileMenuOpen((prev) => !prev)
                }}
                className={cn(
                  "relative rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 p-[2px] shadow-[0_0_22px_rgba(168,85,247,0.38)] transition-shadow hover:shadow-[0_0_30px_rgba(168,85,247,0.55)]",
                  isMobile ? "h-9 w-9" : "h-14 w-14"
                )}
                aria-label="Broadcaster profile menu"
              >
                {broadcasterProfile?.avatar_url ? (
                  <ProfileFrame
                    frame={broadcasterFrame}
                    avatarUrl={broadcasterProfile.avatar_url}
                    username={broadcasterProfile.username || 'Broadcaster'}
                    size="sm"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#111]">
                    <Crown className="h-5 w-5 text-purple-400" />
                  </div>
                )}
              </button>
            </div>

            {profileMenuOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-56 overflow-hidden rounded-xl border border-white/15 bg-slate-950/98 p-1.5 shadow-2xl backdrop-blur-xl">
                <div className="mb-1 border-b border-white/10 px-3 py-2">
                  <p className="truncate text-sm font-black text-white">
                    {broadcasterProfile?.display_name || broadcasterProfile?.username || 'Broadcaster'}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400">
                    @{broadcasterProfile?.username || 'unknown'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  <UserPlus size={15} className={isFollowing ? 'text-emerald-400' : 'text-cyan-400'} />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                <button
                  type="button"
                  onClick={handleMessage}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  <MessageSquare size={15} className="text-purple-400" />
                  Message
                </button>

                <button
                  type="button"
                  onClick={handleReport}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-amber-300 transition-colors hover:bg-white/10"
                >
                  <Flag size={15} className="text-amber-400" />
                  Report
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className={cn(
                "truncate font-black leading-none tracking-tight text-white",
                isMobile ? "text-[14px]" : "text-[21px]"
              )}>
                {broadcasterProfile?.display_name || broadcasterProfile?.username || streamTitle}
              </h1>
              <BadgeCheck className={cn("shrink-0 text-purple-400", isMobile ? "h-3.5 w-3.5" : "h-5 w-5")} />
            </div>

            <div className={cn("mt-1 flex min-w-0 items-center gap-2", isMobile && "hidden")}>
              <p className="truncate text-[12px] font-semibold text-slate-300">
                {broadcasterProfile?.username ? `${broadcasterProfile.username}'s Live` : streamTitle}
              </p>

              <span className="rounded-md bg-purple-600/60 px-2 py-0.5 text-[9px] font-black text-white shadow-[0_0_10px_rgba(168,85,247,0.35)]">
                {categoryConfig.name || 'General Chat'}
              </span>
            </div>
          </div>
        </div>

         {/* Right side actions */}
         <div className={cn("flex shrink-0 items-center", isMobile ? "gap-1" : "gap-2")}>
           {/* Staff walkie talkie - desktop only */}
           {isHost && !isMobile && (
             <div className="relative">
               <StaffWalkieTalkieButton 
                 showFullControls={false} 
                 onLiveKitMicMute={onLiveKitMicMute}
                 onLiveKitMicUnmute={onLiveKitMicUnmute}
               />
             </div>
           )}
           
           {/* Random battle banner - desktop only, next to walkie talkie */}
           {isHost && !isMobile && randomBattleQueue && (
             <RandomBattleBanner
               phase={randomBattleQueue.phase}
               delayUntil={randomBattleQueue.delayUntil ?? null}
               isBroadcaster={isHost}
               onStartQueue={randomBattleQueue.startQueue}
               onStopQueue={randomBattleQueue.stopQueue}
               isBusy={randomBattleQueue.isBusy}
               mobileSafe={false}
             />
           )}
           
           {/* Active viewers - desktop only */}
          {!isMobile && (
            <button
              type="button"
              onClick={onActiveViewersClick}
              className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 shadow-[0_0_14px_rgba(34,211,238,0.15)] transition-all hover:bg-cyan-500/20 hover:border-cyan-400/50"
            >
              <Users className="h-3.5 w-3.5 text-cyan-300" />
              <span className="tabular-nums text-[11px] font-black text-cyan-200">
                {liveViewerCount ?? 0}
              </span>
            </button>
          )}
          
          {/* LIVE badge */}
           {isLive && (
             <span className={cn(
               "flex items-center gap-1.5 rounded-lg bg-red-500/15 font-black text-red-400",
               isMobile ? "px-1.5 py-1 text-[9px]" : "px-3 py-1.5 text-xs"
             )}>
               <span className={LIVE_DOT_CLASS} />
               LIVE
               <span className="tabular-nums text-red-300/80">{timerStr}</span>
             </span>
           )}

           {!isMobile && slaStatus && (
             <SlaStatusIndicator slaStatus={slaStatus} />
           )}

          {/* Coins display */}
          <div className={cn(
            "flex items-center gap-1.5 rounded-2xl border border-yellow-400/25 bg-yellow-500/10 shadow-[0_0_18px_rgba(234,179,8,0.14)]",
            isMobile ? "px-2 py-1" : "px-3 py-2"
          )}>
            <Coins className={cn("text-yellow-300", isMobile ? "h-3 w-3" : "h-4 w-4")} />
            <span className={cn(
              "font-black tabular-nums text-yellow-300",
              isMobile ? "text-[10px]" : "text-sm"
            )}>
              {formattedCoins}
            </span>

            {onOpenCoinStore && (
              <button
                onClick={onOpenCoinStore}
                className={cn(
                  "grid place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20",
                  isMobile ? "h-4 w-4" : "h-6 w-6"
                )}
                aria-label="Open coin store"
              >
                <Plus className={cn("text-white", isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
              </button>
            )}
          </div>

          {/* Like button */}
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 rounded-2xl border border-pink-400/50 bg-gradient-to-r from-pink-700/80 to-rose-600/80 font-black uppercase text-white shadow-[0_0_22px_rgba(236,72,153,0.38)] transition-transform hover:scale-[1.02]",
              isMobile ? "h-7 px-2.5 text-[10px]" : "h-11 px-5 text-sm"
            )}
          >
            <Heart className={cn("text-pink-300", isMobile ? "h-3 w-3" : "h-4 w-4")} />
            <span className="tabular-nums">{stream.total_likes?.toLocaleString() || 0}</span>
          </button>

           {/* Gift button */}
           <button
             onClick={onGift}
             className={cn(
               "flex items-center gap-1.5 rounded-2xl border border-fuchsia-400/50 bg-gradient-to-r from-purple-700/80 to-fuchsia-600/80 font-black uppercase text-white shadow-[0_0_22px_rgba(217,70,239,0.38)] transition-transform hover:scale-[1.02]",
               isMobile ? "h-7 px-2.5 text-[10px]" : "h-11 px-5 text-sm"
             )}
           >
             <Gift className={cn("text-yellow-300", isMobile ? "h-3 w-3" : "h-4 w-4")} />
             {!isMobile && "Gift"}
           </button>

           {/* Subscribe button - viewer page only */}
           {onSubscribe && !isMobile && (
             <button
               onClick={onSubscribe}
               className={cn(
                 "flex items-center gap-1.5 rounded-2xl border border-cyan-400/50 bg-gradient-to-r from-cyan-700/80 to-cyan-600/80 font-black uppercase text-white shadow-[0_0_22px_rgba(34,211,238,0.38)] transition-transform hover:scale-[1.02]",
                 "h-11 px-5 text-sm"
               )}
             >
               <Crown className={cn("text-cyan-200", "h-4 w-4")} />
               Subscribe
             </button>
           )}
         </div>
      </div>
    </header>
  )
}