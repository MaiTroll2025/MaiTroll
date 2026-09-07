import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Gift,
  Heart,
  MessageCircle,
  Share2,
  Users,
  VideoOff,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useAgoraGamingViewer } from '@/hooks/useAgoraGamingViewer'
import { useBroadcastRealtime } from '@/hooks/useBroadcastRealtime'
import { sendChatThroughGate } from '@/lib/sendChatThroughGate'
import { getAnonymousDisplayName, isAnonymousDisplayName } from '@/lib/anonymousIdentity'
import { hasModActionsAccess } from '@/types/moderationActions'
import { toast } from 'sonner'
import { cn, formatCompactNumber } from '@/lib/utils'
import ModActionsPopup from '@/components/broadcast/ModActionsPopup'
import ViewerUserActionModal from '@/components/broadcast/ViewerUserActionModal'
import PhoneGiftModal from '@/phone/components/PhoneGiftModal'
import ShareModal from '@/components/broadcast/ShareModal'
import FeaturedGiftBanner from '@/components/broadcast/FeaturedGiftBanner'

type FloatingMessage = {
  id: string
  username: string
  content: string
  timestamp: number
  isSystem?: boolean
}

type UserActionTarget = {
  userId: string
  username: string
  role?: string
  createdAt?: string | null
}

const TIP_ITEMS = [
  { id: '1', name: 'Tip', icon: '💰', cost: 10 },
  { id: '2', name: 'Super Tip', icon: '💎', cost: 50 },
  { id: '3', name: 'Mega Tip', icon: '👑', cost: 100 },
]

function AgoraVideoPlayer({ track, className }: { track: any; className?: string }) {
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!node || !track) return

    node.innerHTML = ''

    try {
      if (typeof track.play === 'function') {
        track.play(node, { fit: 'contain' })
      }
    } catch (err) {
      console.warn('[AgoraVideoPlayer] play failed', err)
    }

    return () => {
      try {
        if (typeof track.stop === 'function') {
          track.stop()
        }
      } catch {
        // ignore
      }
      if (node) {
        node.innerHTML = ''
      }
    }
  }, [track])

  return <div ref={nodeRef} className={cn('h-full w-full', className)} />
}

export default function PhoneHytroGameViewer() {
  const { streamId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [streamEnded, setStreamEnded] = useState(false)

  const agora = useAgoraGamingViewer()
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

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  useEffect(() => {
    setLikeCount(currentStream?.total_likes || 0)
  }, [currentStream?.total_likes])
  const [showTipPanel, setShowTipPanel] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [sendingTip, setSendingTip] = useState(false)

  const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [showModActionMenu, setShowModActionMenu] = useState(false)
  const [userActionTarget, setUserActionTarget] = useState<UserActionTarget | null>(null)

  const floatingChatChannelRef = useRef<any>(null)
  const viewerIdentity = useMemo(() => user?.id || `guest-${streamId}-${getAnonymousDisplayName()}`, [user?.id, streamId])

  const canClickFloatingChatUsername = hasModActionsAccess(profile)

  const broadcasterProfile = useMemo(() => currentStream?.broadcaster_profile || null, [currentStream])
  const hostName = broadcasterProfile?.username || broadcasterProfile?.display_name || 'Gamer'

  const joinedChannelRef = useRef<string | null>(null)
  const joinRef = useRef(agora.join)
  const leaveRef = useRef(agora.leave)
  joinRef.current = agora.join
  leaveRef.current = agora.leave

  useEffect(() => {
    if (!streamId) return

    const fetchStream = async () => {
      try {
        const { data, error } = await supabase
          .from('streams')
          .select('*')
          .eq('id', streamId)
          .eq('category', 'gaming')
          .maybeSingle()

        if (error || !data) {
          setStream(null)
          setLoading(false)
          return
        }

        setStream(data)
        setLikeCount(data.total_likes || 0)
        setLoading(false)
      } catch {
        setStream(null)
        setLoading(false)
      }
    }

    void fetchStream()
  }, [streamId])

  useEffect(() => {
    if (!streamId || !currentStream || !channelName || !viewerIdentity) return

    const isActive = String(currentStream?.status || '').toLowerCase() === 'live'
    if (!isActive) {
      if (joinedChannelRef.current) {
        void leaveRef.current()
        joinedChannelRef.current = null
      }
      return
    }

    const channelKey = `${channelName}:${viewerIdentity}`
    if (joinedChannelRef.current === channelKey) return

    void joinRef.current(channelName, viewerIdentity)
    joinedChannelRef.current = channelKey

    return () => {
      void leaveRef.current()
      joinedChannelRef.current = null
    }
  }, [streamId, currentStream, channelName, viewerIdentity])

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`floating-chat:${streamId}`)
    floatingChatChannelRef.current = channel

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content } = payload.payload || {}
        if (!username || !content) return

        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setFloatingMessages((prev) => [{ id: msgId, username, content, timestamp: Date.now() }, ...prev].slice(0, 50))

        window.setTimeout(() => {
          setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
        }, 30000)
      })
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
   }, [streamId])

  const handleSendChat = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = chatInput.trim()
      if (!text || !streamId) return
      if (!user) return

      const username = profile?.username || user?.email?.split('@')?.[0] || 'Viewer'
      const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      setFloatingMessages((prev) => [{ id: msgId, username, content: text, timestamp: Date.now() }, ...prev].slice(0, 50))
      setChatInput('')

      window.setTimeout(() => {
        setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
      }, 30000)

      try {
        const result = await sendChatThroughGate({ streamId, content: text })
        if (!result.ok) {
          setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
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
    },
    [chatInput, streamId, user, profile],
  )

  const handleOpenUserAction = useCallback(
    (info: UserActionTarget) => {
      setUserActionTarget(info)
      setShowModActionMenu(canClickFloatingChatUsername)
    },
    [canClickFloatingChatUsername],
  )

  const handleOpenFloatingChatUsername = useCallback(
    async (username: string) => {
      if (!username) return

      if (isAnonymousDisplayName(username)) {
        if (!canClickFloatingChatUsername) return
        await handleOpenUserAction({
          userId: `anon-${username.toLowerCase()}`,
          username,
          role: 'anonymous',
          createdAt: null,
        })
        return
      }

      try {
        const { data } = await supabase.from('user_profiles').select('id, username, role, troll_role, created_at').eq('username', username).maybeSingle()

        await handleOpenUserAction({
          userId: data?.id || username,
          username: data?.username || username,
          role: data?.role || data?.troll_role || 'viewer',
          createdAt: data?.created_at || null,
        })
      } catch {
        toast.error('Failed to open user profile')
      }
    },
    [canClickFloatingChatUsername, handleOpenUserAction],
  )

  const handleTip = useCallback(
    async (item: (typeof TIP_ITEMS)[number]) => {
      if (!user || !streamId) return
      setSendingTip(true)
      try {
        const { error } = await supabase.functions.invoke('hytro-tip', {
          body: {
            streamId,
            senderId: user.id,
            coin_amount: item.cost,
            metadata: {
              coin_cost: item.cost,
              item_name: item.name,
              icon: item.icon,
              is_tip: true,
              source: 'hytrogaming_tip',
            },
          },
        })

        if (error) throw error
        toast.success(`Sent ${item.icon} ${item.name} (${item.cost} coins)`)
        setShowTipPanel(false)
      } catch (err: any) {
        toast.error(err.message || 'Failed to send tip')
      } finally {
        setSendingTip(false)
      }
    },
    [user, streamId],
  )

  const handleLike = useCallback(async () => {
    if (!currentStream?.id) return

    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)))

    try {
      if (newLiked) {
        await supabase.rpc('like_stream', { p_stream_id: currentStream.id })
      } else {
        await supabase.from('stream_likes').delete().eq('stream_id', currentStream.id).eq('user_id', user?.id)
      }
    } catch (err) {
      console.warn('[PhoneHytroGameViewer] Like toggle failed:', err)
    }
  }, [liked, currentStream?.id, user?.id])

  const handleShare = useCallback(() => {
    setShowShare(true)
  }, [])

  const leaveAgoraRef = useRef(agora.leave)
  leaveAgoraRef.current = agora.leave

  useEffect(() => {
    return () => {
      void leaveAgoraRef.current()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#03040a]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-slate-400">Loading stream...</p>
        </div>
      </div>
    )
  }

  if (!currentStream || !streamId) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#03040a] px-6 text-white">
        <div className="text-center">
          <VideoOff className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-black">Stream not found</h1>
            <button onClick={() => navigate('/hytro')} className="mt-6 rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-black">
              Browse Streams
            </button>
        </div>
      </div>
    )
  }

  if (streamEnded || currentStream.status === 'ended') {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#03040a] px-6 text-white">
        <div className="text-center">
          <VideoOff className="mx-auto h-16 w-16 text-red-400" />
          <h1 className="mt-4 text-2xl font-black">Stream ended</h1>
          <button onClick={() => navigate('/hytro')} className="mt-6 rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-black">
            Browse Streams
          </button>
          <button onClick={() => navigate(-1)} className="mt-3 ml-3 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-black text-white">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* Screen share area */}
      <div className="absolute inset-0 z-0">
        {agora.remoteVideoTrack ? (
          <AgoraVideoPlayer track={agora.remoteVideoTrack} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#050711]">
            <div className="relative grid h-20 w-20 place-items-center rounded-[28px] border border-cyan-300/20 bg-cyan-500/10 shadow-[0_0_50px_rgba(34,211,238,0.12)]">
              <svg className="h-8 w-8 animate-pulse text-cyan-300/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <p className="relative mt-5 text-sm font-black">{hostName}</p>
            <p className="relative mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Screen connecting</p>
          </div>
        )}

        {/* Camera overlay */}
        {agora.remoteCameraTrack && (
          <div className="absolute left-3 top-3 z-20 h-28 w-40 overflow-hidden rounded-lg border-2 border-cyan-400/40 bg-black/60 shadow-xl backdrop-blur-sm">
            <AgoraVideoPlayer track={agora.remoteCameraTrack} />
            <div className="absolute bottom-1 left-1.5 flex items-center gap-1">
              <span className="h-1 w-1 animate-pulse rounded-full bg-red-400" />
              <span className="truncate text-[8px] font-bold text-white/70">{hostName}</span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="pointer-events-auto flex w-full items-center gap-1 rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/85 via-black/70 to-slate-950/85 px-2 py-1.5 shadow-[0_2px_24px_rgba(34,211,238,0.10)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 transition active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black text-white">{currentStream.title}</p>
              <p className="truncate text-[9px] font-bold text-cyan-300/70">{hostName}</p>
            </div>
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[8px] font-black text-white">
                <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Users className="h-3 w-3" />
              {formatCompactNumber(viewerCount)}
            </div>
          </div>
        </div>

        {/* Right action bar */}
        <div className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] right-3 z-20 flex flex-col items-center gap-3">
          <button onClick={handleLike} className="flex flex-col items-center gap-1">
            <div className={cn('grid h-12 w-12 place-items-center rounded-full backdrop-blur-sm transition-all active:scale-90', liked ? 'bg-pink-500/40 shadow-[0_0_20px_rgba(236,72,153,0.5)]' : 'bg-black/40')}>
              <Heart className={cn('h-7 w-7 transition-all', liked && 'fill-pink-400 text-pink-400 scale-110')} />
            </div>
            <span className={cn('text-[9px] font-black drop-shadow', liked ? 'text-pink-300' : 'text-white/80')}>{formatCompactNumber(likeCount)}</span>
          </button>
          <button onClick={() => setShowTipPanel(true)} className="flex flex-col items-center gap-1">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
              <Gift className="h-7 w-7 text-amber-400" />
            </div>
            <span className="text-[9px] font-black text-white/80">Tips</span>
          </button>
          <button onClick={handleShare} className="flex flex-col items-center gap-1">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
              <Share2 className="h-7 w-7" />
            </div>
            <span className="text-[9px] font-black text-white/80">Share</span>
          </button>
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setShowMobileChat(true)}
          className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </button>

        {/* Flying chat */}
        {floatingMessages.length > 0 && (
          <div className="absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 pointer-events-none px-3">
            {floatingMessages.slice(0, 8).map((msg) => (
              <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
                <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  {canClickFloatingChatUsername ? (
                    <button type="button" onClick={() => handleOpenFloatingChatUsername(msg.username)} className="text-[10px] font-black text-cyan-300 transition-colors hover:text-cyan-100">
                      {msg.username}
                    </button>
                  ) : (
                    <span className="text-[10px] font-black text-cyan-300">{msg.username}</span>
                  )}
                  <span className="text-[10px] font-bold text-white/40"> sent: </span>
                  <span className="text-[10px] font-semibold text-white/90">{msg.content}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#050711]/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
          <form onSubmit={handleSendChat}>
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
      </div>

      {/* Mobile chat bottom sheet */}
      {showMobileChat && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowMobileChat(false)}>
          <div className="flex h-[60vh] flex-col rounded-t-3xl bg-[#0a0e17]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <MessageCircle className="h-4 w-4 text-cyan-300" />
                Live Chat
              </div>
              <button onClick={() => setShowMobileChat(false)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {floatingMessages.length === 0 ? (
                <p className="text-center text-xs text-white/40">No messages yet</p>
              ) : (
                floatingMessages.map((msg) => (
                  <div key={msg.id} className="mb-2">
                    <span className="text-[10px] font-black text-cyan-300">{msg.username}</span>
                    <span className="text-[10px] font-bold text-white/40">: </span>
                    <span className="text-[10px] font-semibold text-white/90">{msg.content}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tips panel */}
      {showTipPanel && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowTipPanel(false)}>
          <div className="rounded-t-3xl bg-[#0a0e17] p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
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
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-black text-white">{item.name}</span>
                  <span className="text-[9px] font-bold text-white/60">{item.cost} coins</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShare && (
        <ShareModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          streamTitle={currentStream?.title || 'Untitled Stream'}
          streamUrl={`${window.location.origin}/gaming/watch/${streamId}`}
          broadcasterName={hostName}
        />
      )}

      {/* Gift modal */}
      {isGiftModalOpen && (
        <PhoneGiftModal
          isOpen={isGiftModalOpen}
          onClose={() => {
            setIsGiftModalOpen(false)
            setGiftRecipientId(null)
          }}
          recipientId={giftRecipientId || currentStream?.broadcaster_id || ''}
          streamId={streamId || ''}
          broadcasterId={currentStream?.broadcaster_id || ''}
        />
      )}

      {/* Mod actions popup */}
      {userActionTarget && (
        <>
          {showModActionMenu ? (
            <ModActionsPopup
              isOpen={true}
              onClose={() => {
                setUserActionTarget(null)
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
              hostId={currentStream?.broadcaster_id || ''}
              currentUserId={user?.id}
            />
          ) : (
            <ViewerUserActionModal
              isOpen={true}
              onClose={() => {
                setUserActionTarget(null)
              }}
              userId={userActionTarget.userId}
              username={userActionTarget.username}
              streamId={streamId || ''}
            />
          )}
        </>
      )}

      {/* Featured gift banner */}
      <FeaturedGiftBanner streamId={streamId || ''} broadcasterId={currentStream?.broadcaster_id} isMobile={true} />
    </div>
  )
}
