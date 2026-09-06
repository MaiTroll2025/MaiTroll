import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Gift,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  Radio,
  Share2,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react'

import {
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
} from 'livekit-client'

import {
  useAuthStore,
} from '@/lib/store'

import {
  supabase,
} from '@/lib/supabase'
import { awardInvitePoint } from '@/lib/weeklyPointsService'

import type {
  Stream,
} from '@/types/broadcast'
import type { BroadcastGift } from '@/hooks/useBroadcastRealtime'

import {
  useLiveKitRoom,
} from '@/hooks/useLiveKitRoom'

import {
  useStreamSeats,
} from '@/hooks/useStreamSeats'

import {
  useStreamAudiencePresence,
  type StreamAudienceMember,
} from '@/hooks/useStreamAudiencePresence'

import {
  useStreamRealtime,
} from '@/hooks/useStreamRealtime'

import {
  GiftSystemProvider,
} from '@/lib/hooks/useGiftSystem'
import UndoRecentGiftBar from '@/components/broadcast/UndoRecentGiftBar'
import { useTargetedGiftQueue, type StreamGiftEvent } from '@/hooks/useTargetedGiftQueue'
import { sendChatThroughGate } from '@/lib/sendChatThroughGate'
import { hydrateGiftForOverlay } from '@/lib/gifts'
import { getGiftVisualConfig } from '@/lib/giftVisuals'

import MobileAudienceTicker from '@/components/broadcast/MobileAudienceTicker'
import CityStatusOrb from '@/components/city/CityStatusOrb'
import SeatCityStatusOrb from '@/components/broadcast/SeatCityStatusOrb'
import CityStatusPanel from '@/components/city/CityStatusPanel'
import RaidModal from '@/components/city/RaidModal'
import PhoneGiftModal from '@/phone/components/PhoneGiftModal'
import MaiBag from '@/components/mai-bag/MaiBag'
import ShareModal from '@/components/broadcast/ShareModal'

import {
  useCityStatusOrb,
} from '@/lib/hooks/useCityStatusOrb'

import {
  getLiveKitRoomName,
} from '@/lib/liveUtils'

import {
  sendStreamBroadcast,
} from '@/lib/realtime/streamRealtimeManager'

import {
  isValidUuid,
} from '@/lib/courtUtils'

import {
  cn,
} from '@/lib/utils'

import {
  hasModActionsAccess,
} from '@/types/moderationActions'

import {
  getAnonymousDisplayName,
  isAnonymousDisplayName,
} from '@/lib/anonymousIdentity'

import {
  toast,
} from 'sonner'

import ErrorBoundary from '@/components/ErrorBoundary'
import BattleView from '@/pages/broadcast/BattleView'
import GiftVideoOverlay from '@/components/broadcast/GiftVideoOverlay'
import UserActionModal from '@/components/broadcast/UserActionModal'
import { useFeaturedLive } from '@/hooks/useFeaturedLive'
import { FeaturedBanner } from '@/components/featured/FeaturedBanner'
import { FeaturedLeaderboard } from '@/components/featured/FeaturedLeaderboard'
import { FeaturedLiveOverlay } from '@/components/featured/FeaturedLiveOverlay'
import ViewerUserActionModal from '@/components/broadcast/ViewerUserActionModal'
import ModActionsPopup from '@/components/broadcast/ModActionsPopup'
import CashoutProgressBanner from '@/components/broadcast/CashoutProgressBanner'
import MiniMaiPayCashoutModal from '@/components/broadcast/MiniMaiPayCashoutModal'
import { useCashoutBanner } from '@/hooks/useCashoutBanner'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import FeaturedGiftBanner from '@/components/broadcast/FeaturedGiftBanner'

interface SeatState {
  participant: any
  videoTrack: RemoteVideoTrack | null
  audioTrack: any
  isLoading: boolean
  userId: string | null
}

interface BroadcasterState {
  participant: any
  videoTrack: RemoteVideoTrack | null
  audioTrack: any
}

interface PhoneSeatCard {
  seatIndex: number
  seat: any
  userId: string | null
  identity: string | null
  displayName: string
  isOccupied: boolean
  isMine: boolean
  isLocked: boolean
  canJoin: boolean
  seatPrice: number
}

/* ============================================================================
   KICK BAN HELPERS
============================================================================ */

const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000

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

/* ============================================================================
   HELPERS
============================================================================ */

function getDisplayName(
  profile: any,
  fallback = 'Broadcaster',
) {
  return (
    profile?.username ||
    profile?.email?.split?.('@')?.[0] ||
    fallback
  )
}

function getParticipantIdentity(
  participant: any,
): string {
  return String(
    participant?.identity ||
      participant?.participantIdentity ||
      participant?.name ||
      participant?.metadata?.user_id ||
      participant?.metadata?.userId ||
      '',
  )
}

function getParticipantMetadata(
  participant: any,
): any {
  const raw = participant?.metadata

  if (!raw) return {}

  if (typeof raw === 'object') {
    return raw
  }

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function normalizeUuid(value: unknown): string | null {
  const text = String(value || '').trim().toLowerCase()
  const match = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  return match?.[0]?.toLowerCase() || null
}

function resolveSeatParticipant(
  seat: any,
  participants: any[],
  room: any,
) {
  const seatUserId =
    seat?.user_id ||
    seat?.guest_id ||
    null

  const storedIdentity =
    String(
      seat?.livekit_participant_identity ||
        seat?.participant_identity ||
        seat?.livekit_identity ||
        seat?.seat_identity ||
        '',
    ).trim()

  const check = (participant: any) => {
    const participantIdentity =
      String(
        participant?.identity ||
          participant?.participantIdentity ||
          participant?.name ||
          '',
      ).trim()

    const metadata =
      getParticipantMetadata(participant)

    const participantUuid =
      normalizeUuid(participantIdentity)
    const metadataUuid =
      normalizeUuid(
        metadata.user_id ||
          metadata.userId ||
          metadata.uid,
      )
    const seatUuid =
      normalizeUuid(seatUserId)

    if (
      storedIdentity &&
      participantIdentity === storedIdentity
    ) {
      return true
    }

    if (
      storedIdentity &&
      participantUuid &&
      participantUuid === normalizeUuid(storedIdentity)
    ) {
      return true
    }

    if (
      seatUuid &&
      participantUuid &&
      participantUuid === seatUuid
    ) {
      return true
    }

    if (
      seatUuid &&
      metadataUuid &&
      metadataUuid === seatUuid
    ) {
      return true
    }

    if (
      !storedIdentity &&
      seatUserId &&
      (
        participantIdentity ===
          String(seatUserId) ||
        participantIdentity.endsWith(
          `-${seatUserId}`,
        ) ||
        participantIdentity.startsWith(
          `${seatUserId}-`,
        )
      )
    ) {
      return true
    }

    return false
  }

  let match =
    participants.find(check)

  if (
    !match &&
    room?.remoteParticipants
  ) {
    match =
      Array.from(
        room.remoteParticipants.values(),
      ).find(check)
  }

  return match || null
}

function participantMatchesUser(
  participant: any,
  userId?: string | null,
) {
  if (!participant || !userId) {
    return false
  }

  const identity =
    getParticipantIdentity(participant)

  const metadata =
    getParticipantMetadata(participant)

  return (
    identity === userId ||
    identity.includes(userId) ||
    identity.endsWith(`-${userId}`) ||
    identity.startsWith(`${userId}-`) ||
    metadata.user_id === userId ||
    metadata.userId === userId
  )
}

function getVideoTrackFromParticipant(
  participant: any,
): RemoteVideoTrack | null {
  if (!participant) {
    return null
  }

  const directCandidates = [
    participant.videoTrack,
    participant.cameraTrack,
    participant.track,
    participant.video,
  ]

  for (const candidate of directCandidates) {
    if (
      candidate?.attach &&
      candidate?.kind === Track.Kind.Video
    ) {
      return candidate as RemoteVideoTrack
    }

    if (
      candidate?.attach &&
      candidate?.mediaStreamTrack?.kind === 'video'
    ) {
      return candidate as RemoteVideoTrack
    }
  }

  const publications: RemoteTrackPublication[] = []

  const collect = (value: any) => {
    if (!value) return

    if (typeof value.values === 'function') {
      publications.push(
        ...Array.from(
          value.values(),
        ) as RemoteTrackPublication[],
      )
      return
    }

    if (Array.isArray(value)) {
      publications.push(...value)
    }
  }

  collect(participant.videoTrackPublications)
  collect(participant.trackPublications)
  collect(participant.tracks)
  collect(participant.publications)

  const cameraPub =
    publications.find(
      (pub: any) =>
        pub?.source === Track.Source.Camera &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.source !== Track.Source.Microphone &&
        pub?.kind === Track.Kind.Video &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.kind === Track.Kind.Video &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.track?.kind === Track.Kind.Video &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.track?.mediaStreamTrack?.kind === 'video' &&
        pub?.track?.attach,
    )

  return (
    cameraPub?.track as RemoteVideoTrack
  ) || null
}

function getAudioTrackFromParticipant(
  participant: any,
) {
  if (!participant) {
    return null
  }

  const publications: any[] = []

  const collect = (value: any) => {
    if (!value) return

    if (typeof value.values === 'function') {
      publications.push(
        ...Array.from(value.values()),
      )
      return
    }

    if (Array.isArray(value)) {
      publications.push(...value)
    }
  }

  collect(participant.audioTrackPublications)
  collect(participant.trackPublications)
  collect(participant.tracks)
  collect(participant.publications)

  const audioPub =
    publications.find(
      (pub: any) =>
        pub?.source === Track.Source.Microphone &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.kind === Track.Kind.Audio &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.track?.kind === Track.Kind.Audio &&
        pub?.track?.attach,
    ) ||
    publications.find(
      (pub: any) =>
        pub?.track?.mediaStreamTrack?.kind === 'audio' &&
        pub?.track?.attach,
    )

  return audioPub?.track || null
}

function getSeatPrice(
  stream: Stream | null,
  index: number,
) {
  if (!stream) {
    return 0
  }

  if (
    Array.isArray(
      (stream as any).seat_prices,
    ) &&
    typeof (stream as any).seat_prices[index] === 'number'
  ) {
    return Number(
      (stream as any).seat_prices[index],
    )
  }

  return Number(
    (stream as any).seat_price ?? 0,
  )
}

/* ============================================================================
   REMOTE VIDEO
============================================================================ */

const PhoneRemoteVideo = memo(
  function PhoneRemoteVideo({
    participant,
    room,
    className,
    fallback,
    mirror = false,
  }: {
    participant: any
    room?: any
    className?: string
    fallback: React.ReactNode
    mirror?: boolean
  }) {
    const videoRef =
      useRef<HTMLVideoElement | null>(null)

    const audioRef =
      useRef<HTMLAudioElement | null>(null)

    const attachedVideoRef =
      useRef<RemoteVideoTrack | null>(null)

    const attachedAudioIdRef =
      useRef<string | null>(null)

    const [trackTick, setTrackTick] =
      useState(0)

    const participantIdentityRef =
      useRef<string>('')

    participantIdentityRef.current =
      String(
        participant?.identity ||
          participant?.participantIdentity ||
          participant?.name ||
          '',
      ).trim()

    useEffect(() => {
      if (!room) return

      const identity =
        participantIdentityRef.current

      if (!identity) return

      const bump = () => {
        setTrackTick(
          value => value + 1,
        )
      }

      const handleTrackSubscribed = (
        _track: any,
        _publication: any,
        participant: any,
      ) => {
        const pIdentity =
          String(
            participant?.identity ||
              participant?.participantIdentity ||
              participant?.name ||
              '',
          ).trim()

        if (pIdentity === identity) {
          bump()
        }
      }

      const handleTrackUnsubscribed = (
        _track: any,
        _publication: any,
        participant: any,
      ) => {
        const pIdentity =
          String(
            participant?.identity ||
              participant?.participantIdentity ||
              participant?.name ||
              '',
          ).trim()

        if (pIdentity === identity) {
          bump()
        }
      }

      const handleParticipantConnected = (
        participant: any,
      ) => {
        const pIdentity =
          String(
            participant?.identity ||
              participant?.participantIdentity ||
              participant?.name ||
              '',
          ).trim()

        if (pIdentity === identity) {
          bump()
        }
      }

      const handleParticipantDisconnected = (
        participant: any,
      ) => {
        const pIdentity =
          String(
            participant?.identity ||
              participant?.participantIdentity ||
              participant?.name ||
              '',
          ).trim()

        if (pIdentity === identity) {
          bump()
        }
      }

      room.on(
        RoomEvent.TrackSubscribed,
        handleTrackSubscribed,
      )

      room.on(
        RoomEvent.TrackUnsubscribed,
        handleTrackUnsubscribed,
      )

      room.on(
        RoomEvent.ParticipantConnected,
        handleParticipantConnected,
      )

      room.on(
        RoomEvent.ParticipantDisconnected,
        handleParticipantDisconnected,
      )

      return () => {
        room.off(
          RoomEvent.TrackSubscribed,
          handleTrackSubscribed,
        )

        room.off(
          RoomEvent.TrackUnsubscribed,
          handleTrackUnsubscribed,
        )

        room.off(
          RoomEvent.ParticipantConnected,
          handleParticipantConnected,
        )

        room.off(
          RoomEvent.ParticipantDisconnected,
          handleParticipantDisconnected,
        )
      }
    }, [room])

    const videoTrack =
      getVideoTrackFromParticipant(
        participant,
      )

    const audioTrack =
      getAudioTrackFromParticipant(
        participant,
      )

    const videoTrackId =
      videoTrack?.mediaStreamTrack?.id ||
      videoTrack?.sid ||
      null

    const audioTrackId =
      audioTrack?.mediaStreamTrack?.id ||
      audioTrack?.sid ||
      null

    useEffect(() => {
      const video =
        videoRef.current

      if (!video) return

      const previous =
        attachedVideoRef.current

      const previousId =
        previous?.mediaStreamTrack?.id ||
        previous?.sid ||
        null

      if (previous && previousId) {
        if (
          videoTrackId &&
          previousId ===
            videoTrackId
        ) {
          return
        }

        if (!videoTrackId) {
          return
        }

        try {
          previous.detach(video)
        } catch {
          // ignore
        }

        attachedVideoRef.current = null
      }

      if (!videoTrack) {
        video.srcObject = null
        return
      }

      let cancelled = false

      const attach = async () => {
        try {
          video.autoplay = true
          video.playsInline = true
          video.muted = true

          video.setAttribute(
            'playsinline',
            '',
          )

          video.setAttribute(
            'webkit-playsinline',
            '',
          )

          videoTrack.attach(video)

          attachedVideoRef.current =
            videoTrack

          if (!cancelled) {
            await video.play()
          }
        } catch (error) {
          console.warn(
            '[PhoneViewerPage] remote video attach failed',
            error,
          )
        }
      }

      void attach()

      return () => {
        cancelled = true

        try {
          videoTrack.detach(video)
        } catch {
          // ignore
        }

        if (
          attachedVideoRef.current ===
          videoTrack
        ) {
          attachedVideoRef.current =
            null
        }
      }
    }, [
      videoTrackId,
      trackTick,
    ])

    useEffect(() => {
      const audio =
        audioRef.current

      if (!audio) return

      if (
        audioTrackId ===
        attachedAudioIdRef.current
      ) {
        return
      }

      if (audioTrack) {
        try {
          audioTrack.attach(audio)

          audio.autoplay = true

          audio.play().catch(
            () => {},
          )
        } catch {
          // ignore
        }
      }

      attachedAudioIdRef.current =
        audioTrackId
    }, [
      audioTrack,
      audioTrackId,
      trackTick,
    ])

    return (
      <div
        className={cn(
          'relative h-full w-full overflow-hidden bg-black',
          className,
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          disablePictureInPicture
          className={cn('absolute inset-0 h-full w-full object-cover', mirror && '-scale-x-100')}
        />

        <audio
          ref={audioRef}
          autoPlay
        />

        {!videoTrack &&
          !attachedVideoRef.current && (
            <div className="absolute inset-0">
              {fallback}
            </div>
          )}
      </div>
    )
  },
)

/* ============================================================================
   LOCAL VIDEO
============================================================================ */

function PhoneLocalVideo({
  videoTrack,
  className,
}: {
  videoTrack: LocalVideoTrack | null
  audioTrack?: LocalAudioTrack | null
  className?: string
}) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video =
      videoRef.current

    if (!video || !videoTrack) {
      return
    }

    try {
      videoTrack.attach(video)

      video.play().catch(
        () => {},
      )
    } catch {
      // ignore
    }

    return () => {
      try {
        videoTrack.detach(video)
      } catch {
        // ignore
      }
    }
  }, [videoTrack])

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-black',
        className,
      )}
    >
        {videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover -scale-x-100"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <VideoOff className="h-6 w-6 text-white/40" />
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   PHONE VIEWER
============================================================================ */

export default function PhoneViewerPage() {
  const params =
    useParams()

  const navigate =
    useNavigate()

  const streamId =
    params.streamId ||
    params.id ||
    ''

  const {
    user,
    profile,
  } = useAuthStore()

  const [stream, setStream] =
    useState<Stream | null>(null)

  const {
    featuredBroadcasters,
    featuredEvent,
    isFeaturedEvent,
    currentStreamFeatured,
    leaderboardOpen,
    openFeaturedLeaderboard,
    closeFeaturedLeaderboard,
  } = useFeaturedLive({
    streamId: streamId || stream?.id || null,
    enabled: !!(streamId || stream?.id),
  })

  const hostId =
    stream?.user_id || ''
  

  const [
    broadcasterProfile,
    setBroadcasterProfile,
  ] = useState<any>(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [viewerError, setViewerError] =
    useState<string | null>(null)

  const [showControls, setShowControls] =
    useState(true)

  const [floatingMessages, setFloatingMessages] =
    useState<Array<{id: string, username: string, content: string, timestamp: number, isSystem?: boolean}>>([])

  const [blockedUsernames, setBlockedUsernames] =
    useState<Set<string>>(new Set())

  const [chatInput, setChatInput] =
    useState('')

  const [viewerCount, setViewerCount] =
    useState(0)

  const [liked, setLiked] =
    useState(false)

  const [
    tapIndicators,
    setTapIndicators,
  ] = useState<Array<{
    id: string
    x: number
    y: number
  }>>([])

  const [seatFocus, setSeatFocus] =
    useState<number | null>(null)

  const [
    giftRecipientId,
    setGiftRecipientId,
  ] = useState<string | null>(null)

  const [
    isGiftModalOpen,
    setIsGiftModalOpen,
  ] = useState(false)

  const [
    isShareModalOpen,
    setIsShareModalOpen,
  ] = useState(false)

  const [
    isCashoutModalOpen,
    setIsCashoutModalOpen,
  ] = useState(false)

  const [
    userActionTarget,
    setUserActionTarget,
  ] = useState<{
    userId: string
    username?: string
    role?: string
    createdAt?: string
  } | null>(null)

  const [
    showViewerAction,
    setShowViewerAction,
  ] = useState(false)

  const [
    showModActionMenu,
    setShowModActionMenu,
  ] = useState(false)

  const [
    selectedSeatUserId,
    setSelectedSeatUserId,
  ] = useState<string | null>(null)

  const [
    broadcastRaidTarget,
    setBroadcastRaidTarget,
  ] = useState<string | null>(null)

  const [recentGifts, setRecentGifts] =
    useState<BroadcastGift[]>([])

  const processedGiftIdsRef =
    useRef<Set<string>>(new Set())

  const recentChatKeysRef =
    useRef<Map<string, number>>(new Map())

  const processedMessageIdsRef =
    useRef<Set<string>>(new Set())

  const floatingChatChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  const { enqueueGift } = useTargetedGiftQueue()

  const streamEndedRef =
    useRef(false)

  const hasJoinedAudienceRef =
    useRef(false)

  const joiningAudienceRef =
    useRef(false)

  const currentRoomKeyRef =
    useRef<string | null>(null)

  const viewerIdentityRef =
    useRef<string>('')

  const joiningPublisherRef =
    useRef(false)

  const audienceJoinAttemptedKeyRef =
    useRef<string | null>(null)

  const audienceFailedUntilRef =
    useRef<number>(0)

  /*
   * ========================================================================
   * BATTLE STATE
   *
   * The viewer remains in the normal broadcast room.
   *
   * A battle is considered active when the stream receives a battle_id.
   * When battle_id becomes empty/null, the BattleArena disappears and the
   * normal broadcast automatically becomes visible again.
   * ========================================================================
   */

  const battleId = useMemo(() => {
    const value =
      (stream as any)?.battle_id ??
      (stream as any)?.battleId ??
      ''

    return String(value || '')
  }, [stream])

  const [
    battleActive,
    setBattleActive,
  ] = useState(Boolean(battleId))

  const previousBattleIdRef =
    useRef<string>('')

  useEffect(() => {
    const nextBattleId =
      String(battleId || '')

    const previousBattleId =
      previousBattleIdRef.current

    setBattleActive(
      Boolean(nextBattleId),
    )

    /*
     * Battle transition.
     */
    if (
      nextBattleId &&
      nextBattleId !== previousBattleId
    ) {
      previousBattleIdRef.current =
        nextBattleId

      setShowControls(false)

      /*
       * Keep chat and broadcast alive underneath
       * the battle. BattleArena owns the battle
       * experience.
       */
      return
    }

    /*
     * Battle ended.
     */
    if (
      !nextBattleId &&
      previousBattleId
    ) {
      previousBattleIdRef.current =
        ''

      setBattleActive(false)
      setShowControls(true)

      toast.success(
        'Battle ended',
      )
    }
  }, [battleId])

  /*
   * Stable anonymous viewer identity.
   */
  const anonViewerId =
    useMemo(() => {
      if (!streamId) return ''

      if (
        typeof window ===
        'undefined'
      ) {
        return ''
      }

      const key =
        `guest-viewer:${streamId}`

      try {
        const existing =
          window.sessionStorage.getItem(
            key,
          )

        if (existing) {
          return existing
        }

        const cryptoObj =
          (window as any).crypto

        let id = ''

        if (
          cryptoObj &&
          typeof cryptoObj.randomUUID ===
            'function'
        ) {
          id =
            `guest-viewer:${streamId}:${cryptoObj.randomUUID()}`
        } else {
          id =
            `guest-viewer:${streamId}:${Math.random()
              .toString(36)
              .slice(2, 12)}`
        }

        window.sessionStorage.setItem(
          key,
          id,
        )

        return id
      } catch {
        return (
          `guest-viewer:${streamId}:${Math.random()
            .toString(36)
            .slice(2, 12)}`
        )
      }
    }, [streamId])

  const anonDisplayName =
    useMemo(
      () =>
        streamId
          ? getAnonymousDisplayName()
          : '',
      [streamId],
    )

  const viewerIdentity =
    useMemo(() => {
      const effectiveId =
        user?.id ||
        anonViewerId

      if (
        !streamId ||
        !effectiveId
      ) {
        return ''
      }

      return (
        `viewer-${streamId}-${effectiveId}`
      )
    }, [
      streamId,
      user?.id,
      anonViewerId,
    ])

  useEffect(() => {
    viewerIdentityRef.current = viewerIdentity
  }, [viewerIdentity])

  /* ========================================================================
     LOAD STREAM
  ======================================================================== */

  useEffect(() => {
    let cancelled = false

    if (!streamId) {
      setError(
        'Missing stream ID',
      )

      setLoading(false)

      return
    }

    const loadStream =
      async () => {
        setLoading(true)
        setError(null)

        try {
          let streamQuery = supabase
            .from('streams')
            .select('*')

          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(streamId)
          let data: any = null
          let streamError: any = null

          if (isUuid) {
            const result = await streamQuery.eq('id', streamId).maybeSingle()
            data = result.data
            streamError = result.error
          } else {
            const { data: owner, error: ownerError } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('username', streamId)
              .maybeSingle()

            if (ownerError) {
              streamError = ownerError
            } else if (owner?.id) {
              const result = await streamQuery
                .eq('user_id', owner.id)
                .eq('is_live', true)
                .eq('status', 'live')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
              data = result.data
              streamError = result.error
            }
          }

            if (cancelled) return

            if (streamError) {
              console.error(
                '[PhoneViewerPage] stream lookup failed',
                streamError,
              )

              setError(
                streamError.message ||
                  'Unable to load stream',
              )

              setStream(null)

              return
            }

            if (!data) {
              setError(
                'Stream not found',
              )

              setStream(null)

              return
            }

            setStream(
              data as Stream,
            )
        } catch (err) {
          if (cancelled) return

          console.error(
            '[PhoneViewerPage] stream lookup failed',
            err,
          )

          setError(
            'Unable to load stream',
          )

          setStream(null)
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

    void loadStream()

    return () => {
      cancelled = true
    }
  }, [streamId])

  /* ========================================================================
     REALTIME STREAM UPDATES
  ======================================================================== */

  useEffect(() => {
    if (!streamId) {
      return
    }

    const streamEndedRef = {
      current: false,
    }

    const channel =
      supabase
        .channel(
          `phone-viewer-stream:${streamId}`,
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'streams',
            filter: `id=eq.${streamId}`,
          },
          payload => {
            const next =
              payload.new || {}

            /*
             * IMPORTANT:
             * Merge the realtime row into local stream state.
             *
             * This is what makes battle_id immediately available
             * when the broadcaster starts a battle.
             */
            setStream(
              previous => ({
                ...(previous || {}),
                ...next,
              } as Stream),
            )

            const status =
              String(
                next.status || '',
              ).toLowerCase()

            const endedAt =
              next.ended_at ||
              next.endedAt

            if (
              status === 'ended' ||
              endedAt
            ) {
              if (
                streamEndedRef.current
              ) {
                return
              }

              streamEndedRef.current =
                true

                void (async () => {
                  try {
                    await leaveAudience()
                  } catch {
                    // ignore
                  }

                  navigate(
                    `/broadcast/summary/${streamId}`,
                    { replace: true },
                  )
                })()
            }
          },
        )
        .subscribe()

    return () => {
      void supabase.removeChannel(
        channel,
      )
    }
  }, [
    streamId,
    navigate,
  ])

  /* ========================================================================
      BROADCASTER PROFILE
   ======================================================================== */

  useEffect(() => {
    const broadcasterId =
      stream?.user_id

    if (!broadcasterId) {
      setBroadcasterProfile(
        null,
      )

      return
    }

    let cancelled = false

    const loadProfile =
      async () => {
        const {
          data,
          error: profileError,
        } = await supabase
          .from('user_profiles')
          .select('*')
          .eq(
            'id',
            broadcasterId,
          )
          .maybeSingle()

        if (cancelled) {
          return
        }

        if (profileError) {
          console.warn(
            '[PhoneViewerPage] broadcaster profile failed',
            profileError,
          )

          return
        }

        setBroadcasterProfile(
          data || null,
        )
      }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [stream?.user_id])

  /* ========================================================================
     CHAT MESSAGES (FLYING CHAT)
   ======================================================================== */

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(
      `stream:${streamId}`,
    )

    channel.on(
      'broadcast',
      { event: 'chat_message' },
      (payload) => {
        const chatData =
          payload.payload || {}

        const text =
          chatData.text ||
          chatData.content ||
          ''

        if (!text) return

        const username =
          chatData.username || 'Viewer'

        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        setFloatingMessages((previous) =>
          [{ id: msgId, username, content: text, timestamp: Date.now() }, ...previous].slice(0, 50),
        )

        setTimeout(() => {
          setFloatingMessages((previous) =>
            previous.filter((m) => m.id !== msgId),
          )
        }, 8000)
      },
    )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(
        channel,
      )
    }
  }, [streamId])

   const canClickFloatingChatUsername =
     hasModActionsAccess(profile)

   const handleOpenUserAction = useCallback(
     async (info: {
       userId: string
       username?: string
       role?: string
       createdAt?: string
     }) => {
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
           setShowModActionMenu(canClickFloatingChatUsername)
           setShowViewerAction(!canClickFloatingChatUsername)
           return
         }
         toast.error('Invalid user identifier')
         return
       }

       try {
         const { data, error } = await supabase
           .from('user_profiles')
           .select(
             'id, username, role, troll_role, avatar_url',
           )
           .eq('id', normalizedUserId)
           .maybeSingle()

         if (error || !data?.id) {
           console.error(
             '[MOD TARGET RESOLUTION] Profile not found for UUID:',
             normalizedUserId,
             error,
           )
           toast.error(
             'MaiTroll profile could not be resolved for this participant.',
           )
           return
         }

         setUserActionTarget({
           userId: data.id,
           username: data.username || normalizedUsername,
           role: data.role || data.troll_role || info.role,
           createdAt: info.createdAt,
         })
         setShowModActionMenu(canClickFloatingChatUsername)
         setShowViewerAction(!canClickFloatingChatUsername)
       } catch (err) {
         console.error(
           '[PhoneViewerPage] Error opening user action:',
           err,
         )
         toast.error('Failed to open user profile')
       }
     },
     [canClickFloatingChatUsername],
   )

   const handleOpenFloatingChatUsername = useCallback(
     async (username: string) => {
       if (!username) return

       if (isAnonymousDisplayName(username)) {
         if (!canClickFloatingChatUsername) return
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
         console.error(
           '[PhoneViewerPage] Error opening floating chat username:',
           err,
         )
         toast.error('Failed to open user profile')
       }
     },
     [canClickFloatingChatUsername, handleOpenUserAction],
   )

   /* ========================================================================
      SEATS
    ======================================================================== */

  const {
    seats,
    mySeat,
    joinSeat,
    leaveSeat,
    markSeatLive,
   } = useStreamSeats(
    streamId,
    user?.id,
    broadcasterProfile,
    stream as any,
  )

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

  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'ready' || stream?.battle_status === 'starting' || stream?.battle_status === 'active');

  const activeBattleId = shouldShowRandomBattleArena ? stream?.battle_id ?? null : null;

  /* ========================================================================
      AUDIENCE
  ======================================================================== */

  const {
    activeAudience,
    joinAudience,
    leaveAudience,
    heartbeatAudience,
  } =
    useStreamAudiencePresence(
      streamId,
      user?.id,
    )

  const cashoutBanner = useCashoutBanner({
    userId: user?.id,
    isEligible: !!mySeat,
    streamId: streamId || null,
  })

  const { pulling: pullRefreshing, pullY } = usePullToRefresh(
    () => window.location.reload(),
    !shouldShowRandomBattleArena,
  )

  const audienceWithAnon = useMemo(() => {
    if (user?.id || !anonViewerId)
      return activeAudience

    const anonMember: StreamAudienceMember = {
      id: `anon:${anonViewerId}`,
      stream_id: streamId || '',
      user_id: anonViewerId,
      username:
        anonDisplayName || 'Viewer',
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

    return [anonMember, ...activeAudience]
  }, [
    activeAudience,
    user?.id,
    anonViewerId,
    anonDisplayName,
    streamId,
  ])

  /* ========================================================================
     MAIN BROADCAST LIVEKIT
  ======================================================================== */

  const roomId =
    useMemo(() => {
      return String(
        getLiveKitRoomName(
          stream,
          streamId,
        ) || '',
      )
    }, [
      stream,
      streamId,
    ])

  const audienceName =
    useMemo(() => {
      if (user) {
        return (
          profile?.username ||
          (user as any)?.username ||
          'Viewer'
        )
      }

      return (
        anonDisplayName ||
        'Viewer'
      )
    }, [
      user,
      profile,
      anonDisplayName,
    ])

  const noop =
    useCallback(
      () => {},
      [],
    )

  const handleLiveKitError =
    useCallback(
      (err: any) => {
        console.warn(
          '[PhoneViewerPage] LiveKit error',
          err,
        )
      },
      [],
    )

  /*
   * This remains the broadcast LiveKit connection.
   *
   * DO NOT change this identity to the battle identity.
   */
  const {
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    room: liveKitRoom,
    isConnected,
    isPublishing,
    setMicEnabled,
    setCameraEnabled,
    leaveRoom: leaveLiveKitRoom,
    joinAsAudience,
    publishLocalTracks,
    unpublishLocalTracks,
  } = useLiveKitRoom({
    roomId,
    roomType: 'broadcast',
    role: 'viewer',
    publish: false,
    audioOnly: false,
    userName: audienceName,
    identity: viewerIdentity,
    onUserJoined: noop,
    onUserLeft: noop,
    onError: handleLiveKitError,
  })

  const remoteParticipants =
    useMemo(() => {
      return Array.isArray(
        remoteUsers,
      )
        ? remoteUsers
        : []
    }, [remoteUsers])

  /* ========================================================================
      LIVEKIT AUDIENCE JOIN
   ======================================================================== */

  useEffect(() => {
    if (!streamId || !stream || !roomId || !viewerIdentity) {
      return
    }

    if (viewerError) {
      return
    }

    if (hasJoinedAudienceRef.current || joiningAudienceRef.current) {
      return
    }

    const isActiveStatus =
      String(
        stream?.status || '',
      ).toLowerCase() === 'live'

    if (!isActiveStatus) {
      return
    }

    joiningAudienceRef.current = true

    let mounted = true

    void joinAsAudience({
      userId: viewerIdentity,
      streamId,
      roomName: roomId,
      viewerIdentity,
      publishCapable: false,
    })
      .then((res: any) => {
          if (!mounted) return

          if (typeof res !== 'string') {
            hasJoinedAudienceRef.current = true
            setViewerError(null)
            currentRoomKeyRef.current = `${streamId}:${roomId}`
          } else {
            setViewerError(res)
          }
        })
        .catch((err: any) => {
          if (!mounted) return

          const message =
            err?.message ||
            err?.statusText ||
            String(err) ||
            'Failed to join broadcast'

          setViewerError(message)
        })
      .finally(() => {
        joiningAudienceRef.current = false
      })

    return () => {
      mounted = false
    }
   }, [
    streamId,
    stream,
    roomId,
    viewerIdentity,
    joinAsAudience,
    viewerError,
  ])

  /* ========================================================================
      KICK GUARD — 24hr ban after kick
   ======================================================================== */

  useEffect(() => {
    if (!streamId || !user?.id) return

    const kickKey = getKickStorageKey(streamId, user.id)

    const enforceKickBan = () => {
      const kickRaw = localStorage.getItem(kickKey)
      const kickData = parseKickData(kickRaw)

      if (isKickBanActive(kickData)) {
        const remainingMs = Math.max(KICK_BAN_DURATION_MS - (Date.now() - kickData.timestamp), 0)
        const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))

        void leaveAudience()
        void leaveLiveKitRoom().catch(() => {})

        hasJoinedAudienceRef.current = false
        joiningAudienceRef.current = false
        currentRoomKeyRef.current = null

        toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)

        navigate('/', { replace: true })
      } else if (kickRaw) {
        localStorage.removeItem(kickKey)
      }
    }

    enforceKickBan()

    const channel = supabase
      .channel(`stream-kicks:${streamId}:${user.id}`)
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
          if (!kick) return

          const kickTimestamp = new Date(kick.created_at).getTime()
          const timeSinceKick = Date.now() - kickTimestamp

          if (timeSinceKick < KICK_BAN_DURATION_MS) {
            const remainingMs = Math.max(KICK_BAN_DURATION_MS - timeSinceKick, 0)
            const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))

            localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId,
              reason: kick.reason || 'Kicked by moderator',
            }))

            void leaveAudience()
            void leaveLiveKitRoom().catch(() => {})

            hasJoinedAudienceRef.current = false
            joiningAudienceRef.current = false
            currentRoomKeyRef.current = null

            toast.error(`You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)

            navigate('/', { replace: true })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [streamId, user?.id, navigate, leaveAudience, leaveLiveKitRoom])

  /* ========================================================================
      STREAM REALTIME
   ======================================================================== */

  const processGiftEvent = useCallback(async (rawGift: any) => {
    if (!rawGift) return

    const animationId = String(rawGift.id || rawGift.stream_gift_id || rawGift.gift_transaction_id || '')
    if (!animationId) return

    if (processedGiftIdsRef.current.has(animationId)) return
    processedGiftIdsRef.current.add(animationId)
    window.setTimeout(() => processedGiftIdsRef.current.delete(animationId), 12_000)

    const enrichedGiftData = await hydrateGiftForOverlay(rawGift)

    const resolvedMedia =
      enrichedGiftData?.animation_url ||
      enrichedGiftData?.animation_url_webm ||
      enrichedGiftData?.animation_url_mp4 ||
      enrichedGiftData?.animation_url_mov ||
      enrichedGiftData?.video_url ||
      enrichedGiftData?.metadata?.animation_url ||
      enrichedGiftData?.metadata?.animation_url_webm ||
      enrichedGiftData?.metadata?.animation_url_mp4 ||
      enrichedGiftData?.metadata?.animation_url_mov ||
      enrichedGiftData?.metadata?.video_url

    if (!resolvedMedia) return

    const resolvedGiftAmount = enrichedGiftData?.metadata?.coins_spent ||
      enrichedGiftData?.coins_spent ||
      enrichedGiftData?.amount ||
      1

    const resolvedGiftName = enrichedGiftData?.gift_name ||
      enrichedGiftData?.name ||
      enrichedGiftData?.metadata?.gift_name ||
      'Gift'

    const newGift: BroadcastGift = {
      id: animationId,
      gift_id: enrichedGiftData?.gift_id || '',
      gift_name: resolvedGiftName,
      gift_icon: enrichedGiftData?.gift_icon || enrichedGiftData?.metadata?.gift_icon || '🎁',
      gift_slug: enrichedGiftData?.gift_slug || enrichedGiftData?.metadata?.gift_slug,
      animation_key: enrichedGiftData?.animation_key || enrichedGiftData?.metadata?.animation_key,
      animation_type: enrichedGiftData?.animation_type || enrichedGiftData?.metadata?.animation_type || 'video',
      animation_url: resolvedMedia,
      video_url: resolvedMedia,
      animation_duration_ms: enrichedGiftData?.animation_duration_ms || enrichedGiftData?.metadata?.animation_duration_ms,
      sound_url: enrichedGiftData?.sound_url || enrichedGiftData?.metadata?.sound_url,
      is_fullscreen: enrichedGiftData?.is_fullscreen ?? enrichedGiftData?.metadata?.is_fullscreen,
      rarity: enrichedGiftData?.rarity || enrichedGiftData?.metadata?.rarity,
      tray_visual_url: enrichedGiftData?.tray_visual_url || enrichedGiftData?.metadata?.tray_visual_url,
      tray_gradient: enrichedGiftData?.tray_gradient || enrichedGiftData?.metadata?.tray_gradient,
      amount: resolvedGiftAmount,
      quantity: enrichedGiftData?.quantity || 1,
      sender_id: enrichedGiftData?.sender_id,
      sender_name: enrichedGiftData?.sender_name || enrichedGiftData?.metadata?.sender_name || 'Someone',
      receiver_id: enrichedGiftData?.receiver_id || hostId,
      receiver_name: enrichedGiftData?.receiver_name || enrichedGiftData?.metadata?.receiver_name,
      created_at: enrichedGiftData?.timestamp || enrichedGiftData?.created_at || new Date().toISOString(),
    }

    setRecentGifts((prev) => {
      if (prev.some((gift) => gift.id === animationId)) return prev
      return [...prev, newGift].slice(-20)
    })

    const streamGiftEvent: StreamGiftEvent = {
      id: animationId,
      stream_id: streamId || '',
      gift_id: enrichedGiftData?.gift_id || '',
      gift_name: resolvedGiftName,
      sender_user_id: enrichedGiftData?.sender_id || '',
      recipient_user_id: enrichedGiftData?.receiver_id || hostId || '',
      recipient_type: 'broadcaster',
      recipient_seat_index: null,
      animation_url: resolvedMedia || null,
      animation_url_webm: enrichedGiftData?.animation_url_webm || null,
      animation_url_mp4: enrichedGiftData?.animation_url_mp4 || null,
      animation_url_mov: enrichedGiftData?.animation_url_mov || null,
      animation_type: (newGift.animation_type || 'video') as StreamGiftEvent['animation_type'],
      animation_duration_ms: newGift.animation_duration_ms || 7000,
      sound_url: newGift.sound_url || null,
      created_at: newGift.created_at,
    }

    enqueueGift(streamGiftEvent)

    const giftDurationMs = newGift.animation_duration_ms ?? getGiftVisualConfig(newGift).durationMs
    window.setTimeout(() => {
      setRecentGifts((prev) => prev.filter((gift) => gift.id !== animationId))
    }, giftDurationMs + 150)
  }, [streamId, hostId, enqueueGift])

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
        if (existingTs !== undefined && now - existingTs < 1500) return
        recentChatKeysRef.current.set(chatKey, now)

        setFloatingMessages((prev) =>
          [{ id: msgId, username, content, timestamp: Date.now() }, ...prev].slice(0, 50)
        )

        window.setTimeout(() => {
          setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
        }, 30_000)
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
        if (event.eventType !== 'UPDATE' || !event.new || !streamId || !user?.id) {
          return
        }

        const participant = event.new
        if (participant.stream_id !== streamId || participant.removed !== true) {
          return
        }

        if (participant.user_id !== user.id) {
          return
        }

        kickProcessedRef.current = true

        void (async () => {
          try {
            if (isPublishing) {
              await unpublishLocalTracks()
            }
            await leaveAudience()
            await leaveLiveKitRoom()
          } catch {
            // ignore cleanup errors
          }

          localStorage.setItem(
            getKickStorageKey(streamId, user.id),
            JSON.stringify({
              timestamp: Date.now(),
              streamId,
              reason: participant.removed_reason || 'Kicked by broadcaster',
            }),
          )

          hasJoinedAudienceRef.current = false
          joiningAudienceRef.current = false
          currentRoomKeyRef.current = null
          toast.error('Removed from broadcast')
          navigate('/', { replace: true })
        })()
      },
      onAudiencePresence: (event: any) => {
        if (!streamId || !user?.id) return
        if (streamEndedRef.current) return

        const evtType = event.eventType
        const newRow = event.new
        const oldRow = event.old

        if (evtType === 'DELETE') {
          const deletedUserId = oldRow?.user_id
          if (deletedUserId && deletedUserId === user.id) {
            kickProcessedRef.current = true
            void (async () => {
              try {
                if (isPublishing) {
                  await unpublishLocalTracks()
                }
                await leaveAudience()
                await leaveLiveKitRoom()
              } catch {
                // ignore cleanup errors
              }

              localStorage.setItem(
                getKickStorageKey(streamId, user.id),
                JSON.stringify({
                  timestamp: Date.now(),
                  streamId,
                  reason: 'Removed from broadcast',
                }),
              )

              hasJoinedAudienceRef.current = false
              joiningAudienceRef.current = false
              currentRoomKeyRef.current = null
              toast.error('Removed from broadcast')
              navigate('/', { replace: true })
            })()
          }
          return
        }

        if (evtType === 'UPDATE' && newRow) {
          if (newRow.stream_id !== streamId) return
          if (newRow.user_id !== user.id) return
          if (newRow.is_active === false) {
            kickProcessedRef.current = true
            void (async () => {
              try {
                if (isPublishing) {
                  await unpublishLocalTracks()
                }
                await leaveAudience()
                await leaveLiveKitRoom()
              } catch {
                // ignore cleanup errors
              }

              localStorage.setItem(
                getKickStorageKey(streamId, user.id),
                JSON.stringify({
                  timestamp: Date.now(),
                  streamId,
                  reason: 'Removed from broadcast',
                }),
              )

              hasJoinedAudienceRef.current = false
              joiningAudienceRef.current = false
              currentRoomKeyRef.current = null
              toast.error('Removed from broadcast')
              navigate('/', { replace: true })
            })()
          }
        }
      },
      onStream: (event: any) => {
        const next = event?.new || event
        if (!next) return

        if (next.status === 'ended' || next.ended_at) {
          if (streamEndedRef.current) return
          streamEndedRef.current = true

          void (async () => {
            try {
              if (isPublishing) {
                await unpublishLocalTracks()
              }
              await leaveAudience()
              await leaveLiveKitRoom()
            } catch {
              // ignore cleanup errors
            }

            hasJoinedAudienceRef.current = false
            joiningAudienceRef.current = false
            currentRoomKeyRef.current = null

            navigate(`/broadcast/summary/${streamId}`, { replace: true })
          })()
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
      },
    } as any,
    stream?.battle_id ?? null,
  )

  /* ========================================================================
     FLOATING CHAT
  ======================================================================== */

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`floating-chat:${streamId}`)
    floatingChatChannelRef.current = channel

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content, isSystem } = payload.payload || {}
        if (!username || !content) return
        if (blockedUsernames.has(username.toLowerCase())) return

        const chatKey = `${username}:${content}`
        const now = Date.now()
        const existingTs = recentChatKeysRef.current.get(chatKey)
        if (existingTs !== undefined && now - existingTs < 1500) return
        recentChatKeysRef.current.set(chatKey, now)

        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        setFloatingMessages((prev) =>
          [{ id: msgId, username, content, timestamp: Date.now(), isSystem }, ...prev].slice(0, 50)
        )

        window.setTimeout(() => {
          setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
        }, 30_000)
      })
      .subscribe()

    return () => {
      floatingChatChannelRef.current = null
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamId, blockedUsernames])

  /* ========================================================================
     BROADCASTER
  ======================================================================== */

  const hostName =
    useMemo(
      () =>
        getDisplayName(
          broadcasterProfile,
          'Broadcaster',
        ),
      [broadcasterProfile],
    )

  const hostParticipantRef =
    useRef<any>(null)

  const [
    broadcasterState,
    setBroadcasterState,
  ] =
    useState<BroadcasterState>({
      participant: null,
      videoTrack: null,
      audioTrack: null,
    })

  const updateBroadcasterState =
    useCallback(
      (participant: any) => {
        if (!participant) {
          return
        }

        const videoTrack =
          getVideoTrackFromParticipant(
            participant,
          )

        const audioTrack =
          getAudioTrackFromParticipant(
            participant,
          )

        setBroadcasterState(
          previous => {
            const previousIdentity =
              previous.participant
                ?.identity ||
              null

            const nextIdentity =
              participant?.identity ||
              null

            const previousVideoId =
              previous.videoTrack
                ?.mediaStreamTrack
                ?.id ||
              previous.videoTrack
                ?.sid ||
              null

            const nextVideoId =
              videoTrack
                ?.mediaStreamTrack
                ?.id ||
              videoTrack?.sid ||
              null

            const previousAudioId =
              previous.audioTrack
                ?.mediaStreamTrack
                ?.id ||
              previous.audioTrack
                ?.sid ||
              null

            const nextAudioId =
              audioTrack
                ?.mediaStreamTrack
                ?.id ||
              audioTrack?.sid ||
              null

            if (
              previousIdentity ===
                nextIdentity &&
              previousVideoId ===
                nextVideoId &&
              previousAudioId ===
                nextAudioId
            ) {
              return previous
            }

            return {
              participant,
              videoTrack,
              audioTrack,
            }
          },
        )
      },
      [],
    )

  function resolveBroadcasterParticipant(
    participants: any[],
    room: any,
    streamId: string,
    broadcasterUserId: string,
  ) {
    const expectedHostIdentity = `host_${streamId}`

    const matches = (participant: any) => {
      const identity =
        String(
          participant?.identity ||
            participant?.participantIdentity ||
            participant?.name ||
            '',
        ).trim()

      const metadata =
        getParticipantMetadata(participant)

      if (
        identity === expectedHostIdentity
      ) {
        return true
      }

      if (
        metadata.role === 'host' &&
        metadata.streamId === streamId
      ) {
        return true
      }

      if (
        participantMatchesUser(
          participant,
          broadcasterUserId,
        )
      ) {
        return true
      }

      return false
    }

    let host =
      participants.find(matches)

    if (
      !host &&
      room?.remoteParticipants
    ) {
      host =
        Array.from(
          room.remoteParticipants.values(),
        ).find(matches)
    }

    return host
  }

  useEffect(() => {
    const host = resolveBroadcasterParticipant(
      remoteParticipants,
      liveKitRoom,
      streamId,
      hostId,
    )

    if (host) {
      hostParticipantRef.current =
        host

      updateBroadcasterState(
        host,
      )
    }
  }, [
    remoteParticipants,
    liveKitRoom,
    streamId,
    hostId,
    updateBroadcasterState,
  ])

  /* ========================================================================
     SEAT TRACKS
  ======================================================================== */

  const [
    seatTracks,
    setSeatTracks,
  ] =
    useState<
      Record<number, SeatState>
    >({})

  useEffect(() => {
    if (!liveKitRoom) {
      return
    }

    const syncSeats = () => {
      setSeatTracks(
        previous => {
          const next = {
            ...previous,
          }

          Object.entries(
            seats || {},
          ).forEach(
            ([
              index,
              seat,
            ]: [string, any]) => {
              const seatIndex =
                Number(index)

              const userId =
                seat?.user_id ||
                seat?.guest_id ||
                null

              const identity =
                seat?.livekit_participant_identity ||
                seat?.participant_identity ||
                seat?.livekit_identity ||
                userId

              if (
                !userId &&
                !identity
              ) {
                delete next[
                  seatIndex
                ]

                return
              }

              const participant =
                resolveSeatParticipant(
                  seat,
                  remoteParticipants,
                  liveKitRoom,
                )

              next[seatIndex] = {
                participant:
                  participant ||
                  null,

                videoTrack:
                  getVideoTrackFromParticipant(
                    participant,
                  ),

                audioTrack:
                  getAudioTrackFromParticipant(
                    participant,
                  ),

                isLoading:
                  Boolean(
                    seat?.status ===
                      'camera_starting',
                  ) &&
                  !participant,

                userId,
              }
            },
          )

          return next
        },
      )
    }

    syncSeats()

    liveKitRoom.on(
      RoomEvent.TrackSubscribed,
      syncSeats,
    )

    liveKitRoom.on(
      RoomEvent.TrackUnsubscribed,
      syncSeats,
    )

    liveKitRoom.on(
      RoomEvent.ParticipantConnected,
      syncSeats,
    )

    liveKitRoom.on(
      RoomEvent.ParticipantDisconnected,
      syncSeats,
    )

    return () => {
      liveKitRoom.off(
        RoomEvent.TrackSubscribed,
        syncSeats,
      )

      liveKitRoom.off(
        RoomEvent.TrackUnsubscribed,
        syncSeats,
      )

      liveKitRoom.off(
        RoomEvent.ParticipantConnected,
        syncSeats,
      )

      liveKitRoom.off(
        RoomEvent.ParticipantDisconnected,
        syncSeats,
      )
    }
  }, [
    liveKitRoom,
    remoteParticipants,
    seats,
  ])

  /* ========================================================================
      SEAT PUBLISH / UNPUBLISH
   ======================================================================== */

  const isUserOnStage = useMemo(() => {
    if (!mySeat || !user?.id) {
      return false
    }

    const status =
      String(mySeat?.status || '')
        .trim()
        .toLowerCase()

    return (
      [
        'reserved',
        'camera_starting',
        'active',
        'live',
      ].includes(status) &&
      (mySeat.user_id === user.id ||
        mySeat.guest_id === user.id)
    )
  }, [mySeat, user?.id])

  useEffect(() => {
    if (!liveKitRoom || !isConnected) {
      return
    }

    if (isUserOnStage && !isPublishing) {
      if (joiningPublisherRef.current || joiningAudienceRef.current) {
        return
      }

      joiningPublisherRef.current = true
      currentRoomKeyRef.current = `${streamId}:${roomId}`

      void publishLocalTracks()
        .then(() => {
          if (mySeat?.seat_index != null) {
          }
        })
        .catch((err: any) => {
        })
        .finally(() => {
          joiningPublisherRef.current = false
        })
      return
    }

    if (!isUserOnStage && isPublishing) {
      joiningPublisherRef.current = true

      void unpublishLocalTracks()
        .catch((err: any) => {
        })
        .finally(() => {
          joiningPublisherRef.current = false
        })

      void leaveLiveKitRoom().catch(() => {})
      hasJoinedAudienceRef.current = false
      joiningAudienceRef.current = false
      currentRoomKeyRef.current = null
      return
    }
  }, [
    isUserOnStage,
    isConnected,
    isPublishing,
    liveKitRoom,
    publishLocalTracks,
    unpublishLocalTracks,
    leaveLiveKitRoom,
    streamId,
    roomId,
    mySeat?.seat_index,
  ])

  const wasOnStageRef = useRef(isUserOnStage)

  useEffect(() => {
    if (wasOnStageRef.current) {
      wasOnStageRef.current = isUserOnStage
      return
    }
    wasOnStageRef.current = isUserOnStage
    if (!isUserOnStage) return

    joiningAudienceRef.current = false
    hasJoinedAudienceRef.current = false
    joiningAudienceRef.current = false
    audienceJoinAttemptedKeyRef.current = null
    currentRoomKeyRef.current = null

    if (mySeat?.seat_index != null && viewerIdentity) {
      void markSeatLive(mySeat.seat_index, viewerIdentity)
    }

    void (async () => {
      joiningAudienceRef.current = true
      try {
        const isBattleMode = Boolean(battleId)
        const result = await joinAsAudience({
          userId: viewerIdentityRef.current || viewerIdentity,
          streamId,
          roomName: roomId,
          viewerIdentity: viewerIdentityRef.current || viewerIdentity,
          publishCapable: !isBattleMode && true,
        })

        if (typeof result === 'string') {
        }
      } catch (err) {
        // ignore join errors
      } finally {
        joiningAudienceRef.current = false
      }
    })()
  }, [isUserOnStage, roomId, streamId, viewerIdentity, joinAsAudience, battleId, mySeat?.seat_index, markSeatLive])

  /* ========================================================================
      AUDIENCE PRESENCE
   ======================================================================== */

  useEffect(() => {
    if (!streamId) {
      return
    }

    void joinAudience()

    const interval =
      window.setInterval(
        () => {
          void heartbeatAudience()
        },
        15000,
      )

    return () => {
      window.clearInterval(
        interval,
      )

      void leaveAudience()
    }
  }, [
    streamId,
    joinAudience,
    leaveAudience,
    heartbeatAudience,
  ])

  useEffect(() => {
    const audienceCount =
      activeAudience?.length || 0

    const serverCount =
      Number(
        (stream as any)?.current_viewers || 0,
      ) || 0

    setViewerCount(
      audienceCount > 0
        ? audienceCount
        : serverCount,
    )
  }, [
    activeAudience,
    stream,
  ])

   /* ========================================================================
      KICK / REMOVAL HANDLING
   ======================================================================== */

  const kickProcessedRef =
    useRef(false)

  useEffect(() => {
    if (!streamId || !user?.id) {
      return
    }

    kickProcessedRef.current = false

    const channel = supabase.channel(
      `stream-seat-events-kick:${streamId}`,
    )

    channel
      .on(
        'broadcast',
        { event: 'seat_left' },
        (payload) => {
          if (kickProcessedRef.current) {
            return
          }

          if (!mySeat) {
            return
          }

          const payloadUserId =
            String(
              payload?.payload?.user_id ||
                '',
            ).trim()

          if (
            !payloadUserId ||
            payloadUserId !== user.id
          ) {
            return
          }

          kickProcessedRef.current = true

          void (async () => {
            try {
              await unpublishLocalTracks()
              await leaveSeat?.()
              await leaveAudience()
              await leaveLiveKitRoom().catch(
                () => {},
              )
              hasJoinedAudienceRef.current =
                false
              joiningAudienceRef.current =
                false
              currentRoomKeyRef.current =
                null

              localStorage.setItem(
                getKickStorageKey(streamId, user.id),
                JSON.stringify({
                  timestamp: Date.now(),
                  streamId,
                  reason: 'Removed from stage',
                }),
              )

              toast.error(
                'Removed from stage',
              )
              navigate(
                '/',
                { replace: true },
              )
            } catch {
              // ignore cleanup errors
            }
          })()
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(
          channel,
        )
      }
      kickProcessedRef.current = false
    }
  }, [
    streamId,
    user?.id,
    mySeat,
    leaveSeat,
    leaveAudience,
    leaveLiveKitRoom,
    unpublishLocalTracks,
    navigate,
  ])

  /* ========================================================================
      CLEANUP ON UNMOUNT / STREAM CHANGE
   ======================================================================== */

  useEffect(() => {
    return () => {
      if (isPublishing) {
        void unpublishLocalTracks().catch(
          () => {},
        )
      }

      void leaveLiveKitRoom().catch(() => {})

      if (
        hasJoinedAudienceRef.current ||
        joiningAudienceRef.current
      ) {
        void leaveAudience()
      }

      hasJoinedAudienceRef.current = false
      joiningAudienceRef.current = false
      currentRoomKeyRef.current = null
    }
  }, [
    isPublishing,
    leaveLiveKitRoom,
    unpublishLocalTracks,
    leaveAudience,
  ])

  /* ========================================================================
      SEAT CARDS
   ======================================================================== */

  const seatCards =
    useMemo<PhoneSeatCard[]>(
      () => {
        const configuredCount =
          Number(
            (stream as any)
              ?.seat_count ?? 0,
          )

        const priceCount =
          Array.isArray(
            (stream as any)
              ?.seat_prices,
          )
            ? (
                stream as any
              ).seat_prices.length
            : 0

        const count =
          Math.max(
            0,
            Math.min(
              6,
              configuredCount ||
                priceCount ||
                0,
            ),
          )

        const cards:
          PhoneSeatCard[] = []

        for (
          let index = 1;
          index <= count;
          index += 1
        ) {
          const seat =
            (seats as any)?.[
              index
            ] || null

          const status =
            String(
              seat?.status ||
                'empty',
            ).toLowerCase()

          const userId =
            seat?.user_id ||
            seat?.guest_id ||
            null

          const identity =
            seat?.livekit_participant_identity ||
            seat?.participant_identity ||
            seat?.livekit_identity ||
            userId

          const isOccupied =
            [
              'reserved',
              'camera_starting',
              'active',
              'live',
            ].includes(status) &&
            Boolean(userId)

          const isMine =
            Boolean(
              user?.id &&
              (
                seat?.user_id ===
                  user.id ||
                seat?.guest_id ===
                  user.id
              ),
            )

          const isLocked =
            Boolean(
              seat?.is_locked ||
              (
                stream as any
              )
                ?.are_seats_locked,
            )

          cards.push({
            seatIndex: index,
            seat,
            userId,
            identity,
            displayName:
              seat?.display_name ||
              seat?.username ||
              `Seat ${index}`,
            isOccupied,
            isMine,
            isLocked,
            canJoin:
              !isLocked &&
              !isOccupied,
            seatPrice:
              getSeatPrice(
                stream,
                index,
              ),
          })
        }

        return cards
      },
      [
        seats,
        stream,
        user?.id,
      ],
    )

  /* ========================================================================
     LIKES
  ======================================================================== */

  const pendingLikesRef =
    useRef(0)

  const flushInProgressRef =
    useRef(false)

  const clickTimesRef =
    useRef<number[]>([])

  const blockedUntilRef =
    useRef<number | null>(null)

  const flushLikes =
    useCallback(
      async () => {
        if (
          flushInProgressRef.current
        ) {
          return
        }

        const batch =
          pendingLikesRef.current

        if (
          batch <= 0 ||
          !streamId
        ) {
          return
        }

        pendingLikesRef.current =
          0

        flushInProgressRef.current =
          true

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'increment_stream_likes',
              {
                p_stream_id:
                  streamId,
                p_like_count:
                  batch,
              },
            )

          if (error) {
            throw error
          }

          if (
            typeof data ===
            'number'
          ) {
            setStream(
              previous => {
                if (!previous) {
                  return previous
                }

                return {
                  ...previous,
                  total_likes:
                    data,
                }
              },
            )

            try {
              void sendStreamBroadcast(
                streamId,
                'like_sent',
                {
                  user_id:
                    user?.id,
                  stream_id:
                    streamId,
                  total_likes:
                    data,
                },
              )
            } catch {
              // ignore
            }
          }
        } catch {
          pendingLikesRef.current +=
            batch
        } finally {
          flushInProgressRef.current =
            false
        }
      },
      [
        streamId,
        user?.id,
      ],
    )

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          void flushLikes()
        },
        2500,
      )

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          'hidden'
        ) {
          void flushLikes()
        }
      }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      window.clearInterval(
        interval,
      )

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      void flushLikes()
    }
  }, [flushLikes])

  const handleLike =
    useCallback(
      async () => {
        if (
          !streamId ||
          !user?.id
        ) {
          navigate(
            '/auth?mode=signup',
          )

          return
        }

        const now =
          Date.now()

        if (
          blockedUntilRef.current &&
          now <
            blockedUntilRef.current
        ) {
          const secondsLeft =
            Math.ceil(
              (
                blockedUntilRef.current -
                now
              ) /
                1000,
            )

          toast.error(
            `You're temporarily blocked from liking (${secondsLeft}s)`,
          )

          return
        }

        const times =
          clickTimesRef.current

        times.push(now)

        const cutoff =
          now - 1000

        while (
          times.length &&
          times[0] <
            cutoff
        ) {
          times.shift()
        }

        if (
          times.length >=
          20
        ) {
          blockedUntilRef.current =
            now +
            60 *
              1000

          clickTimesRef.current =
            []

          toast.error(
            'Rate limited for 1 minute due to suspected auto-clicking',
          )

          return
        }

        setStream(
          previous =>
            previous
              ? {
                  ...previous,
                  total_likes:
                    Number(
                      previous.total_likes ||
                        0,
                    ) + 1,
                }
              : previous,
        )

        pendingLikesRef.current +=
          1

        if (
          pendingLikesRef.current >=
          25
        ) {
          void flushLikes()
        }
      },
      [
        streamId,
        user?.id,
        flushLikes,
      ],
    )

  const lastTapRef =
    useRef(0)

  const handleBroadcasterTap =
    useCallback(() => {
      /*
       * Do not process broadcast double-tap likes
       * while the battle is covering the screen.
       */
      if (battleActive) {
        setShowControls(true)
        return
      }

      const now =
        Date.now()

      const difference =
        now -
        lastTapRef.current

      if (
        difference > 0 &&
        difference < 300
      ) {
        setLiked(true)

        window.setTimeout(
          () => {
            setLiked(false)
          },
          700,
        )

        void handleLike()
      }

      lastTapRef.current =
        now

      setShowControls(true)
    }, [
      battleActive,
      handleLike,
    ])

  const handleVideoTap =
    useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const rect =
          e.currentTarget.getBoundingClientRect()

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const x =
          e.clientX -
          rect.left
        const y =
          e.clientY -
          rect.top

        setTapIndicators(
          previous => [
            ...previous,
            { id, x, y },
          ],
        )

        window.setTimeout(
          () => {
            setTapIndicators(
              previous =>
                previous.filter(
                  t => t.id !== id,
                ),
            )
          },
          900,
        )

        void handleLike()

        if (!showControls) {
          setShowControls(true)
        }
      },
      [
        handleLike,
        showControls,
      ],
    )

  /* ========================================================================
     SEATS
  ======================================================================== */

  const handleJoinSeat =
    useCallback(
      async (
        seatIndex: number,
      ) => {
        if (!joinSeat) {
          return
        }

        try {
          const price =
            getSeatPrice(
              stream,
              seatIndex,
            )

          await joinSeat(
            seatIndex,
            price,
            viewerIdentity,
          )
        } catch (err) {
          console.error(
            '[PhoneViewerPage] join seat failed',
            err,
          )
        }
      },
      [
        joinSeat,
        stream,
        viewerIdentity,
      ],
    )

  const handleLeaveSeat =
    useCallback(
      async () => {
        try {
          await leaveSeat?.()
        } catch (err) {
          console.error(
            '[PhoneViewerPage] leave seat failed',
            err,
          )
        }
      },
      [leaveSeat],
    )

  /* ========================================================================
     LEAVE
  ======================================================================== */

  const leave =
    useCallback(
      async () => {
        try {
          await leaveSeat?.()
        } catch {
          // ignore
        }

        try {
          await leaveAudience()
        } catch {
          // ignore
        }

        navigate(-1)
      },
      [
        leaveSeat,
        leaveAudience,
        navigate,
      ],
    )

  /* ========================================================================
     GIFTS
  ======================================================================== */

  const handleGift =
    useCallback(() => {
      if (!user) {
        navigate(
          '/auth?mode=signup',
        )

        return
      }

      setGiftRecipientId(
        hostId || null,
      )

      setIsGiftModalOpen(
        true,
      )
    }, [
      user,
      navigate,
      hostId,
    ])

  const handleOpenShareModal = useCallback(() => {
    setIsShareModalOpen(true)
  }, [])

  const handleInviteFollowers = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const inviterId = userData.user?.id
      if (!inviterId || !streamId) return

      const { data, error } = await supabase.rpc('invite_followers_to_broadcast', {
        p_stream_id: streamId,
        p_inviter_id: inviterId,
      })

      if (error) throw error
      toast.success(`Invited ${data.invited_count || 0} followers and following users`)
      void awardInvitePoint()
    } catch (inviteError: any) {
      toast.error(inviteError.message || 'Failed to send invites')
    }
  }, [streamId])

  /* ========================================================================
     MIC / CAMERA
  ======================================================================== */

  const [
    micEnabled,
    setMicEnabledState,
  ] = useState(true)

  const [
    cameraEnabled,
    setCameraEnabledState,
  ] = useState(true)

  const handleMic =
    useCallback(
      async () => {
        const next =
          !micEnabled

        const ok =
          await setMicEnabled(
            next,
          )

        if (ok) {
          setMicEnabledState(
            next,
          )
        }
      },
      [
        micEnabled,
        setMicEnabled,
      ],
    )

  const handleCamera =
    useCallback(
      async () => {
        const next =
          !cameraEnabled

        const ok =
          await setCameraEnabled(
            next,
          )

        if (ok) {
          setCameraEnabledState(
            next,
          )
        }
      },
      [
        cameraEnabled,
        setCameraEnabled,
      ],
    )

  /* ========================================================================
     MODERATOR MUTE ENFORCEMENT
     ======================================================================== */

  const isModeratorMutedRef =
    useRef(false)

  const moderatorMuteTimestampRef =
    useRef(0)

  const moderatorMuteTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyModeratorMute =
    useCallback(async () => {
      moderatorMuteTimestampRef.current = Date.now()
      isModeratorMutedRef.current = true

      if (moderatorMuteTimerRef.current) {
        clearTimeout(moderatorMuteTimerRef.current)
      }

      moderatorMuteTimerRef.current = setTimeout(() => {
        isModeratorMutedRef.current = false
        moderatorMuteTimestampRef.current = 0
        moderatorMuteTimerRef.current = null
        toast.info('You can now unmute your microphone')
      }, 5000)

      await setMicEnabled(false)
      setMicEnabledState(false)
    },
    [
      setMicEnabled,
      setMicEnabledState,
      toast,
    ],
    )

  const clearModeratorMute =
    useCallback(async () => {
      if (moderatorMuteTimerRef.current) {
        clearTimeout(moderatorMuteTimerRef.current)
      }

      moderatorMuteTimerRef.current = null
      moderatorMuteTimestampRef.current = 0
      isModeratorMutedRef.current = false

      await setMicEnabled(true)
      setMicEnabledState(true)
    },
    [
      setMicEnabled,
      setMicEnabledState,
    ],
    )

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
          void applyModeratorMute()
        }
      } catch {
        // ignore
      }
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
            void applyModeratorMute()
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

  /* ========================================================================
     CITY STATUS
  ======================================================================== */

  const broadcasterId =
    stream?.user_id || ''

  const broadcasterCityStatus =
    useCityStatusOrb({
      userId:
        broadcasterId,
      broadcasterId:
        user?.id,
      isBroadcaster:
        false,
      isBroadOfficer:
        false,
    })

  /* ========================================================================
     LOADING
  ======================================================================== */

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#03040a]">
        <div className="relative flex flex-col items-center gap-5">
          <div className="absolute h-32 w-32 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute h-24 w-24 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative grid h-16 w-16 place-items-center rounded-3xl border border-cyan-300/30 bg-white/[0.04] shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <Radio className="h-7 w-7 animate-pulse text-cyan-300" />
          </div>

          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white">
              MaiTroll
            </p>

            <p className="mt-2 text-[11px] font-semibold text-white/40">
              Connecting to live stream
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ========================================================================
     ERROR
  ======================================================================== */

  if (!stream) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#03040a] px-6 text-white">
        <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-7 text-center shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-violet-600/15 blur-3xl" />

          <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-violet-300/20 bg-violet-500/10">
            <Radio className="h-7 w-7 text-violet-300" />
          </div>

          <h1 className="relative mt-5 text-lg font-black">
            Stream unavailable
          </h1>

          <p className="relative mt-2 text-sm text-white/45">
            {error ||
              'This stream could not be loaded.'}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="relative mt-6 h-12 w-full rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500/15 to-violet-500/15 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_0_25px_rgba(34,211,238,0.08)]"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (shouldShowRandomBattleArena) {
    return (
      <ErrorBoundary>
    <GiftSystemProvider streamId={streamId} defaultReceiverId={stream.user_id}>
      <UndoRecentGiftBar />
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden">
            <BattleView
              key={activeBattleId}
              battleId={stream.battle_id!}
              currentStreamId={streamId}
              viewerId={user?.id || anonViewerId}
              remoteUsers={remoteUsers}
              userIdToLiveKitIdentity={userIdToLiveKitIdentity}
              returnPathTemplate="/watch/:id"
              onReturnToStream={() => {
                setStream((prev) =>
                  prev
                    ? {
                        ...prev,
                        is_battle: false,
                        battle_id: null,
                        battle_mode: 'none' as any,
                        battle_status: 'waiting' as any,
                      }
                    : prev
                );
              }}
              onToggleCamera={handleCamera}
              onToggleMic={handleMic}
            />
            {isCashoutModalOpen && (
          <MiniMaiPayCashoutModal
            isOpen={isCashoutModalOpen}
            onClose={() => setIsCashoutModalOpen(false)}
            currentBalance={cashoutBanner.currentBalance}
            onSuccess={() => cashoutBanner.refreshBalance()}
            isMobile={true}
          />
        )}
        <PhoneGiftModal
              isOpen={
                isGiftModalOpen
              }
              onClose={() => {
                setIsGiftModalOpen(
                  false,
                )

                setGiftRecipientId(
                  null,
                )
              }}
              recipientId={
                giftRecipientId ||
                hostId ||
                ''
              }
              streamId={
                streamId
              }
              broadcasterId={
                hostId
              }
            />
          </div>
        </GiftSystemProvider>
      </ErrorBoundary>
    );
  }

  /* ========================================================================
      MAIN VIEW
  ======================================================================== */

  return (
    <GiftSystemProvider
      streamId={streamId}
      defaultReceiverId={
        stream.user_id
      }
    >
      <UndoRecentGiftBar />
      {isFeaturedEvent && (
        <FeaturedBanner
          broadcasters={featuredBroadcasters}
          event={featuredEvent}
          onOpenLeaderboard={openFeaturedLeaderboard}
        />
      )}
      {featuredBroadcasters.length > 0 && (
        <FeaturedLeaderboard
          open={leaderboardOpen}
          broadcasters={featuredBroadcasters}
          onClose={closeFeaturedLeaderboard}
        />
      )}
      <FeaturedLiveOverlay active={!!currentStreamFeatured} className="left-4 top-4" />
      {!shouldShowRandomBattleArena && <FeaturedGiftBanner streamId={streamId} broadcasterId={hostId} isMobile={true} />}
      <div
        className="relative h-[100dvh] w-full overflow-hidden bg-[#02030a] text-white"
        onClick={() => {
          if (!showControls) {
            setShowControls(true)
          }
        }}
      >
        {pullRefreshing && (
          <div
            className="absolute inset-x-0 top-0 z-[400] flex justify-center pt-3 pointer-events-none"
            style={{ transform: `translateY(${Math.min(pullY, 60)}px)` }}
          >
            <div className="rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-black text-white/80 backdrop-blur">
              {pullY >= 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          </div>
        )}

        {/* ================================================================
            FULL-SCREEN BROADCASTER VIDEO
        ================================================================= */}

        <div className="absolute inset-0 z-0">
          <PhoneRemoteVideo
            participant={
              broadcasterState.participant
            }
            room={
              liveKitRoom
            }
            className="h-full w-full"
            mirror={true}
            fallback={
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#050711]">
                <div className="relative grid h-20 w-20 place-items-center rounded-[28px] border border-cyan-300/20 bg-cyan-500/10 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
                  <Radio className="h-8 w-8 animate-pulse text-cyan-300/70" />
                </div>

                <p className="relative mt-5 text-sm font-black">
                  {hostName}
                </p>

                <p className="relative mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  Camera connecting
                </p>
              </div>
            }
          />
          {/* Camera-off image fallback */}
          {!broadcasterState.videoTrack && (broadcasterProfile as any)?.camera_off_image_url && (
            <div className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-hidden bg-black">
              <img
                src={(broadcasterProfile as any).camera_off_image_url}
                alt={`${broadcasterProfile?.username || 'Broadcaster'} camera off`}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div
            className="absolute inset-0 z-[2]"
            onClick={handleVideoTap}
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black-70" />

          {mySeat && !shouldShowRandomBattleArena && (
            <CashoutProgressBanner
              isVisible={cashoutBanner.isVisible}
              currentBalance={cashoutBanner.currentBalance}
              nextTier={cashoutBanner.nextTier}
              amountRemaining={cashoutBanner.amountRemaining}
              progressPercent={cashoutBanner.progressPercent}
              isCashoutReady={cashoutBanner.isCashoutReady}
              onClick={() => cashoutBanner.isCashoutReady && setIsCashoutModalOpen(true)}
              isMobile={true}
            />
          )}
        </div>

        {/* ================================================================
            FLOATING LIKE INDICATORS
        ================================================================= */}

        {!battleActive &&
          tapIndicators.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
              {tapIndicators.map(
                (indicator) => {
                  const hue =
                    indicator.id.charCodeAt(
                      indicator.id.length -
                        1,
                    ) %
                    2 ===
                    0
                      ? 190
                      : 270

                  return (
                    <div
                      key={
                        indicator.id
                      }
                      className="absolute mt-pop font-black text-lg"
                      style={{
                        left:
                          indicator
                            .x,
                        top:
                          indicator
                            .y,
                        color: `hsl(${hue}, 100%, 70%)`,
                        textShadow: `0 0 10px hsl(${hue}, 100%, 50%), 0 0 20px hsl(${hue}, 100%, 40%)`,
                      }}
                    >
                      MT
                    </div>
                  )
                },
              )}
            </div>
          )}

        {/* ================================================================
            AUDIENCE TICKER + VIEWER CONTROLS (top)
        ================================================================= */}

        {stream && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <div className="pointer-events-auto flex w-full items-center gap-1 rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/85 via-black/70 to-slate-950/85 px-2 py-1.5 shadow-[0_2px_24px_rgba(34,211,238,0.10)] backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <MobileAudienceTicker
                  audience={audienceWithAnon}
                  currentUserId={user?.id}
                  hostUserId={stream?.user_id}
                  viewerCount={viewerCount}
                  likes={stream?.total_likes ?? 0}
                  maxVisible={7}
                />
              </div>

              {showControls && !battleActive && (
                <button
                  type="button"
                  onClick={leave}
                  aria-label="Go back"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition active:scale-90"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
            </div>

            <div className="flex w-full items-start justify-between gap-2">
              {/* City Status Orb and Mai Bag stay directly under the ticker. */}
              <div className="pointer-events-auto flex shrink-0 flex-col items-start gap-1.5">
                {broadcasterCityStatus.data && (
                  <CityStatusOrb
                    data={broadcasterCityStatus.data}
                    permissions={{ isSelf: false, canCheckLicense: false, canRaid: true, canRepair: true, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                    compact
                    onRaid={() => {
                      const targetUser = broadcasterCityStatus.data;
                      if (targetUser?.id && targetUser.id !== user?.id) {
                        setBroadcastRaidTarget(targetUser.id);
                      }
                    }}
                  />
                )}
                {streamId && <MaiBag streamId={streamId} phone />}
              </div>

              {/* Like / Gift / Share / Invite stay directly under the ticker. */}
              <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLiked(true)
                    void handleLike()
                    window.setTimeout(
                      () => {
                        setLiked(false)
                      },
                      700,
                    )
                  }}
                  className="flex h-8 w-8 flex-col items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-xl transition active:scale-90"
                >
                  <Heart
                    size={12}
                    className={cn(
                      liked
                        ? 'fill-pink-300 text-pink-300'
                        : 'text-white',
                    )}
                  />
                  <span className="text-[6px] font-black leading-none text-white">
                    {Math.max(
                      0,
                      Number(
                        (stream as any)
                          ?.total_likes ??
                          0,
                      ) +
                        pendingLikesRef.current,
                    ).toLocaleString()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleGift}
                  className="grid h-8 w-8 place-items-center rounded-full border border-violet-300/20 bg-black/40 backdrop-blur-xl transition active:scale-90"
                >
                  <Gift
                    size={12}
                    className="text-violet-300"
                  />
                </button>

                <button
                  type="button"
                  onClick={handleOpenShareModal}
                  className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/20 bg-black/40 backdrop-blur-xl transition active:scale-90"
                >
                  <Share2
                    size={12}
                    className="text-cyan-300"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => void handleInviteFollowers()}
                  className="grid h-8 w-8 place-items-center rounded-full border border-emerald-300/20 bg-black/40 backdrop-blur-xl transition active:scale-90"
                  aria-label="Invite followers"
                  title="Invite followers"
                >
                  <Bell size={12} className="text-emerald-300" />
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Mai Bag moved below share/gift buttons */}

        {/* ================================================================
            LIKE
        ================================================================= */}

        {liked &&
          !battleActive && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
              <Heart className="h-24 w-24 animate-ping fill-pink-400 text-pink-400 drop-shadow-[0_0_35px_rgba(244,114,182,0.8)]" />
            </div>
          )}

        {/* ================================================================
            SEATS
        ================================================================= */}

        {!battleActive &&
          seatCards.length > 0 && (
            <div
              className={cn(
                'absolute left-0 right-0 z-40 px-2 transition-all duration-300',
                'bottom-[calc(86px+env(safe-area-inset-bottom))]',
              )}
              onClick={event =>
                event.stopPropagation()
              }
            >
              <div className="mx-auto max-w-[720px]">

                <div className="mb-1.5 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.9)]" />

                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">
                      Live Seats
                    </span>
                  </div>

                  <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[7px] font-black text-white/45 backdrop-blur-xl">
                    {
                      seatCards.filter(
                        seat =>
                          seat.isOccupied,
                      ).length
                    }
                    /
                    {
                      seatCards.length
                    }
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {seatCards.map(
                    seat => {
                      const state =
                        seatTracks[
                          seat.seatIndex
                        ]

                      const participant =
                        state?.participant

                      const isFocused =
                        seatFocus ===
                        seat.seatIndex

                      return (
                        <div
                          key={
                            seat.seatIndex
                          }
                          className={cn(
                            'relative aspect-[1.18] overflow-hidden rounded-xl border bg-[#060711]/90 shadow-[0_0_22px_rgba(0,0,0,0.4)] backdrop-blur-xl',
                            seat.isMine
                              ? 'border-emerald-300/45 shadow-[0_0_22px_rgba(16,185,129,0.12)]'
                              : seat.isOccupied
                                ? 'border-violet-300/30 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
                                : 'border-white/10',
                            isFocused &&
                              'ring-1 ring-cyan-300/70 shadow-[0_0_25px_rgba(34,211,238,0.2)]',
                          )}
                        >
                          {seat.isOccupied ? (
                            seat.isMine ? (
                              <PhoneLocalVideo
                                videoTrack={
                                  localVideoTrack
                                }
                                className="absolute inset-0"
                              />
                            ) : (
                              <PhoneRemoteVideo
                                participant={
                                  participant
                                }
                                room={
                                  liveKitRoom
                                }
                                className="absolute inset-0"
                                fallback={
                                  <div className="flex h-full w-full flex-col items-center justify-center bg-[#080914]">
                                    <Users className="h-4 w-4 text-violet-300/60" />

                                    <span className="mt-1 max-w-full truncate px-2 text-[8px] font-black text-white/80">
                                      {
                                        seat.displayName
                                      }
                                    </span>

                                    <span className="mt-0.5 text-[6px] font-black uppercase tracking-wider text-violet-200/40">
                                      Connecting
                                    </span>
                                  </div>
                                }
                              />
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={
                                !seat.canJoin
                              }
                              onClick={() =>
                                seat.canJoin &&
                                void handleJoinSeat(
                                  seat.seatIndex,
                                )
                              }
                              className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-white/[0.025] to-transparent disabled:cursor-not-allowed"
                            >
                              <div className="grid h-7 w-7 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-500/[0.06]">
                                <Plus
                                  size={13}
                                  className="text-cyan-200/70"
                                />
                              </div>

                              <span className="text-[8px] font-black text-white/70">
                                Seat{' '}
                                {
                                  seat.seatIndex
                                }
                              </span>

                              <span className="text-[6px] font-bold uppercase tracking-wider text-white/30">
                                {seat.isLocked
                                  ? 'Locked'
                                  : seat.seatPrice ===
                                      0
                                    ? 'Free'
                                    : `${seat.seatPrice} Coins`}
                              </span>
                            </button>
                          )}

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

                          <div className="absolute bottom-1 left-1 right-1 z-10 flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              {seat.userId ? (
                                 <div className="scale-50 origin-bottom-left">
                                  <SeatCityStatusOrb
                                    userId={
                                      seat.userId
                                    }
                                    broadcasterId={
                                      broadcasterId
                                    }
                                  />
                                </div>
                              ) : (
                                <span className="text-[7px] font-black text-white/55">
                                  Seat{' '}
                                  {
                                    seat.seatIndex
                                  }
                                </span>
                              )}
                            </div>

                            {seat.isOccupied &&
                              !seat.isMine && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSeatFocus(
                                      current =>
                                        current ===
                                        seat.seatIndex
                                          ? null
                                          : seat.seatIndex,
                                    )
                                  }
                                  className={cn(
                                    'rounded-md border px-1.5 py-1 text-[6px] font-black uppercase tracking-wider backdrop-blur-md',
                                    isFocused
                                      ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                                      : 'border-white/10 bg-black/50 text-white/55',
                                  )}
                                >
                                  {isFocused
                                    ? 'Listening'
                                    : 'Listen'}
                                </button>
                              )}
                          </div>

                           {seat.isMine && (
                             <>
                               <button
                                 type="button"
                                 onClick={(event) => {
                                   event.stopPropagation()
                                   void handleMic()
                                 }}
                                 className={cn(
                                   'absolute right-1 top-8 z-20 rounded-md border p-1 backdrop-blur-md',
                                   micEnabled
                                     ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100'
                                     : 'border-red-300/40 bg-red-500/15 text-red-100',
                                 )}
                               >
                                 {micEnabled ? (
                                   <Mic size={10} />
                                 ) : (
                                   <MicOff size={10} />
                                 )}
                               </button>

                               <button
                                 type="button"
                                 onClick={(event) => {
                                   event.stopPropagation()
                                   void handleCamera()
                                 }}
                                 className={cn(
                                   'absolute right-1 top-14 z-20 rounded-md border p-1 backdrop-blur-md',
                                   cameraEnabled
                                     ? 'border-violet-300/40 bg-violet-500/15 text-violet-100'
                                     : 'border-red-300/40 bg-red-500/15 text-red-100',
                                 )}
                               >
                                 {cameraEnabled ? (
                                   <Video size={10} />
                                 ) : (
                                   <VideoOff size={10} />
                                 )}
                               </button>

                               <button
                                 type="button"
                                 onClick={() =>
                                   void handleLeaveSeat()
                                 }
                                 className="absolute right-1 top-[4.5rem] z-20 rounded-md border border-red-300/20 bg-red-500/15 px-1.5 py-1 text-[6px] font-black uppercase tracking-wider text-red-100 backdrop-blur-md"
                               >
                                 Leave
                               </button>
                             </>
                           )}
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            </div>
          )}

        {/* ================================================================
            BROADCASTER CITY STATUS
        ================================================================= */}

        {/* ================================================================
            FLYING CHAT
        ================================================================= */}

        {!battleActive && floatingMessages.length > 0 && (
          <div className="absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 pointer-events-none px-3">
            {floatingMessages.slice(0, 8).map((msg) => (
              <div
                key={msg.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
              >
                 <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                   {canClickFloatingChatUsername ? (
                     <button
                       type="button"
                       onClick={() => handleOpenFloatingChatUsername(msg.username)}
                       className="text-[10px] font-black text-cyan-300 transition-colors hover:text-cyan-100"
                     >
                       {msg.username}
                     </button>
                   ) : (
                     <span className="text-[10px] font-black text-cyan-300">
                       {msg.username}
                     </span>
                   )}
                   <span className="text-[10px] font-bold text-white/40"> sent: </span>
                   <span className="text-[10px] font-semibold text-white/90">{msg.content}</span>
                 </div>
              </div>
            ))}
          </div>
        )}

        {/* ================================================================
            BOTTOM CONTROLS
        ================================================================= */}

        {!battleActive && (
          <div
            className="absolute bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#050711]/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
            onClick={event =>
              event.stopPropagation()
            }
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const text = chatInput.trim()
                if (!text || !streamId) return

                if (!user) {
                  return
                }

                const username = profile?.username || user?.email?.split('@')?.[0] || anonDisplayName || 'Viewer'
                const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                setFloatingMessages(prev => [{ id: msgId, username, content: text, timestamp: Date.now() }, ...prev].slice(0, 50))
                setChatInput('')

                window.setTimeout(() => {
                  setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                }, 30_000)

                try {
                  const result = await sendChatThroughGate({ streamId, content: text })
                  if (!result.ok) {
                    setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                    const errMsg = String(result.error || '').toLowerCase()
                    if (errMsg.includes('disabled')) {
                      // chat disabled - silently remove optimistic message
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
                } catch {
                  // ignore
                }
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                maxLength={280}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
              />
            </form>
          </div>
        )}

        {/* ================================================================
            EDGE ACCENTS
        ================================================================= */}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[130] h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-violet-500/50" />

        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[130] h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-violet-500/30" />

        {/* ================================================================
            CITY PANEL
        ================================================================= */}

        {selectedSeatUserId && (
          <CityStatusPanel
            userId={
              selectedSeatUserId
            }
            onClose={() =>
              setSelectedSeatUserId(
                null,
              )
            }
            isBroadcaster={
              false
            }
            isBroadOfficer={
              false
            }
            broadcasterId={
              hostId
            }
            onHouseClick={() => {
              const targetUser =
                broadcasterCityStatus.data

              if (
                targetUser?.house_id &&
                targetUser.id !==
                  user?.id
              ) {
                setSelectedSeatUserId(
                  targetUser.id,
                )
              }
            }}
          />
        )}

        {/* ================================================================
            BROADCAST RAID MODAL
        ================================================================= */}

        {broadcastRaidTarget && broadcasterCityStatus.data && (
          <RaidModal
            isOpen={!!broadcastRaidTarget}
            onClose={() =>
              setBroadcastRaidTarget(null)
            }
            targetUserId={
              broadcastRaidTarget
            }
            targetUsername={
              broadcasterCityStatus.data.username
            }
            targetAvatarUrl={
              broadcasterCityStatus.data.avatar_url
            }
            streamId={streamId}
            mode={
              broadcasterCityStatus.data.recentlyRaided
                ? 'repair'
                : 'raid'
            }
            onRaidComplete={() => {
              broadcasterCityStatus.refetch?.()
            }}
          />
        )}

        {/* ================================================================
            GIFT MODAL
        ================================================================= */}

        <PhoneGiftModal
          isOpen={
            isGiftModalOpen
          }
          onClose={() => {
            setIsGiftModalOpen(
              false,
            )

            setGiftRecipientId(
              null,
            )
          }}
          recipientId={
            giftRecipientId ||
            hostId ||
            ''
          }
          streamId={
            streamId
          }
          broadcasterId={
            hostId
          }
        />

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          streamTitle={stream.title || 'Untitled Stream'}
          streamUrl={`${window.location.origin}/live/${encodeURIComponent(hostName)}`}
          broadcasterName={hostName}
        />

        <GiftVideoOverlay 
          gifts={recentGifts} 
          onFinish={(giftId: string) => {
            setRecentGifts((prev) => prev.filter((gift) => gift.id !== giftId))
          }} 
        />

        {userActionTarget && (
          <>
            {showModActionMenu ? (
              <ModActionsPopup
                isOpen={true}
                onClose={() => {
                  setUserActionTarget(null)
                  setShowViewerAction(false)
                  setShowModActionMenu(false)
                }}
                targetUser={{
                  id: userActionTarget.userId,
                  username: userActionTarget.username || '',
                  role: userActionTarget.role || '',
                  avatar_url: '',
                }}
                targetUsername={userActionTarget.username || ''}
                targetUserId={userActionTarget.userId}
                streamId={streamId || ''}
                hostId={hostId}
                currentUserId={user?.id}
              />
            ) : showViewerAction ? (
              <ViewerUserActionModal
                isOpen={true}
                onClose={() => {
                  setUserActionTarget(null)
                  setShowViewerAction(false)
                  setShowModActionMenu(false)
                }}
                userId={userActionTarget.userId}
                username={userActionTarget.username}
                streamId={streamId || ''}
              />
            ) : (
              <UserActionModal
                onClose={() => {
                  setUserActionTarget(null)
                  setShowViewerAction(false)
                  setShowModActionMenu(false)
                }}
                userId={userActionTarget.userId}
                streamId={streamId || ''}
                isHost={userActionTarget.userId === hostId}
                isModerator={canClickFloatingChatUsername}
                isOfficer={canClickFloatingChatUsername}
                onGift={() => {
                  setGiftRecipientId(userActionTarget.userId)
                  setIsGiftModalOpen(true)
                }}
              />
            )}
          </>
        )}
      </div>
    </GiftSystemProvider>
  )
}