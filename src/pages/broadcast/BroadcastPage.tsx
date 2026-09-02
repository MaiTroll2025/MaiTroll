import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link,
  useParams,
  useNavigate,
} from 'react-router-dom'
import { Room, RoomEvent, LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, VideoPresets, Track, createLocalTracks } from 'livekit-client'

import { isStaffUser } from '../../lib/userUtils'

import { supabase, getBlockedUserIds } from '../../lib/supabase'

import { useAuthStore } from '../../lib/store'
import { useStreamStore } from '../../lib/streamStore'
import { cn } from '../../lib/utils'
import { getLiveKitRoomName } from '../../lib/liveUtils'
import { getBroadcastChatLockRemainingMs, isBroadcastChatLockActive } from '../../lib/broadcastModeration'
import {
  getAnonymousDisplayName,
  isAnonymousDisplayName,
  reserveAnonymousChatSlot,
} from '../../lib/anonymousIdentity'

import { useIsMobile } from '../../hooks/useIsMobile'
import { useUserLeagues } from '../../hooks/useUserLeagues'
import { useLeagueProgress } from '../../hooks/useLeagueProgress'
import { useTrollFamilyActivity } from '../../hooks/useTrollFamilyActivity'
import { useChatBlockStatus } from '../../hooks/useChatBlockStatus'
import LeagueProgressPanel from '../../components/broadcast/LeagueProgressPanel'
import LeagueLevelUpBanner from '../../components/broadcast/LeagueLevelUpBanner'
import FeedTheTroll from '../../components/feed-the-troll/FeedTheTroll'
import { RoleInviteHandler } from '../../components/broadcast/RoleInviteHandler'

import { Stream } from '../../types/broadcast'
import BroadcastBottomBar from '../../components/broadcast/BroadcastBottomBar'
import BroadcastNeonHeader from '../../components/broadcast/BroadcastNeonHeader'
import AudienceBubbleTicker from '@/components/broadcast/AudienceBubbleTicker'
import MobileAudienceTicker from '@/components/broadcast/MobileAudienceTicker'
import RandomBattleButton from '@/components/broadcast/RandomBattleButton'
import BroadcastOfficerModal from '../../components/broadcast/BroadcastOfficerModal'
import PayBroadOfficersModal from '../../components/broadcast/PayBroadOfficersModal'
import MoreControlsDrawer from '../../components/broadcast/MoreControlsDrawer'
import MobileBroadcastHostSettings from '../../components/broadcast/MobileBroadcastHostSettings'
import BroadcasterControlsModal from '@/components/broadcast/BroadcasterControlsModal'
import CameraOffImageModal from '@/components/broadcast/CameraOffImageModal'
import { useBroadcastFrame } from '../../hooks/useBroadcastFrame'
import { getThreads, getThreadMessages, sendMessage, searchUsers, findOrCreateDirectThread } from '../../services/utromailService'
import BroadcastFrame from '../../components/broadcast/BroadcastFrame'
import CollaborateButton from '../../components/collaboration/CollaborateButton'
import CollaborationModal from '../../components/collaboration/CollaborationModal'
import CollaborationRequestNotification from '../../components/collaboration/CollaborationRequestNotification'
import { useStreamCollaboration } from '../../hooks/useStreamCollaboration'
import MaiBag from '../../components/mai-bag/MaiBag'
import { useFeaturedLive } from '../../hooks/useFeaturedLive'
import { useResolvedStream, useResolvedStreamId } from '../../contexts/StreamRouteContext'
import { FeaturedBanner } from '../../components/featured/FeaturedBanner'
import { FeaturedLeaderboard } from '../../components/featured/FeaturedLeaderboard'
import { FeaturedLiveOverlay } from '../../components/featured/FeaturedLiveOverlay'

import CashoutProgressBanner from '../../components/broadcast/CashoutProgressBanner'
import MiniMaiPayCashoutModal from '../../components/broadcast/MiniMaiPayCashoutModal'
import { useCashoutBanner } from '../../hooks/useCashoutBanner'
import RecoveryBanner from '../../components/broadcast/RecoveryBanner'
import FeaturedGiftBanner from '../../components/broadcast/FeaturedGiftBanner'

import { MaiTrollBroadcastTheme as theme } from '../../styles/broadcastTheme'

// Reusable label classes from broadcastTheme
// const guestLabel = 'rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-black text-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
// const sectionLabel = 'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm font-bold text-white/70 backdrop-blur'

type SeatModalPrice = number | ''

function normalizeSeatPrice(value: unknown): SeatModalPrice {
  if (value === undefined || value === null || value === '') return ''

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : ''
  }

  return ''
}

function seatPriceToNumber(value: SeatModalPrice): number {
  return value === '' ? 0 : Math.max(0, Number(value) || 0)
}

function getRemoteParticipantIdentity(participant: any): string {
  const metadata = getRemoteParticipantMetadata(participant)
  return String(
    participant?.identity ||
      participant?.participantIdentity ||
      participant?.name ||
      metadata?.user_id ||
      metadata?.userId ||
      '',
  )
}

function getRemoteParticipantMetadata(participant: any): any {
  const raw = participant?.metadata
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function normalizeLiveKitIdentity(value?: string | null) {
  return String(value || '').trim()
}

function normalizeIdentityToken(value?: string | null): string {
  return normalizeLiveKitIdentity(value).replace(/^viewer-/, '').trim()
}

const isRoomUsable = (room: Room | null): room is Room => {
  return Boolean(
    room &&
      room.state !== 'disconnected' &&
      room.engine &&
      !room.engine.isClosed,
  )
}

type RemoteParticipantSnapshot = {
  identity: string
  participant: RemoteParticipant
  cameraPublication?: RemoteTrackPublication
  microphonePublication?: RemoteTrackPublication
  cameraTrack?: RemoteVideoTrack
  microphoneTrack?: RemoteAudioTrack
}

function getVideoTrackFromRemoteParticipant(participant: any): RemoteVideoTrack | null {
  if (!participant) return null

  const directCandidates = [
    participant.videoTrack,
    participant.cameraTrack,
    participant.track,
    participant.video,
    participant.getTrackPublication?.(Track.Source.Camera)?.track,
    participant.getTrackPublication?.(Track.Kind.Video)?.track,
  ]

  for (const candidate of directCandidates) {
    if (candidate?.attach && (candidate?.kind === Track.Kind.Video || candidate?.mediaStreamTrack?.kind === 'video')) {
      return candidate as RemoteVideoTrack
    }
  }

  const publications: RemoteTrackPublication[] = []
  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return
    if (typeof maybeMap.values === 'function') {
      publications.push(...(Array.from(maybeMap.values()) as RemoteTrackPublication[]))
      return
    }
    if (Array.isArray(maybeMap)) publications.push(...maybeMap)
  }

  collectFromMap(participant.videoTrackPublications)
  collectFromMap(participant.trackPublications)
  collectFromMap(participant.tracks)
  collectFromMap(participant.publications)

  for (const pub of publications as any[]) {
    const track = pub?.track || pub?.videoTrack || pub?.trackPublication?.track || null
    if (!track?.attach) continue

    const isVideo =
      pub?.source === Track.Source.Camera ||
      pub?.kind === Track.Kind.Video ||
      pub?.track?.kind === Track.Kind.Video ||
      track?.kind === Track.Kind.Video ||
      track?.mediaStreamTrack?.kind === 'video'

    if (isVideo) return track as RemoteVideoTrack
  }

  return null
}


function getAudioTrackFromRemoteParticipant(participant: any): RemoteAudioTrack | null {
  if (!participant) return null

  const publications: RemoteTrackPublication[] = []
  const collectFromMap = (maybeMap: any) => {
    if (!maybeMap) return
    if (typeof maybeMap.values === 'function') {
      publications.push(...(Array.from(maybeMap.values()) as RemoteTrackPublication[]))
      return
    }
    if (Array.isArray(maybeMap)) publications.push(...maybeMap)
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

  return (audioPub?.track as RemoteAudioTrack) || null
}

const RemoteSeatSurface = React.memo(function RemoteSeatSurface({
  participant,
  cameraTrack: cameraTrackProp,
  fallback,
  mirror = false,
}: {
  participant: RemoteParticipant | null
  cameraTrack?: RemoteVideoTrack | null
  fallback: React.ReactNode
  mirror?: boolean
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const videoTrack = cameraTrackProp ?? getVideoTrackFromRemoteParticipant(participant)
  const audioTrack = getAudioTrackFromRemoteParticipant(participant)

  React.useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !videoTrack) return

    try {
      videoTrack.attach(videoEl)
      console.log('[Seat Video Attached]', {
        identity: participant?.identity,
        trackSid: videoTrack.sid,
        elementConnected: videoEl.isConnected,
        width: videoEl.clientWidth,
        height: videoEl.clientHeight,
        readyState: videoEl.readyState,
        paused: videoEl.paused,
        hasSrcObject: Boolean(videoEl.srcObject),
        mediaTrackState: videoTrack.mediaStreamTrack?.readyState,
        mediaTrackEnabled: videoTrack.mediaStreamTrack?.enabled,
        mediaTrackMuted: videoTrack.mediaStreamTrack?.muted,
      })
      videoEl.play().catch(() => {})
    } catch (err) {
      console.warn('[BroadcastPage] Failed to attach remote seat video track:', err)
    }

    return () => {
      try {
        videoTrack.detach(videoEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [videoTrack, videoTrack?.sid])

  React.useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl || !audioTrack) return

    try {
      audioTrack.attach(audioEl)
      audioEl.play().catch(() => {})
    } catch (err) {
      console.warn('[BroadcastPage] Failed to attach remote seat audio track:', err)
    }

    return () => {
      try {
        audioTrack.detach(audioEl)
      } catch {
        // ignore detach errors
      }
    }
  }, [audioTrack])

  React.useEffect(() => {
    if (!import.meta.env.DEV) return

    console.log('[BroadcastSeatVideoRender]', {
      participantIdentity: participant?.identity ?? null,
      hasParticipant: Boolean(participant),
      cameraTrackSid: videoTrack?.sid ?? null,
      cameraTrackKind: videoTrack?.kind ?? null,
    })
  }, [participant?.identity, videoTrack?.sid, videoTrack?.kind])

  return (
    <>
      {videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() =>
            console.log('[Seat Video] loadedmetadata')
          }
          onPlaying={() =>
            console.log('[Seat Video] playing')
          }
          onError={(event) =>
            console.error('[Seat Video] error', event)
          }
          className="absolute inset-0 h-full w-full object-contain object-center"
        />
      ) : (
        <>{fallback}</>
      )}
      <audio ref={audioRef} autoPlay />
    </>
  )
})

function normalizeUuid(value: unknown): string | null {
  const text = String(value || '').trim().toLowerCase()
  const match = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  return match?.[0]?.toLowerCase() || null
}

function findSeatRemoteParticipant(
  seat: any,
  participants: RemoteParticipant[],
): RemoteParticipant | null {
  const seatUserId = normalizeUuid(seat?.user_id)
  const seatGuestId = String(seat?.guest_id || '').trim().toLowerCase()

  const storedLiveKitIdentity = String(
    seat?.livekit_participant_identity ||
      seat?.participant_identity ||
      seat?.livekit_identity ||
      seat?.seat_identity ||
      '',
  )
    .trim()
    .toLowerCase()

  for (const participant of participants) {
    const participantIdentity = String(
      participant?.identity || '',
    )
      .trim()
      .toLowerCase()

    const participantUserId = normalizeUuid(participantIdentity)

    let metadata: Record<string, any> = {}

    try {
      metadata =
        typeof participant.metadata === 'string' &&
        participant.metadata.trim()
          ? JSON.parse(participant.metadata)
          : {}
    } catch {
      metadata = {}
    }

    const metadataUserId = normalizeUuid(
      metadata.user_id ||
        metadata.userId ||
        metadata.uid,
    )

    const metadataGuestId = String(
      metadata.guest_id ||
        metadata.guestId ||
        '',
    )
      .trim()
      .toLowerCase()

    if (
      storedLiveKitIdentity &&
      participantIdentity === storedLiveKitIdentity
    ) {
      return participant
    }

    if (
      seatUserId &&
      (
        participantUserId === seatUserId ||
        metadataUserId === seatUserId
      )
    ) {
      return participant
    }

    if (
      seatGuestId &&
      (
        participantIdentity.includes(seatGuestId) ||
        metadataGuestId === seatGuestId
      )
    ) {
      return participant
    }
  }

  return null
}
function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function getParticipantLabel(participant: any, fallbackOrSeat: string | any = 'Viewer') {
  const seat = typeof fallbackOrSeat === 'object' ? fallbackOrSeat : null
  const fallback = typeof fallbackOrSeat === 'string' ? fallbackOrSeat : 'Viewer'

  if (!participant && !seat) return fallback

  const seatProfile =
    seat?.user_profile ||
    seat?.profile ||
    seat?.user_profiles ||
    null

  let metadata: any = null
  try {
    metadata = participant?.metadata
      ? JSON.parse(participant.metadata)
      : null
  } catch {
    metadata = null
  }

  const identity = getRemoteParticipantIdentity(participant)
  const normalizedIdentity = normalizeIdentityToken(identity)

  // A participant's LiveKit `name` can fall back to their email address when
  // their username is unset. Seat labels must only ever show the username, so
  // any email-like name is discarded in favour of the resolved seat profile
  // username (which becomes the fallback passed in by the caller).
  const isEmailName =
    Boolean(participant?.name) && String(participant.name).includes('@')
  const participantName = isEmailName ? undefined : participant?.name

  return (
    seatProfile?.username ||
    seat?.username ||
    metadata?.username ||
    participantName ||
    (seat?.user_id ? `User ${String(seat.user_id).slice(0, 6)}` : '') ||
    (isEmailName
      ? ''
      : (normalizedIdentity && !isUuidLike(normalizedIdentity) && !normalizedIdentity.startsWith('viewer-')
        ? normalizedIdentity
        : '')) ||
    fallback
  )
}

function getParticipantList(
  participants: Map<string, RemoteParticipant> | RemoteParticipant[] | null | undefined,
): RemoteParticipant[] {
  if (!participants) return []
  if (Array.isArray(participants)) return participants
  if (typeof participants.values === 'function') return Array.from(participants.values())
  return []
}

function isGhostParticipant(participant: any): boolean {
  const metadata = getRemoteParticipantMetadata(participant)
  return metadata?.role === 'ghost' || metadata?.hidden === true
}





const GhostAudioTrack = React.memo(function GhostAudioTrack({ participant }: { participant: any }) {
  const audioEl = React.useRef<HTMLAudioElement | null>(null)
  const audioTrack = getAudioTrackFromRemoteParticipant(participant)

  React.useEffect(() => {
    const el = audioEl.current
    if (!el || !audioTrack) return

    try {
      audioTrack.attach(el)
      el.play().catch(() => {})
    } catch (err) {
      console.warn('[BroadcastPage] Failed to attach ghost audio:', err)
    }

    return () => {
      try { audioTrack.detach(el) } catch {}
    }
  }, [audioTrack])

  return (
    <audio
      ref={audioEl}
      autoPlay
      muted={false}
      style={{ position: 'absolute', left: '-9999px' }}
    />
  )
})

import ShareModal from '@/components/broadcast/ShareModal'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getCategoryConfig } from '@/config/broadcastCategories'
import { useBattleState } from '@/hooks/useBattleState'
import { useBroadcastAbilities } from '@/hooks/useBroadcastAbilities'
import { useBroadcastPinnedProducts } from '@/hooks/useBroadcastPinnedProducts'
import { BroadcastGift } from '@/hooks/useBroadcastRealtime'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'
import { useBroadcastTextPopup } from '@/hooks/useBroadcastTextPopup'
import { logActiveChannels } from '@/lib/realtimeChannelDiagnostics'
import BroadcastTextPopupOverlay from '@/components/broadcast/BroadcastTextPopupOverlay'
import BroadcastTextPopupComposer from '@/components/broadcast/BroadcastTextPopupComposer'
import RandomBattleBanner from '@/components/broadcast/RandomBattleBanner'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'
import { useStreamSeats } from '@/hooks/useStreamSeats'
import { useStreamAudiencePresence, StreamAudienceMember } from '@/hooks/useStreamAudiencePresence'
import { useSubscriberUsernames } from '@/hooks/useCreatorSubscription'
import { useBroadcastShutdown } from '@/hooks/useBroadcastShutdown'
import { DEFAULT_BATTLE_THEME_ID, normalizeBattleTheme } from '@/lib/battleThemes'
import { emitEvent } from '@/lib/events'
import { sendChatThroughGate } from '@/lib/sendChatThroughGate'
import { sendStreamBroadcast } from '@/lib/realtime/streamRealtimeManager'
import { getGiftVisualConfig } from '@/lib/giftVisuals'
import { hydrateGiftForOverlay } from '@/lib/gifts'

import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { PreflightStore, usePreflightStore } from '@/lib/preflightStore'
import { Maximize2, MessageSquare, Mic, MicOff, Video, VideoOff, Crown, X, Ticket, Plus, Minus, Users, Pin, Lock, UserPlus, Wifi, BadgeCheck, Sparkles, ShoppingBag, BarChart3, Shield, Swords, ArrowLeft, Gamepad2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import AbilityBox from '@/components/broadcast/AbilityBox'
import BattleView from '@/pages/broadcast/BattleView'
import BroadcastAbilityEffects from '@/components/broadcast/BroadcastAbilityEffects'
import BroadcasterStatsModal from '@/components/broadcast/BroadcasterStatsModal'
import CoinStoreModal from '@/components/broadcast/CoinStoreModal'
import GiftBoxModal from '@/components/broadcast/GiftBoxModal'
import GiftAnimationLayer from '@/components/broadcast/GiftAnimationLayer'
import TargetedGiftOverlay from '@/components/broadcast/TargetedGiftOverlay'
import { useTargetedGiftQueue, getGiftTargetKey, normalizeGiftRow, type StreamGiftEvent } from '@/hooks/useTargetedGiftQueue'
import { useGiftAnimationPipeline } from '@/hooks/useGiftAnimationPipeline'
import GiftVideoOverlay from '@/components/broadcast/GiftVideoOverlay'
import PinProductModal from '@/components/broadcast/PinProductModal'
import UserActionModal from '@/components/broadcast/UserActionModal'
import ModActionsPopup from '@/components/broadcast/ModActionsPopup'
import CityStatusPanel from '@/components/city/CityStatusPanel'
import CityStatusOrb from '@/components/city/CityStatusOrb'
import { useCityStatusOrb } from '@/lib/hooks/useCityStatusOrb'
import SeatCityStatusOrb from '@/components/broadcast/SeatCityStatusOrb'
import RaidPanel from '@/components/city/RaidPanel'
import RaidModal from '@/components/city/RaidModal'
import PaidChatSettingsModal from '@/components/broadcast/PaidChatSettingsModal'
import AuctionMePanel from '@/components/broadcast/AuctionMePanel'

// Debug counters for broadcast stability verification
const DEBUG_COUNTERS = {

  broadcastPageMountCount: 0,

  broadcastPageUnmountCount: 0,
  broadcastRouterRouteDecisionCount: 0,
  livekitRoomCreatedCount: 0,
  livekitRoomDisconnectedCount: 0,
  hostAudioTrackCreatedCount: 0,
  hostVideoTrackCreatedCount: 0,
  hostAudioVideoPublishedCount: 0,
  broadcastGridRenderCount: 0,
  participantTileRenderCount: new Map<string, number>(),
  supabaseChannelCreatedCount: 0,
  supabaseChannelRemovedCount: 0,
  supabaseChannelActiveCount: 0,
  supabaseChannelCreatedMap: new Map<string, number>(),
  supabaseChannelCleanupMap: new Map<string, number>(),
  useGiftSystemInitCount: 0,
  trackSubscribedCount: 0,
  trackUnsubscribedCount: 0,
};

// Global debug counter access
if (typeof window !== 'undefined') {
  ;(window as any).DEBUG_COUNTERS = DEBUG_COUNTERS;
}

const removeStreamChannels = async (streamId: string) => {
  const matchingChannels = supabase
    .getChannels()
    .filter((channel) => channel.topic.includes(streamId))

  await Promise.all(
    matchingChannels.map((channel) => supabase.removeChannel(channel)),
  )
}

/**
 * BroadcastPage
 *
 * Broadcaster publishes via LiveKit RTC.
 * Participants join through LiveKit as audience members.
 */

const SUPABASE_PUBLIC_PATH = '/storage/v1/object/public/'
const SUPABASE_SIGN_PATH = '/storage/v1/object/sign/'
const DESKTOP_AUDIENCE_TICKER_HEIGHT = 56

function isPlayableUrl(url: unknown): boolean {
  return (
    typeof url === 'string' &&
    url.trim().length > 0 &&
    (
      url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith('/') ||
      url.startsWith('blob:')
    )
  )
}

async function resolvePlayableStorageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('blob:') || trimmed.startsWith('/')) {
    // Public Supabase storage URLs contain /storage/v1/object/public/ — these
    // are directly accessible and need no signing.
    if (trimmed.includes(SUPABASE_PUBLIC_PATH)) {
      return trimmed
    }

    // Private storage URLs use /storage/v1/object/sign/ — generate a signed URL.
    if (trimmed.includes(SUPABASE_SIGN_PATH)) {
      const match = trimmed.match(new RegExp(`${SUPABASE_SIGN_PATH}([^/]+)/(.+)$`))
      if (match) {
        const bucket = match[1]
        const path = decodeURIComponent(match[2])
        try {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
          return signed?.signedUrl || trimmed
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[BroadcastGiftVideo] failed to sign private storage URL', { bucket, path, err })
          }
          return trimmed
        }
      }
    }

    return trimmed
  }

  return trimmed
}

export function BroadcastPage() {
  const params = useParams()
  const navigate = useNavigate()
  const resolvedStream = useResolvedStream()
  const streamId = useResolvedStreamId(params.id || params.streamId)

  const { user, profile } = useAuthStore()
  const { clearTracks, screenTrack, screenAudioTrack, cameraTrack } = useStreamStore()
  const { isMobileWidth, hasMounted } = useIsMobile()
  const { recordStreamStarted } = useTrollFamilyActivity()
  const {
    featuredBroadcasters,
    featuredEvent,
    isFeaturedEvent,
    currentStreamFeatured,
    leaderboardOpen,
    openFeaturedLeaderboard,
    closeFeaturedLeaderboard,
  } = useFeaturedLive({ streamId, enabled: !!streamId })

  // Add render counter for debugging
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (renderCountRef.current % 10 === 1 && import.meta.env.DEV) {
    console.debug(`[BroadcastPage] Render #${renderCountRef.current} for streamId: ${streamId}`)
  }

  useEffect(() => {
    DEBUG_COUNTERS.broadcastPageMountCount++
    console.log(`[BroadcastPage] MOUNT COUNT: ${DEBUG_COUNTERS.broadcastPageMountCount} for streamId: ${streamId}`)
    if (isStreamAdmin) logActiveChannels(`BroadcastPage:mount:${streamId}`)

    return () => {
      DEBUG_COUNTERS.broadcastPageUnmountCount++
      console.log(`[BroadcastPage] UNMOUNT COUNT: ${DEBUG_COUNTERS.broadcastPageUnmountCount} for streamId: ${streamId}`)
      if (isStreamAdmin) logActiveChannels(`BroadcastPage:unmount:${streamId}`)
    }
  }, [])

  // Determine if user is admin for video quality (1080p admin, 720p regular)
  const isStreamAdmin = !!(profile && (
    profile.role === 'admin' || profile.is_admin ||
    profile.is_superadmin || profile.role === 'owner'
  ))

   const isOfficer = isStaffProfile(profile)

  const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const [stream, setStream] = useState<Stream | null>(resolvedStream)

    const isAzgoraStream = Boolean((stream as any)?.is_azgora) || (stream as any)?.quality_cap === '720p'
    const videoPreset = isAzgoraStream
      ? VideoPresets.h720
      : isStreamAdmin
        ? VideoPresets.h1080
        : (isMobileDevice ? VideoPresets.h540 : VideoPresets.h720)

    const [broadcasterProfile, setBroadcasterProfile] = useState<any>(null);

   // -- Channel diagnostics (dev only, admin only) --
  useEffect(() => {
    if (!isStreamAdmin) return;
    if (stream?.is_battle && stream?.battle_id) {
      logActiveChannels(`BroadcastPage:battle:${stream.battle_id}`)
    } else {
      logActiveChannels(`BroadcastPage:live:${streamId}`)
    }
  }, [stream?.is_battle, stream?.battle_id, streamId]);

   const [streamMods, setStreamMods] = useState<string[]>([]);
   // Accumulate gift amounts received while broadcasterProfile is still loading (null);
   // applied once the profile arrives via @see applyPendingGiftsEffect
      const isHost = stream?.user_id === user?.id
     const isBroadcaster = isHost;

     const cashoutBanner = useCashoutBanner({
       userId: user?.id,
       isEligible: isHost,
       streamId: streamId || null,
     })

      // Celeb stream: no seats, viewer-only participation with paid chat + products
     const isCelebStream = stream?.stream_type === 'celeb_stream'
     const isApprovedCeleb = !!(profile && profile.celeb_role === 'approved')

      const isStreamLive = stream?.status === 'live' && stream?.is_live === true;

      useEffect(() => {
        if (!isStreamLive) return;

        let wakeLock: any = null;

        const requestWakeLock = async () => {
          try {
            if ('wakeLock' in navigator) {
              wakeLock = await (navigator as any).wakeLock.request('screen');
            }
          } catch (err) {
            console.warn('[BroadcastPage] Wake lock failed:', err);
          }
        };

        void requestWakeLock();

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            void requestWakeLock();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          if (wakeLock) {
            wakeLock.release().catch(() => {});
          }
        };
      }, [isStreamLive]);

     // CityStatusOrb for broadcaster box display
   const broadcasterCityStatus = useCityStatusOrb({
     userId: stream?.user_id || '',
     broadcasterId: user?.id,
     isBroadcaster: isHost,
     isBroadOfficer: isOfficer,
   })

const { seats, mySeat, joiningSeatId, leavingSeatId, joinSeat, leaveSeat, markSeatLive, refreshSeats, removeSeat, removeSeatByUserId } = useStreamSeats(streamId || '', user?.id, broadcasterProfile, stream as any)
    const { audience, activeAudience, topAudience, myPresence, joinAudience, leaveAudience, heartbeatAudience, incrementGiftTotal } = useStreamAudiencePresence(streamId || '', user?.id)

    const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
    const [remoteParticipantSnapshots, setRemoteParticipantSnapshots] = useState<RemoteParticipantSnapshot[]>([])
    const [showCollaborationModal, setShowCollaborationModal] = useState(false)
    const [showCameraOffImageModal, setShowCameraOffImageModal] = useState(false)
    const remoteUsers = useMemo(() => Array.from(remoteParticipants.values()), [remoteParticipants])
    const collaboration = useStreamCollaboration({
      currentUserId: user?.id,
      currentStreamId: streamId,
      currentPlatform: 'mai_troll_broadcast',
    })

    const buildRemoteParticipantSnapshots = useCallback((room: Room) => {
      return Array.from(room.remoteParticipants.values()).map((participant) => {
        const cameraPublication = participant.getTrackPublication(
          Track.Source.Camera,
        ) as RemoteTrackPublication | undefined

        const microphonePublication = participant.getTrackPublication(
          Track.Source.Microphone,
        ) as RemoteTrackPublication | undefined

        return {
          identity: participant.identity,
          participant,
          cameraPublication,
          microphonePublication,
          cameraTrack: cameraPublication?.track as RemoteVideoTrack | undefined,
          microphoneTrack:
            microphonePublication?.track as RemoteAudioTrack | undefined,
        }
      })
    }, [])

    const syncRemoteParticipantSnapshots = useCallback(() => {
      const room = roomRef.current
      if (!room) return
      setRemoteParticipantSnapshots(buildRemoteParticipantSnapshots(room))
    }, [buildRemoteParticipantSnapshots])

    // Anonymous viewers watch via LiveKit but are NOT written to
    // stream_audience_presence (user_id is an FK to user_profiles). They appear in
    // the LiveKit room as remote participants. Inject a synthetic audience member
    // per anonymous participant so the host's ticker shows them as an anon profile
    // pic without polluting the real presence table.
    const audienceWithAnon = useMemo(() => {
      if (!remoteUsers?.length) return audience

      const hostId = String(stream?.user_id || '').trim()
      const syntheticMembers: StreamAudienceMember[] = remoteUsers
        .filter((participant: any) => {
          if (!participant?.identity) return false
          if (isGhostParticipant(participant)) return false

          const metadata = getRemoteParticipantMetadata(participant)
          if (metadata?.role === 'broadcaster') return false
          if (metadata?.seat_index || metadata?.seatIndex) return false
          if (metadata?.user_id === hostId || metadata?.userId === hostId) return false

          return true
        })
        .map((participant: any) => {
          const metadata = getRemoteParticipantMetadata(participant)
          const identity = getRemoteParticipantIdentity(participant)
          const userId = String(metadata?.user_id || metadata?.userId || identity)
          const username = String(metadata?.username || participant?.name || 'Viewer')
          return {
            id: `remote:${userId}`,
            stream_id: streamId || '',
            user_id: userId,
            username,
            avatar_url: metadata?.avatar_url ?? null,
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
        })

      if (syntheticMembers.length === 0) return audience
      const existingIds = new Set(audience.map((m) => m.user_id))
      const filtered = syntheticMembers.filter((m) => !existingIds.has(m.user_id))
      return [...filtered, ...audience]
    }, [audience, remoteUsers, stream?.user_id, streamId])

    // Broadcast frame - decorative border for host's stream
    const broadcastFrame = useBroadcastFrame(stream?.user_id)

  const normalizeSeatStatus = (status?: string | null) => String(status || '').trim().toLowerCase()
  const isSeatActiveStatus = (status?: string | null) => {
    const normalized = normalizeSeatStatus(status)

    return ['active', 'live', 'reserved', 'camera_starting'].includes(normalized)
  }

  const configuredViewerSeatCount = useMemo(() => {
    const maxSeats = 6
    // seat_count = guest seats only (broadcaster is NOT a seat)
    const seatCount = stream?.seat_count !== undefined ? Number(stream.seat_count) : undefined
    if (seatCount !== undefined) {
      if (seatCount === 0) return 0 // broadcaster only, no guest seats
      return Math.max(0, Math.min(maxSeats, seatCount))
    }

    const boxCount = Number(stream?.box_count ?? 0)
    if (boxCount > 0) {
      return Math.max(0, Math.min(maxSeats, boxCount - 1))
    }

    const derivedFromPrices = Array.isArray(stream?.seat_prices)
      ? Math.max(0, stream.seat_prices.length - 1)
      : 0

    if (derivedFromPrices > 0) {
      return Math.min(maxSeats, derivedFromPrices)
    }

    return 0
  }, [stream?.box_count, stream?.seat_count, stream?.seat_prices])

  // Total boxes including broadcaster (for layout decisions)
  const totalBoxCount = useMemo(() => {
    return Math.max(1, configuredViewerSeatCount + 1)
  }, [configuredViewerSeatCount])

  // Layout mode: 'split' for <=6 total boxes, 'grid' for >6
  const layoutMode = useMemo(() => {
    return totalBoxCount <= 6 ? 'split' : 'grid'
  }, [totalBoxCount])

  const currentViewerSeatCount = configuredViewerSeatCount

  const viewerSeatCards = useMemo(() => {
    if (currentViewerSeatCount <= 0) return []
    if (isCelebStream) return []

    return Array.from({ length: currentViewerSeatCount }, (_, offset) => {
      const seatIndex = offset + 1
      const seat = seats?.[seatIndex]
      const seatUserId = seat?.user_id || seat?.guest_id || null
      const seatIdentity = seat?.livekit_participant_identity || seat?.participant_identity || seat?.livekit_identity || seatUserId || null
      const seatPrice = Array.isArray(stream?.seat_prices)
        ? Number(stream.seat_prices[seatIndex] ?? stream?.seat_price ?? 0)
        : Number(stream?.seat_price ?? 0)
      const seatStatus = normalizeSeatStatus(seat?.status)
      const isOccupied = Boolean(
        isSeatActiveStatus(seatStatus) &&
          (seat?.user_id || seat?.guest_id || seatUserId),
      )
      const displayName =
        seat?.user_profile?.username ||
        seat?.user_profile?.display_name ||
        (seat as any)?.username ||
        'Viewer'
      const avatarUrl = seat?.user_profile?.avatar_url || null
      const participants = Array.from(remoteParticipants.values())
      const matchedParticipant = seat ? findSeatRemoteParticipant(seat, participants) : null
      const matchedSnapshot = matchedParticipant
        ? remoteParticipantSnapshots.find((s) => s.participant === matchedParticipant)
        : null
      console.log('[Seat Card]', {
        seatIndex,
        seatUserId: seat?.user_id,
        livekitIdentity: seat?.livekit_participant_identity,
        participantIdentity: matchedParticipant?.identity,
        matched: !!matchedParticipant,
        hasCameraTrack: !!matchedSnapshot?.cameraTrack,
      })
      return {
        seatIndex,
        seatUserId,
        seatPrice,
        isOccupied,
        displayName,
        avatarUrl,
        seatStatus,
        seatIdentity,
        seatSessionId: seat?.id || undefined,
        remoteParticipant: matchedParticipant,
        remoteParticipantSnapshot: matchedSnapshot,
      }
    })
  }, [currentViewerSeatCount, seats, stream?.seat_price, stream?.seat_prices, remoteParticipants, remoteParticipantSnapshots])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.log('[Seat Card]', viewerSeatCards.map((seat) => ({
      seatIndex: seat.seatIndex,
      seatUserId: seat.seatUserId,
      livekitIdentity: seat.seatIdentity,
      participantIdentity: seat.remoteParticipant?.identity ?? null,
      matched: !!seat.remoteParticipant,
      hasCameraTrack: !!seat.remoteParticipantSnapshot?.cameraTrack,
    })))
  }, [viewerSeatCards])

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

  const roomName = useMemo(() => {
    return getLiveKitRoomName(stream as Stream | null, streamId) || ''
  }, [stream?.livekit_room_name, stream?.id, streamId]);

  const hasValidStreamId = !!streamId && typeof streamId === 'string' && streamId.trim() !== '';
  const sessionReady = !!user && !!profile && hasValidStreamId && !!roomName;

  // INSTANT JOIN: Set isLoading to false initially to show content immediately
  // Stream data will load in background while user sees the page
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // INSTANT JOIN: Track if initial stream fetch is complete but don't block UI
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [isCurrentUserBroadofficer, setIsCurrentUserBroadofficer] = useState(false)
  const canInteractWithSeats = isHost || isOfficer || isCurrentUserBroadofficer
  // Track battle start time to show accurate timer
  const [battleStartTime, setBattleStartTime] = useState<Date | null>(null)
  
  const audioTrackRef = useRef<LocalAudioTrack | null>(null)
  const videoTrackRef = useRef<LocalVideoTrack | null>(null)
  const [localTracksVersion, setLocalTracksVersion] = useState(0)
  const localTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(null)
  const localTracks = useMemo<[LocalAudioTrack | null, LocalVideoTrack | null] | null>(() => {
    const audioTrack = audioTrackRef.current
    const videoTrack = videoTrackRef.current
    return audioTrack || videoTrack ? [audioTrack, videoTrack] : null
  }, [localTracksVersion])

  // Host users publish through this local track state.
  const combinedLocalTracks = localTracks
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
  const mountCountRef = useRef(0)
  const livekitRoomCreatedCountRef = useRef(0)
  const livekitRoomDisconnectedCountRef = useRef(0)
  const localTrackCreatedCountRef = useRef(0)
  const localTrackPublishedCountRef = useRef(0)
  const cameraToggleQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const microphoneToggleQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const timeoutsRef = useRef<Set<number>>(new Set())
  const intervalsRef = useRef<Set<number>>(new Set())
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user')
  const isGoingLiveRef = useRef(false)
  const streamEndedRef = useRef(false)

  const trackedTimeout = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current.delete(id)
      fn()
    }, ms)
    timeoutsRef.current.add(id)
    return id
  }

  const trackedInterval = (fn: () => void, ms: number) => {
    const id = window.setInterval(fn, ms)
    intervalsRef.current.add(id)
    return id
  }

   useEffect(() => {
     mountCountRef.current += 1
     console.debug('[BroadcastPage] mount count', mountCountRef.current, 'render count', renderCountRef.current, 'streamId', streamId)
     console.debug('[BroadcastPage] LiveKit debug counts', {
       livekitRoomCreated: livekitRoomCreatedCountRef.current,
       livekitRoomDisconnected: livekitRoomDisconnectedCountRef.current,
       localTrackCreated: localTrackCreatedCountRef.current,
       localTrackPublished: localTrackPublishedCountRef.current,
     })
     return () => {
       console.debug('[BroadcastPage] BroadcastPage unmounted for streamId', streamId)
       timeoutsRef.current.forEach(id => clearTimeout(id))
       intervalsRef.current.forEach(id => clearInterval(id))
       timeoutsRef.current.clear()
       intervalsRef.current.clear()
     }
   }, [streamId])

  const getLiveKitUrl = () => {
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
    if (!livekitUrl) {
      console.error('[BroadcastPage] Missing LiveKit URL - check VITE_LIVEKIT_URL')
      toast.error('LiveKit server URL is not configured')
    }
    return livekitUrl
  }

  const connectRoom = async (room: Room, token: string) => {
    if (room.state === 'connected') {
      return
    }

    if (room.state === 'connecting' || room.state === 'reconnecting') {
      console.log('[BroadcastPage] Room is already connecting, skipping duplicate connect')
      return
    }

    const livekitUrl = getLiveKitUrl()
    if (!livekitUrl) {
      console.error('[BroadcastPage] LiveKit URL not configured, skipping connection')
      return
    }
    console.log('[BroadcastPage] Connecting to LiveKit URL:', livekitUrl)
    await room.connect(livekitUrl, token)
  }

 
  useEffect(() => {
    localTracksRef.current = localTracks
  }, [localTracks])

  useEffect(() => {
    if (sessionStorage.getItem('tc_starting_stream') === 'true') {

      sessionStorage.removeItem('tc_starting_stream');
    }
  }, [])

  // Guard cleanup on unmount - don't clear tracks when going live
  useEffect(() => {
    return () => {
      if (!isGoingLiveRef.current) {

        clearTracks();
      } else {

      }
    };
  }, [clearTracks]);

  // Check if user is jailed before allowing broadcast
  useEffect(() => {
    if (!user?.id) return;

    const checkJailStatus = async () => {
      try {
        const { data } = await supabase
          .from('jail')
          .select('id, release_time')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const releaseTime = new Date(data.release_time);
          if (releaseTime > new Date()) {

            toast.error('You are in jail and cannot broadcast');
            navigate('/jail', { replace: true });
            return;
          }
        }
      } catch (error) {

      }
    };

    checkJailStatus();
  }, [user?.id, navigate]);

  const publishTrackOrClone = async <T extends LocalAudioTrack | LocalVideoTrack>(
    track: T | undefined,
    room: Room,
    kind: 'audio' | 'video'
  ): Promise<T | undefined> => {
    if (!track) return undefined

    const tryPublish = async (candidate: T): Promise<T | undefined> => {
      try {
        await room.localParticipant.publishTrack(candidate)
        localTrackPublishedCountRef.current += 1
        return candidate
      } catch (err) {
        const trackIdentifier = (candidate as any).trackId || (candidate as any).sid || 'unknown'
        console.warn(
          `[BroadcastPage] Failed to publish ${kind} track`,
          err,
          { trackId: trackIdentifier, kind }
        )
        return undefined
      }
    }

    const published = await tryPublish(track)
    if (published) return published

    // If direct publication fails, attempt to recreate the LiveKit track from the native MediaStreamTrack
    try {
      const trackLike = track as unknown as {
        getMediaStreamTrack?: () => MediaStreamTrack | undefined
        mediaStreamTrack?: MediaStreamTrack
      }
      const mediaTrack = trackLike.getMediaStreamTrack?.() || trackLike.mediaStreamTrack
      if (!mediaTrack) {
        console.warn('[BroadcastPage] No native media track available for clone publish', { kind })
        return undefined
      }

      console.log('[BroadcastPage] Cloning preflight track from native MediaStreamTrack', {
        kind,
        label: mediaTrack.label,
        enabled: mediaTrack.enabled,
      })

      const clonedTrack = kind === 'video'
        ? (new LocalVideoTrack(mediaTrack) as T)
        : (new LocalAudioTrack(mediaTrack) as T)

      localTrackCreatedCountRef.current += 1
      return await tryPublish(clonedTrack)
    } catch (err) {
      console.warn('[BroadcastPage] Failed to clone and publish preflight track', err)
      return undefined
    }
  }

  const handleLiveKitParticipantConnected = useCallback((participant: RemoteParticipant) => {
    if (!participant?.identity) return

    const metadata = getRemoteParticipantMetadata(participant)

    console.log('[HOST PARTICIPANT CONNECTED]', {
      identity: participant.identity,
      metadata,
      expectedSeatUserId: 'ac9a4ff4-ff9f-4ac2-857e-d03eb12b8193',
      videoPublications: Array.from(
        participant.videoTrackPublications?.values?.() || [],
      ).map((publication: any) => ({
        trackSid: publication.trackSid,
        source: publication.source,
        isSubscribed: publication.isSubscribed,
        hasTrack: Boolean(publication.track),
      })),
      audioPublications: Array.from(
        participant.audioTrackPublications?.values?.() || [],
      ).map((publication: any) => ({
        trackSid: publication.trackSid,
        source: publication.source,
        isSubscribed: publication.isSubscribed,
        hasTrack: Boolean(publication.track),
      })),
    })

    setRemoteParticipants(prev => {
      const next = new Map(prev)
      next.set(participant.identity, participant)
      return next
    })
  }, [])

  const handleLiveKitParticipantDisconnected = useCallback((participant: RemoteParticipant) => {
    const identity = participant.identity
    setRemoteParticipants(prev => {
      const next = new Map(prev)
      next.delete(participant.identity)
      return next
    })
  }, [])

  const seatsRefForTrackHandler = useRef(seats)
  useEffect(() => {
    seatsRefForTrackHandler.current = seats
  }, [seats])

  const handleLiveKitTrackSubscribed = useCallback((_track: any, _publication: any, participant: RemoteParticipant) => {
    DEBUG_COUNTERS.trackSubscribedCount++

    console.log('[HOST TRACK SUBSCRIBED]', {
      participantIdentity: participant.identity,
      participantMetadata: getRemoteParticipantMetadata(participant),
      trackKind: _track?.kind,
      trackSource: _publication?.source,
      trackSid: _publication?.trackSid,
      seatRows: Object.values(seatsRefForTrackHandler.current).map(
        (seat: any) => ({
          seatIndex: seat.seat_index,
          userId: seat.user_id,
          status: seat.status,
          livekitParticipantIdentity:
            seat.livekit_participant_identity,
        }),
      ),
    })

    if (!participant?.identity) return

    setRemoteParticipants((prev) => {
      const existing = prev.get(participant.identity)

      if (existing === participant) {
        return prev
      }

      const next = new Map(prev)
      next.set(participant.identity, participant)
      return next
    })

    const metadata = getRemoteParticipantMetadata(participant)
    const participantUserId = String(metadata?.user_id || metadata?.userId || '')
    const participantSeatIndex = Number(metadata?.seat_index ?? metadata?.seatIndex ?? NaN)

    const seatMatchedBySeats = Object.values(seatsRefForTrackHandler.current).some((seat: any) => {
      const seatUserId = String(seat?.user_id || seat?.guest_id || '')
      const seatIdentity = String(seat?.livekit_participant_identity || seat?.participant_identity || seat?.livekit_identity || '')
      const normalizedSeatIndex = Number(seat?.seat_index ?? seat?.seatIndex ?? NaN)

      const identityMatches =
        participantSeatIndex > 0 && normalizedSeatIndex === participantSeatIndex
      const userIdMatches =
        seatUserId && participantUserId && seatUserId === participantUserId
      const identityExact =
        seatIdentity && participant.identity && participant.identity === seatIdentity

      const identitySuffix =
        seatUserId &&
        participant.identity &&
        (participant.identity === seatUserId ||
          participant.identity.endsWith(`-${seatUserId}`) ||
          seatUserId.endsWith(`-${participant.identity}`))

      const metadataSuffix =
        seatUserId &&
        participantUserId &&
        (participantUserId === seatUserId ||
          participantUserId.endsWith(`-${seatUserId}`) ||
          seatUserId.endsWith(`-${participantUserId}`))

      return (
        identityMatches ||
        userIdMatches ||
        identityExact ||
        identitySuffix ||
        metadataSuffix
      )
    })

    if (!seatMatchedBySeats) {
      console.warn('[BroadcastPage] Remote participant did not match a seat:', {
        participantIdentity: participant.identity,
        participantUserId,
        participantSeatIndex,
        metadata,
        seats: Object.values(seatsRefForTrackHandler.current).map(
          (seat: any) => ({
            seatIndex: seat?.seat_index,
            userId: seat?.user_id,
            guestId: seat?.guest_id,
            livekitIdentity:
              seat?.livekit_participant_identity ||
              seat?.participant_identity ||
              seat?.livekit_identity ||
              null,
          }),
        ),
      })
    }

    setRemoteParticipantSnapshots((prev) => {
      const nextSnapshot: RemoteParticipantSnapshot = {
        identity: participant.identity,
        participant,
        cameraPublication: participant.getTrackPublication(
          Track.Source.Camera,
        ) as RemoteTrackPublication | undefined,
        microphonePublication: participant.getTrackPublication(
          Track.Source.Microphone,
        ) as RemoteTrackPublication | undefined,
      }

      nextSnapshot.cameraTrack =
        nextSnapshot.cameraPublication?.track as RemoteVideoTrack | undefined

      nextSnapshot.microphoneTrack =
        nextSnapshot.microphonePublication?.track as RemoteAudioTrack | undefined

      const index = prev.findIndex(
        (snapshot) => snapshot.identity === participant.identity,
      )

      if (index === -1) {
        return [...prev, nextSnapshot]
      }

      const current = prev[index]

      if (
        current.cameraTrack === nextSnapshot.cameraTrack &&
        current.microphoneTrack === nextSnapshot.microphoneTrack &&
        current.participant === participant
      ) {
        return prev
      }

      const next = [...prev]
      next[index] = nextSnapshot
      return next
    })
  }, [])

  const handleLiveKitTrackUnsubscribed = useCallback((track: any, _publication: any, participant: RemoteParticipant) => {
    DEBUG_COUNTERS.trackUnsubscribedCount++
    const remainingVideo = Array.from((participant.videoTrackPublications as any)?.values?.() || []).some((p: any) => p.track)
    const remainingAudio = Array.from((participant.audioTrackPublications as any)?.values?.() || []).some((p: any) => p.track)
    if (!remainingVideo && !remainingAudio) {
    setRemoteParticipants(prev => {
      const next = new Map(prev)
      next.delete(participant.identity)
      return next
    })
    }
  }, [])

  const handleLiveKitTrackPublished = useCallback(
    (publication: any, participant: RemoteParticipant) => {
      if (!participant?.identity || !publication) return

      console.log('[BroadcastPage] Remote track published:', {
        participantIdentity: participant.identity,
        source: publication.source,
        kind: publication.kind,
        trackSid: publication.trackSid,
        isSubscribed: publication.isSubscribed,
      })

      try {
        if (publication.setSubscribed && !publication.isSubscribed) {
          publication.setSubscribed(true)
        }
      } catch (err) {
        console.warn(
          '[BroadcastPage] Failed to subscribe to published remote track:',
          err,
        )
      }

      setRemoteParticipants(prev => {
        const next = new Map(prev)
        next.set(participant.identity, participant)
        return next
      })
    },
    [],
  )

  const attachLiveKitHandlers = useCallback((room: Room) => {
    room.off(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.off(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.off(RoomEvent.TrackPublished, handleLiveKitTrackPublished)
    room.off(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.off(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)
    room.off(RoomEvent.TrackMuted, syncRemoteParticipantSnapshots)
    room.off(RoomEvent.TrackUnmuted, syncRemoteParticipantSnapshots)
    room.on(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.on(RoomEvent.TrackPublished, handleLiveKitTrackPublished)
    room.on(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)
    room.on(RoomEvent.TrackMuted, syncRemoteParticipantSnapshots)
    room.on(RoomEvent.TrackUnmuted, syncRemoteParticipantSnapshots)
  }, [
    handleLiveKitParticipantConnected,
    handleLiveKitParticipantDisconnected,
    handleLiveKitTrackPublished,
    handleLiveKitTrackSubscribed,
    handleLiveKitTrackUnsubscribed,
    syncRemoteParticipantSnapshots,
  ])

  const detachLiveKitHandlers = useCallback((room: Room) => {
    room.off(RoomEvent.ParticipantConnected, handleLiveKitParticipantConnected)
    room.off(RoomEvent.ParticipantDisconnected, handleLiveKitParticipantDisconnected)
    room.off(RoomEvent.TrackPublished, handleLiveKitTrackPublished)
    room.off(RoomEvent.TrackSubscribed, handleLiveKitTrackSubscribed)
    room.off(RoomEvent.TrackUnsubscribed, handleLiveKitTrackUnsubscribed)
    room.off(RoomEvent.TrackMuted, syncRemoteParticipantSnapshots)
    room.off(RoomEvent.TrackUnmuted, syncRemoteParticipantSnapshots)
  }, [
    handleLiveKitParticipantConnected,
    handleLiveKitParticipantDisconnected,
    handleLiveKitTrackPublished,
    handleLiveKitTrackSubscribed,
    handleLiveKitTrackUnsubscribed,
    syncRemoteParticipantSnapshots,
  ])

  // ── Complete LiveKit room teardown ──────────────────────────────────
  // Unpublishes all tracks, detaches event handlers, disconnects the
  // socket, and nulls the ref. Use this everywhere the room must be
  // fully torn down (stream end, viewer leave, realtime ended, unload).
   useEffect(() => {
     const room = roomRef.current
     if (!room) return
     console.log('[HOST LIVEKIT ROOM]', {
       roomName: room.name,
       localIdentity: room.localParticipant?.identity,
       state: room.state,
     })
   }, [remoteParticipants])

   const disconnectLiveKitRoom = useCallback(() => {
    const room = roomRef.current
    if (!room) return

    // 1) Detach our custom handlers first so no events fire during teardown
    try {
      detachLiveKitHandlers(room)
    } catch (e) {
      console.warn('[BroadcastPage] Error detaching LiveKit handlers:', e)
    }

    // 2) Unpublish all local tracks so remote participants see us leave cleanly
    if (room.localParticipant) {
      const allPubs = [
        ...room.localParticipant.videoTrackPublications.values(),
        ...room.localParticipant.audioTrackPublications.values(),
      ]
      for (const pub of allPubs) {
        try {
          if (pub.track) {
            room.localParticipant.unpublishTrack(pub.track).catch(() => {})
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // 3) Remove all LiveKit room-level listeners
    try {
      room.removeAllListeners()
    } catch (e) {
      // ignore
    }

    // 4) Disconnect the WebSocket
    try {
      room.disconnect().catch(() => {})
    } catch (e) {
      // ignore
    }

    // 5) Null the ref so no stale references remain
    roomRef.current = null
    livekitRoomDisconnectedCountRef.current += 1
  }, [detachLiveKitHandlers])

  // Shared shutdown sequence used by the manual End button, tab close, refresh,
  // logout, component unmount, and unexpected disconnect. `stopRtc` performs the
  // full LiveKit teardown (unpublish + disconnect + session end + PreflightStore reset),
  // which is the LiveKit equivalent of the Agora setEnabled/stop/close + leave steps.
  // Detect whether this mount is a transition from SetupPage (room/tracks
  // already exist in PreflightStore) or a fresh start. During a transition
  // the unmount cleanup must NOT disconnect the adopted room or clear the
  // PreflightStore.
  const hasTransferSession = useMemo(() => {
    const session = PreflightStore.getTransferSession()
    return Boolean(session && session.room && session.room.state === 'connected')
  }, [])

  const { endBroadcast: endBroadcastShutdown, endingBroadcastRef } = useBroadcastShutdown({
    streamId,
    userId: user?.id,
    isLive: stream?.status === 'live' && stream?.is_live === true,
    isTransitioning: hasTransferSession,
    stopRtc: async () => {
      cleanupLocalMedia()
      setRemoteParticipants(new Map())
      disconnectLiveKitRoom()
      PreflightStore.clear()

      if (streamId) {
        void removeStreamChannels(streamId)
      }

      if (stream?.id) {
        try {
          const { data: session } = await supabase
            .from('rtc_sessions')
            .select('id, started_at')
            .eq('room_name', `stream-${stream.id}`)
            .eq('is_active', true)
            .maybeSingle()

          if (session) {
            const endTime = new Date().toISOString()
            const startTime = new Date(session.started_at)
            const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)
            await supabase
              .from('rtc_sessions')
              .update({ is_active: false, ended_at: endTime, duration_seconds: durationSeconds })
              .eq('id', session.id)
          }
        } catch (endErr) {
          console.warn('[BroadcastPage] rtc_sessions end failed:', endErr)
        }
      }
    },
    onEnded: (reason) => {
      setStream((prev: any) => (prev ? { ...prev, status: 'ended', is_live: false } : prev))
      // Manual/auto ends navigate; lifecycle (unload/disconnect) ends must not
      // navigate away (the page is already gone) — they only need DB + realtime.
      if (reason === 'manual' || reason === 'auto' || reason === 'admin') {
        if (isStaff) {
          navigate('/government/streams')
        } else {
          navigate(`/broadcast/summary/${stream?.id}`)
        }
      }
    },
  })

  // Check if screen share mode from sessionStorage (set by SetupPage for gaming category)
  const { storedScreenMode: initialScreenMode, storedCameraOverlay: initialCameraOverlay } = useMemo(() => {
    const storedScreenMode = sessionStorage.getItem('tc_broadcast_screen_mode') === 'true'
    const storedCameraOverlay = sessionStorage.getItem('tc_camera_overlay_enabled') === 'true'
    console.log('[BroadcastPage] Initial screen state:', { storedScreenMode, storedCameraOverlay })
    return { storedScreenMode, storedCameraOverlay }
  }, []) // Empty deps - only run once
   const [isScreenSharing, setIsScreenSharing] = useState(initialScreenMode)
   const [cameraOverlayEnabled, setCameraOverlayEnabled] = useState(initialCameraOverlay)
   const [cameraOverlayTrackState, setCameraOverlayTrackState] = useState<LocalVideoTrack | null>(null)

     // Ghost participants - separate collection for ghost mode (not merged with remoteParticipants)
   const [ghostParticipants, setGhostParticipants] = useState<Map<string, RemoteParticipant>>(new Map())
   const ghostUsers = useMemo(() => Array.from(ghostParticipants.values()), [ghostParticipants])
   
   // Debug: Log ghost mode state changes
   useEffect(() => {
     if (!import.meta.env.DEV) return;
     console.log('[BroadcastPage] Ghost mode state update:', {
       ghostParticipantsCount: ghostParticipants.size,
       ghostIdentities: Array.from(ghostParticipants.keys()),
       remoteParticipantsCount: remoteParticipants.size,
       visibleRemoteUsersCount: remoteUsers.length,
     })
   }, [ghostParticipants, remoteParticipants, remoteUsers])
   
   // Debug: Log when ghost participants appear in remoteUsers
useEffect(() => {
      if (!import.meta.env.DEV) return;
      const ghostInRemote = remoteUsers.filter(p => {
        const metadata = getRemoteParticipantMetadata(p)
        return metadata?.role === 'ghost' || metadata?.hidden === true
      })
      if (ghostInRemote.length > 0) {
        console.log('[BroadcastPage] Ghost participants detected in remoteUsers:', {
          count: ghostInRemote.length,
          identities: ghostInRemote.map((p: any) => p.identity),
          hasAudio: ghostInRemote.map((p: any) => !!getAudioTrackFromRemoteParticipant(p)),
        })
      }
    }, [remoteUsers])
   
   // Filter out ghost participants from remote users for display purposes
   // BUT keep them for audio - ghost participants need to be heard by viewers
   const visibleRemoteUsers = useMemo(() => {
     return remoteUsers.filter(p => {
       const metadata = getRemoteParticipantMetadata(p)
       return metadata?.role !== 'ghost' && !metadata?.hidden
     })
   }, [remoteUsers])
   
// Ghost audio participants - these are ghost participants whose audio we need to render
    // They are filtered from visibleRemoteUsers but their audio tracks must still be heard
    const ghostAudioParticipants = useMemo(() => {
      return remoteUsers.filter(p => {
        const metadata = getRemoteParticipantMetadata(p)
        return metadata?.role === 'ghost' || metadata?.hidden === true
      })
    }, [remoteUsers])
    
    // Debug: Log ghost mode audio state
 useEffect(() => {
      if (!import.meta.env.DEV) return;
      console.log('[BroadcastPage] Ghost audio debug:', {
        ghostAudioParticipantsCount: ghostAudioParticipants.length,
        ghostAudioIdentities: ghostAudioParticipants.map((p: any) => p.identity),
        ghostAudioWithTracks: ghostAudioParticipants.filter((p: any) => getAudioTrackFromRemoteParticipant(p)).length,
      })
    }, [ghostAudioParticipants])

    // ─── ISOLATED HOST PARTICIPANT STATE ───────────────────────────────────────
    // Track host participant identity in a ref to prevent seat join/leave disruptions
    const hostParticipantRef = useRef<any>(null)
    
    // Stable host participant lookup — only watches remoteParticipants and hostId directly
    const hostParticipant = useMemo(() => {
      if (!stream?.user_id || !remoteParticipants) return null
      
      const hostId = String(stream.user_id).trim()
      let foundHost: RemoteParticipant | null = null
      
      remoteParticipants.forEach((p: RemoteParticipant) => {
        const identity = String(p?.identity || '').trim()
        const metadata = getRemoteParticipantMetadata(p)
        const participantUserId = String(metadata?.user_id || metadata?.userId || '').trim()
        
        if (identity === hostId || participantUserId === hostId || identity.endsWith(`-${hostId}`)) {
          foundHost = p
        }
      })
      
      if (foundHost) {
        hostParticipantRef.current = foundHost
        return foundHost
      }
      
      // Keep last known good host participant if no match but we have one cached
      return hostParticipantRef.current
    }, [stream?.user_id, remoteParticipants])
  // Helper to safely get array from RemoteParticipants Map
  const getRemoteParticipantsArray = () => {
    if (!remoteParticipants || typeof remoteParticipants.values !== 'function') return []
    return Array.from(remoteParticipants.values()) as RemoteParticipant[]
  }
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [canSwipe, setCanSwipe] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [activeViewerProfiles, setActiveViewerProfiles] = useState<Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    role?: string;
    troll_role?: string;
    is_admin?: boolean;
    is_troll_officer?: boolean;
    is_lead_officer?: boolean;
    created_at: string;
    joined_at: string;
  }>>([])
  const [hostMicMutedByOfficer, setHostMicMutedByOfficer] = useState(false)
  const [isBattleMode, setIsBattleMode] = useState(stream?.broadcast_mode === 'battle')
  const [selectedBattleTheme, setSelectedBattleTheme] = useState<string>(DEFAULT_BATTLE_THEME_ID);
  
  const hasJoinedRef = useRef(false)
  const roomRef = useRef<Room | null>(null)
  const liveKitConnectionKeyRef = useRef<string | null>(null)
  const anonymousViewerIdRef = useRef(`anon-viewer-${Math.random().toString(36).slice(2, 10)}`)
  const viewerCountUpdateRef = useRef(0)
  const stageTouchStartYRef = useRef<number | null>(null)
  const stageTouchCurrentYRef = useRef<number | null>(null)
  
  // Debug: Log when remoteParticipants changes (throttled)
  const lastRemoteLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastRemoteLogRef.current < 2000) return;
    lastRemoteLogRef.current = now;
    console.log('[BroadcastPage] remoteParticipants changed:', {
      count: remoteParticipants.size,
      participants: Array.from(remoteParticipants.keys())
    })
  }, [remoteParticipants])

  // Seat events: useStreamSeats hook already subscribes to stream-seat-events:${streamId}
  // and handles seat refresh scheduling. We only update local seatJoinTimes here
  // by deriving from seat state changes � no duplicate channel needed.
  useEffect(() => {
    if (!streamId) return;
    const updates: Record<number, number> = {}
    Object.values(seats).forEach((seat: any) => {
      if (seat?.joined_at && !seatJoinTimesRef.current[seat.seat_index]) {
        seatJoinTimesRef.current[seat.seat_index] = Date.now()
        updates[seat.seat_index] = Date.now()
      }
    })
    if (Object.keys(updates).length > 0) {
      setSeatJoinTimes(prev => ({ ...prev, ...updates }))
    }
    setSeatJoinTimes(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(key => {
        const idx = Number(key)
        if (!seats[idx] || !seats[idx]?.id) {
          delete next[idx]
          seatJoinTimesRef.current[idx] = 0
        }
      })
      return next
    })
  }, [streamId, seats])

  // Tick every second to re-evaluate "Camera unavailable" 8s timeout
  // Removed setInterval to prevent full-page rerenders; timeout UI updates on natural rerenders from seat/participant changes
  const seatTickRef = useRef(0)

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[BroadcastSeatState]', {
      streamId,
      seats,
      viewerSeatCards,
    })
  }, [streamId, seats, viewerSeatCards])

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[BroadcastRemoteParticipants]', {
      streamId,
      count: remoteParticipants.size,
      identities: Array.from(remoteParticipants.values()).map((p: any) => p.identity),
    })
  }, [streamId, remoteParticipants])
  
   const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
   const [isShareModalOpen, setIsShareModalOpen] = useState(false)
   const [isSeatsModalOpen, setIsSeatsModalOpen] = useState(false)
  const [smokeEvent, setSmokeEvent] = useState<any>(null)
   const [seatModalCount, setSeatModalCount] = useState(1)
   const [seatModalPrices, setSeatModalPrices] = useState<SeatModalPrice[]>([])
   const [selectedSeatIndex, setSelectedSeatIndex] = useState(0)
    const [isMoreControlsOpen, setIsMoreControlsOpen] = useState(false)
    const [isPaidChatModalOpen, setIsPaidChatModalOpen] = useState(false)
    const [isMessagePopupOpen, setIsMessagePopupOpen] = useState(false)
    const [isNewMessageMode, setIsNewMessageMode] = useState(false)
    const [isBroadcasterControlsOpen, setIsBroadcasterControlsOpen] = useState(false)
    const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false)
    const [isSeatControlsOpen, setIsSeatControlsOpen] = useState(false)
    const [isAuctionMeOpen, setIsAuctionMeOpen] = useState(false)
    const [selectedSeatForControls, setSelectedSeatForControls] = useState<{ seatIndex: number; seatSessionId?: string } | null>(null)
    const [messagePopupPosition, setMessagePopupPosition] = useState<{ x: number; y: number } | null>(null)
    const [isDraggingMessagePopup, setIsDraggingMessagePopup] = useState(false)
    const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [recentThreads, setRecentThreads] = useState<any[]>([])
    const [selectedThread, setSelectedThread] = useState<any | null>(null)
    const [threadMessages, setThreadMessages] = useState<any[]>([])
    const [messagesLoading, setMessagesLoading] = useState(false)
    const [chatTab, setChatTab] = useState<'chat' | 'progress' | 'league' | 'gifts' | 'top-fans' | 'settings'>('chat')
   const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
    const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])
    const [giftNameMap, setGiftNameMap] = useState<Record<string, string>>({})
    const [streamSettings, setStreamSettings] = useState<{ paid_chat_enabled: boolean; paid_chat_type: string; paid_chat_price: number } | null>(null)
    const { queues: giftQueues, enqueueGift, removeGift } = useTargetedGiftQueue()

    const messagePopupRef = useRef<HTMLDivElement>(null)

    const handleMessagePopupMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button, input, a, [role="button"]')) return
      setIsDraggingMessagePopup(true)
      const startX = e.clientX
      const startY = e.clientY
      const startPos = messagePopupPosition || { x: 0, y: 0 }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        setMessagePopupPosition({
          x: startPos.x + dx,
          y: startPos.y + dy,
        })
      }

      const handleMouseUp = () => {
        setIsDraggingMessagePopup(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }, [messagePopupPosition])

    useEffect(() => {
      if (isMessagePopupOpen && !messagePopupPosition) {
        setMessagePopupPosition({ x: 0, y: 0 })
      }
    }, [isMessagePopupOpen, messagePopupPosition])
    useEffect(() => {
      if (!import.meta.env.DEV) return
      console.debug('[BroadcastPage] recentGifts updated', {
        streamId,
        giftsLength: recentGifts.length,
        giftIds: recentGifts.map((gift) => gift.id),
      })
    }, [recentGifts, streamId])

    const visibleGiftTargets = useMemo(() => {
      const targets = new Set<string>()
      if (stream?.user_id) {
        targets.add(`user:${stream.user_id}`)
      }
      Object.values(seats).forEach((seat) => {
        if (seat.user_id) {
          targets.add(`user:${seat.user_id}`)
        }
      })
      return targets
    }, [stream?.user_id, seats])

    const participantToUserId = useMemo(() => {
      const map = new Map<string, string>()
      Object.values(seats).forEach((seat) => {
        if (seat.livekit_participant_identity && seat.user_id) {
          map.set(seat.livekit_participant_identity, seat.user_id)
        }
      })
      return map
    }, [seats])

    const {
     myLeagues,
     myMemberships,
     leagueMissions,
     isLoading: isUserLeaguesLoading,
   } = useUserLeagues()

   const { levelUpEvent: broadcasterLevelUpEvent, dismissLevelUp: dismissBroadcasterLevelUp } = useLeagueProgress(streamId || null)

   const [leagueBannerEvent, setLeagueBannerEvent] = useState<{
     user_id: string
     username: string
     type: 'main_tier' | 'sub_tier' | 'league_level'
     previous: string
     current: string
     tierLabel: string
     icon: string
   } | null>(null)

   // Show league level-up banner when broadcaster levels up via useLeagueProgress
   useEffect(() => {
     if (!broadcasterLevelUpEvent) return
     const tierLabel = broadcasterLevelUpEvent.type === 'league_level'
       ? broadcasterLevelUpEvent.current
       : broadcasterLevelUpEvent.current
     const icon = broadcasterLevelUpEvent.type === 'main_tier'
       ? '🏆'
       : broadcasterLevelUpEvent.type === 'league_level'
         ? '👑'
         : '⭐'
     setLeagueBannerEvent({
       user_id: user?.id || '',
       username: profile?.username || 'Broadcaster',
       type: broadcasterLevelUpEvent.type,
       previous: broadcasterLevelUpEvent.previous,
       current: broadcasterLevelUpEvent.current,
       tierLabel,
       icon,
     })
      dismissBroadcasterLevelUp()
    }, [broadcasterLevelUpEvent, dismissBroadcasterLevelUp, user?.id, profile?.username])

    // Fetch stream settings (paid chat, etc.)
    useEffect(() => {
      if (!streamId) return
      let cancelled = false
      void (async () => {
        const { data, error } = await supabase
          .from('stream_settings')
          .select('paid_chat_enabled, paid_chat_type, paid_chat_price')
          .eq('stream_id', streamId)
          .maybeSingle()
        if (cancelled) return
        if (!error && data) {
          setStreamSettings({
            paid_chat_enabled: Boolean(data.paid_chat_enabled),
            paid_chat_type: data.paid_chat_type || 'per_user',
            paid_chat_price: Number(data.paid_chat_price ?? 0),
          })
        } else {
          setStreamSettings({ paid_chat_enabled: false, paid_chat_type: 'per_user', paid_chat_price: 0 })
        }
      })()
      return () => { cancelled = true }
    }, [streamId])

   useEffect(() => {
     setSeatModalPrices((current) => {
       const next = current.slice(0, seatModalCount)

       while (next.length < seatModalCount) {
         next.push('')
       }

       return next
     })
   }, [seatModalCount])

   useEffect(() => {
     setSelectedSeatIndex((current) => Math.max(0, Math.min(current, Math.max(0, seatModalCount - 1))))
   }, [seatModalCount])
   const [giftUserPositions, setGiftUserPositions] = useState<Record<string, { top: number; left: number; width: number; height: number }>>({})
    const getGiftUserPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}))
    const giftNameMapRef = useRef<Record<string, string>>({})
const [allTimeTopGifters, setAllTimeTopGifters] = useState<Array<{
  sender_id: string; sender_username: string; sender_avatar_url: string | null; total_gift_coins: number; last_gift_at: string | null
}>>([])
    const [isAllTimeTopGiftersLoading, setIsAllTimeTopGiftersLoading] = useState(false)
    const giftSummaryBySender = useMemo(() => {
      const totals = new Map<string, { sender_username: string; sender_avatar_url?: string | null; total_coins: number; gift_count: number; lastGiftAt: string | null }>()

      recentGifts.forEach((gift) => {
        const senderId = String(gift.sender_id || gift.user_id || gift.senderId || gift.user_id || '')
        if (!senderId) return

        const sender_name = String(gift.sender_username || gift.sender_name || gift.username || 'Anonymous')
        const amount = Number(gift.coins_amount ?? gift.amount ?? gift.total_coins ?? 0)
        const createdAt = gift.created_at || gift.timestamp || null

        const current = totals.get(senderId) ?? {
          sender_username: sender_name,
          sender_avatar_url: (gift as any).sender_avatar_url ?? null,
          total_coins: 0,
          gift_count: 0,
          lastGiftAt: null,
        }

        totals.set(senderId, {
          sender_username: current.sender_username || sender_name,
          sender_avatar_url: current.sender_avatar_url,
          total_coins: current.total_coins + (Number.isFinite(amount) ? amount : 0),
          gift_count: current.gift_count + 1,
          lastGiftAt: createdAt && (!current.lastGiftAt || new Date(createdAt).getTime() > new Date(current.lastGiftAt).getTime()) ? createdAt : current.lastGiftAt,
        })
      })

      return Array.from(totals.entries())
        .map(([sender_id, entry]) => ({ sender_id, ...entry }))
        .sort((a, b) => b.total_coins - a.total_coins)
    }, [recentGifts])
    const { subscriberUsernames } = useSubscriberUsernames(stream?.user_id)

    // -- Floating Chat ---------------------------------------------------------
   interface FloatingMessage {
     id: string
     username: string
     content: string
     createdAt: number
     user_id?: string
   }

     const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([])
     const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set())
     const [messages, setMessages] = useState<Array<{id: string; username: string; content: string; createdAt: number}>>([])
      const [chatInput, setChatInput] = useState('')
      const [hostChatDisabledByOfficerState, setHostChatDisabledByOfficerState] = useState(false)
      const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(user?.id, streamId)
      const [blockedUsernames, setBlockedUsernames] = useState<Set<string>>(new Set())

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

      // Pin/unpin messages (host/broadofficer/staff only)
     const canPinMessages = isHost || isCurrentUserBroadofficer || isOfficer
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
      const [hostChatDisabledUntil, setHostChatDisabledUntil] = useState<string | null>(null)
      const [hostChatDisabledStreamId, setHostChatDisabledStreamId] = useState<string | null>(null)
       const floatingChatContainerRef = useRef<HTMLDivElement>(null)
       const chatContainerRef = useRef<HTMLDivElement>(null)
       const broadcastChatMessageIdsRef = useRef<Set<string>>(new Set())
       const recentChatKeysRef = useRef<Map<string, number>>(new Map())
       const CHAT_DEBOUNCE_MS = 5000

      const hostChatDisableRemainingMs = hostChatDisabledUntil
        ? Math.max(0, getBroadcastChatLockRemainingMs(hostChatDisabledUntil))
        : 0

     const hostChatDisabledByOfficer = useMemo(
       () => isBroadcastChatLockActive({
         disabled: hostChatDisabledByOfficerState,
         until: hostChatDisabledUntil,
         streamId,
         lockedStreamId: hostChatDisabledStreamId,
       }),
       [hostChatDisabledByOfficerState, hostChatDisabledUntil, hostChatDisabledStreamId, streamId],
     )

     useEffect(() => {
       const broadcasterId = stream?.user_id
       if (!streamId || !broadcasterId) {
         setHostChatDisabledByOfficerState(false)
         setHostChatDisabledUntil(null)
         setHostChatDisabledStreamId(null)
         return
       }

       let mounted = true
       const fetchHostChatLock = async () => {
         const { data } = await supabase
           .from('user_profiles')
           .select('broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id')
           .eq('id', broadcasterId)
           .maybeSingle()

         if (!mounted) return

         setHostChatDisabledByOfficerState(!!data?.broadcast_chat_disabled)
         setHostChatDisabledUntil(data?.broadcast_chat_disabled_until ?? null)
         setHostChatDisabledStreamId(data?.broadcast_chat_disabled_stream_id ?? null)
       }

        void fetchHostChatLock()
        const interval = window.setInterval(fetchHostChatLock, 60_000)

       return () => {
         mounted = false
         window.clearInterval(interval)
       }
      }, [streamId, stream?.user_id])

    useEffect(() => {
     const broadcasterId = stream?.user_id;
     if (!broadcasterId) {
       setAllTimeTopGifters([]);
       return;
     }

     let cancelled = false;

     const loadAllTimeTopGifters = async () => {
       setIsAllTimeTopGiftersLoading(true);

       try {
         const { data: giftRows, error: giftError } = await supabase
           .from('stream_gifts')
           .select('*')
           .eq('receiver_id', broadcasterId)
           .limit(5000);

         if (giftError) {

           if (!cancelled) setAllTimeTopGifters([]);
           return;
         }

         const totals = new Map<string, { total: number; lastGiftAt: string | null }>();

         (giftRows || []).forEach((row: any) => {
           const senderId = String(row.sender_id || row.user_id || row.senderId || '');
           if (!senderId || senderId === broadcasterId) return;

           const amount = Number(
             row.coins_amount ??
             row.coins_spent ??
             row.total_coins ??
             row.total_amount ??
             row.amount ??
             row.coin_value ??
             0
           );

           if (!Number.isFinite(amount) || amount <= 0) return;

           const current = totals.get(senderId) || { total: 0, lastGiftAt: null };
           const rowCreatedAt = row.created_at || row.timestamp || null;

           totals.set(senderId, {
             total: current.total + amount,
             lastGiftAt:
               rowCreatedAt && (!current.lastGiftAt || new Date(rowCreatedAt).getTime() > new Date(current.lastGiftAt).getTime())
                 ? rowCreatedAt
                 : current.lastGiftAt,
           });
         });

         const senderIds = Array.from(totals.keys());

         if (senderIds.length === 0) {
           if (!cancelled) setAllTimeTopGifters([]);
           return;
         }

         const { data: profileRows, error: profileError } = await supabase
           .from('user_profiles')
           .select('id, username, display_name, email, avatar_url')
           .in('id', senderIds);

         if (profileError) {

         }

         const profileMap = new Map<string, any>();
         (profileRows || []).forEach((row: any) => {
           if (row?.id) profileMap.set(row.id, row);
         });

const ranked = senderIds
            .map((senderId) => {
              const profileRow = profileMap.get(senderId);
              const total = totals.get(senderId)!;

              return {
                user_id: senderId,
                sender_username:
                  profileRow?.username ||
                   profileRow?.username ||
                  profileRow?.email?.split('@')?.[0] ||
                  'Troll Citizen',
                sender_avatar_url: profileRow?.avatar_url || null,
                total_gift_coins: Math.floor(total.total),
                last_gift_at: total.lastGiftAt,
                sender_id: senderId,
              }
            })
           .sort((a, b) => b.total_gift_coins - a.total_gift_coins)
           .slice(0, 10);

         if (!cancelled) setAllTimeTopGifters(ranked);
       } catch (err) {

         if (!cancelled) setAllTimeTopGifters([]);
       } finally {
         if (!cancelled) setIsAllTimeTopGiftersLoading(false);
       }
     };

     void loadAllTimeTopGifters();

     return () => {
       cancelled = true;
     };
   }, [stream?.user_id])

  const handleRemoveGiftOverlay = useCallback((giftId: string) => {
    setRecentGifts((current) => current.filter((gift) => gift.id !== giftId))
  }, [])

  // Determine if current user can publish from host role
  const canPublish = isHost

    // Modal state lifted from BroadcastGrid
    const [userActionTarget, setUserActionTarget] = useState<{
      userId: string;
      username?: string;
      role?: string;
      createdAt?: string;
      seatSessionId?: string;
    } | null>(null)
    // Track when each seat index joined for "Camera unavailable" timeout
    const seatJoinTimesRef = useRef<Record<number, number>>({})
    const [seatJoinTimes, setSeatJoinTimes] = useState<Record<number, number>>({})
    const [showHostStats, setShowHostStats] = useState(false)
    const [showUserStats, setShowUserStats] = useState<{
      userId: string;
      username: string;
      trollCoins: number;
      trollmonds: number;
      licensePlate: string | null;
      isSeatUser: boolean;
      streamId?: string;
    } | null>(null)
    // CityStatusPanel for clicking on seats / broadcaster orb
    const [selectedSeatUserId, setSelectedSeatUserId] = useState<string | null>(null)
    const [raidTarget, setRaidTarget] = useState<{ userId: string; houseId: string } | null>(null)
    const [broadcastRaidTarget, setBroadcastRaidTarget] = useState<string | null>(null)
  // Broadcast Abilities
  const {
    abilities: userAbilities,
    activeEffects: abilityActiveEffects,
    loading: abilityLoading,
    useAbility: activateAbility,
    isEffectActive,
    getCooldownRemaining,
    getEffectRemaining,
  } = useBroadcastAbilities(streamId)
  const [isAbilityBoxOpen, setIsAbilityBoxOpen] = useState(false)

  const handleGetUserPositions = useCallback((getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => {
    getGiftUserPositionsRef.current = getPositions;
  }, []);

  useEffect(() => {
    giftNameMapRef.current = giftNameMap;
  }, [giftNameMap]);

 const processedGiftIdsRef = useRef<Set<string>>(new Set())
  // Per-page dedupe of gift animations used by processGiftEvent.
  // Normalised animationId is always the stream_gifts row UUID, so whether the
  // source is postgres_changes or the broadcast channel, the second arrival is
  // caught here and skipped.
  const seenGiftAnimationIdsRef = useRef<Set<string>>(new Set())
  const { processGiftEvent: pipelineProcessGiftEvent } = useGiftAnimationPipeline()

  // Acquire camera overlay stream when enabled for gaming mode
  useEffect(() => {
    let overlayStream: MediaStream | null = null;
    let overlayTrack: LocalVideoTrack | null = null;

    const setupCameraOverlay = async () => {
      if (cameraOverlayEnabled && isScreenSharing) {
        try {

          const preflightVideoTrack = PreflightStore.getLivekitTracks()?.[1];
          if (preflightVideoTrack) {
            const mediaTrack = preflightVideoTrack.mediaStreamTrack;
            const isLiveTrack = mediaTrack && mediaTrack.readyState === 'live';

            console.log('[BroadcastPage] Preflight camera overlay candidate:', {
              hasTrack: !!preflightVideoTrack,
              readyState: mediaTrack?.readyState,
              enabled: mediaTrack?.enabled,
              muted: mediaTrack?.muted,
            });

            if (isLiveTrack) {

              setCameraOverlayTrackState(preflightVideoTrack);
              return;
            }

          }

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera/microphone access is not available in this browser or context.');
          }

          const existingVideoPub = roomRef.current?.localParticipant
            ?.getTrackPublication?.(Track.Source.Camera)?.track;

          if (existingVideoPub?.mediaStreamTrack?.readyState === 'live') {
            const mediaTrack = existingVideoPub.mediaStreamTrack;
            overlayStream = new MediaStream([mediaTrack]);
            overlayTrack = new LocalVideoTrack(mediaTrack);
            setCameraOverlayTrackState(overlayTrack);
            return;
          }

          overlayStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
            audio: false,
          });

          overlayTrack = new LocalVideoTrack(overlayStream.getVideoTracks()[0]);
          setCameraOverlayTrackState(overlayTrack);

        } catch (err) {

          toast.error('Failed to access camera for overlay');
          setCameraOverlayEnabled(false);
        }
      }
    };

    const cleanupCameraOverlay = () => {
      if (overlayTrack) {
        overlayTrack.stop();
        overlayTrack = null;
      }
      setCameraOverlayTrackState(null);
    };

    if (cameraOverlayEnabled && isScreenSharing) {
      setupCameraOverlay();
    } else {
      cleanupCameraOverlay();
    }

    return () => {
      // Cleanup on unmount or dependency change
      if (overlayStream) {
        overlayStream.getTracks().forEach(t => t.stop());
      }
      if (overlayTrack) {
        overlayTrack.stop();
      }
    };
   
  }, [cameraOverlayEnabled, isScreenSharing]);

  const resolveGiftAmount = useCallback((giftData: any): number => {
    const metadata = giftData?.metadata || {};
    const quantity = Math.max(1, Number(giftData?.quantity ?? metadata.quantity ?? 1) || 1);

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
    ];

    for (const candidate of directAmountCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
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
    ];

    for (const candidate of unitAmountCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value * quantity;
    }

    return quantity;
  }, []);

  const resolveGiftName = useCallback((giftData: any): string => {
    const metadata = giftData?.metadata || {};
    return (
      giftData?.gift_name ||
      giftData?.name ||
      giftData?.title ||
      metadata.gift_name ||
      metadata.name ||
      metadata.title ||
      'Gift'
    );
  }, []);

  const processGiftEvent = useCallback(async (giftData: any) => {
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
      if (!giftData) {
        if (import.meta.env.DEV) {
          console.warn('[BroadcastGiftVideo] processGiftEvent called with no giftData');
        }
        return;
      }

      const enrichedGiftData = await hydrateGiftForOverlay(giftData);
      if (import.meta.env.DEV) {
        console.debug('[BroadcastGiftVideo] enriched payload', enrichedGiftData);
      }
      const normalized = await pipelineProcessGiftEvent(enrichedGiftData);
      if (!normalized) return;

      if (import.meta.env.DEV) {
        console.debug('[BroadcastGiftVideo] normalized payload', normalized);
      }

      const giftId = normalized.id;
      const receiverId = normalized.receiver_id;
      const resolvedGiftAmount = normalized.amount;
      const resolvedGiftName = normalized.gift_name;

      const newGift = {
        id: giftId,
        gift_id: normalized.gift_id,
        gift_name: resolvedGiftName,
        gift_icon: normalized.gift_slug ? (normalized.gift_slug as any)?.charAt(0)?.toUpperCase() || 'G' : 'G',
        gift_slug: normalized.gift_slug,
        animation_type: normalized.animation_type,
        animation_url: normalized.animation_url || undefined,
        video_url: normalized.video_url || normalized.animation_url || undefined,
        animation_duration_ms: normalized.animation_duration_ms,
        sound_url: normalized.sound_url,
        amount: resolvedGiftAmount,
        quantity: normalized.quantity,
        sender_id: normalized.sender_id,
        sender_name: normalized.sender_name,
        receiver_id: receiverId,
        receiver_name: normalized.receiver_name,
        created_at: normalized.created_at,
      } as BroadcastGift;

      if (import.meta.env.DEV) {
        console.debug('[BroadcastPage] processGiftEvent normalized newGift', {
          giftId,
          gift_name: newGift.gift_name,
          animation_url: newGift.animation_url,
          video_url: newGift.video_url,
          animation_type: newGift.animation_type,
          receiver_id: newGift.receiver_id,
          receiver_name: newGift.receiver_name,
          amount: newGift.amount,
          quantity: newGift.quantity,
        });
      }

      setRecentGifts((prev) => {
        if (prev.some((g) => g.id === giftId)) {
          if (import.meta.env.DEV) {
            console.debug('[BroadcastPage] processGiftEvent gift already exists', { giftId });
          }
          return prev;
        }
        const updated = [...prev, newGift].slice(-20);
        if (import.meta.env.DEV) {
          console.debug('[BroadcastPage] processGiftEvent adding gift to recentGifts', { giftId, newGift });
        }
        return updated;
      });

      const giftDurationMs = newGift.animation_duration_ms ?? getGiftVisualConfig(newGift).durationMs;
      trackedTimeout(() => {
        setRecentGifts((prev) => prev.filter((g) => g.id !== giftId));
      }, giftDurationMs + 150);

      const streamGiftEvent: StreamGiftEvent = {
        id: normalized.id,
        stream_id: normalized.stream_id,
        gift_id: normalized.gift_id || '',
        gift_name: normalized.gift_name,
        sender_user_id: normalized.sender_id || '',
        recipient_user_id: normalized.receiver_id || stream?.user_id || '',
        recipient_type: normalized.recipient_type,
        recipient_seat_index: normalized.recipient_seat_index,
        animation_url: normalized.animation_url || null,
        animation_url_webm: normalized.animation_url_webm || null,
        animation_url_mp4: normalized.animation_url_mp4 || null,
        animation_url_mov: normalized.animation_url_mov || null,
        animation_type: normalized.animation_type as StreamGiftEvent['animation_type'] || null,
        animation_duration_ms: normalized.animation_duration_ms,
        sound_url: normalized.sound_url,
        created_at: normalized.created_at,
      };

      console.info('[GiftRouting] Target resolution', {
        giftId: streamGiftEvent.id,
        targetKey: getGiftTargetKey(streamGiftEvent),
        targetExists: getGiftTargetKey(streamGiftEvent) ? giftQueues[getGiftTargetKey(streamGiftEvent)!] !== undefined : false,
        visibleTargets: Array.from(new Set([
          stream?.user_id ? `user:${stream.user_id}` : '',
          ...Object.values(seats || {}).filter((s: any) => s.user_id).map((s: any) => `user:${s.user_id}`)
        ])).filter(Boolean),
      });

      enqueueGift(streamGiftEvent);

      const missingIds = [normalized.sender_id, receiverId].filter(
        (id): id is string => !!id && !giftNameMapRef.current[id]
      );

      if (missingIds.length > 0) {
        supabase
          .from('user_profiles')
          .select('id, username, display_name, email')
          .in('id', Array.from(new Set(missingIds)))
          .then(({ data }) => {
            if (!data || data.length === 0) return;

            const resolved = Object.fromEntries(
              data
                .filter((row: any) => row?.id)
                .map((row: any) => [
                  row.id,
                  row.username || row.email?.split('@')?.[0] || 'Troll Citizen'
                ])
            );

            if (Object.keys(resolved).length === 0) return;

            setGiftNameMap((prev) => ({ ...prev, ...resolved }));
            setRecentGifts((prev) =>
              prev.map((gift) =>
                gift.id === giftId
                  ? {
                      ...gift,
                      sender_name: gift.sender_name === 'Someone' ? (resolved[gift.sender_id] || gift.sender_name) : gift.sender_name,
                      receiver_name: !gift.receiver_name ? resolved[gift.receiver_id] : gift.receiver_name,
                    }
                  : gift
              )
            );
          });
      }

      if (receiverId === streamRef.current?.user_id && resolvedGiftAmount > 0) {
        const giftAmount = Math.floor(resolvedGiftAmount);

        setStream((prev) => prev ? {
          ...prev,
          total_gifts_coins: (prev.total_gifts_coins || 0) + giftAmount,
        } : prev);
      }

      const levelGiftAmount = resolvedGiftAmount;

      if (levelGiftAmount > 0 && receiverId === streamRef.current?.user_id) {
        window.dispatchEvent(new CustomEvent('broadcast-gift-level', {
          detail: {
            giftId,
            broadcasterId: streamRef.current?.user_id,
            receiverId,
            streamId,
            amount: levelGiftAmount,
            timestamp: Date.now(),
          }
        }));
      }

      window.dispatchEvent(new CustomEvent('broadcast-balance-update', {
        detail: {
          sender_id: normalized.sender_id,
          senderId: normalized.sender_id,
          receiver_id: receiverId,
          receiverId: receiverId,
          amount: resolvedGiftAmount,
          coins: resolvedGiftAmount,
          gift_id: giftId,
          giftId: giftId,
          timestamp: Date.now(),
        }
      }));
    }, [pipelineProcessGiftEvent, streamId, supabase, enqueueGift, removeGift, getGiftVisualConfig, stream, seats, giftQueues, hydrateGiftForOverlay]);

  // Use a ref so the broadcast/window listeners always invoke the latest
  // processGiftEvent without tearing down the supabase broadcast channel
  // subscription whenever processGiftEvent is recreated (its deps include
  // stream/seats which change frequently).
  const processGiftEventRef = useRef(processGiftEvent)
  useEffect(() => {
    processGiftEventRef.current = processGiftEvent
  }, [processGiftEvent])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream-gifts:${streamId}`)
      .on(
        'broadcast',
        { event: 'gift_sent' },
        ({ payload }) => {
          if (!payload) return
          void processGiftEventRef.current(payload)
          window.dispatchEvent(new CustomEvent('broadcast-gift-received', { detail: { payload } }))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [streamId])

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

  const stopLocalTracks = useCallback(() => {
    if (localTracks) {
      localTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('Error stopping track:', e)
          }
        }
      })
      setLocalTracks(null)
    }

    // Use the full teardown helper instead of raw disconnect
    disconnectLiveKitRoom()

    // Only clear tracks if we're actually exiting, not going live
    if (!isGoingLiveRef.current) {
      console.log('[BroadcastPage] ? Real exit in stopLocalTracks, clearing tracks')
      clearTracks()
    } else {
      console.log('[BroadcastPage] ?? Skipping clearTracks in stopLocalTracks during live transition')
    }
  }, [clearTracks, disconnectLiveKitRoom, localTracks, setLocalTracks])

  const stopLocalTracksRef = useRef(stopLocalTracks)
  useEffect(() => {
    stopLocalTracksRef.current = stopLocalTracks
  }, [stopLocalTracks])

  const refreshStream = useCallback(async () => {
    if (!streamId) return
    const { data, error } = await supabase
      .from('streams')
      .select('*, total_likes, quality_cap, is_azgora')
      .eq('id', streamId)
      .maybeSingle()
    
    if (error) {
      console.error('Refresh error:', error)
      return
    }
    
    setStream(data)
  }, [streamId, supabase])

  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)
  const [isTextPopupComposerOpen, setIsTextPopupComposerOpen] = useState(false)
  const {
    activePopup: activeTextPopup,
    sendPopup: sendTextPopup,
    sending: sendingTextPopup,
  } = useBroadcastTextPopup({
    streamId: streamId || '',
    currentUserId: user?.id,
    currentUsername: profile?.username,
    canSend: isHost,
  })

   // Quick Coin Store
   const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false)

   const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const streamRef = useRef(stream)
  const broadcasterProfileRef = useRef(broadcasterProfile)
  const profileRef = useRef(profile)
  const streamRealtimeUpdateRef = useRef<number | null>(null)

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  useEffect(() => {
    broadcasterProfileRef.current = broadcasterProfile
  }, [broadcasterProfile])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const updateStreamPatch = useCallback((patch: Partial<Stream>) => {
    setStream((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const randomBattleQueue = useRandomBattleQueueController({
    stream,
    userId: user?.id,
    isBroadcaster: isHost,
    onStreamUpdate: updateStreamPatch,
  });

// Battle State
   const { 
    battleState: rawBattleState,
    pickSide,
    supporters,
    userTeam,
    joinWindowOpen,
    remainingTime,
    shouldShowSidePicker,
    sendBattleGift,
  } = useBattleState({
    streamId: streamId || '',
    localUserId: user?.id || anonymousViewerIdRef.current || '',
    isHost,
    hostId: stream?.user_id,
  })

  // Transform battleState to match BroadcastGrid's expected interface
  const battleState = useMemo(() => ({
    active: rawBattleState.active,
    battleId: rawBattleState.battleId,
    hostId: rawBattleState.teamACaptain,
    challengerId: rawBattleState.teamBCaptain,
    broadcasterScore: rawBattleState.teamAScore,
    challengerScore: rawBattleState.teamBScore,
    startedAt: rawBattleState.startedAt,
    endsAt: rawBattleState.endsAt,
    suddenDeath: rawBattleState.suddenDeath,
  }), [rawBattleState])


   const cleanupLocalMedia = () => {
    const room = roomRef.current

    if (cameraOverlayTrackState) {
      try {
        cameraOverlayTrackState.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping camera overlay track:', e)
      }
      setCameraOverlayTrackState(null)
    }

    if (combinedLocalTracks) { // Use combined tracks for cleanup
      combinedLocalTracks.forEach((track) => {
        if (track) {
          try {
            track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping local track:', e)
          }
        }
      })
      setLocalTracks(null) // Clear original localTracks
    }

    if (room?.localParticipant) {
      for (const pub of room.localParticipant.videoTrackPublications.values()) {
        if (pub.track) {
          try {
            pub.track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping published video track:', e)
          }
        }
      }
      for (const pub of room.localParticipant.audioTrackPublications.values()) {
        if (pub.track) {
          try {
            pub.track.stop()
          } catch (e) {
            console.warn('[BroadcastPage] Error stopping published audio track:', e)
          }
        }
      }
    }

    if (screenTrack) {
      try {
        screenTrack.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping screen share track:', e)
      }
    }

    if (cameraTrack) {
      try {
        cameraTrack.stop()
      } catch (e) {
        console.warn('[BroadcastPage] Error stopping stored camera track:', e)
      }
    }

    // Only clear tracks if we're actually exiting, not going live
    if (!isGoingLiveRef.current) {
      console.log('[BroadcastPage] ? Real exit, clearing tracks')
      clearTracks()
    } else {
      console.log('[BroadcastPage] ?? Skipping clearTracks during live transition')
   }
  };

   // Handle leaving seat with instant track cleanup
   const handleLeaveSeat = useCallback(async () => {
     const room = roomRef.current
     
     // Instantly stop publishing tracks before clearing seat
     if (room && room.localParticipant) {
       try {
         // Unpublish all tracks instantly - this removes them from other participants immediately
         for (const pub of room.localParticipant.videoTrackPublications.values()) {
           if (pub.track) {
             room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
           }
         }
         for (const pub of room.localParticipant.audioTrackPublications.values()) {
           if (pub.track) {
             room.localParticipant.unpublishTrack(pub.track).catch(console.warn)
           }
         }
         console.log('[BroadcastPage] Unpublished all tracks for leaving seat')
       } catch (e) {
         console.warn('Error unpublishing tracks on leave:', e)
       }
     }
     
     // Stop local and published media immediately
     cleanupLocalMedia()

     console.log('[BroadcastPage] Left seat with instant track cleanup')
   }, [localTracks, user?.id]) 

   // Handle leaving the broadcast (for host ending stream or viewer leaving)
  const handleLeave = useCallback(async () => {
    const confirmed = confirm(isHost ? 'End this broadcast?' : 'Leave this broadcast?')
    if (!confirmed) return

    // If host is in an active random battle, forfeit first so the other broadcaster wins
    if (isHost && stream?.is_battle && stream?.battle_id && stream?.battle_mode === 'random_queue' && user?.id) {
      try {
        await supabase.rpc('forfeit_random_battle', {
          p_stream_id: stream.id,
          p_broadcaster_id: user.id,
        });
      } catch (forfeitErr) {
        console.warn('[handleLeave] forfeit_random_battle failed:', forfeitErr);
      }
    }

    // If host, mark stream as ended in the database
    if (isHost && stream) {
      await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', stream.id)

      try {
        const endTime = new Date().toISOString()
        const { data: session } = await supabase
          .from('rtc_sessions')
          .select('id, started_at')
          .eq('room_name', `stream-${stream.id}`)
          .eq('is_active', true)
          .maybeSingle()

        if (session) {
          const startTime = new Date(session.started_at)
          const durationSeconds = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)
          await supabase
            .from('rtc_sessions')
            .update({ is_active: false, ended_at: endTime, duration_seconds: durationSeconds })
            .eq('id', session.id)
        }
      } catch {}

      setStream((prev: any) => prev ? { ...prev, status: 'ended', is_live: false } : null)
    }

    // Leave seat if host is currently on stage
    if (mySeat) {
      await leaveSeat()
    }

    // Stop local and published media
    cleanupLocalMedia()

    // Full LiveKit teardown: unpublish, detach handlers, disconnect
    disconnectLiveKitRoom()

    // Clear PreflightStore
    PreflightStore.clear()

    // Remove stream-specific realtime channels
    if (streamId) {
      void removeStreamChannels(streamId)
    }

    // Navigate away
    navigate('/home', { replace: true })
  }, [isHost, navigate, disconnectLiveKitRoom, stream, streamId, user?.id])
  const handleToggleChat = useCallback(() => setIsChatOpen((prev) => !prev), [])
const handleOpenShareModal = useCallback(() => setIsShareModalOpen(true), [])
    const handlePinProduct = useCallback(() => setIsPinProductModalOpen(true), [])
    const handleClosePinProductModal = useCallback(() => setIsPinProductModalOpen(false), [])
    const handleInviteFollowers = useCallback(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const inviterId = userData.user?.id;
        if (!inviterId || !streamId) return;
        
        const { data, error } = await supabase.rpc('invite_followers_to_broadcast', {
          p_stream_id: streamId,
          p_inviter_id: inviterId
        });
        
        if (error) throw error;
        toast.success(`Invited ${data.invited_count || 0} followers and following users`);
      } catch (e: any) {

        toast.error(e.message || 'Failed to send invites');
      }
    }, [streamId]);
   const handleOpenSeatsModal = useCallback(() => {
     const fallbackPrice = normalizeSeatPrice(stream?.seat_price)
     const hasSeatPrices = Array.isArray(stream?.seat_prices)
     const existingSeatPrices = hasSeatPrices
       ? stream.seat_prices.slice(1, 1 + Math.max(0, currentViewerSeatCount))
       : []
     const normalizedPrices = Array.from({ length: Math.max(0, currentViewerSeatCount) }, (_, index) => {
       const existingPrice = existingSeatPrices[index]
       if (existingPrice !== undefined) return normalizeSeatPrice(existingPrice)
       if (!hasSeatPrices) return fallbackPrice
       return ''
     })

      setSeatModalCount(Math.max(0, Math.min(6, currentViewerSeatCount)))
     setSeatModalPrices(normalizedPrices)
     setSelectedSeatIndex(0)
     setIsSeatsModalOpen(true)
   }, [currentViewerSeatCount, stream?.seat_price, stream?.seat_prices])
   const handleCloseSeatsModal = useCallback(() => setIsSeatsModalOpen(false), [])
   const handleOpenMoreMenu = useCallback(() => setIsMoreControlsOpen(true), [])
   const handleCloseMoreMenu = useCallback(() => setIsMoreControlsOpen(false), [])
   const handleSeatPriceStep = useCallback((seatIndex: number, delta: number) => {
     if (seatModalCount <= 0 || seatIndex < 0 || seatIndex >= seatModalCount) return
     setSeatModalPrices((current) => {
       const next = [...current]
       const nextValue = Math.max(0, seatPriceToNumber(next[seatIndex]) + delta)
       next[seatIndex] = nextValue > 0 ? nextValue : ''
       return next
     })
   }, [seatModalCount])
const handleSeatPriceInput = useCallback((seatIndex: number, value: string) => {
      if (seatModalCount <= 0 || seatIndex < 0 || seatIndex >= seatModalCount) return
      const cleanValue = value.trim()
      if (!cleanValue) {
        setSeatModalPrices((current) => {
          const next = [...current]
          next[seatIndex] = ''
          return next
        })
        return
      }

      let val = Math.max(0, Number(cleanValue))
      if (val > 5000) {
        toast.error('Seat Price is too High')
        val = 5000
      }
      setSeatModalPrices((current) => {
        const next = [...current]
        next[seatIndex] = val > 0 ? val : ''
        return next
      })
    }, [seatModalCount])

  const handleApplySeatConfiguration = useCallback(async (count: number, prices: SeatModalPrice[]) => {
    try {
      if (!streamId || !user?.id) {
        toast.error('Not connected to a live stream');
        return;
      }

       const desiredViewerSeats = Math.max(0, Math.min(6, count));
      const totalBoxes = desiredViewerSeats + 1;
      const normalizedPrices = Array.from({ length: desiredViewerSeats }, (_, index) =>
        seatPriceToNumber(prices[index]),
      )
      const nextSeatPrices = [0, ...normalizedPrices]

      const seatsToRemove = Object.values(seats).filter(
        (seat) => seat.status === 'active' && (seat.seat_index ?? 0) >= totalBoxes,
      )

      const protectedSeatUsers = seatsToRemove
        .map((seat) => seat.user_id || seat.guest_id)
        .filter(Boolean)

      if (protectedSeatUsers.length > 0) {
        const { data: protectedProfiles } = await supabase
          .from('user_profiles')
          .select('role, troll_role, is_admin, is_troll_officer, is_lead_officer, is_staff, is_superadmin, is_secretary, is_prosecutor, is_attorney')
          .in('id', protectedSeatUsers)

        const hasProtected = (protectedProfiles || []).some((profile: any) => isStaffProfile(profile))
        if (hasProtected) {
          toast.error('Cannot remove staff members, CEO, admins, or officers from the stage.')
          return
        }
      }

      for (const seat of seatsToRemove) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seat.id)) {
          continue
        }
        const { error: leaveError } = await supabase.rpc('leave_seat_atomic', { p_session_id: seat.id })
        if (leaveError) {
          throw leaveError
        }
      }

      // seat_count = 0 means broadcaster only (no guest seats)
      // seat_count > 0 means guest seats only (broadcaster is NOT counted)
      const nextSeatCount = desiredViewerSeats

      const { error: updateError } = await supabase
        .from('streams')
        .update({
          box_count: desiredViewerSeats === 0 ? 1 : totalBoxes,
          seat_count: nextSeatCount,
          seat_price: normalizedPrices[0] ?? 0,
          seat_prices: nextSeatPrices,
        })
        .eq('id', streamId)

      if (updateError) {
        throw updateError
      }

      setStream((current) => current ? {
        ...current,
        box_count: desiredViewerSeats === 0 ? 1 : totalBoxes,
        seat_count: nextSeatCount,
        seat_price: normalizedPrices[0] ?? 0,
        seat_prices: nextSeatPrices,
      } : current)

      // Broadcast immediate box_count change so viewers and mobile clients update instantly
      try {
        const boxCountChannel = supabase.channel(`stream:${streamId}`)
        await boxCountChannel.send({
          type: 'broadcast',
          event: 'box_count_changed',
          payload: { box_count: desiredViewerSeats === 0 ? 1 : totalBoxes, stream_id: streamId },
        })
      } catch (err) {
        console.warn('[BroadcastPage] box_count_changed broadcast failed:', err)
      }

      toast.success(`Seats updated to ${desiredViewerSeats} viewer seat${desiredViewerSeats === 1 ? '' : 's'}`)
      setIsSeatsModalOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update seats')
    }
  }, [seats, setStream, streamId, user?.id])
  const handleOpenCoinStore = useCallback(() => {
    if (!user?.id) {
      toast.error('Sign in to use the coin store.')
      return
    }

    setIsCoinStoreOpen(true)
  }, [user?.id])
  const handleCloseCoinStore = useCallback(() => setIsCoinStoreOpen(false), [])
  const handleOpenAbilityBox = useCallback(() => setIsAbilityBoxOpen(true), [])
  const handleCloseAbilityBox = useCallback(() => setIsAbilityBoxOpen(false), [])

  const fetchHostStreamFallback = async () => {
    if (!user?.id) return null

    try {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('streams')
        .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fallbackError || !fallbackData) {
        console.warn('[BroadcastPage] Host fallback stream not found', { userId: user.id, fallbackError })
        return null
      }

      return fallbackData
    } catch (fallbackError) {
      console.error('[BroadcastPage] Host fallback stream fetch failed:', fallbackError)
      return null
    }
  }

  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setStreamLoaded(true)
      return
    }

    let mounted = true

    const fetchStream = async () => {
      if (!mounted) return
      setStreamLoaded(false)
      
      const MAX_RETRIES = 3
      const RETRY_DELAY_MS = 500
      let streamResult: any = null
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
        }
        
        streamResult = await supabase
          .from('streams')
          .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
          .eq('id', streamId)
          .maybeSingle()
        
        if (streamResult.data) {
          break
        }
        
        if (streamResult.error && streamResult.error.code !== 'PGRST116') {
          break
        }
      }

      const { data, error } = streamResult

      if (error || !data) {
        if (!mounted) return
        console.warn('[BroadcastPage] Stream fetch by ID failed, trying host fallback', { error, streamId, userId: user?.id })
        const fallbackStream = await fetchHostStreamFallback()

        if (fallbackStream) {
          if (!mounted) return
          console.log('[BroadcastPage] Using fallback stream (host stream):', {
            id: fallbackStream.id,
            title: fallbackStream.title,
            livekit_room_name: fallbackStream.livekit_room_name,
          });
          setStream(fallbackStream)
          setStreamLoaded(true)

          if (fallbackStream.id !== streamId) {
            navigate(`/broadcast/${fallbackStream.id}`, { replace: true })
          }
          return
        }

        if (!mounted) return
        setError('Stream not found.')
        toast.error('Stream not found.')
        setStreamLoaded(true)
        return
      }

      if (!mounted) return
      setStream(data)
      
      if (data.is_battle && data.battle_id && mounted) {
        setBattleStartTime(data.battle_start_time ? new Date(data.battle_start_time) : new Date())
      }
      
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user_id)
        .maybeSingle()
      
      if (profileData && mounted) {
        setBroadcasterProfile(profileData)
        if (data.user_id === user?.id) {
          setHostMicMutedByOfficer(!!profileData.broadcast_mic_muted)
        }
      }

      if (mounted) {
        setStreamLoaded(true)
      }

      if (data.status === 'ended') {
        stopLocalTracks()
        navigate(`/broadcast/summary/${data.id || streamId}`)
      }

      // Fetch smoke event for this stream
      if (data?.id && (profile?.role === 'admin' || profile?.is_admin || profile?.role === 'owner' || data.user_id === user?.id)) {
        supabase
          .from('stream_smoke_events')
          .select('*')
          .eq('stream_id', data.id)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data: smokeData }) => {
            if (smokeData) {
              setSmokeEvent(smokeData);
              console.log('[BroadcastPage] Smoke event loaded:', smokeData);
            }
          });
      }
    }

    fetchStream()

    return () => {
      mounted = false
    }
  }, [streamId, navigate, user?.id])

  // Check if current user is broadofficer (stream-scoped, realtime)
  useEffect(() => {
    const sid = stream?.id;
    if (!sid || !user?.id) return;
    if (isHost) {
        setIsCurrentUserBroadofficer(true);
        return;
    }
    let active = true;
    const refresh = () => {
        supabase
            .from('broadcast_officers')
            .select('officer_id')
            .eq('stream_id', sid)
            .then(({ data }) => {
                if (!active) return;
                const ids = new Set((data || []).map((r: any) => r.officer_id));
                setIsCurrentUserBroadofficer(ids.has(user.id));
            });
    };
    refresh();
    const channel = supabase
        .channel(`broadofficers:${sid}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'broadcast_officers',
            filter: `stream_id=eq.${sid}`,
        }, refresh)
        .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [stream?.id, user?.id, isHost]);

  // Handle tab visibility changes - reconnect LiveKit room if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && roomRef.current) {
        const room = roomRef.current
        // Check if room is disconnected and needs reconnection
        if ((room as any).state !== 'connected') {
          console.log('[BroadcastPage] Tab became visible - attempting to reconnect LiveKit room')
          // Re-fetch stream data and reconnect
          const streamIdParam = streamId
          if (streamIdParam) {
            supabase
              .from('streams')
              .select('*, total_likes, is_battle, battle_id, battle_mode, battle_format, battle_status, battle_start_time, battle_end_time, side_a_score, side_b_score')
              .eq('id', streamIdParam)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setStream(data)
                  setStreamLoaded(true)
                }
              })
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [streamId])

  // Emit stream_watch_time events for troll system
  useEffect(() => {
    if (!streamId || !user?.id) return;

    // Emit initial watch event
    emitEvent('stream_watch_time', user.id, { streamId, watchTime: 0 });

    // Track watch time and emit events periodically
    let watchTime = 0;
    const watchInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      watchTime += 30; // Increment by 30 seconds
      emitEvent('stream_watch_time', user.id, { streamId, watchTime });
    }, 60000); // Every 60 seconds (was 30s)

    return () => clearInterval(watchInterval);
  }, [streamId, user?.id]);

  // Combined host profile changes. Timed mic moderation is enforced by stream_mutes below.
  useEffect(() => {
    if (!isHost || !stream?.user_id) return;

    const hostChannel = supabase
      .channel(`host-updates:${stream.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${stream.user_id}`
        },
        async (payload: any) => {
          setHostMicMutedByOfficer(!!payload?.new?.broadcast_mic_muted);

          // Also update broadcaster profile without full reload
          setBroadcasterProfile((prev: any) => prev ? { ...prev, ...payload.new } : payload.new);
        }
      )
      .subscribe();

    return () => {
      if (hostChannel) {
        supabase.removeChannel(hostChannel);
      }
    };
  }, [isHost, stream?.user_id]);

  // TEMP DISABLED — replaced by useStreamRealtime subscription below
  // useEffect(() => {
  //   if (!streamId || !stream) return;
  //   const pollInterval = setInterval(async () => { ... }, 3000);
  //   return () => clearInterval(pollInterval);
  // }, [streamId, isHost, supabase, navigate, stopLocalTracks]);

  useEffect(() => {
    if (!streamId || stream?.status === 'ended') return

    const pollInterval = window.setInterval(async () => {
      if (streamEndedRef.current) return

      try {
        const { data, error } = await supabase
          .from('streams')
          .select('id, status, is_live')
          .eq('id', streamId)
          .maybeSingle()

        if (error || !data?.id) return

        if (data.status === 'ended' || data.is_live === false) {
          streamEndedRef.current = true
          stopLocalTracksRef.current()
          disconnectLiveKitRoom()
          setRemoteParticipants(new Map())
          void removeStreamChannels(streamId)
          trackedTimeout(() => {
            navigate(`/broadcast/summary/${data.id || streamId}`)
          }, 100)
        }
      } catch {
        // ignore poll errors
      }
    }, 3000)

    return () => {
      window.clearInterval(pollInterval)
    }
  }, [streamId, stream?.status, supabase, navigate, disconnectLiveKitRoom, stopLocalTracks, removeStreamChannels])

  const areStreamRealtimeUpdatesEqual = useCallback((current: any, next: any) => {
    if (!current || !next) return false;
    const trackedKeys = [
      'box_count',
      'has_rgb_effect',
      'are_seats_locked',
      'total_likes',
      'seat_price',
      'current_viewers',
      'total_gifts_coins',
      'is_battle',
      'battle_id',
      'battle_mode',
      'battle_format',
      'battle_status',
      'battle_start_time',
      'battle_end_time',
      'battle_end_reason',
      'battle_winner_id',
      'random_battle_queue_enabled',
      'random_battle_queued_at',
      'random_battle_cooldown_until',
       'status',
       'is_live',
     ];
    return trackedKeys.every((key) => current[key] === next[key]);
  }, []);

  const handleStreamRealtimeUpdate = useCallback((nextStream: any) => {
    if (!nextStream) return;

    if (streamRef.current && areStreamRealtimeUpdatesEqual(streamRef.current, nextStream)) {
      return;
    }

    const wasInBattleMode = streamRef.current?.is_battle;
    const isNowInBattleMode = nextStream.is_battle;
    const battleIdChanged = streamRef.current?.battle_id !== nextStream.battle_id;
    const wasLive = streamRef.current?.status === 'live' || streamRef.current?.is_live;
    const isNowLive = nextStream.status === 'live' || nextStream.is_live;

    const criticalChanged =
      isNowLive !== wasLive ||
      nextStream.status !== streamRef.current?.status ||
      nextStream.is_battle !== streamRef.current?.is_battle ||
      nextStream.battle_id !== streamRef.current?.battle_id ||
      nextStream.battle_status !== streamRef.current?.battle_status ||
      nextStream.total_likes !== streamRef.current?.total_likes;

    const now = Date.now();
    const lastUpdate = streamRealtimeUpdateRef.current;
    const shouldThrottle = !criticalChanged && lastUpdate && now - lastUpdate < 2000;

    streamRef.current = { ...streamRef.current, ...nextStream };

    if (shouldThrottle) {
      return;
    }

    streamRealtimeUpdateRef.current = now;

    setStream((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        box_count: nextStream.box_count,
        has_rgb_effect: nextStream.has_rgb_effect,
        are_seats_locked: nextStream.are_seats_locked,
        total_likes: nextStream.total_likes,
        seat_price: nextStream.seat_price,
        status: nextStream.status,
        is_live: nextStream.is_live,
        current_viewers: nextStream.current_viewers,
        total_gifts_coins: nextStream.total_gifts_coins,
        is_battle: nextStream.is_battle,
        battle_id: nextStream.battle_id,
        battle_mode: nextStream.battle_mode,
        battle_format: nextStream.battle_format,
        battle_status: nextStream.battle_status,
        battle_start_time: nextStream.battle_start_time,
        battle_end_time: nextStream.battle_end_time,
        random_battle_queue_enabled: nextStream.random_battle_queue_enabled,
        random_battle_queued_at: nextStream.random_battle_queued_at,
        random_battle_cooldown_until: nextStream.random_battle_cooldown_until,
        battle_end_reason: nextStream.battle_end_reason,
        battle_winner_id: nextStream.battle_winner_id,
        side_a_score: nextStream.side_a_score,
         side_b_score: nextStream.side_b_score,
      };
    });

    // Record stream started event if transitioning from not live to live
    if (!wasLive && isNowLive && streamId) {
       recordStreamStarted(streamId).catch(err => {
         console.warn('[BroadcastPage] Failed to record stream started:', err)
       })
        void Promise.resolve(
          supabase.from('rtc_sessions').insert({
            user_id: user?.id,
            room_name: `stream-${nextStream.id || streamId}`,
            started_at: new Date().toISOString(),
            is_active: true,
            duration_seconds: 0,
          })
       ).then(({ error: rtcErr }) => {
         if (rtcErr) {
           console.warn('[BroadcastPage] rtc_sessions insert failed:', rtcErr)
         }
       }).catch(rtcErr => {
         console.warn('[BroadcastPage] rtc_sessions insert error:', rtcErr)
       })
     }

    if (((!wasInBattleMode && isNowInBattleMode) || (battleIdChanged && isNowInBattleMode))) {
      if (import.meta.env.DEV) console.debug('[BroadcastPage] Battle mode activated via stream realtime', {
        is_battle: nextStream.is_battle,
        battle_id: nextStream.battle_id
      });
      setBattleStartTime(nextStream.battle_start_time ? new Date(nextStream.battle_start_time) : new Date());
    }

    if (nextStream.status === 'ended') {
      stopLocalTracksRef.current();
      // Full LiveKit teardown: unpublish, detach handlers, disconnect
      disconnectLiveKitRoom();
      setRemoteParticipants(new Map());
      void removeStreamChannels(streamId || nextStream.id || '')
      trackedTimeout(() => {
        navigate(`/broadcast/summary/${nextStream.id || streamId}`);
      }, 100);
    }
  }, [areStreamRealtimeUpdatesEqual, disconnectLiveKitRoom, navigate, recordStreamStarted, streamId, user?.id]);

  // Ensure rtc_sessions exists when stream is live (handles page load after stream already started)
  useEffect(() => {
    if (!streamId || !stream?.is_live || !user?.id || !stream?.id) return;

    const ensureRtcSession = async () => {
      const { data: existing } = await supabase
        .from('rtc_sessions')
        .select('id')
        .eq('room_name', `stream-${stream.id}`)
        .eq('is_active', true)
        .maybeSingle();

      if (!existing) {
        await supabase.from('rtc_sessions').insert({
          user_id: user.id,
          room_name: `stream-${stream.id}`,
          started_at: new Date().toISOString(),
          is_active: true,
          duration_seconds: 0,
        });
      }
    };

    void ensureRtcSession();
   }, [streamId, stream?.is_live, stream?.id, user?.id]);

   // Fetch recent utromail threads when message popup opens
   useEffect(() => {
    if (!isMessagePopupOpen || !user?.id) return;

    const loadThreads = async () => {
      try {
        const threads = await getThreads(user.id, 'inbox');
        setRecentThreads(threads.slice(0, 5));
      } catch (err) {
        console.error('[BroadcastPage] Failed to load threads:', err);
      }
    };

    void loadThreads();
  }, [isMessagePopupOpen, user?.id]);

  // Search users when in new message mode
  useEffect(() => {
    if (!isNewMessageMode || !searchQuery.trim() || !user?.id) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      try {
        let results: any[] = [];

        if (isHost && broadcasterProfile?.id) {
          // Broadcaster: search followers + current seat occupants only
          const [followersData, seatUserIds] = await Promise.all([
            supabase
              .from('user_follows')
              .select('follower_id')
               .eq('following_id', broadcasterProfile.id)
               .eq('status', 'accepted'),
            Promise.resolve(
              Object.values(seats || {})
                .filter((s: any) => s.user_id)
                .map((s: any) => s.user_id)
            )
          ]);

          const followerIds = new Set((followersData.data || []).map((f: any) => f.follower_id));
          const allowedIds = new Set([...Array.from(followerIds), ...seatUserIds]);

          if (allowedIds.size > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, username, display_name, avatar_url, utromail_address')
              .in('id', Array.from(allowedIds))
              .ilike('username', `%${searchQuery.trim()}%`)
              .limit(5);

            results = (profiles || []).map((u: any) => ({
              ...u,
              is_staff: false,
            }));
          }
        } else {
          // Regular user: search all users
          results = await searchUsers(searchQuery.trim());
        }

        setSearchResults(results.slice(0, 5));
      } catch (err) {
        console.error('[BroadcastPage] Failed to search users:', err);
      }
    };

    void search();
  }, [isNewMessageMode, searchQuery, user?.id, isHost, broadcasterProfile?.id, seats]);

  // Fetch messages when a thread is selected
  useEffect(() => {
    if (!selectedThread || !user?.id) return;

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const msgs = await getThreadMessages(selectedThread.id);
        setThreadMessages(msgs);
      } catch (err) {
        console.error('[BroadcastPage] Failed to load messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    };

    void loadMessages();
  }, [selectedThread, user?.id]);

    useStreamRealtime(streamId, {
      onStream: (event) => {
        const nextStream = event.new;
        // During an active battle, only sync critical properties to avoid remounts.
        const isCurrentlyActiveBattle =
          stream?.is_battle && stream?.battle_status === 'active';
        const isEndingBattle =
          nextStream &&
          (!nextStream.is_battle ||
            nextStream.battle_status === 'ended' ||
            nextStream.battle_status === 'waiting');

        // Preserve local battle state during random battle countdown so the
        // queue controller's optimistic phase/state isn't clobbered by the
        // database 'waiting' snapshot that arrives with match creation.
        const isInRandomBattleCountdown =
          stream?.battle_mode === 'random_queue' &&
          !!stream?.battle_id &&
          (stream?.battle_status === 'starting' || stream?.battle_status === 'waiting');

        // When the battle is ending, apply the FULL payload so the battle flag
        // clears (is_battle=false, battle_id=null). Otherwise the queue controller
        // keeps seeing an active battle and never re-queues after 30s.
        if (isCurrentlyActiveBattle && isEndingBattle) {
          handleStreamRealtimeUpdate(nextStream);
          return;
        }

        if (isCurrentlyActiveBattle) {
          // Only update battle-related properties during active battle
          if (nextStream.battle_status !== stream.battle_status ||
              nextStream.battle_end_time !== stream.battle_end_time) {
            setStream((prev: any) => prev ? { ...prev,
              battle_status: nextStream.battle_status,
              battle_end_time: nextStream.battle_end_time
            } : prev);
          }
          return;
        }

        if (isInRandomBattleCountdown) {
          // If a new random battle arrived while we were still in a previous
          // countdown, treat it as a fresh match so the opponent isn't stuck
          // on stale battle state.
          const isNewRandomBattle =
            nextStream?.battle_mode === 'random_queue' &&
            nextStream?.battle_id &&
            nextStream.battle_id !== stream.battle_id;

          if (isNewRandomBattle || nextStream?.battle_status === 'active' || nextStream?.battle_status === 'ended') {
            setStream((prev: any) => prev ? { ...prev,
              battle_status: nextStream.battle_status,
              is_battle: nextStream.is_battle,
              battle_id: nextStream.battle_id,
              battle_mode: nextStream.battle_mode,
              battle_start_time: nextStream.battle_start_time,
              battle_end_time: nextStream.battle_end_time,
              battle_end_reason: nextStream.battle_end_reason,
              battle_winner_id: nextStream.battle_winner_id,
              random_battle_queue_enabled: nextStream.random_battle_queue_enabled,
              random_battle_queued_at: nextStream.random_battle_queued_at,
              random_battle_cooldown_until: nextStream.random_battle_cooldown_until,
            } : prev);
          }
          return;
        }

        // Normal stream updates for non-battle state
        handleStreamRealtimeUpdate(event.new);
      },
      onMessage: (event) => {
        const newRow = event?.new
        if (!newRow) return
        if (import.meta.env.DEV) {
          console.debug('[BroadcastPage][stream_messages] INSERT payload.new', { streamId, new: newRow })
        }
        const msgId = String(newRow.id || newRow.txn_id || '')
        if (!msgId) return
        if (broadcastChatMessageIdsRef.current.has(msgId)) {
          if (import.meta.env.DEV) {
            console.debug('[BroadcastPage][stream_messages] deduplicated (db id)', { msgId, streamId })
          }
          return
        }
        const username = newRow.user_name || newRow.username || 'Viewer'
        const content = newRow.content || ''
        const chatKey = `${username}:${content}`
        const now = Date.now()
        const existingTs = recentChatKeysRef.current.get(chatKey)
        if (existingTs !== undefined && now - existingTs < CHAT_DEBOUNCE_MS) {
          if (import.meta.env.DEV) {
            console.debug('[BroadcastPage][stream_messages] deduplicated (content match)', { msgId, chatKey, streamId })
          }
          return
        }
        if (newRow.user_id === user?.id) {
          if (import.meta.env.DEV) {
            console.debug('[BroadcastPage][stream_messages] skipping broadcaster own message (shown optimistically)', { msgId, streamId })
          }
          return
        }
        broadcastChatMessageIdsRef.current.add(msgId)
        recentChatKeysRef.current.set(chatKey, now)
        if (!content) return
        if (blockedUsernames.has(username.toLowerCase())) return
        const floatingMsg: FloatingMessage = {
          id: msgId,
          username,
          content,
          createdAt: new Date(newRow.created_at || Date.now()).getTime(),
          user_id: newRow.user_id || undefined,
        }
        setFloatingMessages(prev => [floatingMsg, ...prev].slice(0, 50))
        if (import.meta.env.DEV) {
          console.debug('[BroadcastPage][stream_messages] message appended', { msgId, username, streamId })
        }
        trackedTimeout(() => {
          setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
        }, 30_000)
      },
      onGift: (event) => {
        if (event.table === 'stream_gifts') return
        if (import.meta.env.DEV) {
          console.debug('[BroadcastPage] useStreamRealtime.onGift', { event })
        }
        const rawGift = event?.new ?? event
        if (rawGift) {
          void processGiftEvent(rawGift)
        }
      },
        onParticipant: (event: any) => {
          if (event.eventType !== 'UPDATE' || !event.new || !streamId) return
          const participant = event.new
          if (participant.stream_id !== streamId || participant.removed !== true) return

          const removedUserId = participant.user_id
          if (!removedUserId) return

          removeSeatByUserId(removedUserId)

          setRemoteParticipants((prev) => {
            const next = new Map(prev)
            for (const [identity, p] of next) {
              try {
                const metadata = p?.metadata ? JSON.parse(p.metadata) : {}
                if (metadata.user_id === removedUserId || metadata.userId === removedUserId) {
                  next.delete(identity)
                }
              } catch {
                // ignore malformed metadata
              }
            }
            return next
          })
        },
        onPresenceBroadcast: (event) => {
          if (event.table !== 'broadcast:like_sent') return
          const likeData = event.new || event.raw?.payload || {}
          if (likeData.user_id === user?.id) return
          const newTotal = typeof likeData.total_likes === 'number' ? likeData.total_likes : null
          if (newTotal === null) return
          setStream((prev) => {
            if (!prev) return prev
            return { ...prev, total_likes: newTotal }
          })
        },
        onLeagueLevelUp: (event) => {
          const data = event.new || event.raw?.payload || {}
          if (!data?.user_id) return
          if (data.user_id === user?.id) return
          setLeagueBannerEvent({
            user_id: data.user_id,
            username: data.username || 'Someone',
            type: data.type || 'sub_tier',
            previous: data.previous || '',
            current: data.current || '',
            tierLabel: data.tierLabel || data.current || 'New Level',
            icon: data.icon || '⭐',
          })
        },
      });

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`stream-presence:${streamId}`, {
      config: { presence: { key: user?.id || anonymousViewerIdRef.current } },
    });

    const mergeActiveViewerRows = async (viewerMap: Map<string, any>, broadcasterId?: string) => {
      if (!streamId) return viewerMap;

      try {
        const since = new Date(Date.now() - 90_000).toISOString();
        const { data } = await supabase
          .from('stream_viewers')
          .select('user_id, last_seen, joined_at, user:user_profiles(username, display_name, email, avatar_url, role, troll_role, is_admin, created_at)')
          .eq('stream_id', streamId)
          .gte('last_seen', since)
          .limit(75);

        (data || []).forEach((row: any) => {
          const id = String(row.user_id || '');
          if (!id || id === broadcasterId || viewerMap.has(id)) return;
          const userProfile = Array.isArray(row.user) ? row.user[0] : row.user;
          viewerMap.set(id, {
            user_id: id,
            username: userProfile?.username || userProfile?.email?.split('@')?.[0] || 'Troll Citizen',
            avatar_url: userProfile?.avatar_url || null,
            role: userProfile?.role,
            troll_role: userProfile?.troll_role,
            is_admin: !!userProfile?.is_admin,
            is_troll_officer: !!userProfile?.is_troll_officer,
            is_lead_officer: !!userProfile?.is_lead_officer,
            created_at: userProfile?.created_at || '',
            joined_at: row.joined_at || row.last_seen || new Date().toISOString(),
          });
        });
      } catch (err) {

      }

      return viewerMap;
    };

    const updateViewerCountFromPresence = async () => {
      const state = channel.presenceState();
      const broadcasterId = streamRef.current?.user_id;
      const viewerIds = new Set<string>();
      const viewerMap = new Map<string, any>();

      Object.values(state).forEach((presences) => {
        (presences as any[]).forEach((presence) => {
          const id = String(presence?.user_id || presence?.key || '');
          if (!id || id === broadcasterId) return;
          viewerIds.add(id);
          viewerMap.set(id, {
            user_id: id,
            username: presence?.username || presence?.email?.split('@')?.[0] || 'Troll Citizen',
            avatar_url: presence?.avatar_url || null,
            role: presence?.role,
            troll_role: presence?.troll_role,
            is_admin: !!presence?.is_admin,
            is_troll_officer: !!presence?.is_troll_officer,
            is_lead_officer: !!presence?.is_lead_officer,
            created_at: presence?.created_at || '',
            joined_at: presence?.online_at || new Date().toISOString(),
          });
        });
      });

      await mergeActiveViewerRows(viewerMap, broadcasterId);
      viewerMap.forEach((_viewer, id) => viewerIds.add(id));

      const totalUsers = viewerIds.size;
      setViewerCount(totalUsers);
      setActiveViewerProfiles(Array.from(viewerMap.values()));
      window.dispatchEvent(new CustomEvent('broadcast-active-viewers', {
        detail: { streamId, viewers: Array.from(viewerMap.values()) },
      }));

      const now = Date.now();
      if (now - viewerCountUpdateRef.current > 5000) {
        viewerCountUpdateRef.current = now;
        supabase
          .rpc('update_stream_viewer_count', { p_stream_id: streamId, p_count: totalUsers })
          .then(({ error }) => {
            if (error) console.warn('[BroadcastPage] Failed to update viewer count:', error);
          });
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        void updateViewerCountFromPresence();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        void updateViewerCountFromPresence();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        void updateViewerCountFromPresence();
      });

    channel
      .on(
        'broadcast',
        { event: 'box_count_changed' },
        (payload) => {
          try {
            const boxData = payload.payload;
            if (boxData && boxData.box_count !== undefined) {
              setStream((prev: any) => {
                if (!prev) return prev;
                return { ...prev, box_count: boxData.box_count };
              });
            }
          } catch (err) {

          }
        }
      )
      // Gift events are handled by the dedicated stream-gifts channel below
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          try {
            const likeData = payload.payload;
            // Ignore likes from self (sender already updated optimistically)
            if (likeData.user_id === user?.id) {
              return;
            }
            setStream((prev: any) => {
              if (!prev) return prev;
              const newTotal = likeData.total_likes !== undefined
                ? likeData.total_likes
                : (prev.total_likes || 0) + 2;
              return { ...prev, total_likes: newTotal };
            });
          } catch (err) {

          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          
          supabase
            .from('user_profiles')
            .select('active_entrance_effect')
            .eq('id', user?.id)
            .maybeSingle()
            .then(({ data: effectData }) => {
          const currentProfile = profileRef.current;
           channel.track({
               user_id: user?.id || 'viewer',
               username: currentProfile?.username || user?.email?.split('@')?.[0] || 'Troll Citizen',
               email: user?.email,
               is_host: isHost,
               online_at: new Date().toISOString(),
                avatar_url: currentProfile?.avatar_url || '',
                role: currentProfile?.role,
                troll_role: currentProfile?.troll_role,
                is_admin: !!currentProfile?.is_admin,
                is_troll_officer: !!(currentProfile as any)?.is_troll_officer,
                is_lead_officer: !!(currentProfile as any)?.is_lead_officer,
                created_at: currentProfile?.created_at || '',
                entrance_effect: effectData?.active_entrance_effect || null
              }).catch(console.error);
            });
        }
      });

    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ping',
          payload: { timestamp: Date.now(), user_id: user?.id }
        }).catch(() => {});
      }
    }, 60000);

    return () => {
      clearInterval(heartbeatInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
    }, [streamId, navigate, user?.id, isHost]);

  const floatingChatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

   // -- Floating Chat: receive broadcasts ------------------------------------
  useEffect(() => {
    if (!streamId) return;

    const timers = new Set<number>();
    const channel = supabase.channel(`floating-chat:${streamId}`);
    floatingChatChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content, user_id } = payload.payload || {}
        if (!username || !content) return;

        const chatKey = `${username}:${content}`;
        const now = Date.now();
        const existingTs = recentChatKeysRef.current.get(chatKey);
        if (existingTs !== undefined && now - existingTs < CHAT_DEBOUNCE_MS) {
          if (import.meta.env.DEV) {
            console.debug('[BroadcastPage][floating_chat] deduplicated (content match)', { chatKey, streamId })
          }
          return;
        }
        recentChatKeysRef.current.set(chatKey, now);

        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setFloatingMessages(prev =>
          [
            {
              id: msgId,
              username,
              content,
              createdAt: Date.now(),
              user_id,
            } as FloatingMessage,
            ...prev,
          ].slice(0, 50)
        );

       if (!isHost) {
       }

       const timer = window.setTimeout(() => {
         setFloatingMessages(prev => prev.filter(m => m.id !== msgId));
         timers.delete(timer);
       }, 30_000);

        timers.add(timer);
      })
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.debug('[BroadcastPage][floating_chat] channel status', { streamId, status })
        }
      });

    if (import.meta.env.DEV) {
      console.debug('[BroadcastPage] resolved streamId for floating-chat', { streamId })
    }

    return () => {
      if (import.meta.env.DEV) {
        console.debug('[BroadcastPage] floating-chat channel cleanup', { streamId })
      }
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      floatingChatChannelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [streamId, supabase]);

  // Gift animations are driven by both the `stream-gifts:${streamId}` broadcast
  // channel AND the stream_gifts postgres_changes (via useStreamRealtime.onGift).
  // Both paths now route through processGiftEvent (via a ref), which calls the
  // pipeline's internal dedup so each gift is added to recentGifts exactly once
  // — the animationId is always the stream_gifts row UUID.
  // If you are building a minimal overlay or chat overlay that only shows
  // the in-chat gift line, re-subscribe to `giftChannel` here instead.

  useEffect(() => {
    if (recentGifts.length > 0) {

    }
  }, [recentGifts]);

  // Listen for broadcast-balance-update events to update both broadcaster profile and auth store
  useEffect(() => {
    const processedGiftIdsRef = { current: new Set<string>() } as { current: Set<string> };

    const handleBroadcastBalanceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const senderId = detail.sender_id || detail.senderId || detail.sender;
      const receiverId = detail.receiver_id || detail.receiverId || detail.receiver;
      const amount = Number(detail.amount || detail.coins || detail.value || 0);
      const giftId = detail.gift_id || detail.giftId || detail.id || null;

      if (!amount || !senderId || !receiverId) return;

      // If we have a giftId, dedupe repeated balance events to avoid double-application
      if (giftId) {
        if (processedGiftIdsRef.current.has(String(giftId))) {

          return;
        }
        processedGiftIdsRef.current.add(String(giftId));
      }

      const broadcasterId = streamRef.current?.user_id;
      const currentUserId = user?.id;

      // Balance updates are handled by the realtime user_profiles subscription
      // No need to manually update here - avoids double/triple crediting
    };

    window.addEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate as EventListener);
    return () => {
      window.removeEventListener('broadcast-balance-update', handleBroadcastBalanceUpdate as EventListener);
    };
  }, [user?.id]);

  // Fetch stream mods for the floating overlay badges
  useEffect(() => {
    const fetchMods = async () => {
      const targetHostId = stream?.user_id;
      if (!targetHostId) return;
      const { data } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', targetHostId);
      if (data) setStreamMods(data.map(d => d.user_id));
    };
    fetchMods();
  }, [stream?.user_id]);

  useEffect(() => {
    // Allow anonymous viewers to watch without authentication.
    // Only publishers still require a real user or guest seat identity.
    const hasUserIdentity = !isHost || !!user?.id;

    if (!stream || !stream.id || !hasUserIdentity) {
      return;
    }

    // Only connect to LiveKit if the stream is actually live
    // This prevents RTC session minutes from accumulating when there's no broadcast.
    // However, the host must always be able to connect during a SetupPage->BroadcastPage
    // transition even if the stream's database status is temporarily stale.
    const hasTransfer = Boolean(
      usePreflightStore.getState().room ||
      PreflightStore.getLivekitRoom() ||
      PreflightStore.getTransferSession()
    )

    const isBroadcastActive = (s: any) => {
      if (!s) return false
      if (s.is_live === true) return true
      const status = String(s.status || '').toLowerCase()
      if (status === 'starting' || status === 'live') return true
      // During a transition the stream row may not yet reflect 'live'.
      // Allow the host to connect if a transfer session exists.
      if (isHost && hasTransfer && status !== 'ended' && status !== 'failed') return true
      return false
    }

    const isBroadcastActiveResult = isBroadcastActive(stream)

    // Host/broadcaster must keep their LiveKit room through non-ended stream state transitions.
    // We only suppress LiveKit for ended/failed broadcasts where is_live is explicitly false.
    // During a SetupPage->BroadcastPage transition the stream row may be stale,
    // so we must not suppress the connection when a transfer session exists.
    const isHostEndedOrFailed =
      isHost && (stream?.is_live === false) &&
      (String(stream?.status || '').toLowerCase() === 'ended' || String(stream?.status || '').toLowerCase() === 'failed') &&
      !hasTransfer

    console.log('[BroadcastStatusGuard] active check result', {
      streamId,
      isHost,
      streamStatus: stream?.status,
      streamIsLive: stream?.is_live,
      isBroadcastActive: isBroadcastActiveResult,
      isHostEndedOrFailed,
      hasTransfer,
    })

    if (!isBroadcastActiveResult && !isHostEndedOrFailed) {
      console.log('[BroadcastStatusGuard] ignored non-ended transitional status for active stream')
    }

    if (!isBroadcastActiveResult && isHostEndedOrFailed) {
      console.log('[BroadcastPage] Stream is ended/failed and no transfer session — skipping LiveKit connection')
      return
    }

    const shouldPublish = isHost

    // Determine the user identity for LiveKit
    // Use user.id for logged-in users, or anonymous viewer for guests
    const userIdentity = user?.id || anonymousViewerIdRef.current;
    const connectionRole = shouldPublish ? 'publisher' : 'audience';
    const connectionKey = `${stream.id}:${userIdentity}:${connectionRole}`;

    if (hasJoinedRef.current && liveKitConnectionKeyRef.current === connectionKey) {
      return;
    }

    if (hasJoinedRef.current && liveKitConnectionKeyRef.current !== connectionKey) {
      const existingRoom = roomRef.current;
      if (existingRoom) {
        detachLiveKitHandlers(existingRoom);
        livekitRoomDisconnectedCountRef.current += 1
        DEBUG_COUNTERS.livekitRoomDisconnectedCount++
        console.log(`[BroadcastPage] LiveKit room disconnected due to connection key change: ${DEBUG_COUNTERS.livekitRoomDisconnectedCount}`)
        existingRoom.disconnect().catch(console.error);
      }
      setRemoteParticipants(new Map());
      hasJoinedRef.current = false;
      liveKitConnectionKeyRef.current = null;
    }
    
    let mounted = true

    const initLiveKit = async () => {
      if (!shouldPublish) {
        // OPTIMIZED: Don't block UI - connect in background without isJoining state
        try {
          const viewerIdentity = userIdentity
          // OPTIMIZED: Use parallel fetch for faster token get
          console.log('[BroadcastPage] ?? Fetching LiveKit token from Supabase Edge Function...', {
            streamId: stream.id,
            viewerIdentity,
            role: 'audience',
            room: stream.livekit_room_name || stream.id,
          });
          
          const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: {
              room: roomName,
              roomName,
              identity: viewerIdentity,
              name: profile?.username || 'Guest Viewer',
              role: 'audience',
              isHost: false
            }
          })

          if (error) {
            console.error('[BroadcastPage] LiveKit token fetch error:', error)
            return
          }

          if (!data?.token) {
            console.error('[BroadcastPage] LiveKit token response missing token')
            return
          }

          console.log('[BroadcastPage] ? LiveKit token received:', {
            hasToken: !!data?.token,
            tokenLength: data?.token?.length || 0,
            room: data?.room,
            identity: data?.identity,
          });

          const room = new Room()
          livekitRoomCreatedCountRef.current += 1
          DEBUG_COUNTERS.livekitRoomCreatedCount++
          console.log(`[BroadcastPage] LiveKit room created: ${DEBUG_COUNTERS.livekitRoomCreatedCount}`)
          roomRef.current = room

          attachLiveKitHandlers(room)

          await connectRoom(room, data.token)

          // Get existing participants who were already in the room (LiveKit v2.x uses remoteParticipants)
          const existingParticipants = room.remoteParticipants
            ? Array.from(room.remoteParticipants?.values?.() || []) as RemoteParticipant[]
            : []
          if (existingParticipants.length > 0) {
            console.log('[BroadcastPage] Viewer: Found existing participants:', existingParticipants.length, existingParticipants.map((p: RemoteParticipant) => p.identity))
            // Build a new Map with all existing participants
            const newParticipantsMap = new Map<string, RemoteParticipant>()
            existingParticipants.forEach((participant: RemoteParticipant) => {
              newParticipantsMap.set(participant.identity, participant)
              console.log('[BroadcastPage] Viewer: Adding existing participant:', participant.identity)
            })
            // Set the Map in one go to avoid batching issues
            setRemoteParticipants(newParticipantsMap)
          } else {
            console.log('[BroadcastPage] Viewer: No existing participants in room')
          }

          hasJoinedRef.current = true
          liveKitConnectionKeyRef.current = connectionKey
        } catch (err) {
          console.error('Viewer join error:', err)
        }
        // OPTIMIZED: Removed isJoining state update - no blocking UI
        return
      }

      // OPTIMIZED: Don't block UI - connect in background
      try {
        // Check for a transferred SetupPage room BEFORE fetching a new token.
        // If SetupPage already connected a LiveKit room and published tracks,
        // BroadcastPage must adopt that existing session instead of creating
        // a second room, requesting a second token, and republishing tracks.
        const transferSession = usePreflightStore.getState().transferSession || PreflightStore.getTransferSession()
        const preflightRoom = usePreflightStore.getState().room || PreflightStore.getLivekitRoom()
        const preflightRoomName = usePreflightStore.getState().roomName || transferSession?.roomName

        if (preflightRoom && preflightRoom.state === 'connected' && preflightRoomName) {
          console.log('[BroadcastPage] Adopting transferred SetupPage LiveKit room', {
            roomName: preflightRoom.name,
            roomState: preflightRoom.state,
            streamId: stream?.id,
            expectedRoomName: preflightRoomName,
            ownership: transferSession?.ownership,
            transitionInProgress: transferSession?.transitionInProgress,
          })

          roomRef.current = preflightRoom
          attachLiveKitHandlers(preflightRoom)

          // Read the room name directly from the connected room object
          const adoptedRoomName = preflightRoom.name

          // Read existing local track publications from the transferred room
          const existingMicPublication = preflightRoom.localParticipant.getTrackPublication(Track.Source.Microphone)
          const existingCamPublication = preflightRoom.localParticipant.getTrackPublication(Track.Source.Camera)
          const existingScreenPublication = preflightRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare)
          const existingScreenAudioPublication = preflightRoom.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)

          const activeAudioTrack = existingMicPublication?.track as LocalAudioTrack | null
          const activeVideoTrack = existingCamPublication?.track as LocalVideoTrack | null
          const activeScreenTrack = existingScreenPublication?.track as LocalVideoTrack | null
          const activeScreenAudioTrack = existingScreenAudioPublication?.track as LocalAudioTrack | null

          // Sync local track state
          if (activeAudioTrack || activeVideoTrack) {
            setLocalTracks([
              activeAudioTrack || null,
              activeVideoTrack || null,
            ])
          }

          // Sync mute/camera state from the transferred tracks
          if (activeVideoTrack) {
            setCameraEnabled(Boolean(activeVideoTrack.mediaStreamTrack?.enabled))
          }
          if (activeAudioTrack) {
            setMicEnabled(Boolean(activeAudioTrack.mediaStreamTrack?.enabled))
          }

          // Mark the transfer as adopted
          if (transferSession) {
            PreflightStore.adoptTransferSession(transferSession)
          }

          // Clear only the transition marker, not the active resources
          usePreflightStore.getState().setTransferringToBroadcast(false)

          isGoingLiveRef.current = true
          hasJoinedRef.current = true
          liveKitConnectionKeyRef.current = `${stream.id}:${userIdentity}:publisher`

          console.log('[BroadcastPage] Transfer adopted successfully', {
            roomName: adoptedRoomName,
            hasAudio: !!activeAudioTrack,
            hasVideo: !!activeVideoTrack,
            hasScreen: !!activeScreenTrack,
          })
          return
        }

        // No valid transfer session — fetch a new token and connect normally
        const hostIdentity = userIdentity
        // OPTIMIZED: Fetch token without waiting for UI
        console.log('[BroadcastPage] ?? Fetching LiveKit token for publisher from Supabase Edge Function...', {
          streamId: stream.id,
          hostIdentity,
          room: stream.livekit_room_name || stream.id,
        });

        const { data, error } = await supabase.functions.invoke('livekit-token', {
          body: {
            room: roomName,
            roomName,
            identity: hostIdentity, // Use hostIdentity for publisher
            name: profile?.username || 'Guest',
            role: 'publisher',
            isHost
          }
        })

        if (error) {
          console.error('[BroadcastPage] Host LiveKit token fetch error:', error)
          return
        }

        if (!data?.token) {
          console.error('[BroadcastPage] Host LiveKit token response missing token')
          return
        }

        console.log('[BroadcastPage] ? LiveKit token received for publisher:', {
          hasToken: !!data?.token,
          tokenLength: data?.token?.length || 0,
          room: data?.room,
          identity: data?.identity,
        });

        const expectedRoomName =
          String(data.room || data.roomName || data.room_name || stream.id)

        console.log('[BroadcastPage] LiveKit token target', {
          streamId: stream.id,
          expectedRoomName,
          existingRoomName: PreflightStore.getLivekitRoom()?.name || '',
        })

        // Mark that we're going live so cleanup doesn't clear tracks prematurely
        isGoingLiveRef.current = true

        // Check for preflight room and tracks FIRST
        const existingRoom = PreflightStore.getLivekitRoom()
        const preflightTracks = PreflightStore.getTracks()
        const isScreenShareExisting = PreflightStore.getScreenShareMode()
        const screenTrackExisting = PreflightStore.getScreenTrack() || screenTrack
        
        console.log('[BroadcastPage] ?? PreflightStore state:', {
          hasExistingRoom: !!existingRoom,
          hasPreflightTracks: !!(preflightTracks?.videoTrack || preflightTracks?.audioTrack),
          isScreenShareExisting,
          hasScreenTrack: !!screenTrackExisting,
        })

        const existingRoomName = String(existingRoom?.name || '')
        const existingRoomState = existingRoom?.state

        const canReuseExistingRoom =
          Boolean(existingRoom) &&
          existingRoomState === 'connected' &&
          existingRoomName === expectedRoomName

        let roomToUse: Room
        let activeAudioTrack: LocalAudioTrack | null = null
        let activeVideoTrack: LocalVideoTrack | null = null

        if (canReuseExistingRoom && existingRoom) {
          console.log('[BroadcastPage] Reusing matching SetupPage LiveKit room', {
            expectedRoomName,
            existingRoomName,
            state: existingRoom.state,
          })

          roomToUse = existingRoom
          roomRef.current = existingRoom
          attachLiveKitHandlers(existingRoom)
        } else {
          console.warn('[BroadcastPage] Discarding stale or mismatched SetupPage room', {
            expectedRoomName,
            existingRoomName,
            existingRoomState,
          })

          if (existingRoom) {
            try {
              detachLiveKitHandlers(existingRoom)

              if (existingRoom.state !== 'disconnected') {
                await existingRoom.disconnect()
              }
            } catch (error) {
              console.warn(
                '[BroadcastPage] Failed to disconnect stale SetupPage room:',
                error,
              )
            }
          }

          PreflightStore.clear()

          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
              ...videoPreset,
              facingMode: 'user',
            },
            audioCaptureDefaults: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          })

          livekitRoomCreatedCountRef.current += 1
          DEBUG_COUNTERS.livekitRoomCreatedCount++
          console.log(`[BroadcastPage] LiveKit room created: ${DEBUG_COUNTERS.livekitRoomCreatedCount}`)
          console.log('[BroadcastPage] Creating LiveKit room for current stream', {
            expectedRoomName,
          })

          roomToUse = room
          roomRef.current = room
          attachLiveKitHandlers(room)
        }

        if (roomToUse.state !== 'connected') {
          await connectRoom(roomToUse, data.token)
        }

        const existingParticipants = roomToUse.remoteParticipants
          ? Array.from(roomToUse.remoteParticipants.values()) as RemoteParticipant[]
          : []

        for (const participant of existingParticipants) {
          const publications = Array.from(
            participant.trackPublications?.values?.() || [],
          )

          for (const publication of publications as any[]) {
            try {
              if (
                publication?.setSubscribed &&
                !publication.isSubscribed
              ) {
                publication.setSubscribed(true)
              }
            } catch (err) {
              console.warn(
                '[BroadcastPage] Failed to subscribe to existing participant track:',
                {
                  participantIdentity: participant.identity,
                  trackSid: publication?.trackSid,
                  err,
                },
              )
            }
          }
        }

        setRemoteParticipants(() => {
          const next = new Map<string, RemoteParticipant>()
          existingParticipants.forEach((participant) => next.set(participant.identity, participant))
          return next
        })
        if (import.meta.env.DEV) {
          console.log('[BroadcastPage] Host: synced existing remote participants after connect', {
            count: existingParticipants.length,
            identities: existingParticipants.map((participant) => participant.identity),
          })
        }

        const existingMicPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
          Array.from(roomToUse.localParticipant.audioTrackPublications.values()).find((pub: any) =>
            pub?.track?.kind === 'audio'
          )

        const existingCameraPublication =
          roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
          Array.from(roomToUse.localParticipant.videoTrackPublications.values()).find((pub: any) =>
            pub?.source === Track.Source.Camera ||
            pub?.track?.source === Track.Source.Camera ||
            pub?.track?.kind === 'video'
          )

        const hasExistingCamera = Boolean(existingCameraPublication?.track)
        const hasExistingMic = Boolean(existingMicPublication?.track)

        const shouldRecreateTracks =
          roomToUse.state === 'connected' &&
          !hasExistingCamera &&
          !hasExistingMic &&
          !usePreflightStore.getState().transferringToBroadcast

        if (shouldRecreateTracks) {
          console.log('[BroadcastPage] ?? Recreating host tracks after refresh', {
            hasExistingCamera,
            hasExistingMic,
            currentVideoReadyState: videoTrackRef.current?.mediaStreamTrack?.readyState,
            currentAudioReadyState: audioTrackRef.current?.mediaStreamTrack?.readyState,
          })

          if (existingCameraPublication?.track) {
            try {
              await roomToUse.localParticipant.unpublishTrack(existingCameraPublication.track)
              const oldVideoTrack = existingCameraPublication.track as any
              if (oldVideoTrack && typeof oldVideoTrack.stop === 'function') {
                oldVideoTrack.stop()
              } else if (
                oldVideoTrack?.mediaStreamTrack &&
                typeof oldVideoTrack.mediaStreamTrack.stop === 'function'
              ) {
                oldVideoTrack.mediaStreamTrack.stop()
              }
            } catch (err) {
              console.warn('[BroadcastPage] Could not stop old video track safely:', err)
            }
          }

          if (existingMicPublication?.track) {
            try {
              await roomToUse.localParticipant.unpublishTrack(existingMicPublication.track)
              const oldAudioTrack = existingMicPublication.track as any
              if (oldAudioTrack && typeof oldAudioTrack.stop === 'function') {
                oldAudioTrack.stop()
              } else if (
                oldAudioTrack?.mediaStreamTrack &&
                typeof oldAudioTrack.mediaStreamTrack.stop === 'function'
              ) {
                oldAudioTrack.mediaStreamTrack.stop()
              }
            } catch (err) {
              console.warn('[BroadcastPage] Could not stop old audio track safely:', err)
            }
          }

          const freshTracks = await createLocalTracks({
            audio: true,
            video: {
              resolution: videoPreset.resolution,
              facingMode: isMobileDevice ? 'user' : undefined,
            },
          })

          if (freshTracks.length > 0) {
            localTrackCreatedCountRef.current += freshTracks.length
            freshTracks.forEach((track) => {
              if (track.kind === 'video') {
                DEBUG_COUNTERS.hostVideoTrackCreatedCount++
              } else if (track.kind === 'audio') {
                DEBUG_COUNTERS.hostAudioTrackCreatedCount++
              }
            })
          }

          activeAudioTrack = freshTracks.find((track) => track.kind === Track.Kind.Audio) as LocalAudioTrack | undefined || null
          activeVideoTrack = freshTracks.find((track) => track.kind === Track.Kind.Video) as LocalVideoTrack | undefined || null
        } else if (hasExistingCamera || hasExistingMic) {
          console.log('[BroadcastPage] ?? Using existing host publications from transferred room', {
            hasExistingCamera,
            hasExistingMic,
          })
          activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || preflightTracks?.audioTrack || null
          activeVideoTrack = (existingCameraPublication?.track as LocalVideoTrack | null) || preflightTracks?.videoTrack || null
        } else if (preflightTracks?.videoTrack || preflightTracks?.audioTrack) {
          // ? Use preflight tracks from SetupPage
          console.log('[BroadcastPage] ? Using preflight tracks from SetupPage')
          activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || preflightTracks.audioTrack
          activeVideoTrack = (existingCameraPublication?.track as LocalVideoTrack | null) || preflightTracks.videoTrack
        } else {
          // Create new tracks only if no preflight tracks
          console.log('[BroadcastPage] ?? No preflight tracks - creating new tracks')
          const tracks = await createLocalTracks({
            audio: true,
            video: isScreenShareExisting
              ? { resolution: VideoPresets.h720.resolution }
              : {
                  resolution: videoPreset.resolution,
                  facingMode: isMobileDevice ? 'user' : undefined,
                },
          })

          if (tracks.length > 0) {
            localTrackCreatedCountRef.current += tracks.length
            tracks.forEach((track) => {
              if (track.kind === 'video') {
                DEBUG_COUNTERS.hostVideoTrackCreatedCount++
              } else if (track.kind === 'audio') {
                DEBUG_COUNTERS.hostAudioTrackCreatedCount++
              }
            })
          }

          activeAudioTrack = (existingMicPublication?.track as LocalAudioTrack | null) || (tracks.find((t) => t.kind === 'audio') as LocalAudioTrack | undefined) || null
          activeVideoTrack = (existingCameraPublication?.track as LocalVideoTrack | null) || (tracks.find((t) => t.kind === 'video') as LocalVideoTrack | undefined) || null
        }

        if (!activeVideoTrack) {
          console.error('[BroadcastPage] ? NO VIDEO TRACK AVAILABLE')
          return
        }

        // ?? PUBLISH TRACKS TO ROOM
        console.log('[BroadcastPage] ?? Publishing tracks to room...')
        
        if (roomToUse.state !== 'connected') {
          console.warn('[BroadcastPage] Cannot publish: room is not connected', {
            state: roomToUse.state,
          })
          return
        }
        
        if (activeVideoTrack) {
          // Check if already published to avoid duplicate
          const existingVideoPub =
            roomToUse.localParticipant.getTrackPublication(Track.Source.Camera) ||
            Array.from(roomToUse.localParticipant.videoTrackPublications.values())
              .find((pub: any) =>
                pub.trackName === (activeVideoTrack as any)?.name ||
                pub?.track === activeVideoTrack ||
                pub?.track?.source === Track.Source.Camera
              )
          if (!existingVideoPub) {
            await roomToUse.localParticipant.publishTrack(activeVideoTrack)
            localTrackPublishedCountRef.current += 1
            DEBUG_COUNTERS.hostAudioVideoPublishedCount += 1
            console.log('[BroadcastPage] ? Video track published')
          } else {
            console.log('[BroadcastPage] ?? Video track already published')
          }
        }

        if (activeAudioTrack) {
          // Check if already published to avoid duplicate
          const existingAudioPub =
            roomToUse.localParticipant.getTrackPublication(Track.Source.Microphone) ||
            Array.from(roomToUse.localParticipant.audioTrackPublications.values())
              .find((pub: any) =>
                pub.trackName === (activeAudioTrack as any)?.name ||
                pub?.track === activeAudioTrack ||
                pub?.track?.source === Track.Source.Microphone ||
                pub?.track?.kind === 'audio'
              )
          if (!existingAudioPub) {
            await roomToUse.localParticipant.publishTrack(activeAudioTrack)
            localTrackPublishedCountRef.current += 1
            DEBUG_COUNTERS.hostAudioVideoPublishedCount += 1
            console.log('[BroadcastPage] ? Audio track published')
          } else {
            console.log('[BroadcastPage] ?? Audio track already published')
          }
        }

        // ?? CRITICAL: SYNC TO STATE IMMEDIATELY
        setLocalTracks([
          activeAudioTrack || null,
          activeVideoTrack || null,
        ])
        setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
        setMicEnabled(Boolean(activeAudioTrack?.mediaStreamTrack?.enabled ?? activeAudioTrack))

        console.log('[BroadcastPage] ?? Tracks synced to state:', {
          hasVideo: !!activeVideoTrack,
          hasAudio: !!activeAudioTrack,
        })

        // Handle screen share mode: replace camera with screen track
        if (isScreenShareExisting && screenTrackExisting && activeVideoTrack) {
          try {
            // Unpublish camera track
            for (const pub of roomRef.current.localParticipant.videoTrackPublications.values()) {
              if (pub.track && pub.track.kind === 'video') {
                await roomRef.current.localParticipant.unpublishTrack(pub.track)
                console.log('[BroadcastPage] Camera track unpublished (screen share mode)')
                break
              }
            }
            // Publish screen track
            await roomRef.current.localParticipant.publishTrack(screenTrackExisting)
            localTrackPublishedCountRef.current += 1
            activeVideoTrack = screenTrackExisting
            setIsScreenSharing(true)
            setLocalTracks([activeAudioTrack || null, activeVideoTrack])
            setCameraEnabled(Boolean(activeVideoTrack?.mediaStreamTrack?.enabled ?? activeVideoTrack))
            console.log('[BroadcastPage] Screen track published (screen share mode)')
          } catch (err) {
            console.error('[BroadcastPage] Failed to publish screen track:', err)
          }
        }

        hasJoinedRef.current = true
        liveKitConnectionKeyRef.current = connectionKey

        } catch (err) {
          console.error('LiveKit init error:', err)
        }
        // OPTIMIZED: Removed finally block - no UI blocking
      }

      initLiveKit()

         return () => {
           mounted = false
           // IMPORTANT: do NOT disconnect the LiveKit room here. This cleanup runs
           // on every re-run of the effect (any dependency change), and
           // disconnecting would kill the host's camera. Re-connection when the
           // connection key actually changes is handled at the top of the effect
           // (see the key-change teardown above). Final teardown on unmount is
           // handled by the dedicated unmount-only effect below.
         }
        }, [
          stream?.id,
          stream?.status,
          stream?.is_live,
          user?.id, // user.id is used for identity
          isHost,
          // NOTE: viewerCount / activeAudience.length are intentionally NOT deps.
          // They change whenever a viewer joins/leaves, and this effect's cleanup
          // disconnects the LiveKit room — including the HOST's camera. Reacting to
          // them was tearing down the broadcaster's camera the moment anyone
          // watched. Capacity checks read the latest values via refs instead.
          attachLiveKitHandlers,
          detachLiveKitHandlers,
          disconnectLiveKitRoom,
        ])

  // Dedicated unmount-only teardown: fully disconnect the LiveKit room exactly
  // once when the page is destroyed. This replaces the per-render teardown that
  // used to live in the connect effect (which killed the host camera on viewer
  // join/leave). Empty deps → runs only on unmount.
  useEffect(() => {
    return () => {
      disconnectLiveKitRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleCamera = useCallback(async () => {
    const participant = roomRef.current?.localParticipant
    if (!participant) return

    const runCameraToggle = async () => {
      const currentParticipant = roomRef.current?.localParticipant
      if (!currentParticipant) return

      if (currentParticipant.isCameraEnabled) {
        await currentParticipant.setCameraEnabled(false)
      } else {
        await currentParticipant.setCameraEnabled(true, { facingMode: cameraFacingMode } as any)
      }

      const nextEnabled = Boolean(currentParticipant.isCameraEnabled)
      setCameraEnabled(nextEnabled)

      const nextVideoTrack = Array.from(currentParticipant.videoTrackPublications.values())
        .find((pub) => pub.track && pub.track.kind === 'video')?.track as LocalVideoTrack | null

      setLocalTracks((prev) => prev ? [prev[0], nextEnabled ? nextVideoTrack || prev[1] : null] : prev)
    }

    const previous = cameraToggleQueueRef.current.catch(() => {})
    const next = previous
      .then(runCameraToggle, runCameraToggle)
      .catch((err) => {
        console.error('[BroadcastPage] Error toggling camera:', err)
      })
      .finally(() => {
        if (cameraToggleQueueRef.current === previous) {
          cameraToggleQueueRef.current = Promise.resolve()
        }
      })

    cameraToggleQueueRef.current = next
    return next
  }, [cameraFacingMode, setLocalTracks])

  const flipCamera = useCallback(async () => {
    const participant = roomRef.current?.localParticipant
    if (!participant) return

    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user'
    try {
      await participant.setCameraEnabled(false)
      await participant.setCameraEnabled(true, { facingMode: nextMode } as any)
      setCameraFacingMode(nextMode)
      setCameraEnabled(true)

      const videoPub = Array.from(participant.videoTrackPublications.values())
        .find((pub) => pub.track && pub.track.kind === 'video')
      setLocalTracks(prev => prev ? [prev[0], (videoPub?.track as LocalVideoTrack) || prev[1]] : prev) // Update original localTracks
      toast.success(nextMode === 'environment' ? 'Rear camera enabled' : 'Front camera enabled')
    } catch (error) {
      console.error('[BroadcastPage] Failed to flip camera:', error)
      toast.error('Could not switch camera')
      try {
        await participant.setCameraEnabled(true, { facingMode: cameraFacingMode } as any)
        setCameraEnabled(true)
      } catch (restoreError) {
        console.error('[BroadcastPage] Failed to restore camera after flip:', restoreError)
      }
    }
  }, [cameraFacingMode, setLocalTracks])

const toggleMicrophone = useCallback(async () => {
    const participant = roomRef.current?.localParticipant
    if (!participant) return

    const runMicrophoneToggle = async () => {
      const currentParticipant = roomRef.current?.localParticipant
      if (!currentParticipant) return

      if (!currentParticipant.isMicrophoneEnabled) {
        if (stream?.id && user?.id) {
          const { data: activeMute } = await supabase
            .from('stream_mutes')
            .select('expires_at')
            .eq('stream_id', stream.id)
            .eq('user_id', user.id)
            .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
            .maybeSingle()

          if (activeMute) {
            const expiresAt = activeMute.expires_at ? new Date(activeMute.expires_at).getTime() : null
            const now = Date.now()
            const remaining = expiresAt ? Math.max(1, Math.ceil((expiresAt - now) / 60000)) : null
            const message = remaining
              ? `You are muted by a moderator. Try again in ${remaining} minute(s).`
              : 'You are muted by a moderator.'
            toast.error(message)
            return false
          }
        }
      }

      if (currentParticipant.isMicrophoneEnabled) {
        await currentParticipant.setMicrophoneEnabled(false)
      } else {
        await currentParticipant.setMicrophoneEnabled(true)
      }

      setMicEnabled(Boolean(currentParticipant.isMicrophoneEnabled))
      return true
    }

    const previous = microphoneToggleQueueRef.current.catch(() => {})
    const next = previous
      .then(runMicrophoneToggle, runMicrophoneToggle)
      .catch((err) => {
        console.error('[BroadcastPage] Error toggling microphone:', err)
        return false
      })
      .finally(() => {
        if (microphoneToggleQueueRef.current === previous) {
          microphoneToggleQueueRef.current = Promise.resolve()
        }
      })

    microphoneToggleQueueRef.current = next
    return next
  }, [stream?.id, user?.id])

  const handleBroadcasterBoxTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isHost) return

    const now = Date.now()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    if (lastTapRef.current) {
      const dx = clientX - lastTapRef.current.x
      const dy = clientY - lastTapRef.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (now - lastTapRef.current.time < 350 && dist < 30) {
        void toggleCamera()
        lastTapRef.current = null
        return
      }
    }

    lastTapRef.current = { time: now, x: clientX, y: clientY }

    trackedTimeout(() => {
      if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 350) {
        setIsBroadcasterControlsOpen(true)
        lastTapRef.current = null
      }
    }, 350)
  }, [isHost, toggleCamera])

  const onLiveKitMicMute = useCallback(async () => {
    if (!roomRef.current?.localParticipant) return
    const wasMicEnabled = roomRef.current.localParticipant.isMicrophoneEnabled
    if (wasMicEnabled) {
      try {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false)
        setMicEnabled(false)
        console.log('[BroadcastPage] LiveKit mic muted for walkie-talkie')
      } catch (err) {
        console.error('[BroadcastPage] Failed to mute LiveKit mic:', err)
      }
    }
  }, [])

  const onLiveKitMicUnmute = useCallback(async () => {
    if (!roomRef.current?.localParticipant) return
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(true)
      setMicEnabled(true)
      console.log('[BroadcastPage] LiveKit mic unmuted after walkie-talkie')
    } catch (err) {
      console.error('[BroadcastPage] Failed to unmute LiveKit mic:', err)
    }
  }, [])

  useEffect(() => {
    if (!isHost || !hostMicMutedByOfficer || !roomRef.current?.localParticipant) return;
    
    console.log('[BroadcastPage] useEffect: hostMicMutedByOfficer is true - forcing mic disabled')
    roomRef.current.localParticipant.setMicrophoneEnabled(false).catch((err) => {

    });
  }, [isHost, hostMicMutedByOfficer]);

  useEffect(() => {
    if (!stream?.id || !user?.id) return;
    let muteExpiryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMuteState = false;

    const applyMuteState = async (isMuted: boolean) => {
      const participant = roomRef.current?.localParticipant;
      if (!participant) return;

      try {
        await participant.setMicrophoneEnabled(!isMuted);
        setMicEnabled(!isMuted);
        if (isMuted && !lastMuteState) {
          toast.error('You have been muted by a moderator.');
        }
        lastMuteState = isMuted;
      } catch (err) {

      }
    };

    const clearMuteExpiryTimer = () => {
      if (muteExpiryTimer) {
        clearTimeout(muteExpiryTimer);
        muteExpiryTimer = null;
      }
    };

    const scheduleUnmute = (expiresAt?: string | null) => {
      clearMuteExpiryTimer();
      if (!expiresAt) return;

      const delay = new Date(expiresAt).getTime() - Date.now();
      if (delay <= 0) {
        void applyMuteState(false);
        return;
      }

      muteExpiryTimer = setTimeout(() => {
        void applyMuteState(false);
      }, delay + 250);
    };

    const checkMuteState = async () => {
      const { data } = await supabase
        .from('stream_mutes')
        .select('id, expires_at')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
        .maybeSingle();

      if (data) {
        await applyMuteState(true);
        scheduleUnmute(data.expires_at);
      } else {
        await applyMuteState(false);
      }
    };

    void checkMuteState();

    const channel = supabase
      .channel(`moderator-mute:${stream.id}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.new?.user_id === user.id) {
            void applyMuteState(true);
            scheduleUnmute(payload.new?.expires_at);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.new?.user_id === user.id) {
            const expiresAt = payload.new?.expires_at;
            if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
              void applyMuteState(false);
              clearMuteExpiryTimer();
            } else {
              void applyMuteState(true);
              scheduleUnmute(expiresAt);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'stream_mutes',
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload: any) => {
          if (payload.old?.user_id === user.id) {
            clearMuteExpiryTimer();
            void applyMuteState(false);
          }
        }
      )
      .subscribe();

    return () => {
      clearMuteExpiryTimer();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [stream?.id, user?.id]);

  // Listen for balance update events from gift system
  // This ensures all participants see updated balances in real-time without full page reloads
  useEffect(() => {
    const handleBalanceUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        senderId: string;
        receiverId: string;
        amount: number;
        timestamp: number;
      }>;
      
      const { senderId, receiverId } = customEvent.detail || {};

      // Only update broadcaster profile if broadcaster is involved - no refreshProfile calls
      // to avoid unnecessary state updates that could cause page refresh appearance
      const isBroadcasterInvolved = receiverId === stream?.user_id || senderId === stream?.user_id;
      if (isBroadcasterInvolved && stream?.user_id) {

        const { data: updatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', stream.user_id)
          .maybeSingle();
        
        if (updatedProfile) {
          setBroadcasterProfile(updatedProfile);
        }
      }
    };
    
    window.addEventListener('broadcast-balance-update', handleBalanceUpdate);
    return () => window.removeEventListener('broadcast-balance-update', handleBalanceUpdate);
  }, [user?.id, stream?.user_id, supabase]);

   // Broadcaster profile updates are now handled in the combined host channel above



   const onGift = useCallback((userId?: string) => {
     setGiftRecipientId(userId || stream?.user_id || null)
     setIsGiftModalOpen(true)
   }, [stream?.user_id])
   const handleCloseGiftModal = useCallback(() => {
     setIsGiftModalOpen(false)
     setGiftRecipientId(null)
   }, [])

   const onGiftAll = useCallback((ids: string[]) => {
     toast.info(`Gift sent to ${ids.length} users`)
   }, [])

   const handleGiftHost = useCallback(() => onGift(stream?.user_id || ''), [onGift, stream?.user_id])

        const handleOpenUserAction = useCallback((info: { userId: string; username?: string; role?: string; createdAt?: string; seatSessionId?: string }) => {
          const normalizedUserId = info.userId
          const normalizedUsername = info.username || ''
          const isAnonUsername = /^anon\d{6}$/.test(normalizedUsername)

          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedUserId)) {
            if (isAnonUsername) {
              setUserActionTarget({
                userId: `anon-${normalizedUsername}`,
                username: normalizedUsername,
                role: 'anonymous',
                createdAt: null,
              })
              return
            }
          }

          setUserActionTarget(info)
        }, [])

    const handleOpenSeatControls = useCallback((seatIndex: number, seatSessionId?: string) => {
      setSelectedSeatForControls({ seatIndex, seatSessionId })
      setIsSeatControlsOpen(true)
    }, [])

    const handleCloseSeatControls = useCallback(() => {
      setIsSeatControlsOpen(false)
      setSelectedSeatForControls(null)
    }, [])

    const handleLeaveSeatFromControls = useCallback(async () => {
      if (!selectedSeatForControls?.seatSessionId) return
      try {
        const { error } = await supabase.rpc('leave_seat_atomic', { p_session_id: selectedSeatForControls.seatSessionId })
        if (error) throw error
        toast.success('Left seat')
      } catch (err: any) {
        toast.error(err?.message || 'Failed to leave seat')
      } finally {
        handleCloseSeatControls()
      }
    }, [selectedSeatForControls, handleCloseSeatControls])

   const handleOpenFloatingChatUsername = useCallback(async (username: string, userId?: string) => {
    if (!username || isAnonymousDisplayName(username)) return
    try {
      let profileId = userId
      let profileUsername = username
      let profileRole: string | null = null
      let profileCreatedAt: string | null = null

      if (!profileId) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, created_at, role, troll_role')
          .eq('username', username)
          .maybeSingle()
        
        if (error || !data?.id) {
          toast.error('User not found')
          return
        }
        
        profileId = data.id
        profileUsername = data.username || username
        profileRole = data.role || data.troll_role
        profileCreatedAt = data.created_at
      } else {
        const { data } = await supabase
          .from('user_profiles')
          .select('username, created_at, role, troll_role')
          .eq('id', profileId)
          .maybeSingle()

        if (data) {
          profileUsername = data.username || username
          profileRole = data.role || data.troll_role
          profileCreatedAt = data.created_at
        }
      }
      
      handleOpenUserAction({
        userId: profileId,
        username: profileUsername,
        role: profileRole,
        createdAt: profileCreatedAt,
      })
    } catch (err) {
      console.error('[BroadcastPage] Error opening user action:', err)
      toast.error('Failed to open user profile')
    }
  }, [])

   const handleCloseUserAction = useCallback(() => {
     setUserActionTarget(null)
   }, [])
   const handleCloseShareModal = useCallback(() => setIsShareModalOpen(false), [])

   const handleOpenUserStats = useCallback((statsInfo: {
     userId: string;
     username: string;
     trollCoins: number;
     trollmonds: number;
     licensePlate: string | null;
     isSeatUser: boolean;
   }) => {
     setShowUserStats(statsInfo)
   }, [])

   const handleCloseUserStats = useCallback(() => {
     setShowUserStats(null)
   }, [])

   const handleOpenHostStats = useCallback(() => {
     setShowHostStats(true)
   }, [])

   const handleCloseHostStats = useCallback(() => {
     setShowHostStats(false)
   }, [])

   // Mod actions (for officers) - use same UserActionModal
   const handleOpenModActions = useCallback((_target: any) => {
     // For now, officers use the same UserActionModal
     // In the future, a dedicated mod actions popup could be shown
   }, [])

    const handleCloseModActions = useCallback(() => {
      // No-op
    }, [])

    // Authoritative current-user roles from user_profile_roles + user_profiles,
    // fetched from the DB (not derived flags / not gated on staff clock-in), so
    // broadcasters, broadofficers, admins, ceos and all staff get the full
    // ModActionsPopup moderation menu when tapping a chat username.
    const [myProfileRoleTypes, setMyProfileRoleTypes] = useState<string[]>([])
    const [myProfileAdminFlags, setMyProfileAdminFlags] = useState<{ is_admin: boolean; is_ceo: boolean; role: string | null }>({ is_admin: false, is_ceo: false, role: null })

    useEffect(() => {
      if (!user?.id) { setMyProfileRoleTypes([]); setMyProfileAdminFlags({ is_admin: false, is_ceo: false, role: null }); return }
      let active = true
      const refresh = async () => {
        const [{ data: roles }, { data: prof }] = await Promise.all([
          supabase.from('user_profile_roles').select('role_type').eq('user_id', user.id).eq('is_active', true),
          supabase.from('user_profiles').select('is_admin, is_ceo, role').eq('id', user.id).maybeSingle(),
        ])
        if (!active) return
        if (roles) setMyProfileRoleTypes(roles.map((r: any) => String(r.role_type).toLowerCase()))
        if (prof) setMyProfileAdminFlags({ is_admin: Boolean(prof.is_admin), is_ceo: Boolean(prof.is_ceo), role: prof.role ?? null })
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
      isHost || isCurrentUserBroadofficer || hasModMenuFromRoles ||
      myProfileAdminFlags.is_admin || myProfileAdminFlags.is_ceo ||
      ['admin', 'ceo', 'owner', 'superadmin', 'staff', 'moderator'].includes(myProfileAdminFlags.role ?? '')
    )


   // -- Troll Button -------------------------------------------------------
   // Viewers (non-host) can click once per broadcast to trigger a random
   // temporary prank effect.  The host can never be targeted by their own
   // broadcast's troll button.
   const [trollUsedThisBroadcast, setTrollUsedThisBroadcast] = useState(false)
   const trollEffectsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

   // Load whether the current user already used their troll this broadcast
   useEffect(() => {
     if (!streamId || !user?.id || isHost) return

     const channel = supabase
       .channel(`troll-usage:${streamId}:${user.id}`)
       .on(
         'broadcast',
         { event: 'troll_used' },
         (payload: any) => {
           if (payload?.payload?.user_id === user.id) {
             setTrollUsedThisBroadcast(true)
           }
         },
       )
       .subscribe()

     // Also pre-load from DB
     supabase
       .from('broadcast_troll_usages')
       .select('id')
       .eq('stream_id', streamId)
       .eq('user_id', user.id)
       .maybeSingle()
       .then(({ data }) => {
         if (data) setTrollUsedThisBroadcast(true)
       })

     trollEffectsChannelRef.current = channel
      return () => {
        if (channel) {
          supabase.removeChannel(channel)
        }
        trollEffectsChannelRef.current = null
      }
   }, [streamId, user?.id, isHost, supabase])

   // -- Troll Prank Definitions ---------------------------------------------
   // Each prank is a temporary effect (�10 s) expressed as a broadcast_active_effects
   // entry so the existing BroadcastAbilityEffects overlay can render it.
   type TrollPrank = {
     name: string
     icon: string
     description: string
     ability_id: string            // matches a BroadcastAbilityEffects entry
     targetUserLabel?: string      // displayed in the system banner
     extraData: Record<string, any>
   }

   const TROLL_PRANKS: TrollPrank[] = [
     {
       name:      'Coin Vanish',
       icon:      '??',
       description: 'Broadcaster Troll Coins drained for 10 seconds!',
       ability_id: 'troll_coin_drain',
       targetUserLabel: 'broadcaster_coins',
       extraData: { prankType: 'coin_drain', duration: 10 },
     },
     {
       name:      'Gift Lock',
       icon:      '??',
       description: 'Gifts disabled in battle mode for 10 seconds!',
       ability_id: 'troll_gift_lock',
       targetUserLabel: 'battle_gifts',
       extraData: { prankType: 'gift_lock', duration: 10 },
     },
     {
       name:      'Worthless Gifts',
       icon:      '??',
       description: 'All gifts worth 1 coin for the next 10 seconds!',
       ability_id: 'troll_worthless_gifts',
       targetUserLabel: 'worthless_gifts',
       extraData: { prankType: 'worthless_gifts', duration: 10 },
     },
     {
       name:      'Troll Flash',
       icon:      '?',
       description: 'Broadcaster screen flashed for everyone to see!',
       ability_id: 'troll_flash',
       targetUserLabel: 'flash',
       extraData: { prankType: 'flash', duration: 10 },
     },
     {
       name:      'Chaos Audio',
       icon:      '??',
       description: "Can't hear the broadcaster for 10 seconds!",
       ability_id: 'troll_audio_gag',
       targetUserLabel: 'audio_gag',
       extraData: { prankType: 'audio_gag', duration: 10 },
     },
     {
       name:      'Liar Liar',
       icon:      '??',
       description: 'Broadcaster video gets a funhouse mirror effect!',
       ability_id: 'troll_mirror',
       targetUserLabel: 'mirror',
       extraData: { prankType: 'mirror', duration: 10 },
     },
   ]

   const handleTroll = useCallback(async () => {
     if (!user || !stream || isHost) {
       toast.error('Only viewers can troll during a broadcast!')
       return
     }
     if (trollUsedThisBroadcast) {
       toast.error("You've already used your Troll button this broadcast!")
       return
     }
     if (!streamId) return

     // Pick a random prank the user has NOT triggered yet in this session
     // (fall back to fully random once all have been used)
     const channel = trollEffectsChannelRef.current
     if (!channel) return

     const prank = TROLL_PRANKS[Math.floor(Math.random() * TROLL_PRANKS.length)]
     const now = new Date()
     const expiresAt = new Date(now.getTime() + 10_000) // 10 seconds

     try {
       // 1) Record troll usage (DB + local)
       await supabase
         .from('broadcast_troll_usages')
         .insert({ stream_id: streamId, user_id: user.id, prank_name: prank.name, created_at: now.toISOString() })
         .then(() => setTrollUsedThisBroadcast(true))

       // Inform all participants that this user has used their troll
       await channel.send({
         type: 'broadcast',
         event: 'troll_used',
         payload: { user_id: user.id, prank: prank.name },
       })

       // 2) Insert active effect so BroadcastAbilityEffects renders it
       const { data: effectData } = await supabase
         .from('broadcast_active_effects')
         .insert({
           stream_id:     streamId,
           ability_id:    prank.ability_id,
           activator_id:  user.id,
           activator_username: profile?.username || 'Anonymous',
           target_user_id:   null,
           target_username:   null,
           started_at:    now.toISOString(),
           expires_at:    expiresAt.toISOString(),
           data:          prank.extraData,
         })
         .select()
         .single()

       // 3) Log it
       await supabase.from('broadcast_ability_logs').insert({
         stream_id:       streamId,
         ability_id:      prank.ability_id,
         activator_id:    user.id,
         activator_username: profile?.username || 'Anonymous',
         target_user_id:  null,
         target_username:  null,
         amount:          null,
       })

        // 4) Auto-delete the effect after 10 s so the overlay disappears
        if (effectData?.id) {
          trackedTimeout(async () => {
            await supabase.from('broadcast_active_effects').delete().eq('id', effectData.id)
          }, 10_500)
        }

       toast.success(
         `?? Troll used: ${prank.icon} ${prank.name}\n${prank.description}`,
         { duration: 5000 },
       )

// 5) Badge functionality has been removed
      } catch (err: any) {
        console.error('[handleTroll] Error:', err)
        toast.error(err.message || 'Troll failed. Try again!')
      }
    }, [user, stream, streamId, isHost, trollUsedThisBroadcast, profile?.username, supabase])

   const clickHistoryRef = useRef<number[]>([]);
   const [isClickBlocked, setIsClickBlocked] = useState(false);
   const [isEnding, setIsEnding] = useState(false);
   const pendingLikesRef = useRef(0);
   const flushInProgressRef = useRef(false);

   const checkClickRate = useCallback(() => {
     const now = Date.now();
     clickHistoryRef.current = clickHistoryRef.current.filter(
       timestamp => now - timestamp < 1000
     );
     clickHistoryRef.current.push(now);
     if (clickHistoryRef.current.length > 10) {
       return false;
     }
     return true;
   }, []);

   const flushLikes = useCallback(async () => {
     if (flushInProgressRef.current) return;

     const batch = pendingLikesRef.current;
     if (batch <= 0) return;

     pendingLikesRef.current = 0;
     flushInProgressRef.current = true;

     try {
       if (!stream?.id) return;

       const { data, error } = await supabase.rpc('increment_stream_likes', {
         p_stream_id: stream.id,
         p_like_count: batch,
       });

        if (error) throw error;

        if (typeof data === 'number') {
          setStream((prev: any) => {
            if (!prev) return prev;
            return { ...prev, total_likes: data };
          });
          try {
            void sendStreamBroadcast(stream.id, 'like_sent', {
              user_id: user?.id,
              stream_id: stream.id,
              total_likes: data,
            });
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[BroadcastPage] like broadcast failed:', err);
          }
        }
      } catch (error) {
       pendingLikesRef.current += batch;
       console.error('Failed to flush likes:', error);
     } finally {
       flushInProgressRef.current = false;
     }
   }, [stream?.id]);

    useEffect(() => {
      const interval = window.setInterval(() => {
        flushLikes();
      }, 5000);

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

 const handleLike = useCallback(() => {
     if (!user) {
         navigate('/auth?mode=signup');
         return;
     }
     if (isHost) {
         toast.error("Broadcasters cannot like their own broadcast");
         return;
     }

     if (isClickBlocked) {
         return;
     }

     if (!checkClickRate()) {
         return;
     }

      pendingLikesRef.current += 2;
      setStream((prev: any) => {
        if (!prev) return prev;
        return { ...prev, total_likes: (prev.total_likes || 0) + 2 };
      });

      if (pendingLikesRef.current >= 25) {
        flushLikes();
      }
    }, [checkClickRate, isClickBlocked, isHost, navigate, stream, user, flushLikes]);

  const toggleStreamRgb = useCallback(async () => {
    if (!isHost || !stream) return;
    const enabling = !stream.has_rgb_effect;
    try {
      const { data, error } = await supabase.rpc('purchase_rgb_broadcast', {
        p_stream_id: stream.id,
        p_enable: enabling
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
      if (result.message === 'Purchased and Enabled') {
        toast.success("RGB Unlocked! (-10 Coins)");
      } else {
        toast.success(enabling ? "RGB Effect Enabled" : "RGB Effect Disabled");
      }
    } catch (e: any) {

      toast.error(e.message || "Failed to update RGB setting");
    }
  }, [isHost, stream, stream?.id, stream?.has_rgb_effect]);

  const isStaff = useMemo(() => isStaffProfile(profile), [profile])

  const handleStreamEnd = useCallback(async () => {
    if (isEnding) return;

    // For staff, skip confirmation and skip summary page
    if (isStaff || stream?.status === 'ended') {
      // Allow immediate end without confirmation
    } else {
      // For regular hosts, show confirmation
      const confirmed = window.confirm('Are you sure you want to end this stream? This cannot be undone.');
      if (!confirmed) return;
    }

    setIsEnding(true);

    // If in an active random battle, forfeit first so the other broadcaster wins
    if (stream?.is_battle && stream?.battle_id && stream?.battle_mode === 'random_queue' && user?.id) {
      try {
        const { data: forfeitData, error: forfeitError } = await supabase.rpc('forfeit_random_battle', {
          p_stream_id: stream.id,
          p_broadcaster_id: user.id,
        });
        if (forfeitError) {
          console.warn('[handleStreamEnd] forfeit_random_battle error:', forfeitError);
        }
      } catch (forfeitErr) {
        console.warn('[handleStreamEnd] forfeit_random_battle failed:', forfeitErr);
      }
    }

    // Delegate to the single shared shutdown sequence: stops browser media,
    // tears down LiveKit, leaves the room, marks the stream ended, and emits
    // the realtime broadcast_ended event. Navigation happens in onEnded.
    try {
      await endBroadcastShutdown('manual');
    } finally {
      setIsEnding(false);
    }
  }, [endBroadcastShutdown, isStaff, isEnding, stream?.id, stream?.status, stream?.is_battle, stream?.battle_id, stream?.battle_mode, user?.id]);

  const handleStartBattle = useCallback(async () => {
    if (!stream || !isHost) return
    
    try {
      if (stream.is_battle) {
        // End battle
        const { error } = await supabase
          .from('streams')
          .update({ 
            is_battle: false, 
            battle_id: null,
            battle_status: 'ended',
            battle_end_time: new Date().toISOString()
          })
          .eq('id', stream.id)
        
        if (error) throw error
        toast.success('Battle ended')
        setBattleStartTime(null)
      } else {
        const battleTheme = normalizeBattleTheme(selectedBattleTheme);
        // Start battle - create a battle record with challenger_stream_id
        let battleData: any = null;
        let battleError: any = null;
        ({ data: battleData, error: battleError } = await supabase
          .from('battles')
          .insert({
            challenger_stream_id: stream.id,
            status: 'active',
            started_at: new Date().toISOString(),
            battle_theme: battleTheme,
          })
          .select()
          .single());

        if (battleError && String(battleError.message || '').toLowerCase().includes('battle_theme')) {
          ({ data: battleData, error: battleError } = await supabase
            .from('battles')
            .insert({
              challenger_stream_id: stream.id,
              status: 'active',
              started_at: new Date().toISOString(),
            })
            .select()
            .single());
        }
        
        if (battleError) throw battleError
        
        // Then update the stream
        if (battleData?.id) {
          const { error: streamError } = await supabase
            .from('streams')
            .update({ 
              is_battle: true, 
              battle_id: battleData.id,
              broadcast_mode: 'battle',
              battle_status: 'active',
              battle_start_time: new Date().toISOString(),
              battle_end_time: new Date(Date.now() + 3 * 60 * 1000).toISOString()
            })
            .eq('id', stream.id)
          
          if (streamError) throw streamError
          toast.success('Battle started!')
          // Set battle start time for timer display
          setBattleStartTime(new Date())
          // Refresh stream to get updated state with is_battle: true
          refreshStream()
        }
      }
    } catch (err) {
      console.error('Error with battle:', err)
      toast.error('Failed to toggle battle')
    }
  }, [isHost, refreshStream, selectedBattleTheme, stream]);

  const swipeNavigateLockRef = useRef(false);

  // Check if there are adjacent streams to swipe to
  useEffect(() => {
    if (!stream?.id) {
      setCanSwipe(false);
      return;
    }

    // Enable swipe only for mobile viewers (not host, not on seat)
    const shouldEnableSwipe = !isHost && isMobileWidth;
    
    if (!shouldEnableSwipe) {
      setCanSwipe(false);
      return;
    }

     const checkAdjacentStreams = async () => {
       try {
         const currentCategory = stream.category || 'general';
         const { data } = await supabase
           .from('streams')
           .select('id')
           .or('is_live.eq.true,status.eq.live')
           .eq('category', currentCategory)
           .limit(2);

        const liveStreams = (data || []).filter((item) => item?.id);
        setCanSwipe(liveStreams.length > 1);
      } catch {
        setCanSwipe(false);
      }
    };

    checkAdjacentStreams();

    const swipeTimer = window.setInterval(checkAdjacentStreams, 60000);

    return () => {
      window.clearInterval(swipeTimer);
    };
  }, [stream?.id, stream?.category, isHost, isMobileWidth]);

  const navigateToAdjacentStream = useCallback(async (direction: 'up' | 'down') => {
    if (!stream?.id || swipeNavigateLockRef.current) return;

    swipeNavigateLockRef.current = true;

    try {
      const currentCategory = stream.category || 'general';
      const { data, error } = await supabase
        .from('streams')
        .select('id, category, current_viewers, created_at')
        .or('is_live.eq.true,status.eq.live')
        .eq('category', currentCategory)
        .order('current_viewers', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {

        return;
      }

      let liveStreams = (data || []).filter((item) => item?.id);
      if (liveStreams.length <= 1) {
        const fallback = await supabase
          .from('streams')
          .select('id, category, current_viewers, created_at')
          .or('is_live.eq.true,status.eq.live')
          .order('current_viewers', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50);

        if (fallback.error) {

          return;
        }
        liveStreams = (fallback.data || []).filter((item) => item?.id);
      }
      if (liveStreams.length <= 1) return;

      const currentIndex = liveStreams.findIndex((item) => item.id === stream?.id);
      if (currentIndex === -1) return;

      const nextIndex = direction === 'up'
        ? (currentIndex + 1) % liveStreams.length
        : (currentIndex - 1 + liveStreams.length) % liveStreams.length;
      const targetStream = liveStreams[nextIndex];

      if (!targetStream?.id) return;

      navigate(`/watch/${targetStream.id}`);
    } catch (err) {

    } finally {
      trackedTimeout(() => {
        swipeNavigateLockRef.current = false;
      }, 400);
    }
  }, [navigate, stream?.category, stream?.id]);

  const handleStageTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isHost || e.touches.length !== 1) return;
    stageTouchStartYRef.current = e.touches[0].clientY;
    stageTouchCurrentYRef.current = e.touches[0].clientY;
  }, [isHost]);

  const handleStageTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // If stageTouchStartYRef is null, the touch started on an interactive element, so don't handle it
    if (isHost || stageTouchStartYRef.current === null) return;
    
    stageTouchCurrentYRef.current = e.touches[0].clientY;
    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    
    // Only preventDefault if it's a significant swipe (>20px)
    // Small movements are likely taps/clicks on interactive elements
    if (Math.abs(diffY) > 20) {
      e.preventDefault();
    }
  }, [isHost]);

  const handleStageTouchEnd = useCallback(() => {
    if (isHost || stageTouchStartYRef.current === null || stageTouchCurrentYRef.current === null) {
      stageTouchStartYRef.current = null;
      stageTouchCurrentYRef.current = null;
      return;
    }

    const diffY = stageTouchStartYRef.current - stageTouchCurrentYRef.current;
    const threshold = 90;

    if (Math.abs(diffY) >= threshold) {
      navigateToAdjacentStream(diffY > 0 ? 'up' : 'down');
    }

    stageTouchStartYRef.current = null;
    stageTouchCurrentYRef.current = null;
  }, [isHost, navigateToAdjacentStream]);

  const memoizedViewerId = useMemo(() => 
    user?.id || anonymousViewerIdRef.current || undefined,
    [user?.id, anonymousViewerIdRef.current]
  );

  const activeUserIds = useMemo(() => {
    const ids: string[] = [];

    return ids;
  }, [stream?.user_id]);

  const userProfiles = useMemo(() => {
    if (!stream) return {};
    const profiles: Record<string, { username: string; avatar_url?: string }> = {};
    
    if (broadcasterProfile) {
      profiles[stream.user_id] = {
        username: broadcasterProfile.username || 'Broadcaster',
        avatar_url: broadcasterProfile.avatar_url,
      };
    }
    
    return profiles;
  }, [broadcasterProfile, stream?.user_id]);

  // INSTANT JOIN: Show minimal loading state inline instead of blocking entire page
  // This allows users to see the page immediately while data loads in background
  const categoryConfig = useMemo(() => getCategoryConfig(stream?.category || 'general'), [stream?.category])

  // INSTANT JOIN: Show broadcast content immediately

  // Only treat as mobile viewer after mount and when actually on mobile width
  const isMobileViewer = hasMounted && isMobileWidth && !isHost;
  // Mobile host: broadcaster on mobile/PWA needs a completely different layout
  const isMobileHost = hasMounted && isMobileWidth && isHost;

  const activeAudienceWithAnon = useMemo(() => {
    return audienceWithAnon.filter((m) => {
      if (!m.is_active || m.left_at) return false
      if (m.user_id === user?.id) return false
      return true
    })
  }, [audienceWithAnon, user?.id])

  const audienceViewerCount = useMemo(() => activeAudience.filter((m) => m.user_id !== user?.id).length, [activeAudience, user?.id])
  const streamLayoutStats = useMemo(() => ({
    viewers: viewerCount > 0 ? viewerCount : (audienceViewerCount > 0 ? audienceViewerCount : Number(stream?.current_viewers ?? stream?.viewer_count ?? Math.max(remoteParticipants.size, activeAudienceWithAnon.length) ?? 0)),
    likes: Number((stream as any)?.total_likes ?? (stream as any)?.like_count ?? 0),
    coinsEarned: Number((stream as any)?.total_gifts_coins ?? (stream as any)?.coin_earnings ?? 0),
    onStage: 0,
  }), [
    viewerCount,
    audienceViewerCount,
    stream?.current_viewers,
    stream?.viewer_count,
    stream?.total_likes,
    (stream as any)?.like_count,
    (stream as any)?.total_gifts_coins,
    (stream as any)?.coin_earnings,
    remoteParticipants.size,
    activeAudienceWithAnon.length,
  ])
  const liveViewerCount = viewerCount > 0 ? viewerCount : (audienceViewerCount > 0 ? audienceViewerCount : Math.max(remoteParticipants.size, activeAudienceWithAnon.length))
  const visibleViewerCount = Math.max(viewerCount, activeViewerProfiles.length)
  const viewerBubbleProfiles = useMemo(() => activeViewerProfiles.map((viewer) => ({
    id: viewer.user_id,
    username: viewer.username,
    avatar_url: viewer.avatar_url,
  })), [activeViewerProfiles])
  const broadcastGridRemoteUsers = remoteUsers
  const handleToggleBattleMode = useCallback(() => setIsBattleMode((active) => !active), [])
   const handleSwipeUp = useCallback(() => navigateToAdjacentStream('up'), [navigateToAdjacentStream])

  const [showViewerList, setShowViewerList] = useState(false)
  const onActiveViewersClick = useCallback(() => {
    setShowViewerList(prev => !prev)
  }, [])

  const shouldShowRandomBattleArena =
    stream?.battle_mode === 'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (stream?.battle_status === 'ready' || stream?.battle_status === 'starting' || stream?.battle_status === 'active');

  // PHASE 2: Derive stable battleId for BattleView key � prevents remount on stream state updates
   const activeBattleId = shouldShowRandomBattleArena ? stream?.battle_id ?? null : null;

   const sendSeatLeftEvent = useCallback(
    async ({ seat_index, user_id, session_id }: { seat_index?: number; user_id?: string | null; session_id?: string | null }) => {
      if (!streamId) return

      try {
        const channel = supabase.channel(`stream-seat-events:${streamId}`)

        await channel.send({
          type: 'broadcast',
          event: 'seat_left',
          payload: {
            stream_id: streamId,
            seat_index,
            user_id,
            session_id,
            sent_at: new Date().toISOString(),
          },
        })

        if (channel) {
          supabase.removeChannel(channel)
        }
      } catch (err) {
        console.warn('[BroadcastPage] sendSeatLeftEvent failed:', err)
      }
    },
    [streamId],
   )

   function handleGeneralKick() {
      if (!userActionTarget) return
      const targetUserId = userActionTarget.userId
      const seatSessionId = userActionTarget.seatSessionId

      const doKick = async () => {
        try {
          // ── Role-based protection: CEO, admin, and all staff/roles cannot be kicked ──
           if (targetUserId) {
            const { data: targetProfile } = await supabase
              .from('user_profiles')
              .select('role, troll_role, is_admin, is_troll_officer, is_lead_officer, is_staff, is_superadmin, is_secretary, is_prosecutor, is_attorney')
              .eq('id', targetUserId)
              .maybeSingle()

           if (targetProfile) {
              const isProtected = isStaffProfile(targetProfile)
              if (isProtected) {
                toast.error('Cannot remove staff members, CEO, admins, or officers from the stage.')
                return
              }
            }
          }

          let kicked = false
          let removedSeatIndex: number | undefined
          let removedUserId: string | null = targetUserId || null
          let removedSessionId: string | null = seatSessionId || null

            if (seatSessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seatSessionId)) {
              const seat = Object.values(seats).find((s: any) => s.id === seatSessionId)
              if (seat?.seat_index) {
                removedSeatIndex = seat.seat_index
              }

               const { data, error } = await supabase.rpc('leave_seat_atomic', { p_session_id: seatSessionId })
               if (error || (data && (data as any).success === false)) {
                 toast.error('Failed to remove user from seat')
                 return
               }
              kicked = true
            } else {
              const seat = Object.values(seats).find(
                (s: any) => s.user_id === targetUserId || s.guest_id === targetUserId,
              )
              if (seat?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seat.id)) {
                removedSeatIndex = seat.seat_index
                removedUserId = seat.user_id || seat.guest_id || targetUserId || null
                removedSessionId = seat.id
                const { data, error } = await supabase.rpc('leave_seat_atomic', { p_session_id: seat.id })
                if (error || (data && (data as any).success === false)) {
                  toast.error('Failed to remove user from seat')
                  return
                }
                kicked = true
              }
            }

           if (!kicked) {
             toast.error('Seat session not found')
             return
           }

            toast.success('User removed from seat')
            setUserActionTarget(null)

            if (removedSeatIndex !== undefined) {
              removeSeat(removedSeatIndex)
            }

            if (removedUserId) {
              setRemoteParticipants((prev) => {
                const next = new Map(prev)
                for (const [identity, p] of next) {
                  try {
                    const metadata = p?.metadata ? JSON.parse(p.metadata) : {}
                    if (metadata.user_id === removedUserId || metadata.userId === removedUserId) {
                      next.delete(identity)
                    }
                  } catch {
                    // ignore malformed metadata
                  }
                }
                return next
              })
            }

            await sendSeatLeftEvent({
              seat_index: removedSeatIndex,
              user_id: removedUserId,
              session_id: removedSessionId,
            })

            void refreshSeats()
         } catch (err) {
           toast.error('Failed to remove user from seat')
         }
      }
      void doKick()
    }

   function handleArrest(userId: string, reason?: string) {
      const doArrest = async () => {
        try {
          const { error } = await supabase.rpc('arrest_user', { p_user_id: userId, p_reason: reason || 'Manual arrest' })
          if (error) {
            toast.error('Failed to arrest user')
          } else {
            toast.success('User arrested')
          }
        } catch (err) {
          toast.error('Failed to arrest user')
        }
      }
      void doArrest()
    }

     function handleBlock(userId: string, reason?: string) {
       const doBlock = async () => {
         try {
           const { error } = await supabase.rpc('ban_user_from_stream', { p_stream_id: streamId, p_user_id: userId, p_reason: reason || 'Manual block' })
           if (error) {
             toast.error('Failed to block user')
           } else {
             toast.success('User blocked from stream')
           }
         } catch (err) {
           toast.error('Failed to block user')
         }
       }
       void doBlock()
     }

       function handleMute(userId: string) {
         const doMute = async () => {
           try {
             const { error } = await supabase.rpc('moderator_mute_user', {
               p_stream_id: streamId,
               p_target_user_id: userId,
               p_duration_minutes: 5,
               p_reason: 'Muted by moderator',
             });
             if (error) throw error;
             toast.success('User muted for 5 minutes')
           } catch (err) {
             toast.error('Failed to mute user')
           }
         }
         void doMute()
       }

       function handleDisableChat(userId: string) {
         const doDisable = async () => {
           try {
             const { error } = await supabase.rpc('moderator_disable_chat', {
               p_stream_id: streamId,
               p_target_user_id: userId,
               p_duration_minutes: 5,
               p_reason: 'Chat disabled by moderator',
             });
             if (error) throw error;
             toast.success('User chat disabled for 5 minutes')
           } catch (err) {
             toast.error('Failed to disable chat')
           }
         }
          void doDisable()
        }

        const handleToggleChatLock = useCallback(async () => {
          if (!streamId || !stream?.user_id) {
            toast.error('Stream not found')
            return
          }

          const currentlyLocked = hostChatDisabledByOfficer
          const nextLocked = !currentlyLocked

          try {
            const { data, error } = await supabase.rpc('set_broadcaster_moderation_lock', {
              p_broadcaster_id: stream.user_id,
              p_chat_disabled: nextLocked,
              p_mic_muted: null,
              p_reason: nextLocked ? 'Chat locked by broadcaster' : 'Chat unlocked by broadcaster',
              p_chat_disabled_until: nextLocked ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
              p_chat_disable_strike_count: nextLocked ? 1 : 0,
              p_chat_disabled_stream_id: nextLocked ? streamId : null,
            })

            if (error) throw error
            if (data?.success === false) {
              throw new Error(data.error || 'Failed to toggle chat lock')
            }

            toast.success(nextLocked ? 'Chat locked' : 'Chat unlocked')
          } catch (err) {
            console.error('[BroadcastPage] toggleChatLock error:', err)
            toast.error('Failed to toggle chat lock')
          }
        }, [streamId, stream?.user_id, hostChatDisabledByOfficer])

  const [isAssignOfficerModalOpen, setIsAssignOfficerModalOpen] = useState(false)
  const [isPayBroadOfficersModalOpen, setIsPayBroadOfficersModalOpen] = useState(false)

  const handleAssignBroadofficer = useCallback(() => {
    if (!isHost) {
      toast.error('Only the broadcaster can assign broadofficers');
      return;
    }
    setIsAssignOfficerModalOpen(true)
  }, [isHost]);

  const handlePayBroadOfficers = useCallback(() => {
    if (!isHost) {
      toast.error('Only the broadcaster can pay officers');
      return;
    }
    setIsAssignOfficerModalOpen(true)
  }, [isHost]);

  function startDrag(event: React.MouseEvent<HTMLDivElement>): void {
    // Start a horizontal resize for the desktop chat panel
    try {
      event.preventDefault();
      const divider = event.currentTarget as HTMLDivElement;
      const panel = divider.parentElement as HTMLElement | null;
      if (!panel) return;

      const startX = event.clientX;
      const startWidth = panel.getBoundingClientRect().width;

      const minWidth = 200;
      const maxWidth = 720;

      function onMouseMove(e: MouseEvent) {
        const dx = startX - e.clientX; // dragging left increases width
        let newWidth = startWidth + dx;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        panel.style.width = `${Math.round(newWidth)}px`;
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } catch (err) {
    }
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-dvh', theme.pageBg + ' text-white')}>
        <p className="text-red-300">{error}</p>
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  if (shouldShowRandomBattleArena) {
    const battleLocalTracks =
      localTracks?.[0] || localTracks?.[1]
        ? ([localTracks?.[0], localTracks?.[1]] as [LocalAudioTrack | undefined, LocalVideoTrack | undefined])
        : null;

    return (
      <ErrorBoundary>
        <GiftSystemProvider streamId={streamId} defaultReceiverId={stream?.user_id}>
          <div className="relative flex h-dvh w-full flex-col overflow-hidden">
            <BattleView
              key={activeBattleId}
              battleId={stream.battle_id!}
              currentStreamId={streamId || stream.id}
              viewerId={memoizedViewerId}
              localTracks={battleLocalTracks}
              remoteUsers={remoteUsers}
              userIdToLiveKitIdentity={userIdToLiveKitIdentity}
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
              onToggleCamera={toggleCamera}
              onToggleMic={toggleMicrophone}
            />
            <div className="pointer-events-none fixed inset-0 z-[250]">
              <GiftVideoOverlay gifts={recentGifts} onFinish={handleRemoveGiftOverlay} />
            </div>
            {stream?.user_id && (
              <TargetedGiftOverlay
                targetKey={`user:${stream.user_id}`}
                gifts={giftQueues[`user:${stream.user_id}`] ?? []}
                onGiftComplete={removeGift}
              />
            )}
            {Object.values(seats).map((seat: any) => {
              const seatUserId = seat?.user_id || seat?.guest_id || null
              if (!seatUserId) return null
              return (
                <TargetedGiftOverlay
                  key={seatUserId}
                  targetKey={`user:${seatUserId}`}
                  gifts={giftQueues[`user:${seatUserId}`] ?? []}
                  onGiftComplete={removeGift}
                />
              )
            })}
          </div>
        </GiftSystemProvider>
      </ErrorBoundary>
    );
  }

  return (
      <>
        <GiftSystemProvider streamId={streamId} defaultReceiverId={stream?.user_id}>
          <ErrorBoundary>
          <RecoveryBanner onRefresh={() => window.location.reload()} />

          {/* -- Outer layout: header + 3-column grid + bottom bar + footer -- */}
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

          {!shouldShowRandomBattleArena && <FeaturedGiftBanner streamId={streamId || stream.id} broadcasterId={stream?.user_id} isMobile={isMobileHost} />}

          <div
            className={cn(
              theme.pageShell,
              'relative flex min-h-0 flex-col overflow-hidden',
              isMobileHost ? 'h-dvh max-h-dvh' : 'h-screen max-h-screen'
            )}
          >

            {/* Background layers — identical to Sidebar ShellBackdrop */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-300/65 to-transparent" />

            {/* League level-up scrolling banner */}
            <LeagueLevelUpBanner
              event={leagueBannerEvent}
              onDismiss={() => setLeagueBannerEvent(null)}
            />

            {/* RGB broadcast effect — only when enabled, rendered ABOVE the seat grid */}
            {stream?.has_rgb_effect && !isMobileDevice && (
              <div className="pointer-events-none absolute inset-0 z-30 mix-blend-screen">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.35),transparent_42%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.28),transparent_46%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.24),transparent_44%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.18)_0%,rgba(14,165,233,0.12)_44%,rgba(236,72,153,0.16)_100%)]" />
              </div>
            )}

            <div className="pointer-events-none fixed inset-0 z-[250]">
              <GiftVideoOverlay gifts={recentGifts} onFinish={handleRemoveGiftOverlay} />
            </div>

            {/* TOP HEADER */}

            {/* --- HEADER --- */}
{!isMobileViewer && (
                <BroadcastNeonHeader
                  stream={stream}
                  broadcasterProfile={broadcasterProfile}
                  isHost={isHost}
                  handleLike={handleLike}
                  onGift={handleGiftHost}
                  onShare={handleOpenShareModal}
                  onEndStream={handleStreamEnd}
                  coinBalance={profile?.troll_coins ?? broadcasterProfile?.troll_coins ?? 0}
                  onOpenCoinStore={user?.id ? handleOpenCoinStore : undefined}
                   isLive={stream?.status === 'live'}
                   streamStartedAt={stream?.started_at}
                  onLiveKitMicMute={onLiveKitMicMute}
                  onLiveKitMicUnmute={onLiveKitMicUnmute}
                  randomBattleQueue={isHost ? randomBattleQueue : undefined}
                  liveViewerCount={liveViewerCount}
                  onActiveViewersClick={onActiveViewersClick}
                />
              )}

               {/* --- AUDIENCE TICKER: full-width, neon style, desktop/tablet only --- */}
              <div
                className="relative z-20 hidden w-full shrink-0 items-center justify-center border-b border-cyan-400/10 bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 px-0 backdrop-blur-xl shadow-[0_2px_32px_0_rgba(34,211,238,0.10)] sm:flex"
                style={{
                  height: `${DESKTOP_AUDIENCE_TICKER_HEIGHT}px`,
                  minHeight: `${DESKTOP_AUDIENCE_TICKER_HEIGHT}px`,
                }}
              >
                <div className="mx-auto flex h-full w-full max-w-7xl items-center overflow-hidden">
                    <AudienceBubbleTicker
                      streamId={streamId || ''}
                      audience={audienceWithAnon}
                      currentUserId={user?.id}
                      hostUserId={stream?.user_id || stream?.broadcaster_id || undefined}
                      maxVisible={8}
                      className="relative z-0 flex w-full items-center"
                      onGiftUser={onGift}
                      onModerateUser={handleOpenUserAction}
                    />
                </div>
              </div>

             {myLeagues.length > 0 && (
               <div className="w-full z-20 px-0 py-3 bg-black/10 border-b border-white/10">
                 <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-3xl border border-cyan-500/10 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-[0_0_30px_rgba(45,212,191,0.08)] sm:flex-row sm:items-center sm:justify-between">
                   <div className="flex items-center gap-3">
                     <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
                       {myLeagues[0].icon_emoji || '??'}
                     </div>
                     <div>
                       <p className="text-sm font-black text-white">League: {myLeagues[0].name}</p>
                       <p className="text-xs text-slate-400">
                         {myLeagues.length === 1 ? 'League membership active' : `${myLeagues.length} leagues joined`} � {myLeagues[0].member_count}/{myLeagues[0].max_members} members
                       </p>
                     </div>
                   </div>
                   <div className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                     Open League tab for your status, missions, and leaderboard.
                   </div>
                 </div>
               </div>
             )}

{/* -- MAIN CONTENT: mobile host gets flex-col layout, desktop gets 3-column grid -- */}
             {/*
               GRID MODE (>6 total boxes):
               The whole <main> is a single grid containing broadcaster + seats as equal tiles.
               Chat is rendered as a separate overlay/floating panel below the grid.

               SPLIT MODE (<=6 total boxes):
               <main> is a 3-column grid: host video | seats sidebar | chat panel.
             */}
               <main
                  className={cn(
                    'flex min-h-0 pb-28',
                    isMobileHost
                      ? layoutMode === 'grid'
                        ? 'flex-1 grid overflow-hidden px-2 py-2 relative'
                        : 'flex-1 flex-col overflow-hidden px-0 pt-0 relative'
                      : 'flex-1 grid gap-4 px-5 py-4 overflow-hidden',
                     // For >6 total seats, use a 2-row grid with combined layout
                     !isMobileHost && layoutMode === 'grid' ? 'grid-rows-[1fr_1fr]' : ''
                 )}
               style={
                  isMobileHost && layoutMode === 'grid'
                    ? { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: viewerSeatCards.length >= 6 ? '2px' : '6px' }
                    : !isMobileHost
                      ? layoutMode === 'grid'
                        ? { gridTemplateColumns: `repeat(${Math.min(totalBoxCount, 6)}, 1fr)`, gap: '12px' }
                        : viewerSeatCards.length === 1
                          ? { gridTemplateColumns: 'minmax(430px, 1fr) minmax(430px, 1fr) 360px' }
                          : { gridTemplateColumns: 'minmax(430px, 1.05fr) minmax(360px, 1fr) 360px' }
                      : undefined
             }>
               {/* Broadcast Frame as border decoration */}
               {broadcastFrame && (
                 <BroadcastFrame frame={broadcastFrame} className="absolute inset-0 z-0 rounded-3xl pointer-events-none">
                   <div className="absolute inset-0" />
                 </BroadcastFrame>
               )}
               
               {/* -- LEFT: Host Video Card -- */}
              {/*
                GRID MODE: broadcaster is a single equal-sized tile (first box).
                SPLIT MODE: broadcaster is the large left panel.
              */}
               {layoutMode === 'grid' ? (
                 /* ===== GRID MODE: Broadcaster tile (same size as seat tiles) ===== */
                  <div
                     className={cn(
                       'relative min-h-0 overflow-hidden border border-cyan-400/30 bg-transparent pb-4',
                       isMobileHost ? 'rounded-lg' : 'rounded-2xl shadow-[0_0_20px_rgba(45,212,191,0.15)]'
                     )}
                    data-gift-target={`user:${stream?.user_id || ''}`}
                    onClick={handleBroadcasterBoxTap}
                    onTouchEnd={(e) => {
                      e.preventDefault()
                      handleBroadcasterBoxTap(e)
                    }}
                    style={isHost ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : undefined}
                  >
                  {streamId && (
                    <MaiBag streamId={streamId} compact className="pointer-events-auto absolute right-2 top-2 z-20" />
                  )}
                  {/* Camera-off image fallback */}
                  {(() => {
                    const showFallback = isHost ? !cameraEnabled : true
                    if (!showFallback) return null
                    if (!broadcasterProfile?.camera_off_image_url) return null
                    return (
                      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden bg-black">
                        <img
                          src={broadcasterProfile.camera_off_image_url}
                          alt={`${broadcasterProfile.username || 'Broadcaster'} camera off`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )
                  })()}

                  {/* Camera starting fallback */}
                  {(() => {
                    const hostParticipant = hostParticipantRef.current
                    const hostCamTrack = isHost
                      ? (localTracks?.[1] ?? null)
                      : (() => {
                          if (!hostParticipant) return null
                          const pubs = (hostParticipant as any).videoTrackPublications
                          if (pubs) {
                            const pubArray = Array.from(pubs.values()) as any[]
                            const found = pubArray.find((p: any) => p.track && typeof (p.track as any).attach === 'function')
                            if (found) return found.track
                          }
                          return null
                        })()

                    const showFallback =
                      isHost
                        ? !hostCamTrack || !cameraEnabled
                        : !hostCamTrack

                    if (showFallback && broadcasterProfile?.camera_off_image_url) {
                      return null
                    }

                    if (!showFallback) return null

                    return (
                      <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.15),transparent_38%)]">
                        {broadcasterProfile?.avatar_url ? (
                          <img
                            src={broadcasterProfile.avatar_url}
                            alt={broadcasterProfile.username || 'Broadcaster'}
                            className={cn(
                              'rounded-full border-2 border-cyan-400/70 object-cover',
                              isMobileHost ? 'h-10 w-10' : 'h-16 w-16 shadow-[0_0_28px_rgba(45,212,191,0.35)]'
                            )}
                          />
                        ) : (
                          <Crown className={isMobileHost ? 'h-6 w-6 text-cyan-200/60' : 'h-10 w-10 text-cyan-200/60'} />
                        )}
                        <p className={cn(
                          'font-black text-white truncate max-w-full px-1',
                          isMobileHost ? 'mt-1 text-[8px]' : 'mt-2 text-sm'
                        )}>{broadcasterProfile?.username || 'Broadcaster'}</p>
                        {!isMobileHost && <p className="mt-1 text-xs text-cyan-200/60">Camera starting</p>}
                      </div>
                    )
                  })()}
                  {/* Host video element */}
                  <TrackAttach
                    track={isHost ? ((localTracks?.[1] && cameraEnabled) ? localTracks[1] : null) : (() => {
                      const hostParticipant = hostParticipantRef.current
                      if (!hostParticipant) return null
                      const pubs = (hostParticipant as any).videoTrackPublications
                      if (pubs) {
                        const pubArray = Array.from(pubs.values()) as any[]
                        const found = pubArray.find((p: any) => p.track && typeof p.track?.attach === 'function')
                        return found
                      }
                      return null
                    })()}
                  />

                  <TargetedGiftOverlay
                    targetKey={`user:${stream?.user_id || ''}`}
                    gifts={giftQueues[`user:${stream?.user_id || ''}`] ?? []}
                    onGiftComplete={removeGift}
                  />

                  {/* Gradient overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                  {isHost && (
                    <CashoutProgressBanner
                      isVisible={cashoutBanner.isVisible}
                      currentBalance={cashoutBanner.currentBalance}
                      nextTier={cashoutBanner.nextTier}
                      amountRemaining={cashoutBanner.amountRemaining}
                      progressPercent={cashoutBanner.progressPercent}
                      isCashoutReady={cashoutBanner.isCashoutReady}
                      onClick={() => cashoutBanner.isCashoutReady && setIsCashoutModalOpen(true)}
                      isMobile={isMobileHost}
                    />
                  )}

                  {/* Host badge */}
                  <div className={cn(
                    'absolute z-10 flex items-center',
                    isMobileHost ? 'left-1 top-1' : 'left-3 top-3 gap-2'
                  )}>
                    <div className={cn(
                      'flex items-center border border-cyan-400/35 bg-cyan-500/18 font-black text-cyan-300 backdrop-blur-xl',
                      isMobileHost ? 'gap-0.5 rounded px-1 py-0.5 text-[7px]' : 'gap-1.5 rounded-lg px-2.5 py-1 text-xs shadow-[0_0_18px_rgba(45,212,191,0.25)]'
                    )}>
                      <Crown className={isMobileHost ? 'h-2 w-2' : 'h-3 w-3'} />
                      {isMobileHost ? 'H' : 'Host'}
                    </div>
                  </div>

                  {/* Mic / Camera pills */}
                  <div className={cn(
                    'absolute z-10 flex items-center',
                    isMobileHost ? 'right-1 top-1 gap-0.5' : 'right-3 top-3 gap-1.5'
                  )}>
                    <span className={cn(
                      'inline-flex items-center justify-center rounded-full border backdrop-blur-md',
                      isMobileHost ? 'h-4 w-4' : 'h-6 w-6',
                      micEnabled ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                    )}>
                      {micEnabled ? <Mic className={isMobileHost ? 'h-2 w-2' : 'h-3 w-3'} /> : <MicOff className={isMobileHost ? 'h-2 w-2' : 'h-3 w-3'} />}
                    </span>
                    <span className={cn(
                      'inline-flex items-center justify-center rounded-full border backdrop-blur-md',
                      isMobileHost ? 'h-4 w-4' : 'h-6 w-6',
                      cameraEnabled ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                    )}>
                      {cameraEnabled ? <Video className={isMobileHost ? 'h-2 w-2' : 'h-3 w-3'} /> : <VideoOff className={isMobileHost ? 'h-2 w-2' : 'h-3 w-3'} />}
                    </span>
                  </div>

                  {/* Seat number badge */}
                  <div className={cn(
                    'absolute z-10 rounded-full border border-cyan-300/20 bg-black/15 font-black text-white/90 backdrop-blur-sm',
                    isMobileHost ? 'left-1 bottom-1 px-1 py-0.5 text-[7px]' : 'left-3 bottom-3 px-2.5 py-1 text-[10px]'
                  )}>
                    S1
                  </div>

                  {/* Username + City Status */}
                  <div className={cn(
                    'absolute z-10 flex items-center',
                    isMobileHost ? 'right-1 bottom-1 gap-0.5' : 'right-3 bottom-3 gap-2'
                  )}>
                    <span className={cn(
                      'font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-[60%]',
                      isMobileHost ? 'text-[7px]' : 'text-xs'
                    )}>{broadcasterProfile?.username || 'Broadcaster'}</span>
                    {broadcasterCityStatus.data && (
                      <CityStatusOrb
                        data={broadcasterCityStatus.data}
                        permissions={{ isSelf: isHost, canCheckLicense: false, canRaid: false, canRepair: true, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                        compact
                        onHouseClick={() => setShowUserStats({
                          userId: stream?.user_id || '',
                          username: broadcasterProfile?.username || '',
                          trollCoins: broadcasterProfile?.troll_coins || 0,
                          trollmonds: broadcasterProfile?.trollmonds || 0,
                          licensePlate: broadcasterProfile?.license_plate || null,
                          isSeatUser: false,
                          streamId: streamId,
                        })}
                        onRaid={() => {
                          const targetUser = broadcasterCityStatus.data;
                          if (targetUser?.id && targetUser.id !== user?.id) {
                            setBroadcastRaidTarget(targetUser.id);
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
                      'relative min-h-0 overflow-hidden mobile-host-video pb-4 select-none',
                      isMobileHost
                        ? 'flex-none rounded-none border-0'
                        : theme.hostVideoPanel
                    )}
                   data-gift-target={`user:${stream?.user_id || ''}`}
                   onClick={handleBroadcasterBoxTap}
                   onTouchEnd={(e) => {
                     e.preventDefault()
                     handleBroadcasterBoxTap(e)
                   }}
                   style={isHost ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : undefined}
                 >
                  {streamId && (
                    <MaiBag streamId={streamId} compact className="pointer-events-auto absolute right-3 top-3 z-20" />
                  )}

{/* Camera starting fallback � shows when no video track is available */}
                {(() => {
                  const hostParticipant = hostParticipantRef.current
                  const hostCamTrack = isHost
                    ? (localTracks?.[1] ?? null)
                    : (() => {
                        if (!hostParticipant) return null
                        const pubs = (hostParticipant as any).videoTrackPublications
                        if (pubs) {
                          const pubArray = Array.from(pubs.values()) as any[]
                          const found = pubArray.find((p: any) => p.track && typeof (p.track as any).attach === 'function')
                          if (found) return found.track
                        }
                        return null
                      })()

const showFallback =
                    isHost
                      ? !cameraEnabled || !hostCamTrack
                      : !hostCamTrack

                  if (!showFallback) return null

                  if (broadcasterProfile?.camera_off_image_url) {
                    return (
                      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden bg-black">
                        <img
                          src={broadcasterProfile.camera_off_image_url}
                          alt={`${broadcasterProfile.username || 'Broadcaster'} camera off`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )
                  }

                  return (
                    <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.15),transparent_38%)]">
                      {broadcasterProfile?.avatar_url ? (
                        <img
                          src={broadcasterProfile.avatar_url}
                          alt={broadcasterProfile.username || 'Broadcaster'}
                          className="h-28 w-28 rounded-full border-2 border-cyan-400/70 object-cover shadow-[0_0_28px_rgba(45,212,191,0.35)]"
                        />
                      ) : (
                        <Crown className="h-14 w-14 text-cyan-200/60" />
                      )}
                      <p className="mt-4 text-base font-black text-white">{broadcasterProfile?.username || 'Broadcaster'}</p>
                      <p className="mt-1 text-sm text-cyan-200/60">Camera starting</p>
                    </div>
                  )
                })()}

                {/* Host video element � mounted via TrackAttach, covers card when track available */}
                <TrackAttach
                  track={isHost ? ((localTracks?.[1] && cameraEnabled) ? localTracks[1] : null) : (() => {
                    const hostParticipant = hostParticipantRef.current
                    if (!hostParticipant) return null
                    const pubs = (hostParticipant as any).videoTrackPublications
                    if (pubs) {
                      const pubArray = Array.from(pubs.values()) as any[]
                      const found = pubArray.find((p: any) => p.track && typeof p.track?.attach === 'function')
                      return found
                    }
                    return null
                  })()}
                />

                {/* Gradient overlay � sits above video/fallback */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {isHost && (
                  <CashoutProgressBanner
                    isVisible={cashoutBanner.isVisible}
                    currentBalance={cashoutBanner.currentBalance}
                    nextTier={cashoutBanner.nextTier}
                    amountRemaining={cashoutBanner.amountRemaining}
                    progressPercent={cashoutBanner.progressPercent}
                    isCashoutReady={cashoutBanner.isCashoutReady}
                    onClick={() => cashoutBanner.isCashoutReady && setIsCashoutModalOpen(true)}
                    isMobile={isMobileHost}
                  />
                )}

                {/* Host badge � top-left */}
                <div className="absolute left-5 top-5 z-10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/18 px-4 py-2 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(45,212,191,0.25)] backdrop-blur-xl">
                    <Crown className="h-4 w-4" />
                    Host
                  </div>
                  {/* City Status Orb � compact inline (clickable for broadcaster) */}
                  {broadcasterCityStatus.data && (
                    <div className="pointer-events-auto">
                      <CityStatusOrb
                        data={broadcasterCityStatus.data}
                        permissions={{ isSelf: isHost, canCheckLicense: false, canRaid: false, canRepair: true, canEnforce: false, canRemoveFromSeat: false, canAccessAll: false }}
                        compact
                        onHouseClick={() => setShowUserStats({
                          userId: stream?.user_id || '',
                          username: broadcasterProfile?.username || '',
                          trollCoins: broadcasterProfile?.troll_coins || 0,
                          trollmonds: broadcasterProfile?.trollmonds || 0,
                          licensePlate: broadcasterProfile?.license_plate || null,
                          isSeatUser: false,
                          streamId: streamId,
                        })}
                        onRaid={() => {
                          const targetUser = broadcasterCityStatus.data;
                          if (targetUser?.id && targetUser.id !== user?.id) {
                            setBroadcastRaidTarget(targetUser.id);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Mic / Camera media pills � top-right */}
                <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                  <span className={cn(
                    theme.badge,
                    micEnabled ? theme.emeraldPill : theme.redPill,
                  )} title={`mic ${micEnabled ? 'on' : 'off'}`}>
                    {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </span>
                  <span className={cn(
                    theme.badge,
                    cameraEnabled ? theme.emeraldPill : theme.redPill,
                  )} title={`camera ${cameraEnabled ? 'on' : 'off'}`}>
                    {cameraEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                  </span>
</div>

                  {/* Pinned product overlay */}
                 {(() => {
                   const pinned = pinnedProducts.find((p: any) => p.stream_id === stream.id);
                   if (!pinned) return null;
                   const imgSrc = (pinned as any).image_url || (pinned as any).imageUrl || (pinned as any)?.product?.image_url || null;
                   const title = (pinned as any).title || (pinned as any).name || (pinned as any)?.product?.name || 'Product';
                   const priceVal = (pinned as any).price_coins || (pinned as any).coin_price || (pinned as any).price || (pinned as any)?.product?.price || 0;
                   return (
                     <div className="absolute bottom-6 left-6 z-20 w-[min(310px,calc(100%-32px))] rounded-2xl border border-purple-400/30 bg-[#120b1f]/90 p-4 shadow-[0_0_30px_rgba(168,85,247,0.35)] backdrop-blur-xl">
                       <div className="mb-3 flex items-center justify-between">
                         <span className="rounded-lg bg-purple-500/40 px-2.5 py-1 text-[11px] font-black uppercase text-purple-100">
                           Pinned Product
                         </span>
                         {isHost && (
                           <button
                             onClick={() => pinProduct(pinned.id)}
                             className="rounded-md p-1 text-white/50 hover:text-white transition-colors"
                             aria-label="Remove pinned product"
                           >
                             <X className="h-4 w-4" />
                           </button>
                         )}
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="h-16 w-16 shrink-0 rounded-xl bg-white/8 overflow-hidden">
                           {imgSrc ? (
                             <img src={imgSrc} alt={title} className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full grid place-items-center text-violet-300">
                               <Ticket className="h-7 w-7" />
                              </div>
                        )}
                      </div>
                         <div className="min-w-0">
                           <p className="text-sm font-bold text-white truncate">{title}</p>
                           <p className="mt-1 text-xs text-white/60">{priceVal.toLocaleString()} coins</p>
                         </div>
                       </div>
                     </div>
                   )
                 })()}
               </section>
              )}

              {/* -- CENTER: Seats (desktop only - mobile seats overlay on video) -- */}
              {!isMobileHost && layoutMode === 'split' && <aside
                className={cn(
                  'flex h-auto min-h-0 flex-col overflow-hidden backdrop-blur-md shadow-[0_0_30px_rgba(45,212,191,0.10)] pb-4',
                  viewerSeatCards.length === 1
                    ? 'rounded-[26px] border border-cyan-400/20 bg-slate-950'
                    : 'rounded-[28px] border border-cyan-300/20 bg-transparent p-4'
                )}
              >
                <div className="flex shrink-0 items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200/80">Seats</p>
                    <p className="mt-2 text-sm text-slate-300">
                    </p>
                  </div>
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm font-bold text-cyan-100">
                    {Math.max(viewerSeatCards.filter((seat) => seat.isOccupied).length, remoteParticipants.size)}/{currentViewerSeatCount} live
                  </div>
                </div>

                {viewerSeatCards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="flex flex-col items-center text-center px-4 py-6">
                      <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />
                        <Users className="h-14 w-14 text-cyan-300/50 relative" />
                      </div>
                      <h3 className="text-base font-black text-white">No Guest Seats Enabled</h3>
                      <p className="mt-2 text-xs text-slate-400 max-w-[220px] leading-relaxed">
                        This broadcast is currently host-only. Add seats anytime to invite guests.
                      </p>
                      <div className="mt-5 flex flex-col gap-2.5">
                        <button
                          onClick={handleOpenSeatsModal}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-2.5 text-sm font-black text-cyan-200 transition-all hover:bg-cyan-500/25 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                        >
                          <Plus className="h-4 w-4" />
                          Add Seats
                        </button>
                        <button className="text-[11px] font-bold text-slate-500 transition-colors hover:text-white">
                          Learn about guest seats
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className={cn(
                     'grid min-h-0 flex-1 gap-3 transition-all',
                     viewerSeatCards.length === 1 && 'grid-cols-1',
                     viewerSeatCards.length >= 2 && 'mt-4',
                     viewerSeatCards.length === 2 && 'grid-cols-2',
                     viewerSeatCards.length === 3 && 'grid-cols-3',
                     viewerSeatCards.length === 4 && 'grid-cols-2',
                     (viewerSeatCards.length === 5 || viewerSeatCards.length === 6) && 'grid-cols-3',
                     (viewerSeatCards.length === 7 || viewerSeatCards.length === 8) && 'grid-cols-4',
                     viewerSeatCards.length >= 9 && 'grid-cols-4',
                   )}>
                  {viewerSeatCards.map((seat) => {

                     const matchedParticipant = seat.remoteParticipant

                    const participantDisplayName = matchedParticipant
                      ? getParticipantLabel(matchedParticipant, seat.displayName)
                      : seat.displayName

                     // SAFETY: gated behind DEV + explicit flag to avoid render-loop spam
                     if (import.meta.env.DEV && (window as any).DEBUG_BROADCAST_SEATS) {
                       console.log('[BroadcastSeatRenderDebug]', {
                         seatIndex: seat.seatIndex,
                         seatStatus: seat.seatStatus,
                         seatUserId: seat.seatUserId,
                         seatIdentity: seat.seatIdentity,
                         remoteIdentities: Array.from(remoteParticipants.values()).map((p: any) => p.identity),
                         matchedIdentity: matchedParticipant?.identity || null,
                         hasVideoTrack: Boolean(getVideoTrackFromRemoteParticipant(matchedParticipant)),
                       })
                     }

                      const seatCameraPublication = matchedParticipant
                        ? (matchedParticipant as any).getTrackPublication?.(Track.Source.Camera) ||
                          (matchedParticipant as any).videoTrackPublications && Array.from((matchedParticipant as any).videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera)
                        : null

                     const seatParticipantMetadata = matchedParticipant ? getRemoteParticipantMetadata(matchedParticipant) : {}
                    const seatActionUserId =
                      seat.seatUserId ||
                      seatParticipantMetadata.user_id ||
                      seatParticipantMetadata.userId ||
                      (seatParticipantMetadata as any)?.user_id ||
                      (seatParticipantMetadata as any)?.userId ||
                      null
                    const seatActionUsername =
                      seat.displayName ||
                      getParticipantLabel(matchedParticipant, 'Viewer')
                    const seatActionRole =
                      seat?.avatarUrl ? seatParticipantMetadata.role || seatParticipantMetadata.troll_role || seat?.seatStatus : undefined
                    const seatActionInfo =
                      canInteractWithSeats && seat.isOccupied && seatActionUserId
                        ? { userId: String(seatActionUserId), username: seatActionUsername, role: seatActionRole, seatSessionId: seat.seatSessionId }
                        : null

                     // Determine seat connection state for loading/unavailable UI
                      const seatConnectedAt = seatJoinTimes[seat.seatIndex] || 0
                      const isCameraConnecting = seat.isOccupied && !matchedParticipant && (Date.now() - seatConnectedAt < 8000 || seatConnectedAt === 0)
                      const isCameraUnavailable = seat.isOccupied && !matchedParticipant && seatConnectedAt > 0 && (Date.now() - seatConnectedAt >= 8000)

                      const handleRetrySeat = async () => {
                        await refreshSeats()
                      }

                      const handleRemoveSeatUser = async () => {
                        if (!seatActionInfo) return
                        await handleGeneralKick()
                      }

                      // Any occupied seat is clickable to open CityStatusPanel
                      const canClickSeat = seat.isOccupied && seat.seatUserId;

                      // Host/officer seats also open UserActionModal for moderation
                      const clickProps = canClickSeat
                        ? {
                            role: 'button' as const,
                            tabIndex: 0,
                            onClick: () => {
                              if (seatActionInfo) {
                                handleOpenUserAction(seatActionInfo);
                              } else {
                                setSelectedSeatUserId(seat.seatUserId!);
                              }
                            },
                            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (seatActionInfo) {
                                  handleOpenUserAction(seatActionInfo);
                                } else {
                                  setSelectedSeatUserId(seat.seatUserId!);
                                }
                              }
                            },
                          }
                        : undefined

                     return (
                      <div
                        key={`seat-${streamId}-${seat.seatIndex}-${seat.seatSessionId || seat.seatUserId || 'empty'}`}
                        className={cn(
                          'group relative flex flex-col overflow-hidden rounded-2xl border bg-slate-950/60 backdrop-blur-md transition-all duration-300',
                          viewerSeatCards.length === 1 && 'h-full',
                          seat.isOccupied
                           ? 'border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.12)] hover:border-emerald-300/60 hover:shadow-[0_0_32px_rgba(16,185,129,0.2)] hover:-translate-y-0.5'
                           : 'border-cyan-400/30 shadow-[0_0_20px_rgba(15,23,42,0.25)] hover:border-cyan-300/50 hover:shadow-[0_0_28px_rgba(34,211,238,0.15)] hover:-translate-y-0.5',
                        canClickSeat ? 'cursor-pointer' : ''
                      )}
                      {...clickProps}
                      data-gift-target={seat.seatUserId ? `user:${seat.seatUserId}` : ''}
                    >
                      {seat.isOccupied ? (
                        <>
                          <div className="absolute inset-0">
                            <RemoteSeatSurface
                              participant={matchedParticipant}
                              cameraTrack={seat.remoteParticipantSnapshot?.cameraTrack}
                              fallback={
                                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/30 bg-transparent">
                                    <Users className="h-6 w-6 text-purple-200/80" />
                                  </div>
                                  <div className="px-3 text-sm font-black text-white">{participantDisplayName}</div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/70">Camera starting</div>
                                </div>
                              }
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <span className="truncate text-xs font-black text-white">{participantDisplayName}</span>
                              {(seatParticipantMetadata as any)?.is_broadcaster && (
                                <span className="rounded-full border border-amber-400/30 bg-amber-500/15 p-0.5 text-amber-300">
                                  <Crown className="h-3 w-3" />
                                </span>
                              )}
                              {(seatParticipantMetadata as any)?.level && (
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-200">
                                  Lv{(seatParticipantMetadata as any).level}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              'mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                              matchedParticipant
                                ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                : isCameraUnavailable
                                  ? 'border-red-300/30 bg-red-500/10 text-red-200'
                                  : isCameraConnecting
                                    ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200'
                                    : 'border-purple-300/30 bg-purple-500/10 text-purple-200'
                            )}>
                              {matchedParticipant ? 'On Camera' : isCameraUnavailable ? 'Camera unavailable' : isCameraConnecting ? 'Connecting...' : seat.seatPrice > 0 ? `${seat.seatPrice} coins` : 'Free'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center p-3 pt-10">
                          <UserPlus className="h-8 w-8 text-cyan-300/40" />
                          <span className="mt-2 text-[11px] font-black uppercase tracking-wider text-cyan-200/70">
                            Invite Guest
                          </span>
                        </div>
                      )}

                      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-2">
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-[10px] font-black text-white/90 backdrop-blur-sm">
                          S{seat.seatIndex}
                        </span>
                        <div className="flex items-center gap-1">
                          {stream?.are_seats_locked && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 p-1 text-amber-300">
                              <Lock className="h-3 w-3" />
                            </span>
                          )}
                          {seat.isOccupied && (
                            <>
                              {matchedParticipant ? (
                                <span className={cn(
                                  'rounded-full border p-1',
                                  getAudioTrackFromRemoteParticipant(matchedParticipant) ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                                )}>
                                  {getAudioTrackFromRemoteParticipant(matchedParticipant) ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                                </span>
                              ) : (
                                <span className={cn(
                                  'rounded-full border p-1',
                                  isCameraConnecting ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/5 text-white/40'
                                )}>
                                  {isCameraConnecting ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                                </span>
                              )}
                              {matchedParticipant && (
                                <span className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60">
                                  <Wifi className="h-3 w-3" />
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                      {seat.isOccupied && seat.seatUserId && (
                        <div className="relative z-10 px-3 pb-3">
                          <SeatCityStatusOrb
                            userId={seat.seatUserId}
                            broadcasterId={user?.id}
                            isBroadOfficer={isOfficer}
                            onClick={() => setSelectedSeatUserId(seat.seatUserId)}
                          />
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
                 )}
                </aside>
                }

               {/* -- GRID MODE: Individual seat tiles rendered as direct grid children -- */}
               {layoutMode === 'grid' && viewerSeatCards.map((seat) => {
                 const matchedParticipant = seat.remoteParticipant
                 const participantDisplayName = matchedParticipant
                   ? getParticipantLabel(matchedParticipant, seat.displayName)
                   : seat.displayName

                  const seatCameraPublication = matchedParticipant
                    ? (matchedParticipant as any).getTrackPublication?.(Track.Source.Camera) ||
                      (matchedParticipant as any).videoTrackPublications && Array.from((matchedParticipant as any).videoTrackPublications.values()).find((p: any) => p.source === Track.Source.Camera)
                    : null

                  const seatConnectedAt = seatJoinTimes[seat.seatIndex] || 0
                 const isCameraConnecting = seat.isOccupied && !matchedParticipant && (Date.now() - seatConnectedAt < 8000 || seatConnectedAt === 0)
                 const isCameraUnavailable = seat.isOccupied && !matchedParticipant && seatConnectedAt > 0 && (Date.now() - seatConnectedAt >= 8000)

                const seatParticipantMetadata = matchedParticipant ? getRemoteParticipantMetadata(matchedParticipant) : {}
                const seatActionUserId =
                  seat.seatUserId ||
                  seatParticipantMetadata.user_id ||
                  seatParticipantMetadata.userId ||
                  (seatParticipantMetadata as any)?.user_id ||
                  (seatParticipantMetadata as any)?.userId ||
                  null
                const seatActionUsername =
                  seat.displayName ||
                  getParticipantLabel(matchedParticipant, 'Viewer')
                const seatActionInfo =
                  canInteractWithSeats && seat.isOccupied && seatActionUserId
                    ? { userId: String(seatActionUserId), username: seatActionUsername, role: undefined, seatSessionId: seat.seatSessionId }
                    : null

                const handleRetrySeat = async () => { await refreshSeats() }
                const handleRemoveSeatUser = async () => {
                  if (!seatActionInfo) return
                  await handleGeneralKick()
                }

                const canClickSeat = seat.isOccupied && seat.seatUserId;
                const clickProps = canClickSeat
                  ? {
                      role: 'button' as const,
                      tabIndex: 0,
                      onClick: () => {
                        if (seatActionInfo) {
                          handleOpenUserAction(seatActionInfo);
                        } else {
                          setSelectedSeatUserId(seat.seatUserId!);
                        }
                      },
                      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (seatActionInfo) {
                            handleOpenUserAction(seatActionInfo);
                          } else {
                            setSelectedSeatUserId(seat.seatUserId!);
                          }
                        }
                      },
                    }
                  : undefined

                 return (
                     <div
                       key={`grid-seat-${streamId}-${seat.seatIndex}-${seat.seatSessionId || seat.seatUserId || 'empty'}`}
                       className={cn(
                         'group relative flex flex-col overflow-hidden rounded-2xl border bg-slate-950/60 backdrop-blur-md transition-all duration-300 pb-4',
                         isMobileHost ? 'rounded-lg' : '',
                        seat.isOccupied
                          ? 'border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.12)] hover:border-emerald-300/60 hover:shadow-[0_0_32px_rgba(16,185,129,0.2)] hover:-translate-y-0.5'
                          : 'border-cyan-400/30 shadow-[0_0_20px_rgba(15,23,42,0.25)] hover:border-cyan-300/50 hover:shadow-[0_0_28px_rgba(34,211,238,0.15)] hover:-translate-y-0.5',
                        canClickSeat ? 'cursor-pointer' : ''
                      )}
                      {...clickProps}
                      data-gift-target={seat.seatUserId ? `user:${seat.seatUserId}` : ''}
                    >
                      {seat.isOccupied ? (
                        <>
                          <div className="absolute inset-0">
                            <RemoteSeatSurface
                              participant={matchedParticipant}
                              cameraTrack={seat.remoteParticipantSnapshot?.cameraTrack}
                              fallback={
                                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-purple-300/30 bg-transparent">
                                    <Users className="h-6 w-6 text-purple-200/80" />
                                  </div>
                                  <div className="px-3 text-sm font-black text-white">{participantDisplayName}</div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200/70">Camera starting</div>
                                </div>
                              }
                            />
                          </div>

                          {seat.seatUserId && (
                            <TargetedGiftOverlay
                              targetKey={`user:${seat.seatUserId}`}
                              gifts={giftQueues[`user:${seat.seatUserId}`] ?? []}
                              onGiftComplete={removeGift}
                            />
                          )}

                          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <span className="truncate text-xs font-black text-white">{participantDisplayName}</span>
                              {(seatParticipantMetadata as any)?.is_broadcaster && (
                                <span className="rounded-full border border-amber-400/30 bg-amber-500/15 p-0.5 text-amber-300">
                                  <Crown className="h-3 w-3" />
                                </span>
                              )}
                              {(seatParticipantMetadata as any)?.level && (
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-black text-cyan-200">
                                  Lv{(seatParticipantMetadata as any).level}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              'mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                              matchedParticipant
                                ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                : isCameraUnavailable
                                  ? 'border-red-300/30 bg-red-500/10 text-red-200'
                                  : isCameraConnecting
                                    ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200'
                                    : 'border-purple-300/30 bg-purple-500/10 text-purple-200'
                            )}>
                              {matchedParticipant ? 'On Camera' : isCameraUnavailable ? 'Camera unavailable' : isCameraConnecting ? 'Connecting...' : seat.seatPrice > 0 ? `${seat.seatPrice} coins` : 'Free'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center p-3 pt-10">
                          <UserPlus className="h-8 w-8 text-cyan-300/40" />
                          <span className="mt-2 text-[11px] font-black uppercase tracking-wider text-cyan-200/70">
                            Invite Guest
                          </span>
                        </div>
                      )}

                     <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-2">
                       <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-[10px] font-black text-white/90 backdrop-blur-sm">
                         S{seat.seatIndex}
                       </span>
                       <div className="flex items-center gap-1">
                         {stream?.are_seats_locked && (
                           <span className="rounded-full border border-amber-400/30 bg-amber-500/10 p-1 text-amber-300">
                             <Lock className="h-3 w-3" />
                           </span>
                         )}
                         {seat.isOccupied && (
                           <>
                             {matchedParticipant ? (
                               <span className={cn(
                                 'rounded-full border p-1',
                                 getAudioTrackFromRemoteParticipant(matchedParticipant) ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                               )}>
                                 {getAudioTrackFromRemoteParticipant(matchedParticipant) ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                               </span>
                             ) : (
                               <span className={cn(
                                 'rounded-full border p-1',
                                 isCameraConnecting ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/5 text-white/40'
                               )}>
                                 {isCameraConnecting ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                               </span>
                             )}
                             {matchedParticipant && (
                               <span className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60">
                                 <Wifi className="h-3 w-3" />
                               </span>
                             )}
                           </>
                         )}
                       </div>
                     </div>

                     <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                     {seat.isOccupied && seat.seatUserId && (
                       <div className="relative z-10 px-3 pb-3">
                         <SeatCityStatusOrb
                           userId={seat.seatUserId}
                           broadcasterId={user?.id}
                           isBroadOfficer={isOfficer}
                           onClick={() => setSelectedSeatUserId(seat.seatUserId)}
                         />
                     </div>
                    )}
                  </div>
                )
              })}

              {/* -- RIGHT: Chat Panel (desktop only - mobile chat is floating) -- */}
              {!isMobileHost && layoutMode === 'split' && <aside className={cn(
     theme.chatPanel,
     'flex min-h-0 flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)] pb-4'
   )}>
                {/* Chat tabs */}
                <div className="grid grid-cols-6 border-b border-white/10 bg-black/10">
                   {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans', 'Settings'].map((tab) => {
                     const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans' | 'settings'
                    const active = chatTab === tabKey
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setChatTab(tabKey)}
                        className={cn(
                          'relative h-16 text-sm font-black transition-colors',
                          active ? 'text-white' : 'text-white/60 hover:text-white/80',
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

                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                   {chatTab === 'progress' ? (
                     <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                       <LeagueProgressPanel streamId={streamId} />
                     </div>
                   ) : chatTab === 'chat' ? (
                     <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
                      {/* Floating messages area � newest on top, scrollable */}
<div
  ref={floatingChatContainerRef}
  className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide overscroll-contain"
>
                        {floatingMessages.length === 0 && (
                          <div className="flex h-full items-center justify-center text-white/25 text-sm font-bold">
                            No messages yet � say something!
                          </div>
                        )}
{floatingMessages.map((msg) => {
                          const isPinned = pinnedMessageIds.has(msg.id)
                          return (
                          <div
                            key={msg.id}
                            className={cn(
                              "text-sm leading-relaxed break-words animate-in fade-in duration-200",
                              isPinned && "bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2 py-1"
                            )}
                            style={{ animation: 'slideInFromTop 0.3s ease-out' }}
                          >
                             <button
                               onClick={() => handleOpenFloatingChatUsername(msg.username, msg.user_id)}
                               className="font-black text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                               title={`View ${msg.username}'s profile`}
                             >
                               {msg.username}
                               {subscriberUsernames?.has(msg.username) && (
                                 <Crown className="w-3 h-3 text-yellow-400" />
                               )}
                             </button>
                             <span className="text-white/40 mx-1">sent:</span>
                             <span className="text-white/90">{msg.content}</span>
                            {canPinMessages && (
                              <button
                                onClick={() => isPinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)}
                                className={cn(
                                  "ml-2 inline-flex items-center transition-colors",
                                  isPinned ? "text-yellow-400 hover:text-yellow-300" : "text-white/30 hover:text-white/60"
                                )}
                                title={isPinned ? "Unpin message" : "Pin message"}
                              >
                                <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
                              </button>
                            )}
                          </div>
                          )
                        })}
                      </div>

                      {/* Input at the bottom */}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const text = chatInput.trim()
                          if (!text) return

                          if (hostChatDisabledByOfficer) {
                            toast.error(
                              hostChatDisableRemainingMs
                                ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                                : 'Chat is disabled by officer control'
                            )
                            return
                          }

                          if (!user && !reserveAnonymousChatSlot()) {
                            toast.error('You�ve used your 5 anonymous chats. Sign in to keep chatting.')
                            navigate('/auth?mode=login')
                            return
                          }

                           const username = profile?.username || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
                          const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

                          setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(-50))
                          setChatInput('')

                           // Auto-remove after 60 seconds
                           trackedTimeout(() => {
                             setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                           }, 60_000)

                           try {
                             const result = await sendChatThroughGate({ streamId, content: text })
                             if (result.ok) {
                               const chatChannel = floatingChatChannelRef.current;
                               if (chatChannel) {
                                 chatChannel.send({
                                   type: 'broadcast',
                                   event: 'floating_chat',
                                   payload: { username, content: text },
                                 }).catch(() => {})
                               }
                             }
                           } catch (err) {
                             console.warn('[BroadcastPage] send-message failed:', err)
                           }
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
                              : 'Say something�'
                          }
                          disabled={hostChatDisabledByOfficer}
                          readOnly={hostChatDisabledByOfficer}
                          className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          maxLength={280}
                        />
                      </form>
                    </div>
                  ) : chatTab === 'league' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
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
                                    {league.icon_emoji || '??'}
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
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Gifts by Supporter</div>
                      {giftSummaryBySender.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                          No gift activity to show yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {giftSummaryBySender.map((entry) => (
                            <div key={entry.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{entry.sender_username || 'Anonymous'}</div>
                                  <div className="text-xs text-slate-400 truncate">{entry.gift_count} gift{entry.gift_count === 1 ? '' : 's'} sent</div>
                                </div>
                                <div className="text-xs font-semibold text-cyan-300">{entry.total_coins.toLocaleString()} coins</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : chatTab === 'top-fans' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-transparent p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">All-Time Top Gifters</div>
                      {isAllTimeTopGiftersLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading top gifters...</div>
                      ) : allTimeTopGifters.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No all-time gifters yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {allTimeTopGifters.map((fan, index) => (
                            <Link
                              key={fan.sender_id}
                              to={`/profile/${fan.sender_username}`}
                              className="block rounded-2xl border border-white/10 bg-black/20 p-3 transition-all hover:border-cyan-300/40 hover:bg-cyan-500/10"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                    #{index + 1}
                                  </div>
                                  {fan.sender_avatar_url ? (
                                    <img
                                      src={fan.sender_avatar_url}
                                      alt={fan.sender_username}
                                      className="h-10 w-10 shrink-0 rounded-full border border-cyan-300/40 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-white">
                                      {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-white hover:text-cyan-200">{fan.sender_username || 'Troll Citizen'}</div>
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
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : chatTab === 'settings' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200 space-y-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Stream Settings</div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-white">Lock Seats</p>
                            <p className="text-xs text-slate-400">Prevent viewers from joining seats</p>
                          </div>
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={async () => {
                              if (!stream || !isHost) return
                              const next = !stream.are_seats_locked
                              const { error } = await supabase.from('streams').update({ are_seats_locked: next }).eq('id', stream.id)
                              if (error) { toast.error('Failed to update seat lock'); return }
                              setStream((prev: any) => prev ? { ...prev, are_seats_locked: next } : prev)
                              toast.success(next ? 'Seats locked' : 'Seats unlocked')
                            }}
                            className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', stream?.are_seats_locked ? 'bg-cyan-500' : 'bg-white/10')}
                          >
                            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform', stream?.are_seats_locked ? 'translate-x-7' : 'translate-x-1')} />
                          </button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-black text-white">Paid Chat</p>
                            <p className="text-xs text-slate-400">Require payment to send chat messages</p>
                          </div>
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={async () => {
                              if (!streamId || !isHost) return
                              const next = !streamSettings?.paid_chat_enabled
                              const { error } = await supabase.from('stream_settings').upsert({ stream_id: streamId, paid_chat_enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'stream_id' })
                              if (error) { toast.error('Failed to update paid chat'); return }
                              setStreamSettings((prev: any) => prev ? { ...prev, paid_chat_enabled: next } : { ...(prev || {}), paid_chat_enabled: next })
                              toast.success(next ? 'Paid chat enabled' : 'Paid chat disabled')
                            }}
                            className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', streamSettings?.paid_chat_enabled ? 'bg-cyan-500' : 'bg-white/10')}
                          >
                            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform', streamSettings?.paid_chat_enabled ? 'translate-x-7' : 'translate-x-1')} />
                          </button>
                        </div>
                        {streamSettings?.paid_chat_enabled && (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs text-slate-400">Price per message (coins)</label>
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={streamSettings?.paid_chat_price ?? 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0)
                                setStreamSettings((prev: any) => prev ? { ...prev, paid_chat_price: val } : prev)
                              }}
                              onBlur={async () => {
                                if (!streamId || !isHost) return
                                const { error } = await supabase.from('stream_settings').upsert({ stream_id: streamId, paid_chat_price: streamSettings?.paid_chat_price ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'stream_id' })
                                if (error) toast.error('Failed to save price')
                              }}
                              className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-400/40"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                     ): null
                 }
                  </div>
                 </aside>
              }
                {/* In split mode, chat panel is the 3rd column inside <main> */}
              {/* In grid mode, chat panel is rendered below the grid further down */}
            </main>

             {/* ===== GRID MODE: Chat panel below the seat grid (desktop only) ===== */}
             {!isMobileHost && layoutMode === 'grid' && (
               <aside className={cn(
                 theme.chatPanel,
                 'flex flex-col overflow-hidden bg-black/20 border border-white/10 backdrop-blur-xl shadow-[0_0_28px_rgba(45,212,191,0.12)]',
                 'h-[280px] shrink-0 pb-4'
               )}>
                {/* Chat tabs */}
                <div className="grid grid-cols-6 border-b border-white/10 bg-black/10">
                  {['Chat', 'Progress', 'League', 'Gifts', 'Top Fans', 'Settings'].map((tab) => {
                    const tabKey = tab.toLowerCase().replace(/\s+/g, '-') as 'chat' | 'progress' | 'league' | 'gifts' | 'top-fans' | 'settings'
                    const active = chatTab === tabKey
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setChatTab(tabKey)}
                        className={cn(
                          'relative h-16 text-sm font-black transition-colors',
                          active ? 'text-white' : 'text-white/60 hover:text-white/80',
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
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                        {floatingMessages.map((msg) => {
                          const isPinned = pinnedMessageIds.has(msg.id)
                          return (
                          <div
                            key={msg.id}
                            className={cn(
                              "text-sm leading-relaxed break-words animate-in fade-in duration-200",
                              isPinned && "bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2 py-1"
                            )}
                            style={{ animation: 'slideInFromTop 0.3s ease-out' }}
                          >
                            <button
                              onClick={() => handleOpenFloatingChatUsername(msg.username, msg.user_id)}
                              className="font-black text-cyan-300 hover:text-cyan-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                              title={`View ${msg.username}'s profile`}
                            >
                              {msg.username}
                              {subscriberUsernames?.has(msg.username) && (
                                <Crown className="w-3 h-3 text-yellow-400" />
                              )}
                            </button>
                            <span className="mx-1 text-white/30 text-sm">:</span>
                            <span className="text-sm text-white/80">{msg.content}</span>
                            {canPinMessages && (
                              <button
                                onClick={() => isPinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)}
                                className={cn(
                                  "ml-2 inline-flex items-center transition-colors",
                                  isPinned ? "text-yellow-400 hover:text-yellow-300" : "text-white/30 hover:text-white/60"
                                )}
                                title={isPinned ? "Unpin message" : "Pin message"}
                              >
                                <Pin className={cn("w-3 h-3", isPinned && "fill-current")} />
                              </button>
                            )}
                          </div>
                          )
                        })}
                      </div>
                      {/* Chat input */}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault()
                          const text = chatInput.trim()
                          if (!text) return

                          if (hostChatDisabledByOfficer) {
                            toast.error(
                              hostChatDisableRemainingMs
                                ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                                : 'Chat is disabled by officer control'
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

                           setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(-50))
                           recentChatKeysRef.current.set(`${username}:${text}`, Date.now())
                           setChatInput('')

                           trackedTimeout(() => {
                             setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                           }, 60_000)

                           try {
                             const result = await sendChatThroughGate({ streamId, content: text })
                             if (result.ok) {
                               const chatChannel = floatingChatChannelRef.current;
                               if (chatChannel) {
                                 chatChannel.send({
                                   type: 'broadcast',
                                   event: 'floating_chat',
                                   payload: { username, content: text },
                                 }).catch(() => {})
                               }
                             }
                           } catch (err) {
                             console.warn('[BroadcastPage] send-message failed:', err)
                           }
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
                              : 'Say something…'
                          }
                          disabled={hostChatDisabledByOfficer}
                          readOnly={hostChatDisabledByOfficer}
                          className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          maxLength={280}
                        />
                      </form>
                    </div>
                  ) : chatTab === 'league' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                      <LeagueProgressPanel streamId={streamId} />
                    </div>
                  ) : chatTab === 'gifts' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Gifts by Supporter</div>
                      {giftSummaryBySender.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-slate-500">
                          No gift activity to show yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {giftSummaryBySender.map((entry) => (
                            <div key={entry.sender_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{entry.sender_username || 'Anonymous'}</div>
                                  <div className="text-xs text-slate-400 truncate">{entry.gift_count} gift{entry.gift_count === 1 ? '' : 's'} sent</div>
                                </div>
                                <div className="text-xs font-semibold text-cyan-300">{entry.total_coins.toLocaleString()} coins</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : chatTab === 'top-fans' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-transparent p-4 text-sm text-slate-200">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">All-Time Top Gifters</div>
                      {isAllTimeTopGiftersLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">Loading top gifters...</div>
                      ) : allTimeTopGifters.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-slate-500">No all-time gifters yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {allTimeTopGifters.map((fan, index) => (
                            <Link
                              key={fan.sender_id}
                              to={`/profile/${fan.sender_username}`}
                              className="block rounded-2xl border border-white/10 bg-black/20 p-3 transition-all hover:border-cyan-300/40 hover:bg-cyan-500/10"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-200">
                                    #{index + 1}
                                  </div>
                                  {fan.sender_avatar_url ? (
                                    <img
                                      src={fan.sender_avatar_url}
                                      alt={fan.sender_username}
                                      className="h-10 w-10 shrink-0 rounded-full border border-cyan-300/40 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-white">
                                      {fan.sender_username?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-white hover:text-cyan-200">{fan.sender_username || 'Troll Citizen'}</div>
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
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : chatTab === 'settings' ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 text-sm text-slate-200 space-y-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Stream Settings</div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-white">Lock Seats</p>
                            <p className="text-xs text-slate-400">Prevent viewers from joining seats</p>
                          </div>
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={async () => {
                              if (!stream || !isHost) return
                              const next = !stream.are_seats_locked
                              const { error } = await supabase.from('streams').update({ are_seats_locked: next }).eq('id', stream.id)
                              if (error) { toast.error('Failed to update seat lock'); return }
                              setStream((prev: any) => prev ? { ...prev, are_seats_locked: next } : prev)
                              toast.success(next ? 'Seats locked' : 'Seats unlocked')
                            }}
                            className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', stream?.are_seats_locked ? 'bg-cyan-500' : 'bg-white/10')}
                          >
                            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform', stream?.are_seats_locked ? 'translate-x-7' : 'translate-x-1')} />
                          </button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-black text-white">Paid Chat</p>
                            <p className="text-xs text-slate-400">Require payment to send chat messages</p>
                          </div>
                          <button
                            type="button"
                            disabled={!isHost}
                            onClick={async () => {
                              if (!streamId || !isHost) return
                              const next = !streamSettings?.paid_chat_enabled
                              const { error } = await supabase.from('stream_settings').upsert({ stream_id: streamId, paid_chat_enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'stream_id' })
                              if (error) { toast.error('Failed to update paid chat'); return }
                              setStreamSettings((prev: any) => prev ? { ...prev, paid_chat_enabled: next } : { ...(prev || {}), paid_chat_enabled: next })
                              toast.success(next ? 'Paid chat enabled' : 'Paid chat disabled')
                            }}
                            className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', streamSettings?.paid_chat_enabled ? 'bg-cyan-500' : 'bg-white/10')}
                          >
                            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform', streamSettings?.paid_chat_enabled ? 'translate-x-7' : 'translate-x-1')} />
                          </button>
                        </div>
                        {streamSettings?.paid_chat_enabled && (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs text-slate-400">Price per message (coins)</label>
                            <input
                              type="number"
                              min={0}
                              max={10000}
                              value={streamSettings?.paid_chat_price ?? 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0)
                                setStreamSettings((prev: any) => prev ? { ...prev, paid_chat_price: val } : prev)
                              }}
                              onBlur={async () => {
                                if (!streamId || !isHost) return
                                const { error } = await supabase.from('stream_settings').upsert({ stream_id: streamId, paid_chat_price: streamSettings?.paid_chat_price ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'stream_id' })
                                if (error) toast.error('Failed to save price')
                              }}
                              className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-400/40"
                            />
                          </div>
                        )}
                      </div>
                     </div>
                    ): null
                 }
                  </div>
                 </aside>
              )}

            {/* ═══ MOBILE HOST OVERLAYS ═══ */}
            {isMobileHost && (
              <>
                {/* Seats overlay on broadcaster video — NOT in grid mode (grid renders seats inside <main>) */}
                {layoutMode === 'split' && viewerSeatCards.length > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 z-20 flex flex-col pointer-events-none"
                    style={{
                      bottom: '16px',
                      maxHeight: '45%',
                    }}
                  >
                    <div className="pointer-events-auto overflow-y-auto px-2 pb-1">
                     <div className={cn(
                       'grid gap-1.5',
                        viewerSeatCards.length === 1 ? 'grid-cols-1' : viewerSeatCards.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
                        viewerSeatCards.length >= 6 && 'sm:gap-0.5'
                     )}>
                        {viewerSeatCards.map((seat) => {
                           const matchedParticipant = seat.remoteParticipant;
                          const participantDisplayName = matchedParticipant
                            ? getParticipantLabel(matchedParticipant, seat.displayName)
                            : seat.displayName;

                          const seatParticipantMetadata = matchedParticipant ? getRemoteParticipantMetadata(matchedParticipant) : {};
                          const seatActionUserId =
                            seat.seatUserId ||
                            seatParticipantMetadata.user_id ||
                            seatParticipantMetadata.userId ||
                            null;
                          const seatActionUsername =
                            seat.displayName ||
                            getParticipantLabel(matchedParticipant, 'Viewer');
                          const seatActionRole =
                            seat?.avatarUrl ? seatParticipantMetadata.role || seatParticipantMetadata.troll_role || seat?.seatStatus : undefined;
                          const seatActionInfo =
                            canInteractWithSeats && seat.isOccupied && seatActionUserId
                              ? { userId: String(seatActionUserId), username: seatActionUsername, role: seatActionRole, seatSessionId: seat.seatSessionId }
                              : null;

                          const seatConnectedAt = seatJoinTimes[seat.seatIndex] || 0;
                          const isCameraConnecting = seat.isOccupied && !matchedParticipant && (Date.now() - seatConnectedAt < 8000 || seatConnectedAt === 0);
                          const isCameraUnavailable = seat.isOccupied && !matchedParticipant && seatConnectedAt > 0 && (Date.now() - seatConnectedAt >= 8000);

                          const canClickSeat = seat.isOccupied && seat.seatUserId;
                          const clickProps = canClickSeat
                            ? {
                                role: 'button' as const,
                                tabIndex: 0,
                                onClick: () => {
                                  if (seatActionInfo) {
                                    handleOpenUserAction(seatActionInfo);
                                  } else {
                                    setSelectedSeatUserId(seat.seatUserId!);
                                  }
                                },
                                onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (seatActionInfo) {
                                      handleOpenUserAction(seatActionInfo);
                                    } else {
                                      setSelectedSeatUserId(seat.seatUserId!);
                                    }
                                  }
                                },
                              }
                            : undefined;

                           return (
                             <div
                               key={`mobile-seat-${streamId}-${seat.seatIndex}-${seat.seatSessionId || seat.seatUserId || 'empty'}`}
                                className={cn(
                                  'group relative flex flex-col overflow-hidden rounded-2xl border bg-slate-950/60 backdrop-blur-md transition-all duration-300',
                                  viewerSeatCards.length === 1 ? 'w-full' : 'aspect-[4/3]',
                                  seat.isOccupied
                                   ? 'border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.12)] hover:border-emerald-300/60 hover:shadow-[0_0_32px_rgba(16,185,129,0.2)] hover:-translate-y-0.5'
                                   : 'border-cyan-400/30 shadow-[0_0_20px_rgba(15,23,42,0.25)] hover:border-cyan-300/50 hover:shadow-[0_0_28px_rgba(34,211,238,0.15)] hover:-translate-y-0.5',
                                 canClickSeat ? 'cursor-pointer' : ''
                               )}
                               {...clickProps}
                               data-gift-target={seat.seatUserId ? `user:${seat.seatUserId}` : ''}
                             >
                              {seat.isOccupied ? (
                                <div className="flex flex-1 flex-col items-center justify-center p-2 pt-8">
                          <div className="relative h-12 w-12">
                                    {(matchedParticipant as any)?.isSpeaking && (
                                      <span className="absolute inset-0 rounded-full border-2 border-emerald-400/60 animate-ping" />
                                    )}
                                     {matchedParticipant ? (
                                       <RemoteSeatSurface
                                         participant={matchedParticipant}
                                         cameraTrack={seat.remoteParticipantSnapshot?.cameraTrack}
                                         fallback={
                                           <div className="grid h-8 w-8 place-items-center rounded-lg border border-purple-300/30 bg-transparent">
                                             <Users className="h-4 w-4 text-purple-200/80" />
                                              </div>
                                          }
                                        />
                                      ) : isCameraUnavailable ? (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 opacity-60">
                                        {seat.avatarUrl ? (
                                          <img src={seat.avatarUrl} alt={participantDisplayName} className="h-full w-full rounded-full object-cover" />
                                        ) : (
                                          <VideoOff className="h-3.5 w-3.5 text-red-300/60" />
                                        )}
                                      </div>
                                    ) : isCameraConnecting ? (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/30">
                                        {seat.avatarUrl ? (
                                          <img src={seat.avatarUrl} alt={participantDisplayName} className="h-full w-full rounded-full object-cover shadow-[0_0_18px_rgba(16,185,129,0.28)]" />
                                        ) : (
                                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300/40 border-t-emerald-300" />
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-300/30 bg-transparent">
                                        <Users className="h-4 w-4 text-purple-200/80" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                                    <span className="truncate text-[10px] font-black text-white">{participantDisplayName}</span>
                                    {(seatParticipantMetadata as any)?.is_broadcaster && (
                                      <span className="rounded-full border border-amber-400/30 bg-amber-500/15 p-0.5 text-amber-300">
                                        <Crown className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                    {(seatParticipantMetadata as any)?.level && (
                                      <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1 py-0.5 text-[8px] font-black text-cyan-200">
                                        Lv{(seatParticipantMetadata as any).level}
                                      </span>
                                    )}
                                  </div>

                                  <div className={cn(
                                    'mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
                                    matchedParticipant
                                      ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                      : isCameraUnavailable
                                        ? 'border-red-300/30 bg-red-500/10 text-red-200'
                                        : isCameraConnecting
                                          ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200'
                                          : 'border-purple-300/30 bg-purple-500/10 text-purple-200'
                                  )}>
                                    {matchedParticipant ? 'On Camera' : isCameraUnavailable ? 'Camera unavailable' : isCameraConnecting ? 'Connecting...' : seat.seatPrice > 0 ? `${seat.seatPrice} coins` : 'Free'}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-1 flex-col items-center justify-center p-2 pt-8">
                                  <UserPlus className="h-5 w-5 text-cyan-300/40" />
                                  <span className="mt-1 text-[9px] font-black uppercase tracking-wider text-cyan-200/70">
                                    Invite Guest
                                  </span>
                                </div>
                              )}

                              <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-2 py-1.5">
                                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-black text-white/90 backdrop-blur-sm">
                                  S{seat.seatIndex}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  {stream?.are_seats_locked && (
                                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 p-0.5 text-amber-300">
                                      <Lock className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                  {seat.isOccupied && (
                                    <>
                                      {matchedParticipant ? (
                                        <span className={cn(
                                          'rounded-full border p-0.5',
                                          getAudioTrackFromRemoteParticipant(matchedParticipant) ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                                        )}>
                                          {getAudioTrackFromRemoteParticipant(matchedParticipant) ? <Mic className="h-2.5 w-2.5" /> : <MicOff className="h-2.5 w-2.5" />}
                                        </span>
                                      ) : (
                                        <span className={cn(
                                          'rounded-full border p-0.5',
                                          isCameraConnecting ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/5 text-white/40'
                                        )}>
                                          {isCameraConnecting ? <Mic className="h-2.5 w-2.5" /> : <MicOff className="h-2.5 w-2.5" />}
                                        </span>
                                      )}
                                      {matchedParticipant && (
                                        <span className="rounded-full border border-white/10 bg-white/5 p-0.5 text-white/60">
                                          <Wifi className="h-2.5 w-2.5" />
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                              {seat.isOccupied && seat.seatUserId && (
                                <div className="relative z-10 px-2 pb-2">
                                  <SeatCityStatusOrb
                                    userId={seat.seatUserId}
                                    broadcasterId={user?.id}
                                    isBroadOfficer={isOfficer}
                                    onClick={() => setSelectedSeatUserId(seat.seatUserId)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mic / Camera status pills - top right */}
                <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5">
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-md',
                    micEnabled ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                  )}>
                    {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                  </span>
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border backdrop-blur-md',
                    cameraEnabled ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-red-400/30 bg-red-500/15 text-red-300'
                  )}>
                    {cameraEnabled ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                  </span>
                </div>

                 {/* MOBILE: Audience ticker with viewer count + collaboration controls */}
                 {isMobileHost && stream && (
                   <div className="mobile-audience-ticker absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-3 pt-[44px]">
                     <div className="pointer-events-auto flex-1 rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 px-2 py-1.5 backdrop-blur-sm shadow-[0_2px_24px_0_rgba(34,211,238,0.10)]">
                         <MobileAudienceTicker
                           audience={audienceWithAnon}
                           currentUserId={user?.id}
                           hostUserId={stream?.user_id || stream?.broadcaster_id || undefined}
                           viewerCount={liveViewerCount}
                           likes={streamLayoutStats.likes}
                           maxVisible={6}
                           onModerateUser={handleOpenUserAction}
                           onViewerCountClick={onActiveViewersClick}
                         />
                    </div>
                     <div className="pointer-events-auto relative mt-0.5 flex flex-col gap-2">
                       <CollaborateButton compact onClick={() => setShowCollaborationModal(true)} />
                       <button
                         onClick={() => setShowCameraOffImageModal(true)}
                         className="h-10 w-10 flex items-center justify-center rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 transition-all"
                         title="Camera off image"
                       >
                         <ImageIcon size={18} />
                       </button>
                     </div>
                  </div>
                )}

                {/* Settings button - bottom right */}
                <div className="absolute bottom-4 right-3 z-50 flex flex-col items-end gap-2">
                  <MobileBroadcastHostSettings
                    isMicOn={micEnabled}
                    isCamOn={cameraEnabled}
                    isLive={stream?.status === 'live'}
                    hasRgbEffect={!!stream?.has_rgb_effect}
                    isChatLocked={!!stream?.is_chat_locked}
                    seatCount={Number(stream?.seat_count ?? 0)}
                    unreadMessageCount={0}
                    onToggleMic={toggleMicrophone}
                    onToggleCamera={toggleCamera}
                    onFlipCamera={() => {
                      // Flip camera is handled by the local tracks
                      if (localTracks?.[1]) {
                        // Toggle front/back camera
                        const currentFacing = (localTracks[1] as any)?.mediaStreamTrack?.getSettings?.()?.facingMode;
                        // Re-create tracks with opposite facing mode would require more complex logic
                        // For now, this is a placeholder
                      }
                    }}
                    onGift={handleGiftHost}
                    onShare={handleOpenShareModal}
                      onOpenMessage={() => setIsMessagePopupOpen(true)}
                     onEndStream={handleStreamEnd}
                     onOpenCoinStore={user?.id ? handleOpenCoinStore : () => {}}
                     onInviteFollowers={handleInviteFollowers}
                     onToggleRGB={toggleStreamRgb}
                     onTextPopup={() => {
                       setIsTextPopupComposerOpen(true);
                     }}
                     onAssignOfficer={() => setIsAssignOfficerModalOpen(true)}
                     onPayOfficers={() => setIsPayBroadOfficersModalOpen(true)}
                      onToggleChatLock={handleToggleChatLock}
                    />
                </div>

               {/* -- BOTTOM CONTROL BAR (desktop only) -- */}
               {!isMobileHost && <BroadcastBottomBar
                 unreadMessageCount={0}
                 isMicOn={micEnabled}
                 isCamOn={cameraEnabled}
                  isLive={stream?.status === 'live'}
                   liveViewerCount={liveViewerCount}
                 isGiftTrayOpen={isGiftModalOpen}
                 isOfficerModalOpen={false}
                 onToggleMic={toggleMicrophone}
                 onToggleCam={toggleCamera}
                 onGift={handleGiftHost}
                 onShare={handleOpenShareModal}
                 onOpenMessage={() => setIsMessagePopupOpen(true)}
                 onOpenMoreMenu={handleOpenMoreMenu}
                 onEndStream={handleStreamEnd}
                 onOpenCoinStore={user?.id ? handleOpenCoinStore : undefined}
                 isHost={isHost}
                 onInviteFollowers={handleInviteFollowers}
                 isEnding={isEnding}
                />}
              </>
             )}

               {!isMobileHost && (
                 <div className="absolute right-4 top-4 z-[40]">
                   <CollaborateButton onClick={() => setShowCollaborationModal(true)} />
                 </div>
               )}

               {/* Games Button */}
               {isHost && (
                 <div className="absolute bottom-4 left-4 z-50">
                   <button
                     onClick={() => setIsAuctionMeOpen(true)}
                     className="flex items-center gap-2 bg-gradient-to-r from-neon-blue to-neon-purple px-4 py-2 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity shadow-lg"
                   >
                     <Gamepad2 className="w-4 h-4" />
                     Games
                   </button>
                 </div>
               )}

               {/* Auction Me Panel */}
               {isAuctionMeOpen && streamId && (
                 <AuctionMePanel
                   streamId={streamId}
                   onClose={() => setIsAuctionMeOpen(false)}
                 />
               )}

              {/* Celeb Stream Toolbar — only for hosts of celeb_stream */}
              {isCelebStream && isHost && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900/80 border border-yellow-500/30 rounded-xl px-3 py-2 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                  <button
                    type="button"
                    onClick={() => window.open(`/celeb/dashboard/products`, '_blank')}
                    className="flex items-center gap-1.5 text-xs font-medium text-yellow-300 hover:text-yellow-200 hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <ShoppingBag size={14} />
                    Products
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`/celeb/dashboard/earnings`, '_blank')}
                    className="flex items-center gap-1.5 text-xs font-medium text-yellow-300 hover:text-yellow-200 hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <BarChart3 size={14} />
                    Earnings
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`/celeb/moderation/${streamId}`, '_blank')}
                    className="flex items-center gap-1.5 text-xs font-medium text-yellow-300 hover:text-yellow-200 hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <Shield size={14} />
                    Moderate
                  </button>
                </div>
              )}


          

            {/* View mode toggle � desktop */}


            {/* View mode toggle � mobile */}
            {isMobileViewer && (
              <div className="absolute bottom-3 left-3 z-50">
                <button
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className="rounded-md bg-black/40 backdrop-blur border border-white/10 flex items-center gap-1 px-1.5 py-1 text-white/70 hover:text-white transition-all"
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                  aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[10px] font-bold">{isChatOpen ? 'Close' : 'Chat'}</span>
                </button>
              </div>
            )}

            {/* View mode toggle � mobile host */}
            {isMobileHost && (
              <div className="absolute bottom-3 left-3 z-50">
                <button
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className="rounded-md bg-black/40 backdrop-blur border border-white/10 flex items-center gap-1 px-1.5 py-1 text-white/70 hover:text-white transition-all"
                  title={isChatOpen ? 'Close Chat' : 'Open Chat'}
                  aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[10px] font-bold">{isChatOpen ? 'Close' : 'Chat'}</span>
                </button>
              </div>
            )}
          </div>

            {/* OVERLAYS � absolutely positioned, renders above all grid content */}
            <div className="absolute inset-0 pointer-events-none">
              {isGiftModalOpen && (
                <div className="pointer-events-auto">
                  <GiftBoxModal
                    isOpen={isGiftModalOpen}
                    onClose={handleCloseGiftModal}
                    streamId={streamId}
                    recipientId={giftRecipientId}
                  />
                </div>
              )}

            </div>
              <GiftAnimationLayer streamId={streamId} recipientUserId={stream?.user_id || ''} recipientType="broadcaster" className="" />

              {/* Feed the Troll — persistent companion for the broadcaster's troll */}
              {stream?.user_id && (
                <FeedTheTroll
                  broadcasterId={stream.user_id}
                  streamId={streamId}
                  compact={isMobileHost}
                  positionKey="broadcast"
                />
              )}
              
              {/* Ghost mode audio tracks - hidden audio elements for ghost participants whose audio must be heard */}
              {ghostAudioParticipants.map((participant: any) => {
                const identity = participant.identity
                return <GhostAudioTrack key={`ghost-audio-${identity}`} participant={participant} />
              })}
               {/* Stage pass requests panel for broadcasters - TEMPORARILY DISABLED */}
                   {/* <StagePassRequestsPanel
                     onApprove={(id) => void approveStagePass(id)}
                     onDeny={(id) => void denyStagePass(id)}
                   /> */}
              {isShareModalOpen && (
                <div className="pointer-events-auto">
                <ShareModal
                  isOpen={isShareModalOpen}
                  onClose={handleCloseShareModal}
                  streamTitle={stream?.title || 'Untitled Stream'}
                  streamUrl={broadcasterProfile?.username ? `${window.location.origin}/live/${encodeURIComponent(broadcasterProfile.username)}` : window.location.origin}
                  broadcasterName={(broadcasterProfile && broadcasterProfile.username) || 'someone'}
                />
                </div>
              )}
              {isSeatsModalOpen && (
                <div className="pointer-events-auto fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-xl">
                  <div className="relative w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-[32px] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_42%),rgba(2,6,23,0.96)] text-white shadow-[0_0_55px_rgba(34,211,238,0.22)]">
                    <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
                      <button
                        type="button"
                        onClick={handleCloseSeatsModal}
                        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:border-rose-300/35 hover:bg-rose-500/15 hover:text-white"
                        aria-label="Close manage seats"
                      >
                        <X className="h-5 w-5" />
                      </button>

                      <div className="pr-12">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                          <Users className="h-4 w-4" />
                          Manage Seats
                        </div>
                        <h2 className="mt-4 text-2xl font-black tracking-tight">Broadcast seat controls</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          Toggle how many viewer seats appear beside the host box, then tap any live seat to assign its price. Your changes save instantly when you hit Save Seat Layout.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                        <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/75">Viewer Seats</p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSeatModalCount((value) => Math.max(0, value - 1))}
                              className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-300/30 bg-rose-500/15 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.18)] transition hover:bg-rose-500/25"
                              aria-label="Deduct one seat"
                            >
                              <Minus className="h-6 w-6" />
                            </button>
                            <div className="text-center">
                               <div className="text-5xl font-black text-white">{seatModalCount}</div>
                               <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Max {6}</div>
                            </div>
                            <button
                              type="button"
                               onClick={() => setSeatModalCount((value) => Math.min(6, value + 1))}
                              className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/35 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-500/25"
                              aria-label="Add one seat"
                            >
                              <Plus className="h-6 w-6" />
                            </button>
                          </div>
                          <p className="mt-4 text-sm leading-relaxed text-slate-300">
                            Every active seat slot below can be tapped to set an individual price. Inactive slots are hidden until you increase the count.
                          </p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-200/75">Seat editor</p>
                              <p className="mt-2 text-sm text-slate-200">
                                {seatModalCount > 0 ? 'Tap a seat to edit its price.' : 'Add a seat to start assigning prices.'}
                              </p>
                            </div>
                            <div className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                              {seatModalCount > 0 ? `Seat ${selectedSeatIndex + 1}` : 'No seats'}
                            </div>
                          </div>

                           <div className="mt-4 grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                             {Array.from({ length: 6 }, (_, index) => {
                               const active = index < seatModalCount
                               const selected = index === selectedSeatIndex
                               const price = seatModalPrices[index]
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  disabled={!active}
                                  onClick={() => active && setSelectedSeatIndex(index)}
                                  className={cn(
                                    'flex h-20 flex-col justify-center rounded-2xl border px-3 text-left transition',
                                    active
                                      ? selected
                                        ? 'border-cyan-300/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                                        : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-50'
                                      : 'border-white/10 bg-white/[0.03] text-white/20 cursor-not-allowed'
                                  )}
                                >
                                  <span className="text-[11px] font-black uppercase tracking-[0.18em]">Seat {index + 1}</span>
                                  <span className="mt-2 text-lg font-black">{active ? `${price === '' ? 0 : price} coins` : 'Hidden'}</span>
                                </button>
                              )
                            })}
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Selected seat price</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleSeatPriceStep(selectedSeatIndex, -10)}
                                disabled={seatModalCount <= 0}
                                className="grid h-11 w-11 place-items-center rounded-xl border border-rose-300/30 bg-rose-500/15 text-rose-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/20"
                                aria-label={`Subtract 10 from seat ${selectedSeatIndex + 1}`}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <div className="flex min-w-[140px] items-center gap-2 rounded-2xl border border-purple-300/25 bg-black/35 px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={seatModalCount > 0 ? (seatModalPrices[selectedSeatIndex] ?? '') : ''}
                                  onChange={(event) => handleSeatPriceInput(selectedSeatIndex, event.target.value)}
                                  disabled={seatModalCount <= 0}
                                  className="w-full bg-transparent text-lg font-black text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed disabled:text-white/20"
                                  aria-label={`Price for seat ${selectedSeatIndex + 1}`}
                                />
                                <span className="text-sm font-bold text-white/60">coins</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSeatPriceStep(selectedSeatIndex, 10)}
                                disabled={seatModalCount <= 0}
                                className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 text-cyan-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/20"
                                aria-label={`Add 10 to seat ${selectedSeatIndex + 1}`}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-slate-300">
                              Use the plus or minus buttons or type a number directly to set the exact price for the selected seat.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleCloseSeatsModal}
                          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplySeatConfiguration(seatModalCount, seatModalPrices)}
                          className="h-12 rounded-2xl border border-cyan-300/35 bg-gradient-to-r from-cyan-500 to-purple-600 px-6 text-sm font-black text-white shadow-[0_0_22px_rgba(34,211,238,0.28)] transition hover:scale-[1.01]"
                        >
                          Save Seat Layout
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isPinProductModalOpen && (
                <div className="pointer-events-auto">
                <PinProductModal
                  isOpen={isPinProductModalOpen}
                  onClose={handleClosePinProductModal}
                  onProductPinned={async (productId) => {
                    const result = await pinProduct(productId);
                    if (!result.success) {
                      toast.error('Failed to pin product');
                    }
                  }}
                />
                </div>
              )}

              {/* User Action Modal (for gifts, mod actions, etc.) */}
              {userActionTarget && (
                 showModActionMenu ? (
                   <ModActionsPopup
                     isOpen={true}
                     onClose={handleCloseUserAction}
                     targetUser={{
                       id: userActionTarget.userId,
                       username: userActionTarget.username || '',
                       avatar_url: userProfiles?.[userActionTarget.userId]?.avatar_url || '',
                       role: userActionTarget.role,
                     } as any}
                     targetUsername={userActionTarget.username || ''}
                     targetUserId={userActionTarget.userId}
                     streamId={streamId || ''}
                     hostId={stream?.user_id || ''}
                      currentUserId={user?.id}
                    />
                ) : (
                <div className="pointer-events-auto">
                <UserActionModal
                  streamId={streamId}
                  onClose={handleCloseUserAction}
                  userId={userActionTarget.userId}
                  username={userActionTarget.username}
                  role={userActionTarget.role}
                  createdAt={userActionTarget.createdAt}
                  isHost={isHost}
                  isModerator={isOfficer || isCurrentUserBroadofficer}
                  isOfficer={isOfficer}
                  onGift={() => onGift(userActionTarget.userId)}
                  onKickStage={() => handleGeneralKick()}
                />
                </div>
                )
              )}

              {/* Broadcaster Stats Modal */}
              {showHostStats && isHost && (
                <div className="pointer-events-auto">
                <BroadcasterStatsModal
                  stream={stream}
                  onClose={handleCloseHostStats}
                  broadcasterProfile={broadcasterProfile}
                  isCameraOn={cameraEnabled}
                  isMicOn={micEnabled}
                  onToggleCamera={toggleCamera}
                  onToggleMic={toggleMicrophone}
                  onFlipCamera={flipCamera}
                  cameraFacingMode={cameraFacingMode}
                />
                </div>
              )}

              {/* City Status Panel for broadcaster orb / seat clicks via showUserStats */}
              {showUserStats && (
                <CityStatusPanel
                  userId={showUserStats.userId}
                  onClose={handleCloseUserStats}
                  isBroadcaster={true}
                  isSeatHolder={showUserStats.isSeatUser}
                  broadcasterId={user?.id}
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

              {/* City Status Panel for seat clicks via selectedSeatUserId */}
              {selectedSeatUserId && (
                <CityStatusPanel
                  userId={selectedSeatUserId}
                  onClose={() => setSelectedSeatUserId(null)}
                  isBroadcaster={isHost}
                  isBroadOfficer={isOfficer}
                  isSeatHolder={true}
                  broadcasterId={user?.id}
                  onHouseClick={() => {
                    const seatUser = broadcasterCityStatus.data;
                    if (seatUser?.house_id && seatUser.id !== user?.id) {
                      setRaidTarget({ userId: seatUser.id, houseId: seatUser.house_id });
                    }
                  }}
                  onRaid={() => {
                    const seatUser = broadcasterCityStatus.data;
                    if (seatUser?.house_id && seatUser.id !== user?.id) {
                      setRaidTarget({ userId: seatUser.id, houseId: seatUser.house_id });
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

              {/* Broadcast Raid Modal */}
              {broadcastRaidTarget && broadcasterCityStatus.data && (
                <RaidModal
                  isOpen={!!broadcastRaidTarget}
                  onClose={() => setBroadcastRaidTarget(null)}
                  targetUserId={broadcastRaidTarget}
                  targetUsername={broadcasterCityStatus.data.username}
                  targetAvatarUrl={broadcasterCityStatus.data.avatar_url}
                  streamId={streamId || stream.id}
                  mode={broadcasterCityStatus.data.recentlyRaided ? 'repair' : 'raid'}
                  onRaidComplete={() => {
                    broadcasterCityStatus.refetch?.();
                  }}
                />
              )}

              {/* Coin Store Modal */}
              {isCoinStoreOpen && (
                <div className="pointer-events-auto">
                <CoinStoreModal
                  isOpen={isCoinStoreOpen}
                  onClose={handleCloseCoinStore}
                  allowCardPayment={false}
                />
                </div>
              )}

              {/* Ability Box Modal */}
              {isAbilityBoxOpen && (
                <div className="pointer-events-auto">
                <AbilityBox
                  isOpen={isAbilityBoxOpen}
                  onClose={handleCloseAbilityBox}
                  abilities={userAbilities}
                  activeEffects={abilityActiveEffects}
                  loading={abilityLoading}
                  onActivate={activateAbility}
                  isEffectActive={isEffectActive}
                  getCooldownRemaining={getCooldownRemaining}
                  getEffectRemaining={getEffectRemaining}
                  isInBroadcast={canPublish}
                />
                </div>
              )}

              {/* Broadcast Ability Effects */}
              <BroadcastAbilityEffects
                activeEffects={abilityActiveEffects}
              />

              {/* More Controls Drawer */}
              {isMoreControlsOpen && (
                <div className="pointer-events-auto">
                  <MoreControlsDrawer
                    isOpen={isMoreControlsOpen}
                    onClose={handleCloseMoreMenu}
                    isMuted={!micEnabled}
                    isCameraOff={!cameraEnabled}
                    onToggleMic={toggleMicrophone}
                    onToggleCamera={toggleCamera}
                    onFlipCamera={flipCamera}
                    onLeave={handleLeave}
                    isHost={isHost}
                    isOfficer={isOfficer}
                    onGift={handleGiftHost}
                    onShare={handleOpenShareModal}
                    onEndStream={handleStreamEnd}
                    isChatLocked={!!stream?.is_chat_locked}
                     onToggleChatLock={handleToggleChatLock}
                     unreadMessageCount={0}
                    onAssignBroadofficer={handleAssignBroadofficer}
                    onPayBroadOfficers={handlePayBroadOfficers}
                     onMuteUser={handleMute}
                     onDisableChat={handleDisableChat}
                     onBanUser={handleBlock}
                     onRemoveFromStage={handleGeneralKick}
                     onModGift={handleGiftHost}
                     userActionUserId={userActionTarget?.userId}
                    onToggleRGB={toggleStreamRgb}
                    hasRgbEffect={!!stream?.has_rgb_effect}
                     onTextPopup={() => {
                       handleCloseMoreMenu()
                       setIsTextPopupComposerOpen(true)
                     }}
                     onPaidChat={() => {
                       handleCloseMoreMenu()
                       setIsPaidChatModalOpen(true)
                     }}
                     onOpenSeatsModal={handleOpenSeatsModal}
                    />
                </div>
              )}

              {isAssignOfficerModalOpen && stream?.id && stream?.user_id && (
                <BroadcastOfficerModal
                  streamId={stream.id}
                  broadcasterId={stream.user_id}
                  isOpen={isAssignOfficerModalOpen}
                  onClose={() => setIsAssignOfficerModalOpen(false)}
                  onPayAll={handlePayBroadOfficers}
                />
              )}

              <CollaborationModal
                open={showCollaborationModal}
                onClose={() => setShowCollaborationModal(false)}
                broadcasters={collaboration.activeBroadcasters}
                loading={collaboration.loading}
                onRequest={async (broadcaster) => {
                  const result = await collaboration.sendRequest(broadcaster)
                  if (result.ok) {
                    await collaboration.refreshBroadcasters()
                  }
                  return result
                }}
              />

              <CameraOffImageModal
                isOpen={showCameraOffImageModal}
                onClose={() => setShowCameraOffImageModal(false)}
                userId={user?.id}
                currentImageUrl={broadcasterProfile?.camera_off_image_url}
                onImageUpdated={(url) => {
                  if (broadcasterProfile) {
                    setBroadcasterProfile({ ...broadcasterProfile, camera_off_image_url: url })
                  }
                }}
              />

              <CollaborationRequestNotification
                request={collaboration.incomingRequests[0] || null}
                onAccept={async (request) => {
                  await collaboration.acceptRequest(request)
                  setShowCollaborationModal(false)
                }}
                onDecline={async (request) => {
                  await collaboration.declineRequest(request)
                }}
              />

              {isPayBroadOfficersModalOpen && stream?.id && stream?.user_id && (
                <PayBroadOfficersModal
                  isOpen={isPayBroadOfficersModalOpen}
                  onClose={() => setIsPayBroadOfficersModalOpen(false)}
                  broadcasterId={stream.user_id}
                  broadcasterBalance={broadcasterProfile?.troll_coins ?? 0}
                  streamId={stream.id}
                />
              )}

              {/* Broadcast Text Popup Composer */}
              {isHost && (
                <BroadcastTextPopupComposer
                  open={isTextPopupComposerOpen}
                  onOpenChange={setIsTextPopupComposerOpen}
                  onSend={sendTextPopup}
                  sending={sendingTextPopup}
                />
              )}

               {/* Broadcast Text Popup Overlay (visible to broadcaster too) */}
               <BroadcastTextPopupOverlay
                 popup={activeTextPopup}
                 isBattleActive={shouldShowRandomBattleArena}
                 mobileSafe={isMobileWidth}
               />

                {/* Paid Chat Settings Modal */}
                {isPaidChatModalOpen && stream?.id && (
                  <PaidChatSettingsModal
                    isOpen={isPaidChatModalOpen}
                    onClose={() => setIsPaidChatModalOpen(false)}
                    streamId={stream.id}
                    isHost={isHost}
                    onSave={() => {
                      setIsPaidChatModalOpen(false);
                    }}
                    streamCategory={stream.category}
                  />
                )}

              {/* Mobile host chat bottom sheet */}
              {isMobileHost && isChatOpen && (
                 <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-black/95 backdrop-blur-sm border-t border-white/10 rounded-t-2xl"
                  style={{ maxHeight: '60vh' }}>
                  <div className="flex items-center justify-between p-3 border-b border-white/10">
                    <span className="text-sm font-bold text-white">Chat</span>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className="p-1 text-white/60 hover:text-white transition-colors"
                      aria-label="Close chat"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
                    {floatingMessages.length === 0 && (
                      <div className="flex h-full items-center justify-center text-white/25 text-sm font-bold">
                        No messages yet — say something!
                      </div>
                    )}
                    {floatingMessages.slice(0, 50).map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="text-sm leading-relaxed break-words animate-in fade-in duration-200"
                        style={{ animationDelay: `${idx * 120}ms` }}
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
                    ))}
                  </div>
                  <div
                    className="border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                    style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 12px)` }}
                  >
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const text = chatInput.trim()
                        if (!text) return
                        if (userChatDisabled) {
                          toast.error(
                            chatDisabledRemainingMinutes
                              ? `Your chat is disabled by moderation action. Try again in ${chatDisabledRemainingMinutes} minute(s).`
                              : 'Your chat is disabled by moderation action.'
                          )
                          return
                        }
                        if (hostChatDisabledByOfficer) {
                          toast.error(
                            hostChatDisableRemainingMs
                              ? `Chat is disabled by officer control. Try again in ${Math.ceil(hostChatDisableRemainingMs / 60000)} minute(s).`
                              : 'Chat is disabled by officer control'
                          )
                          return
                        }
                        const username = profile?.username || user?.email?.split('@')?.[0] || getAnonymousDisplayName()
                        const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                         setFloatingMessages(prev => [{ id: msgId, username, content: text, createdAt: Date.now() }, ...prev].slice(-50))
                         recentChatKeysRef.current.set(`${username}:${text}`, Date.now())
                         setChatInput('')
                         trackedTimeout(() => {
                           setFloatingMessages(prev => prev.filter(m => m.id !== msgId))
                         }, 3000)
                          try {
                            const result = await sendChatThroughGate({ streamId, content: text })
                            if (result.ok) {
                              const chatChannel = floatingChatChannelRef.current
                              if (chatChannel) {
                                chatChannel.send({
                                  type: 'broadcast',
                                  event: 'floating_chat',
                                  payload: { username, content: text, user_id: user?.id },
                                  }).catch(() => {})
                                }
                              }
                            } catch (err) {
                              console.warn('[BroadcastPage] send-message failed:', err)
                            }
                         }}
                         className="mt-auto border-t border-white/10 bg-black/15 px-3 py-2 backdrop-blur-md"
                       >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={
                          userChatDisabled
                            ? 'Chat disabled by moderation'
                            : hostChatDisabledByOfficer
                              ? 'Chat disabled by officer control'
                              : 'Say something…'
                        }
                        disabled={userChatDisabled || hostChatDisabledByOfficer}
                        readOnly={userChatDisabled || hostChatDisabledByOfficer}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        maxLength={280}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || userChatDisabled || hostChatDisabledByOfficer}
                        className={cn(
                          'inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50',
                          chatInput.trim() && !hostChatDisabledByOfficer
                            ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-300'
                            : 'border border-white/10 bg-white/5 text-white/30'
                        )}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              )}

          </ErrorBoundary>

           <AnimatePresence>
             {isMessagePopupOpen && (
               <motion.div
                 ref={messagePopupRef}
                 initial={{ opacity: 0, scale: 0.95, y: 20 }}
                 animate={{ 
                   opacity: 1, 
                   scale: 1, 
                   y: 0,
                   x: messagePopupPosition?.x || 0,
                   top: messagePopupPosition?.y || undefined,
                 }}
                 exit={{ opacity: 0, scale: 0.95, y: 20 }}
                 onMouseDown={handleMessagePopupMouseDown}
                 className="fixed z-[60] w-[360px] max-h-[480px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl max-md:right-2 max-md:left-2 max-md:w-auto max-md:bottom-[100px]"
                 style={{
                   right: messagePopupPosition ? undefined : '1rem',
                   bottom: messagePopupPosition ? undefined : '5rem',
                   cursor: isDraggingMessagePopup ? 'grabbing' : 'grab',
                 }}
               >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white">Messages</h3>
                    {!selectedThread && (
                      <button
                        onClick={() => setIsNewMessageMode(!isNewMessageMode)}
                        className="rounded-lg bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/30"
                      >
                        New
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setIsMessagePopupOpen(false); setSelectedThread(null); setIsNewMessageMode(false) }}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {!selectedThread ? (
                    <div className="p-2">
                      {isNewMessageMode ? (
                        <div>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search users..."
                            className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-cyan-400/30 focus:outline-none"
                          />
                          {searchResults.length === 0 ? (
                            <div className="py-4 text-center text-xs text-zinc-500">No users found</div>
                          ) : (
                            searchResults.map((u: any) => (
                              <button
                                key={u.id}
                                onClick={async () => {
                                  try {
                                    const thread = await findOrCreateDirectThread(user.id, u.id)
                                    setSelectedThread(thread)
                                    setIsNewMessageMode(false)
                                    setSearchQuery('')
                                    setSearchResults([])
                                  } catch (err) {
                                    console.error('[BroadcastPage] create thread error:', err)
                                    toast.error('Failed to start conversation')
                                  }
                                }}
                                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                                  <MessageSquare className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-white">{u.username || u.display_name || 'User'}</p>
                                  <p className="truncate text-xs text-zinc-400">{u.utromail_address}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      ) : recentThreads.length === 0 ? (
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
                            console.error('[BroadcastPage] send message error:', err)
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

          {isCashoutModalOpen && (
            <MiniMaiPayCashoutModal
              isOpen={isCashoutModalOpen}
              onClose={() => setIsCashoutModalOpen(false)}
              currentBalance={cashoutBanner.currentBalance}
              onSuccess={() => cashoutBanner.refreshBalance()}
              isMobile={isMobileHost}
            />
          )}
          <BroadcasterControlsModal
            isOpen={isBroadcasterControlsOpen}
            onClose={() => setIsBroadcasterControlsOpen(false)}
            isMicOn={micEnabled}
            isCamOn={cameraEnabled}
            isLive={stream?.status === 'live'}
            liveViewerCount={liveViewerCount}
            isHost={isHost}
            onToggleMic={toggleMicrophone}
            onToggleCam={toggleCamera}
            onGift={handleGiftHost}
            onShare={handleOpenShareModal}
            onOpenMessage={() => { setIsBroadcasterControlsOpen(false); setIsMessagePopupOpen(true) }}
            onOpenMoreMenu={handleOpenMoreMenu}
            onEndStream={handleStreamEnd}
            onInviteFollowers={handleInviteFollowers}
            onOpenCoinStore={user?.id ? handleOpenCoinStore : undefined}
           />
            {showViewerList && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowViewerList(false)}>
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-black text-white">Active Viewers</h3>
                    <button onClick={() => setShowViewerList(false)} className="rounded-lg p-1 text-zinc-400 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                   {(() => {
                     const viewers = audience.length > 0
                       ? audience
                       : activeViewerProfiles.length > 0
                          ? activeViewerProfiles.map(v => ({
                              id: v.user_id,
                              user_id: v.user_id,
                              username: v.username,
                              avatar_url: v.avatar_url,
                              role: v.role || 'audience',
                              gift_total: 0,
                              is_active: true,
                              left_at: null,
                            }))
                         : activeAudienceWithAnon

                     const activeViewers = viewers.filter(m => m.is_active && !m.left_at)

                     if (import.meta.env.DEV) {
                       console.log('[BroadcastPage][ActiveViewersModal]', {
                         audienceLength: audience.length,
                         activeViewerProfilesLength: activeViewerProfiles.length,
                         activeAudienceWithAnonLength: activeAudienceWithAnon.length,
                         viewersSource: audience.length > 0 ? 'audience' : activeViewerProfiles.length > 0 ? 'activeViewerProfiles' : 'activeAudienceWithAnon',
                         activeViewersCount: activeViewers.length,
                         sample: activeViewers.slice(0, 3).map(m => ({
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

                     if (activeViewers.length === 0) {
                       return <p className="text-sm text-zinc-500">No active viewers</p>
                     }

                     return activeViewers.map(member => {
                      const coins = member.gift_total ?? 0
                      const coinLabel = coins >= 1_000_000
                        ? `${(coins / 1_000_000).toFixed(1)}M Coins`
                        : coins >= 1_000
                          ? `${(coins / 1_000).toFixed(1)}K Coins`
                          : `${coins} Coins`
                      return (
                        <div key={member.id || member.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
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
                  })()}
                </div>
              </div>
            )}
         </GiftSystemProvider>
         <RoleInviteHandler />
      </>
    );
    }

function isStaffProfile(profile: any) {
  if (!profile) return false
  return isStaffUser(profile)
}

/**
 * TrackAttach
 *
 * Inline LiveKit video renderer for the host camera card.
 * Attaches the video element to a permanent div via `track.attach()` in a useEffect.
 * Mirrors spin-off from BroadcastGrid.tsx LiveKitVideoPlayer for minimal standalone use.
 */
const TrackAttach = React.memo(function TrackAttach({ track }: { track: LocalVideoTrack | RemoteVideoTrack | null }) {
  const divRef = React.useRef<HTMLDivElement>(null);
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  const hadTrackRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    // If track is absent, detach and clear
    if (!track) {
      hadTrackRef.current = false;
      if (videoElRef.current) {
        try { (videoElRef.current as any).srcObject = null; } catch { /* ignore */ }
        videoElRef.current = null;
      }
      div.innerHTML = '';
      return;
    }

    const wasPresent = hadTrackRef.current;
    hadTrackRef.current = true;

    const previousTrackId = (videoElRef.current?.srcObject as any)?.mediaStreamTrack?.id || (videoElRef.current?.srcObject as any)?.id || null;
    const nextTrackId = (track as any)?.mediaStreamTrack?.id || (track as any)?.sid || null;

    if (wasPresent && previousTrackId && nextTrackId && previousTrackId === nextTrackId) {
      return;
    }

    let cancelled = false;
    const doAttach = () => {
      if (cancelled) return;
      try {
        const el = (track as any).attach();
        if (!el || !(el instanceof HTMLVideoElement)) return;
        el.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;position:absolute;top:0;left:0;display:block;background:#000;';
        // Un-mirror local front-facing camera so broadcaster sees natural movement
        el.style.transform = track instanceof LocalVideoTrack ? 'scaleX(-1)' : 'none';
        el.autoplay = true;
        el.muted = true;
        el.play?.().catch(() => {});
        if (videoElRef.current && videoElRef.current !== el) {
          try { track.detach(videoElRef.current); } catch { /* ignore */ }
        }
        videoElRef.current = el;
        div.innerHTML = '';
        div.appendChild(el);
      } catch (err) {

        setTimeout(doAttach, 100);
      }
    };

    doAttach();

    return () => {
      cancelled = true;
      if (videoElRef.current && track) {
        try { track.detach(videoElRef.current); } catch { /* ignore */ }
        videoElRef.current = null;
      }
    };
  }, [track]);

  if (!track) return null;

  return (
    <div
      ref={divRef}
      className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
    />
  );
})
