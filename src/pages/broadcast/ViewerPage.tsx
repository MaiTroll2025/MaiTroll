import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BadgeCheck,
  Crown,
  Gift,
  Loader2,
  LogOut,
  MessageSquare,
  Pin,
  Plus,
  Share2,
  Users,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorPlay,
  Shield,
  X,
} from 'lucide-react'
import type { LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrackPublication, RemoteVideoTrack } from 'livekit-client'
import { RoomEvent, Track } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'

import type { Stream } from '../../types/broadcast'
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { supabase, getBlockedUserIds } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { getLiveKitRoomName } from '../../lib/liveUtils'
import { isStaffProfile } from '../../lib/staff'
import {
  getAnonymousDisplayName,
  isAnonymousDisplayName,
  reserveAnonymousChatSlot,
} from '../../lib/anonymousIdentity'

import BroadcastNeonHeader from '../../components/broadcast/BroadcastNeonHeader'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'
import UserActionModal from '../../components/broadcast/UserActionModal'
import ViewerUserActionModal from '../../components/broadcast/ViewerUserActionModal'
import ModActionsPopup from '../../components/broadcast/ModActionsPopup'
import { getGiftVisualConfig } from '../../lib/giftVisuals'
import { hydrateGiftForOverlay } from '../../lib/gifts'
import { useTargetedGiftQueue, type StreamGiftEvent } from '../../hooks/useTargetedGiftQueue'


import { GiftSystemProvider } from '../../lib/hooks/useGiftSystem'
import BattleView from '../../pages/broadcast/BattleView'
import { useBoxCount } from '../../hooks/useBoxCount'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useBroadcastFrame } from '@/hooks/useBroadcastFrame'
import BroadcastFrame from '@/components/broadcast/BroadcastFrame'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useUserLeagues } from '../../hooks/useUserLeagues'
import LeagueProgressPanel from '../../components/broadcast/LeagueProgressPanel'
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom'
import { useStreamRealtime } from '../../hooks/useStreamRealtime'
import { useStreamSeats } from '../../hooks/useStreamSeats'
import { useStreamAudiencePresence, StreamAudienceMember } from '../../hooks/useStreamAudiencePresence'
import { useLiveStreams } from '../../hooks/useQueries'
import FeedTheTroll from '../../components/feed-the-troll/FeedTheTroll'
import { AudienceBubbleTicker } from '../../components/broadcast/AudienceBubbleTicker'
import MobileAudienceTicker from '../../components/broadcast/MobileAudienceTicker'
import { TopSubscribersBar } from '../../components/broadcast/TopSubscribersBar'
import { useSubscriberUsernames, useCreatorSubscription } from '../../hooks/useCreatorSubscription'
import SubscriptionTierSelector from '../../components/user/SubscriptionTierSelector'
import { useStreamTopGifters } from '../../hooks/useStreamTopGifters'
import { resolveUsername, DEFAULT_USERNAME } from '../../lib/chatUtils'
import { getBroadcastChatLockRemainingMs, isBroadcastChatLockActive } from '../../lib/broadcastModeration'
import { isValidUuid } from '../../lib/courtUtils'
import { useTrollFamilyActivity } from '../../hooks/useTrollFamilyActivity'
import { useBroadcastTextPopup } from '../../hooks/useBroadcastTextPopup'
import { logActiveChannels } from '../../lib/realtimeChannelDiagnostics'
import BroadcastTextPopupOverlay from '../../components/broadcast/BroadcastTextPopupOverlay'
import PaidChatViewerModal from '../../components/broadcast/PaidChatViewerModal'
import RandomBattleBanner from '../../components/broadcast/RandomBattleBanner'
import CityStatusPanel from '../../components/city/CityStatusPanel'
import CityStatusOrb from '../../components/city/CityStatusOrb'
import { useCityStatusOrb } from '../../lib/hooks/useCityStatusOrb'
import SeatCityStatusOrb from '../../components/broadcast/SeatCityStatusOrb'
import RaidPanel from '../../components/city/RaidPanel'
import { useGhostMode } from '../../hooks/useGhostMode'
import { useChatBlockStatus } from '../../hooks/useChatBlockStatus'
import { sendChatThroughGate } from '../../lib/sendChatThroughGate'
import { sendStreamBroadcast } from '../../lib/realtime/streamRealtimeManager'
import { admitViewerToStream, releaseViewerSlot } from '@/lib/streamCapacity'
import { getThreads, getThreadMessages, sendMessage, searchUsers, findOrCreateDirectThread } from '../../services/utromailService'

// Import theme constants
import { MaiTrollBroadcastTheme } from '../../styles/broadcastTheme'
import GiftVideoOverlay from '@/components/broadcast/GiftVideoOverlay'

const theme = MaiTrollBroadcastTheme

function getDisplayName(profile: any, fallback = 'MaiTroll') {
  return (
    profile?.username ||
    profile?.email?.split?.('@')?.[0] ||
    fallback
  )
}

function isStreamActive(stream: Stream | null): boolean {
  if (!stream) return false
  const status = String((stream as any).status || '').toLowerCase()
  return status === 'starting' || status === 'live' || (stream as any).is_live === true
}

function isStreamEnded(stream: Stream | null): boolean {
  if (!stream) return true
  const status = String((stream as any).status || '').toLowerCase()
  return status === 'ended' || (stream as any).ended_at != null
}

const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000
const MAX_TOTAL_BOXES = 8
const CHAT_DEBOUNCE_MS = 1_500

function getKickStorageKey(streamId: string, userId: string) {
  return `kick_${streamId}_${userId}`
}

function parseKickData(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isKickBanActive(kickData: any) {
  if (!kickData || typeof kickData.timestamp !== 'number') return false
  return Date.now() - kickData.timestamp < KICK_BAN_DURATION_MS
}

function getSeatPriceForIndex(stream: Stream | null, seatIndex: number) {
  if (!stream) return 0

  if (Array.isArray((stream as any)?.seat_prices) && typeof (stream as any).seat_prices[seatIndex] === 'number') {
    return Number((stream as any).seat_prices[seatIndex])
  }

  return Number((stream as any)?.seat_price ?? 0)
}

/**
 * ViewerPage must NOT render BroadcastGrid.
 *
 * BroadcastGrid is a broadcaster/stage composition component. On the watch page it
 * was creating the extra profile-card box plus the real camera box underneath it.
 * This page renders the host video and stage video surfaces directly instead.
 */
function getParticipantIdentity(participant: any): string {
  return String(
    participant?.identity ||
      participant?.participantIdentity ||
      participant?.name ||
      participant?.metadata?.user_id ||
      participant?.metadata?.userId ||
      '',
  )
}

function getParticipantMetadata(participant: any): any {
  const raw = participant?.metadata

  if (!raw) return {}
  if (typeof raw === 'object') return raw

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function participantMatchesUser(participant: any, userId?: string | null) {
  if (!participant || !userId) return false

  const identity = getParticipantIdentity(participant)
  const metadata = getParticipantMetadata(participant)

  return (
    identity === userId ||
    identity.includes(userId) ||
    identity.endsWith(`-${userId}`) ||
    identity.startsWith(`${userId}-`) ||
    metadata.user_id === userId ||
    metadata.userId === userId
  )
}

// Interfaces for isolated track state management
interface SeatState {
  participant: any
  videoTrack: any
  audioTrack: any
  isLoading: boolean
  userId: string | null
}

interface BroadcasterState {
  participant: any
  videoTrack: any
  audioTrack: any
}

function getVideoTrackFromParticipant(participant: any): RemoteVideoTrack | null {
  if (!participant) return null

  const directCandidates = [
    participant.videoTrack,
    participant.cameraTrack,
    participant.track,
    participant.video,
  ]

  for (const candidate of directCandidates) {
    if (candidate?.attach && candidate?.kind === Track.Kind.Video) {
      return candidate as RemoteVideoTrack
    }

    if (candidate?.attach && candidate?.mediaStreamTrack?.kind === 'video') {
      return candidate as RemoteVideoTrack
    }
  }

  const publications: RemoteTrackPublication[] = []

  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return

    if (typeof maybeMap.values === 'function') {
      publications.push(...Array.from(maybeMap.values()) as RemoteTrackPublication[])
      return
    }

    if (Array.isArray(maybeMap)) {
      publications.push(...maybeMap)
    }
  }

  collectFromMap(participant.videoTrackPublications)
  collectFromMap(participant.trackPublications)
  collectFromMap(participant.tracks)
  collectFromMap(participant.publications)

  const cameraPub =
    publications.find((pub: any) => pub?.source === Track.Source.Camera && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.source !== Track.Source.Microphone && pub?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.kind === Track.Kind.Video && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.mediaStreamTrack?.kind === 'video' && pub?.track?.attach)

  return (cameraPub?.track as RemoteVideoTrack) || null
}

function getAudioTrackFromParticipant(participant: any): any {
  if (!participant) return null

  const publications: any[] = []

  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return

    if (typeof maybeMap.values === 'function') {
      publications.push(...Array.from(maybeMap.values()))
      return
    }

    if (Array.isArray(maybeMap)) {
      publications.push(...maybeMap)
    }
  }

  collectFromMap(participant.audioTrackPublications)
  collectFromMap(participant.trackPublications)
  collectFromMap(participant.tracks)
  collectFromMap(participant.publications)

  const audioPub =
    publications.find((pub: any) => pub?.source === Track.Source.Microphone && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.kind === Track.Kind.Audio && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.kind === Track.Kind.Audio && pub?.track?.attach) ||
    publications.find((pub: any) => pub?.track?.mediaStreamTrack?.kind === 'audio' && pub?.track?.attach)

  return audioPub?.track || null
}

const RemoteVideoSurface = memo(function RemoteVideoSurface({
  participant,
  mirror = false,
  className,
  fallback,
  onTap,
  onDoubleTap,
  room,
  objectFit = 'contain',
}: {
  participant: any
  mirror?: false
  className?: string
  fallback: React.ReactNode
  onTap?: () => void
  onDoubleTap?: () => void
  room?: any
  objectFit?: 'cover' | 'contain'
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastTapRef = useRef<number>(0)
  const tapTimeoutRef = useRef<number | null>(null)

  // Track version tick — incremented on room events only.
  // LiveKit mutates RemoteParticipant objects in place, so the videoTrack
  // dependency alone won't trigger re-attach when a track is subscribed.
  const [trackTick, setTrackTick] = useState(0)

  // Listen to room events to force re-evaluation when tracks change.
  useEffect(() => {
    if (!room) return
    const bump = () => setTrackTick(t => t + 1)
    room.on(RoomEvent.TrackSubscribed, bump)
    room.on(RoomEvent.TrackUnsubscribed, bump)
    room.on(RoomEvent.ParticipantConnected, bump)
    room.on(RoomEvent.ParticipantDisconnected, bump)
    return () => {
      room.off(RoomEvent.TrackSubscribed, bump)
      room.off(RoomEvent.TrackUnsubscribed, bump)
      room.off(RoomEvent.ParticipantConnected, bump)
      room.off(RoomEvent.ParticipantDisconnected, bump)
    }
  }, [room])

  // Recompute tracks on every render + tick change.
  // Do NOT memoize by participant reference — LiveKit mutates in place.
  const videoTrack = getVideoTrackFromParticipant(participant)
  const audioTrack = getAudioTrackFromParticipant(participant)

  const shouldMirror = useMemo(() => {
    if (!mirror) return false
    const stream = videoTrack?.mediaStreamTrack || (videoTrack as any)?._mediaStreamTrack
    const settings = stream?.getSettings?.() || {}
    const facing = (settings as any).facingMode
    if (facing && facing !== 'environment') return false
    return true
  }, [videoTrack, mirror])

  // Dev logging for track detection on mobile/PWA
  if (import.meta.env.DEV && trackTick > 0 && trackTick % 5 === 0) {
    console.debug('[RemoteVideoSurface] track check:', {
      participantIdentity: getParticipantIdentity(participant),
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      shouldMirror,
      trackTick,
    })
  }

// Stable identity for the underlying media stream track.
   // This prevents unnecessary detach/attach when trackTick bumps due to
   // unrelated room events (e.g. another participant joining a seat).
   const videoTrackId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
   const audioTrackId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null

   // Use refs to track what we actually attached, so we only detach/reattach
   // when the underlying track truly changes.
   const attachedVideoTrackRef = useRef<RemoteVideoTrack | null>(null)
   const attachedAudioIdRef = useRef<string | null>(null)

   useEffect(() => {
     const videoEl = videoRef.current
     if (!videoEl) return

     const previousTrack = attachedVideoTrackRef.current
     const previousTrackId = previousTrack?.mediaStreamTrack?.id || previousTrack?.sid || null
     const nextTrackId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null

     if (previousTrackId && nextTrackId && previousTrackId === nextTrackId && previousTrack) {
       return
     }

     if (previousTrack) {
       try {
         previousTrack.detach()
       } catch {
         // ignore
       }
       attachedVideoTrackRef.current = null
     }

     if (!videoTrack) {
       if (previousTrack) {
         return
       }
       videoEl.srcObject = null
       return
     }

     let cancelled = false

     const attachAndPlay = async () => {
       try {
         videoEl.autoplay = true
         videoEl.playsInline = true
         videoEl.muted = true
         videoEl.setAttribute('playsinline', '')
         videoEl.setAttribute('webkit-playsinline', '')

         videoTrack.attach(videoEl)
         attachedVideoTrackRef.current = videoTrack

         if (!cancelled) {
           await videoEl.play()
         }
       } catch (error) {
         console.warn('[ViewerPage] Mobile remote video failed:', error)
       }
     }

     void attachAndPlay()

     return () => {
       cancelled = true

       try {
         videoTrack.detach(videoEl)
       } catch {
         // ignore
       }

       if (attachedVideoTrackRef.current === videoTrack) {
         attachedVideoTrackRef.current = null
       }
     }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoTrackId, trackTick])

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl) return

    // Only (re-)attach if the track identity actually changed
    if (audioTrackId !== attachedAudioIdRef.current) {
      // Detach previous track if we had one attached
      if (attachedAudioIdRef.current !== null) {
        try {
          audioTrack?.detach?.(audioEl)
        } catch {
          // ignore
        }
      }

      if (audioTrack) {
        try {
          audioTrack.attach(audioEl)
          audioEl.play().catch(() => {})
        } catch (err) {
          console.warn('[ViewerPage] Failed to attach remote audio track:', err)
        }
      }
      attachedAudioIdRef.current = audioTrackId
    }
  }, [audioTrack, audioTrackId, trackTick])

   return (
    <div
      onClick={() => {
        const now = Date.now()
        const timeDiff = now - lastTapRef.current

        if (timeDiff < 300 && timeDiff > 0) {
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current)
            tapTimeoutRef.current = null
          }
          lastTapRef.current = 0
          onDoubleTap?.()
        } else {
          lastTapRef.current = now
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current)
          }
          tapTimeoutRef.current = window.setTimeout(() => {
            onTap?.()
            tapTimeoutRef.current = null
          }, 300)
        }
      }}
      className={cn('relative h-full w-full overflow-hidden bg-black', (onTap || onDoubleTap) && 'cursor-pointer', className)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        disablePictureInPicture
        controls={false}
        className={cn(
          'absolute inset-0 block h-full w-full bg-black object-center',
          objectFit === 'contain' ? 'object-contain' : 'object-contain',
          shouldMirror && '-scale-x-100',
        )}
      />
      <audio ref={audioRef} autoPlay />
      {!videoTrack && !attachedVideoTrackRef.current && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback}
        </div>
      )}
    </div>
  )
  })

function LocalVideoSurface({
  videoTrack,
  audioTrack,
  mirror = false,
  className,
  fallback,
}: {
  videoTrack: LocalVideoTrack | null
  audioTrack: LocalAudioTrack | null
  mirror?: boolean
  className?: string
  fallback: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !videoTrack) return

    try {
      videoTrack.attach(videoEl)
      videoEl.style.transform = mirror ? 'scaleX(-1)' : 'none'
      videoEl.play().catch(() => {})
    } catch (err) {
      console.warn('[ViewerPage] Failed to attach local video track:', err)
    }

    return () => {
      try {
        videoTrack.detach(videoEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [videoTrack])

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl || !audioTrack) return

    try {
      audioTrack.attach(audioEl)
      audioEl.play().catch(() => {})
    } catch (err) {
      console.warn('[ViewerPage] Failed to attach local audio track:', err)
    }

    return () => {
      try {
        audioTrack.detach(audioEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [audioTrack])

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-black', className)}>
      {videoTrack ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={true}
            className={cn('h-full w-full object-contain', mirror && '-scale-x-100')}
          />
          <audio ref={audioRef} autoPlay />
        </>
      ) : (
        fallback
      )}
    </div>
  )
}

function ViewerPage() {
  const params = useParams()
  const streamId = params.streamId || params.id || ''

  // Stable anonymous viewer identity — never use "undefined" in identity.
  // Uses sessionStorage so the same guest gets the same identity for the
  // browser session and stream. Format: guest-viewer:<streamId>:<uuid>
  const anonViewerId = useMemo(() => {
    if (typeof window === 'undefined' || !streamId) return '';
    const storageKey = `guest-viewer:${streamId}`;
    try {
      let anonId = window.sessionStorage.getItem(storageKey);
      if (anonId) return anonId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cryptoObj = (window as any).crypto;
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        anonId = `guest-viewer:${streamId}:${cryptoObj.randomUUID()}`;
      } else {
        // Fallback UUID v4 for non-secure contexts (HTTP, older browsers)
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
        anonId = `guest-viewer:${streamId}:${uuid}`;
      }
      window.sessionStorage.setItem(storageKey, anonId);
      return anonId;
    } catch {
      // sessionStorage may be unavailable in some PWA/iframe contexts
      return `guest-viewer:${streamId}:${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [streamId])

  const anonDisplayName = useMemo(
    () => (streamId ? getAnonymousDisplayName() : ''),
    [streamId],
  )

  // Startup log to confirm route resolution (important for PWA/mobile)
  useEffect(() => {
    try {
      console.log('[ViewerPage] route streamId resolved', {
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        streamId,
        params,
      })
    } catch (e) {
      console.warn('[ViewerPage] route streamId log failed', e)
    }
  }, [streamId])

  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobileWidth, hasMounted } = useIsMobile()
  const isMobileViewer = hasMounted && isMobileWidth
  const { recordWatchTime } = useTrollFamilyActivity()
  const { data: liveStreamsData } = useLiveStreams()

  // Ghost drop-in mode: detect ?ghost=true from URL (set by GhostDropInRouter)
  const [isGhostDropIn, setIsGhostDropIn] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('ghost') === 'true' && !user) {
      setIsGhostDropIn(true)
    }
  }, [location.search, user])

  // Broadcast Text Popup (viewers can only receive, not send)
  const {
    activePopup: activeTextPopup,
  } = useBroadcastTextPopup({
    streamId: streamId || '',
    currentUserId: user?.id,
    currentUsername: profile?.username,
    canSend: false, // Viewers cannot send popups
  })

  // Broadofficer appointment popup state
  const [broadofficerPopup, setBroadofficerPopup] = useState<{ visible: boolean; message: string; streamId: string } | null>(null)

  // Subscription popup state
  const [subscriptionPopup, setSubscriptionPopup] = useState<{ visible: boolean; broadcaster: string } | null>(null)

  // Refresh current user profile without full logout/login
  const refreshCurrentUserProfile = useCallback(async () => {
    const { user: currentUser } = useAuthStore.getState()
    if (!currentUser?.id) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()
      if (data) {
        useAuthStore.getState().setProfile(data as any, { force: true })
      }
    } catch {
      // silent
    }
  }, [])

  // Listen for realtime broadofficer_assigned notifications
  useEffect(() => {
    const { user: currentUser } = useAuthStore.getState()
    if (!currentUser?.id) return

    const channel = supabase
      .channel(`notifications:user:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newNotification = payload.new as any
          if (newNotification?.type === 'broadofficer_assigned') {
            setBroadofficerPopup({
              visible: true,
              message: newNotification.message || 'Broadcaster has made you a Broadofficer.',
              streamId: newNotification.data?.stream_id || '',
            })
            toast.success('🛡️ You have been assigned as a Broadofficer!')
            refreshCurrentUserProfile()
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [refreshCurrentUserProfile])

  // Poll for recent broadofficer assignments as a fallback for mobile/PWA where realtime may be throttled
  useEffect(() => {
    const { user: currentUser } = useAuthStore.getState()
    if (!currentUser?.id) return

    let pollInterval: number | null = null

    const checkForRecentAssignment = async () => {
      try {
        const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString()
        const { data, error } = await supabase
          .from('notifications')
          .select('id, message, data, created_at')
          .eq('user_id', currentUser.id)
          .eq('type', 'broadofficer_assigned')
          .gte('created_at', fifteenSecondsAgo)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error || !data?.length) return

        const notification = data[0] as any
        setBroadofficerPopup({
          visible: true,
          message: notification.message || 'Broadcaster has made you a Broadofficer.',
          streamId: notification.data?.stream_id || '',
        })
        toast.success('🛡️ You have been assigned as a Broadofficer!')
        refreshCurrentUserProfile()
      } catch {
        // silent
      }
    }

    pollInterval = window.setInterval(checkForRecentAssignment, 15000)

    return () => {
      if (pollInterval) {
        window.clearInterval(pollInterval)
      }
    }
  }, [refreshCurrentUserProfile])

  // Dismiss broadofficer popup and optionally navigate to stream
  const dismissBroadofficerPopup = useCallback(() => {
    setBroadofficerPopup(null)
  }, [])

  // Dismiss subscription popup
  const dismissSubscriptionPopup = useCallback(() => {
    setSubscriptionPopup(null)
  }, [])

  // Mobile layout constants
  const MOBILE_CONTROL_BAR_HEIGHT = 76
  const MOBILE_CHAT_INPUT_HEIGHT = 68
  const MOBILE_SAFE_BOTTOM = 'env(safe-area-inset-bottom)'
  const CHAT_FLOAT_MS = 30000

   const [stream, setStream] = useState<Stream | null>(null)

   // Broadcaster's equipped profile frame
   const broadcasterFrame = useUserFrame((stream as any)?.user_id)

   // Random battle phase (derived from stream state for viewers)
  const randomBattlePhase = useMemo((): 'regular' | 'queue' | 'starting' | 'active' | 'ended' => {
    if (!stream) return 'regular';
    if (stream.status === 'ended') return 'ended';
    const isRandomBattle = stream.battle_mode === 'random_queue' && !!stream.battle_id && !!stream.is_battle;
    if (isRandomBattle && stream.battle_status === 'starting') return 'starting';
    if (isRandomBattle && (stream.battle_status === 'active' || !stream.battle_status)) return 'active';
    if (stream.random_battle_queue_enabled) return 'queue';
    return 'regular';
  }, [stream, stream?.battle_mode, stream?.battle_id, stream?.is_battle, stream?.battle_status, stream?.random_battle_queue_enabled, stream?.status]);

const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [streamLoaded, setStreamLoaded] = useState(false)
    const [viewerCount, setViewerCount] = useState(0)
    // Broadcast frame - decorative border for viewer page
    const broadcastFrame = useBroadcastFrame(stream?.user_id)
    // Local tracks for publishing when in a seat
   const audioTrackRef = useRef<LocalAudioTrack | null>(null)
   const videoTrackRef = useRef<LocalVideoTrack | null>(null)
   const [localTracksVersion, setLocalTracksVersion] = useState(0)
   const localTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)

   const setLocalTracks = useCallback((
     next:
       | [LocalAudioTrack | null, LocalVideoTrack | null]
       | null
       | ((prev: [LocalAudioTrack | null, LocalVideoTrack | null] | null) => [LocalAudioTrack | null, LocalVideoTrack | null] | null)
   ) => {
     const previous: [LocalAudioTrack | null, LocalVideoTrack | null] | null =
       audioTrackRef.current || videoTrackRef.current
         ? [audioTrackRef.current, videoTrackRef.current]
         : null
     const resolved = typeof next === 'function' ? next(previous) : next
     const nextAudioTrack = resolved?.[0] || null
     const nextVideoTrack = resolved?.[1] || null

     if (audioTrackRef.current === nextAudioTrack && videoTrackRef.current === nextVideoTrack) {
       return
     }

     audioTrackRef.current = nextAudioTrack
     videoTrackRef.current = nextVideoTrack
     localTracksRef.current = resolved
     setLocalTracksVersion((version) => version + 1)
   }, [])
   const [isChatOpen, setIsChatOpen] = useState(true)
    const [chatTab, setChatTab] = useState<'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'>('chat')
   const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
   const { myLeagues, myMemberships, leagueMissions, isLoading: isUserLeaguesLoading } = useUserLeagues()
    const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
    const [streamMods, setStreamMods] = useState<string[]>([])
    const processedGiftIdsRef = useRef<Set<string>>(new Set())
    const { enqueueGift } = useTargetedGiftQueue()
   // Floating chat
    interface FloatingMessage {
      id: string
      username: string
      content: string
      createdAt: number
      isSystem?: boolean
    }
   const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([])
   const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set())
   const [chatInput, setChatInput] = useState('')
   const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
   const [hostChatDisabledByOfficerState, setHostChatDisabledByOfficerState] = useState(false)
   const [hostChatDisabledUntil, setHostChatDisabledUntil] = useState<string | null>(null)
   const [hostChatDisabledStreamId, setHostChatDisabledStreamId] = useState<string | null>(null)
    const [hostChatDisableRemainingMs, setHostChatDisableRemainingMs] = useState(0)
    const [isMessagePopupOpen, setIsMessagePopupOpen] = useState(false)
    const [isNewMessageMode, setIsNewMessageMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [recentThreads, setRecentThreads] = useState<any[]>([])
    const [selectedThread, setSelectedThread] = useState<any | null>(null)
    const [threadMessages, setThreadMessages] = useState<any[]>([])
    const [messagesLoading, setMessagesLoading] = useState(false)
    const floatingChatContainerRef = useRef<HTMLDivElement>(null)
    const [blockedUsernames, setBlockedUsernames] = useState<Set<string>>(new Set())
    const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(user?.id, streamId);

    // Proactively tell the current user their chat was disabled by moderation.
    // Previously this only surfaced when they tried to send a message; now it
    // shows the moment the chat_blocks row lands for them.
    const prevChatDisabledRef = useRef(false)
    useEffect(() => {
      if (userChatDisabled && !prevChatDisabledRef.current) {
        toast.error(
          chatDisabledRemainingMinutes
            ? `Your chat is disabled by moderation action. Try again in ${chatDisabledRemainingMinutes} minute(s).`
            : 'Your chat is disabled by moderation action.',
        )
      }
      prevChatDisabledRef.current = userChatDisabled
    }, [userChatDisabled, chatDisabledRemainingMinutes])

    const hostChatDisabledByOfficer = useMemo(
      () => isBroadcastChatLockActive({
        disabled: hostChatDisabledByOfficerState,
        until: hostChatDisabledUntil,
        streamId,
        lockedStreamId: hostChatDisabledStreamId,
      }),
      [hostChatDisabledByOfficerState, hostChatDisabledUntil, hostChatDisabledStreamId, streamId],
    )

     // Load blocked usernames for chat filtering
    useEffect(() => {
      if (!user?.id) {
        setBlockedUsernames(new Set())
        return
      }
      getBlockedUserIds().then(async (ids) => {
        if (ids.length === 0) {
          setBlockedUsernames(new Set())
          return
        }
        // Resolve blocked user IDs to usernames
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('username, email')
          .in('id', ids)
        const names = new Set<string>()
        profiles?.forEach((p: any) => {
          if (p.username) names.add(p.username.toLowerCase())
        })
        setBlockedUsernames(names)
      }).catch(() => {})
    }, [user?.id])

    useEffect(() => {
      const broadcasterId = stream?.user_id
      if (!streamId || !broadcasterId) {
        setHostChatDisabledByOfficerState(false)
        setHostChatDisabledUntil(null)
        setHostChatDisabledStreamId(null)
        return
      }

      let mounted = true
      let channel: ReturnType<typeof supabase.channel> | null = null

      const applyLockState = (data: any) => {
        if (!mounted) return
        setHostChatDisabledByOfficerState(!!data?.broadcast_chat_disabled)
        setHostChatDisabledUntil(data?.broadcast_chat_disabled_until ?? null)
        setHostChatDisabledStreamId(data?.broadcast_chat_disabled_stream_id ?? null)
      }

      const fetchHostChatLock = async () => {
        const { data } = await supabase
          .from('user_profiles')
          .select('broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id')
          .eq('id', broadcasterId)
          .maybeSingle()

        if (!mounted) return
        applyLockState(data)
      }

      channel = supabase
        .channel(`broadcast-chat-lock:${streamId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${broadcasterId}`,
        }, (payload) => {
          applyLockState(payload.new)
        })
        .subscribe()

      void fetchHostChatLock()
      const interval = window.setInterval(fetchHostChatLock, 30_000)

      return () => {
        mounted = false
        window.clearInterval(interval)
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    }, [streamId, stream?.user_id])

    useEffect(() => {
      const updateRemaining = () => {
        setHostChatDisableRemainingMs(getBroadcastChatLockRemainingMs(hostChatDisabledUntil))
      }

      updateRemaining()
      const interval = window.setInterval(updateRemaining, 1000)

      return () => window.clearInterval(interval)
    }, [hostChatDisabledUntil])

   // Fetch recent utromail threads when message popup opens
   useEffect(() => {
     if (!isMessagePopupOpen || !user?.id) return;

     const loadThreads = async () => {
       try {
         const threads = await getThreads(user.id, 'inbox');
         setRecentThreads(threads.slice(0, 5));
       } catch (err) {
         console.error('[ViewerPage] Failed to load threads:', err);
       }
     };

     void loadThreads();
   }, [isMessagePopupOpen, user?.id]);

   // Fetch messages when a thread is selected
   useEffect(() => {
     if (!selectedThread || !user?.id) return;

     const loadMessages = async () => {
       setMessagesLoading(true);
       try {
         const msgs = await getThreadMessages(selectedThread.id);
         setThreadMessages(msgs);
       } catch (err) {
         console.error('[ViewerPage] Failed to load messages:', err);
       } finally {
         setMessagesLoading(false);
       }
     };

     void loadMessages();
   }, [selectedThread, user?.id]);

  // Desktop floating chat: always scroll to top so newest messages are visible
  useEffect(() => {
    const el = floatingChatContainerRef.current
    if (el) {
      el.scrollTop = 0
    }
  }, [floatingMessages.length])
  // Global per-page dedupe of gift animations.  The same stream_gifts row can
  // arrive via postgres_changes and via the broadcast channel; both resolve to
  // the same animationId (row UUID) so this Set catches the second arrival.
  const seenGiftAnimationIdsRef = useRef<Set<string>>(new Set())
  const [userActionTarget, setUserActionTarget] = useState<{
    userId: string
    username?: string
    role?: string
    createdAt?: string
  } | null>(null)
  const [showViewerAction, setShowViewerAction] = useState(false)
  const [selectedSeatUserId, setSelectedSeatUserId] = useState<string | null>(null)
  const [raidTarget, setRaidTarget] = useState<{ userId: string; houseId: string } | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [retryAdmissionKey, setRetryAdmissionKey] = useState(0)
  const lastPermissionErrorRef = useRef<number>(0)
  const PERMISSION_ERROR_COOLDOWN_MS = 5000

  // Stream-scoped broadofficer status (authoritative for current stream, realtime)
  const [isStreamBroadofficer, setIsStreamBroadofficer] = useState(false)
  // Server-authoritative moderation context (staff role + clock-in), realtime
  const [modContext, setModContext] = useState<any>(null)
  // Authoritative current-user roles read from user_profile_roles (not derived flags).
  const [myProfileRoleTypes, setMyProfileRoleTypes] = useState<string[]>([])
  const [myProfileAdminFlags, setMyProfileAdminFlags] = useState<{ is_admin: boolean; is_ceo: boolean; role: string | null }>({ is_admin: false, is_ceo: false, role: null })
  const { topGifters, isLoading: isTopFansLoading } = useStreamTopGifters({ streamId: streamId || null, limit: 10 })

  // Realtime broadofficer status for THIS stream. Powers appear/disappear
  // immediately without refresh when the broadcaster assigns/removes.
  useEffect(() => {
    const sid = streamId
    if (!sid || !user?.id) { setIsStreamBroadofficer(false); return }
    let active = true
    const refresh = () => {
      supabase
        .from('broadcast_officers')
        .select('officer_id')
        .eq('stream_id', sid)
        .then(({ data }) => {
          if (!active) return
          const ids = new Set((data || []).map((r: any) => r.officer_id))
          setIsStreamBroadofficer(ids.has(user.id))
        })
    }
    refresh()
    const channel = supabase
      .channel(`broadofficers-viewer:${sid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'broadcast_officers',
        filter: `stream_id=eq.${sid}`,
      }, refresh)
      .subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [streamId, user?.id])

  // Authoritative staff moderation context. Clock-in changes propagate via
  // realtime so available actions update immediately (no stale local state).
  useEffect(() => {
    const sid = streamId
    if (!sid || !user?.id) { setModContext(null); return }
    let active = true
    const refresh = () => {
      supabase.rpc('get_viewer_mod_context', { p_stream_id: sid }).then(({ data }) => {
        if (active) setModContext(data)
      })
    }
    refresh()
    const channel = supabase
      .channel(`work-sessions:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'officer_work_sessions',
        filter: `officer_id=eq.${user.id}`,
      }, refresh)
      .subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [streamId, user?.id])

  // Authoritative current-user roles from user_profile_roles + user_profiles.
  // The mod action menu for viewers is decided from these roles (not derived
  // isModOrHigher flags and not gated on staff clock-in), so broadcasters,
  // broadofficers, admins, ceos and all staff always get the full moderation menu.
  useEffect(() => {
    if (!user?.id) { setMyProfileRoleTypes([]); return }
    let active = true
    const refresh = async () => {
      const { data: roles } = await supabase
        .from('user_profile_roles')
        .select('role_type')
        .eq('user_id', user.id)
        .eq('is_active', true)
      if (active && roles) {
        setMyProfileRoleTypes(roles.map((r: any) => String(r.role_type).toLowerCase()))
      }
    }
    void refresh()
    return () => { active = false }
  }, [user?.id])

  // Authoritative admin/ceo flags read straight from user_profiles (not the
  // possibly-stale local auth profile) so the mod menu shows for admins too.
  useEffect(() => {
    if (!user?.id) { setMyProfileAdminFlags({ is_admin: false, is_ceo: false, role: null }); return }
    let active = true
    const refresh = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_admin, is_ceo, role')
        .eq('id', user.id)
        .maybeSingle()
      if (active && data) {
        setMyProfileAdminFlags({
          is_admin: Boolean(data.is_admin),
          is_ceo: Boolean(data.is_ceo),
          role: data.role ?? null,
        })
      }
    }
    void refresh()
    return () => { active = false }
  }, [user?.id])

  const MOD_MENU_ROLE_TYPES = new Set([
    'broadcaster', 'troll_officer', 'lead_troll_officer', 'pastor',
    'secretary', 'ceo_assistant', 'noah_assistant', 'agency_leader',
    'agency_hr', 'agency_hr_manager', 'attorney', 'prosecutor',
    'journalist', 'news_caster', 'chief_news_caster', 'auctioneer', 'seller', 'troller',
  ])
  const hasModMenuFromRoles = myProfileRoleTypes.some((r) => MOD_MENU_ROLE_TYPES.has(r))
  const showModActionMenu = Boolean(
    modContext?.has_full_staff_tools || isStreamBroadofficer || hasModMenuFromRoles ||
    myProfileAdminFlags.is_admin || myProfileAdminFlags.is_ceo ||
    ['admin', 'ceo', 'owner', 'superadmin', 'staff', 'moderator'].includes(myProfileAdminFlags.role ?? '')
  )

  const resolveGiftAmount = useCallback((giftData: any): number => {
    const metadata = giftData?.metadata || {}
    const quantity = Math.max(1, Number(giftData?.quantity ?? metadata.quantity ?? 1) || 1)

    const directAmountCandidates = [
      giftData?.coins_spent,
      giftData?.coins_amount,
      giftData?.total_amount,
      giftData?.total_coins,
      metadata.coins_spent,
      metadata.coins_amount,
      metadata.total_amount,
      metadata.total_coins,
      giftData?.amount,
      metadata.amount,
    ]

    for (const candidate of directAmountCandidates) {
      const value = Number(candidate)
      if (Number.isFinite(value) && value > 0) return value
    }

    const unitAmountCandidates = [
      giftData?.coin_value,
      giftData?.gift_value,
      giftData?.gift_price,
      giftData?.price,
      metadata.coin_value,
      metadata.gift_value,
      metadata.gift_price,
      metadata.price,
    ]

    for (const candidate of unitAmountCandidates) {
      const value = Number(candidate)
      if (Number.isFinite(value) && value > 0) return value * quantity
    }

    return quantity
  }, [])

  const resolveGiftName = useCallback((giftData: any): string => {
    const metadata = giftData?.metadata || {}
    return (
      giftData?.gift_name ||
      giftData?.name ||
      giftData?.title ||
      metadata.gift_name ||
      metadata.name ||
      metadata.title ||
      'Gift'
    )
  }, [])

   const handleRemoveGiftOverlay = useCallback((giftId: string) => {
     setRecentGifts((current) => current.filter((gift) => gift.id !== giftId))
   }, [])

   const processGiftEvent = useCallback(async (giftData: any) => {
     if (!giftData) return

     if (import.meta.env.DEV) {
       console.error('[GIFT RAW EVENT DEBUG]', {
         raw: giftData,
         id: giftData?.id,
         gift_id: giftData?.gift_id,
         gift_item_id: giftData?.gift_item_id,
         gift_slug: giftData?.gift_slug,
         slug: giftData?.slug,
         metadata: giftData?.metadata,
         animation_url: giftData?.animation_url,
         video_url: giftData?.video_url,
         stream_id: giftData?.stream_id,
         sender_id: giftData?.sender_id,
         receiver_id: giftData?.receiver_id,
       })
     }

     // Normalise to a stable animationId that is the same whether the event
     // came from postgres_changes (event.new.id = row UUID) or from the
     // broadcast channel (payload.id = same row UUID via transaction_id).
     const animationId = String(giftData.id || giftData.stream_gift_id || giftData.gift_transaction_id || '')
     if (!animationId) return

     // Hydrate FIRST, then dedupe. A bad/incomplete local event must not
     // block the later canonical stream_gifts event.
     const enrichedGiftData = await hydrateGiftForOverlay(giftData)

     const resolvedMedia =
       enrichedGiftData?.animation_url ||
       enrichedGiftData?.video_url ||
       enrichedGiftData?.metadata?.animation_url ||
       enrichedGiftData?.metadata?.video_url

     if (!resolvedMedia) {
       if (import.meta.env.DEV) {
         console.warn('[ViewerPage] Incomplete gift event ignored; waiting for canonical event', {
           animationId,
           giftData,
           enrichedGiftData,
         })
       }
       return
     }

     if (seenGiftAnimationIdsRef.current.has(animationId)) {
       if (import.meta.env.DEV) console.log('[ViewerPage] Duplicate animation skipped', { animationId })
       return
     }
     seenGiftAnimationIdsRef.current.add(animationId)
     window.setTimeout(() => seenGiftAnimationIdsRef.current.delete(animationId), 12_000)

     // Existing quick-dedupe (12 s window) for old-format giftIds too
     const giftId = animationId
     if (processedGiftIdsRef.current.has(giftId)) {
       if (import.meta.env.DEV) console.log('[ViewerPage] Duplicate gift event skipped', giftId)
       return
     }
     processedGiftIdsRef.current.add(giftId)
     window.setTimeout(() => processedGiftIdsRef.current.delete(giftId), 12_000)

     const incomingStreamId = enrichedGiftData.streamId || enrichedGiftData.stream_id || enrichedGiftData.metadata?.streamId || enrichedGiftData.metadata?.stream_id
     const receiverId = enrichedGiftData.receiver_id || enrichedGiftData.recipient_id || enrichedGiftData.receiverId || enrichedGiftData.recipientId || enrichedGiftData.metadata?.receiver_id || enrichedGiftData.metadata?.recipient_id

    if (incomingStreamId && incomingStreamId !== streamId) {
      if (import.meta.env.DEV) console.log('[ViewerPage] ⚠️ Stream ID mismatch, skipping gift:', { incomingStreamId, currentStreamId: streamId })
      return
    }

    const resolvedGiftAmount = resolveGiftAmount(enrichedGiftData)
    const resolvedGiftName = resolveGiftName(enrichedGiftData)

    const newGift = {
      id: giftId,
      gift_id: enrichedGiftData.gift_id,
      gift_name: resolvedGiftName,
      gift_icon: enrichedGiftData.gift_icon || enrichedGiftData.metadata?.gift_icon || '🎁',
      gift_slug: enrichedGiftData.gift_slug || enrichedGiftData.metadata?.gift_slug,
      animation_key: enrichedGiftData.animation_key || enrichedGiftData.metadata?.animation_key,
      animation_type: enrichedGiftData.animation_type || enrichedGiftData.metadata?.animation_type,
      animation_url:
        enrichedGiftData.animation_url ||
        enrichedGiftData.video_url ||
        enrichedGiftData.metadata?.animation_url ||
        enrichedGiftData.metadata?.video_url ||
        undefined,
      video_url:
        enrichedGiftData.video_url ||
        enrichedGiftData.animation_url ||
        enrichedGiftData.metadata?.video_url ||
        enrichedGiftData.metadata?.animation_url ||
        undefined,
      animation_duration_ms: enrichedGiftData.animation_duration_ms || enrichedGiftData.metadata?.animation_duration_ms,
      sound_url: enrichedGiftData.sound_url || enrichedGiftData.metadata?.sound_url,
      is_fullscreen: enrichedGiftData.is_fullscreen ?? enrichedGiftData.metadata?.is_fullscreen,
      rarity: enrichedGiftData.rarity || enrichedGiftData.metadata?.rarity,
      tray_visual_url: enrichedGiftData.tray_visual_url || enrichedGiftData.metadata?.tray_visual_url,
      tray_gradient: enrichedGiftData.tray_gradient || enrichedGiftData.metadata?.tray_gradient,
      amount: resolvedGiftAmount || enrichedGiftData.quantity || 1,
      quantity: enrichedGiftData.quantity || 1,
      sender_id: enrichedGiftData.sender_id,
      sender_name: enrichedGiftData.sender_name || enrichedGiftData.metadata?.sender_name || 'Someone',
      receiver_id: receiverId,
      receiver_name: enrichedGiftData.receiver_name || enrichedGiftData.metadata?.receiver_name,
      created_at: enrichedGiftData.timestamp || enrichedGiftData.created_at || new Date().toISOString(),
    } as BroadcastGift

     setRecentGifts((prev) => {
       if (prev.some((gift) => gift.id === giftId)) return prev
       return [...prev, newGift].slice(-20)
     })

     const streamGiftEvent: StreamGiftEvent = {
       id: giftId,
       stream_id: streamId,
       gift_id: enrichedGiftData.gift_id || '',
       gift_name: resolvedGiftName,
       sender_user_id: enrichedGiftData.sender_id || '',
      recipient_user_id: receiverId || stream?.user_id || '',
      recipient_type: 'broadcaster',
       recipient_seat_index: null,
       animation_url: newGift.animation_url || null,
       animation_url_webm: enrichedGiftData.animation_url_webm || null,
       animation_url_mp4: enrichedGiftData.animation_url_mp4 || null,
       animation_url_mov: enrichedGiftData.animation_url_mov || null,
       animation_type: (newGift.animation_type || 'video') as StreamGiftEvent['animation_type'],
       animation_duration_ms: newGift.animation_duration_ms || 7000,
       sound_url: newGift.sound_url || null,
       created_at: newGift.created_at,
     }

     enqueueGift(streamGiftEvent)

     const giftDurationMs = newGift.animation_duration_ms ?? getGiftVisualConfig(newGift).durationMs
     window.setTimeout(() => {
       setRecentGifts((prev) => prev.filter((gift) => gift.id !== giftId))
     }, giftDurationMs + 150)
    }, [hydrateGiftForOverlay, resolveGiftAmount, resolveGiftName, streamId, enqueueGift])

  const processGiftEventRef = useRef(processGiftEvent)
  useEffect(() => {
    processGiftEventRef.current = processGiftEvent
  }, [processGiftEvent])

  useEffect(() => {
    const handler = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload) void processGiftEventRef.current(payload)
    }
    window.addEventListener('maitroll:gift-sent', handler)
    return () => {
      window.removeEventListener('maitroll:gift-sent', handler)
    }
  }, [])

  const hasJoinedAudienceRef = useRef(false)
   const joiningAudienceRef = useRef(false)
   const audienceFailedUntilRef = useRef<number>(0)
   const audienceJoinAttemptedKeyRef = useRef<string | null>(null)
   const joiningPublisherRef = useRef(false)
   const currentRoomKeyRef = useRef<string | null>(null)
   const viewerIdentityRef = useRef<string>(
     `viewer-${streamId}-${user?.id || Math.random().toString(36).slice(2, 9)}`,
   )
    const joinAudienceRef = useRef<(options?: any) => Promise<any>>(null as any)
    const heartbeatAudienceRef = useRef<() => Promise<void>>(null as any)
    const leaveAudienceRef = useRef<() => Promise<void>>(null as any)
    const leaveSeatRef = useRef<() => Promise<void>>(null as any)
    const audienceStreamIdRef = useRef<string>('')
    const hasJoinedStreamAudienceRef = useRef(false)

    const watchTimeIntervalRef = useRef<number | null>(null)
    const clickTimesRef = useRef<number[]>([])
    const blockedUntilRef = useRef<number | null>(null)
    const processedMessageIdsRef = useRef<Set<string>>(new Set())
    const recentChatKeysRef = useRef<Map<string, number>>(new Map())

   // Paid chat state for viewers
   const [isPaidChatModalOpen, setIsPaidChatModalOpen] = useState(false)
   const [paidChatPricePerUser, setPaidChatPricePerUser] = useState<number>(0)
   const [paidChatPricePerChat, setPaidChatPricePerChat] = useState<number>(0)
    const [isPaidChatEnabled, setIsPaidChatEnabled] = useState(false)

    // Load paid chat settings from stream
    useEffect(() => {
      if (!streamId) return;
      const fetchPaidChatSettings = async () => {
        try {
          const { data } = await supabase
            .from('stream_settings')
            .select('paid_chat_enabled, paid_chat_type, paid_chat_price')
            .eq('stream_id', streamId)
            .maybeSingle();
          if (data?.paid_chat_enabled) {
            const price = Number(data.paid_chat_price ?? 0);
            const type = data.paid_chat_type || 'per_user';
            if (type === 'per_chat') {
              setPaidChatPricePerUser(0);
              setPaidChatPricePerChat(price);
            } else {
              setPaidChatPricePerUser(price);
              setPaidChatPricePerChat(0);
            }
            setIsPaidChatEnabled(price > 0);
          } else {
            setIsPaidChatEnabled(false);
          }
        } catch {
          setIsPaidChatEnabled(false);
        }
      };
      void fetchPaidChatSettings();
    }, [streamId]);

  const defaultSeatCount = Array.isArray((stream as any)?.seat_prices)
    ? (stream as any).seat_prices.length
    : 1

   const { boxCount: hookBoxCount } = useBoxCount({
     streamId: streamId || '',
     initialBoxCount: ((stream as any)?.seat_count !== undefined ? Number((stream as any).seat_count) + 1 : undefined) || (stream as any)?.box_count || defaultSeatCount || 1,
     isHost: false,
   })

    const effectiveBoxCount = useMemo(() => {
      // Celeb streams do not have guest seats — only the broadcaster tile.
      if ((stream as any)?.stream_type === 'celeb_stream') return 1

      // seat_count is guest-seat count (broadcaster is NOT a seat).
      // Total boxes = guest seats + 1 broadcaster box.
      const seatCount = (stream as any)?.seat_count !== undefined ? Number((stream as any).seat_count) : undefined
      if (seatCount !== undefined) {
        if (seatCount === 0) return 1 // broadcaster only, 1 box
        return Math.max(1, Math.min(MAX_TOTAL_BOXES, seatCount + 1))
     }

     const seatCountFromPrices = Array.isArray((stream as any)?.seat_prices)
       ? Math.max(1, (stream as any).seat_prices.length)
       : 0

     if (seatCountFromPrices > 0) {
       return Math.max(1, Math.min(MAX_TOTAL_BOXES, seatCountFromPrices))
     }

     return 1 // default: broadcaster only
   }, [stream, hookBoxCount])

   const layoutMode = useMemo(() => {
     return effectiveBoxCount <= 7 ? 'split' : 'grid'
   }, [effectiveBoxCount])

    const refreshStageConfig = useCallback(async () => {
     if (!streamId || streamEndedRef.current) return

     const { data, error } = await supabase
       .from('streams')
       .select(
         'id, status, is_live, ended_at, seat_count, box_count, seat_price, seat_prices, are_seats_locked',
       )
       .eq('id', streamId)
       .maybeSingle()

     if (error) {
       console.warn('[ViewerPage] refreshStageConfig failed:', error)
       return
     }

     if (!data) return

     setStream((prev) => {
       if (!prev) return data as unknown as Stream
       return {
         ...(prev as any),
         ...(data as any),
         seat_count: typeof data.seat_count !== 'undefined' ? data.seat_count : (prev as any).seat_count,
         box_count: typeof data.box_count !== 'undefined' ? data.box_count : (prev as any).box_count,
         seat_price: typeof data.seat_price !== 'undefined' ? data.seat_price : (prev as any).seat_price,
         seat_prices: typeof data.seat_prices !== 'undefined' ? data.seat_prices : (prev as any).seat_prices,
         are_seats_locked: typeof data.are_seats_locked !== 'undefined' ? data.are_seats_locked : (prev as any).are_seats_locked,
       } as Stream
     })
   }, [streamId, setStream])

    const {
      seats,
      mySeat,
      joiningSeatId,
      leavingSeatId,
      joinSeat,
      leaveSeat,
      markSeatLive,
      refreshSeats,
      removeSeat,
      removeSeatByUserId,
      handleParticipantDisconnected,
    } = useStreamSeats(streamId || '', user?.id, broadcasterProfile, stream as any, refreshStageConfig)
    const { audience, activeAudience, topAudience, myPresence, joinAudience, leaveAudience, heartbeatAudience, incrementGiftTotal } = useStreamAudiencePresence(streamId || '', user?.id)

   const [showViewerList, setShowViewerList] = useState(false)
   const onActiveViewersClick = useCallback(() => {
     setShowViewerList(prev => !prev)
   }, [])

   // Mirror active audience presence into viewerCount so the header ticker
   // shows a live count even when streams.current_viewers has not been
   // refreshed yet by the broadcaster-side RPC.
   useEffect(() => {
     setViewerCount((prev) => Math.max(prev, activeAudience.length))
   }, [activeAudience.length])

    useEffect(() => {
     joinAudienceRef.current = joinAudience
   }, [joinAudience])

   useEffect(() => {
     heartbeatAudienceRef.current = heartbeatAudience
   }, [heartbeatAudience])

    useEffect(() => {
      leaveAudienceRef.current = leaveAudience
    }, [leaveAudience])

    useEffect(() => {
      leaveSeatRef.current = leaveSeat
    }, [leaveSeat])

      // Refs to hold LiveKit functions populated after useLiveKitRoom hook runs
     const unpublishLocalTracksRef = useRef<(() => Promise<void>) | null>(null)
     const leaveLiveKitRoomRef = useRef<(() => Promise<void>) | null>(null)
     const localAudioTrackRef = useRef<any>(null)

    // Track whether we already processed a kick for this user to avoid double-processing
    const kickProcessedRef = useRef(false)

   // Guard against double navigation when stream ends (realtime + polling)
    const streamEndedRef = useRef(false)

     // Listen for seat_left broadcast events from broadcaster/officer removes
     // When the kicked user is the current viewer, run the same client-side
     // cleanup they would get if they clicked "Leave seat" themselves.
     // Non-kick seat_left events are already handled by useStreamSeats via
     // postgres_changes and broadcast events, so this handler only acts on
     // the current-user-kicked case to avoid duplicate state updates.
     useEffect(() => {
       if (!streamId) return
       kickProcessedRef.current = false
       const channel = supabase.channel(`stream-seat-events-kick:${streamId}`)
       channel
          .on('broadcast', { event: 'seat_left' }, (payload) => {
            if (kickProcessedRef.current) return
            if (!mySeat) return

            const payloadUserId = String(payload?.payload?.user_id || '').trim()
            const payloadSessionId = String(payload?.payload?.session_id || '').trim()

           const isCurrentUserKicked =
             (payloadUserId && payloadUserId === user?.id) ||
             (payloadSessionId && payloadSessionId === mySeat?.id) ||
             (payloadUserId && (payloadUserId === mySeat?.user_id || payloadUserId === mySeat?.guest_id))

           if (!isCurrentUserKicked) return

            kickProcessedRef.current = true
            void (async () => {
              try {
                await unpublishLocalTracksRef.current?.()
              } catch (err) {
                // ignore
              }
              hasJoinedAudienceRef.current = false
              joiningAudienceRef.current = false
              currentRoomKeyRef.current = null
              navigate('/?kicked=Removed%20from%20stage', { replace: true })
            })()
         })
         .subscribe()
       return () => {
         if (channel) {
           supabase.removeChannel(channel)
         }
         kickProcessedRef.current = false
       }
      }, [streamId, user?.id, mySeat, navigate])

   const normalizeSeatStatus = (status?: string | null) => String(status || '').trim().toLowerCase()
   const isSeatActiveStatus = (status?: string | null) => {
     const normalized = normalizeSeatStatus(status)
     return ['reserved', 'camera_starting', 'active', 'live'].includes(normalized)
   }
   const isSeatOpenStatus = (status?: string | null) => {
     const normalized = normalizeSeatStatus(status)
     return ['empty', 'failed', 'left', 'cancelled', 'expired'].includes(normalized)
   }

   const isUserOnStage = Boolean(
     mySeat &&
       isSeatActiveStatus(mySeat.status) &&
       (mySeat.user_id === user?.id || mySeat.guest_id === user?.id),
   )

  const [isBattleButtonBusy, setIsBattleButtonBusy] = useState(false)

  const [seatMicOn, setSeatMicOn] = useState(true)
  const [seatCamOn, setSeatCamOn] = useState(true)

  // Tracks whether the current user was muted by a moderator so they cannot
  // unmute themselves while the moderator mute is active.
  const isModeratorMutedRef = useRef(false)
  const moderatorMuteTimestampRef = useRef(0)
  const moderatorMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleStartSeatBattle = useCallback(async () => {
    if (!stream?.id || !user?.id || !isUserOnStage) return

    setIsBattleButtonBusy(true)
    try {
      const { data, error } = await supabase.rpc('captain_click_battle', {
        p_stream_id: stream.id,
        p_captain_id: user.id,
      })

   // ── Seat Debug Overlay (dev only) ──
   const [seatDebugOpen, setSeatDebugOpen] = useState(false)
   const [seatErrors, setSeatErrors] = useState<string[]>([])
   const prevEffectiveBoxCountRef = useRef(effectiveBoxCount)
   const prevSeatCountRef = useRef(Object.keys(seats).length)

   useEffect(() => {
     if (!import.meta.env.DEV) return
     const changed: string[] = []
     if (prevEffectiveBoxCountRef.current !== effectiveBoxCount) {
       changed.push(`boxCount: ${prevEffectiveBoxCountRef.current} -> ${effectiveBoxCount}`)
       prevEffectiveBoxCountRef.current = effectiveBoxCount
     }
     const seatCount = Object.keys(seats).length
     if (prevSeatCountRef.current !== seatCount) {
       changed.push(`seats: ${prevSeatCountRef.current} -> ${seatCount}`)
       prevSeatCountRef.current = seatCount
     }
     if (changed.length > 0 && seatDebugOpen) {
       setSeatErrors(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${changed.join(', ')}`])
     }
   }, [effectiveBoxCount, seats, seatDebugOpen])

   // Listen for useStreamSeats errors via console or add explicit error boundary
   useEffect(() => {
     if (!import.meta.env.DEV || !seatDebugOpen) return
     const originalError = console.error
     const handler = (...args: any[]) => {
       const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
       if (msg.includes('seat') || msg.includes('Seat') || msg.includes('useStreamSeats')) {
         setSeatErrors(prev => [...prev.slice(-50), `ERROR: ${msg}`])
       }
       originalError.apply(console, args)
     }
     console.error = handler
     return () => { console.error = originalError }
   }, [seatDebugOpen])

   if (error) {
        console.error('[ViewerPage] captain_click_battle error:', error)
        toast.error('Failed to start battle')
        return
      }

      if (data?.matched) {
        toast.success('Battle matched!')
      } else if (data?.status === 'waiting_for_opponent') {
        toast.success('Searching for opponent...')
      } else {
        toast.success('Battle search started')
      }
    } catch (err) {
      console.error('[ViewerPage] start stage battle failed:', err)
      toast.error('Failed to start battle')
    } finally {
      setIsBattleButtonBusy(false)
    }
  }, [isUserOnStage, stream?.id, user?.id])

  const availableSeatIndex = useMemo(() => {
    if (effectiveBoxCount <= 1) return null

    for (let seatIndex = 1; seatIndex <= effectiveBoxCount; seatIndex += 1) {
      const seat = seats?.[seatIndex]
      const seatStatus = normalizeSeatStatus(seat?.status)
      const isOccupied = Boolean(
        isSeatActiveStatus(seatStatus) &&
        (seat?.user_id || seat?.guest_id),
      )
      if (!isOccupied) {
        return seatIndex
      }
    }

    return null
  }, [effectiveBoxCount, seats])

  const userIdToLiveKitIdentity = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (!seats) return mapping;
    Object.entries(seats).forEach(([seatIndex, seat]) => {
      const seatData = seat as any;
      const userId = seatData?.user_id || seatData?.guest_id;
      const identity = seatData?.livekit_participant_identity || seatData?.participant_identity || seatData?.livekit_identity;
      if (userId && identity) {
        mapping[userId] = identity;
      }
    });
    return mapping;
  }, [seats]);

  const availableSeatPrice = useMemo(() => {
    if (typeof availableSeatIndex !== 'number') return 0

    return Array.isArray((stream as any)?.seat_prices)
      ? (stream as any).seat_prices[availableSeatIndex]
      : (stream as any)?.seat_price ?? 0
  }, [availableSeatIndex, stream])

  const handleJoinAvailableSeat = useCallback(async () => {
    if (typeof availableSeatIndex !== 'number') return
    await joinSeat(availableSeatIndex, availableSeatPrice)
  }, [availableSeatIndex, availableSeatPrice, joinSeat])

  const joinSeatThrottleRef = useRef<{ lastTime: number; count: number }>({ lastTime: 0, count: 0 })

  const handleJoinSeatByIndex = useCallback(async (seatIndex: number) => {
    if (typeof seatIndex !== 'number') return
    const now = Date.now()
    const throttle = joinSeatThrottleRef.current
    if (now - throttle.lastTime > 1000) {
      throttle.lastTime = now
      throttle.count = 0
    }
    throttle.count += 1
    if (throttle.count > 5) {
      toast.error('Please slow down — you are joining seats too quickly.')
      return
    }
    const seatPrice = getSeatPriceForIndex(stream as Stream | null, seatIndex)
    await joinSeat(seatIndex, seatPrice)
  }, [joinSeat, stream])

  const handleAddSeat = useCallback(async () => {
    if (!streamId || !user?.id) {
      toast.error('Not connected to a live stream')
      return
    }
    try {
      const currentBoxCount = Number((stream as any)?.box_count ?? effectiveBoxCount ?? 1)
      const currentGuestSeats = Math.max(0, currentBoxCount - 1)
      const desiredGuestSeats = Math.min(MAX_TOTAL_BOXES - 1, currentGuestSeats + 1)
      const desiredBoxCount = desiredGuestSeats + 1
      const currentSeatPrices = Array.isArray((stream as any)?.seat_prices)
        ? (stream as any).seat_prices
        : []
      const newSeatPrices = [...currentSeatPrices]
      while (newSeatPrices.length < desiredBoxCount) {
        newSeatPrices.push(0)
      }
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          box_count: desiredBoxCount,
          seat_count: desiredGuestSeats,
          seat_prices: newSeatPrices,
        })
        .eq('id', streamId)
      if (updateError) throw updateError
      setStream((current) => current ? {
        ...current,
        box_count: desiredBoxCount,
        seat_count: desiredGuestSeats,
        seat_prices: newSeatPrices,
      } : current)
      toast.success('Seat added to stage')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add seat')
    }
  }, [streamId, user?.id, stream, effectiveBoxCount])

  // Fetch stream mods for the floating overlay badges
  useEffect(() => {
    const fetchMods = async () => {
      const targetHostId = (stream as any)?.user_id;
      if (!targetHostId) return;
      const { data } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', targetHostId);
      if (data) setStreamMods(data.map((d: any) => d.user_id));
    };
    if ((stream as any)?.user_id) fetchMods();
  }, [(stream as any)?.user_id]);

const isActive = isStreamActive(stream)
   const hostId = (stream as any)?.user_id || ''
   const hostName = getDisplayName(broadcasterProfile, 'Broadcaster')
   const { subscriberUsernames } = useSubscriberUsernames(hostId)

    const roomId = useMemo(() => {
     return String(getLiveKitRoomName(stream as Stream | null, streamId) || '')
   }, [stream?.livekit_room_name, stream?.id, streamId])

    const stableAnonId = anonViewerId;

    const currentViewerId = user?.id || stableAnonId;

    // Anonymous viewers cannot be written to stream_audience_presence (the
    // user_id column is a FK to user_profiles), but they DO watch the stream via
    // LiveKit. Inject a synthetic audience member so the broadcaster's ticker
    // (and this viewer's own "you" pill) shows the anonymous watcher as an
    // anon profile pic without touching the real presence table.
    const audienceWithAnon = useMemo(() => {
      if (user?.id || !stableAnonId) return audience

      const anonMember: StreamAudienceMember = {
        id: `anon:${stableAnonId}`,
        stream_id: streamId,
        user_id: stableAnonId,
        username: anonDisplayName || 'anon',
        avatar_url: null,
        joined_at: new Date().toISOString(),
        left_at: null,
        is_active: true,
        is_present: true,
        gift_total: 0,
        gift_score: 0,
        seat_id: null,
        seat_status: 'audience',
        role: 'audience',
        last_seen_at: new Date().toISOString(),
        is_ghost_mode: false,
      }

      return [anonMember, ...audience]
    }, [audience, user?.id, stableAnonId, anonDisplayName, streamId])

    const viewerIdentity = useMemo(() => {
      const effectiveUserId = user?.id || stableAnonId;
      if (!streamId || !effectiveUserId) return '';
      return `viewer-${streamId}-${effectiveUserId}`;
    }, [streamId, user?.id, stableAnonId])

    useEffect(() => {
      viewerIdentityRef.current = viewerIdentity
    }, [viewerIdentity])

   const audienceName = useMemo(() => {
     return user
       ? (profile?.username || (user as any).username || 'Viewer')
       : (anonDisplayName || 'Viewer')
   }, [user, profile, anonDisplayName])

  const handleLiveKitError = useCallback((err: any) => {
    const errorDetail = err?.message || err?.statusText || String(err) || 'Unknown LiveKit audience error'
    console.warn('[ViewerPage] LiveKit audience join failed; showing fallback viewer state', err)
    setViewerError(errorDetail)
  }, [])

  const noopCallback = useCallback(() => {}, [])

     const {
      remoteUsers,
      localVideoTrack,
      localAudioTrack,
      isPublishing,
      joinAsAudience,
      leaveRoom: leaveLiveKitRoom,
      publishLocalTracks,
      unpublishLocalTracks,
      setMicEnabled,
      setCameraEnabled,
      room: liveKitRoom,
      lastJoinDebug,
    } = useLiveKitRoom({
      roomId,
      roomType: 'broadcast',
      role: 'viewer',
      publish: false,
      audioOnly: false,
      userName: audienceName,
      identity: viewerIdentity,
      onUserJoined: noopCallback,
      onUserLeft: useCallback((participant: any) => {
        const identity = participant?.identity || null
        if (identity) {
          handleParticipantDisconnected(identity)
        }
      }, [handleParticipantDisconnected]),
      onError: handleLiveKitError,
    })

    // Populate refs so the seat_left handler (defined before this hook) can call them
     unpublishLocalTracksRef.current = unpublishLocalTracks
     leaveLiveKitRoomRef.current = leaveLiveKitRoom
     localAudioTrackRef.current = localAudioTrack

  // Expose dev-only join debug overlay for mobile PWA troubleshooting
    const [showJoinDebug, setShowJoinDebug] = useState(true);
    const [showSubscribeModal, setShowSubscribeModal] = useState(false);

   const remoteParticipants = useMemo(() => {
     return Array.isArray(remoteUsers) ? remoteUsers : []
   }, [remoteUsers])

// ─── ISOLATED HOST PARTICIPANT STATE ───────────────────────────────────────
  // Host participant is tracked in a stable ref to prevent seat joins/leaves from
  // disrupting the broadcaster track. This state is ONLY updated when the host's
  // own tracks change, never when other participants (seats) come/go.
  
  interface SeatState {
    participant: any
    videoTrack: any
    audioTrack: any
    isLoading: boolean
    userId: string | null
  }

  interface BroadcasterState {
    participant: any
    videoTrack: any
    audioTrack: any
  }

  const hostParticipantRef = useRef<any>(null)
  const [seatTracks, setSeatTracks] = useState<Record<number, SeatState>>({})
  const [broadcasterState, setBroadcasterState] = useState<BroadcasterState>({
    participant: null,
    videoTrack: null,
    audioTrack: null,
  })
  
  // Sync broadcaster state — only touches host, never seats
  // Protects against stale participant objects during reconnect
  const updateBroadcasterState = useCallback((participant: any) => {
    const videoTrack = getVideoTrackFromParticipant(participant)
    const audioTrack = getAudioTrackFromParticipant(participant)
    setBroadcasterState(prev => {
      const prevIdentity = prev.participant?.identity || null
      const nextIdentity = participant?.identity || null

      if (prevIdentity === nextIdentity) {
        const nextVideoId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
        const nextAudioId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null

        if (!nextVideoId && !nextAudioId) {
          return prev
        }
      }

      const prevVideoId = prev.videoTrack?.mediaStreamTrack?.id || prev.videoTrack?.sid || null
      const nextVideoId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
      const prevAudioId = prev.audioTrack?.mediaStreamTrack?.id || prev.audioTrack?.sid || null
      const nextAudioId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null

      if (prevVideoId === nextVideoId && prevAudioId === nextAudioId && prevIdentity === nextIdentity) {
        return prev
      }

      return { participant, videoTrack, audioTrack }
    })
  }, [])

  // Sync broadcaster state from remoteParticipants — stable, only reacts to host changes
  // Never clears host state due to seat joins/leaves or temporary lookup failures
  useEffect(() => {
    let exactHost = remoteParticipants.find((p: any) => participantMatchesUser(p, hostId))
    if (!exactHost && liveKitRoom?.remoteParticipants) {
      exactHost = Array.from(liveKitRoom.remoteParticipants.values()).find((p: any) => participantMatchesUser(p, hostId))
    }
    if (exactHost) {
      updateBroadcasterState(exactHost)
      hostParticipantRef.current = exactHost
    } else if (hostParticipantRef.current) {
      // Keep using the last known good host participant.
      // Do NOT clear broadcasterState — host may be temporarily missing from
      // remoteParticipants during reconnect/subscribe. Only clear on stream end.
    }
  }, [remoteParticipants, hostId, updateBroadcasterState, liveKitRoom])

  // Mic mute callbacks for walkie-talkie integration (for users on stage)
  const handleToggleMic = useCallback(async () => {
    if (!isUserOnStage) return
    const nextMicOn = !seatMicOn
    if (nextMicOn && isModeratorMutedRef.current) {
      const elapsed = Date.now() - moderatorMuteTimestampRef.current
      if (elapsed < 5000) {
        const remaining = Math.ceil((5000 - elapsed) / 1000)
        toast.error(`You have been muted by a moderator. Wait ${remaining}s to unmute.`)
        return
      }
    }
    const ok = await setMicEnabled(nextMicOn)
    if (ok) setSeatMicOn(nextMicOn)
    console.log('[ViewerPage] seat mic toggled', nextMicOn)
  }, [isUserOnStage, seatMicOn, setMicEnabled])

  const handleToggleCamera = useCallback(async () => {
    if (!isUserOnStage) return
    const nextCamOn = !seatCamOn
    const ok = await setCameraEnabled(nextCamOn)
    if (ok) setSeatCamOn(nextCamOn)
    console.log('[ViewerPage] seat camera toggled', nextCamOn)
  }, [isUserOnStage, seatCamOn, setCameraEnabled])

  // ─── SEAT STATE MANAGEMENT (isolated from host) ───────────────────────────────
  // Guard: verify seatId is a valid seat index (not broadcaster/box 0)
  const isValidSeatId = useCallback((seatId: number): boolean => {
    return Number.isInteger(seatId) && seatId >= 1
  }, [])

  // Update a specific seat's state — guarded to only affect the target seat
  const updateSeatState = useCallback((seatId: number, participant: any, loading: boolean) => {
    if (!isValidSeatId(seatId)) {
      console.warn('[ViewerPage] updateSeatState: invalid seatId', seatId, 'ignoring')
      return
    }
    const videoTrack = getVideoTrackFromParticipant(participant)
    const audioTrack = getAudioTrackFromParticipant(participant)
    const userId = participant ? (participant.identity || participant.name || null) : null

    setSeatTracks(prev => {
      const prevSeat = prev[seatId]
      const prevVideoId = prevSeat?.videoTrack?.mediaStreamTrack?.id || prevSeat?.videoTrack?.sid || null
      const nextVideoId = videoTrack?.mediaStreamTrack?.id || videoTrack?.sid || null
      const prevAudioId = prevSeat?.audioTrack?.mediaStreamTrack?.id || prevSeat?.audioTrack?.sid || null
      const nextAudioId = audioTrack?.mediaStreamTrack?.id || audioTrack?.sid || null
      if (
        prevVideoId === nextVideoId &&
        prevAudioId === nextAudioId &&
        prevSeat?.participant === participant &&
        prevSeat?.isLoading === loading &&
        prevSeat?.userId === userId
      ) {
        return prev // No change
      }
      return {
        ...prev,
        [seatId]: { participant, videoTrack, audioTrack, isLoading: loading, userId },
      }
    })
  }, [isValidSeatId])

  // Clear a specific seat's state — only clears the target seat
  const clearSeatState = useCallback((seatId: number) => {
    if (!isValidSeatId(seatId)) {
      console.warn('[ViewerPage] clearSeatState: invalid seatId', seatId, 'ignoring')
      return
    }
    setSeatTracks(prev => {
      if (!prev[seatId]) return prev // Already empty
      const next = { ...prev }
      delete next[seatId]
      return next
    })
  }, [isValidSeatId])

  // Sync seat states from remoteParticipants — each seat only updates itself
  useEffect(() => {
    if (!seats) return

    Object.entries(seats).forEach(([seatIndexStr, seat]: [string, any]) => {
      const seatId = Number(seatIndexStr)
      if (!isValidSeatId(seatId)) return

      const seatUserId = seat?.user_id || seat?.guest_id || null
      const seatIdentity = seat?.livekit_participant_identity || seatUserId
      const isActive = isSeatActiveStatus(seat?.status)

      if (!isActive || !seatUserId) {
        clearSeatState(seatId)
        return
      }

      const participant = remoteParticipants.find((p: any) => {
        const pIdentity = String(p?.identity || '')
        return (
          participantMatchesUser(p, seatUserId) ||
          participantMatchesUser(p, seatIdentity) ||
          pIdentity === String(seatIdentity) ||
          pIdentity.endsWith(`-${seatIdentity}`) ||
          String(seatIdentity).endsWith(pIdentity)
        )
      }) || null

      if (participant && !participantMatchesUser(participant, seatUserId) && !participantMatchesUser(participant, seatIdentity)) {
        return // Participant doesn't match — don't update
      }

      const isLoading = normalizeSeatStatus(seat?.status) === 'camera_starting'
      updateSeatState(seatId, participant, isLoading)
    })

    // Clear seats that no longer exist in the seats data
    setSeatTracks(prev => {
      const validSeatIds = new Set(Object.keys(seats).map(Number).filter(isValidSeatId))
      let changed = false
      const next: Record<number, SeatState> = {}
      for (const [id, state] of Object.entries(prev)) {
        if (validSeatIds.has(Number(id))) {
          next[Number(id)] = state
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [seats, remoteParticipants, isValidSeatId, updateSeatState, clearSeatState])
  

  // Check if current user is CEO
  const isCEO = Boolean(
    profile?.role === 'ceo' ||
      (profile as any)?.is_ceo ||
      profile?.role === 'admin' ||
      profile?.is_admin
  )

  const isOfficer = Boolean(
    profile?.role === 'admin' ||
      (profile as any)?.is_admin ||
      (profile?.role as string) === 'officer' ||
      (profile as any)?.is_troll_officer ||
      (profile as any)?.is_lead_officer ||
      profile?.role === 'ceo' ||
      (profile as any)?.is_ceo,
  )

  // Staff/CEO/admin/roles can add seats to any broadcast
  const canManageSeats = Boolean(
    user?.id === hostId ||
    isOfficer ||
    isStaffProfile(profile) ||
    isCEO ||
    profile?.role === 'ceo' ||
    profile?.role === 'admin' ||
    profile?.role === 'secretary' ||
    profile?.role === 'troll_officer' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'moderator' ||
    profile?.role === 'owner' ||
    profile?.role === 'president' ||
    profile?.role === 'vice_president' ||
    (profile as any)?.is_admin ||
    (profile as any)?.is_troll_officer ||
    (profile as any)?.is_lead_officer ||
    (profile as any)?.is_ceo ||
    profile?.troll_role === 'ceo' ||
    profile?.troll_role === 'admin' ||
    profile?.troll_role === 'lead_officer' ||
    profile?.troll_role === 'secretary' ||
    profile?.troll_role === 'pastor' ||
    profile?.troll_role === 'troll_officer'
  )

  // Debug panel: show last join debug when in dev and user toggles overlay
  const JoinDebugOverlay = () => {
    if (!import.meta.env.DEV) return null;
    if (!lastJoinDebug) return null;
    return (
      <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 9999, background: 'rgba(0,0,0,0.85)', color: 'white', padding: 8, borderRadius: 8, maxWidth: '90vw', maxHeight: '40vh', overflow: 'auto', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>LiveKit Join Debug</strong>
          <button onClick={() => setShowJoinDebug(s => !s)} style={{ marginLeft: 8 }}>{showJoinDebug ? 'Hide' : 'Show'}</button>
        </div>
        {showJoinDebug ? <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(lastJoinDebug, null, 2)}</pre> : null}
      </div>
    )
  }

   const isModerator = Boolean(
     isStaffProfile(profile) ||
       profile?.role === 'moderator' ||
       profile?.troll_role === 'moderator' ||
       profile?.role === 'admin' ||
       profile?.troll_role === 'admin' ||
       isStreamBroadofficer
   )

   const isModOrHigher = Boolean(isOfficer || isModerator || isCEO || isStaffProfile(profile))

   // Ghost Mode hook for CEOs
  const {
    ghostSession,
    isJoiningGhost,
    isLeavingGhost,
    isMicEnabled: isGhostMicEnabled,
    isCameraEnabled: isGhostCameraEnabled,
    joinGhostMode,
    leaveGhostMode,
    toggleMic: toggleGhostMic,
    toggleCamera: toggleGhostCamera,
  } = useGhostMode({
    streamId: streamId || '',
    userId: user?.id,
    isCEO,
  })

   // CityStatusOrb for broadcaster display
   const broadcasterCityStatus = useCityStatusOrb({
     userId: hostId,
     broadcasterId: user?.id,
     isBroadcaster: false,
     isBroadOfficer: isOfficer,
   })

   const activeSeats = useMemo(() => {
     return Object.values(seats || {}).filter(
       (seat: any) =>
         isSeatActiveStatus(seat?.status) &&
         (seat?.user_id || seat?.guest_id),
     )
   }, [seats])

  const activeUserIds = useMemo(() => {
    const ids: string[] = []
    activeSeats.forEach((seat: any) => {
      const id = seat?.user_id || seat?.guest_id
      if (id && id !== hostId) ids.push(id)
    })
    if (hostId) ids.unshift(hostId)
    return Array.from(new Set(ids))
  }, [activeSeats, hostId])

  const userProfiles = useMemo(() => {
    const profiles: Record<string, { username: string; avatar_url?: string }> = {}

    if (hostId && broadcasterProfile) {
      profiles[hostId] = {
        username: getDisplayName(broadcasterProfile, 'Broadcaster'),
        avatar_url: broadcasterProfile.avatar_url,
      }
    }

    activeSeats.forEach((seat: any) => {
      const userId = seat?.user_id || seat?.guest_id
      const seatProfile = seat?.user_profile || seat?.profile
      if (userId && seatProfile) {
        profiles[userId] = {
          username: getDisplayName(seatProfile, 'Stage Guest'),
          avatar_url: seatProfile.avatar_url,
        }
      }
    })

    return profiles
  }, [activeSeats, broadcasterProfile, hostId])

  const onGift = useCallback((userId?: string | null) => {
    setGiftRecipientId(userId || hostId || null)
    setIsGiftModalOpen(true)
  }, [hostId])

  const handleOpenUserAction = useCallback(async (info: { userId: string; username?: string; role?: string; createdAt?: string }) => {
    const normalizedUserId = info.userId
    const normalizedUsername = info.username || ''
    const isAnonUsername = isAnonymousDisplayName(normalizedUsername)

    if (!isValidUuid(normalizedUserId)) {
      if (isAnonUsername) {
        setUserActionTarget({
          userId: `anon-${normalizedUsername}`,
          username: normalizedUsername,
          role: 'anonymous',
          createdAt: null,
        })
        setShowViewerAction(!isModOrHigher)
        return
      }
      toast.error('Invalid user identifier')
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, troll_role, avatar_url')
        .eq('id', normalizedUserId)
        .maybeSingle()

      if (error || !data?.id) {
        console.error('[MOD TARGET RESOLUTION] Profile not found for UUID:', normalizedUserId, error)
        toast.error('MaiTroll profile could not be resolved for this participant.')
        return
      }

      console.error('[MOD TARGET RESOLUTION]', {
        clickedUsername: normalizedUsername,
        clickedProfileId: normalizedUserId,
        resolvedProfileId: data.id,
        resolvedUsername: data.username,
      })

      setUserActionTarget({
        userId: data.id,
        username: data.username || normalizedUsername,
        role: data.role || data.troll_role || info.role,
        createdAt: info.createdAt,
      })
      setShowViewerAction(!isModOrHigher)
    } catch (err) {
      console.error('[MOD TARGET RESOLUTION] Error resolving profile:', err)
      toast.error('Failed to resolve user profile')
    }
  }, [isModOrHigher])

  const pushFloatingSystemMessage = useCallback((content: string) => {
    const activeUsername = profile?.username || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setFloatingMessages((prev) => [{ id: msgId, username: activeUsername, content, createdAt: Date.now(), isSystem: true }, ...prev].slice(0, 50))

    window.setTimeout(() => {
      setFloatingMessages((prev) => prev.filter((message) => message.id !== msgId))
    }, CHAT_FLOAT_MS)

    const chatChannel = floatingChatChannelRef.current
    chatChannel?.send({
      type: 'broadcast',
      event: 'floating_chat',
      payload: { username: activeUsername, content, isSystem: true },
    }).catch(() => {})
  }, [profile?.username, user?.email])

  const handleFollowBroadcaster = useCallback((targetLabel: string) => {
    const broadcasterLabel = targetLabel || hostName || 'the broadcaster'
    pushFloatingSystemMessage(`${profile?.username || 'A viewer'} followed ${broadcasterLabel}`)
    }, [hostName, profile?.username, pushFloatingSystemMessage])

   const handleOpenFloatingChatUsername = useCallback(async (username: string) => {
     if (!username) return

      // For anonymous users: only mods/officers can click, open arrest dialog directly
      if (isAnonymousDisplayName(username)) {
        if (!isModOrHigher) return
        await handleOpenUserAction({
          userId: `anon-${username}`,
          username,
          role: 'anonymous',
          createdAt: null,
        })
        return
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, created_at, role, troll_role')
          .eq('username', username)
          .maybeSingle()
        
        if (error || !data?.id) {
          toast.error('User not found')
          return
        }
        
        await handleOpenUserAction({
          userId: data.id,
          username: data.username || username,
          role: data.role || data.troll_role,
          createdAt: data.created_at,
        })
     } catch (err) {
       console.error('[ViewerPage] Error opening user action:', err)
       toast.error('Failed to open user profile')
     }
    }, [isModOrHigher])

  const handleSendChat = useCallback(async (text: string, floatTimeout = CHAT_FLOAT_MS) => {
    if (!text.trim()) return

    if (hostChatDisabledByOfficer) {
      toast.error(
        hostChatDisableRemainingMs
          ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
          : 'Chat is disabled by officer control'
      )
      return
    }

    if (userChatDisabled) {
      toast.error(
        chatDisabledRemainingMinutes
          ? `Your chat is disabled. Try again in ${chatDisabledRemainingMinutes} minute${chatDisabledRemainingMinutes === 1 ? '' : 's'}.`
          : 'Your chat has been permanently disabled in this stream.'
      )
      return
    }

    if (!user && !reserveAnonymousChatSlot()) {
      toast.error("You've used your 5 anonymous chats. Sign in to keep chatting.")
      navigate('/auth?mode=login')
      return
    }

    const username = profile?.username || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(0, 50))
    setChatInput('')

    window.setTimeout(() => {
      setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
    }, floatTimeout)

    try {
      const result = await sendChatThroughGate({ streamId, content: text })
      if (!result.ok) {
        setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
        const errMsg = String(result.error || '').toLowerCase()
        if (errMsg.includes('currently disabled') || (errMsg.includes('chat') && errMsg.includes('disabled'))) {
          toast.error('Your chat is currently disabled.')
        } else if (errMsg.includes('muted')) {
          toast.error('You are muted in this stream.')
        } else if (errMsg.includes('banned')) {
          toast.error('You are banned from this stream.')
        } else if (errMsg.includes('high traffic')) {
          // High traffic sampling: silently drop optimistic message
        } else if (result.error) {
          toast.error(result.error)
        }
        return
      }

      const chatChannel = floatingChatChannelRef.current
      if (chatChannel) {
        chatChannel.send({
          type: 'broadcast',
          event: 'floating_chat',
          payload: { username, content: text },
        }).catch(() => {})
      }
    } catch (err) {
      console.warn('[ViewerPage] floating chat broadcast failed:', err)
    }
  }, [streamId, hostChatDisabledByOfficer, hostChatDisableRemainingMs, userChatDisabled, chatDisabledRemainingMinutes, user, profile, navigate])

   const refreshStream = useCallback(async () => {
     if (!streamId || streamEndedRef.current) return

     const { data, error } = await supabase
       .from('streams')
       .select('id, status, is_live, ended_at')
       .eq('id', streamId)
       .maybeSingle()

     if (error) {
       console.warn('[ViewerPage] refreshStream failed:', error)
       return
     }

     if (!data) return

     if (isStreamEnded(data as unknown as Stream)) {
       streamEndedRef.current = true
       leaveLiveKitRoom().catch(() => {})
       hasJoinedAudienceRef.current = false
       joiningAudienceRef.current = false
       currentRoomKeyRef.current = null
       navigate(`/broadcast/summary/${(data as any).id}`, { replace: true })
       return
     }
   }, [streamId, navigate])

   const handleLeaveSeat = useCallback(async () => {
    try {
      await unpublishLocalTracks()
    } catch (err) {
      console.warn('[ViewerPage] unpublishLocalTracks on leave seat failed:', err)
    }
    try {
      await leaveSeat()
    } catch (err) {
      console.warn('[ViewerPage] leaveSeat failed:', err)
    }
  }, [leaveSeat, unpublishLocalTracks])

   const handleToggleChat = useCallback(() => setIsChatOpen((prev) => !prev), [])

   const pendingLikesRef = useRef(0);
   const flushInProgressRef = useRef(false);

   const flushLikes = useCallback(async () => {
     if (flushInProgressRef.current) return;
     const batch = pendingLikesRef.current;
     if (batch <= 0 || !streamId) return;

     pendingLikesRef.current = 0;
     flushInProgressRef.current = true;

     try {
       const { data, error } = await supabase.rpc('increment_stream_likes', {
         p_stream_id: streamId,
         p_like_count: batch,
       });

        if (error) throw error;

        if (typeof data === 'number') {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: data };
          });
          try {
            void sendStreamBroadcast(streamId, 'like_sent', {
              user_id: user?.id,
              stream_id: streamId,
              total_likes: data,
            });
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[ViewerPage] like broadcast failed:', err);
          }
        }
      } catch (error) {
       pendingLikesRef.current += batch;
       console.error('Failed to flush likes:', error);
     } finally {
       flushInProgressRef.current = false;
     }
   }, [streamId]);

   useEffect(() => {
     const interval = window.setInterval(() => {
       flushLikes();
     }, 2500);

     const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
         void flushLikes();
       }
     };

     document.addEventListener('visibilitychange', handleVisibilityChange);

     return () => {
       window.clearInterval(interval);
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       void flushLikes();
     };
   }, [flushLikes]);

  const handleLike = useCallback(async () => {
    if (!streamId || !user?.id) {
      toast.success('Login to like this broadcast')
      return
    }

    const now = Date.now()

    if (blockedUntilRef.current && now < blockedUntilRef.current) {
      const secondsLeft = Math.ceil((blockedUntilRef.current - now) / 1000)
      toast.error(`You're temporarily blocked from liking (${secondsLeft}s)`)
      return
    }

    const times = clickTimesRef.current
    times.push(now)
    const cutoff = now - 1000
    while (times.length && times[0] < cutoff) times.shift()

    const tapsPerSec = times.length
    if (tapsPerSec >= 20) {
      blockedUntilRef.current = now + 60 * 1000
      clickTimesRef.current = []
      toast.error('Rate limited for 1 minute due to suspected auto-clicking')
      return
    }

    setStream((prev: any) =>
      prev
        ? {
            ...prev,
            total_likes: Number(prev.total_likes || 0) + 1,
          }
        : prev,
    )

    pendingLikesRef.current += 1;
    if (pendingLikesRef.current >= 25) {
      flushLikes();
    }
  }, [streamId, user?.id, stream])

  const handleNextBroadcast = useCallback(() => {
    if (!liveStreamsData || !Array.isArray(liveStreamsData)) return
    const currentIndex = liveStreamsData.findIndex((s: any) => s.id === streamId)
    if (currentIndex === -1) return
    const nextIndex = currentIndex + 1
    if (nextIndex >= liveStreamsData.length) return
    const nextStream = liveStreamsData[nextIndex]
    if (!nextStream?.id) return
    navigate(`/broadcast/${nextStream.id}`)
  }, [liveStreamsData, navigate, streamId])

  const handleLeave = useCallback(async () => {
    try {
      if (mySeat) {
        await unpublishLocalTracks()
        await leaveSeat()
      }
      await leaveAudience()
    } catch (err) {
      console.warn('[ViewerPage] leave cleanup failed:', err)
    }

    await leaveLiveKitRoom().catch(() => {})
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
    currentRoomKeyRef.current = null
    navigate('/')
  }, [leaveAudience, leaveLiveKitRoom, leaveSeat, mySeat, navigate, unpublishLocalTracks])

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/broadcast/${streamId}`
    const shareTitle = (stream as any)?.title || 'Watch me live on Mai Troll'

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: 'Join this Mai Troll broadcast',
          url: shareUrl,
        })
        return
      }

      await navigator.clipboard.writeText(shareUrl)
      toast.success('Broadcast link copied')
    } catch (err) {
      console.warn('[ViewerPage] share failed:', err)
    }
  }, [streamId, stream])

  const isStreamLive = isActive
  const passiveBunnyPlaybackUrl = useMemo(() => {
    const value = (stream as any)?.bunny_playback_url || (stream as any)?.playback_url || (stream as any)?.hls_url || (stream as any)?.stream_url
    if (typeof value !== 'string') return ''
    const trimmed = value.trim()
    return trimmed || ''
  }, [stream])

  useEffect(() => {
    if (!streamId || !user?.id || !isStreamLive || hostId === user.id) {
      if (watchTimeIntervalRef.current) {
        window.clearInterval(watchTimeIntervalRef.current)
        watchTimeIntervalRef.current = null
      }
      return
    }

    const recordWatchActivity = async () => {
      try {
        await recordWatchTime(60, streamId)
      } catch (recordErr) {
        console.warn('[ViewerPage] Failed to record watch time:', recordErr)
      }
    }

    watchTimeIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void recordWatchActivity()
    }, 60 * 1000)

    return () => {
      if (watchTimeIntervalRef.current) {
        window.clearInterval(watchTimeIntervalRef.current)
        watchTimeIntervalRef.current = null
      }
    }
  }, [streamId, user?.id, isStreamLive, hostId, recordWatchTime])

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setStreamLoaded(true)
      return
    }

    let cancelled = false

    const run = async () => {
      setStreamLoaded(false)
      setError(null)

      const { data, error: streamError } = await supabase
        .from('streams')
        .select(
          [
            'id',
            'status',
            'is_live',
            'started_at',
            'ended_at',
            'title',
            'category',
            'user_id',
            'are_seats_locked',
            'is_battle',
            'total_likes',
            'total_gifts_coins',
            'box_count',
            'seat_count',
            'seat_price',
            'seat_prices',
            'current_viewers',
            'livekit_room_name',
            'bunny_playback_url',
            'delivery_provider',
            'delivery_status',
            'battle_id',
            'battle_mode',
            'battle_format',
            'battle_status',
            'battle_start_time',
            'battle_end_time',
             'side_a_score',
             'side_b_score',
           ].join(','),
        )
        .eq('id', streamId)
        .maybeSingle()

      if (cancelled) return

      if (streamError || !data) {
        setError('Stream not found.')
        setStreamLoaded(true)
        return
      }

      if (isStreamEnded(data as unknown as Stream)) {
        streamEndedRef.current = true
        navigate(`/broadcast/summary/${(data as any).id}`, { replace: true })
        return
      }

      setStream(data as unknown as Stream)
      setViewerCount(Number((data as any).current_viewers || 0))
      void refreshStageConfig()

      if ((data as any).user_id) {
        const { data: hostProfile, error: hostProfileError } = await supabase
          .from('user_profiles')
           .select('id, username, email, avatar_url, troll_coins, paid_coin_balance, free_coin_balance, total_earned_coins, is_verified')
          .eq('id', (data as any).user_id)
          .maybeSingle()

        if (hostProfileError) {
          console.warn('[ViewerPage] host profile fetch failed:', hostProfileError)
        }

        if (!cancelled && hostProfile) {
          setBroadcasterProfile(hostProfile)
        }
      }

      if (!cancelled) setStreamLoaded(true)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [streamId, navigate])

  // Canonical gift-animation source: stream_gifts postgres_changes received
  // via useStreamRealtime. event.new.id is the stream_gifts row UUID — the
  // same value that useGiftSystem uses as broadcast payload.id — so both
  // postgres and broadcast paths resolve to the same animationId and the
  // seenGiftAnimationIdsRef Set catches the second arrival without double-
  // playing the <video>.
useStreamRealtime(
      streamId || '',
      {
        onMessage: (event) => {
          const newRow = event?.new
          if (!newRow) return
          const msgId = String(newRow.id || newRow.txn_id || '')
          if (!msgId) return
          if (processedMessageIdsRef.current.has(msgId)) return
          processedMessageIdsRef.current.add(msgId)

          const username = newRow.user_name || newRow.username || 'Viewer'
          const content = newRow.content || ''
          if (!content) return

          const chatKey = `${username}:${content}`
          const now = Date.now()
          const existingTs = recentChatKeysRef.current.get(chatKey)
          if (existingTs !== undefined && now - existingTs < CHAT_DEBOUNCE_MS) return
          recentChatKeysRef.current.set(chatKey, now)

          setFloatingMessages(prev =>
            [{ id: msgId, username, content, createdAt: Date.now() }, ...prev].slice(-50)
          )

          setTimeout(() => {
            setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
          }, CHAT_FLOAT_MS)
        },
        onPresenceBroadcast: (event) => {
          if (event.table !== 'broadcast:like_sent') return
          const likeData = event.new || event.raw?.payload || {}
          if (likeData.user_id === user?.id) return
          const newTotal = typeof likeData.total_likes === 'number' ? likeData.total_likes : null
          if (newTotal === null) return
          setStream((prev) => {
            if (!prev) return prev
            return { ...prev, total_likes: newTotal } as Stream
          })
        },
        onGift: (event) => {
          const rawGift = event?.new ?? event
          if (rawGift) {
            void processGiftEvent(rawGift)
          }
        },
        onParticipant: (event: any) => {
          if (event.eventType !== 'UPDATE' || !event.new || !user?.id) return
          const participant = event.new
          if (participant.user_id !== user.id || participant.removed !== true || participant.stream_id !== streamId) return

          kickProcessedRef.current = true

          const kickData = {
            timestamp: Date.now(),
            streamId,
            reason: participant.removed_reason || 'Kicked by broadcaster',
          }

          localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify(kickData))
          leaveLiveKitRoom().catch(() => {})
          hasJoinedAudienceRef.current = false
          joiningAudienceRef.current = false
          currentRoomKeyRef.current = null
          navigate(`/?kicked=${encodeURIComponent(kickData.reason)}`, { replace: true })
        },
        onStream: (event: any) => {
          const next = event?.new || event
          if (!next) return

          if (isStreamEnded(next as Stream)) {
            if (streamEndedRef.current) return
            streamEndedRef.current = true
            leaveLiveKitRoom().catch(() => {})
            hasJoinedAudienceRef.current = false
            joiningAudienceRef.current = false
            currentRoomKeyRef.current = null
            navigate(`/broadcast/summary/${next.id}`, { replace: true })
            return
          }

          setStream((prev) => {
            if (!prev) return next as Stream
            return {
              ...(prev as any),
              ...(next as any),
              seat_count: typeof next.seat_count !== 'undefined' ? next.seat_count : (prev as any).seat_count,
              box_count: typeof next.box_count !== 'undefined' ? next.box_count : (prev as any).box_count,
              are_seats_locked: typeof next.are_seats_locked !== 'undefined' ? next.are_seats_locked : (prev as any).are_seats_locked,
              seat_price: typeof next.seat_price !== 'undefined' ? next.seat_price : (prev as any).seat_price,
              seat_prices: typeof next.seat_prices !== 'undefined' ? next.seat_prices : (prev as any).seat_prices,
              total_likes: typeof next.total_likes !== 'undefined' ? next.total_likes : (prev as any).total_likes,
            } as Stream
          })

          const hasStageConfigUpdate =
            typeof next.seat_count !== 'undefined' ||
            typeof next.box_count !== 'undefined' ||
            typeof next.seat_prices !== 'undefined' ||
            typeof next.are_seats_locked !== 'undefined'

          if (hasStageConfigUpdate) {
            void refreshStageConfig()
          }

          if (typeof next.current_viewers !== 'undefined') {
            setViewerCount(Number(next.current_viewers || 0))
          }
        },
      } as any,
      stream?.battle_id ?? null,
    )

  // Kick guard: check on page load if user was kicked from this broadcast
  useEffect(() => {
    if (!streamId || !user?.id) return

    const checkKickGuard = async () => {
      try {
        // Check localStorage for recent kick
        const kickData = parseKickData(localStorage.getItem(getKickStorageKey(streamId, user.id)))
        if (isKickBanActive(kickData)) {
          const remainingMs = KICK_BAN_DURATION_MS - (Date.now() - kickData.timestamp)
          const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
          toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
          navigate('/', { replace: true })
          return
        }

        // Also check stream_kicks table for permanent kick
        const { data: kickRecord } = await supabase
          .from('stream_kicks')
          .select('id, created_at')
          .eq('stream_id', streamId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (kickRecord) {
          const kickTimestamp = new Date(kickRecord.created_at).getTime()
          const timeSinceKick = Date.now() - kickTimestamp
          if (timeSinceKick < KICK_BAN_DURATION_MS) {
            const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
            const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
            toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
            localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId,
              reason: 'Kicked by moderator'
            }))
            navigate('/', { replace: true })
          }
        }
      } catch (err) {
        console.warn('[ViewerPage] Kick guard check failed:', err)
      }
    }

    void checkKickGuard()

    const kickChannel = supabase
      .channel(`kick-guard:${streamId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_kicks',
          filter: `stream_id=eq.${streamId},user_id=eq.${user.id}`,
        },
        (payload) => {
          const kick = payload.new
          const kickTimestamp = new Date(kick.created_at).getTime()
          const timeSinceKick = Date.now() - kickTimestamp
          if (timeSinceKick < KICK_BAN_DURATION_MS) {
            const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
            const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
            toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
            localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId,
              reason: kick.reason || 'Kicked by moderator'
            }))
            leaveLiveKitRoom().catch(() => {})
            hasJoinedAudienceRef.current = false
            joiningAudienceRef.current = false
            currentRoomKeyRef.current = null
            navigate('/', { replace: true })
          }
        }
      )
      .subscribe()

    return () => {
      if (kickChannel) {
        supabase.removeChannel(kickChannel)
      }
    }
  }, [streamId, user?.id, navigate])

  // Pin/unpin messages (staff/broadcaster/broadofficer/admin/CEO only)
  const canPinMessages = Boolean(
    profile && (
      String(profile.role).toLowerCase() === 'admin' ||
      String(profile.role).toLowerCase() === 'superadmin' ||
      String(profile.role).toLowerCase() === 'owner' ||
      String(profile.role).toLowerCase() === 'ceo' ||
      String(profile.role).toLowerCase() === 'staff' ||
      profile.is_admin ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      String(profile.troll_role).toLowerCase() === 'lead_troll_officer' ||
      String(profile.troll_role).toLowerCase() === 'troll_officer'
    )
  )

  const handlePinMessage = useCallback((messageId: string) => {
    setPinnedMessageIds(prev => new Set(prev).add(messageId))
    toast.success('Message pinned')
  }, [])

  const handleUnpinMessage = useCallback((messageId: string) => {
    setPinnedMessageIds(prev => {
      const next = new Set(prev)
      next.delete(messageId)
      return next
    })
    toast.success('Message unpinned')
  }, [])

  const floatingChatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Floating Chat: receive broadcasts ────────────────────────────────────
  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`floating-chat:${streamId}`)
    floatingChatChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content, isSystem } = payload.payload || {}
        if (!username || !content) return
        // Filter out messages from blocked users
        if (blockedUsernames.has(username.toLowerCase())) return
        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setFloatingMessages(prev => [{ id: msgId, username, content, createdAt: Date.now(), isSystem }, ...prev].slice(-50))

        setTimeout(() => {
          setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
        }, CHAT_FLOAT_MS)
      })
      .subscribe()

    return () => {
      floatingChatChannelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamId])

    useEffect(() => {
      return () => {
        void leaveAudienceRef.current?.()
        leaveLiveKitRoomRef.current?.().catch(() => {})
        void leaveSeatRef.current?.()
        if (moderatorMuteTimerRef.current) clearTimeout(moderatorMuteTimerRef.current)
      }
    }, [])

    // Mute detection: subscribe to stream_mutes for current user.
    // The subscription must stay stable — re-subscribing would re-run the
    // initial query and flood the network, and would also remount tracks.
    // Live values (mic state, publishing) are read from refs instead of deps.

    // Actually mute/unmute the local mic track WITHOUT tearing down/remounting
    // the published track. This is what stops the user's mic from still working
    // after a moderator mute.
    const applyModeratorMute = useCallback(async () => {
      moderatorMuteTimestampRef.current = Date.now()
      isModeratorMutedRef.current = true
      if (moderatorMuteTimerRef.current) clearTimeout(moderatorMuteTimerRef.current)
      moderatorMuteTimerRef.current = setTimeout(() => {
        isModeratorMutedRef.current = false
        moderatorMuteTimestampRef.current = 0
        moderatorMuteTimerRef.current = null
        toast.info('You can now unmute your microphone')
      }, 5000)
      try { await localAudioTrackRef.current?.mute() } catch {}
      setSeatMicOn(false)
    }, [])

    const clearModeratorMute = useCallback(async () => {
      if (moderatorMuteTimerRef.current) clearTimeout(moderatorMuteTimerRef.current)
      moderatorMuteTimerRef.current = null
      moderatorMuteTimestampRef.current = 0
      isModeratorMutedRef.current = false
      try { await localAudioTrackRef.current?.unmute() } catch {}
      setSeatMicOn(true)
    }, [])

    // Always-current snapshot of on-stage / publishing state for the handlers
    const liveMuteStateRef = useRef({ isUserOnStage, isPublishing })
    liveMuteStateRef.current = { isUserOnStage, isPublishing }

    useEffect(() => {
      if (!streamId || !user?.id) return

      const checkMuteState = async () => {
        try {
          const { data } = await supabase
            .from('stream_mutes')
            .select('id, expires_at')
            .eq('stream_id', streamId)
            .eq('user_id', user.id)
            .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
            .maybeSingle()

          if (data) {
            toast.error('You have been muted by a moderator.')
            if (liveMuteStateRef.current.isUserOnStage && liveMuteStateRef.current.isPublishing) {
              await applyModeratorMute()
            }
          }
        } catch {}
      }

      void checkMuteState()

      const muteChannel = supabase
        .channel(`viewer-mute:${streamId}:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_mutes',
            filter: `stream_id=eq.${streamId}`,
          },
          (payload) => {
            const newMute = payload.new as any
            if (newMute?.user_id === user.id) {
              toast.error('You have been muted by a moderator.')
              if (liveMuteStateRef.current.isUserOnStage && liveMuteStateRef.current.isPublishing) {
                void applyModeratorMute()
              }
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'stream_mutes',
            filter: `stream_id=eq.${streamId}`,
          },
          (payload) => {
            const oldMute = payload.old as any
            if (oldMute?.user_id === user.id) {
              toast.success('You have been unmuted.')
              void clearModeratorMute()
            }
          },
        )
        .subscribe()

       return () => {
         if (muteChannel) {
           supabase.removeChannel(muteChannel)
         }
       }
    }, [streamId, user?.id, applyModeratorMute, clearModeratorMute])

    useEffect(() => {
      if (!streamId || !user?.id) return

      const previousStreamId = audienceStreamIdRef.current
      if (previousStreamId && previousStreamId !== streamId) {
        void leaveAudienceRef.current?.()
        hasJoinedStreamAudienceRef.current = false
        void leaveLiveKitRoomRef.current?.().catch(() => {})
        hasJoinedAudienceRef.current = false
        joiningAudienceRef.current = false
        currentRoomKeyRef.current = null
      }
      audienceStreamIdRef.current = streamId

     // Don't join audience presence if user has ghost mode enabled
     if (!profile?.is_ghost_mode && !hasJoinedStreamAudienceRef.current) {
       void joinAudienceRef.current?.()
       hasJoinedStreamAudienceRef.current = true
     }

 const heartbeat = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        void heartbeatAudienceRef.current?.()
      }, 90_000) // 90 second heartbeat to reduce Supabase load for likes

     return () => {
       window.clearInterval(heartbeat)
       void leaveAudienceRef.current?.()
       hasJoinedStreamAudienceRef.current = false
     }
   }, [streamId, user?.id, profile?.is_ghost_mode])

  useEffect(() => {

     if (user?.id) {
       const kickKey = getKickStorageKey(streamId, user.id)
       const kickRaw = localStorage.getItem(kickKey)
       const kickData = parseKickData(kickRaw)

       if (isKickBanActive(kickData)) {
         const timeSinceKick = Date.now() - kickData.timestamp
          const remainingMs = Math.max(KICK_BAN_DURATION_MS - timeSinceKick, 0)
          const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))

          leaveLiveKitRoom().catch(() => {})
          hasJoinedAudienceRef.current = false
          joiningAudienceRef.current = false
          currentRoomKeyRef.current = null
          toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
        }

        if (kickRaw && !isKickBanActive(kickData)) {
          localStorage.removeItem(kickKey)
        }
      }

      const audienceRoomKey = `${streamId}:${roomId}`

      if (isUserOnStage && !isPublishing) {
        if (joiningPublisherRef.current || joiningAudienceRef.current) return

        joiningPublisherRef.current = true
        currentRoomKeyRef.current = audienceRoomKey

        publishLocalTracks()
          .then(async () => {
            setViewerError(null)
            if (mySeat?.seat_index != null) {
              await markSeatLive(mySeat.seat_index, viewerIdentityRef.current || viewerIdentity)
            }
          })
          .catch(async (err: any) => {
            const errorDetail = err?.message || err?.statusText || String(err) || 'Failed to publish seat tracks'
            const isPermissionError = /permission|insufficient|forbidden|not authorized|not permitted|403/i.test(errorDetail)

            if (isPermissionError && mySeat?.id && isUserOnStage) {
              const now = Date.now()
              if (now - lastPermissionErrorRef.current < PERMISSION_ERROR_COOLDOWN_MS) {
                setViewerError(errorDetail)
                if (mySeat?.id) {
                  await leaveSeat()
                }
                return
              }
              lastPermissionErrorRef.current = now

              try {
                setViewerError('Reconnecting with stage permissions...')
                await leaveLiveKitRoom()

                const identityToUse = viewerIdentityRef.current || viewerIdentity
                await joinAsAudience({
                  userId: identityToUse,
                  streamId: streamId,
                  roomName: roomId,
                  viewerIdentity: identityToUse,
                  publishCapable: true,
                })

                await new Promise(r => setTimeout(r, 800))

                await publishLocalTracks()
                setViewerError(null)

                if (mySeat?.seat_index != null) {
                  await markSeatLive(mySeat.seat_index, viewerIdentityRef.current || viewerIdentity)
                }
                return
              } catch (retryErr) {
                console.error('[ViewerPage] Retry publish after permission error failed:', retryErr)
              }
            }

            setViewerError(errorDetail)
            if (mySeat?.id) {
              await leaveSeat()
            }
          })
          .finally(() => {
            joiningPublisherRef.current = false
          })
        return
      }

      if (!isUserOnStage && isPublishing) {
        joiningPublisherRef.current = true
        unpublishLocalTracks()
          .catch(() => {})
          .finally(() => {
            joiningPublisherRef.current = false
          })
        leaveLiveKitRoom().catch(() => {})
        hasJoinedAudienceRef.current = false
        joiningAudienceRef.current = false
        currentRoomKeyRef.current = null
        return
      }

     if (isPublishing && !isUserOnStage) {
       return
     }

    // Audience join flow moved to a focused effect below (primitive deps only)
   }, [streamId, roomId, isActive, isUserOnStage, isPublishing, joinAsAudience, publishLocalTracks, unpublishLocalTracks, leaveLiveKitRoom, user?.id, navigate, viewerIdentity])

  // Reset audience join refs when changing streams so we can re-attempt on new stream
  useEffect(() => {
    audienceJoinAttemptedKeyRef.current = null
    audienceFailedUntilRef.current = 0
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
  }, [streamId])

  // Focused effect for audience join — keep dependencies primitive to avoid
  // re-running due to object identity changes.
  useEffect(() => {
    if (!streamId) return
    const isActiveLocal = isStreamActive(stream)
    if (!isActiveLocal) return

    const identityToUse = viewerIdentityRef.current || viewerIdentity
    if (!identityToUse) return

    if (passiveBunnyPlaybackUrl && !isUserOnStage) {
      hasJoinedAudienceRef.current = true
      joiningAudienceRef.current = false
      currentRoomKeyRef.current = null
      return
    }

    if (!streamId) {
      console.warn('[ViewerPage] Missing streamId from route before joinAsAudience', {
        pathname: typeof window !== 'undefined' ? window.location.pathname : null,
        params,
      })
      return
    }

    // Determine attempt key and cooldown
    const now = Date.now()
    const attemptKey = `${streamId}:${identityToUse}`
    if (audienceJoinAttemptedKeyRef.current === attemptKey) return
    if (audienceFailedUntilRef.current > now) {
      if (import.meta.env.DEV) console.warn('[ViewerPage] Skipping audience join due to recent failure cooldown', { retryAfterMs: audienceFailedUntilRef.current - now })
      return
    }

    // Don't start if we already joined or are joining, or already have a room key
    if (hasJoinedAudienceRef.current || joiningAudienceRef.current || currentRoomKeyRef.current) return

    joiningAudienceRef.current = true
    audienceJoinAttemptedKeyRef.current = attemptKey

    if (import.meta.env.DEV) console.log('[ViewerPage] triggering audience join (focused effect):', { streamId, roomId, identity: identityToUse })

    let cancelled = false

    // Track viewer presence in stream_viewers for audience counting.
    Promise.resolve()
      .then(() => admitViewerToStream(
        streamId,
        user?.id ?? null,
        stableAnonId || null,
      ))
      .then(() => {
        if (cancelled) return

        // Join LiveKit as audience.
        return joinAsAudience({ userId: identityToUse, streamId, roomName: roomId, viewerIdentity: identityToUse, publishCapable: false })
          .then((res: any) => {
            if (cancelled) {
              void releaseViewerSlot(streamId, user?.id ?? null, stableAnonId || null)
              return
            }
             if (res && typeof res !== 'string') {
                hasJoinedAudienceRef.current = true
                setViewerError(null)
                console.log('[ViewerPage] LiveKit audience joined:', { streamId, roomId })
             } else {
                const errorDetail = typeof res === 'string'
                  ? res
                  : 'LiveKit audience join failed'
                console.warn(`[ViewerPage] joinAsAudience failed for stream ${streamId}: ${errorDetail}`)
                setViewerError(errorDetail)
                void releaseViewerSlot(streamId, user?.id ?? null, stableAnonId || null)
                audienceFailedUntilRef.current = Date.now() + 60000
             }
          })
          .catch((err: any) => {
            const errorDetail = err?.message || err?.statusText || String(err) || 'LiveKit connection failed'
            console.warn(`[ViewerPage] joinAsAudience threw for stream ${streamId}: ${errorDetail}`)
            setViewerError(errorDetail)
            void releaseViewerSlot(streamId, user?.id ?? null, stableAnonId || null)
            audienceFailedUntilRef.current = Date.now() + 60000
          })
      })
      .catch((err: any) => {
        console.warn(`[ViewerPage] admitViewerToStream failed for stream ${streamId}: ${err?.message || err?.statusText || String(err) || 'Unable to join broadcast'}`)
        setViewerError(err?.message || err?.statusText || String(err) || 'Unable to join broadcast')
        audienceFailedUntilRef.current = Date.now() + 30000
      })
      .finally(() => {
        joiningAudienceRef.current = false
      })

    return () => { cancelled = true }
  }, [streamId, stream?.id, stream?.status, stream?.is_live, roomId, user?.id, joinAsAudience, stableAnonId, retryAdmissionKey, passiveBunnyPlaybackUrl, isUserOnStage])

  // Transition watcher: when the user goes from off-stage to on-stage, the
  // focused join effect above has already joined LiveKit as plain audience
  // (publishCapable: false). Re-join with publishCapable: true so the
  // publisher effect below can publish immediately without hitting a
  // permission error and without ever tearing the room down.
  const wasOnStageRef = useRef(isUserOnStage)
  useEffect(() => {
    if (wasOnStageRef.current) { wasOnStageRef.current = isUserOnStage; return }
    wasOnStageRef.current = isUserOnStage
    if (!isUserOnStage) return

    joiningAudienceRef.current = false
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
    audienceJoinAttemptedKeyRef.current = null
    currentRoomKeyRef.current = null

    void joinAsAudience({
      userId: viewerIdentityRef.current || viewerIdentity,
      streamId,
      roomName: roomId,
      viewerIdentity: viewerIdentityRef.current || viewerIdentity,
      publishCapable: true,
    }).catch(() => {})
  }, [isUserOnStage, roomId, streamId, viewerIdentity, joinAsAudience])

  const stageSlots = useMemo(() => {
    const liveSeats = activeSeats.slice(0, Math.max(0, effectiveBoxCount - 1))
    const emptyCount = Math.max(1, effectiveBoxCount - 1 - liveSeats.length)
    return { liveSeats, emptyCount }
  }, [activeSeats, effectiveBoxCount])

  const seatCards = useMemo(() => {
    if (effectiveBoxCount <= 1) return []

    return Array.from({ length: effectiveBoxCount - 1 }, (_, offset) => {
      const seatIndex = offset + 1
      const seat = seats?.[seatIndex]
      const seatStatus = normalizeSeatStatus(seat?.status)
      const isMine = Boolean(user?.id && (seat?.user_id === user.id || seat?.guest_id === user.id))
      const isOccupied = Boolean(
        seat &&
          (seat?.user_id || seat?.guest_id) &&
          isSeatActiveStatus(seatStatus),
      )
      const isLocked = Boolean((stream as any)?.are_seats_locked)
      const seatPrice = getSeatPriceForIndex(stream as Stream | null, seatIndex)
      const displayName = getDisplayName(seat?.user_profile || null, 'Viewer')
      // A user already seated in any seat cannot join another seat until they leave it.
      const amAlreadySeated = Boolean(
        mySeat &&
          isSeatActiveStatus(normalizeSeatStatus(mySeat.status)) &&
          (mySeat.user_id === user?.id || mySeat.guest_id === user?.id),
      )
      const canJoin = !isLocked && !isOccupied && !isMine && !amAlreadySeated

      return {
        seatIndex,
        seat,
        isMine,
        isOccupied,
        isLocked,
        canJoin,
        seatPrice,
        displayName,
      }
    })
  }, [effectiveBoxCount, seats, stream, user?.id, mySeat])

    // Mobile seat grid: square cards, scrollable below broadcaster.
    // Height is driven by the number of rows (3 columns) so the square cards fit.
     const mobileSeatGridHeight = useMemo(() => {
       if (!isMobileViewer || seatCards.length === 0) return 0
       const count = seatCards.length
       const rows = Math.ceil(count / 3)
       // ~ One square card is roughly (screen width - padding - gaps) / 3 ~ 110px on phones.
       const card = Math.min(120, Math.max(88, Math.round((window.innerWidth - 32 - 16) / 3)))
       const gap = 8
       return Math.min(420, rows * card + (rows - 1) * gap + 8)
     }, [isMobileViewer, seatCards.length])
 
    // Mobile seat grids use a tighter 3-column layout so all seats remain visible.
     const mobileSeatGridCols = useMemo(() => {
       if (!isMobileViewer || seatCards.length === 0) return 'grid-cols-3'
       return 'grid-cols-3'
     }, [isMobileViewer, seatCards.length])

  // Broadcaster video: fixed height that does NOT shrink when seats are added.
  // Seats scroll below in the remaining space.
  const mobileHostVideoHeight = useMemo(() => {
    if (!isMobileViewer) return undefined
    // Fixed broadcaster area: reserve control bar + chat input + safe area only
    const reserved = MOBILE_CONTROL_BAR_HEIGHT + MOBILE_CHAT_INPUT_HEIGHT
    return `calc(100dvh - ${reserved}px - env(safe-area-inset-bottom))`
  }, [isMobileViewer])

  // ── Channel diagnostics (dev only, admin only) ──
  const isStreamAdmin = !!(profile && (
    String(profile.role).toLowerCase() === 'admin' || profile.is_admin ||
    profile.is_superadmin || String(profile.role).toLowerCase() === 'owner'
  ));
  useEffect(() => {
    if (!isStreamAdmin) return;
    logActiveChannels(`ViewerPage:mount:${streamId}`);
    return () => logActiveChannels(`ViewerPage:unmount:${streamId}`);
  }, [streamId]);

  useEffect(() => {
    if (!isStreamAdmin) return;
    if (stream?.is_battle && stream?.battle_id) {
      logActiveChannels(`ViewerPage:battle-active:${stream.battle_id}`);
    } else {
      logActiveChannels(`ViewerPage:no-battle:${streamId}`);
    }
  }, [stream?.is_battle, stream?.battle_id, streamId]);

  // ── Seat Debug Overlay (dev only) ──
  const [seatDebugOpen, setSeatDebugOpen] = useState(false)
  const prevEffectiveBoxCountRef = useRef(effectiveBoxCount)
  const prevSeatCountRef = useRef(Object.keys(seats).length)

  useEffect(() => {
    if (!import.meta.env.DEV || !seatDebugOpen) return
    const changed: string[] = []
    if (prevEffectiveBoxCountRef.current !== effectiveBoxCount) {
      changed.push(`effectiveBoxCount: ${prevEffectiveBoxCountRef.current} -> ${effectiveBoxCount}`)
      prevEffectiveBoxCountRef.current = effectiveBoxCount
    }
    const seatCount = Object.keys(seats).length
    if (prevSeatCountRef.current !== seatCount) {
      changed.push(`seats: ${prevSeatCountRef.current} -> ${seatCount}`)
      prevSeatCountRef.current = seatCount
    }
    if (changed.length > 0) {
      console.log('[ViewerPage][SeatDebug]', changed.join(', '))
    }
  }, [effectiveBoxCount, seats, seatDebugOpen])

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-dvh text-white', theme.pageBg)}>
        <div className="rounded-3xl border border-red-400/30 bg-red-950/30 px-8 py-6 text-center shadow-[0_0_35px_rgba(239,68,68,0.2)] backdrop-blur-2xl">
          <p className="text-red-300 font-bold">{error}</p>
        </div>
      </div>
    )
  }

  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'ready' || stream?.battle_status === 'starting' || stream?.battle_status === 'active');

  // PHASE 2: Derive stable battleId for BattleView key — prevents remount on stream state updates
  const activeBattleId = shouldShowRandomBattleArena ? stream?.battle_id ?? null : null;

  if (shouldShowRandomBattleArena) {
    return (
      <ErrorBoundary>
        <GiftSystemProvider streamId={streamId} defaultReceiverId={hostId}>
          <div className="relative flex h-dvh w-full flex-col overflow-hidden">
            <BattleView
              key={activeBattleId}
              battleId={stream.battle_id!}
              currentStreamId={streamId}
              viewerId={user?.id || stableAnonId}
              remoteUsers={remoteUsers}
              userIdToLiveKitIdentity={userIdToLiveKitIdentity}
              onReturnToStream={() => {
                refreshStream();
              }}
              onToggleCamera={handleToggleCamera}
              onToggleMic={handleToggleMic}
             />
          </div>
        </GiftSystemProvider>
      </ErrorBoundary>
    );
  }

  function onLiveKitMicMute(): void {
    if (localAudioTrack) {
      localAudioTrack.mute().catch(() => {});
    }
  }

  function onLiveKitMicUnmute(): void {
    if (localAudioTrack) {
      localAudioTrack.unmute().catch(() => {});
    }
  }

  // Broadofficer appointment popup (realtime)
  const broadofficerPopupVisible = broadofficerPopup?.visible && !!streamId

  // Subscription popup visible state
  const subscriptionPopupVisible = subscriptionPopup?.visible && !!streamId

  return (
    <GiftSystemProvider streamId={streamId} defaultReceiverId={hostId}>
      <ErrorBoundary>
        {/* Broadofficer appointment notification popup */}
        {broadofficerPopupVisible && (
          <div
            className="fixed inset-x-0 top-4 z-[200] flex justify-center pointer-events-none"
            style={{ top: `max(1rem, env(safe-area-inset-top))` }}
            onClick={dismissBroadofficerPopup}
          >
            <div
              className="pointer-events-auto max-w-md w-[calc(100%-2rem)] rounded-2xl border border-blue-400/30 bg-slate-950/95 px-5 py-4 shadow-[0_0_40px_rgba(59,130,246,0.25)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15">
                  <Shield className="h-5 w-5 text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">Broadofficer Assigned</p>
                  <p className="mt-1 text-xs text-blue-200/80">{broadofficerPopup.message}</p>
                  <p className="mt-1 text-[10px] text-blue-300/60">Your account permissions have been updated.</p>
                </div>
                <button
                  onClick={dismissBroadofficerPopup}
                  className="shrink-0 rounded-lg p-2 text-blue-300/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription notification popup */}
        {subscriptionPopupVisible && (
          <div
            className="fixed inset-x-0 top-4 z-[200] flex justify-center pointer-events-none"
            style={{ top: `max(1rem, env(safe-area-inset-top))` }}
            onClick={dismissSubscriptionPopup}
          >
            <div
              className="pointer-events-auto max-w-md w-[calc(100%-2rem)] rounded-2xl border border-yellow-400/30 bg-slate-950/95 px-5 py-4 shadow-[0_0_40px_rgba(234,179,8,0.25)] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-500/15">
                  <Crown className="h-5 w-5 text-yellow-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">Subscription Active</p>
                  <p className="mt-1 text-xs text-yellow-200/80">You're now subscribed to {subscriptionPopup.broadcaster}!</p>
                </div>
                <button
                  onClick={dismissSubscriptionPopup}
                  className="shrink-0 rounded-lg p-2 text-yellow-300/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={cn('relative flex h-dvh w-full flex-col overflow-hidden', theme.pageShell)}>

          {/* Background layers — identical to Sidebar ShellBackdrop */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-25" />

          {/* RGB broadcast effect — only when enabled, rendered ABOVE the seat overlay (seats are z-20) */}
          {stream?.has_rgb_effect && (
            <div className="pointer-events-none absolute inset-0 z-30 mix-blend-screen">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.35),transparent_42%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.28),transparent_46%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.24),transparent_44%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.18)_0%,rgba(14,165,233,0.12)_44%,rgba(236,72,153,0.16)_100%)]" />
            </div>
          )}

            <GiftVideoOverlay gifts={recentGifts} onFinish={handleRemoveGiftOverlay} />

              {/* Feed the Troll — persistent companion for the broadcaster's troll */}
              {stream?.user_id && (
                <FeedTheTroll
                  broadcasterId={stream.user_id}
                  streamId={streamId}
                  compact={isMobileViewer}
                  positionKey="viewer"
                />
              )}

            {isMobileViewer && (
              <div className="absolute left-3 top-3 z-40 flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              </div>
            )}

            {/* MOBILE: Audience ticker with viewer count + mini profile pics + coins sent */}
            {isMobileViewer && stream && (
              <div className="absolute inset-x-0 top-0 z-30 flex items-center px-3 pt-[52px] pointer-events-none">
                <div className="pointer-events-auto w-full rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 px-2 py-1.5 backdrop-blur-xl shadow-[0_2px_24px_0_rgba(34,211,238,0.10)]">
                   <MobileAudienceTicker
                     audience={audienceWithAnon}
                     currentUserId={currentViewerId}
                     hostUserId={hostId || undefined}
                     viewerCount={viewerCount}
                     likes={stream?.total_likes ?? 0}
                     maxVisible={7}
                     onModerateUser={handleOpenUserAction}
                   />
                </div>
              </div>
            )}
             {!isMobileViewer && (
                <>
                  <div className="absolute left-4 top-4 z-40">
                    <button
                      onClick={() => navigate('/')}
                      className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                    >
                      <ArrowLeft size={14} />
                      Back
                    </button>
                  </div>
                  <BroadcastNeonHeader
                  stream={stream}
                  broadcasterProfile={broadcasterProfile
                    ? {
                      username: broadcasterProfile.username,
                      avatar_url: broadcasterProfile.avatar_url,
                    }
                    : null}
                  isHost={false}
                  liveViewerCount={viewerCount}
                  handleLike={handleLike}
                   onGift={() => onGift(hostId)}
                   onSubscribe={() => {
                     if (!user) {
                       navigate('/auth?mode=login');
                       return;
                     }
                     setShowSubscribeModal(true);
                   }}
                   onShare={handleShare}
                  onEndStream={handleLeave}
                  coinBalance={(profile as any)?.troll_coins ?? 0}
                  onOpenCoinStore={user?.id ? () => toast.info('Coin Store opens from the viewer action bar.') : undefined}
                  isLive={isActive}
                  streamStartedAt={(stream as any)?.started_at}
                  onActiveViewersClick={onActiveViewersClick} />
{/* Audience Bubble Ticker and Top Subscribers Bar */}
                <div className="w-full z-20 px-0 pt-1 pb-2 flex items-center justify-center bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 backdrop-blur-xl border-b border-cyan-400/10 shadow-[0_2px_32px_0_rgba(34,211,238,0.10)]">
                  <div className="w-full max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-0">
                    <AudienceBubbleTicker
                      streamId={streamId}
                      audience={audienceWithAnon}
                      currentUserId={currentViewerId}
                      hostUserId={hostId || undefined}
                      maxVisible={8}
                      className="relative z-0 hidden sm:flex pointer-events-none"
                      onGiftUser={onGift}
                    />
                    {hostId && (
                      <TopSubscribersBar broadcasterId={hostId} />
                    )}
                  </div>
                </div>

                {myLeagues.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-3xl border border-cyan-500/10 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-[0_0_30px_rgba(45,212,191,0.08)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                          {myLeagues[0].icon_emoji || '🏆'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">League: {myLeagues[0].name}</p>
                          <p className="text-xs text-slate-400">
                            {myLeagues.length === 1 ? 'League membership active' : `${myLeagues.length} leagues joined`} • {myLeagues[0].member_count}/{myLeagues[0].max_members} members
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                        Open League tab for your status, missions, and leaderboard.
                      </div>
                    </div>
                  </div>
                )}
             </>
           )}

           {/* Random Battle Banner — prominent notice for queue/active battle */}
           {stream && (
             <RandomBattleBanner
               phase={randomBattlePhase}
               delayUntil={null}
               isBroadcaster={false}
               mobileSafe={isMobileViewer}
             />
           )}

   <main
                className={cn(
                  'relative z-10 flex flex-1 min-h-0',
                  isMobileViewer
                    ? layoutMode === 'grid'
                      ? 'grid overflow-hidden pr-12'
                      : 'flex-col overflow-hidden px-0 pt-0'
                    : 'grid gap-4 px-5 py-4',
                    !isMobileViewer && layoutMode === 'grid' ? 'grid-rows-[1fr_1fr]' : '',
                )}
                 style={
                  isMobileViewer && layoutMode === 'grid'
                    ? {
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gridAutoRows: '1fr',
                        gap: '4px',
                        maxHeight: `calc(100dvh - ${MOBILE_CHAT_INPUT_HEIGHT + 8}px - env(safe-area-inset-bottom))`,
                      }
                   : !isMobileViewer
                     ? layoutMode === 'grid'
                       ? {
                           gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, Math.min(effectiveBoxCount, 8)))}, minmax(0, 1fr))`,
                           gridAutoRows: 'minmax(0, 1fr)',
                           gap: '12px',
                         }
                        : {
                            gridTemplateColumns:
                              seatCards.length > 0
                                ? 'minmax(430px, 1.05fr) minmax(360px, 1fr) 360px'
                                : 'minmax(560px, 1fr) 360px',
                          }
                     : undefined
               }
             >
               <div className="absolute left-3 top-3 z-40 md:left-4 md:top-4">
                 <button
                   onClick={() => navigate('/')}
                   className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                 >
                   <ArrowLeft size={14} />
                   <span className="hidden sm:inline">Back</span>
                 </button>
               </div>
              {/* Broadcast Frame as border decoration */}
             {broadcastFrame && (
               <BroadcastFrame frame={broadcastFrame} className="absolute inset-0 z-0 rounded-3xl pointer-events-none">
                 <div className="absolute inset-0" />
               </BroadcastFrame>
             )}
             
             {/* ── LEFT: Host Video Card / Mobile Watch Surface ─────────────── */}
            {layoutMode === 'grid' ? (
              /* ===== GRID MODE: Broadcaster tile (same size as seat tiles) ===== */
               <div
                className={cn(
                    'relative min-h-0 overflow-hidden border border-cyan-400/30 bg-transparent',
                    'aspect-video',
                    isMobileViewer ? 'rounded-lg' : 'rounded-2xl shadow-[0_0_20px_rgba(45,212,191,0.15)]'
                  )}
               >
                 {passiveBunnyPlaybackUrl && !isUserOnStage ? (
                   <video
                     key={passiveBunnyPlaybackUrl}
                     src={passiveBunnyPlaybackUrl}
                     autoPlay
                     muted
                     playsInline
                     loop
                     className="absolute inset-0 h-full w-full object-cover"
                     onError={() => {
                       console.warn('[ViewerPage] Bunny viewer playback failed to load', passiveBunnyPlaybackUrl)
                     }}
                   />
                 ) : (
                 <RemoteVideoSurface
                   participant={broadcasterState.participant}
                   mirror={false}
                   className="absolute inset-0"
                   onTap={handleLike}
                   onDoubleTap={handleNextBroadcast}
                   room={liveKitRoom}
                   fallback={
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),#030611]">
                      <div className={cn(
                        'border border-cyan-400/20 bg-slate-950/70 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl',
                        isMobileViewer ? 'rounded-xl p-2' : 'rounded-3xl p-4'
                      )} style={{ overflow: 'visible' }}>
                        {broadcasterProfile?.avatar_url ? (
                          <div className={cn(
                            isMobileViewer ? 'mx-auto h-10 w-10' : 'mx-auto h-20 w-20'
                          )} style={{ overflow: 'visible' }}>
                            <ProfileFrame
                              frame={broadcasterFrame}
                              avatarUrl={broadcasterProfile.avatar_url}
                              username={hostName}
                              size={isMobileViewer ? 'sm' : 'md'}
                            />
                          </div>
                        ) : (
                          <Video className={cn(
                            'mx-auto text-cyan-200/70',
                            isMobileViewer ? 'h-6 w-6' : 'h-10 w-10'
                          )} />
                        )}
                        <button
                          onClick={() => {
                            setIsMessagePopupOpen(true)
                            setIsNewMessageMode(true)
                            setSearchQuery(broadcasterProfile?.username || '')
                            setSelectedThread(null)
                          }}
                          className={cn(
                            'font-black text-left',
                            isMobileViewer ? 'mt-1 text-[10px]' : 'mt-3 text-sm'
                          )}
                        >
                          {hostName}
                        </button>
                        <div className={cn(
                          'text-slate-300',
                          isMobileViewer ? 'text-[8px]' : 'mt-1 text-xs'
                        )}>
                          {isActive ? 'Camera Off' : 'Waiting for broadcast…'}
                        </div>
                      </div>
                    </div>
                  }
                />

                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />


                <div className={cn(
                  'absolute z-10 flex items-center',
                  isMobileViewer ? 'left-1 top-1' : 'left-3 top-3 gap-1.5'
                )}>
                  <div className={cn(
                    'border border-cyan-400/40 bg-cyan-500/15 font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)] backdrop-blur-xl',
                    isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-lg px-2.5 py-1 text-xs gap-1.5 flex items-center'
                  )}>
                    {!isMobileViewer && <Crown className="h-3 w-3" />}
                    Host
                  </div>
                </div>

                {/* LIVE / STARTING badge */}
                <div className={cn(
                  'absolute z-20 flex items-center',
                  isMobileViewer ? 'right-1 top-1' : 'right-3 top-3 gap-1.5'
                )}>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border font-black shadow-inner backdrop-blur-xl',
                      isMobileViewer ? 'h-4 gap-0.5 px-1 text-[7px]' : 'h-6 gap-1.5 px-2 text-[10px]',
                      isActive
                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                        : 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200'
                    )}
                  >
                    <span className={cn(
                      'rounded-full bg-current shadow-[0_0_10px_currentColor]',
                      isMobileViewer ? 'h-1 w-1' : 'h-1.5 w-1.5'
                    )} />
                    {isActive ? 'LIVE' : 'STARTING'}
                  </span>
                </div>

                {/* Seat number badge */}
                <div className={cn(
                  'absolute z-10 rounded-full border border-cyan-300/20 bg-black/15 font-black text-white/90 backdrop-blur-sm',
                  isMobileViewer ? 'left-1 bottom-1 px-1 py-0.5 text-[7px]' : 'left-3 bottom-3 px-2.5 py-1 text-[10px]'
                )}>
                  S1
                </div>

                <div className={cn(
                  'absolute z-10 flex items-center',
                  isMobileViewer ? 'right-1 bottom-1 gap-0.5' : 'right-3 bottom-3 gap-2'
                )}>
                  {broadcasterCityStatus.data && (
                    <CityStatusOrb
                      data={broadcasterCityStatus.data}
                      permissions={{ isSelf: false, canCheckLicense: false, canRaid: !!broadcasterCityStatus.data?.house_id, canRepair: false, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                      compact
                      onHouseClick={() => {
                        const targetUser = broadcasterCityStatus.data;
                        if (targetUser?.house_id && targetUser.id !== user?.id) {
                          setRaidTarget({ userId: targetUser.id, houseId: targetUser.house_id });
                        } else {
                          setSelectedSeatUserId(hostId);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* ===== SPLIT MODE: Large broadcaster panel ===== */
            <section
              className={cn(
                'relative min-h-0 overflow-hidden',
                theme.hostVideoPanel,
                isMobileViewer
                  ? 'flex-none rounded-xl border-2 border-cyan-400/40'
                  : 'rounded-2xl border border-cyan-400/30'
              )}
              style={
                isMobileViewer
                  ? {
                      height: mobileHostVideoHeight,
                      maxHeight: mobileHostVideoHeight,
                    }
                  : undefined
              }
            >
               {passiveBunnyPlaybackUrl && !isUserOnStage ? (
                 <video
                   key={passiveBunnyPlaybackUrl}
                   src={passiveBunnyPlaybackUrl}
                   autoPlay
                   muted
                   playsInline
                   loop
                   className="absolute inset-0 h-full w-full object-cover"
                   onError={() => {
                     console.warn('[ViewerPage] Bunny viewer playback failed to load', passiveBunnyPlaybackUrl)
                   }}
                 />
               ) : (
               <RemoteVideoSurface
                 participant={broadcasterState.participant}
                 mirror={false}
                 className="absolute inset-0"
                 onTap={handleLike}
                 onDoubleTap={handleNextBroadcast}
                 room={liveKitRoom}
                 fallback={
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),#030611]">
                    <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-500/10 backdrop-blur-xl" style={{ overflow: 'visible' }}>
                      {broadcasterProfile?.avatar_url ? (
                        <div className="mx-auto h-28 w-28" style={{ overflow: 'visible' }}>
                          <ProfileFrame
                            frame={broadcasterFrame}
                            avatarUrl={broadcasterProfile.avatar_url}
                            username={hostName}
                            size="md"
                          />
                        </div>
                      ) : (
                        <Video className="mx-auto h-12 w-12 text-cyan-200/70" />
                      )}
                      <div className="mt-4 text-lg font-black">{hostName}</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {isActive ? 'Camera Off' : 'Waiting for broadcast…'}
                      </div>
                    </div>
                  </div>
                }
              />

               )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />


              {!isMobileViewer && (
                <>
                  <div className="absolute left-5 top-5 z-20 flex flex-col gap-2">
                    {/* City Status Orb — compact inline (clickable) */}
                     {broadcasterCityStatus.data && (
                       <div className="pointer-events-auto">
                         <CityStatusOrb
                           data={broadcasterCityStatus.data}
                           permissions={{ isSelf: false, canCheckLicense: false, canRaid: !!broadcasterCityStatus.data?.house_id, canRepair: false, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                           compact
                           onHouseClick={() => {
                             const targetUser = broadcasterCityStatus.data;
                             if (targetUser?.house_id && targetUser.id !== user?.id) {
                               setRaidTarget({ userId: targetUser.id, houseId: targetUser.house_id });
                             } else {
                               setSelectedSeatUserId(hostId);
                             }
                           }}
                         />
                       </div>
                     )}
                  </div>

                  <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-inner backdrop-blur-xl',
                        isActive
                          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-emerald-500/10'
                          : 'border-yellow-400/30 bg-yellow-500/15 text-yellow-200 shadow-yellow-500/10'
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                      {isActive ? 'LIVE' : 'STARTING'}
                    </span>
                  </div>
                </>
              )}

              {viewerError && (
                <div className="absolute inset-x-4 top-16 z-30 rounded-2xl border border-red-400/35 bg-gradient-to-r from-red-950/90 to-red-900/80 px-4 py-3 text-sm font-bold text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.25)] backdrop-blur-2xl">
                  <div>{viewerError}</div>
                  <button
                    type="button"
                     onClick={() => {
                       setViewerError(null)
                       hasJoinedAudienceRef.current = false
                      joiningAudienceRef.current = false
                      audienceJoinAttemptedKeyRef.current = null
                      audienceFailedUntilRef.current = 0
                      setRetryAdmissionKey((k) => k + 1)
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-500/90 px-3 py-1 text-xs font-black text-white hover:bg-red-500"
                  >
                    Retry
                  </button>
                </div>
               )}
              
              </section>

              )/* ── CENTER: Seats belong beside the broadcaster, never over it ── */}
            {hasMounted && !isMobileViewer && layoutMode === 'split' && seatCards.length > 0 && (
              <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-cyan-300/25 bg-black/20 p-4 shadow-[0_0_28px_rgba(45,212,191,0.18)] backdrop-blur-xl">
                <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/80">Live Seats</p>
                    <p className="mt-1 text-xs font-semibold text-slate-300">
                      Seat coins deduct automatically when a viewer joins.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageSeats && (
                      <button
                        type="button"
                        onClick={handleAddSeat}
                        className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/25"
                      >
                        + Add Seat
                      </button>
                    )}
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-slate-200">
                      {seatCards.filter((seat) => !seat.isOccupied).length} open
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-2 gap-5 auto-rows-fr">
                  {seatCards.map((seat) => {
                    const seatStatus = String(seat.seat?.status || '').toLowerCase()
                    const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
                    const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))

                    // Use isolated seat state — each seat only accesses its own track
                    const seatState = seatTracks[seat.seatIndex] || null
                    const seatParticipant = !isMine && seatState ? seatState.participant : null
                    const seatIsLoading = seatState?.isLoading || false

                    const statusLabel = isMine
                      ? 'You'
                      : seat.isOccupied
                        ? seat.displayName
                        : seat.isLocked
                          ? 'Locked'
                          : seat.seatPrice === 0
                            ? 'Free Seat'
                            : `${seat.seatPrice} Coins`

                    // Any occupied seat is clickable to open CityStatusPanel
                    const canClickSeat = seat.isOccupied && seatUserId;

                    const seatClickProps = canClickSeat
                      ? {
                          role: 'button' as const,
                          tabIndex: 0,
                          onClick: () => {
                            if (isModOrHigher) {
                              setSelectedSeatUserId(seatUserId)
                            } else {
                              const seatUser = userProfiles?.[seatUserId]
                              void handleOpenUserAction({
                                userId: seatUserId,
                                username: seat.displayName || seatUser?.username,
                                role: seatUser?.role || seatUser?.troll_role,
                                createdAt: seatUser?.created_at,
                              })
                            }
                          },
                          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (isModOrHigher) {
                                setSelectedSeatUserId(seatUserId)
                              } else {
                                const seatUser = userProfiles?.[seatUserId]
                                void handleOpenUserAction({
                                  userId: seatUserId,
                                  username: seat.displayName || seatUser?.username,
                                  role: seatUser?.role || seatUser?.troll_role,
                                  createdAt: seatUser?.created_at,
                                })
                              }
                            }
                          },
                        }
                      : undefined;

                    return (
                      <div
                        key={seat.seatIndex}
                        className={cn(
                          'relative min-h-0 overflow-hidden rounded-2xl border bg-transparent shadow-[inset_0_0_18px_rgba(15,23,42,0.78)] transition-all',
                          isMine
                            ? 'border-emerald-300/60 shadow-[0_0_24px_rgba(16,185,129,0.18)]'
                            : seat.isOccupied
                              ? 'border-purple-300/45 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_45%),rgba(2,6,23,0.82)] shadow-[0_0_24px_rgba(168,85,247,0.16)]'
                              : seat.isLocked
                                ? 'border-white/10 bg-transparent opacity-70'
                                : 'border-white/10 bg-transparent hover:border-white/20 hover:shadow-[0_0_24px_rgba(15,23,42,0.18)]',
                          canClickSeat ? 'cursor-pointer hover:-translate-y-0.5' : ''
                        )}
                        {...seatClickProps}
                      >
                        {isMine ? (
                          <LocalVideoSurface
                            videoTrack={localVideoTrack}
                            audioTrack={localAudioTrack}
                            mirror={false}
                            className="absolute inset-0"
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-500/10">
                                  <Users className="h-6 w-6 text-emerald-100/80" />
                                </div>
                                <div className="px-3 text-sm font-black text-white">Your camera</div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Camera starting</div>
                              </div>
                            }
                          />
                        ) : seat.isOccupied ? (
                          <RemoteVideoSurface
                            participant={seatParticipant}
                            mirror={false}
                            className="absolute inset-0"
                            room={liveKitRoom}
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/30 bg-purple-500/10">
                                  <Users className="h-6 w-6 text-purple-200/80" />
                                </div>
                                <div className="px-3 text-sm font-black text-white">{seat.displayName}</div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/70">Camera starting</div>
                              </div>
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!seat.canJoin}
                            onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                            className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center disabled:cursor-not-allowed"
                          >
                            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-500/40 bg-transparent">
                              <Users className="h-6 w-6 text-slate-200" />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black text-white">
                              Seat {seat.seatIndex}
                            </div>
                            <div className={cn('text-xs font-bold', seat.canJoin ? 'text-slate-200' : 'text-slate-500')}>
                              {statusLabel}
                            </div>
                          </button>
                        )}

                        {seat.isOccupied && (
                          <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
                            <div className="min-w-0 flex-1">
                              {seatUserId ? (
                                 <SeatCityStatusOrb
                                   userId={seatUserId}
                                   broadcasterId={hostId}
                                   isBroadOfficer={isOfficer}
                                   onClick={() => {
                                     if (isModOrHigher) {
                                       setSelectedSeatUserId(seatUserId)
                                     } else {
                                       const seatUser = userProfiles?.[seatUserId]
                                       void handleOpenUserAction({
                                         userId: seatUserId,
                                         username: seat.displayName || seatUser?.username,
                                         role: seatUser?.role || seatUser?.troll_role,
                                         createdAt: seatUser?.created_at,
                                       })
                                     }
                                   }}
                                 />
                              ) : (
                                <>
                                  <p className="truncate text-xs font-black text-white">Seat {seat.seatIndex}</p>
                                  <p className="truncate text-[11px] font-bold text-cyan-100/70">{statusLabel}</p>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {seat.isMine && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleLeaveSeat(); }}
                                  className="rounded-lg border border-red-300/25 bg-red-500/15 px-2 py-1 text-[11px] font-black text-red-100"
                                >
                                  Leave
                                 </button>
                               )}
                            </div>
                           </div>
                         )}
                       </div>
                     )
                  })}
                </div>
              </aside>
            )}

            {/* ── GRID MODE: Individual seat tiles rendered as direct grid children -- */}
            {hasMounted && layoutMode === 'grid' && seatCards.map((seat) => {
              const seatStatus = String(seat.seat?.status || '').toLowerCase()
              const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
              const seatIdentity = seat.seat?.livekit_participant_identity || seatUserId
              const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))
              const seatParticipant = !isMine && seatIdentity
                ? remoteParticipants.find((participant: any) => {
                    const participantIdentity = String(participant?.identity || '')
                    return (
                      participantMatchesUser(participant, seatIdentity) ||
                      participantMatchesUser(participant, seatUserId) ||
                      participantIdentity === String(seatIdentity) ||
                      participantIdentity.endsWith(`-${seatIdentity}`) ||
                      String(seatIdentity).endsWith(participantIdentity)
                    )
                  })
                : null

              const statusLabel = isMine
                ? 'You'
                : seat.isOccupied
                  ? seat.displayName
                  : seat.isLocked
                    ? 'Locked'
                    : seat.seatPrice === 0
                      ? 'Free Seat'
                      : `${seat.seatPrice} Coins`

              const canClickSeat = seat.isOccupied && seatUserId;
              const seatClickProps = canClickSeat
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    onClick: () => {
                      if (isModOrHigher) {
                        setSelectedSeatUserId(seatUserId)
                      } else {
                        const seatUser = userProfiles?.[seatUserId]
                        void handleOpenUserAction({
                          userId: seatUserId,
                          username: seat.displayName || seatUser?.username,
                          role: seatUser?.role || seatUser?.troll_role,
                          createdAt: seatUser?.created_at,
                        })
                      }
                    },
                    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (isModOrHigher) {
                          setSelectedSeatUserId(seatUserId)
                        } else {
                          const seatUser = userProfiles?.[seatUserId]
                          void handleOpenUserAction({
                            userId: seatUserId,
                            username: seat.displayName || seatUser?.username,
                            role: seatUser?.role || seatUser?.troll_role,
                            createdAt: seatUser?.created_at,
                          })
                        }
                      }
                    },
                  }
                : undefined;

               return (
                 <div
                   key={`grid-seat-${seat.seatIndex}`}
                    className={cn(
                      'relative min-h-0 overflow-hidden border bg-transparent transition-all',
                      isMobileViewer ? 'aspect-video rounded-lg' : 'rounded-2xl shadow-[inset_0_0_18px_rgba(15,23,42,0.78)]',
                     isMine
                       ? 'border-emerald-300/60'
                       : seat.isOccupied
                         ? 'border-purple-300/45 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_45%),rgba(2,6,23,0.82)]'
                         : seat.isLocked
                           ? 'border-white/10 bg-transparent opacity-70'
                           : 'border-white/10 bg-transparent',
                     canClickSeat ? 'cursor-pointer' : '',
                     isMobileViewer && stream?.has_rgb_effect ? 'rgb-box' : '',
                   )}
                   {...seatClickProps}
                 >
                  {isMine ? (
                    <LocalVideoSurface
                      videoTrack={localVideoTrack}
                      audioTrack={localAudioTrack}
                      mirror={false}
                      className="absolute inset-0"
                      fallback={
                        <div className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          isMobileViewer ? 'gap-0.5' : 'gap-3'
                        )}>
                          <div className={cn(
                            'grid place-items-center rounded-xl border border-emerald-300/30 bg-emerald-500/10',
                            isMobileViewer ? 'h-6 w-6' : 'h-12 w-12'
                          )}>
                            <Users className={cn(isMobileViewer ? 'h-3 w-3' : 'h-6 w-6', 'text-emerald-100/80')} />
                          </div>
                          <div className={cn('px-1 font-black text-white', isMobileViewer ? 'text-[8px]' : 'text-sm')}>You</div>
                        </div>
                      }
                    />
                  ) : seat.isOccupied ? (
                          <RemoteVideoSurface
                            participant={seatParticipant}
                            mirror={false}
                            className="absolute inset-0"
                      room={liveKitRoom}
                      fallback={
                        <div className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          isMobileViewer ? 'gap-0.5' : 'gap-3'
                        )}>
                          <div className={cn(
                            'grid place-items-center rounded-xl border border-purple-300/30 bg-purple-500/10',
                            isMobileViewer ? 'h-6 w-6' : 'h-12 w-12'
                          )}>
                            <Users className={cn(isMobileViewer ? 'h-3 w-3' : 'h-6 w-6', 'text-purple-200/80')} />
                          </div>
                          <div className={cn('px-1 font-black text-white truncate', isMobileViewer ? 'text-[8px]' : 'text-sm')}>{seat.displayName}</div>
                        </div>
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!seat.canJoin}
                      onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                      className={cn(
                        'flex h-full w-full flex-col items-center justify-center text-center disabled:cursor-not-allowed',
                        isMobileViewer ? 'gap-0.5 p-1' : 'gap-3 p-4'
                      )}
                    >
                      <div className={cn(
                        'grid place-items-center rounded-lg border border-slate-500/40 bg-transparent',
                        isMobileViewer ? 'h-5 w-5' : 'h-12 w-12'
                      )}>
                        <Plus className={cn(isMobileViewer ? 'h-2.5 w-2.5' : 'h-6 w-6', 'text-slate-200')} />
                      </div>
                      <div className={cn(
                        'border border-white/10 bg-black/20 font-black text-white',
                        isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-xl px-4 py-2 text-sm'
                      )}>
                        S{seat.seatIndex}
                      </div>
                      <div className={cn(
                        isMobileViewer ? 'text-[7px]' : 'text-xs',
                        'font-bold',
                        seat.canJoin ? 'text-slate-200' : 'text-slate-500'
                      )}>
                        {seat.isLocked ? 'Locked' : seat.seatPrice === 0 ? 'Free' : `${seat.seatPrice}◈`}
                      </div>
                    </button>
                  )}

                  {seat.isOccupied && (
                    <div className={cn(
                      'absolute z-20 flex items-center justify-between border border-white/10 bg-black/55 backdrop-blur-md',
                      isMobileViewer
                        ? 'inset-x-0.5 bottom-0.5 gap-0.5 rounded px-1 py-0.5'
                        : 'inset-x-3 bottom-3 gap-2 rounded-xl px-3 py-2'
                    )}>
                      <div className="min-w-0 flex-1">
                        {seatUserId ? (
                           <SeatCityStatusOrb
                             userId={seatUserId}
                             broadcasterId={hostId}
                             isBroadOfficer={isOfficer}
                             onClick={() => {
                               if (isModOrHigher) {
                                 setSelectedSeatUserId(seatUserId)
                               } else {
                                 const seatUser = userProfiles?.[seatUserId]
                                 void handleOpenUserAction({
                                   userId: seatUserId,
                                   username: seat.displayName || seatUser?.username,
                                   role: seatUser?.role || seatUser?.troll_role,
                                   createdAt: seatUser?.created_at,
                                 })
                               }
                             }}
                           />
                        ) : (
                          <>
                            <p className={cn('truncate font-black text-white', isMobileViewer ? 'text-[7px]' : 'text-xs')}>Seat {seat.seatIndex}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        {seat.isMine && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleLeaveSeat(); }}
                            className={cn(
                              'border border-red-300/25 bg-red-500/15 font-black text-red-100',
                              isMobileViewer ? 'rounded px-1 py-0.5 text-[7px]' : 'rounded-lg px-2 py-1 text-[11px]'
                            )}
                          >
                            Leave
                           </button>
                         )}
                        </div>
                       </div>
                     )}
                   </div>
                 )
               })}

           {/* ── MOBILE PWA: Seats overlay on broadcaster video (split mode only) ── */}
           {hasMounted && isMobileViewer && effectiveBoxCount <= 6 && seatCards.length > 0 && (
             <div
               className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col"
               style={{
                 bottom: `calc(${MOBILE_CHAT_INPUT_HEIGHT}px + 8px + env(safe-area-inset-bottom))`,
                 maxHeight: mobileSeatGridHeight,
               }}
             >
               <div className="pointer-events-auto overflow-y-auto px-2 pb-1 scrollbar-hide">
                 <div
                   className={cn(
                     'grid gap-2',
                     mobileSeatGridCols
                   )}
                 >
                   {seatCards.map((seat) => {
                     const seatStatus = String(seat.seat?.status || '').toLowerCase()
                     const seatUserId = seat.seat?.user_id || seat.seat?.guest_id || null
                     const seatIdentity = seat.seat?.livekit_participant_identity || seatUserId
                     const isMine = Boolean(user?.id && (seat.seat?.user_id === user.id || seat.seat?.guest_id === user.id))
                     const seatParticipant = !isMine && seatIdentity
                       ? remoteParticipants.find((participant: any) => {
                           const participantIdentity = String(participant?.identity || '')
                           return (
                             participantMatchesUser(participant, seatIdentity) ||
                             participantMatchesUser(participant, seatUserId) ||
                             participantIdentity === String(seatIdentity) ||
                             participantIdentity.endsWith(`-${seatIdentity}`) ||
                             String(seatIdentity).endsWith(participantIdentity)
                           )
                         })
                       : null

                      return (
                           <div
                           key={seat.seatIndex}
                            className={cn(
                              'relative aspect-video overflow-hidden rounded-lg border',
                            isMine
                              ? 'border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                              : seat.isOccupied
                                ? 'border-purple-400/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                                : 'border-white/20',
                            'bg-transparent w-full',
                            stream?.has_rgb_effect ? 'rgb-box' : '',
                          )}
                       >
                        {isMine ? (
                          <LocalVideoSurface
                            videoTrack={localVideoTrack}
                            audioTrack={localAudioTrack}
                            mirror={false}
                            className="absolute inset-0"
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                                <Users className="h-5 w-5 text-emerald-300/70" />
                                <div className="text-[10px] font-black text-white">You</div>
                                <div className="text-[9px] text-emerald-200/60">Starting</div>
                              </div>
                            }
                          />
                        ) : seat.isOccupied ? (
                          <RemoteVideoSurface
                            participant={seatParticipant}
                            mirror={false}
                            className="absolute inset-0"
                            room={liveKitRoom}
                            fallback={
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                                <Users className="h-5 w-5 text-purple-300/70" />
                                <div className="max-w-full truncate px-1 text-[10px] font-black text-white">{seat.displayName}</div>
                                <div className="text-[9px] text-purple-200/60">Starting</div>
                              </div>
                            }
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!seat.canJoin}
                            onClick={() => seat.canJoin && handleJoinSeatByIndex(seat.seatIndex)}
                            className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-1.5 text-center bg-transparent disabled:cursor-not-allowed"
                          >
                            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-transparent">
                              <Plus className="h-5 w-5 text-white/70" />
                            </div>
                            <div className="text-[11px] font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Seat {seat.seatIndex}</div>
                            <div className="text-[10px] font-bold text-white/60 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                              {seat.isLocked ? 'Locked' : seat.seatPrice === 0 ? 'Free' : `${seat.seatPrice} ◈`}
                            </div>
                          </button>
                        )}

                         {/* Seat label overlay */}
                         {seat.isOccupied && (
                           <div className="absolute inset-x-0 bottom-0 px-1.5 py-0.5">
                             <p className="truncate text-[9px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">{seat.displayName}</p>
                           </div>
                         )}
                       </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── RIGHT: Desktop Chat Panel — same flow layout style as BroadcastPage ── */}
          {!isMobileViewer && effectiveBoxCount <= 6 && (
            <aside
              className={cn(
                theme.chatPanel,
                'flex h-full min-h-0 flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]'
              )}
            >
              <div className="grid shrink-0 grid-cols-5 border-b border-white/10 bg-black/10">
                 {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans'].map((tab) => {
                   const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'
                  const active = chatTab === tabKey
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setChatTab(tabKey)}
                      className={cn(
                        'relative h-16 text-sm font-black transition-colors',
                        active ? 'text-white' : 'text-white/60 hover:text-white/80'
                      )}
                      data-active={active}
                    >
                      {tab}
                      {active && (
                        <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_12px_rgba(45,212,191,0.7)]" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {chatTab === 'progress' ? (
                  <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                    <LeagueProgressPanel streamId={streamId} />
                  </div>
                ) : chatTab === 'chat' ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                    <div
                      ref={floatingChatContainerRef}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 scrollbar-hide"
                    >
                      {floatingMessages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm font-bold text-white/25">
                          No messages yet say something!
                        </div>
                      ) : (
<div className="flex flex-col gap-1.5">
                            <AnimatePresence initial={false}>
                              {floatingMessages.map((msg) => {
                                const isPinned = pinnedMessageIds.has(msg.id)
                                return (
                                <motion.div
                                  key={msg.id}
                                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -40, scale: 0.96 }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                  className="text-sm leading-relaxed break-words"
                                >
                                  {msg.isSystem ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2">
                                      <span className="text-[10px] font-black text-yellow-300 uppercase tracking-wider">System</span>
                                      <span className="text-yellow-100/90 font-semibold">{msg.content}</span>
                                    </div>
                                  ) : (
                                  <div className="flex items-start gap-1">
                                    {isPinned && (
                                      <Pin className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenFloatingChatUsername(msg.username)}
                                        className="cursor-pointer font-black text-cyan-300 transition-colors hover:text-cyan-100 inline-flex items-center gap-1"
                                        title={`View ${msg.username}'s profile`}
                                      >
                                        {msg.username}
                                        {subscriberUsernames?.has(msg.username) && (
                                          <Crown className="w-3 h-3 text-yellow-400" />
                                        )}
                                      </button>
                                      <span className="mx-1 text-white/40">:</span>
                                      <span className="text-white/90">{msg.content}</span>
                                    </div>
                                    {canPinMessages && (
                                      <button
                                        type="button"
                                        onClick={() => isPinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)}
                                        className="flex-shrink-0 p-0.5 rounded text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10 transition-colors"
                                        title={isPinned ? 'Unpin message' : 'Pin message'}
                                      >
                                        <Pin className="w-3 h-3" fill={isPinned ? 'currentColor' : 'none'} />
                                      </button>
                                    )}
                                    </div>
                                   )
                                  }
                                 </motion.div>
                                )})
                               }
                             </AnimatePresence>
                        </div>
                      )}
                    </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const text = chatInput.trim()
                  if (!text) return
                  await handleSendChat(text, CHAT_FLOAT_MS)
                }}
                className="shrink-0 border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
              >
                      <input
                        type="text"
                         value={chatInput}
                         onChange={(e) => setChatInput(e.target.value)}
                         placeholder={
                           hostChatDisabledByOfficer
                             ? 'Chat disabled by officer control'
                             : userChatDisabled
                               ? 'Chat disabled'
                               : 'Say something '
                         }
                         disabled={hostChatDisabledByOfficer || userChatDisabled}
                         readOnly={hostChatDisabledByOfficer || userChatDisabled}
                         className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50" maxLength={280} />
                    </form>
                  </div>
                ) : chatTab === 'league' ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">League Status</div>
                    {isUserLeaguesLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading league data...</div>
                    ) : myLeagues.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                        You are not currently in a league.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myLeagues.map((league) => {
                          const membership = myMemberships[league.id]
                          const leagueMissionsForLeague = leagueMissions.filter((mission) => mission.league_id === league.id)
                          return (
                            <div key={league.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                                  {league.icon_emoji || '🏆'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white truncate">{league.name}</p>
                                  <p className="text-xs text-slate-400 truncate">{league.description || 'League membership active'}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</p>
                                  <p className="mt-2 text-sm font-black text-white">{membership?.role || membership?.status || 'Member'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Score</p>
                                  <p className="mt-2 text-sm font-black text-white">{league.league_score.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Members</p>
                                  <p className="mt-2 text-sm font-black text-white">{league.member_count}/{league.max_members}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Missions</p>
                                  <p className="mt-2 text-sm font-black text-white">{leagueMissionsForLeague.length} active</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : chatTab === 'gifts' ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Recent Gifts</div>
                    {recentGifts.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                        No gifts have been received yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentGifts.slice(0, 12).map((gift) => (
                          <div key={gift.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-white">
                                  {gift.sender_name || (gift as any).sender_username || 'Anonymous'}
                                </div>
                                <div className="truncate text-xs text-slate-400">
                                  Sent {gift.quantity || 1} {gift.gift_name || 'gift'}
                                </div>
                              </div>
                              <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">
                                {Number((gift as any).coins_amount || gift.amount || 0).toLocaleString()} coins
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                    <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Top Fans</div>
                    {isTopFansLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">Loading top fans...</div>
                    ) : topGifters.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">No fan activity yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {topGifters.map((fan) => (
                          <div key={fan.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white">
                                {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-white">{fan.sender_username || 'Troll Citizen'}</div>
                                <div className="truncate text-xs text-slate-400">
                                  Last gift: {fan.last_gift_at ? new Date(fan.last_gift_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
                                </div>
                              </div>
                              <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">{fan.total_gift_coins.toLocaleString()} coins</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </main>

        {/* ===== GRID MODE: Chat panel below the seat grid (desktop only) ===== */}
        {!isMobileViewer && layoutMode === 'grid' && (
          <aside
            className={cn(
              theme.chatPanel,
              'flex flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]',
              'h-[280px] shrink-0'
            )}
          >
            {/* Chat tabs */}
            <div className="grid shrink-0 grid-cols-5 border-b border-white/10 bg-black/10">
              {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans'].map((tab) => {
                const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans'
                const active = chatTab === tabKey
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setChatTab(tabKey)}
                    className={cn(
                      'relative h-16 text-sm font-black transition-colors',
                      active ? 'text-white' : 'text-white/60 hover:text-white/80'
                    )}
                    data-active={active}
                  >
                    {tab}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_12px_rgba(45,212,191,0.7)]" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {chatTab === 'progress' ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                  <LeagueProgressPanel streamId={streamId} />
                </div>
              ) : chatTab === 'chat' ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                  <div
                    ref={floatingChatContainerRef}
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide overscroll-contain"
                  >
                    {floatingMessages.length === 0 && (
                      <div className="flex h-full items-center justify-center text-white/25 text-sm font-bold">
                        No messages yet — say something!
                      </div>
                    )}
                     {floatingMessages.map((msg) => (
                       msg.isSystem ? (
                         <div
                           key={msg.id}
                           className="text-sm leading-relaxed break-words animate-in fade-in duration-200"
                           style={{ animation: 'slideInFromTop 0.3s ease-out' }}
                         >
                           <span className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400/25 bg-yellow-500/10 px-2 py-1">
                             <span className="text-[10px] font-black text-yellow-300 uppercase tracking-wider">System</span>
                             <span className="text-yellow-100/90 font-semibold">{msg.content}</span>
                           </span>
                         </div>
                       ) : (
                       <div
                         key={msg.id}
                         className="text-sm leading-relaxed break-words animate-in fade-in duration-200"
                         style={{ animation: 'slideInFromTop 0.3s ease-out' }}
                       >
                         <button
                           onClick={() => handleOpenFloatingChatUsername(msg.username)}
                           className="font-black text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                           title={`View ${msg.username}'s profile`}
                         >
                           {msg.username}
                           {subscriberUsernames?.has(msg.username) && (
                             <Crown className="w-3 h-3 text-yellow-400" />
                           )}
                         </button>
                         <span className="text-white/40 mx-1">:</span>
                         <span className="text-white/90">{msg.content}</span>
                       </div>
                       )
                     ))}
                  </div>
                   {/* Chat input */}
                   <form
                     onSubmit={async (e) => {
                       e.preventDefault()
                       const text = chatInput.trim()
                       if (!text) return
                       await handleSendChat(text, CHAT_FLOAT_MS)
                     }}
                     className="mt-auto border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                   >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={
                        hostChatDisabledByOfficer
                          ? 'Chat disabled by officer control'
                          : userChatDisabled
                            ? 'Chat disabled'
                            : 'Say something…'
                      }
                      disabled={hostChatDisabledByOfficer || userChatDisabled}
                      readOnly={hostChatDisabledByOfficer || userChatDisabled}
                      className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      maxLength={280}
                    />
                  </form>
                </div>
              ) : chatTab === 'league' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">League Status</div>
                  {isUserLeaguesLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading leagues...</div>
                  ) : myLeagues.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">
                      You are not in any league yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myLeagues.map((league) => {
                        const membership = myMemberships[league.id]
                        const leagueMissionsForLeague = leagueMissions.filter((mission) => mission.league_id === league.id)
                        return (
                          <div key={league.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                                {league.icon_emoji || '🏆'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white truncate">{league.name}</p>
                                <p className="text-xs text-slate-400 truncate">{league.description || 'League membership active'}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Status</p>
                                <p className="mt-2 text-sm font-black text-white">{membership?.role || membership?.status || 'Member'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Score</p>
                                <p className="mt-2 text-sm font-black text-white">{league.league_score.toLocaleString()}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Members</p>
                                <p className="mt-2 text-sm font-black text-white">{league.member_count}/{league.max_members}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Missions</p>
                                <p className="mt-2 text-sm font-black text-white">{leagueMissionsForLeague.length} active</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : chatTab === 'gifts' ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Recent Gifts</div>
                  {recentGifts.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No gifts yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentGifts.slice(-20).reverse().map((gift) => (
                        <div key={gift.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-white">
                                {gift.sender_name || (gift as any).sender_username || 'Anonymous'}
                              </div>
                              <div className="truncate text-xs text-slate-400">
                                Sent {gift.quantity || 1} {gift.gift_name || 'gift'}
                              </div>
                            </div>
                            <div className="whitespace-nowrap text-xs font-semibold text-cyan-300">
                              {Number((gift as any).coins_amount || gift.amount || 0).toLocaleString()} coins
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-slate-200 scrollbar-hide">
                  <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Top Fans</div>
                  {isTopFansLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading top fans...</div>
                  ) : topGifters.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No top fans yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {topGifters.map((fan, index) => (
                        <div key={fan.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                #{index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-white">{fan.sender_username || 'Troll Citizen'}</div>
                                <div className="truncate text-xs text-slate-400">
                                  {fan.last_gift_at
                                    ? `Last gift: ${new Date(fan.last_gift_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                                    : 'All-time supporter'}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-black text-cyan-300">{fan.total_gift_coins.toLocaleString()}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">coins gifted</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── MOBILE CHAT INPUT AT BOTTOM — fixed overlay, not document flow ── */}
        {isMobileViewer && (
          <div
            className="fixed inset-x-3 z-40 pointer-events-auto"
            style={{ bottom: `env(safe-area-inset-bottom)` }}
          >
               <form
                 onSubmit={async (e) => {
                   e.preventDefault()
                   const text = chatInput.trim()
                   if (!text) return
                   await handleSendChat(text, 20000)
                 }}
                 className="flex gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 shadow-[0_0_24px_rgba(34,211,238,0.16)] backdrop-blur-xl"
               >
               <input
                 type="text"
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 placeholder={
                   hostChatDisabledByOfficer
                     ? 'Chat disabled by officer control'
                     : userChatDisabled
                       ? 'Chat disabled'
                       : 'Say something '
                 }
                 disabled={hostChatDisabledByOfficer || userChatDisabled}
                 readOnly={hostChatDisabledByOfficer || userChatDisabled}
                 className={cn(
                   "h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50",
                   (hostChatDisabledByOfficer || userChatDisabled) && "opacity-50 cursor-not-allowed"
                 )}
                 maxLength={280} />
               <button
                 type="submit"
                 disabled={!chatInput.trim() || hostChatDisabledByOfficer || userChatDisabled}
                 className={cn(
                   'inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50',
                   chatInput.trim() && !hostChatDisabledByOfficer && !userChatDisabled
                     ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-300'
                     : 'border border-white/10 bg-white/5 text-white/30'
                 )}
               >
                Send
              </button>
            </form>
           </div>
         )}

          {/* ── MOBILE: Flying chat that rises up the screen from the chat input box ── */}
          {isMobileViewer && floatingMessages.length > 0 && !isMobileChatOpen && (
            <div
              className="fixed inset-x-0 z-30 pointer-events-none flex flex-col items-start justify-end overflow-hidden"
              style={{
                left: 0,
                right: '48px',
                bottom: `calc(${MOBILE_CHAT_INPUT_HEIGHT}px + env(safe-area-inset-bottom))`,
                top: 0,
              }}
            >
               <AnimatePresence initial={false}>
                 {floatingMessages.slice(0, 6).map((message) => {
                   if (message.isSystem) {
                     return (
                       <motion.div
                         key={message.id}
                         initial={{ opacity: 0, y: 0 }}
                         animate={{ opacity: [0, 1, 1, 0], y: 'calc(-100dvh + 80px)' }}
                         exit={{ opacity: 0 }}
                          transition={{ duration: 28, ease: 'linear' }}
                          className="pointer-events-auto mb-1 max-w-[85%] self-start bg-transparent"
                        >
                          <span
                            className="font-black text-[12px] inline-flex items-center gap-1"
                            style={{
                              color: '#fbbf24',
                              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                            }}
                          >
                            ⚡ {message.content}
                          </span>
                        </motion.div>
                     )
                   }
                   return (
                   <motion.div
                     key={message.id}
                     initial={{ opacity: 0, y: 0 }}
                     animate={{ opacity: [0, 1, 1, 0], y: 'calc(-100dvh + 80px)' }}
                     exit={{ opacity: 0 }}
                          transition={{ duration: 28, ease: 'linear' }}
                     className="pointer-events-auto mb-1 max-w-[85%] self-start bg-transparent"
                   >
                     {isModOrHigher ? (
                       <button
                         type="button"
                         onClick={(e) => { e.stopPropagation(); handleOpenFloatingChatUsername(message.username) }}
                         className="font-black text-[12px] inline-flex items-center gap-1 cursor-pointer"
                         style={{
                           color: '#ffffff',
                           textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                         }}
                       >
                         {message.username}
                       </button>
                     ) : (
                       <span
                         className="font-black text-[12px] inline-flex items-center gap-1"
                         style={{
                           color: '#ffffff',
                           textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                         }}
                       >
                         {message.username}
                       </span>
                     )}
                     {' '}
                     <span
                       className="text-[12px]"
                       style={{
                         color: '#ffffff',
                         textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                       }}
                     >
                       {message.content}
                     </span>
                   </motion.div>
                   )
                 })}
               </AnimatePresence>
            </div>
          )}


         {/* ── MOBILE: Toggleable chat box ── */}
         {isMobileViewer && isMobileChatOpen && (
           <div
             className="fixed inset-x-0 z-40 pointer-events-auto flex flex-col"
             style={{
               top: '10%',
               bottom: `calc(${MOBILE_CHAT_INPUT_HEIGHT}px + 8px + env(safe-area-inset-bottom))`,
               right: '48px',
             }}
           >
             <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/95 px-3 py-2 backdrop-blur-xl">
               <span className="text-xs font-black text-white uppercase tracking-wider">Chat</span>
               <button
                 type="button"
                 onClick={() => setIsMobileChatOpen(false)}
                 className="text-zinc-400 hover:text-white transition-colors"
               >
                 <X size={16} />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto bg-black/80 backdrop-blur-xl px-2 py-2 scrollbar-hide">
               {floatingMessages.length === 0 ? (
                 <div className="flex h-full items-center justify-center text-sm font-bold text-white/25">
                   No messages yet
                 </div>
               ) : (
                 <div className="flex flex-col gap-1">
                    <AnimatePresence initial={false}>
                      {floatingMessages.map((msg) => {
                        if (msg.isSystem) {
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.25 }}
                              className="rounded-lg border border-yellow-400/30 bg-yellow-500/15 px-2 py-1"
                            >
                              <span className="text-[11px] font-black" style={{ color: '#fbbf24', textShadow: '0 0 2px #fbbf24, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000' }}>
                                ⚡ {msg.content}
                              </span>
                            </motion.div>
                          )
                        }
                        return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.25 }}
                          className="rounded-lg border border-black/60 bg-purple-700/80 px-2 py-1"
                        >
                          <button
                            onClick={() => handleOpenFloatingChatUsername(msg.username)}
                            className="font-black text-[11px] cursor-pointer inline-flex items-center gap-1"
                            style={{
                              color: '#39ff14',
                              textShadow: '0 0 3px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                            }}
                          >
                            {msg.username}
                          </button>
                          <span className="mx-0.5 text-white/30">:</span>
                          <span
                            className="text-[11px]"
                            style={{
                              color: '#39ff14',
                              textShadow: '0 0 2px #39ff14, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                            }}
                          >
                            {msg.content}
                          </span>
                        </motion.div>
                        )
                      })}
                    </AnimatePresence>
                 </div>
               )}
             </div>
           </div>
         )}

         {/* ── MOBILE: Right-side vertical control bar ── */}
         {isMobileViewer && (
           <div
             className="fixed right-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-auto"
             style={{
               top: '50%',
               transform: 'translateY(-50%)',
               paddingRight: '4px',
             }}
           >
              {isPaidChatEnabled && (
                <button
                  onClick={() => setIsPaidChatModalOpen(true)}
                   className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                 >
                    <MessageSquare className="h-10 w-10" />
                 </button>
               )}
                <button
                  onClick={() => setIsMessagePopupOpen(true)}
                  className={cn(
                     'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold border transition',
                     'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                   )}
                 >
                   <MessageSquare className="h-10 w-10" />
                </button>
              <button
                onClick={() => onGift(hostId)}
className={cn('inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold', theme.purpleButton)}
               >
                 <Gift className="h-10 w-10" />
              </button>
               <button
                 onClick={handleShare}
                 className={cn('inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold', theme.cyanButton)}
                >
                  <Share2 className="h-10 w-10" />
               </button>
               {isUserOnStage && (
                 <>
                   <button
                     onClick={handleToggleMic}
                     className={cn(
                       'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
                       seatMicOn
                         ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                         : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                     )}
                     title={seatMicOn ? 'Mute mic' : 'Unmute mic'}
                   >
                     {seatMicOn ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />}
                   </button>
                   <button
                     onClick={handleToggleCamera}
                     className={cn(
                       'inline-flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold transition',
                       seatCamOn
                         ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                         : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                     )}
                     title={seatCamOn ? 'Turn off camera' : 'Turn on camera'}
                   >
                     {seatCamOn ? <Video className="h-10 w-10" /> : <VideoOff className="h-10 w-10" />}
                   </button>
                 </>
                )}
           </div>
          )}

         {/* ── DESKTOP: Bottom control bar ── */}
         {!isMobileViewer && (
          <div
    className={cn(
      'relative z-20 shrink-0 px-4 py-3',
      theme.bottomBar,
      'border-t border-white/10'
    )}
  >
      <div className="flex items-center justify-center gap-3 mx-auto max-w-7xl">
        <button
          onClick={() => setIsMessagePopupOpen(true)}
          className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]')}
        >
           <MessageSquare className="h-5 w-5" />
        </button>
        {isPaidChatEnabled && (
         <button
           onClick={() => setIsPaidChatModalOpen(true)}
           className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', 'border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20')}
         >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => onGift(hostId)}
          className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', theme.purpleButton)}
        >
          <Gift className="h-5 w-5" />
        </button>
        <button
          onClick={handleShare}
          className={cn('inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold', theme.cyanButton)}
        >
          <Share2 className="h-5 w-5" />
        </button>
        {isUserOnStage && (
          <>
            <button
              onClick={handleToggleMic}
              className={cn(
                'inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold transition',
                seatMicOn
                  ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              )}
              title={seatMicOn ? 'Mute mic' : 'Unmute mic'}
            >
              {seatMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={handleToggleCamera}
              className={cn(
                'inline-flex h-12 w-20 items-center justify-center rounded-xl text-sm font-bold transition',
                seatCamOn
                  ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'border border-red-400/40 bg-red-500/15 text-red-200 hover:bg-red-500/25'
              )}
              title={seatCamOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {seatCamOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>
    </div>
          )}

        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="pointer-events-auto">
            <GiftBoxModal
              isOpen={isGiftModalOpen}
              onClose={() => {
                setIsGiftModalOpen(false)
                setGiftRecipientId(null)
              } }
              recipientId={giftRecipientId || hostId}
              streamId={streamId}
              broadcasterId={hostId}
              activeUserIds={activeUserIds}
              userProfiles={userProfiles} />

{userActionTarget && (
              showModActionMenu ? (
                <ModActionsPopup
                  isOpen={true}
                  onClose={() => { setUserActionTarget(null); setShowViewerAction(false) }}
                  targetUser={{
                    id: userActionTarget.userId,
                    username: userActionTarget.username || '',
                    avatar_url: userProfiles?.[userActionTarget.userId]?.avatar_url || '',
                    role: userActionTarget.role,
                  } as any}
                  targetUsername={userActionTarget.username || ''}
                  targetUserId={userActionTarget.userId}
                  streamId={streamId || ''}
                  hostId={hostId}
                  currentUserId={user?.id}
                />
              ) : showViewerAction ? (
                <ViewerUserActionModal
                  isOpen={true}
                  onClose={() => { setUserActionTarget(null); setShowViewerAction(false) }}
                  userId={userActionTarget.userId}
                  username={userActionTarget.username || ''}
                  avatarUrl={userProfiles?.[userActionTarget.userId]?.avatar_url || null}
                  streamId={streamId || ''}
                />
              ) : (
                <UserActionModal
                  onClose={() => { setUserActionTarget(null); setShowViewerAction(false) }}
                  userId={userActionTarget.userId}
                  streamId={streamId || ''}
                  username={userActionTarget.username}
                  role={userActionTarget.role}
                  createdAt={userActionTarget.createdAt}
                  isHost={false}
                  isModerator={isModerator}
                  isOfficer={isOfficer}
                  canArrestStaff={Boolean(modContext?.can_arrest)}
                  canSummon={Boolean(modContext?.can_summon)}
                  onGift={() => onGift(userActionTarget.userId)}
                />
              )
            )}

            {/* CityStatusPanel for clicking on broadcaster orb or seats */}
            {selectedSeatUserId && (
              <CityStatusPanel
                userId={selectedSeatUserId}
                onClose={() => setSelectedSeatUserId(null)}
                isBroadcaster={false}
                isBroadOfficer={isOfficer || isStreamBroadofficer}
                broadcasterId={hostId}
                isSeatHolder={false}
                onHouseClick={() => {
                  const targetUser = broadcasterCityStatus.data;
                  if (targetUser?.house_id && targetUser.id !== user?.id) {
                    setRaidTarget({ userId: targetUser.id, houseId: targetUser.house_id });
                  }
                }}
                onRaid={() => {
                  const targetUser = broadcasterCityStatus.data;
                  if (targetUser?.house_id && targetUser.id !== user?.id) {
                    setRaidTarget({ userId: targetUser.id, houseId: targetUser.house_id });
                  }
                }}
              />
            )}

            {/* Raid Panel */}
            {raidTarget && (
              <RaidPanel
                targetUserId={raidTarget.userId}
                targetHouseId={raidTarget.houseId}
                isOpen={!!raidTarget}
                onClose={() => setRaidTarget(null)}
                onRaidComplete={() => {
                  broadcasterCityStatus.refetch?.();
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Broadcast Text Popup Overlay */}
      <BroadcastTextPopupOverlay
        popup={activeTextPopup}
        isBattleActive={!!stream?.is_battle && !!stream?.battle_id}
        mobileSafe={isMobileViewer}
      />

       {showSubscribeModal && hostId && broadcasterProfile && (
         <SubscriptionTierSelector
           broadcasterId={hostId}
           broadcasterUsername={getDisplayName(broadcasterProfile, 'Broadcaster')}
           onClose={() => setShowSubscribeModal(false)}
           onSelect={(tierId) => {
             setShowSubscribeModal(false)
             const username = profile?.username || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
             pushFloatingSystemMessage(`${username} subscribed to ${hostName}`)
             setSubscriptionPopup({
               visible: true,
               broadcaster: hostName,
             })
           }}
         />
       )}

        {showViewerList && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowViewerList(false)}>
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-black text-white">Active Viewers</h3>
                <button onClick={() => setShowViewerList(false)} className="rounded-lg p-1 text-zinc-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {audience.length === 0 ? (
                  <p className="text-sm text-zinc-500">No active viewers</p>
                ) : (
                  audience.filter(m => m.is_active && !m.left_at).map(member => {
                    const coins = member.gift_total ?? 0
                    const coinLabel = coins >= 1_000_000
                      ? `${(coins / 1_000_000).toFixed(1)}M Coins`
                      : coins >= 1_000
                        ? `${(coins / 1_000).toFixed(1)}K Coins`
                        : `${coins} Coins`
                    return (
                      <div key={member.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold">
                          {member.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-white">{member.username || 'Viewer'}</div>
                          <div className="text-xs text-zinc-500">{member.role || 'audience'}</div>
                          <div className="text-[11px] font-black text-cyan-300">{coinLabel}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {isPaidChatModalOpen && (
         <PaidChatViewerModal
           isOpen={isPaidChatModalOpen}
           onClose={() => setIsPaidChatModalOpen(false)}
           streamId={streamId}
           hostId={hostId}
           pricePerUser={paidChatPricePerUser}
           pricePerChat={paidChatPricePerChat}
           isChatEnabled={isPaidChatEnabled}
           isChatLocked={hostChatDisabledByOfficer}
         />
       )}

      {/* Mini Message Popup */}
      <AnimatePresence>
        {isMessagePopupOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 right-4 z-[60] w-[360px] max-h-[480px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-black text-white">Messages</h3>
              <button
                onClick={() => { setIsMessagePopupOpen(false); setSelectedThread(null) }}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {!selectedThread ? (
                <div className="p-2">
                  {recentThreads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-500">No messages yet</div>
                  ) : (
                    recentThreads.map((thread: any) => {
                      const other = thread.other_username || 'Unknown'
                      const last = thread.last_message?.body || 'No messages yet'
                      const time = thread.last_message?.sent_at
                        ? new Date(thread.last_message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThread(thread)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{other}</p>
                            <p className="truncate text-xs text-zinc-400">{last}</p>
                            {time && <p className="mt-1 text-[10px] text-zinc-500">{time}</p>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="flex h-[420px] flex-col">
                  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
                    <button
                      onClick={() => setSelectedThread(null)}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <p className="truncate text-sm font-bold text-white">
                      {selectedThread.other_username || 'Chat'}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {messagesLoading ? (
                      <div className="py-8 text-center text-xs text-zinc-500">Loading...</div>
                    ) : threadMessages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">No messages yet</div>
                    ) : (
                      <div className="space-y-2">
                        {threadMessages.map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`rounded-xl px-3 py-2 text-xs ${
                              msg.sender_id === user?.id
                                ? 'ml-8 bg-cyan-500/20 text-cyan-100'
                                : 'mr-8 bg-white/5 text-zinc-200'
                            }`}
                          >
                            <p className="mb-0.5 text-[10px] font-bold text-zinc-400">
                              {msg.sender_username || 'Unknown'}
                            </p>
                            <p>{msg.body}</p>
                            <p className="mt-1 text-[10px] text-zinc-500">
                              {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const input = (e.target as any).message as HTMLInputElement
                      const body = input.value.trim()
                      if (!body || !selectedThread || !user?.id) return
                      try {
                        await sendMessage({
                          senderId: user.id,
                          senderMail: user.email || '',
                          recipientId: selectedThread.other_user_id,
                          body,
                        })
                        input.value = ''
                        const msgs = await getThreadMessages(selectedThread.id)
                        setThreadMessages(msgs)
                      } catch (err) {
                        console.error('[ViewerPage] send message error:', err)
                        toast.error('Failed to send message')
                      }
                    }}
                    className="flex gap-2 border-t border-white/10 p-3"
                  >
                    <input
                      name="message"
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-cyan-400/30 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </ErrorBoundary>
  </GiftSystemProvider>
)
}

export default ViewerPage






