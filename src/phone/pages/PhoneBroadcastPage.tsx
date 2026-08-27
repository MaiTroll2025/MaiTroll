import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  RefreshCw,
  PhoneOff,
  Gift,
  Swords,
  Heart,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { useStreamSeats } from '@/hooks/useStreamSeats'
import { useLiveBroadcast } from '@/hooks/useLiveBroadcast'
import { useStreamAudiencePresence, StreamAudienceMember } from '@/hooks/useStreamAudiencePresence'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'
import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'
import { sendChatThroughGate } from '@/lib/sendChatThroughGate'
import { sendStreamBroadcast } from '@/lib/realtime/streamRealtimeManager'
import { hydrateGiftForOverlay } from '@/lib/gifts'
import { getGiftVisualConfig } from '@/lib/giftVisuals'
import { useTargetedGiftQueue, type StreamGiftEvent } from '@/hooks/useTargetedGiftQueue'

import BroadcastGrid from '@/components/broadcast/BroadcastGrid'
import MobileAudienceTicker from '@/components/broadcast/MobileAudienceTicker'
import MobileBroadcastHostSettings from '@/components/broadcast/MobileBroadcastHostSettings'
import ErrorBoundary from '@/components/ErrorBoundary'
import BattleView from '@/pages/broadcast/BattleView'
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client'

import { supabase } from '@/lib/supabase'
import type { Stream } from '@/types/broadcast'
import type { BroadcastGift } from '@/hooks/useBroadcastRealtime'

import PhoneGiftModal from '@/phone/components/PhoneGiftModal'
import MaiBag from '@/components/mai-bag/MaiBag'

export default function PhoneBroadcastPage() {
  const params = useParams()
  const navigate = useNavigate()

  const routeStreamId =
    params.id ||
    params.streamId ||
    ''

  const {
    user,
    profile: broadcasterProfile,
  } = useAuthStore()

  const [stream, setStream] =
    useState<Stream | null>(null)

  const [isGiftModalOpen, setIsGiftModalOpen] =
    useState(false)

  const [facingMode, setFacingMode] =
    useState<'user' | 'environment'>('user')

  const [floatingMessages, setFloatingMessages] =
    useState<Array<{id: string, text: string, username: string, timestamp: number}>>([])

  const [chatInput, setChatInput] =
    useState('')

  const [recentGifts, setRecentGifts] =
    useState<BroadcastGift[]>([])

  const processedGiftIdsRef =
    useRef<Set<string>>(new Set())

  const recentChatKeysRef =
    useRef<Map<string, number>>(new Map())

  const broadcastChatMessageIdsRef =
    useRef<Set<string>>(new Set())

  const floatingChatChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null)

  const { enqueueGift } = useTargetedGiftQueue()

  const streamEndedRef =
    useRef(false)

  /*
   * -------------------------------------------------------------
   * FETCH STREAM
   * -------------------------------------------------------------
   */

  useEffect(() => {
    if (!routeStreamId) return

    let cancelled = false

    const fetchStream = async () => {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('streams')
          .select('*')
          .eq('id', routeStreamId)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error(
            '[PhoneBroadcastPage] Failed to fetch stream:',
            error
          )
          return
        }

        if (data) {
          setStream(data as Stream)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            '[PhoneBroadcastPage] Failed to fetch stream:',
            error
          )
        }
      }
    }

    void fetchStream()

    return () => {
      cancelled = true
    }
  }, [routeStreamId])

  const streamId = stream?.id

  /*
   * -------------------------------------------------------------
   * LIVE BROADCAST SESSION
   * -------------------------------------------------------------
   */

  const session = useLiveBroadcast({
    streamId: streamId || '',
    isHost: true,
    facingMode,
  })

  /*
   * -------------------------------------------------------------
   * SEATS
   * -------------------------------------------------------------
   */

  const {
    seats,
    joinSeat,
    leaveSeat,
    mySeat,
   } = useStreamSeats(
    streamId || '',
    user?.id,
    broadcasterProfile,
    stream as any,
   )

  const { audience } = useStreamAudiencePresence(
    streamId || '',
    user?.id,
   )

  /*
    * -------------------------------------------------------------
    * STREAM REALTIME
    * -------------------------------------------------------------
    */

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
      enrichedGiftData?.video_url ||
      enrichedGiftData?.metadata?.animation_url ||
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
      receiver_id: enrichedGiftData?.receiver_id || stream?.user_id,
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
      recipient_user_id: enrichedGiftData?.receiver_id || stream?.user_id || '',
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
  }, [streamId, stream?.user_id, enqueueGift])

  useStreamRealtime(streamId || '', {
    onStream: (event) => {
      const next = event?.new
      if (!next) return

      if (next.status === 'ended' || next.ended_at) {
        if (streamEndedRef.current) return
        streamEndedRef.current = true
        void (async () => {
          try {
            session.disconnect()
          } catch {
            // ignore
          }
          navigate(`/broadcast/summary/${streamId}`, { replace: true })
        })()
        return
      }

      setStream((prev) => {
        if (!prev) return next as Stream
        return { ...(prev as any), ...(next as any) } as Stream
      })
    },
    onMessage: (event) => {
      const newRow = event?.new
      if (!newRow) return

      const msgId = String(newRow.id || newRow.txn_id || '')
      if (!msgId) return
      if (broadcastChatMessageIdsRef.current.has(msgId)) return

      const username = newRow.user_name || newRow.username || 'Viewer'
      const content = newRow.content || ''
      if (!content) return

      const chatKey = `${username}:${content}`
      const now = Date.now()
      const existingTs = recentChatKeysRef.current.get(chatKey)
      if (existingTs !== undefined && now - existingTs < 1500) return

      broadcastChatMessageIdsRef.current.add(msgId)
      recentChatKeysRef.current.set(chatKey, now)

      const floatingMsg = {
        id: msgId,
        username,
        text: content,
        timestamp: Date.now(),
      }

      setFloatingMessages((prev) => [floatingMsg, ...prev].slice(0, 50))
      window.setTimeout(() => {
        setFloatingMessages((prev) => prev.filter((m) => m.id !== msgId))
      }, 30_000)
    },
    onGift: (event) => {
      if (event.table === 'stream_gifts') return
      const rawGift = event?.new ?? event
      if (rawGift) {
        void processGiftEvent(rawGift)
      }
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
  })

  /*
    * -------------------------------------------------------------
    * FLOATING CHAT
    * -------------------------------------------------------------
    */

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`floating-chat:${streamId}`)
    floatingChatChannelRef.current = channel

    channel
      .on('broadcast', { event: 'floating_chat' }, (payload: any) => {
        const { username, content, isSystem } = payload.payload || {}
        if (!username || !content) return

        const chatKey = `${username}:${content}`
        const now = Date.now()
        const existingTs = recentChatKeysRef.current.get(chatKey)
        if (existingTs !== undefined && now - existingTs < 1500) return
        recentChatKeysRef.current.set(chatKey, now)

        const msgId = `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        setFloatingMessages((prev) =>
          [{ id: msgId, text: content, username, timestamp: Date.now(), isSystem }, ...prev].slice(0, 50)
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
  }, [streamId])

  /*
    * -------------------------------------------------------------
    * SEATS
    * -------------------------------------------------------------
   */

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
    (stream?.battle_status === 'ready' || stream?.battle_status === 'starting' || stream?.battle_status === 'active')

  const activeBattleId = shouldShowRandomBattleArena ? stream?.battle_id ?? null : null

  const battleLocalTracks = useMemo(() => {
    const tracks = session.localTracks
    if (!tracks) return null
    const audio = tracks.find(t => t?.kind === 'audio') as LocalAudioTrack | undefined
    const video = tracks.find(t => t?.kind === 'video') as LocalVideoTrack | undefined
    return audio || video ? [audio, video] as [LocalAudioTrack | undefined, LocalVideoTrack | undefined] : null
  }, [session.localTracks])

  /*
   * -------------------------------------------------------------
   * CONNECT TO BROADCAST
   * -------------------------------------------------------------
   */

  useEffect(() => {
    if (!streamId) return

    session.connect()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  /*
   * -------------------------------------------------------------
   * LIKE REALTIME SYNC
   * -------------------------------------------------------------
   */

  useEffect(() => {
    if (!streamId) return

    let cancelled = false

    const channel = supabase.channel(
      `stream:${streamId}`
    )

    channel.on(
      'broadcast',
      { event: 'like_sent' },
      (payload) => {
        if (cancelled) return

        const likeData =
          payload.payload || {}

        if (
          likeData.user_id === user?.id
        ) {
          return
        }

        const newTotal =
          typeof likeData.total_likes === 'number'
            ? likeData.total_likes
            : null

        if (newTotal !== null) {
          setStream((previous) =>
            previous
              ? {
                  ...previous,
                  total_likes: newTotal,
                }
              : previous
          )
        }
      }
    )

    channel.on(
      'broadcast',
      { event: 'chat_message' },
      (payload) => {
        if (cancelled) return

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
          [{ id: msgId, text, username, timestamp: Date.now() }, ...previous].slice(0, 50),
        )

        setTimeout(() => {
          setFloatingMessages((previous) =>
            previous.filter((m) => m.id !== msgId),
          )
        }, 8000)
      }
    )

    channel.subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [
    streamId,
    user?.id,
  ])

  /*
   * -------------------------------------------------------------
   * RANDOM BATTLE
   *
   * This is the same random battle controller used by the
   * existing battle system.
   *
   * The important part here is onStreamUpdate:
   * the controller updates the local Stream immediately so
   * the phone UI changes without requiring a refresh.
   * -------------------------------------------------------------
   */

  const handleRandomBattleStreamUpdate = (
    patch: Partial<Stream>
  ) => {
    setStream((previous) =>
      previous
        ? {
            ...previous,
            ...patch,
          }
        : previous
    )
  }

  const randomBattle =
    useRandomBattleQueueController({
      stream,
      userId: user?.id,
      isBroadcaster: true,
      onStreamUpdate:
        handleRandomBattleStreamUpdate,
    })

  /*
   * -------------------------------------------------------------
   * GIFTS
   * -------------------------------------------------------------
   */

  const handleGift = () => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }

    setIsGiftModalOpen(true)
  }

  const handleLike = async () => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }

    if (!streamId) return

    setStream((previous) =>
      previous
        ? {
            ...previous,
            total_likes: Number(previous.total_likes || 0) + 1,
          }
        : previous
    )

    try {
      const { data } = await supabase.rpc('increment_stream_likes', {
        p_stream_id: streamId,
        p_like_count: 1,
      })

      if (typeof data === 'number') {
        setStream((previous) =>
          previous
            ? {
                ...previous,
                total_likes: data,
              }
            : previous
        )

        try {
          void sendStreamBroadcast(
            streamId,
            'like_sent',
            {
              user_id: user?.id,
              stream_id: streamId,
              total_likes: data,
            },
          )
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  /*
   * -------------------------------------------------------------
   * END STREAM
   * -------------------------------------------------------------
   */

  const endStream = async () => {
    streamEndedRef.current = true

    if (
      stream?.is_battle &&
      stream?.battle_id &&
      stream?.battle_mode === 'random_queue' &&
      user?.id
    ) {
      try {
        await supabase.rpc('forfeit_random_battle', {
          p_stream_id: stream.id,
          p_broadcaster_id: user.id,
        })
      } catch (forfeitErr) {
        console.warn('[PhoneBroadcastPage] forfeit_random_battle failed:', forfeitErr)
      }
    }

    if (
      randomBattle.isQueueEnabled &&
      !randomBattle.isBattleActive
    ) {
      try {
        await randomBattle.stopQueue()
      } catch {
        // The stream is still being ended, so don't block exit.
      }
    }

    session.disconnect()

    navigate(`/broadcast/summary/${streamId}`, { replace: true })
  }

  /*
   * -------------------------------------------------------------
   * RANDOM MATCH BUTTON
   * -------------------------------------------------------------
   */

  const handleRandomMatch = () => {
    if (
      randomBattle.isBusy ||
      randomBattle.isBattleActive
    ) {
      return
    }

    void randomBattle.startQueue()
  }

  /*
   * -------------------------------------------------------------
   * BATTLE STATE
   * -------------------------------------------------------------
   */

  const randomBattleIsActive =
    randomBattle.phase === 'starting' ||
    randomBattle.phase === 'active'

  /*
   * -------------------------------------------------------------
   * RENDER
   * -------------------------------------------------------------
   */

   if (shouldShowRandomBattleArena) {
    const battleLocalTracks = useMemo(() => {
      const tracks = session.localTracks
      if (!tracks) return null
      const audio = tracks.find(t => t?.kind === 'audio') as LocalAudioTrack | undefined
      const video = tracks.find(t => t?.kind === 'video') as LocalVideoTrack | undefined
      return audio || video ? [audio, video] as [LocalAudioTrack | undefined, LocalVideoTrack | undefined] : null
    }, [session.localTracks])

    return (
      <ErrorBoundary>
        <GiftSystemProvider streamId={streamId} defaultReceiverId={stream?.user_id}>
          <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden">
            <BattleView
              key={activeBattleId}
              battleId={stream.battle_id!}
              currentStreamId={streamId || stream.id}
              viewerId={user?.id}
              localTracks={battleLocalTracks}
              remoteUsers={Array.from(session.remoteParticipants.values())}
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
              onToggleCamera={session.toggleCamera}
              onToggleMic={session.toggleMicrophone}
            />
            <PhoneGiftModal
              isOpen={isGiftModalOpen}
              onClose={() =>
                setIsGiftModalOpen(false)
              }
              recipientId={
                stream?.user_id || ''
              }
              streamId={
                streamId || ''
              }
              broadcasterId={
                stream?.user_id
              }
            />
          </div>
        </GiftSystemProvider>
      </ErrorBoundary>
    );
  }

  return (
    <GiftSystemProvider
      streamId={streamId}
      defaultReceiverId={stream?.user_id}
    >
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white">

        {/* =======================================================
            VIDEO / SEATS
        ======================================================== */}

        <div className="relative min-h-0 flex-1">

          {stream && (
            <BroadcastGrid
              stream={stream as any}
              streamStatus={
                stream.status ?? 'live'
              }
              seats={seats}
              isHost
              isMobileViewer
              localTracks={
                session.localTracks as any
              }
              onGift={handleGift}
              onGiftAll={() => []}
              onJoinSeat={(index) =>
                joinSeat(
                  index,
                  stream?.seat_prices?.[index] ??
                    stream?.seat_price ??
                    0
                )
              }
              onLeaveSeat={leaveSeat}
              toggleCamera={
                session.toggleCamera
              }
              toggleMicrophone={
                session.toggleMicrophone
              }
              flipCamera={
                session.flipCamera
              }
              isCameraOn={
                session.cameraEnabled
              }
              isMicOn={
                session.micEnabled
              }
              remoteUsers={Array.from(
                session.remoteParticipants.values()
              )}
              localUserId={
                user?.id || ''
              }
            />
          )}

          {/* =====================================================
              LIVE STATUS
          ====================================================== */}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-cyan-400/30 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200 backdrop-blur-md">
            <span
              className={`h-2 w-2 rounded-full ${
                session.isConnected
                  ? 'bg-emerald-400'
                  : 'animate-pulse bg-amber-400'
              }`}
            />

            {session.isConnected
              ? 'Live'
              : 'Connecting'}
          </div>

          {streamId && (
            <div className="absolute left-3 top-12 z-40">
              <MaiBag streamId={streamId} compact />
            </div>
          )}

          {/* =====================================================
              AUDIENCE TICKER + LIKE
          ====================================================== */}

          {stream && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-3 pt-[44px] pointer-events-none">
              <div className="pointer-events-auto flex-1 rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/80 via-black/60 to-slate-950/80 px-2 py-1.5 backdrop-blur-sm shadow-[0_2px_24px_0_rgba(34,211,238,0.10)]">
                <MobileAudienceTicker
                  audience={audience}
                  currentUserId={user?.id}
                  hostUserId={stream?.user_id}
                  viewerCount={stream?.viewer_count ?? 0}
                  likes={stream?.total_likes ?? 0}
                  maxVisible={6}
                />
              </div>
              <button
                type="button"
                onClick={handleLike}
                className="pointer-events-auto relative mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-pink-400/20 bg-black/45 backdrop-blur-xl transition active:scale-90"
              >
                <Heart size={14} className="text-pink-300" />
                <span className="absolute -bottom-1 -right-1 rounded-full border border-pink-400/30 bg-pink-500/20 px-1 text-[8px] font-black text-pink-100">
                  {Math.max(0, Number(stream?.total_likes ?? 0)).toLocaleString()}
                </span>
              </button>
            </div>
          )}

        </div>

        {stream && (
          <div className="absolute bottom-24 right-3 z-50">
              <MobileBroadcastHostSettings
                isMicOn={session.micEnabled}
                isCamOn={session.cameraEnabled}
                isLive={stream?.status === 'live'}
                hasRgbEffect={!!stream?.has_rgb_effect}
                isChatLocked={!!stream?.is_chat_locked}
                unreadMessageCount={0}
                onToggleMic={session.toggleMicrophone}
                onToggleCamera={session.toggleCamera}
                onFlipCamera={session.flipCamera}
                onGift={handleGift}
                onShare={() => {}}
                onOpenMessage={() => {}}
                onEndStream={endStream}
                onOpenCoinStore={() => {}}
                onInviteFollowers={() => {}}
                onToggleRGB={() => {}}
                onTextPopup={() => {}}
              />
          </div>
        )}

        {/* =======================================================
            FLYING CHAT
        ======================================================== */}

        {floatingMessages.length > 0 && (
          <div className="absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 pointer-events-none px-3">
            {floatingMessages.slice(0, 8).map((msg) => (
              <div
                key={msg.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto"
                style={{ animation: 'slideInFromBottom 0.3s ease-out' }}
              >
                <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[10px] font-black text-cyan-300">{msg.username}</span>
                  <span className="text-[10px] font-bold text-white/40">: </span>
                  <span className="text-[10px] font-semibold text-white/90">{msg.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat input */}
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const text = chatInput.trim()
            if (!text || !streamId) return

            const username = broadcasterProfile?.username || user?.email?.split('@')?.[0] || 'Viewer'
            const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

            setFloatingMessages(prev => [{ id: msgId, text, username, timestamp: Date.now() }, ...prev].slice(0, 50))
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
          className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
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

        {/* =======================================================
            PHONE CONTROL BAR
        ======================================================== */}

        <div className="flex shrink-0 items-center justify-around gap-1.5 border-t border-white/10 bg-slate-950/95 px-2 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">

          {/* CAMERA */}

          <ControlButton
            active={
              session.cameraEnabled
            }
            onClick={
              session.toggleCamera
            }
            icon={
              session.cameraEnabled
                ? Video
                : VideoOff
            }
            label={
              session.cameraEnabled
                ? 'Cam'
                : 'Off'
            }
          />

          {/* MICROPHONE */}

          <ControlButton
            active={
              session.micEnabled
            }
            onClick={
              session.toggleMicrophone
            }
            icon={
              session.micEnabled
                ? Mic
                : MicOff
            }
            label={
              session.micEnabled
                ? 'Mic'
                : 'Muted'
            }
          />

          {/* FLIP */}

          <ControlButton
            active
            onClick={
              session.flipCamera
            }
            icon={RefreshCw}
            label="Flip"
          />

          {/* =====================================================
              RANDOM MATCH
          ====================================================== */}

          <ControlButton
            active={
              randomBattle.isQueueEnabled ||
              randomBattleIsActive
            }
            onClick={
              handleRandomMatch
            }
            icon={Swords}
            label={
              randomBattle.isBusy
                ? 'Match...'
                : randomBattle.isQueueEnabled
                  ? 'Searching'
                  : randomBattleIsActive
                    ? 'Battle'
                    : 'Random'
            }
            disabled={
              randomBattle.isBusy ||
              randomBattle.isBattleActive
            }
            battle
          />

          {/* GIFT */}

          <ControlButton
            active
            onClick={handleGift}
            icon={Gift}
            label="Gift"
          />

          {/* END */}

          <ControlButton
            active={false}
            onClick={endStream}
            icon={PhoneOff}
            label="End"
            danger
          />
        </div>

        {/* =======================================================
            CHAT
        ======================================================== */}

        <PhoneGiftModal
          isOpen={
            isGiftModalOpen
          }
          onClose={() =>
            setIsGiftModalOpen(false)
          }
          recipientId={
            stream?.user_id || ''
          }
          streamId={
            streamId || ''
          }
          broadcasterId={
            stream?.user_id
          }
        />

      </div>
    </GiftSystemProvider>
  )
}

/* ================================================================
   CONTROL BUTTON
================================================================ */

function ControlButton({
  active,
  onClick,
  icon: Icon,
  label,
  danger,
  disabled = false,
  battle = false,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{
    size?: number | string
    className?: string
  }>
  label: string
  danger?: boolean
  disabled?: boolean
  battle?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex h-14 w-14 shrink-0 flex-col
        items-center justify-center gap-1
        rounded-2xl border
        text-[8px] font-black uppercase
        tracking-wide transition-all
        active:scale-95

        ${
          danger
            ? `
              border-red-400/40
              bg-red-500/15
              text-red-200
              hover:bg-red-500/25
            `
            : battle
              ? `
                border-fuchsia-400/40
                bg-gradient-to-br
                from-purple-500/20
                via-fuchsia-500/15
                to-pink-500/20
                text-fuchsia-100
                shadow-[0_0_18px_rgba(217,70,239,0.18)]
                hover:border-fuchsia-300/60
                hover:bg-fuchsia-500/25
              `
              : active
                ? `
                  border-cyan-300/30
                  bg-cyan-400/15
                  text-cyan-100
                  hover:bg-cyan-400/20
                `
                : `
                  border-white/10
                  bg-white/[0.06]
                  text-white/60
                  hover:bg-white/[0.10]
                `
        }

        ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : ''
        }
      `}
    >
      <Icon size={20} />

      <span className="max-w-full truncate px-0.5">
        {label}
      </span>
    </button>
  )
}