import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'
import {
  ArrowLeft,
  Barcode,
  Bell,
  CheckCircle,
  Clock,
  Coins,
  Eye,
  EyeOff,
  Flag,
  Gavel,
  Loader2,
  Lock,
  Maximize2,
  Megaphone,
  Mic,
  MicOff,
  Pause,
  Play,
  Scan,
  Send,
  Shield,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useAuctionTimer } from '../../hooks/useAuctionTimer'
import { useAnonymousRound } from '../../hooks/useAnonymousRound'
import { usePredictionBid } from '../../hooks/usePredictionBid'

interface AuctionLot {
  [x: string]: any
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  starting_bid: number
  bid_increment: number
  current_highest_bid?: number | null
  current_highest_bidder_id?: string | null
  status: 'draft' | 'upcoming' | 'queued' | 'live' | 'paused' | 'sold' | 'unsold' | 'removed'
  countdown_end_at?: string | null
  queue_position?: number | null
  reserve_price?: number | null
  buy_now_price?: number | null
  condition?: string | null
  quantity?: number | null
}

interface AuctionShow {
  id: string
  title: string
  description?: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  livekit_room_name?: string | null
  auctioneer_id: string
}

const GLOBAL_AGORA_JOIN_LOCKS = new Set<string>()

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString()
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

export default function AuctioneerDashboard() {
  const { showId } = useParams<{ showId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [show, setShow] = useState<AuctionShow | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [auctioneerMicOn, setAuctioneerMicOn] = useState(true)
  const [auctioneerCamOn, setAuctioneerCamOn] = useState(true)
  const [auctioneerConnecting, setAuctioneerConnecting] = useState(false)
  const [agoraConnected, setAgoraConnected] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)

  // Display text (announcement) state
  const [displayText, setDisplayText] = useState('')
  const [displayTextDraft, setDisplayTextDraft] = useState('')
  const [savingDisplayText, setSavingDisplayText] = useState(false)
  const [displayTextSaved, setDisplayTextSaved] = useState(false)
  const [agoraDebugLog, setAgoraDebugLog] = useState<string[]>([])
  const MAX_DISPLAY_LENGTH = 5000

  // Live current-bid display for the auctioneer (issue #1).
  const [currentBidderName, setCurrentBidderName] = useState<string | null>(null)
  const [bidCount, setBidCount] = useState(0)

  const logAgora = useCallback((msg: string) => {
    console.log(msg)
    setAgoraDebugLog((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()} ${msg}`])
  }, [])

  const localVideoRef = useRef<HTMLDivElement | null>(null)
  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null)
  const agoraJoinedRef = useRef(false)
  const agoraConnectingRef = useRef(false)
  const activeAgoraKeyRef = useRef<string | null>(null)

  // Fetch the user's auctioneer_profiles.id to compare against show.auctioneer_id
  // (show.auctioneer_id references auctioneer_profiles.id, NOT auth.users.id)
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

  // Predictions
  const predictions = usePredictionBid(showId, isAuctioneer);

  const getAgoraToken = useCallback(async (channelName: string, uid: number, role: 'publisher' | 'audience') => {
    const { data, error } = await supabase.functions.invoke('agora-token', {
      body: { channelName, channel: channelName, uid, role, isPublisher: role === 'publisher' },
    })
    if (error) {
      // supabase.functions.invoke wraps edge function errors generically.
      // Try to extract the actual error message from the edge function response.
      const edgeError = error as any
      const details = edgeError?.context?.error?.error || edgeError?.context?.error?.details
        || edgeError?.context?.error?.hint || edgeError?.message
      throw new Error(details || 'Agora token service unavailable. Make sure AGORA_APP_ID and AGORA_APP_CERTIFICATE are set in Supabase secrets.')
    }
    if (!data?.token) throw new Error('No Agora token returned — check Supabase edge function logs')
    return data.token as string
  }, [])

  const cleanupAgora = useCallback(async () => {
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
      console.warn('Agora cleanup warning:', error)
    } finally {
      if (activeAgoraKeyRef.current) GLOBAL_AGORA_JOIN_LOCKS.delete(activeAgoraKeyRef.current)
      agoraClientRef.current = null
      agoraJoinedRef.current = false
      agoraConnectingRef.current = false
      activeAgoraKeyRef.current = null
      setAgoraConnected(false)
    }
  }, [])

  const connectAuctioneerAgora = useCallback(async () => {
    console.log('[Agora] connectAuctioneerAgora clicked', { hasShow: !!show, showId, hasUser: !!user?.id, isAuctioneer, showStatus: show?.status, auctioneerId: show?.auctioneer_id, userId: user?.id })
    if (!show) { toast.error('Cannot connect: show not loaded'); return }
    if (!showId) { toast.error('Cannot connect: missing show ID'); return }
    if (!user?.id) { toast.error('Cannot connect: not logged in'); return }
    if (!isAuctioneer) { toast.error(`Cannot connect: you are not the auctioneer (show.auctioneer_id=${show.auctioneer_id}, your id=${user?.id})`); return }
    const appId = import.meta.env.VITE_AGORA_APP_ID
    console.log('[Agora] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING')
    if (!appId) {
      toast.error('Agora App ID is not configured')
      return
    }

    const channelName = getAgoraChannelName(show)
    const uid = makeAgoraUid(user.id, 'auctioneer')
    const agoraKey = `${channelName}:${uid}:auctioneer`
    console.log('[Agora] Connection params:', { channelName, uid, agoraKey })

    if (agoraConnectingRef.current) {
      console.warn('[Agora] Already connecting')
      toast.info('Camera connection already in progress...')
      return
    }
    if (agoraJoinedRef.current || agoraClientRef.current) {
      console.warn('[Agora] Already joined or client exists')
      toast.info('Camera is already connected')
      return
    }
    if (activeAgoraKeyRef.current === agoraKey) {
      console.warn('[Agora] Same key active')
      toast.info('Already connected to this auction channel')
      return
    }
    if (GLOBAL_AGORA_JOIN_LOCKS.has(agoraKey)) {
      console.log('[Agora] Clearing stale lock')
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
    }

    GLOBAL_AGORA_JOIN_LOCKS.add(agoraKey)
    activeAgoraKeyRef.current = agoraKey
    agoraConnectingRef.current = true
    setAuctioneerConnecting(true)

    try {
      console.log('[Agora] Creating Agora client...')
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
      agoraClientRef.current = client
      await client.setClientRole('host')
      console.log('[Agora] Client role set to host')

      console.log('[Agora] Requesting token...')
      const token = await getAgoraToken(channelName, uid, 'publisher')
      console.log('[Agora] Token received:', token ? `${token.substring(0, 16)}...` : 'EMPTY')

      console.log('[Agora] Joining channel...')
      await client.join(appId, channelName, token, uid)
      console.log('[Agora] Joined channel successfully')

      console.log('[Agora] Requesting camera + mic permissions...')
      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        { AEC: true, ANS: true, AGC: true },
        { encoderConfig: '720p_2', facingMode: 'environment' as any }
      )
      console.log('[Agora] Camera + mic tracks created')

      localAudioTrackRef.current = micTrack
      localVideoTrackRef.current = camTrack

      if (localVideoRef.current) {
        camTrack.play(localVideoRef.current)
        console.log('[Agora] Playing local video')
      }

      console.log('[Agora] Publishing tracks...')
      await client.publish([micTrack, camTrack])
      console.log('[Agora] Tracks published')

      agoraJoinedRef.current = true
      setAgoraConnected(true)
      setAuctioneerMicOn(true)
      setAuctioneerCamOn(true)
      toast.success('Agora camera connected!')
    } catch (error: any) {
      console.error('[Agora] Connection failed:', error)
      const msg = error?.message || 'Failed to connect camera'
      toast.error(`Camera error: ${msg}`)
      GLOBAL_AGORA_JOIN_LOCKS.delete(agoraKey)
      activeAgoraKeyRef.current = null
      agoraConnectingRef.current = false
      agoraJoinedRef.current = false
      agoraClientRef.current = null
      localAudioTrackRef.current = null
      localVideoTrackRef.current = null
      setAgoraConnected(false)
      setAuctioneerConnecting(false)
    } finally {
      setAuctioneerConnecting(false)
      agoraConnectingRef.current = false
    }
  }, [show, showId, user?.id, isAuctioneer, getAgoraToken])

  const isInitialLoadRef = useRef(true)

  const refreshCurrentBidMeta = useCallback(async () => {
    const liveLot = lots.find((l) => l.status === 'live')
    if (!liveLot) {
      setCurrentBidderName(null)
      setBidCount(0)
      return
    }
    try {
      const [{ count }, bidderRes] = await Promise.all([
        supabase
          .from('auction_bids')
          .select('*', { count: 'exact', head: true })
          .eq('lot_id', liveLot.id),
        liveLot.current_highest_bidder_id
          ? supabase
              .from('user_profiles')
              .select('username, display_name')
              .eq('id', liveLot.current_highest_bidder_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      setBidCount(Number(count || 0))
      const p = bidderRes?.data as any
      setCurrentBidderName(p?.display_name || p?.username || null)
    } catch {
      /* best-effort */
    }
  }, [lots])

  const fetchData = useCallback(async () => {
    if (!showId) return
    // Only show loading spinner on the initial load, not on background polling
    if (isInitialLoadRef.current) {
      setLoading(true)
    }
    try {
      const [showRes, lotsRes] = await Promise.all([
        supabase.from('auction_shows').select('*').eq('id', showId).maybeSingle(),
        supabase.from('auction_lots').select('*').eq('auction_show_id', showId).order('queue_position'),
      ])
      if (showRes.data) {
        setShow(showRes.data)
        // Initialize display text from show data
        const text = (showRes.data as any).display_text || ''
        setDisplayText(text)
        setDisplayTextDraft(text)
      }
      if (lotsRes.data) setLots(lotsRes.data)
      await refreshCurrentBidMeta()
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      if (isInitialLoadRef.current) {
        setLoading(false)
        isInitialLoadRef.current = false
      }
    }
  }, [showId, refreshCurrentBidMeta])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Realtime: keep the auctioneer's current-bid display instant. The DB is the
  // source of truth; subscriptions merely trigger a refresh of authoritative state.
  useEffect(() => {
    if (!showId) return
    const channel = supabase
      .channel(`auctioneer-bids:${showId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_bids', filter: `auction_show_id=eq.${showId}` },
        () => void refreshCurrentBidMeta()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_lots', filter: `auction_show_id=eq.${showId}` },
        () => void refreshCurrentBidMeta()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [showId, refreshCurrentBidMeta])

  // Realtime subscription for display_text changes
  useEffect(() => {
    if (!showId) return
    const channel = supabase
      .channel(`auction-dashboard-display:${showId}`)
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
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showId])

  // Use refs for connect/cleanup so the effect never re-fires due to callback identity changes
  const connectAgoraRef = useRef(connectAuctioneerAgora)
  const cleanupAgoraRef = useRef(cleanupAgora)
  useEffect(() => { connectAgoraRef.current = connectAuctioneerAgora }, [connectAuctioneerAgora])
  useEffect(() => { cleanupAgoraRef.current = cleanupAgora }, [cleanupAgora])

  // Track whether auto-connect has been attempted to avoid re-firing on every show state change
  const autoConnectAttemptedRef = useRef<string | null>(null)
  // Track whether Agora is connected so we don't auto-reconnect after manual disconnect
  const agoraManuallyDisconnectedRef = useRef(false)

  useEffect(() => {
    if (show?.id && user?.id && isAuctioneer && show.status === 'live') {
      if (autoConnectAttemptedRef.current !== show.id && !agoraManuallyDisconnectedRef.current) {
        autoConnectAttemptedRef.current = show.id
        void connectAgoraRef.current()
      }
    }
    // Always return cleanup — must be outside the if so it runs on unmount
    return () => {
      autoConnectAttemptedRef.current = null
      void cleanupAgoraRef.current()
    }
    // Only re-run when these stable values change — NOT the callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show?.id, show?.status, user?.id, isAuctioneer])

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

  const startShow = async () => {
    setActionLoading(true)
    try {
      // Pick the first queued lot as the active item so viewers see it instantly.
      const firstQueued = [...lots]
        .filter((l) => l.status === 'queued' || l.status === 'upcoming')
        .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0))[0]

      const updates: any = {
        status: 'live',
        live_started_at: new Date().toISOString(),
        current_lot_id: firstQueued?.id ?? null,
      }
      const { error } = await supabase.from('auction_shows').update(updates).eq('id', showId)
      if (error) throw error

      // Mark the chosen lot live so the on-stage UI updates immediately.
      if (firstQueued) {
        await supabase.from('auction_lots').update({
          status: 'live',
          countdown_end_at: new Date(Date.now() + 30 * 1000).toISOString(),
        }).eq('id', firstQueued.id)
      }

      toast.success('Show is now live!')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to start show')
    } finally {
      setActionLoading(false)
    }
  }

  const endShow = async () => {
    if (!confirm('End this auction show?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('auction_shows').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', showId)
      if (error) throw error
      toast.success('Show ended')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to end show')
    } finally {
      setActionLoading(false)
    }
  }

  // Save display text — pushes to all viewers in real-time
  const saveDisplayText = async () => {
    if (!showId) return
    const trimmed = displayTextDraft.slice(0, MAX_DISPLAY_LENGTH)
    setSavingDisplayText(true)
    setDisplayTextSaved(false)
    try {
      const { error } = await supabase
        .from('auction_shows')
        .update({ display_text: trimmed, updated_at: new Date().toISOString() })
        .eq('id', showId)
      if (error) throw error
      setDisplayText(trimmed)
      setDisplayTextSaved(true)
      toast.success('Announcement updated — all viewers can see it now')
      setTimeout(() => setDisplayTextSaved(false), 3000)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update announcement')
    } finally {
      setSavingDisplayText(false)
    }
  }

  const activateLot = async (lotId: string) => {
    setActionLoading(true)
    try {
      const currentLiveLot = lots.find((l) => l.status === 'live')
      if (currentLiveLot) {
        await supabase.from('auction_lots').update({ status: 'unsold' }).eq('id', currentLiveLot.id)
      }
      const { error } = await supabase.from('auction_lots').update({
        status: 'live',
        countdown_end_at: new Date(Date.now() + 30 * 1000).toISOString(),
      }).eq('id', lotId)
      if (error) throw error
      await supabase.from('auction_shows').update({ current_lot_id: lotId }).eq('id', showId)
      toast.success('Lot is now live!')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate lot')
    } finally {
      setActionLoading(false)
    }
  }

  const markSold = async (lotId: string) => {
    setActionLoading(true)
    try {
      // Get current lot to find highest bidder
      const lot = lots.find(l => l.id === lotId)

      const updateData: any = {
        status: 'sold',
        sold_at: new Date().toISOString(),
      }
      if (lot?.current_highest_bidder_id) {
        updateData.winner_user_id = lot.current_highest_bidder_id
        updateData.final_bid = lot.current_highest_bid
      }
      if (lot?.status_extended) {
        updateData.status_extended = 'sold'
      }

      const { error } = await supabase.from('auction_lots').update(updateData).eq('id', lotId)
      if (error) throw error

      // The database trigger will auto-create the order and auction_wins record
      toast.success('Lot marked as sold! Order created automatically.')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark sold')
    } finally {
      setActionLoading(false)
    }
  }

  const markUnsold = async (lotId: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase.from('auction_lots').update({ status: 'unsold' }).eq('id', lotId)
      if (error) throw error
      toast.success('Lot marked as unsold')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark unsold')
    } finally {
      setActionLoading(false)
    }
  }

  const handleScanSubmit = async () => {
    if (!scanInput.trim()) return
    setScanLoading(true)
    setScanResult(null)
    try {
      const result = await supabase.rpc('scan_lot_barcode', { p_barcode: scanInput.trim() })
      const data = result.data
      if (data?.found) {
        setScanResult(data.lot)
        // If the lot is in the upcoming queue, activate it
        const lot = lots.find(l => l.id === data.lot.id)
        if (lot && (lot.status === 'queued' || lot.status === 'upcoming' || lot.status === 'draft')) {
          await activateLot(lot.id)
          toast.success(`Loaded on stage: ${lot.title}`)
        }
        setScanInput('')
      } else {
        toast.error('Lot not found')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Scan failed')
    } finally {
      setScanLoading(false)
    }
  }

  const upcomingLots = lots.filter((l) => l.status === 'queued' || l.status === 'upcoming').sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0))
  const soldLots = lots.filter((l) => l.status === 'sold')
  const isLive = show?.status === 'live'
  const currentLot = lots.find((l) => l.status === 'live') || null

  // Timer for the current lot
  const timer = useAuctionTimer(currentLot?.id ?? null, isAuctioneer)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#02030a] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-cyan-300" />
          <p className="text-slate-400">Loading auction dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#02030a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(8,13,30,0.98))]" />

      <div className={`relative z-10 border-b ${isLive ? 'border-red-500/30 bg-red-500/10' : 'border-cyan-400/20 bg-black/45'} backdrop-blur-xl`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions/studio')} className="rounded-xl border border-cyan-400/20 bg-white/5 p-2 transition hover:bg-cyan-400/10">
              <ArrowLeft className="h-5 w-5 text-cyan-300" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                {isLive && <span className="rounded-md bg-red-500 px-2 py-1 text-xs font-black tracking-wide animate-pulse">LIVE</span>}
                <h1 className="text-lg font-black sm:text-xl">{show?.title}</h1>
              </div>
              <p className="text-sm text-slate-400">{isLive ? 'Broadcasting via Agora' : 'Ready to start'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!isLive ? (
              <button onClick={startShow} disabled={actionLoading || lots.length === 0} className="rounded-xl border border-green-300/30 bg-green-500/20 px-4 py-2 font-bold text-green-100 hover:bg-green-500/30 disabled:opacity-50">
                <Play className="mr-2 inline h-4 w-4" /> Start Show
              </button>
            ) : (
              <button onClick={endShow} disabled={actionLoading} className="rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-2 font-bold text-red-100 hover:bg-red-500/30 disabled:opacity-50">
                <Pause className="mr-2 inline h-4 w-4" /> End Show
              </button>
            )}
            <button onClick={() => navigate(`/auctions/${showId}`)} className="rounded-xl border border-purple-400/20 bg-white/5 px-4 py-2 font-bold text-purple-200 hover:bg-purple-400/10">
              <Users className="mr-2 inline h-4 w-4" /> View as Viewer
            </button>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-cyan-400/25 bg-black shadow-[0_0_45px_rgba(34,211,238,0.16)]">
            <div ref={localVideoRef} className="absolute inset-0 h-full w-full bg-black" />
            {!agoraConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-cyan-950/25 to-purple-950/25">
                <Gavel className="h-16 w-16 animate-pulse text-cyan-300" />
                <p className="mt-4 text-xl font-black text-cyan-100">Agora Control Room</p>
                <p className="mt-1 text-sm text-slate-400">Click Connect Camera to broadcast via Agora.</p>
              </div>
            )}

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
              <button
                onClick={connectAuctioneerAgora}
                disabled={auctioneerConnecting || agoraConnected || !isLive}
                className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
              >
                {auctioneerConnecting ? 'Connecting...' : agoraConnected ? 'Agora Connected' : 'Connect Camera'}
              </button>

              <button onClick={toggleAuctioneerMic} disabled={!agoraConnected} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 disabled:opacity-50">
                {auctioneerMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Mic
              </button>

              <button onClick={toggleAuctioneerCam} disabled={!agoraConnected} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 disabled:opacity-50">
                {auctioneerCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />} Camera
              </button>
            </div>

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-black text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-black/70 px-3 py-1.5 text-sm text-cyan-100">
                <Users className="h-4 w-4" /> {upcomingLots.length + (currentLot ? 1 : 0)} lots
              </span>
            </div>
          </div>

          {/* Display Text Editor — Auctioneer Announcement Panel */}
          <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-cyan-300" />
                <h3 className="text-lg font-black text-white">On-Screen Announcement</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${displayTextDraft.length > MAX_DISPLAY_LENGTH ? 'text-red-400' : 'text-slate-500'}`}>
                  {displayTextDraft.length.toLocaleString()}/{MAX_DISPLAY_LENGTH.toLocaleString()}
                </span>
                {displayTextSaved && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
                    <CheckCircle className="h-3.5 w-3.5" /> Live
                  </span>
                )}
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              This text is displayed to all bidders in real-time. Write rules, lot descriptions, special instructions, or anything you want viewers to see.
            </p>
            <textarea
              value={displayTextDraft}
              onChange={(e) => setDisplayTextDraft(e.target.value.slice(0, MAX_DISPLAY_LENGTH))}
              placeholder="Type your announcement here... (e.g. 'Welcome to tonight's auction! All items ship within 3-5 business days. Minimum bid increment is 500 coins.')"
              className="w-full rounded-2xl border border-cyan-300/15 bg-black/40 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
              rows={5}
              maxLength={MAX_DISPLAY_LENGTH}
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {displayTextDraft !== displayText && (
                  <span className="text-xs font-bold text-amber-300">Unsaved changes</span>
                )}
              </div>
              <button
                onClick={saveDisplayText}
                disabled={savingDisplayText || displayTextDraft === displayText}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.25)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDisplayText ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {savingDisplayText ? 'Publishing...' : 'Publish to Viewers'}
              </button>
            </div>
          </div>

          {/* Anonymous Round Controls */}
          {isLive && (
            <div className={`rounded-3xl border p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl ${anonymousRound.state.isActive ? 'border-indigo-400/30 bg-indigo-950/20' : 'border-cyan-400/20 bg-white/[0.04]'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {anonymousRound.state.isActive ? <EyeOff className="h-5 w-5 text-indigo-300" /> : <Eye className="h-5 w-5 text-cyan-300" />}
                  <h3 className="text-lg font-black text-white">Anonymous Bid Round</h3>
                  {anonymousRound.state.isActive && (
                    <span className="flex items-center gap-1 rounded-full border border-indigo-300/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                      ACTIVE
                    </span>
                  )}
                </div>
                {anonymousRound.state.isActive && (
                  <div className="font-mono text-2xl font-black text-indigo-300">
                    {Math.floor(anonymousRound.state.secondsRemaining / 60)}:{String(anonymousRound.state.secondsRemaining % 60).padStart(2, '0')}
                  </div>
                )}
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Hide bidder identities from viewers for a configurable duration. Bidders and admins still see real names.
              </p>
              {!anonymousRound.state.isActive ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Duration:</span>
                  {[15, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => anonymousRound.startRound(sec)}
                      disabled={anonymousRound.loading}
                      className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-100 hover:bg-indigo-400/20 disabled:opacity-50"
                    >
                      {sec}s
                    </button>
                  ))}
                  <span className="text-xs text-slate-600">(max {anonymousRound.state.maxDuration}s)</span>
                </div>
              ) : (
                <button
                  onClick={() => anonymousRound.endRound()}
                  disabled={anonymousRound.loading}
                  className="rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/30 disabled:opacity-50"
                >
                  End Anonymous Round Early
                </button>
              )}
            </div>
          )}

          {/* Prediction Controls */}
          {isLive && (
            <div className="rounded-3xl border border-purple-400/20 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-purple-300" />
                  <h3 className="text-lg font-black text-white">Prediction Bids</h3>
                  {predictions.isLocked && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      LOCKED
                    </span>
                  )}
                </div>
                <span className="text-sm text-slate-400">{predictions.predictionCount} predictions</span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Let bidders and spectators predict auction outcomes. Lock predictions before the final countdown.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {!predictions.isLocked ? (
                  <button
                    onClick={() => predictions.lockPredictions()}
                    disabled={predictions.loading}
                    className="rounded-xl border border-amber-300/30 bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    <Lock className="mr-1 inline h-3.5 w-3.5" /> Lock Predictions
                  </button>
                ) : (
                  <span className="text-sm font-bold text-amber-200">Predictions are locked — no new entries allowed</span>
                )}
              </div>
            </div>
          )}

          {currentLot ? (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Currently Live - Lot #{lots.findIndex((l) => l.id === currentLot.id) + 1}</p>
                  <h2 className="mt-1 text-2xl font-black">{currentLot.title}</h2>
                  {currentLot.description && <p className="mt-2 line-clamp-3 text-sm text-slate-300">{currentLot.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => markSold(currentLot.id)} disabled={actionLoading} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-100">Sold</button>
                  <button onClick={() => markUnsold(currentLot.id)} disabled={actionLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold">Unsold</button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Starting Bid" value={`${formatCoins(currentLot.starting_bid)} TC`} />
                <Stat label="Increment" value={`${formatCoins(currentLot.bid_increment)} TC`} />
                <Stat label="Current Bid" value={`${formatCoins(currentLot.current_highest_bid || currentLot.starting_bid)} TC`} />
                <Stat label="Reserve" value={currentLot.reserve_price ? `${formatCoins(currentLot.reserve_price)} TC` : 'None'} />
              </div>

              {/* Live current-bid summary: latest highest bid, bidder, and count.
                  The main display shows only the current highest bid (not a
                  scrolling history), per the auctioneer live-show spec. */}
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 via-blue-500/10 to-purple-500/10 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Highest Bidder</p>
                  <p className="truncate text-lg font-black text-white">{currentBidderName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Current Bid</p>
                  <p className="text-lg font-black text-yellow-300">{formatCoins(currentLot.current_highest_bid || currentLot.starting_bid)} TC</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bids on Lot</p>
                  <p className="text-lg font-black text-cyan-200">{bidCount}</p>
                </div>
              </div>

              {/* Timer Controls */}
              <div className="rounded-2xl border border-cyan-300/15 bg-black/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-300" />
                    <span className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Lot Timer</span>
                  </div>
                  <div className={`font-mono text-3xl font-black ${timer.isExpired ? 'text-red-400 animate-pulse' : timer.isRunning ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {timer.formatted}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!timer.isRunning && !timer.isExpired && (
                    <button onClick={() => timer.startTimer(120)} disabled={actionLoading} className="rounded-xl border border-green-300/30 bg-green-500/20 px-3 py-1.5 text-xs font-bold text-green-100 hover:bg-green-500/30">
                      <Play className="mr-1 inline h-3 w-3" /> Start 2:00
                    </button>
                  )}
                  {!timer.isRunning && !timer.isExpired && (
                    <button onClick={() => timer.startTimer(60)} disabled={actionLoading} className="rounded-xl border border-green-300/20 bg-green-400/10 px-3 py-1.5 text-xs font-bold text-green-200 hover:bg-green-400/20">
                      <Play className="mr-1 inline h-3 w-3" /> Start 1:00
                    </button>
                  )}
                  {!timer.isRunning && !timer.isExpired && (
                    <button onClick={() => timer.startTimer(30)} disabled={actionLoading} className="rounded-xl border border-green-300/20 bg-green-400/10 px-3 py-1.5 text-xs font-bold text-green-200 hover:bg-green-400/20">
                      <Play className="mr-1 inline h-3 w-3" /> Start 0:30
                    </button>
                  )}
                  {timer.isRunning && (
                    <button onClick={() => timer.pauseTimer()} disabled={actionLoading} className="rounded-xl border border-amber-300/30 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-500/30">
                      <Pause className="mr-1 inline h-3 w-3" /> Pause
                    </button>
                  )}
                  {!timer.isRunning && timer.secondsLeft > 0 && !timer.isExpired && (
                    <button onClick={() => timer.resumeTimer()} disabled={actionLoading} className="rounded-xl border border-green-300/30 bg-green-500/20 px-3 py-1.5 text-xs font-bold text-green-100 hover:bg-green-500/30">
                      <Play className="mr-1 inline h-3 w-3" /> Resume
                    </button>
                  )}
                  {!timer.isRunning && timer.secondsLeft > 0 && (
                    <button onClick={() => timer.addTime(30)} disabled={actionLoading} className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20">
                      +30s
                    </button>
                  )}
                  {!timer.isRunning && timer.secondsLeft > 0 && (
                    <button onClick={() => timer.addTime(60)} disabled={actionLoading} className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20">
                      +60s
                    </button>
                  )}
                  {(timer.secondsLeft > 0 || timer.isExpired) && (
                    <button onClick={() => timer.resetTimer()} disabled={actionLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">{isLive ? 'No lot currently active — start a lot below' : 'Go live and activate a lot to begin'}</p>
            </div>
          )}

          {/* Scan to Stage */}
          {isLive && (
            <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
                <Scan className="h-5 w-5 text-cyan-300" />
                Scan Item to Stage
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Scan a lot barcode to automatically load it on stage.
              </p>
              <div className="flex gap-2">
                <input
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleScanSubmit() }}
                  placeholder="Scan barcode (TC-LOT-000001)..."
                  className="min-w-0 flex-1 rounded-xl border border-cyan-300/20 bg-black/35 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40"
                />
                <button
                  onClick={() => handleScanSubmit()}
                  disabled={scanLoading || !scanInput.trim()}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-500/20 px-4 py-2.5 font-bold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  {scanLoading ? 'Scanning...' : 'Scan'}
                </button>
              </div>
              {scanResult && (
                <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/5 p-3">
                  <p className="text-sm font-bold text-emerald-200">
                    ✓ Found: {scanResult.title} ({scanResult.lot_number})
                  </p>
                </div>
              )}
            </div>
          )}

          {upcomingLots.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-3 text-lg font-black">Queue ({upcomingLots.length})</h3>
              <div className="space-y-2">
                {upcomingLots.map((lot, idx) => (
                  <div key={lot.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-sm font-black text-cyan-200">{idx + 1}</span>
                      <div>
                        <p className="font-bold">{lot.title}</p>
                        <p className="text-sm text-slate-500">Starting: {formatCoins(lot.starting_bid)} TC</p>
                      </div>
                    </div>
                    {isLive && (
                      <div className="flex gap-2">
                        <button onClick={() => activateLot(lot.id)} disabled={actionLoading} className="rounded-xl border border-green-300/20 bg-green-400/10 px-3 py-1 text-sm font-bold text-green-100 hover:bg-green-400/20">Start Lot</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-cyan-400/20 bg-white/[0.04] p-5 backdrop-blur-xl">
            <h3 className="mb-3 text-lg font-black">Statistics</h3>
            <div className="space-y-2">
              <Info label="Total Lots" value={lots.length} />
              <Info label="Sold" value={soldLots.length} />
              <Info label="Status" value={isLive ? 'Live' : 'Offline'} />
            </div>
          </div>

          {soldLots.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="mb-3 text-lg font-black">Sold Items</h3>
              <div className="space-y-2">
                {soldLots.slice(0, 5).map((lot) => (
                  <div key={lot.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                    <p className="font-bold">{lot.title}</p>
                    <p className="text-sm text-emerald-200">{formatCoins(lot.current_highest_bid || lot.starting_bid)} TC</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
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

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold text-white">{value}</p>
    </div>
  )
}