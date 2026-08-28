/**
 * HytroGamingViewer — Premium gaming stream viewer page
 *
 * Route: /gaming/watch/:streamId
 *
 * Three-column layout (desktop): Left sidebar | Center stream | Right chat
 * Mobile: Full-screen stream with overlay controls + bottom sheet chat
 *
 * Supports:
 * - Agora RTC live streams (HytroGaming broadcasts)
 * - LiveKit streams (legacy broadcast)
 * - Cloudflare replay streams
 * - Saved Streams playback
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Crown,
  Eye,
  Flame,
  Lock,
  Gamepad2,
  Gift,
  Heart,
  Loader2,
  Maximize,
  MessageCircle,
  Mic,
  MicOff,
  Minimize,
  MonitorPlay,
  MoreVertical,
  Pause,
  Play,
  Radio,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Trophy,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn, formatCompactNumber } from '@/lib/utils'
import { useAgoraGamingViewer } from '@/hooks/useAgoraGamingViewer'
import { useBroadcastRealtime } from '@/hooks/useBroadcastRealtime'
import { useIsMobile } from '@/hooks/useIsMobile'
import GamingChat from '@/components/broadcast/GamingChat'
import TipBanner from '@/components/broadcast/TipBanner'
import StorageIndicator from '@/components/broadcast/StorageIndicator'
import {
  getAnonymousDisplayName,
  reserveAnonymousChatSlot,
} from '@/lib/anonymousIdentity'
import useSEO from '@/hooks/useSEO'


// ─── Types ───────────────────────────────────────────────────────────────────

interface StreamData {
  id: string
  title: string
  broadcaster_id: string
  broadcaster_name?: string
  broadcaster_avatar?: string | null
  broadcaster_level?: number
  description?: string | null
  category: string
  is_live: boolean
  status: string
  current_viewers: number
  viewer_count: number
  total_likes?: number
  started_at: string | null
  ended_at: string | null
  agora_channel?: string | null
  livekit_room_name?: string | null
  playback_url?: string | null
  cloudflare_playback_url?: string | null
  game_title?: string | null
  thumbnail_url?: string | null
  // Password protection fields
  is_protected?: boolean
}

interface TopSupporter {
  rank: number
  name: string
  user_id: string
  avatar_url?: string | null
  coins_sent: number
}

interface TipItem {
  id: string
  name: string
  icon: string
  cost: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIP_ITEMS: TipItem[] = [
  { id: 'rose', name: 'Rose', icon: '🌹', cost: 10 },
  { id: 'troll_face', name: 'Troll Face', icon: '👹', cost: 25 },
  { id: 'fire', name: 'Fire', icon: '🔥', cost: 50 },
  { id: 'crown', name: 'Crown', icon: '👑', cost: 100 },
  { id: 'dragon', name: 'Dragon', icon: '🐉', cost: 250 },
  { id: 'treasure', name: 'Treasure', icon: '💎', cost: 500 },
]

const COIN_PACKS = [
  { id: '1', coins: 100, price: 1 },
  { id: '2', coins: 300, price: 3 },
  { id: '3', coins: 500, price: 5 },
  { id: '4', coins: 1000, price: 10, popular: true },
  { id: '5', coins: 2500, price: 25 },
  { id: '6', coins: 5000, price: 50 },
]

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HytroGamingViewer() {
  const params = useParams<{ streamId?: string; id?: string }>()
  const streamId = params.streamId || params.id
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isMobile, hasMounted } = useIsMobile()

  const [stream, setStream] = useState<StreamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [streamEnded, setStreamEnded] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [topSupporters, setTopSupporters] = useState<TopSupporter[]>([])
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showCoinStore, setShowCoinStore] = useState(false)
  const [showTipPanel, setShowTipPanel] = useState(false)
  const [selectedTip, setSelectedTip] = useState<TipItem | null>(null)
  const [sendingTip, setSendingTip] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [enteredPassword, setEnteredPassword] = useState('')
  const [validatingPassword, setValidatingPassword] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Kick guard: check on page load if user was kicked from this stream
  useEffect(() => {
    if (!streamId || !user?.id) return

    const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000
    const getKickStorageKey = (sid: string, uid: string) => `kick_${sid}_${uid}`

    const checkKickGuard = async () => {
      try {
        // Check localStorage for recent kick
        const raw = localStorage.getItem(getKickStorageKey(streamId, user.id))
        if (raw) {
          const kickData = JSON.parse(raw)
          if (kickData && typeof kickData.timestamp === 'number') {
            const timeSinceKick = Date.now() - kickData.timestamp
            if (timeSinceKick < KICK_BAN_DURATION_MS) {
              const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
              const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
              toast.error(`You were kicked from this stream and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
              navigate('/', { replace: true })
              return
            }
          }
        }

        // Check stream_kicks table
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
            toast.error(`You were kicked from this stream and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
            localStorage.setItem(getKickStorageKey(streamId, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId,
              reason: 'Kicked by moderator'
            }))
            navigate('/', { replace: true })
          }
        }
      } catch (err) {
        console.warn('[HytroGamingViewer] Kick guard check failed:', err)
      }
    }

    void checkKickGuard()
  }, [streamId, user?.id, navigate])

// Fetch stream data
   useEffect(() => {
     let mounted = true
     const fetchStream = async () => {
       if (!streamId) return
       setLoading(true)
       try {
         const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(streamId)

         let streamData = null
         let broadcasterProfile = null

         if (isUUID) {
           const { data, error } = await supabase
             .from('streams')
             .select('*')
             .eq('id', streamId)
             .maybeSingle()

           if (error || !data) {
             setStream(null)
             setLoading(false)
             return
           }
           streamData = data

           const { data: profile } = await supabase
             .from('user_profiles')
             .select('id, username, avatar_url, level')
             .eq('id', (data as any).user_id)
             .maybeSingle()
           broadcasterProfile = profile
         } else {
           // Username lookup: find user by username, then their live stream
           const { data: userProfile } = await supabase
             .from('user_profiles')
             .select('id')
             .eq('username', streamId)
             .maybeSingle()

           if (!userProfile?.id) {
             setStream(null)
             setLoading(false)
             return
           }

           // Find their active gaming stream
           const { data, error } = await supabase
             .from('streams')
             .select('*')
             .eq('user_id', userProfile.id)
             .eq('category', 'gaming')
             .eq('status', 'live')
             .maybeSingle()

           if (error || !data) {
             setStream(null)
             setLoading(false)
             return
           }
           streamData = data

           const { data: profile } = await supabase
             .from('user_profiles')
             .select('id, username, avatar_url, level')
             .eq('id', userProfile.id)
             .maybeSingle()
           broadcasterProfile = profile
}

          if (!mounted) return

          const resolved: StreamData = {
            id: (streamData as any).id,
            title: (streamData as any).title || 'Live Gaming Stream',
            broadcaster_id: (streamData as any).user_id,
            broadcaster_name: broadcasterProfile?.username || 'Gamer',
            broadcaster_avatar: broadcasterProfile?.avatar_url || null,
            broadcaster_level: broadcasterProfile?.level || 1,
            description: (streamData as any).description || null,
            category: (streamData as any).category || 'gaming',
            is_live: Boolean((streamData as any).is_live),
            status: (streamData as any).status || 'offline',
            current_viewers: (streamData as any).current_viewers || 0,
            viewer_count: (streamData as any).viewer_count || 0,
            total_likes: (streamData as any).total_likes || 0,
            started_at: (streamData as any).started_at,
            ended_at: (streamData as any).ended_at,
            agora_channel: (streamData as any).agora_channel || null,
            livekit_room_name: (streamData as any).livekit_room_name || null,
            playback_url: (streamData as any).playback_url || (streamData as any).cloudflare_playback_url || null,
            cloudflare_playback_url: (streamData as any).cloudflare_playback_url || null,
            game_title: (streamData as any).game_title || null,
            thumbnail_url: (streamData as any).thumbnail_url || null,
            is_protected: (streamData as any).is_protected ?? false,
          }

          setStream(resolved)
          setIsHost((streamData as any).user_id === user?.id)
          setLikeCount((streamData as any).total_likes || 0)

        // Fetch top supporters
        const { data: topGifts } = await supabase
          .from('stream_gifts')
          .select('sender_id, amount')
          .eq('stream_id', streamId)
          .order('amount', { ascending: false })
          .limit(3)

        if (topGifts && topGifts.length > 0 && mounted) {
          const senderIds = topGifts.map((g: any) => g.sender_id).filter(Boolean)
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', senderIds)

          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
          setTopSupporters(
            topGifts.map((g: any, i: number) => ({
              rank: i + 1,
              name: profileMap.get(g.sender_id)?.username || 'Viewer',
              user_id: g.sender_id,
              avatar_url: profileMap.get(g.sender_id)?.avatar_url || null,
              coins_sent: g.amount || 0,
            }))
          )
        }
      } catch (err: any) {
        console.error('[HytroGamingViewer] Failed to fetch stream:', err)
        toast.error('Failed to load stream')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchStream()
    return () => { mounted = false }
  }, [streamId, user?.id])

  // Realtime subscription
  const realtime = useBroadcastRealtime({
    streamId: streamId || '',
    userId: user?.id,
    initialStream: stream,
    onStreamEnd: () => setStreamEnded(true),
  })

  const currentStream = realtime.stream || stream
  const isLive = currentStream?.status === 'live' || currentStream?.is_live === true
  const viewerCount = currentStream?.current_viewers || currentStream?.viewer_count || 0
  const channelName = currentStream?.agora_channel || currentStream?.id

  // Check password protection for public streams
  useEffect(() => {
    if (!currentStream || !streamId) return
    
    const protectedStream = (currentStream as any).is_protected === true
    const sessionAccess = sessionStorage.getItem(`gaming_stream_access_${streamId}`)
    
    // If stream is protected and user hasn't provided access, show password modal
    // Host always has access
    if (!isHost && protectedStream && sessionAccess !== 'granted') {
      setShowPasswordModal(true)
      setHasAccess(false)
    } else {
      setHasAccess(true)
    }
  }, [currentStream, streamId, isHost])

  const handleValidatePassword = useCallback(async () => {
    if (!streamId) return
    if (!enteredPassword.trim()) {
      toast.error('Please enter a password')
      return
    }
    
    setValidatingPassword(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('validate_broadcast_password', {
        p_stream_id: streamId,
        p_password: enteredPassword,
      })
      
      if (rpcError) throw rpcError
      
      if (data?.success === true) {
        sessionStorage.setItem(`gaming_stream_access_${streamId}`, 'granted')
        setHasAccess(true)
        setShowPasswordModal(false)
        toast.success('Access granted!')
      } else {
        toast.error(data?.error || 'Incorrect password')
      }
    } catch (err: any) {
      console.error('[HytroGamingViewer] Password validation error:', err)
      toast.error(err?.message || 'Failed to validate password')
    } finally {
      setValidatingPassword(false)
    }
  }, [enteredPassword, streamId])

  // SEO meta tags for stream page (accessible to Google for indexing)
  const streamUrl = currentStream
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://MaiTroll.com'}/live/${encodeURIComponent(currentStream.broadcaster_name || streamId)}`
    : `${typeof window !== 'undefined' ? window.location.origin : 'https://MaiTroll.com'}/gaming/watch/${streamId}`
  useSEO({
    title: currentStream
      ? `${currentStream.broadcaster_name || 'Gamer'} is LIVE on HytroGaming | Mai Troll`
      : 'HytroGaming Stream | Mai Troll',
    description: currentStream
      ? `${currentStream.title} — Watch ${currentStream.broadcaster_name || 'a gamer'} live on HytroGaming by Mai Troll. ${currentStream.game_title ? `Playing ${currentStream.game_title}. ` : ''}${currentStream.description || ''}`
      : 'Watch live gaming streams on HytroGaming by Mai Troll.',
    ogImage: currentStream?.thumbnail_url || currentStream?.broadcaster_avatar || undefined,
    ogType: isLive ? 'video.other' : 'website',
    canonical: streamUrl,
    structuredData: currentStream ? {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: currentStream.title || 'Live Gaming Stream',
      description: currentStream.description || `Watch ${currentStream.broadcaster_name || 'a gamer'} live on HytroGaming`,
      thumbnailUrl: currentStream.thumbnail_url || currentStream.broadcaster_avatar || undefined,
      uploadDate: currentStream.started_at || new Date().toISOString(),
      url: streamUrl,
      embedUrl: streamUrl,
      author: {
        '@type': 'Person',
        name: currentStream.broadcaster_name || 'Gamer',
        url: `${typeof window !== 'undefined' ? window.location.origin : 'https://MaiTroll.com'}/profile/${encodeURIComponent(currentStream.broadcaster_name || '')}`,
      },
      ...(isLive && {
        isLiveBroadcast: true,
        publication: {
          '@type': 'BroadcastEvent',
          isLiveBroadcast: true,
          startDate: currentStream.started_at || new Date().toISOString(),
        },
      }),
    } : undefined,
  })

  // Agora viewer — works for both authenticated and guest users
  // Use a stable identity that doesn't change between renders
  const stableViewerId = useRef<string | null>(null)
  if (!stableViewerId.current) {
    stableViewerId.current = user?.id || `guest-${streamId}-${getAnonymousDisplayName()}`
  }
  // Update identity if user logs in/out
  if (user?.id && stableViewerId.current.startsWith('guest-')) {
    stableViewerId.current = user.id
  }

  const agora = useAgoraGamingViewer()

  // Join Agora channel — only re-join when channel or identity actually changes
  const joinRef = useRef(agora.join)
  const leaveRef = useRef(agora.leave)
  joinRef.current = agora.join
  leaveRef.current = agora.leave

  // Join Agora channel — only re-join when channel or identity actually changes
  // Protected streams require hasAccess before joining
  const joinedChannelRef = useRef<string | null>(null)
  useEffect(() => {
    if (!channelName || isHost) {
      if (joinedChannelRef.current) {
        void leaveRef.current()
        joinedChannelRef.current = null
      }
      return
    }
    if (!hasAccess) {
      if (joinedChannelRef.current) {
        void leaveRef.current()
        joinedChannelRef.current = null
      }
      return
    }
    const identity = stableViewerId.current!
    const channelKey = `${channelName}:${identity}`
    if (joinedChannelRef.current === channelKey) return // already joined this channel
    void joinRef.current(channelName, identity)
    joinedChannelRef.current = channelKey
    return () => {
      void leaveRef.current()
      joinedChannelRef.current = null
    }
  }, [channelName, isHost, hasAccess])

  // Handlers
  const handleLike = useCallback(async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)))

    if (!currentStream?.id) return
    try {
      if (newLiked) {
        await supabase.rpc('like_stream', { p_stream_id: currentStream.id })
      } else {
        await supabase.from('stream_likes').delete().eq('stream_id', currentStream.id).eq('user_id', user?.id)
      }
    } catch (err) {
      console.warn('[HytroGamingViewer] Like toggle failed:', err)
    }

    // Every 10 likes milestone — notify streamer via broadcast
    const nextCount = newLiked ? likeCount + 1 : likeCount
    if (newLiked && nextCount > 0 && nextCount % 10 === 0) {
      try {
        await supabase.functions.invoke('send-message', {
          body: {
            type: 'broadcast',
            event: 'like_milestone',
            channel: `stream:${currentStream.id}`,
            payload: { like_count: nextCount, stream_id: currentStream.id },
          },
        })
      } catch {
        // non-critical
      }
    }
  }, [liked, likeCount, currentStream?.id, user?.id])

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/gaming/watch/${streamId}`
    const shareText = `Watch ${currentStream?.broadcaster_name || 'this streamer'} live on HytroGaming! ${currentStream?.title || ''}`
    if (navigator.share) {
      try {
        await navigator.share({ title: currentStream?.title || 'HytroGaming Stream', text: shareText, url })
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard!')
      } catch {
        toast.error('Failed to copy link')
      }
    }
  }, [streamId, currentStream])

  const handleTip = useCallback(async (item: TipItem) => {
    if (!user) {
      toast.error('Sign in to send tips')
      return
    }
    if (!currentStream?.broadcaster_id) {
      toast.error('Cannot tip this stream')
      return
    }
    if (item.cost > (profile?.troll_coins || 0)) {
      toast.error('Not enough Troll Coins')
      setShowCoinStore(true)
      return
    }

    setSendingTip(true)
    try {
      const { error } = await supabase.rpc('send_gift_in_stream', {
        p_sender_id: user.id,
        p_receiver_id: currentStream.broadcaster_id,
        p_stream_id: currentStream.id,
        p_gift_id: item.id,
        p_quantity: 1,
        p_metadata: {
          coin_cost: item.cost,
          item_name: item.name,
          icon: item.icon,
          is_tip: true,
          source: 'hytrogaming_tip',
        },
      })
      if (error) throw error
      toast.success(`Sent ${item.icon} ${item.name} (${item.cost} coins)`)
      setShowTipPanel(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send tip')
    } finally {
      setSendingTip(false)
    }
  }, [user, currentStream, profile])

  const handleFollow = useCallback(async () => {
    if (!user) {
      toast.error('Sign in to follow')
      return
    }
    if (!currentStream?.broadcaster_id) return
    try {
      await supabase.from('user_follows').upsert({
        follower_id: user.id,
        following_id: currentStream.broadcaster_id,
      }, { onConflict: 'follower_id,following_id' })
      toast.success(`Following ${currentStream.broadcaster_name}!`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to follow')
    }
  }, [user, currentStream])

  const handleCoinPurchase = useCallback(async (pack: typeof COIN_PACKS[0]) => {
    if (!user) {
      toast.error('Sign in to buy coins')
      return
    }
    setShowCoinStore(false)
    try {
      const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
      if (!paypalClientId) {
        toast.error('Payments not configured')
        return
      }

      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: {
          userId: user.id,
          coins: pack.coins,
          amountUsd: pack.price,
          packageId: pack.id,
          packageName: `${pack.coins} Troll Coins`,
          purchaseType: 'coin_store',
        },
      })
      if (error || !data?.approvalUrl) throw new Error('Failed to create order')
      window.location.href = data.approvalUrl
    } catch (err: any) {
      toast.error(err?.message || 'Payment failed')
    }
  }, [user])


  // Loading state
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#02040a]">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
          <p className="mt-4 text-sm font-bold text-slate-400">Loading stream...</p>
        </div>
      </div>
    )
  }

  // Password protected - show password modal for non-hosts
  if (showPasswordModal && !hasAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-purple-500/30 bg-slate-900 p-6">
          <div className="flex items-center gap-3 text-purple-400">
            <Lock className="h-6 w-6" />
            <h2 className="text-xl font-bold text-white">Protected Stream</h2>
          </div>

          <p className="text-sm text-gray-400">
            This gaming stream is password protected. Please enter the password to join.
          </p>

          <input
            type="password"
            value={enteredPassword}
            onChange={(event) => setEnteredPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleValidatePassword()
              }
            }}
            placeholder="Enter password..."
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            autoFocus
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-xl bg-white/10 py-3 text-white transition-colors hover:bg-white/20"
            >
              Go Back
            </button>

            <button
              type="button"
              onClick={() => void handleValidatePassword()}
              disabled={validatingPassword}
              className="flex-1 rounded-xl bg-purple-600 py-3 text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {validatingPassword ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Join Stream'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentStream) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#02040a] px-6 text-center">
        <div>
          <WifiOff className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-black text-white">Stream not found</h1>
          <p className="mt-2 text-sm text-slate-400">This stream may have ended or the link is invalid.</p>
          <button
            onClick={() => navigate('/hytrogaming')}
            className="mt-6 rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-black text-white"
          >
            Browse Streams
          </button>
        </div>
      </div>
    )
  }

  // Ended stream → redirect to stream summary
  if (streamEnded || currentStream.status === 'ended') {
    return <Navigate to={`/broadcast/summary/${currentStream.id || streamId}`} replace />
  }

  // ─── Desktop Layout ──────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#02040a] text-white">
        {/* Tip Banner — shows when gifts are sent */}
        <TipBanner streamId={streamId || ''} />

        {/* ── Left Sidebar ── */}
        <aside className={cn(
          'flex shrink-0 flex-col border-r border-white/5 bg-[#0a0e17] transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}>
          {/* Logo / Collapse */}
          <div className="flex items-center justify-between border-b border-white/5 p-3">
            {!sidebarCollapsed && (
              <button onClick={() => navigate('/hytrogaming')} className="flex items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-cyan-400" />
                <span className="text-lg font-black italic">
                  <span className="text-cyan-300">Troll</span>{' '}
                  <span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">City</span>
                </span>
              </button>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-2">
            <SidebarItem icon={<Gamepad2 className="h-5 w-5" />} label="Home" collapsed={sidebarCollapsed} onClick={() => navigate('/home')} />
            <SidebarItem icon={<Flame className="h-5 w-5" />} label="Browse" collapsed={sidebarCollapsed} onClick={() => navigate('/hytrogaming')} active />
            <SidebarItem icon={<Users className="h-5 w-5" />} label="Following" collapsed={sidebarCollapsed} />
            <SidebarItem icon={<Radio className="h-5 w-5" />} label="HytroGaming" collapsed={sidebarCollapsed} onClick={() => navigate('/hytrogaming')} />
            <SidebarItem icon={<Video className="h-5 w-5" />} label="Clips" collapsed={sidebarCollapsed} />
            <SidebarItem icon={<Trophy className="h-5 w-5" />} label="Events" collapsed={sidebarCollapsed} />
            <SidebarItem icon={<Crown className="h-5 w-5" />} label="Leaderboards" collapsed={sidebarCollapsed} />
            <SidebarItem icon={<Coins className="h-5 w-5" />} label="Store" collapsed={sidebarCollapsed} onClick={() => navigate('/store')} />

            {!sidebarCollapsed && (
              <>
                <div className="my-3 border-t border-white/5" />
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Top Streamers</p>
                <TopStreamersList streamId={streamId || ''} />
              </>
            )}
          </nav>

          {/* Troll Coins Card */}
          {!sidebarCollapsed && (
            <div className="border-t border-white/5 p-3">
              <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-400" />
                  <span className="text-xs font-black text-amber-200">TROLL COINS</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Support your favorite creators and unlock exclusive rewards.</p>
                <button
                  onClick={() => setShowCoinStore(true)}
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-xs font-black text-white transition hover:from-amber-400 hover:to-orange-400"
                >
                  Buy Troll Coins
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Center Stream Area ── */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="relative z-50 flex items-center justify-between border-b border-white/5 bg-[#0a0e17]/80 px-4 py-2 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/10" style={{ overflow: 'visible' }}>
                {currentStream.broadcaster_avatar ? (
                  <img src={currentStream.broadcaster_avatar} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center rounded-xl">
                    <Gamepad2 className="h-5 w-5 text-cyan-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black">{currentStream.title}</h1>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="truncate font-bold text-cyan-300">{currentStream.broadcaster_name}</span>
                  <ShieldCheck className="h-3 w-3 shrink-0 text-cyan-400" />
                  {currentStream.game_title && <span className="hidden text-slate-500 sm:inline">• {currentStream.game_title}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isHost && (
                <StorageIndicator userId={user?.id} storageType="hytro_gaming" />
              )}
              {isLive && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  LIVE
                </span>
              )}
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                <Eye className="h-3.5 w-3.5 text-cyan-300" />
                {formatCompactNumber(viewerCount)}
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Stream Player */}
          <div className="relative flex-1 bg-black">
            <StreamPlayer
              stream={currentStream}
              agora={agora}
              isHost={isHost}
            />

            {/* Streamer info overlay — bottom left */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl">
              {currentStream.broadcaster_avatar ? (
                <img src={currentStream.broadcaster_avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-purple-300/30 bg-purple-500/20 text-[10px] font-black">
                  {(currentStream.broadcaster_name || 'H').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-[10px] font-black uppercase">{currentStream.broadcaster_name}</p>
                <div className="mt-0.5 h-1.5 w-24 rounded-full bg-white/15">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right Panel: Chat + Actions ── */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-white/5 bg-[#0a0e17]">
          {/* Action Buttons */}
          <div className="flex items-center gap-1 border-b border-white/5 p-2">
            <ActionButton icon={<Heart className={cn('h-4 w-4', liked && 'fill-pink-400 text-pink-400')} />} label="Like" onClick={handleLike} />
            <ActionButton icon={<Gift className="h-4 w-4" />} label="Tips" onClick={() => setShowTipPanel(!showTipPanel)} active={showTipPanel} />
            <ActionButton icon={<UserPlus className="h-4 w-4" />} label="Follow" />
            <ActionButton icon={<Share2 className="h-4 w-4" />} label="Share" />
            <ActionButton icon={<MoreVertical className="h-4 w-4" />} label="More" />
          </div>

          {/* Tips Panel */}
          {showTipPanel && (
            <div className="border-b border-white/5 bg-[#0d1220] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Send Tips</p>
              <div className="grid grid-cols-3 gap-2">
                {TIP_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTip(item)}
                    disabled={sendingTip}
                    className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-amber-400/30 hover:bg-amber-400/10 disabled:opacity-50"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-[9px] font-bold text-slate-300">{item.name}</span>
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
                      <Coins className="h-2.5 w-2.5" />{item.cost}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top Supporters */}
{topSupporters.length > 0 && (
             <div className="border-b border-white/5 p-3">
               <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Top Supporters</p>
               <div className="space-y-2">
                 {topSupporters.map((supporter) => (
                   <div key={supporter.rank} className="flex items-center gap-2">
                     <span className="text-xs font-bold text-slate-500">{supporter.rank}.</span>
{supporter.avatar_url ? (
                        <img src={supporter.avatar_url} alt="" className="h-6 w-6 rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-6 w-6 place-items-center rounded-lg bg-purple-500/20 text-[8px] font-black">
                          {supporter.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                     <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-300">{supporter.name}</span>
                     <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
                       <Coins className="h-2.5 w-2.5" />{formatCompactNumber(supporter.coins_sent)}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
           )}

          {/* Stream Stats */}
          <div className="border-b border-white/5 p-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<Eye className="h-3.5 w-3.5 text-cyan-300" />} label="Viewers" value={formatCompactNumber(viewerCount)} />
              <StatCard icon={<Clock className="h-3.5 w-3.5 text-emerald-300" />} label="Duration" value={getDuration(currentStream.started_at)} />
              <StatCard icon={<Heart className="h-3.5 w-3.5 text-pink-300" />} label="Likes" value={formatCompactNumber(likeCount)} />
              <StatCard icon={<Gamepad2 className="h-3.5 w-3.5 text-purple-300" />} label="Game" value={currentStream.game_title || 'Gaming'} />
            </div>
          </div>

          {/* About Creator */}
          <div className="border-b border-white/5 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">About Creator</p>
            <div className="flex items-center gap-3">
              {currentStream.broadcaster_avatar ? (
                <img src={currentStream.broadcaster_avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-purple-300/30 bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black">
                  {(currentStream.broadcaster_name || 'H').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{currentStream.broadcaster_name}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">LVL {currentStream.broadcaster_level || 1}</span>
                </div>
              </div>
            </div>
            {currentStream.description && (
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{currentStream.description}</p>
            )}
          </div>

          {/* Live Chat */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <MessageCircle className="h-4 w-4" />
                Live Chat
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Users className="h-3 w-3" />
                {formatCompactNumber(viewerCount)}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <GamingChat streamId={streamId || ''} className="h-full" guestChatLimit={5} canPinMessages={isHost || !!(profile && (profile.role === 'admin' || profile.is_admin || profile.is_superadmin || profile.role === 'owner' || profile.is_staff || profile.is_troll_officer || profile.is_lead_officer))} hostId={currentStream.broadcaster_id} />
            </div>
          </div>
        </aside>

        {/* Coin Store Modal */}
        {showCoinStore && (
          <CoinStoreModal
            onClose={() => setShowCoinStore(false)}
            onPurchase={handleCoinPurchase}
            currentCoins={profile?.troll_coins || 0}
          />
        )}
      </div>
    )
  }

  // ─── Mobile Layout ──────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] flex-col bg-[#02040a] text-white">
      {/* Tip Banner — shows when gifts are sent */}
      <TipBanner streamId={streamId || ''} />

      {/* Mobile Top Bar */}
      <header className="flex items-center justify-between bg-black/80 px-3 py-2 backdrop-blur-xl" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => navigate(-1)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs font-black">{currentStream.title}</p>
            <p className="truncate text-[10px] text-cyan-300">{currentStream.broadcaster_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Eye className="h-3 w-3" />
            {formatCompactNumber(viewerCount)}
          </div>
        </div>
      </header>

      {/* Mobile Stream Player — battle-style: screenshare top 75%, camera overlay on screenshare, streamer info bottom */}
      <div className="relative flex flex-col flex-1 min-h-0 bg-black">
        {/* Screen share area — top 75% */}
        <div className="relative flex-none" style={{ height: '75%' }}>
          <StreamPlayer stream={currentStream} agora={agora} isHost={isHost} isMobile={true} />
        </div>

        {/* Bottom strip — remaining 25% streamer info */}
        <div className="relative flex-none flex items-center gap-3 px-3 py-2" style={{ height: '25%' }}>
          {currentStream.broadcaster_avatar ? (
            <img src={currentStream.broadcaster_avatar} alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-cyan-400/50 object-cover" />
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-cyan-400/50 bg-purple-500/20 text-xs font-black">
              {(currentStream.broadcaster_name || 'H').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{currentStream.broadcaster_name}</p>
            {currentStream.game_title && (
              <p className="truncate text-[10px] text-slate-400">{currentStream.game_title}</p>
            )}
          </div>
          <button
            onClick={handleFollow}
            className="shrink-0 rounded-full bg-cyan-500/20 px-3 py-1.5 text-[10px] font-black text-cyan-300 border border-cyan-400/30 active:scale-95"
          >
            Follow
          </button>
        </div>

        {/* TikTok-style right action bar — positioned at the split between video and bottom strip */}
        <div className="absolute bottom-[25%] right-3 z-20 flex translate-y-1/2 flex-col items-center gap-3">
          {/* Like button — big, animated, powerful */}
          <button onClick={handleLike} className="flex flex-col items-center gap-1">
            <div className={cn(
              "grid h-12 w-12 place-items-center rounded-full backdrop-blur-sm transition-all active:scale-90",
              liked
                ? "bg-pink-500/40 shadow-[0_0_20px_rgba(236,72,153,0.5)]"
                : "bg-black/40"
            )}>
              <Heart className={cn('h-7 w-7 transition-all', liked && 'fill-pink-400 text-pink-400 scale-110')} />
            </div>
            <span className={cn(
              "text-[9px] font-black drop-shadow",
              liked ? "text-pink-300" : "text-white/80"
            )}>{formatCompactNumber(likeCount)}</span>
          </button>
          <MobileAction
            icon={<Gift className="h-7 w-7 text-amber-400" />}
            label="Tips"
            onClick={() => setShowTipPanel(true)}
          />
          <MobileAction
            icon={<Share2 className="h-7 w-7" />}
            label="Share"
            onClick={handleShare}
          />
        </div>

        {/* Chat overlay toggle */}
        <button
          onClick={() => setShowMobileChat(true)}
          className="absolute bottom-[calc(25%+0.75rem)] left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      {/* Mobile Chat Bottom Sheet */}
      {showMobileChat && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowMobileChat(false)}>
          <div
            className="flex h-[60vh] flex-col rounded-t-3xl bg-[#0a0e17]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <MessageCircle className="h-4 w-4 text-cyan-300" />
                Live Chat
              </div>
              <button onClick={() => setShowMobileChat(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <GamingChat streamId={streamId || ''} className="h-full" guestChatLimit={5} canPinMessages={isHost || !!(profile && (profile.role === 'admin' || profile.is_admin || profile.is_superadmin || profile.role === 'owner' || profile.is_staff || profile.is_troll_officer || profile.is_lead_officer))} hostId={currentStream.broadcaster_id} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tips Panel */}
      {showTipPanel && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowTipPanel(false)}>
          <div
            className="rounded-t-3xl bg-[#0a0e17] p-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Send Tips</p>
              <button onClick={() => setShowTipPanel(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIP_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTip(item)}
                  disabled={sendingTip}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 transition active:scale-95 disabled:opacity-50"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] font-bold text-slate-300">{item.name}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                    <Coins className="h-3 w-3" />{item.cost}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowTipPanel(false); setShowCoinStore(true); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-black text-white"
            >
              <Coins className="h-4 w-4" />
              Buy Troll Coins
            </button>
          </div>
        </div>
      )}

      {/* Coin Store Modal */}
      {showCoinStore && (
        <CoinStoreModal
          onClose={() => setShowCoinStore(false)}
          onPurchase={handleCoinPurchase}
          currentCoins={profile?.troll_coins || 0}
        />
      )}
    </div>
  )
}

// ─── Stream Player Component ─────────────────────────────────────────────────

function StreamPlayer({
  stream,
  agora,
  isHost,
  isMobile,
}: {
  stream: StreamData
  agora: ReturnType<typeof useAgoraGamingViewer>
  isHost: boolean
  isMobile?: boolean
}) {
  const videoRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const audioBlockedRef = useRef(false)

  // Play Agora video track (screen share / main)
  useEffect(() => {
    const node = videoRef.current
    if (!node || !agora.remoteVideoTrack) return
    try {
      node.innerHTML = ''
      agora.remoteVideoTrack.play(node, { fit: 'contain' })
    } catch (err) {
      console.warn('[StreamPlayer] Failed to play video:', err)
    }
    return () => {
      node.innerHTML = ''
      try { (agora.remoteVideoTrack as any)?.stop() } catch { /* ignore */ }
    }
  }, [agora.remoteVideoTrack])

  // Play camera overlay track
  useEffect(() => {
    const node = cameraRef.current
    if (!node || !agora.remoteCameraTrack) return
    try {
      node.innerHTML = ''
      agora.remoteCameraTrack.play(node, { fit: 'cover' })
    } catch (err) {
      console.warn('[StreamPlayer] Failed to play camera:', err)
    }
    return () => {
      node.innerHTML = ''
      try { (agora.remoteCameraTrack as any)?.stop() } catch { /* ignore */ }
    }
  }, [agora.remoteCameraTrack])

  // Play microphone audio track (Track C)
  useEffect(() => {
    const track = agora.remoteAudioTrack
    if (!track) return
    try {
      if (!muted) {
        const audioTrack = track as any
        if (audioTrack.play) audioTrack.play()
        setAudioBlocked(false)
        audioBlockedRef.current = false
      }
    } catch (err) {
      console.warn('[StreamPlayer] Failed to play mic audio:', err)
      setAudioBlocked(true)
      audioBlockedRef.current = true
    }
  }, [agora.remoteAudioTrack, muted])

  // Play screen share / game audio track (Track D)
  useEffect(() => {
    const track = agora.remoteScreenAudioTrack
    if (!track) return
    try {
      if (!muted) {
        const screenAudioTrack = track as any
        if (screenAudioTrack.play) screenAudioTrack.play()
        setAudioBlocked(false)
        audioBlockedRef.current = false
      }
    } catch (err) {
      console.warn('[StreamPlayer] Failed to play screen audio:', err)
      setAudioBlocked(true)
      audioBlockedRef.current = true
    }
  }, [agora.remoteScreenAudioTrack, muted])

  // Sync mute state across BOTH audio tracks
  useEffect(() => {
    const volume = muted ? 0 : 100
    if (agora.remoteAudioTrack) {
      try {
        ;(agora.remoteAudioTrack as any).setVolume(volume)
      } catch { /* ignore */ }
    }
    if (agora.remoteScreenAudioTrack) {
      try {
        ;(agora.remoteScreenAudioTrack as any).setVolume(volume)
      } catch { /* ignore */ }
    }
  }, [muted, agora.remoteAudioTrack, agora.remoteScreenAudioTrack])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setFullscreen(false)
    }
  }, [])

  const hasVideo = !!agora.remoteVideoTrack
  const isConnecting = agora.isConnecting
  const isConnected = agora.isConnected
  const error = agora.error

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {hasVideo ? (
        <div ref={videoRef} className="h-full w-full" />
      ) : isConnecting ? (
        <div className="grid h-full w-full place-items-center bg-[#02040a]">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
            <p className="mt-3 text-sm font-bold text-slate-400">Connecting to stream...</p>
          </div>
        </div>
      ) : isConnected ? (
        <div className="grid h-full w-full place-items-center bg-[#02040a]">
          <div className="text-center">
            <MonitorPlay className="mx-auto h-16 w-16 text-cyan-300/30" />
            <p className="mt-3 text-sm font-bold text-slate-400">Waiting for broadcaster...</p>
            <p className="mt-1 text-xs text-slate-600">The stream will appear when the host starts sharing</p>
          </div>
        </div>
      ) : error ? (
        <div className="grid h-full w-full place-items-center bg-[#02040a]">
          <div className="text-center">
            <WifiOff className="mx-auto h-16 w-16 text-red-400/50" />
            <p className="mt-3 text-sm font-bold text-red-400">{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid h-full w-full place-items-center bg-[#02040a]">
          <div className="text-center">
            <MonitorPlay className="mx-auto h-16 w-16 text-cyan-300/30" />
            <p className="mt-3 text-sm font-bold text-slate-400">Stream offline</p>
          </div>
        </div>
      )}

      {/* Camera overlay — un-mirror front camera for remote viewers (browser mirrors facingMode=user locally) */}
      {agora.remoteCameraTrack && (isMobile ? (
        <div className="absolute left-3 top-3 z-20 w-28 overflow-hidden rounded-lg border-2 border-cyan-400/40 bg-black/60 shadow-xl backdrop-blur-sm">
          <div ref={cameraRef} className="h-20 w-full bg-slate-900" style={{ transform: 'scaleX(-1)' }} />
          <div className="flex items-center gap-1 px-1.5 py-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-red-400" />
            <span className="text-[8px] font-bold text-white/70 truncate">{stream.broadcaster_name}</span>
          </div>
        </div>
      ) : (
        <div className="absolute right-4 top-4 z-20 w-48 overflow-hidden rounded-xl border-2 border-white/15 bg-black/70 shadow-2xl backdrop-blur-sm">
          <div ref={cameraRef} className="h-24 w-full bg-slate-900" style={{ transform: 'scaleX(-1)' }} />
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            <span className="text-[9px] font-bold text-white/70">{stream.broadcaster_name}</span>
          </div>
        </div>
      ))}

      {/* Video controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 py-3 opacity-0 transition-opacity hover:opacity-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {audioBlocked && !muted && (
            <button
              onClick={async () => {
                try {
                  const audioTrack = agora.remoteAudioTrack as any
                  const screenAudioTrack = agora.remoteScreenAudioTrack as any
                  if (audioTrack?.play) await audioTrack.play()
                  if (screenAudioTrack?.play) await screenAudioTrack.play()
                  setAudioBlocked(false)
                  audioBlockedRef.current = false
                } catch (err) {
                  console.warn('[StreamPlayer] Audio unlock failed:', err)
                }
              }}
              className="flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-black text-white transition hover:bg-amber-400"
            >
              <Volume2 className="h-4 w-4" />
              Enable audio
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar Item ────────────────────────────────────────────────────────────

function SidebarItem({
  icon,
  label,
  collapsed,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  collapsed: boolean
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
        active
          ? 'bg-cyan-400/10 text-cyan-300'
          : 'text-slate-400 hover:bg-white/5 hover:text-white',
        collapsed && 'justify-center px-0'
      )}
    >
      {icon}
      {!collapsed && <span className="font-semibold">{label}</span>}
    </button>
  )
}

// ─── Top Streamers List ──────────────────────────────────────────────────────

function TopStreamersList({ streamId }: { streamId: string }) {
  const [streamers, setStreamers] = useState<Array<{ id: string; name: string; avatar: string | null; viewers: number }>>([])

  useEffect(() => {
    const fetchStreamers = async () => {
      const { data } = await supabase
        .from('streams')
        .select('id, user_id, current_viewers, user_profiles(username, avatar_url)')
        .eq('category', 'gaming')
        .eq('is_live', true)
        .order('current_viewers', { ascending: false })
        .limit(5)

      if (data) {
        setStreamers(
          data.map((s: any) => ({
            id: s.user_id,
            name: s.user_profiles?.username || 'Gamer',
            avatar: s.user_profiles?.avatar_url || null,
            viewers: s.current_viewers || 0,
          }))
        )
      }
    }
    fetchStreamers()
  }, [streamId])

  if (streamers.length === 0) return null

  return (
    <div className="space-y-1">
      {streamers.map((s) => (
        <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5">
          {s.avatar ? (
            <img src={s.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-full bg-purple-500/20 text-[8px] font-black">
              {s.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-300">{s.name}</p>
            <p className="text-[10px] text-slate-500">{formatCompactNumber(s.viewers)} viewers</p>
          </div>
        </div>
      ))}
    </div>
  )
}



// ─── Action Button ───────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-slate-400 transition hover:bg-white/5 hover:text-white',
        active && 'text-cyan-300'
      )}
    >
      {icon}
      <span className="text-[9px] font-bold">{label}</span>
    </button>
  )
}

// ─── Mobile Action ───────────────────────────────────────────────────────────

function MobileAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label?: string
  onClick?: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
        {icon}
      </div>
      {label && <span className="text-[9px] font-bold text-white/80 drop-shadow">{label}</span>}
    </button>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] font-bold uppercase text-slate-500">{label}</span>
      </div>
      <p className="mt-0.5 text-xs font-black text-white">{value}</p>
    </div>
  )
}

// ─── Coin Store Modal ────────────────────────────────────────────────────────

function CoinStoreModal({
  onClose,
  onPurchase,
  currentCoins,
}: {
  onClose: () => void
  onPurchase: (pack: typeof COIN_PACKS[0]) => void
  currentCoins: number
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0e17] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-400" />
            <h2 className="text-lg font-black text-white">Buy Troll Coins</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-center">
          <span className="text-xs text-slate-400">Your Balance: </span>
          <span className="text-sm font-black text-amber-300">{formatCompactNumber(currentCoins)} Troll Coins</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {COIN_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => onPurchase(pack)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-2xl border p-3 transition hover:scale-105',
                pack.popular
                  ? 'border-amber-400/40 bg-amber-400/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-2 py-0.5 text-[8px] font-black text-white">
                  BEST VALUE
                </span>
              )}
              <Coins className={cn('h-5 w-5', pack.popular ? 'text-amber-400' : 'text-slate-400')} />
              <span className="text-sm font-black text-white">{formatCompactNumber(pack.coins)}</span>
              <span className="text-[10px] text-slate-400">coins</span>
              <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-bold text-white">${pack.price}</span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          Powered by PayPal. Secure payment processing.
        </p>
      </div>
    </div>
  )
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getDuration(startedAt: string | null): string {
  if (!startedAt) return '00:00'
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return '00:00'
  const ms = Math.max(0, Date.now() - start)
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
