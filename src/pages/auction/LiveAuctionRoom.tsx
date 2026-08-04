import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  EyeOff,
  Flag,
  Gavel,
  Heart,
  Loader2,
  Lock,
  Maximize2,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Package,
  Send,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Trophy,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useAuctionTimer } from '../../hooks/useAuctionTimer'
import { useAnonymousRound } from '../../hooks/useAnonymousRound'
import { useBoostBid } from '../../hooks/useBoostBid'
import { usePredictionBid } from '../../hooks/usePredictionBid'
import ShareModal from '../../components/broadcast/ShareModal'
import ReportModal from '../../components/report/ReportModal'

type AuctionShowStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
type AuctionLotStatus =
  | 'draft'
  | 'upcoming'
  | 'queued'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'show'
  | 'up'
  | 'down'
  | 'pass'
  | 'sold'
  | 'unsold'
  | 'cancelled'
  | 'ended'
  | 'removed'
  | 'remove'

interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: AuctionShowStatus
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
}

interface AuctionLot {
  id: string
  auction_show_id: string
  title: string
  description?: string | null
  image_url?: string | null
  starting_bid: number
  bid_increment: number
  current_highest_bid?: number | null
  current_highest_bidder_id?: string | null
  status: AuctionLotStatus
  countdown_end_at?: string | null
  order_index?: number | null
  queue_position?: number | null
  reserve_price?: number | null
  buy_now_price?: number | null
  condition?: string | null
  quantity?: number | null
}

interface AuctionBid {
  id: string
  lot_id?: string | null
  bidder_id: string
  bid_amount: number
  created_at: string
  bidder?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

interface UserProfile {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  troll_coins: number
  role?: string | null
  is_admin?: boolean | null
  is_superadmin?: boolean | null
}

interface LiveAuctionStateRpc {
  current_lot?: AuctionLot | null
  recent_bids?: AuctionBid[]
  viewer_count?: number
}

interface PlaceBidResult {
  accepted?: boolean
  reason?: string
  bid_id?: string
  new_highest_bid?: number
}

  const MIN_COINS_TO_BID = 0
  const GLOBAL_AGORA_JOIN_LOCKS = new Set<string>()

const CATEGORY_CHIPS = [
  'All',
  'Collectibles',
  'Trading Cards',
  'Art & Toys',
  'Streetwear',
  'Memes',
  'Gaming',
  'Tech',
  'Sport Cards',
  'Electronics',
]

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString()
}

function getDisplayName(profile?: UserProfile | null) {
  return profile?.username || profile?.display_name || 'Troll Citizen'
}

function getAgoraChannelName(show: AuctionShow) {
  return show.livekit_room_name || `auction-${show.id}`
}

// Generates a per-connection Agora UID. The random component guarantees the
// uid is unique for every join, which prevents AgoraRTC UID_CONFLICT errors
// (e.g. when the same user opens the auction room and the auctioneer dashboard
// at once, or reconnects before the previous session is released). Role-based
// base offsets keep viewer and auctioneer uid ranges from overlapping.
function makeAgoraUid(userId: string, role: 'viewer' | 'auctioneer') {
  const base = role === 'auctioneer' ? 100000000 : 500000000

  let hash = 0
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }

  const random = Math.floor(Math.random() * 900000)
  const uid = base + (hash % 100000) * 1000 + random

  return Math.max(1, Math.min(uid, 2147483646))
}

function getAgoraErrorMessage(error: any) {
  if (!error) return 'Unknown Agora error'

  const parts = [
    error?.name,
    error?.code,
    error?.message,
    error?.data ? JSON.stringify(error.data) : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' | ') : String(error)
}

function logAgoraError(scope: string, error: any) {
  const message = getAgoraErrorMessage(error)

  console.error(`[LiveAuctionRoom] ${scope}:`, {
    message,
    name: error?.name,
    code: error?.code,
    data: error?.data,
    stack: error?.stack,
  })

  return message
}

function getBidderName(bid?: AuctionBid | null, isAnonymous?: boolean) {
  if (isAnonymous || (bid as any)?.is_anonymous) {
    return (bid as any)?.anonymous_label || 'Anonymous Bidder';
  }
  return bid?.bidder?.username || bid?.bidder?.display_name || 'Anonymous';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function timeAgo(value?: string | null) {
  if (!value) return 'now'
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export default function LiveAuctionRoom() {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [show, setShow] = useState<AuctionShow | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null)
  const [bids, setBids] = useState<AuctionBid[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  const [loading, setLoading] = useState(true)
  const [viewerCount, setViewerCount] = useState(0)
  const [selectedTab, setSelectedTab] = useState<'chat' | 'bids' | 'info' | 'lot'>('chat')

  const [bidAmount, setBidAmount] = useState('')
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [bidError, setBidError] = useState('')
  const [chatDraft, setChatDraft] = useState('')

  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [auctioneerMicOn, setAuctioneerMicOn] = useState(true)
  const [auctioneerCamOn, setAuctioneerCamOn] = useState(true)
  const [auctioneerConnecting, setAuctioneerConnecting] = useState(false)
  const [agoraConnected, setAgoraConnected] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)
  const [agoraError, setAgoraError] = useState<string | null>(null)
  const [agoraReadyToRetry, setAgoraReadyToRetry] = useState(false)

  // Display text (announcement from auctioneer)
  const [displayText, setDisplayText] = useState<string>('')

  // End-auction redirect guard
  const [winnerPopupChecked, setWinnerPopupChecked] = useState(false)

  // Chat bidding
  const [showCustomBidModal, setShowCustomBidModal] = useState(false)
  const [customBidAmount, setCustomBidAmount] = useState('')

  // View All Lots modal
  const [showAllLotsModal, setShowAllLotsModal] = useState(false)

  // Share modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Report modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // Prediction modal
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [predictionWinnerId, setPredictionWinnerId] = useState<string>('');
  const [predictionPrice, setPredictionPrice] = useState<string>('');
  const [predictionType, setPredictionType] = useState<'winner' | 'price' | 'combined'>('combined');

  // Boost Bid UI
  const [showBoostDropdown, setShowBoostDropdown] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(0);

  // Auction watchlist
  const [isWatchlisted, setIsWatchlisted] = useState(false)
  const [watchlistCount, setWatchlistCount] = useState(0)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    type: 'chat' | 'bid' | 'system'
    username: string
    text: string
    amount?: number
    timestamp: string
  }>>([])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const localVideoRef = useRef<HTMLDivElement | null>(null)
  const remoteVideoRef = useRef<HTMLDivElement | null>(null)
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null)
  const agoraJoinedRef = useRef(false)
  const agoraConnectingRef = useRef(false)
  const activeAgoraKeyRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)

  const presenceKey = user?.id || `anon-auction-${showId || 'unknown'}`

  // Fetch the user's auctioneer_profiles.id to compare against show.auctioneer_id
  const [auctioneerProfileId, setAuctioneerProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) { setAuctioneerProfileId(null); return }
    supabase
      .from('auctioneer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setAuctioneerProfileId(data?.id ?? null))
  }, [user?.id])

  // Fetch watchlist status and count
  useEffect(() => {
    if (!showId) return

    async function fetchWatchlistInfo() {
      try {
        const { data: countData } = await supabase.rpc('get_auction_watchlist_count', {
          p_auction_show_id: showId,
        })
        setWatchlistCount(Number(countData || 0))

        if (user?.id) {
          const { data: wlData } = await supabase
            .from('auction_watchlist')
            .select('id')
            .eq('user_id', user.id)
            .eq('auction_show_id', showId)
            .maybeSingle()
          setIsWatchlisted(!!wlData)
        }
      } catch {
        // silently fail
      }
    }

    void fetchWatchlistInfo()
  }, [showId, user?.id])

  const toggleWatchlist = useCallback(async () => {
    if (!user?.id || !showId || watchlistLoading) return

    setWatchlistLoading(true)
    try {
      if (isWatchlisted) {
        const { error } = await supabase
          .from('auction_watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('auction_show_id', showId)
        if (error) throw error
        setIsWatchlisted(false)
        setWatchlistCount((prev) => Math.max(0, prev - 1))
        toast.success('Removed from watchlist')
      } else {
        const { error } = await supabase
          .from('auction_watchlist')
          .insert({ user_id: user.id, auction_show_id: showId })
        if (error) throw error
        setIsWatchlisted(true)
        setWatchlistCount((prev) => prev + 1)
        toast.success('Added to watchlist')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update watchlist')
    } finally {
      setWatchlistLoading(false)
    }
  }, [user?.id, showId, isWatchlisted, watchlistLoading])

  const isAuctioneer = useMemo(() => {
    if (!show) return false
    // Admins can always access
    if (profile?.role === 'admin' || profile?.is_admin) return true
    // Check if this user's auctioneer_profile matches the show's auctioneer_id
    if (auctioneerProfileId && show.auctioneer_id === auctioneerProfileId) return true
    return false
  }, [show, auctioneerProfileId, profile?.role, profile?.is_admin])

  // Anonymous Round
  const anonymousRound = useAnonymousRound(showId, isAuctioneer);

  // Boost Bid
  const boostBid = useBoostBid(showId, isAuctioneer);

  // Predictions
  const predictions = usePredictionBid(showId, isAuctioneer);

  const minimumBid = useMemo(() => {
    if (!currentLot) return 0
    const current = Number(currentLot.current_highest_bid || 0)
    return current > 0 ? current + Number(currentLot.bid_increment || 100) : Number(currentLot.starting_bid || 0)
  }, [currentLot])

  const currentBid = useMemo(() => {
    if (!currentLot) return 0
    return Number(currentLot.current_highest_bid || currentLot.starting_bid || 0)
  }, [currentLot])

  const canBid = Boolean(
    user &&
      currentLot &&
      currentLot.status === 'live'
  )

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, troll_coins, role, is_admin, is_superadmin')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[LiveAuctionRoom] Failed to fetch user profile:', error)
      return
    }

    if (data) setUserProfile({ ...data, troll_coins: Number(data.troll_coins || 0) })
  }, [user?.id])

  const fetchLots = useCallback(async (auctionShowId: string) => {
    const { data, error } = await supabase
      .from('auction_lots')
      .select(`
        id,
        auction_show_id,
        title,
        description,
        image_url,
        starting_bid,
        bid_increment,
        current_highest_bid,
        current_highest_bidder_id,
        status,
        countdown_end_at,
        order_index,
        queue_position,
        reserve_price,
        buy_now_price,
        condition,
        quantity
      `)
      .eq('auction_show_id', auctionShowId)
      .neq('status', 'removed')
      .neq('status', 'remove')
      .order('queue_position', { ascending: true })

    if (error) {
      console.error('[LiveAuctionRoom] Failed to fetch lots:', error)
      return
    }

    const fetched = (data || []) as AuctionLot[]
    setLots(fetched)

    // Keep the on-stage (live) lot visible even if the live-state RPC is unavailable.
    // The lots list is kept fresh by realtime, so derive the current lot from it as a fallback.
    const liveLot = fetched.find((l) => l.status === 'live')
    if (liveLot) setCurrentLot((prev) => (prev?.id === liveLot.id ? { ...prev, ...liveLot } : liveLot))
  }, [])

  const cleanupAgora = useCallback(async () => {
    const keyToRelease = activeAgoraKeyRef.current

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
        localAudioTrackRef.current.close()
        localAudioTrackRef.current = null
      }

      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop()
        localVideoTrackRef.current.close()
        localVideoTrackRef.current = null
      }

      if (agoraClientRef.current && agoraJoinedRef.current) {
        await agoraClientRef.current.leave()
      }
    } catch (error) {
      console.warn('[LiveAuctionRoom] Agora cleanup warning:', error)
    } finally {
      if (keyToRelease) GLOBAL_AGORA_JOIN_LOCKS.delete(keyToRelease)
      agoraClientRef.current = null
      agoraJoinedRef.current = false
      agoraConnectingRef.current = false
      activeAgoraKeyRef.current = null
      setAgoraConnected(false)
      setRemoteReady(false)
      setAgoraReadyToRetry(false)
    }
  }, [])

  const fetchLiveState = useCallback(async () => {
    if (!showId) return

    try {
      const { data, error } = await supabase.rpc('get_live_auction_state', {
        p_show_id: showId,
      })

      if (error) throw error

      const state = data as LiveAuctionStateRpc | null

      if (state?.current_lot) setCurrentLot(state.current_lot)
      if (Array.isArray(state?.recent_bids)) setBids(state.recent_bids)
      if (typeof state?.viewer_count === 'number') setViewerCount(state.viewer_count)
    } catch (error) {
      console.warn('[LiveAuctionRoom] get_live_auction_state failed:', error)
    }
  }, [showId])

  const fetchShow = useCallback(async () => {
    if (!showId) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select(`
          id,
          title,
          description,
          category,
          thumbnail_url,
          status,
          scheduled_for,
          live_started_at,
          ended_at,
          livekit_room_name,
          auctioneer_id,
          current_lot_id,
          display_text
        `)
        .eq('id', showId)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        setShow(null)
        toast.error('Auction not found')
        return
      }

      const nextShow = data as AuctionShow
      setShow(nextShow)
      setDisplayText((data as any).display_text || '')

      // Allow viewers who are already on the page to remain for scheduled shows
      // so they see the show flip to LIVE in real time (the realtime subscription
      // updates status). Only bounce ended/cancelled shows without a win.
      if (nextShow.status === 'ended' || nextShow.status === 'cancelled') {
        if (nextShow.status === 'ended') {
          void redirectOnAuctionEnd()
        } else {
          toast.error('This auction has been cancelled')
          navigate('/auctions')
        }
        return
      }

      await Promise.all([fetchLots(nextShow.id), fetchLiveState(), fetchUserProfile()])
    } catch (error) {
      console.error('[LiveAuctionRoom] Error fetching show:', error)
      toast.error('Failed to load auction room')
    } finally {
      setLoading(false)
    }
  }, [fetchLiveState, fetchLots, fetchUserProfile, navigate, showId])

  // When the auction ends, send every bidder/viewer to the right place:
  //  - winners  -> the "won items" page for this show
  //  - everyone else (incl. guests) -> the homepage
  // The auctioneer stays in the room to run post-auction tasks.
  const redirectOnAuctionEnd = useCallback(async () => {
    if (isAuctioneer || winnerPopupChecked) return
    setWinnerPopupChecked(true)

    try {
      if (!user?.id || !showId) {
        navigate('/')
        return
      }

      const { data: wonData } = await supabase
        .from('auction_lots')
        .select('*')
        .eq('auction_show_id', showId)
        .eq('winner_user_id', user.id)
        .eq('status', 'sold')

      if (wonData && wonData.length > 0) {
        navigate(`/auctions/won/${showId}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      console.warn('[LiveAuctionRoom] Failed to check wins:', err)
      navigate('/')
    }
  }, [isAuctioneer, user?.id, showId, winnerPopupChecked, navigate])

  // Also redirect on initial load in case user reloads after auction ended
  useEffect(() => {
    if (show?.status === 'ended' && !winnerPopupChecked) {
      void redirectOnAuctionEnd()
    }
  }, [show?.status, winnerPopupChecked, redirectOnAuctionEnd])

  const markPresenceInactive = useCallback(async () => {
    if (!showId || !user?.id) return

    await supabase
      .from('auction_presence')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('auction_show_id', showId)
      .eq('user_id', user.id)
  }, [showId, user?.id])

  const trackPresence = useCallback(async () => {
    if (!showId || !user?.id) return

    await supabase.from('auction_presence').upsert(
      {
        auction_show_id: showId,
        user_id: user.id,
        presence_role: isAuctioneer ? 'auctioneer' : 'bidder',
        is_active: true,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'auction_show_id,user_id' }
    )
  }, [isAuctioneer, showId, user?.id])

  const getAgoraToken = useCallback(
    async (channelName: string, uid: number, role: 'publisher' | 'audience') => {
      const { data, error } = await supabase.functions.invoke('agora-token', {
        body: {
          channelName,
          channel: channelName,
          uid,
          role,
          isPublisher: role === 'publisher',
        },
      })

      if (error) {
        const edgeError = error as any
        const details = edgeError?.context?.error?.error || edgeError?.context?.error?.details
          || edgeError?.context?.error?.hint || edgeError?.message
        throw new Error(details || 'Agora token service unavailable. Make sure AGORA_APP_ID and AGORA_APP_CERTIFICATE are set in Supabase secrets.')
      }
      if (!data?.token) throw new Error('No Agora token returned — check Supabase edge function logs')

      return data.token as string
    },
    []
  )

  const subscribeAndPlay = useCallback(async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    try {
      await clientRef.current?.subscribe(remoteUser, mediaType)
    } catch (err) {
      logAgoraError('subscribe failed', err)
      return
    }

    if (mediaType === 'video' && remoteUser.videoTrack && remoteVideoRef.current) {
      remoteUser.videoTrack.play(remoteVideoRef.current)
      setRemoteReady(true)
    }

    if (mediaType === 'audio' && remoteUser.audioTrack) {
      remoteUser.audioTrack.play()
    }
  }, [])

  const buildAgoraClient = useCallback(() => {
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })

    // Subscribe to and play any media a remote user publishes.
    client.on('user-published', (remoteUser: IAgoraRTCRemoteUser, mediaType) => {
      void subscribeAndPlay(remoteUser, mediaType)
    })

    // Handle a host that was already live *before* this client finished
    // subscribing: catch any published tracks that the event missed.
    client.on('user-joined', (remoteUser: IAgoraRTCRemoteUser) => {
      if (remoteUser.hasPublishedVideo || (remoteUser as any).videoTrack) {
        void subscribeAndPlay(remoteUser, 'video')
      }
      if (remoteUser.hasPublishedAudio || (remoteUser as any).audioTrack) {
        void subscribeAndPlay(remoteUser, 'audio')
      }
    })

    client.on('user-unpublished', (_remoteUser, mediaType) => {
      if (mediaType === 'video') setRemoteReady(false)
    })

    client.on('user-left', () => setRemoteReady(false))

    // Recover from temporary disconnects (mobile backgrounding, flaky wifi).
    client.on('connection-state-change', (curState: string, revState: string) => {
      debugAgora('connection-state-change', curState, revState)
      if (curState === 'RECONNECTING' || curState === 'DISCONNECTED') {
        setAgoraConnected(false)
        scheduleViewerReconnect()
      } else if (curState === 'CONNECTED') {
        setAgoraConnected(true)
        // A host that published while we were reconnecting: re-scan.
        client.remoteUsers.forEach((u) => {
          if (u.hasPublishedVideo || (u as any).videoTrack) void subscribeAndPlay(u, 'video')
          if (u.hasPublishedAudio || (u as any).audioTrack) void subscribeAndPlay(u, 'audio')
        })
      }
    })

    // Proactively refresh the token before it expires to avoid a dropped stream.
    client.on('token-privilege-will-expire', async () => {
      debugAgora('token-privilege-will-expire — renewing')
      try {
        if (!show) return
        const channelName = getAgoraChannelName(show)
        const uid = makeAgoraUid(user?.id || '', 'viewer')
        const token = await getAgoraToken(channelName, uid, 'audience')
        await client.renewToken(token)
      } catch (err) {
        logAgoraError('token renewal failed', err)
      }
    })

    return client
  }, [getAgoraChannelName, scheduleViewerReconnect, show, subscribeAndPlay, user?.id])

  const scheduleViewerReconnect = useCallback(() => {
    if (retryTimerRef.current) return

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      if (!agoraClientRef.current && !agoraJoinedRef.current && !agoraConnectingRef.current) {
        void connectViewerAgoraRef.current?.()
      }
    }, 900)
  }, [])

  const connectViewerAgoraRef = useRef<null | (() => Promise<void>)>(null)

  const connectViewerAgora = useCallback(async () => {
    if (!showId || !user?.id || isAuctioneer) return

    const appId = import.meta.env.VITE_AGORA_APP_ID
    if (!appId) {
      toast.error('Agora App ID is not configured')
      return
    }

    const channelName = show ? getAgoraChannelName(show) : `auction-${showId}`
    const uid = makeAgoraUid(user.id, 'viewer')
    const agoraKey = `${channelName}:${uid}:viewer`

    if (agoraConnectingRef.current) return // silently skip, already connecting
    if (agoraJoinedRef.current || agoraClientRef.current) return // silently skip, already joined
    if (activeAgoraKeyRef.current === agoraKey) return // silently skip, same session

    if (GLOBAL_AGORA_JOIN_LOCKS.has(agoraKey)) {
      scheduleViewerReconnect()
      return
    }

    GLOBAL_AGORA_JOIN_LOCKS.add(agoraKey)
    activeAgoraKeyRef.current = agoraKey
    agoraConnectingRef.current = true

    try {
      const client = buildAgoraClient()
      agoraClientRef.current = client
      await client.setClientRole('audience')

      const token = await getAgoraToken(channelName, uid, 'audience')
      await client.join(appId, channelName, token, uid)

      agoraJoinedRef.current = true
      setAgoraConnected(true)

      // Catch the host if it was already live *before* we subscribed. The
      // user-published event would have been missed otherwise, leaving viewers
      // stuck on "Waiting for Agora" forever.
      client.remoteUsers.forEach((u) => {
        if (u.hasPublishedVideo || (u as any).videoTrack) void subscribeAndPlay(u, 'video')
        if (u.hasPublishedAudio || (u as any).audioTrack) void subscribeAndPlay(u, 'audio')
      })
    } catch (error: any) {
      const agoraErrorMessage = logAgoraError('Viewer Agora connection failed', error)
      // CAN_NOT_GET_GATEWAY_SERVER / no active status => invalid project, token,
      // or account config. Surface an admin-facing error instead of an opaque
      // "Waiting for Agora" that never recovers.
      const isGateway = /CAN_NOT_GET_GATEWAY_SERVER|no active status|gateway/i.test(String(error?.message || ''))
      setAgoraError(isGateway
        ? 'Unable to connect to Agora: gateway unavailable. Check the Agora project, token endpoint, or account status.'
        : (agoraErrorMessage || 'Failed to connect to Agora auction stream'))
      setAgoraReadyToRetry(true)
      if (isGateway) {
        toast.error('Unable to connect to Agora: gateway unavailable. Check the Agora project, token endpoint, or account status.')
      } else {
        toast.error(agoraErrorMessage || 'Failed to connect to Agora auction stream')
      }
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
      activeAgoraKeyRef.current = null
      await cleanupAgora()
    } finally {
      agoraConnectingRef.current = false
    }
  }, [buildAgoraClient, cleanupAgora, getAgoraToken, isAuctioneer, scheduleViewerReconnect, show, showId, subscribeAndPlay, user?.id])

  useEffect(() => {
    connectViewerAgoraRef.current = connectViewerAgora
  }, [connectViewerAgora])

  const connectAuctioneerAgora = useCallback(async () => {
    if (!show || !showId || !user?.id || !isAuctioneer) return

    const appId = import.meta.env.VITE_AGORA_APP_ID
    if (!appId) {
      toast.error('Agora App ID is not configured')
      return
    }

    const channelName = getAgoraChannelName(show)
    const uid = makeAgoraUid(user.id, 'auctioneer')
    const agoraKey = `${channelName}:${uid}:auctioneer`

    if (agoraConnectingRef.current) {
      toast.info('Camera connection already in progress...')
      return
    }
    if (agoraJoinedRef.current || agoraClientRef.current) {
      toast.info('Camera is already connected')
      return
    }
    if (activeAgoraKeyRef.current === agoraKey) {
      toast.info('Already connected to this auction channel')
      return
    }
    if (GLOBAL_AGORA_JOIN_LOCKS.has(agoraKey)) {
      // Stale lock — clear it and allow retry
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
    }

    GLOBAL_AGORA_JOIN_LOCKS.add(agoraKey)
    activeAgoraKeyRef.current = agoraKey
    agoraConnectingRef.current = true
    setAuctioneerConnecting(true)

    try {
      const client = buildAgoraClient()
      agoraClientRef.current = client
      await client.setClientRole('host')

      const token = await getAgoraToken(channelName, uid, 'publisher')
      await client.join(appId, channelName, token, uid)

      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { AEC: true, ANS: true, AGC: true },
        { encoderConfig: '720p_2', facingMode: { ideal: 'environment' } }
      )

      localAudioTrackRef.current = micTrack
      localVideoTrackRef.current = camTrack

      if (localVideoRef.current) camTrack.play(localVideoRef.current)

      await client.publish([micTrack, camTrack])

      agoraJoinedRef.current = true
      setAgoraConnected(true)
      setAuctioneerMicOn(true)
      setAuctioneerCamOn(true)
      toast.success('Auctioneer camera connected with Agora')
    } catch (error: any) {
      const agoraErrorMessage = logAgoraError('Auctioneer Agora connection failed', error)
      toast.error(agoraErrorMessage || 'Failed to connect auctioneer camera')
      // Reset all connection state so the user can retry
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
      activeAgoraKeyRef.current = null
      agoraConnectingRef.current = false
      agoraJoinedRef.current = false
      agoraClientRef.current = null
      localAudioTrackRef.current = null
      localVideoTrackRef.current = null
      setAgoraConnected(false)
      setAuctioneerConnecting(false)
      setRemoteReady(false)
    } finally {
      setAuctioneerConnecting(false)
      agoraConnectingRef.current = false
    }
  }, [buildAgoraClient, cleanupAgora, getAgoraToken, isAuctioneer, show, showId, user?.id])

  const toggleAuctioneerMic = useCallback(async () => {
    const track = localAudioTrackRef.current
    if (!track) return

    await track.setEnabled(!auctioneerMicOn)
    setAuctioneerMicOn((prev) => !prev)
  }, [auctioneerMicOn])

  const toggleAuctioneerCam = useCallback(async () => {
    const track = localVideoTrackRef.current
    if (!track) return

    await track.setEnabled(!auctioneerCamOn)
    setAuctioneerCamOn((prev) => !prev)
  }, [auctioneerCamOn])

  const toggleViewerAudio = useCallback(async () => {
    const client = agoraClientRef.current
    if (!client) {
      setIsMuted((prev) => !prev)
      return
    }

    const nextMuted = !isMuted

    client.remoteUsers.forEach((remoteUser) => {
      if (remoteUser.audioTrack) {
        if (nextMuted) remoteUser.audioTrack.stop()
        else remoteUser.audioTrack.play()
      }
    })

    setIsMuted(nextMuted)
  }, [isMuted])

  const placeBid = useCallback(async (overrideAmount?: number) => {
    if (!showId || !currentLot || !user?.id) {
      toast.error('You must be logged in to bid')
      return
    }

    const bidValue = overrideAmount ?? Number(bidAmount)

    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      setBidStatus('error')
      setBidError('Enter a valid bid amount')
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (currentLot.status !== 'live') {
      setBidStatus('error')
      setBidError('This lot is not accepting bids')
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (bidValue < minimumBid) {
      setBidStatus('error')
      setBidError(`Minimum bid is ${formatCoins(minimumBid)} coins`)
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    if (Number(userProfile?.troll_coins || 0) < bidValue) {
      setBidStatus('error')
      setBidError('Insufficient troll coins')
      window.setTimeout(() => setBidStatus('idle'), 3000)
      return
    }

    try {
      let data, error;

      // Use boost bid RPC if boost is selected
      if (selectedBoost > 0 && boostBid.config.enabled) {
        ({ data, error } = await supabase.rpc('place_boost_bid', {
          p_show_id: showId,
          p_lot_id: currentLot.id,
          p_bid_amount: bidValue,
          p_boost_amount: selectedBoost,
        }));
      } else {
        ({ data, error } = await supabase.rpc('place_bid', {
          p_show_id: showId,
          p_lot_id: currentLot.id,
          p_bid_amount: bidValue,
        }));
      }

      if (error) throw error

      const result = data as PlaceBidResult

      if (result && result.accepted === false) {
        setBidStatus('error')
        setBidError(result.reason || 'Bid failed')
        window.setTimeout(() => setBidStatus('idle'), 3000)
        return
      }

      setBidStatus('success')
      setBidAmount('')
      setSelectedBoost(0)
      setShowBoostDropdown(false)
      await Promise.all([fetchLiveState(), fetchUserProfile()])
      window.setTimeout(() => setBidStatus('idle'), 2000)
    } catch (error: any) {
      console.error('[LiveAuctionRoom] Bid failed:', error)
      setBidStatus('error')
      setBidError(error?.message || 'Failed to place bid')
      window.setTimeout(() => setBidStatus('idle'), 3000)
    }
  }, [bidAmount, currentLot, fetchLiveState, fetchUserProfile, minimumBid, showId, user?.id, userProfile?.troll_coins, selectedBoost, boostBid.config.enabled])

  const quickBid = useCallback((extra: number) => {
    void placeBid(minimumBid + extra)
  }, [minimumBid, placeBid])

  // Synced timer for the current lot (reads from DB, synced via realtime)
  const timer = useAuctionTimer(currentLot?.id ?? null, false)

  const handleFullscreen = useCallback(async () => {
    const container = stageRef.current
    if (!container) return

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      setIsFullscreen((prev) => !prev)
    }
  }, [])

  // Detect chat bid patterns: $25, Custom Bid $25, bid $25, etc.
  const parseChatBid = useCallback((text: string): number | null => {
    const trimmed = text.trim()
    // Match: $25, $250, $2500
    const simpleMatch = trimmed.match(/^\$(\d+)$/)
    if (simpleMatch) return parseInt(simpleMatch[1], 10)

    // Match: Custom Bid $25, bid $25, Bid $25, BID $25
    const prefixMatch = trimmed.match(/(?:custom\s+bid|bid)\s+\$(\d+)$/i)
    if (prefixMatch) return parseInt(prefixMatch[1], 10)

    return null
  }, [])

  const handleChatOrBid = useCallback(async () => {
    if (!chatDraft.trim()) return

    const bidAmountParsed = parseChatBid(chatDraft)

    if (bidAmountParsed && bidAmountParsed > 0 && user?.id && currentLot && currentLot.status === 'live') {
      // Validate minimum increment
      if (bidAmountParsed < minimumBid) {
        toast.error(`Minimum bid is ${formatCoins(minimumBid)} coins`)
        return
      }

      // Check balance
      if (Number(userProfile?.troll_coins || 0) < bidAmountParsed) {
        toast.error('Insufficient troll coins')
        return
      }

      // Check if bid confirmation is required
      // (In a real system this would be auctioneer setting)

      try {
        const { data, error } = await supabase.rpc('place_bid', {
          p_show_id: showId,
          p_lot_id: currentLot.id,
          p_bid_amount: bidAmountParsed,
        })

        if (error) throw error

        const result = data as PlaceBidResult
        if (result && result.accepted === false) {
          toast.error(result.reason || 'Bid failed')
          return
        }

        // Add to local chat messages
        setChatMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'bid',
          username: profile?.username || user?.email || 'You',
          text: `🔨 Bid ${formatCoins(bidAmountParsed)} coins`,
          amount: bidAmountParsed,
          timestamp: new Date().toISOString(),
        }])

        toast.success(`Bid placed: ${formatCoins(bidAmountParsed)} coins!`, {
          icon: '🔨',
          style: { background: '#0c1a32', border: '1px solid #fbbf24', color: '#fbbf24' },
        })

        await Promise.all([fetchLiveState(), fetchUserProfile()])
      } catch (error: any) {
        toast.error(error?.message || 'Failed to place chat bid')
      }

      setChatDraft('')
      return
    }

    // Normal chat message
    if (canBid) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'chat',
        username: profile?.username || user?.email || 'You',
        text: chatDraft.trim(),
        timestamp: new Date().toISOString(),
      }])
    } else {
      toast.info('Auction chat wiring comes next. Bid system is already live.')
    }
    setChatDraft('')
  }, [chatDraft, parseChatBid, user?.id, user?.email, profile?.username, currentLot, minimumBid, showId, userProfile?.troll_coins, canBid, fetchLiveState, fetchUserProfile])

  // Submit custom bid from modal
  const submitCustomBid = useCallback(async () => {
    const amount = parseInt(customBidAmount, 10)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setShowCustomBidModal(false)
    setCustomBidAmount('')
    await placeBid(amount)
  }, [customBidAmount, placeBid])

  const chatDraftRef = useRef('')

  useEffect(() => {
    chatDraftRef.current = chatDraft
  }, [chatDraft])

  // Auto-detect bids from incoming bids and add to chat
  const prevBidsLengthRef = useRef(bids.length)
  useEffect(() => {
    if (bids.length > prevBidsLengthRef.current && bids.length > 0) {
      const newBids = bids.slice(0, bids.length - prevBidsLengthRef.current)
      newBids.forEach(bid => {
        const bidderName = getBidderName(bid)
        setChatMessages(prev => {
          // Avoid duplicating user's own bids
          const exists = prev.some(m => m.timestamp === bid.created_at && m.amount === bid.bid_amount)
          if (exists) return prev
          return [...prev, {
            id: `bid-${bid.id}`,
            type: 'bid' as const,
            username: bidderName,
            text: `🔨 Bid ${formatCoins(bid.bid_amount)} coins`,
            amount: bid.bid_amount,
            timestamp: bid.created_at,
          }]
        })
      })
    }
    prevBidsLengthRef.current = bids.length
  }, [bids])

  useEffect(() => {
    void fetchShow()
  }, [fetchShow])

  // Use refs for callbacks so the realtime channel effect only depends on showId
  const fetchLotsRef = useRef(fetchLots)
  const fetchLiveStateRef = useRef(fetchLiveState)
  const isAuctioneerRef = useRef(isAuctioneer)
  useEffect(() => { fetchLotsRef.current = fetchLots }, [fetchLots])
  useEffect(() => { fetchLiveStateRef.current = fetchLiveState }, [fetchLiveState])
  useEffect(() => { isAuctioneerRef.current = isAuctioneer }, [isAuctioneer])

  useEffect(() => {
    if (!showId) return

    const channel = supabase
      .channel(`auction-room:${showId}`, { config: { presence: { key: presenceKey } } })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_lots', filter: `auction_show_id=eq.${showId}` },
        async () => {
          await Promise.all([fetchLotsRef.current(showId), fetchLiveStateRef.current()])
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_bids', filter: `auction_show_id=eq.${showId}` },
        async () => {
          await fetchLiveStateRef.current()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auction_shows',
          filter: `id=eq.${showId}`,
        },
        (payload: any) => {
          if (payload.new?.display_text !== undefined) {
            setDisplayText(payload.new.display_text || '')
          }
          // Keep the local show record in sync so viewers who are already on the
          // page see the show flip to LIVE and the active item update instantly.
          if (payload.new?.status || payload.new?.current_lot_id || payload.new?.live_started_at) {
            setShow((prev) =>
              prev
                ? {
                    ...prev,
                    status: payload.new.status ?? prev.status,
                    current_lot_id: payload.new.current_lot_id ?? prev.current_lot_id,
                    live_started_at: payload.new.live_started_at ?? prev.live_started_at,
                  }
                : prev,
            )
          }
          // Detect when show ends and route bidders/viewers accordingly
          if (payload.new?.status === 'ended' && payload.old?.status === 'live') {
            void redirectOnAuctionEnd()
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        let count = 0

        Object.values(state).forEach((items) => {
          count += Array.isArray(items) ? items.length : 0
        })

        setViewerCount(count)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id || presenceKey,
            username: profile?.username || user?.email || 'Guest Bidder',
            role: isAuctioneerRef.current ? 'auctioneer' : 'bidder',
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
    }
    // Only re-create the channel when showId or presenceKey changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId, presenceKey])

  // Resilient live-state polling. Realtime change events on auction_lots can be
  // filtered by RLS, which would leave viewers without the current lot / timer.
  // Polling guarantees the on-stage item and countdown stay in sync for all viewers.
  useEffect(() => {
    if (!showId) return
    const poll = () => {
      fetchLiveStateRef.current()
      fetchLotsRef.current(showId)
    }
    poll()
    const id = window.setInterval(poll, 4000)
    return () => window.clearInterval(id)
  }, [showId])

  useEffect(() => {
    void trackPresence()

    const interval = window.setInterval(() => void trackPresence(), 30000)

    return () => {
      window.clearInterval(interval)
      void markPresenceInactive()
    }
  }, [markPresenceInactive, trackPresence])

  // Use refs for connect/cleanup so the effect never re-fires due to callback identity changes
  const connectViewerRef = useRef(connectViewerAgora)
  const cleanupViewerRef = useRef(cleanupAgora)
  useEffect(() => { connectViewerRef.current = connectViewerAgora }, [connectViewerAgora])
  useEffect(() => { cleanupViewerRef.current = cleanupAgora }, [cleanupAgora])

  // Track whether viewer auto-connect has been attempted to avoid repeated connection cycles
  const viewerAutoConnectAttemptedRef = useRef(false)

  useEffect(() => {
    if (showId && user?.id && !isAuctioneer && !viewerAutoConnectAttemptedRef.current) {
      viewerAutoConnectAttemptedRef.current = true
      void connectViewerRef.current()
    }

    return () => {
      void cleanupViewerRef.current()
    }
    // Only depend on stable values — not the callbacks which change every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showId, user?.id, isAuctioneer])

  const upcomingLots = lots.filter((lot) => lot.status === 'upcoming' || lot.status === 'queued' || lot.status === 'scheduled')
  const visibleNextLots = upcomingLots.length > 0 ? upcomingLots : lots.filter((lot) => lot.id !== currentLot?.id).slice(0, 6)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091a] text-white">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.04] px-10 py-8 text-center shadow-[0_0_60px_rgba(34,211,238,0.18)] backdrop-blur-xl">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-300" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.25em] text-cyan-100">Loading auction room</p>
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091a] text-white">
        <div className="text-center">
          <Gavel className="mx-auto mb-4 h-16 w-16 text-slate-600" />
          <p className="text-slate-400">Auction not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#08091c] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.16),transparent_36%),linear-gradient(135deg,#08091c,#11122b_48%,#0b1024)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:44px_44px] opacity-25" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      </div>

      <header className="relative z-20 border-b border-cyan-300/15 bg-[#07091a]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between px-4 py-3 lg:px-7">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/auctions')}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <button
              onClick={() => navigate('/')}
              className="group flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.18)]">
                <Gavel className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <p className="bg-gradient-to-r from-cyan-200 via-sky-200 to-purple-200 bg-clip-text text-xl font-black uppercase tracking-[0.25em] text-transparent">
                  Mai Troll
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Live Auctions</p>
              </div>
            </button>

            <nav className="hidden items-center gap-1 xl:flex">
              {['Live Auction', 'Marketplace', 'Troll Coins', 'How It Works', 'Community'].map((item) => (
                <button
                  key={item}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    item === 'Live Auction'
                      ? 'bg-cyan-400/10 text-cyan-100 shadow-[inset_0_-2px_0_rgba(34,211,238,0.7)]'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-2xl border border-cyan-300/15 bg-black/35 px-4 py-2 md:flex">
              <Coins className="h-5 w-5 text-yellow-300" />
              <div>
                <p className="text-sm font-black">{formatCoins(userProfile?.troll_coins || 0)}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Troll Coins</p>
              </div>
            </div>

            <button className="rounded-2xl border border-cyan-400/20 bg-white/[0.04] p-2.5 text-cyan-100 hover:bg-cyan-400/10">
              <Bell className="h-5 w-5" />
            </button>

            <button className="rounded-2xl border border-purple-400/20 bg-white/[0.04] p-2.5 text-purple-100 hover:bg-purple-400/10">
              <Shield className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-black">
                {getInitials(profile?.username || user?.email || 'TC')}
              </div>
              <div>
                <p className="text-sm font-black">{profile?.username || user?.email || 'Guest'}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">Viewer</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-4 overflow-x-auto px-4 pb-3 lg:px-7">
          <div className="flex min-w-max items-center gap-3">
            {CATEGORY_CHIPS.map((category) => (
              <button
                key={category}
                className={`rounded-2xl border px-5 py-2 text-xs font-black transition ${
                  category === 'All' || category === show.category
                    ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.16)]'
                    : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <button className="hidden min-w-max items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-200 hover:border-cyan-300/30 lg:flex">
            <CalendarDays className="h-4 w-4 text-cyan-200" />
            Calendar
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </header>

      {/* Anonymous Mode Banner */}
      {anonymousRound.state.isActive && !isAuctioneer && (
        <div className="relative z-10 border-b border-indigo-400/20 bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-indigo-950/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1920px] items-center justify-center gap-4 px-4 py-3 lg:px-7">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-300/30 bg-indigo-400/10">
              <EyeOff className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-indigo-200">🔒 Anonymous Bid Round Active</p>
              <p className="text-xs text-indigo-300/70">Bidder identities are hidden. Place your bids — stay anonymous!</p>
            </div>
            <div className="font-mono text-xl font-black text-indigo-300">
              {Math.floor(anonymousRound.state.secondsRemaining / 60)}:{String(anonymousRound.state.secondsRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto grid max-w-[1920px] grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.72fr)] xl:grid-cols-[minmax(0,1.05fr)_560px_510px] lg:p-7">
        <section className="space-y-5">
          <div
            ref={stageRef}
            className="relative aspect-video overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-black shadow-[0_0_50px_rgba(34,211,238,0.16)]"
          >
            {isAuctioneer ? (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                <div ref={localVideoRef} className="absolute inset-0 h-full w-full bg-black" />
                {!agoraConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                    <Gavel className="h-16 w-16 animate-pulse text-cyan-300" />
                    <p className="mt-4 text-xl font-black text-cyan-100">Auctioneer Agora Control Room</p>
                    <p className="mt-1 text-sm text-slate-400">Your camera and microphone broadcast directly through Agora.</p>
                  </div>
                )}

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={connectAuctioneerAgora}
                    disabled={auctioneerConnecting || agoraConnected}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    {auctioneerConnecting ? 'Connecting...' : agoraConnected ? 'Agora Connected' : 'Connect Camera'}
                  </button>

                  <button onClick={toggleAuctioneerMic} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    {auctioneerMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {auctioneerMicOn ? 'Mic On' : 'Mic Off'}
                  </button>

                  <button onClick={toggleAuctioneerCam} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
                    {auctioneerCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                    {auctioneerCamOn ? 'Camera On' : 'Camera Off'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 bg-black">
                <div ref={remoteVideoRef} className="absolute inset-0 h-full w-full bg-black [&>div]:!h-full [&>div]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover" />
                {agoraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-red-950/30 to-purple-950/40 px-6 text-center">
                    <AlertCircle className="h-12 w-12 text-red-300" />
                    <p className="max-w-md text-sm font-bold text-red-100">{agoraError}</p>
                    <button
                      onClick={() => {
                        setAgoraError(null)
                        void connectViewerRef.current?.()
                      }}
                      className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-5 py-2.5 font-bold text-cyan-100 hover:bg-cyan-500/30"
                    >
                      Retry connection
                    </button>
                  </div>
                ) : !remoteReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/20 to-purple-950/20">
                    <Video className="h-16 w-16 animate-pulse text-cyan-300" />
                    <p className="mt-4 text-xl font-black text-cyan-100">
                      {agoraConnected ? 'Waiting for auctioneer video' : 'Connecting to Agora auction room...'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {agoraConnected
                        ? 'The auctioneer has not started their camera yet.'
                        : 'Establishing a secure connection to the live auction stream.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-black text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-cyan-100">
                <Eye className="h-4 w-4" />
                {formatCoins(viewerCount)}
              </span>
            </div>

            <div className="absolute left-4 top-16 max-w-[70%]">
              <p className="rounded-2xl border border-white/10 bg-black/65 px-4 py-2 text-sm font-black text-white backdrop-blur-md">
                {show.title}
              </p>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4">
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-pink-500" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm font-bold">
                  <Volume2 className="h-4 w-4 text-cyan-200" />
                  <span className="text-white">LIVE</span>
                </div>

                {!isAuctioneer && (
                  <div className="flex gap-2">
                    <button onClick={toggleViewerAudio} className="rounded-xl border border-white/10 bg-black/70 p-3 hover:bg-black/50">
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <button onClick={handleFullscreen} className="rounded-xl border border-white/10 bg-black/70 p-3 hover:bg-black/50">
                      <Maximize2 className="h-5 w-5" />
                      <span className="sr-only">{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Display Text / Announcement Panel — visible to all viewers */}
          {displayText && (
            <div className="rounded-[1.75rem] border border-cyan-300/20 bg-gradient-to-br from-[#0c1a32]/90 to-[#0a1628]/90 p-5 shadow-[0_0_35px_rgba(34,211,238,0.1)] backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10">
                  <Megaphone className="h-4 w-4 text-cyan-300" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Auctioneer Announcement</h3>
                <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {displayText}
              </div>
            </div>
          )}

          <CurrentLotCard currentLot={currentLot} show={show} />

          <HostCard show={show} bids={bids} />

          {visibleNextLots.length > 0 && (
            <div className="rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Next Lots</h3>
                <button
                  onClick={() => setShowAllLotsModal(true)}
                  className="flex items-center gap-1 text-sm font-bold text-cyan-300 hover:text-cyan-100"
                >
                  View All Lots
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {visibleNextLots.slice(0, 5).map((lot) => (
                  <div key={lot.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:border-cyan-300/30">
                    <div className="aspect-square bg-slate-900">
                      {lot.image_url ? (
                        <img src={lot.image_url} alt={lot.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-950/40 to-purple-950/40">
                          <Package className="h-10 w-10 text-cyan-200/50" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs font-black text-white">{lot.title}</p>
                      <p className="mt-1 text-xs font-bold text-cyan-300">Starts in {formatCoins(lot.starting_bid)} TC</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-5 xl:block">
          <div className="rounded-[1.75rem] border border-cyan-300/20 bg-[#0c1329]/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
            <div className="rounded-[1.35rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-purple-500/10 p-5">
              <p className="text-center text-sm font-black uppercase tracking-[0.2em] text-slate-300">Current Bid</p>

              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-yellow-300/25 bg-yellow-400/10">
                  <Coins className="h-8 w-8 text-yellow-300" />
                </div>
                <div>
                  <p className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-300 bg-clip-text text-6xl font-black leading-none text-transparent">
                    {formatCoins(currentBid)}
                  </p>
                  <p className="mt-1 text-center text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Troll Coins</p>
                </div>
              </div>

              <div className={`mt-5 rounded-2xl border px-4 py-4 text-center ${timer.isExpired ? 'border-red-400/30 bg-red-500/10' : 'border-white/10 bg-black/35'}`}>
                <div className={`flex items-center justify-center gap-4 font-mono text-3xl font-black ${timer.isExpired ? 'text-red-400' : timer.isRunning ? 'text-emerald-300' : 'text-slate-200'}`}>
                  <Clock className={`h-7 w-7 ${timer.isExpired ? 'text-red-400' : 'text-cyan-300'}`} />
                  <span>{timer.formatted}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-400">
                  {timer.isExpired ? '⏰ Bidding closed for this lot' : timer.isRunning ? 'Auction ends soon. Stay in it to win it.' : 'Waiting for auctioneer to start timer...'}
                </p>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs font-bold text-slate-400">Minimum Next Bid</p>
                <p className="mt-1 text-2xl font-black text-white">
                  <Coins className="mr-2 inline h-5 w-5 text-yellow-300" />
                  {formatCoins(minimumBid)}
                </p>
              </div>

              {!isAuctioneer && (
                <>
                  <button
                    onClick={() => void placeBid(minimumBid)}
                    disabled={!canBid}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 px-6 py-4 text-lg font-black uppercase tracking-[0.18em] text-white shadow-[0_0_30px_rgba(34,211,238,0.22)] transition hover:scale-[1.01] hover:from-purple-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400"
                  >
                    <Coins className="h-6 w-6 text-yellow-300" />
                    Place Bid — {formatCoins(minimumBid)} TC
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[100, 250, 500].map((extra) => (
                      <button
                        key={extra}
                        onClick={() => void quickBid(extra)}
                        disabled={!canBid}
                        className="rounded-2xl border border-cyan-300/20 bg-black/35 px-3 py-2.5 text-center transition hover:border-cyan-300/45 hover:bg-cyan-400/10 disabled:opacity-50"
                      >
                        <p className="text-sm font-black text-cyan-100">+{formatCoins(extra)}</p>
                        <p className="text-[10px] text-slate-400">{formatCoins(minimumBid + extra)} TC</p>
                      </button>
                    ))}
                  </div>

                  {/* Boost Bid Section */}
                  {boostBid.config.enabled && canBid && (
                    <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-950/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-amber-300" />
                          <p className="text-xs font-black text-amber-200">Boost Bid</p>
                        </div>
                        <button
                          onClick={() => setShowBoostDropdown(!showBoostDropdown)}
                          className="text-[10px] font-bold text-amber-300 hover:text-amber-100"
                        >
                          {showBoostDropdown ? 'Hide' : 'Show'} Options
                        </button>
                      </div>
                      {showBoostDropdown && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-500">Add to your bid increment for extra impact!</p>
                          <div className="flex flex-wrap gap-1.5">
                            {boostBid.config.allowedIncrements.map((inc) => (
                              <button
                                key={inc}
                                onClick={() => {
                                  setSelectedBoost(inc);
                                  setShowBoostDropdown(false);
                                }}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                                  selectedBoost === inc
                                    ? 'border-amber-300/40 bg-amber-400/20 text-amber-100'
                                    : 'border-amber-300/15 bg-amber-400/5 text-amber-200 hover:bg-amber-400/10'
                                }`}
                              >
                                +{inc}
                              </button>
                            ))}
                            {boostBid.config.customEnabled && (
                              <button
                                onClick={() => setSelectedBoost(boostBid.config.maxAmount)}
                                className="rounded-lg border border-amber-300/15 bg-amber-400/5 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-400/10"
                              >
                                Max (+{boostBid.config.maxAmount})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedBoost > 0 && (
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-1.5">
                          <span className="text-xs font-bold text-amber-200">
                            ⚡ Boost: +{selectedBoost} coins
                          </span>
                          <button
                            onClick={() => setSelectedBoost(0)}
                            className="text-[10px] font-bold text-amber-300 hover:text-amber-100"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                      {selectedBoost > 0 && (
                        <button
                          onClick={() => void placeBid(minimumBid + selectedBoost)}
                          disabled={!canBid}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                        >
                          <Zap className="h-4 w-4" />
                          Boost Bid — {formatCoins(minimumBid + selectedBoost)} TC
                        </button>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-center text-sm text-slate-400">
                    You have <span className="font-black text-yellow-300">{formatCoins(userProfile?.troll_coins || 0)}</span> Troll Coins
                  </p>

                  {bidStatus === 'success' && (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-200">
                      <CheckCircle className="h-5 w-5" />
                      Bid accepted!
                    </div>
                  )}

                  {bidStatus === 'error' && (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-red-200">
                      <AlertCircle className="h-5 w-5" />
                      {bidError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <ActionButton
                icon={<Heart className={`h-4 w-4 ${isWatchlisted ? 'fill-red-400 text-red-400' : ''}`} />}
                label="Watchlist"
                value={String(watchlistCount)}
                onClick={user?.id ? toggleWatchlist : undefined}
                loading={watchlistLoading}
              />
              <ActionButton
                icon={<Share2 className="h-4 w-4" />}
                label="Share"
                onClick={() => setIsShareModalOpen(true)}
              />
              <ActionButton
                icon={<Flag className="h-4 w-4" />}
                label="Report"
                danger
                onClick={() => setIsReportModalOpen(true)}
              />
            </div>
          </div>
        </section>

        {/* Prediction Panel */}
        {predictions.isEnabled && !isAuctioneer && user?.id && (
          <section className="space-y-5 xl:block">
            <div className="rounded-[1.75rem] border border-purple-300/20 bg-[#0c1329]/80 p-5 shadow-[0_0_45px_rgba(139,92,246,0.14)] backdrop-blur-2xl">
              <div className="rounded-[1.35rem] border border-purple-300/25 bg-gradient-to-br from-purple-400/10 via-indigo-500/10 to-blue-500/10 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-purple-300" />
                    <h3 className="text-sm font-black uppercase tracking-[0.15em] text-purple-200">Prediction Bid</h3>
                  </div>
                  <span className="text-xs text-slate-400">{predictions.predictionCount} entered</span>
                </div>

                {predictions.isLocked ? (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-center">
                    <Lock className="mx-auto mb-1 h-5 w-5 text-amber-300" />
                    <p className="text-xs font-bold text-amber-200">Predictions Locked</p>
                    <p className="text-[10px] text-amber-300/70">No more entries accepted</p>
                  </div>
                ) : predictions.prediction ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-purple-300/20 bg-purple-400/10 p-3">
                      <p className="text-xs font-bold text-purple-200">Your Prediction</p>
                      <p className="mt-1 text-sm text-white">
                        {predictions.prediction.prediction_type === 'winner' && '🏆 Predicted Winner'}
                        {predictions.prediction.prediction_type === 'price' && `💰 Predicted Price: ${formatCoins(predictions.prediction.predicted_price)} TC`}
                        {predictions.prediction.prediction_type === 'combined' && `🏆 Winner + 💰 ${formatCoins(predictions.prediction.predicted_price)} TC`}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPredictionModal(true)}
                      className="w-full rounded-xl border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-400/20"
                    >
                      Edit Prediction
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">Predict the auction outcome and earn rewards!</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setPredictionType('winner');
                          setShowPredictionModal(true);
                        }}
                        className="rounded-xl border border-purple-300/20 bg-purple-400/10 px-3 py-2 text-center transition hover:bg-purple-400/20"
                      >
                        <p className="text-xs font-black text-purple-100">🏆 Winner</p>
                      </button>
                      <button
                        onClick={() => {
                          setPredictionType('price');
                          setShowPredictionModal(true);
                        }}
                        className="rounded-xl border border-purple-300/20 bg-purple-400/10 px-3 py-2 text-center transition hover:bg-purple-400/20"
                      >
                        <p className="text-xs font-black text-purple-100">💰 Price</p>
                      </button>
                      <button
                        onClick={() => {
                          setPredictionType('combined');
                          setShowPredictionModal(true);
                        }}
                        className="rounded-xl border border-purple-300/20 bg-purple-400/10 px-3 py-2 text-center transition hover:bg-purple-400/20"
                      >
                        <p className="text-xs font-black text-purple-100">🔮 Both</p>
                      </button>
                    </div>
                    {predictions.settings && (
                      <div className="rounded-lg border border-purple-300/10 bg-purple-400/5 p-2">
                        <p className="text-[10px] text-slate-500">Rewards:</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                          <span className="text-amber-300">👑 {predictions.settings.reward_crowns_combined} Crowns</span>
                          <span className="text-cyan-300">⭐ {predictions.settings.reward_xp_combined} XP</span>
                          <span className="text-purple-300">🎯 {predictions.settings.reward_event_points_combined} Pts</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <aside className="space-y-5 lg:col-span-2 xl:col-span-1">
          <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] shadow-[0_0_35px_rgba(34,211,238,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-cyan-200" />
                <h3 className="font-black">Live Chat</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {formatCoins(viewerCount)} online
                </span>
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div className="max-h-[280px] space-y-3 overflow-y-auto p-4">
              {chatMessages.length > 0 ? (
                chatMessages.slice(-20).map((msg) => {
                  if (msg.type === 'bid') {
                    return (
                      <div key={msg.id} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-yellow-300/30 bg-yellow-400/10">
                          <span className="text-xs font-black text-yellow-300">🔨</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-black text-yellow-300">{msg.username}</p>
                            <p className="text-[10px] text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                          </div>
                          <p className="text-sm font-bold text-amber-200">
                            Bid {formatCoins(msg.amount)} coins 🔥
                          </p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className="flex gap-3">
                      <BidAvatar name={msg.username} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-white">{msg.username}</p>
                          <p className="text-[10px] text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                        <p className="text-sm text-slate-300">{msg.text}</p>
                      </div>
                    </div>
                  )
                })
              ) : bids.length > 0 ? (
                bids.slice(0, 5).map((bid) => {
                  const isAnon = anonymousRound.state.isActive && (bid as any)?.is_anonymous;
                  const name = getBidderName(bid, isAnon);
                  return (
                    <div key={`chat-${bid.id}`} className="flex gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isAnon ? 'border-indigo-300/30 bg-indigo-400/10' : 'border-yellow-300/30 bg-yellow-400/10'}`}>
                        <span className={`text-xs font-black ${isAnon ? 'text-indigo-300' : 'text-yellow-300'}`}>{isAnon ? '🔒' : '🔨'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm font-black ${isAnon ? 'text-indigo-300' : 'text-yellow-300'}`}>{name}</p>
                          <p className="text-[10px] text-slate-500">{new Date(bid.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                        <p className="text-sm font-bold text-amber-200">
                          Bid <span className="text-yellow-300">{formatCoins(bid.bid_amount)}</span> coins {(bid as any)?.is_boost_bid ? '⚡🔥' : '🔥'}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-sm text-slate-500">No live messages yet.</p>
                  {canBid && (
                    <p className="mt-1 text-xs text-cyan-400">Type <strong>$25</strong> to place a bid via chat!</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-white/10 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl border border-white/10 bg-black/35 px-2">
                {/* Quick Bid Buttons */}
                {canBid && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[100, 250, 500].map(amount => (
                      <button
                        key={amount}
                        onClick={() => quickBid(amount)}
                        className="rounded-lg border border-cyan-300/15 bg-cyan-400/8 px-1.5 py-1 text-[10px] font-black text-cyan-200 hover:bg-cyan-400/15 hover:text-cyan-100 transition"
                        title={`Bid ${minimumBid + amount} coins`}
                      >
                        +{amount}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleChatOrBid()
                  }}
                  placeholder={canBid ? "Type $25 to bid or say something..." : "Say something..."}
                  className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                {canBid && (
                  <button
                    onClick={() => setShowCustomBidModal(true)}
                    className="shrink-0 rounded-lg border border-purple-300/20 bg-purple-400/10 px-2 py-1 text-[10px] font-bold text-purple-200 hover:bg-purple-400/20 transition"
                  >
                    Custom Bid
                  </button>
                )}
              </div>
              <button
                onClick={() => void handleChatOrBid()}
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-black text-white"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] shadow-[0_0_35px_rgba(34,211,238,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-black">Bid History</h3>
              <button onClick={() => setSelectedTab('bids')} className="text-sm font-bold text-cyan-300 hover:text-cyan-100">
                View All
              </button>
            </div>

            <div className="max-h-[280px] space-y-2 overflow-y-auto p-4">
              {bids.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No bids yet</p>
              ) : (
                bids.slice(0, 7).map((bid) => {
                  const isAnon = anonymousRound.state.isActive && (bid as any)?.is_anonymous;
                  const name = getBidderName(bid, isAnon);
                  const isBoost = (bid as any)?.is_boost_bid;
                  return (
                    <div key={bid.id} className={`flex items-center justify-between rounded-2xl border p-3 ${isAnon ? 'border-indigo-300/20 bg-indigo-950/20' : 'border-white/10 bg-black/30'}`}>
                      <div className="flex items-center gap-3">
                        {isAnon ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-300/30 bg-indigo-400/10">
                            <EyeOff className="h-4 w-4 text-indigo-300" />
                          </div>
                        ) : (
                          <BidAvatar name={name} />
                        )}
                        <div>
                          <p className={`text-sm font-black ${isAnon ? 'text-indigo-300' : 'text-white'}`}>{name}</p>
                          {isBoost && <p className="text-[10px] font-bold text-amber-300">⚡ Boost +{(bid as any)?.boost_amount}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-yellow-300">
                          <Coins className="mr-1 inline h-4 w-4" />
                          {formatCoins(bid.bid_amount)}
                        </p>
                        <p className="text-xs text-slate-500">{timeAgo(bid.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <TrustSafetyPanel />

          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            <div className="flex border-b border-white/10">
              {(['chat', 'bids', 'info', 'lot'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`flex-1 py-3 text-sm font-black capitalize ${
                    selectedTab === tab ? 'border-b-2 border-cyan-300 bg-cyan-400/10 text-cyan-200' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'lot' ? 'Lots' : tab}
                </button>
              ))}
            </div>

            {selectedTab === 'info' && (
              <div className="space-y-3 p-4">
                <InfoRow label="Show Title" value={show.title} />
                <InfoRow label="Category" value={show.category || 'Live Auction'} />
                <InfoRow label="Video Route" value={isAuctioneer ? 'Agora Publisher' : 'Agora Viewer'} />
                <InfoRow label="Agora Channel" value={getAgoraChannelName(show)} />
                <InfoRow label="Logged In As" value={getDisplayName(userProfile)} />
              </div>
            )}

            {selectedTab === 'lot' && (
              <div className="max-h-96 space-y-2 overflow-y-auto p-3">
                {lots.map((lot, index) => (
                  <div key={lot.id} className={`rounded-2xl border p-3 ${lot.id === currentLot?.id ? 'border-cyan-300/30 bg-cyan-400/10' : 'border-white/10 bg-black/30'}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-xs font-black">{index + 1}</span>
                      <span className={`text-sm font-bold ${lot.id === currentLot?.id ? 'text-cyan-200' : 'text-white'}`}>{lot.title}</span>
                    </div>
                    <p className="ml-8 mt-1 text-xs text-slate-500">
                      {lot.status === 'sold'
                        ? `Sold: ${formatCoins(lot.current_highest_bid)}`
                        : lot.status === 'live'
                          ? `Current: ${formatCoins(lot.current_highest_bid || lot.starting_bid)}`
                          : `Starting: ${formatCoins(lot.starting_bid)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {(selectedTab === 'chat' || selectedTab === 'bids') && (
              <div className="p-4 text-center text-sm text-slate-500">
                Use the main {selectedTab === 'chat' ? 'Live Chat' : 'Bid History'} panel above.
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Custom Bid Modal */}
      {showCustomBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-purple-400/30 bg-gradient-to-br from-[#0c1a32] to-[#0a1628] shadow-[0_0_60px_rgba(168,85,247,0.2)]">
            <div className="h-1.5 bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400" />
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-400/10">
                  <Coins className="h-5 w-5 text-purple-200" />
                </div>
                <h3 className="text-xl font-black text-white">Custom Bid</h3>
              </div>

              <p className="mb-1 text-sm text-slate-400">Minimum bid: <span className="font-black text-white">{formatCoins(minimumBid)} coins</span></p>
              <p className="mb-4 text-sm text-slate-400">Your balance: <span className="font-black text-white">{formatCoins(userProfile?.troll_coins || 0)} coins</span></p>

              <div className="mb-4">
                <label className="mb-1 block text-xs text-slate-500">Bid Amount (coins)</label>
                <input
                  type="number"
                  value={customBidAmount}
                  onChange={(e) => setCustomBidAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void submitCustomBid() }}
                  placeholder={String(minimumBid)}
                  className="w-full rounded-xl border border-purple-300/20 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none placeholder:text-slate-600 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/15"
                  autoFocus
                />
              </div>

              {/* Quick amounts */}
              <div className="mb-4 flex flex-wrap gap-2">
                {[minimumBid, minimumBid + 100, minimumBid + 250, minimumBid + 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setCustomBidAmount(String(amt))}
                    className="rounded-lg border border-cyan-300/15 bg-cyan-400/8 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/15"
                  >
                    {formatCoins(amt)}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCustomBidModal(false); setCustomBidAmount('') }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitCustomBid()}
                  disabled={!customBidAmount || parseInt(customBidAmount, 10) <= 0}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition hover:from-purple-500 hover:to-cyan-400 disabled:opacity-50"
                >
                  Submit Bid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Lots Modal */}
      {showAllLotsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowAllLotsModal(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#0c1a32] to-[#0a1628] shadow-[0_0_60px_rgba(34,211,238,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400" />
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
                  <Package className="h-5 w-5 text-cyan-200" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">All Lots</h2>
                  <p className="text-xs text-slate-400">{show.title} — {lots.length} lots</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllLotsModal(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {lots.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="mx-auto mb-4 h-16 w-16 text-slate-600" />
                  <p className="text-lg font-bold text-slate-400">No lots available</p>
                  <p className="mt-1 text-sm text-slate-500">Lots will appear here when the auctioneer adds them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {lots.map((lot, index) => (
                    <div
                      key={lot.id}
                      className={`group overflow-hidden rounded-2xl border transition ${
                        lot.id === currentLot?.id
                          ? 'border-cyan-300/40 bg-cyan-400/10'
                          : 'border-white/10 bg-black/30 hover:border-cyan-300/30'
                      }`}
                    >
                      <div className="aspect-square bg-slate-900">
                        {lot.image_url ? (
                          <img src={lot.image_url} alt={lot.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-950/40 to-purple-950/40">
                            <Package className="h-10 w-10 text-cyan-200/50" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-xs font-black text-white">
                          {index + 1}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-xs font-black text-white">{lot.title}</p>
                        <p className="mt-1 text-xs font-bold">
                          {lot.status === 'sold' ? (
                            <span className="text-emerald-300">Sold: {formatCoins(lot.current_highest_bid)} TC</span>
                          ) : lot.status === 'live' ? (
                            <span className="text-yellow-300">Current: {formatCoins(lot.current_highest_bid || lot.starting_bid)} TC</span>
                          ) : (
                            <span className="text-cyan-300">Starting: {formatCoins(lot.starting_bid)} TC</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-purple-400/30 bg-gradient-to-br from-[#0c1a32] to-[#0a1628] shadow-[0_0_60px_rgba(139,92,246,0.2)]">
            <div className="h-1.5 bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400" />
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-400/10">
                  <Trophy className="h-5 w-5 text-purple-200" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Prediction Bid</h3>
                  <p className="text-xs text-slate-400">
                    {predictionType === 'winner' && 'Predict the winning bidder'}
                    {predictionType === 'price' && 'Predict the final price'}
                    {predictionType === 'combined' && 'Predict both winner and price'}
                  </p>
                </div>
              </div>

              {/* Prediction Type Selector */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {(['winner', 'price', 'combined'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPredictionType(type)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      predictionType === type
                        ? 'border-purple-300/40 bg-purple-400/20 text-purple-100'
                        : 'border-purple-300/15 bg-purple-400/5 text-purple-300 hover:bg-purple-400/10'
                    }`}
                  >
                    {type === 'winner' && '🏆 Winner'}
                    {type === 'price' && '💰 Price'}
                    {type === 'combined' && '🔮 Both'}
                  </button>
                ))}
              </div>

              {/* Winner Prediction */}
              {(predictionType === 'winner' || predictionType === 'combined') && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-bold text-slate-400">Predicted Winner (User ID)</label>
                  <input
                    type="text"
                    value={predictionWinnerId}
                    onChange={(e) => setPredictionWinnerId(e.target.value)}
                    placeholder="Enter user ID of predicted winner..."
                    className="w-full rounded-xl border border-purple-300/20 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/15"
                  />
                  <p className="mt-1 text-[10px] text-slate-600">Enter the user ID of who you think will win</p>
                </div>
              )}

              {/* Price Prediction */}
              {(predictionType === 'price' || predictionType === 'combined') && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-bold text-slate-400">Predicted Final Price (coins)</label>
                  <input
                    type="number"
                    value={predictionPrice}
                    onChange={(e) => setPredictionPrice(e.target.value)}
                    placeholder="Enter predicted price..."
                    className="w-full rounded-xl border border-purple-300/20 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-purple-300/50 focus:ring-2 focus:ring-purple-300/15"
                  />
                  <p className="mt-1 text-[10px] text-slate-600">Your best guess for the final winning bid</p>
                </div>
              )}

              {/* Rewards Info */}
              {predictions.settings && (
                <div className="mb-4 rounded-xl border border-purple-300/10 bg-purple-400/5 p-3">
                  <p className="text-xs font-bold text-purple-200">Potential Rewards (Combined):</p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-amber-300">👑 {predictions.settings.reward_crowns_combined}</span>
                    <span className="text-cyan-300">⭐ {predictions.settings.reward_xp_combined} XP</span>
                    <span className="text-purple-300">🎯 {predictions.settings.reward_event_points_combined} Pts</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPredictionModal(false);
                    setPredictionWinnerId('');
                    setPredictionPrice('');
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const winnerId = (predictionType === 'winner' || predictionType === 'combined') ? predictionWinnerId : null;
                    const price = (predictionType === 'price' || predictionType === 'combined') ? (parseInt(predictionPrice, 10) || null) : null;
                    const success = await predictions.submitPrediction(winnerId, price, predictionType);
                    if (success) {
                      setShowPredictionModal(false);
                      setPredictionWinnerId('');
                      setPredictionPrice('');
                    }
                  }}
                  disabled={predictions.loading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition hover:from-purple-500 hover:to-indigo-400 disabled:opacity-50"
                >
                  {predictions.loading ? 'Submitting...' : 'Submit Prediction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {show && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          streamTitle={show.title}
          streamUrl={`${window.location.origin}/auction/${showId}`}
          broadcasterName="Mai Troll Auction"
        />
      )}

      {/* Report Modal */}
      {show && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          streamId={show.id}
          streamTitle={show.title}
          reportedUserId={show.auctioneer_id}
        />
      )}

      {/* Bidders/viewers are redirected on auction end (see redirectOnAuctionEnd) */}
    </div>
  )
}

function CurrentLotCard({ currentLot, show }: { currentLot: AuctionLot | null; show: AuctionShow }) {
  if (!currentLot) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-10 text-center backdrop-blur-xl">
        <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="text-slate-400">No lot currently active</p>
      </div>
    )
  }

  return (
    <div className="rounded-[1.75rem] border border-cyan-400/20 bg-white/[0.04] p-4 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-[270px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35">
          {currentLot.image_url ? (
            <img src={currentLot.image_url} alt={currentLot.title} className="h-full min-h-[220px] w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-gradient-to-br from-cyan-950/40 to-purple-950/40">
              <Package className="h-16 w-16 text-cyan-200/50" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-purple-300/30 bg-purple-400/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
                Featured Lot
              </span>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                {currentLot.status}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white">{currentLot.title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">{show.category || 'Live Auction'}</p>

            {currentLot.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
                {currentLot.description}
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Condition" value={currentLot.condition || 'Verified'} />
            <Stat label="Starting Bid" value={`${formatCoins(currentLot.starting_bid)} TC`} />
            <Stat label="Increment" value={`${formatCoins(currentLot.bid_increment)} TC`} />
            <Stat label="Quantity" value={currentLot.quantity || 1} />
          </div>
        </div>
      </div>
    </div>
  )
}

function HostCard({ show, bids }: { show: AuctionShow; bids: AuctionBid[] }) {
  return (
    <div className="rounded-[1.75rem] border border-purple-300/20 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-gradient-to-br from-cyan-500 to-purple-600 text-lg font-black shadow-[0_0_25px_rgba(34,211,238,0.18)]">
            TC
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Host / Auctioneer</p>
            <h3 className="text-xl font-black">Mai Troll Auctioneer</h3>
            <p className="text-sm text-slate-400">{show.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniMetric icon={<Sparkles className="h-4 w-4 text-yellow-300" />} label="Rating" value="4.9" />
          <MiniMetric icon={<Store className="h-4 w-4 text-cyan-300" />} label="Lots" value={bids.length || 0} />
          <MiniMetric icon={<Zap className="h-4 w-4 text-purple-300" />} label="Live" value="Now" />
        </div>
      </div>
    </div>
  )
}

function TrustSafetyPanel() {
  const items = [
    {
      icon: <Lock className="h-7 w-7 text-cyan-300" />,
      title: 'Secure Payments',
      text: 'Protected by Troll Coins',
    },
    {
      icon: <BadgeCheck className="h-7 w-7 text-cyan-300" />,
      title: 'Verified Sellers',
      text: 'Identity and item reviewed',
    },
    {
      icon: <Sparkles className="h-7 w-7 text-cyan-300" />,
      title: 'Fair Auctions',
      text: 'Real-time transparent bidding',
    },
    {
      icon: <Truck className="h-7 w-7 text-cyan-300" />,
      title: 'Fast Delivery',
      text: 'Shipping handled by seller',
    },
  ]

  return (
    <div className="rounded-[1.75rem] border border-cyan-300/15 bg-white/[0.04] p-5 backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Trust & Safety</p>
      <h3 className="mt-1 font-black text-white">Our Promise to You</h3>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10">
              {item.icon}
            </div>
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  value,
  danger,
  onClick,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  danger?: boolean
  onClick?: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick || (() => toast.info(`${label} feature coming soon`))}
      disabled={loading}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition ${
        danger
          ? 'border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20'
          : 'border-white/10 bg-black/30 text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-400/10'
      } ${loading ? 'opacity-60 cursor-wait' : ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span>{label}</span>
      {value && <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-slate-300">{value}</span>}
    </button>
  )
}

function BidAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-gradient-to-br from-cyan-400 to-purple-600 text-xs font-black text-white">
      {getInitials(name)}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  )
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 text-center">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white/5">
        {icon}
      </div>
      <p className="font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words font-bold text-white">{value}</p>
    </div>
  )
}