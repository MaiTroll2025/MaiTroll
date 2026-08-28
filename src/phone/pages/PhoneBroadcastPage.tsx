import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Gift,
  Heart,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Swords,
  Video,
  VideoOff,
} from 'lucide-react'
import {
  LocalAudioTrack,
  LocalVideoTrack,
} from 'livekit-client'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

import { useStreamSeats } from '@/hooks/useStreamSeats'
import { useLiveBroadcast } from '@/hooks/useLiveBroadcast'
import { useStreamAudiencePresence } from '@/hooks/useStreamAudiencePresence'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'
import {
  useTargetedGiftQueue,
  type StreamGiftEvent,
} from '@/hooks/useTargetedGiftQueue'

import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { sendChatThroughGate } from '@/lib/sendChatThroughGate'
import { sendStreamBroadcast } from '@/lib/realtime/streamRealtimeManager'
import { hydrateGiftForOverlay } from '@/lib/gifts'
import { getGiftVisualConfig } from '@/lib/giftVisuals'

import BroadcastGrid from '@/components/broadcast/BroadcastGrid'
import MobileAudienceTicker from '@/components/broadcast/MobileAudienceTicker'
import MobileBroadcastHostSettings from '@/components/broadcast/MobileBroadcastHostSettings'
import ErrorBoundary from '@/components/ErrorBoundary'

import BattleView from '@/pages/broadcast/BattleView'

import PhoneGiftModal from '@/phone/components/PhoneGiftModal'
import MaiBag from '@/components/mai-bag/MaiBag'
import GiftVideoOverlay from '@/components/broadcast/GiftVideoOverlay'

import type { Stream } from '@/types/broadcast'
import type { BroadcastGift } from '@/hooks/useBroadcastRealtime'

type FloatingMessage = {
  id: string
  text: string
  username: string
  timestamp: number
  isSystem?: boolean
}

export default function PhoneBroadcastPage() {
  const { id, streamId: routeStreamIdParam } = useParams()
  const navigate = useNavigate()

  const routeStreamId = id || routeStreamIdParam || ''

  const {
    user,
    profile: broadcasterProfile,
  } = useAuthStore()

  const [stream, setStream] = useState<Stream | null>(null)

  const [isGiftModalOpen, setIsGiftModalOpen] =
    useState(false)

  const [floatingMessages, setFloatingMessages] =
    useState<FloatingMessage[]>([])

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

  const streamEndedRef =
    useRef(false)

  const { enqueueGift } =
    useTargetedGiftQueue()

  /*
   * ============================================================
   * FETCH STREAM
   * ============================================================
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
            error,
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
            error,
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
   * ============================================================
   * LIVE BROADCAST SESSION
   * ============================================================
   */

  const session = useLiveBroadcast({
    streamId: streamId || '',
    isHost: true,
    facingMode: 'user',
  })

  /*
   * ============================================================
   * SEATS / AUDIENCE
   * ============================================================
   */

  const {
    seats,
    joinSeat,
    leaveSeat,
  } = useStreamSeats(
    streamId || '',
    user?.id,
    broadcasterProfile,
    stream as any,
  )

  const { audience } =
    useStreamAudiencePresence(
      streamId || '',
      user?.id,
    )

  /*
   * ============================================================
   * GIFT PROCESSING
   * ============================================================
   */

  const processGiftEvent = useCallback(
    async (rawGift: any) => {
      if (!rawGift) return

      const animationId = String(
        rawGift.id ||
          rawGift.stream_gift_id ||
          rawGift.gift_transaction_id ||
          '',
      )

      if (!animationId) return

      if (
        processedGiftIdsRef.current.has(animationId)
      ) {
        return
      }

      processedGiftIdsRef.current.add(
        animationId,
      )

      window.setTimeout(() => {
        processedGiftIdsRef.current.delete(
          animationId,
        )
      }, 12_000)

      try {
        const enrichedGiftData =
          await hydrateGiftForOverlay(rawGift)

        if (!enrichedGiftData) return

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

        const resolvedGiftAmount =
          enrichedGiftData?.metadata?.coins_spent ||
          enrichedGiftData?.coins_spent ||
          enrichedGiftData?.amount ||
          1

        const resolvedGiftName =
          enrichedGiftData?.gift_name ||
          enrichedGiftData?.name ||
          enrichedGiftData?.metadata?.gift_name ||
          'Gift'

        const createdAt =
          enrichedGiftData?.timestamp ||
          enrichedGiftData?.created_at ||
          new Date().toISOString()

        const newGift: BroadcastGift = {
          id: animationId,

          gift_id:
            enrichedGiftData?.gift_id || '',

          gift_name:
            resolvedGiftName,

          gift_icon:
            enrichedGiftData?.gift_icon ||
            enrichedGiftData?.metadata?.gift_icon ||
            '🎁',

          gift_slug:
            enrichedGiftData?.gift_slug ||
            enrichedGiftData?.metadata?.gift_slug,

          animation_key:
            enrichedGiftData?.animation_key ||
            enrichedGiftData?.metadata?.animation_key,

          animation_type:
            enrichedGiftData?.animation_type ||
            enrichedGiftData?.metadata?.animation_type ||
            'video',

          animation_url:
            resolvedMedia,

          video_url:
            resolvedMedia,

          animation_duration_ms:
            enrichedGiftData?.animation_duration_ms ||
            enrichedGiftData?.metadata
              ?.animation_duration_ms,

          sound_url:
            enrichedGiftData?.sound_url ||
            enrichedGiftData?.metadata?.sound_url,

          is_fullscreen:
            enrichedGiftData?.is_fullscreen ??
            enrichedGiftData?.metadata?.is_fullscreen,

          rarity:
            enrichedGiftData?.rarity ||
            enrichedGiftData?.metadata?.rarity,

          tray_visual_url:
            enrichedGiftData?.tray_visual_url ||
            enrichedGiftData?.metadata?.tray_visual_url,

          tray_gradient:
            enrichedGiftData?.tray_gradient ||
            enrichedGiftData?.metadata?.tray_gradient,

          amount:
            resolvedGiftAmount,

          quantity:
            enrichedGiftData?.quantity || 1,

          sender_id:
            enrichedGiftData?.sender_id,

          sender_name:
            enrichedGiftData?.sender_name ||
            enrichedGiftData?.metadata?.sender_name ||
            'Someone',

          receiver_id:
            enrichedGiftData?.receiver_id ||
            stream?.user_id,

          receiver_name:
            enrichedGiftData?.receiver_name ||
            enrichedGiftData?.metadata?.receiver_name,

          created_at:
            createdAt,
        }

        const streamGiftEvent: StreamGiftEvent = {
          id: animationId,

          stream_id:
            streamId || '',

          gift_id:
            enrichedGiftData?.gift_id || '',

          gift_name:
            resolvedGiftName,

          sender_user_id:
            enrichedGiftData?.sender_id || '',

          recipient_user_id:
            enrichedGiftData?.receiver_id ||
            stream?.user_id ||
            '',

          recipient_type:
            'broadcaster',

          recipient_seat_index:
            null,

          animation_url:
            resolvedMedia,

          animation_url_webm:
            enrichedGiftData?.animation_url_webm ||
            null,

          animation_url_mp4:
            enrichedGiftData?.animation_url_mp4 ||
            null,

          animation_url_mov:
            enrichedGiftData?.animation_url_mov ||
            null,

          animation_type:
            (newGift.animation_type ||
              'video') as StreamGiftEvent['animation_type'],

          animation_duration_ms:
            newGift.animation_duration_ms ||
            7000,

          sound_url:
            newGift.sound_url ||
            null,

          created_at:
            createdAt,
        }

        enqueueGift(streamGiftEvent)

        setRecentGifts((prev) =>
          prev.some((g) => g.id === newGift.id) ? prev : [...prev, newGift].slice(-20)
        )

        const duration =
          newGift.animation_duration_ms ??
          getGiftVisualConfig(newGift).durationMs

        window.setTimeout(() => {
          setRecentGifts((prev) =>
            prev.filter((gift) => gift.id !== newGift.id)
          )
        }, duration + 150)
      } catch (error) {
        console.error(
          '[PhoneBroadcastPage] Gift processing failed:',
          error,
        )
      }
    },
    [
      enqueueGift,
      stream?.user_id,
      streamId,
    ],
  )

  /*
   * ============================================================
   * STREAM REALTIME
   * ============================================================
   */

  useStreamRealtime(
    streamId || '',
    {
      onStream: (event) => {
        const next = event?.new

        if (!next) return

        if (
          next.status === 'ended' ||
          next.ended_at
        ) {
          if (streamEndedRef.current) return

          streamEndedRef.current = true

          try {
            session.disconnect()
          } catch {
            // Ignore disconnect errors during shutdown.
          }

          navigate(
            `/broadcast/summary/${streamId}`,
            { replace: true },
          )

          return
        }

        setStream((previous) => {
          if (!previous) {
            return next as Stream
          }

          return {
            ...(previous as any),
            ...(next as any),
          } as Stream
        })
      },

      onMessage: (event) => {
        const newRow = event?.new

        if (!newRow) return

        const msgId = String(
          newRow.id ||
            newRow.txn_id ||
            '',
        )

        if (!msgId) return

        if (
          broadcastChatMessageIdsRef.current.has(
            msgId,
          )
        ) {
          return
        }

        const username =
          newRow.user_name ||
          newRow.username ||
          'Viewer'

        const content =
          newRow.content || ''

        if (!content) return

        const chatKey =
          `${username}:${content}`

        const now = Date.now()

        const existingTimestamp =
          recentChatKeysRef.current.get(
            chatKey,
          )

        if (
          existingTimestamp !== undefined &&
          now - existingTimestamp < 1500
        ) {
          return
        }

        broadcastChatMessageIdsRef.current.add(
          msgId,
        )

        recentChatKeysRef.current.set(
          chatKey,
          now,
        )

        const floatingMessage: FloatingMessage = {
          id: msgId,
          username,
          text: content,
          timestamp: now,
        }

        setFloatingMessages(
          (previous) =>
            [
              floatingMessage,
              ...previous,
            ].slice(0, 50),
        )

        window.setTimeout(() => {
          setFloatingMessages(
            (previous) =>
              previous.filter(
                (message) =>
                  message.id !== msgId,
              ),
          )
        }, 30_000)
      },

      onGift: (event) => {
        const rawGift = event?.new ?? event

        if (rawGift) {
          void processGiftEvent(rawGift)
        }
      },

      onPresenceBroadcast: (event) => {
        if (
          event.table !==
          'broadcast:like_sent'
        ) {
          return
        }

        const likeData =
          event.new ||
          event.raw?.payload ||
          {}

        if (
          likeData.user_id === user?.id
        ) {
          return
        }

        const totalLikes =
          typeof likeData.total_likes ===
          'number'
            ? likeData.total_likes
            : null

        if (totalLikes === null) {
          return
        }

        setStream((previous) =>
          previous
            ? {
                ...previous,
                total_likes:
                  totalLikes,
              }
            : previous,
        )
      },
    },
  )

  /*
   * ============================================================
   * FLOATING CHAT CHANNEL
   * ============================================================
   */

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(
      `floating-chat:${streamId}`,
    )

    floatingChatChannelRef.current =
      channel

    channel
      .on(
        'broadcast',
        { event: 'floating_chat' },
        (payload: any) => {
          const {
            username,
            content,
            isSystem,
          } =
            payload?.payload || {}

          if (!username || !content) {
            return
          }

          const chatKey =
            `${username}:${content}`

          const now = Date.now()

          const existingTimestamp =
            recentChatKeysRef.current.get(
              chatKey,
            )

          if (
            existingTimestamp !== undefined &&
            now - existingTimestamp < 1500
          ) {
            return
          }

          recentChatKeysRef.current.set(
            chatKey,
            now,
          )

          const messageId =
            `remote-${now}-${Math.random()
              .toString(36)
              .slice(2, 8)}`

          const message: FloatingMessage = {
            id: messageId,
            text: content,
            username,
            timestamp: now,
            isSystem,
          }

          setFloatingMessages(
            (previous) =>
              [
                message,
                ...previous,
              ].slice(0, 50),
          )

          window.setTimeout(() => {
            setFloatingMessages(
              (previous) =>
                previous.filter(
                  (item) =>
                    item.id !== messageId,
                ),
            )
          }, 30_000)
        },
      )
      .subscribe()

    return () => {
      floatingChatChannelRef.current =
        null

      void supabase.removeChannel(
        channel,
      )
    }
  }, [streamId])

  /*
   * ============================================================
   * LIVEKIT SEAT IDENTITY MAP
   * ============================================================
   */

  const userIdToLiveKitIdentity =
    useMemo(() => {
      const mapping: Record<
        string,
        string
      > = {}

      if (!seats) {
        return mapping
      }

      Object.values(seats).forEach(
        (seat: any) => {
          const userId =
            seat?.user_id ||
            seat?.guest_id

          const identity =
            seat?.livekit_participant_identity ||
            seat?.participant_identity ||
            seat?.livekit_identity

          if (
            userId &&
            identity
          ) {
            mapping[userId] =
              identity
          }
        },
      )

      return mapping
    }, [seats])

  /*
   * ============================================================
   * RANDOM BATTLE
   * ============================================================
   */

  const shouldShowRandomBattleArena =
    stream?.battle_mode ===
      'random_queue' &&
    !!stream?.battle_id &&
    stream?.is_battle === true &&
    (
      stream?.battle_status ===
        'ready' ||
      stream?.battle_status ===
        'starting' ||
      stream?.battle_status ===
        'active'
    )

  const activeBattleId =
    shouldShowRandomBattleArena
      ? stream?.battle_id ?? null
      : null

  const battleLocalTracks =
    useMemo(() => {
      const tracks =
        session.localTracks

      if (!tracks) {
        return null
      }

      const audio =
        tracks.find(
          (track) =>
            track?.kind === 'audio',
        ) as
          | LocalAudioTrack
          | undefined

      const video =
        tracks.find(
          (track) =>
            track?.kind === 'video',
        ) as
          | LocalVideoTrack
          | undefined

      if (!audio && !video) {
        return null
      }

      return [
        audio,
        video,
      ] as [
        LocalAudioTrack | undefined,
        LocalVideoTrack | undefined,
      ]
    }, [session.localTracks])

  /*
   * ============================================================
   * CONNECT
   * ============================================================
   */

  useEffect(() => {
    if (!streamId) return

    void session.connect()

    return () => {
      /*
       * The broadcast session owns its LiveKit
       * lifecycle. Avoid forcing disconnect here because
       * battle transitions can reuse the same session.
       */
    }

    // session.connect is intentionally only triggered
    // when the stream ID changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId])

  /*
   * ============================================================
   * RANDOM BATTLE STREAM UPDATE
   * ============================================================
   */

  const handleRandomBattleStreamUpdate =
    useCallback(
      (patch: Partial<Stream>) => {
        setStream((previous) =>
          previous
            ? {
                ...previous,
                ...patch,
              }
            : previous,
        )
      },
      [],
    )

  const randomBattle =
    useRandomBattleQueueController({
      stream,
      userId: user?.id,
      isBroadcaster: true,
      onStreamUpdate:
        handleRandomBattleStreamUpdate,
    })

  const randomBattleIsActive =
    randomBattle.phase === 'starting' ||
    randomBattle.phase === 'active'

  /*
   * ============================================================
   * GIFTS
   * ============================================================
   */

  const handleGift = useCallback(() => {
    if (!user) {
      navigate('/auth?mode=signup')
      return
    }

    setIsGiftModalOpen(true)
  }, [navigate, user])

  /*
   * ============================================================
   * LIKES
   * ============================================================
   */

  const handleLike = useCallback(
    async () => {
      if (!user) {
        navigate('/auth?mode=signup')
        return
      }

      if (!streamId) return

      setStream((previous) =>
        previous
          ? {
              ...previous,
              total_likes:
                Number(
                  previous.total_likes || 0,
                ) + 1,
            }
          : previous,
      )

      try {
        const { data, error } =
          await supabase.rpc(
            'increment_stream_likes',
            {
              p_stream_id:
                streamId,
              p_like_count: 1,
            },
          )

        if (error) {
          throw error
        }

        if (
          typeof data === 'number'
        ) {
          setStream((previous) =>
            previous
              ? {
                  ...previous,
                  total_likes:
                    data,
                }
              : previous,
          )

          try {
            await sendStreamBroadcast(
              streamId,
              'like_sent',
              {
                user_id:
                  user.id,
                stream_id:
                  streamId,
                total_likes:
                  data,
              },
            )
          } catch {
            // Realtime broadcast failure
            // must not break liking.
          }
        }
      } catch (error) {
        console.warn(
          '[PhoneBroadcastPage] Like failed:',
          error,
        )
      }
    },
    [
      navigate,
      streamId,
      user,
    ],
  )

  /*
   * ============================================================
   * END STREAM
   * ============================================================
   */

  const endStream = useCallback(
    async () => {
      if (streamEndedRef.current) {
        return
      }

      streamEndedRef.current = true

      if (
        stream?.is_battle &&
        stream?.battle_id &&
        stream?.battle_mode ===
          'random_queue' &&
        user?.id
      ) {
        try {
          await supabase.rpc(
            'forfeit_random_battle',
            {
              p_stream_id:
                stream.id,
              p_broadcaster_id:
                user.id,
            },
          )
        } catch (error) {
          console.warn(
            '[PhoneBroadcastPage] forfeit_random_battle failed:',
            error,
          )
        }
      }

      if (
        randomBattle.isQueueEnabled &&
        !randomBattle.isBattleActive
      ) {
        try {
          await randomBattle.stopQueue()
        } catch {
          // Stream shutdown continues even if
          // queue cleanup fails.
        }
      }

      try {
        session.disconnect()
      } catch {
        // Ignore disconnect errors during shutdown.
      }

      navigate(
        `/broadcast/summary/${streamId}`,
        { replace: true },
      )
    },
    [
      navigate,
      randomBattle,
      session,
      stream,
      streamId,
      user?.id,
    ],
  )

  /*
   * ============================================================
   * RANDOM MATCH
   * ============================================================
   */

  const handleRandomMatch =
    useCallback(() => {
      if (
        randomBattle.isBusy ||
        randomBattle.isBattleActive
      ) {
        return
      }

      void randomBattle.startQueue()
    }, [randomBattle])

  /*
   * ============================================================
   * CHAT
   * ============================================================
   */

  const handleChatSubmit =
    useCallback(
      async (
        event: React.FormEvent<HTMLFormElement>,
      ) => {
        event.preventDefault()

        const text =
          chatInput.trim()

        if (
          !text ||
          !streamId
        ) {
          return
        }

        const username =
          broadcasterProfile?.username ||
          user?.email?.split('@')?.[0] ||
          'Viewer'

        const messageId =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`

        const message: FloatingMessage = {
          id: messageId,
          text,
          username,
          timestamp: Date.now(),
        }

        setFloatingMessages(
          (previous) =>
            [
              message,
              ...previous,
            ].slice(0, 50),
        )

        setChatInput('')

        window.setTimeout(() => {
          setFloatingMessages(
            (previous) =>
              previous.filter(
                (item) =>
                  item.id !== messageId,
              ),
          )
        }, 30_000)

        try {
          const result =
            await sendChatThroughGate({
              streamId,
              content: text,
            })

          if (!result.ok) {
            setFloatingMessages(
              (previous) =>
                previous.filter(
                  (item) =>
                    item.id !== messageId,
                ),
            )

            return
          }

          const channel =
            floatingChatChannelRef.current

          if (channel) {
            try {
              await channel.send({
                type: 'broadcast',
                event: 'floating_chat',
                payload: {
                  username,
                  content: text,
                },
              })
            } catch {
              // Database message already succeeded.
            }
          }
        } catch (error) {
          console.warn(
            '[PhoneBroadcastPage] Chat send failed:',
            error,
          )

          setFloatingMessages(
            (previous) =>
              previous.filter(
                (item) =>
                  item.id !== messageId,
              ),
          )
        }
      },
      [
        broadcasterProfile?.username,
        chatInput,
        streamId,
        user?.email,
      ],
    )

  /*
   * ============================================================
   * BATTLE VIEW
   * ============================================================
   */

  const handleUpdateSeatCount =
    useCallback(
      async (newSeatCount: number) => {
        if (!streamId || !stream) return

        const clampedCount = Math.max(
          0,
          Math.min(6, newSeatCount),
        )

        const newBoxCount = clampedCount + 1

        try {
          await supabase
            .from('streams')
            .update({
              seat_count: clampedCount,
              box_count: newBoxCount,
            })
            .eq('id', streamId)

          setStream((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              seat_count: clampedCount,
              box_count: newBoxCount,
            } as Stream
          })
        } catch (error) {
          console.error(
            '[PhoneBroadcastPage] Failed to update seat count:',
            error,
          )
        }
      },
      [streamId, stream],
    )

  if (shouldShowRandomBattleArena) {
    return (
      <ErrorBoundary>
        <GiftSystemProvider
          streamId={streamId}
          defaultReceiverId={
            stream?.user_id
          }
        >
          <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
             <BattleView
               key={activeBattleId}
               battleId={
                 stream.battle_id!
               }
               currentStreamId={
                 streamId || stream.id
               }
               viewerId={user?.id}
               localTracks={
                 battleLocalTracks
               }
               remoteUsers={Array.from(
                 session.remoteParticipants.values(),
               )}
               userIdToLiveKitIdentity={
                 userIdToLiveKitIdentity
               }
               returnPathTemplate={
                 '/broadcast/:id'
               }
               onReturnToStream={() => {
                setStream((previous) =>
                  previous
                    ? {
                        ...previous,
                        is_battle:
                          false,
                        battle_id:
                          null,
                        battle_mode:
                          'none' as any,
                        battle_status:
                          'waiting' as any,
                      }
                    : previous,
                )
              }}
              onToggleCamera={
                session.toggleCamera
              }
              onToggleMic={
                session.toggleMicrophone
              }
            />

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
      </ErrorBoundary>
    )

  /*
   * ============================================================
   * BATTLE VIEW
   * ============================================================
   */

  return (
    <GiftSystemProvider
      streamId={streamId}
      defaultReceiverId={
        stream?.user_id
      }
    >
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white">

        {/* ======================================================
            VIDEO / SEATS
        ====================================================== */}

        <div className="relative min-h-0 flex-1">

          {stream && (
            <BroadcastGrid
              stream={stream as any}
              streamStatus={
                stream.status || 'live'
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
                  stream?.seat_prices?.[
                    index
                  ] ??
                    stream?.seat_price ??
                    0,
                )
              }
              onLeaveSeat={
                leaveSeat
              }
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
                session.remoteParticipants.values(),
              )}
              localUserId={
                user?.id || ''
              }
            />
          )}

          {/* ====================================================
              AUDIENCE + LIKES
          ==================================================== */}

          {stream && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-start gap-1.5 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">

              <div className="pointer-events-auto w-full rounded-2xl border border-cyan-400/10 bg-gradient-to-r from-slate-950/85 via-black/70 to-slate-950/85 px-2 py-1.5 shadow-[0_2px_24px_rgba(34,211,238,0.10)] backdrop-blur-md">
                <MobileAudienceTicker
                  audience={audience}
                  currentUserId={
                    user?.id
                  }
                  hostUserId={
                    stream.user_id
                  }
                  viewerCount={
                    stream.viewer_count ??
                    0
                  }
                  likes={
                    stream.total_likes ??
                    0
                  }
                  maxVisible={6}
                />
              </div>

              {broadcasterProfile?.troll_coins !== undefined && (
                <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-yellow-400/15 bg-black/50 px-2.5 py-1 backdrop-blur-md">
                  <span className="text-[9px] font-black text-yellow-300">
                    {Number(broadcasterProfile.troll_coins || 0).toLocaleString()}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-yellow-200/60">
                    Coins
                  </span>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLike}
                  aria-label="Like stream"
                  className="pointer-events-auto relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pink-400/20 bg-black/50 backdrop-blur-xl transition active:scale-90"
                >
                  <Heart
                    size={14}
                    className="text-pink-300"
                  />

                  <span className="absolute -bottom-1 -right-1 rounded-full border border-pink-400/30 bg-pink-500/20 px-1 text-[8px] font-black text-pink-100">
                    {Math.max(
                      0,
                      Number(
                        stream.total_likes ??
                          0,
                      ),
                    ).toLocaleString()}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================
            HOST SETTINGS
        ====================================================== */}

        {stream && (
          <div className="absolute bottom-24 right-3 z-50">
            <MobileBroadcastHostSettings
              isMicOn={
                session.micEnabled
              }
              isCamOn={
                session.cameraEnabled
              }
              isLive={
                stream.status ===
                'live'
              }
              hasRgbEffect={
                !!stream.has_rgb_effect
              }
              isChatLocked={
                !!stream.is_chat_locked
              }
              unreadMessageCount={0}
              seatCount={
                stream?.seat_count ?? 0
              }
              onUpdateSeatCount={
                handleUpdateSeatCount
              }
              onToggleMic={
                session.toggleMicrophone
              }
              onToggleCamera={
                session.toggleCamera
              }
              onFlipCamera={
                session.flipCamera
              }
              onGift={handleGift}
              onShare={() => {}}
              onOpenMessage={() => {}}
              onEndStream={
                endStream
              }
              onOpenCoinStore={() => {}}
              onInviteFollowers={() => {}}
              onToggleRGB={() => {}}
              onTextPopup={() => {}}
            />
          </div>
        )}

        {/* ======================================================
            FLYING CHAT
        ====================================================== */}

        {floatingMessages.length >
          0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-1 px-3">
            {floatingMessages
              .slice(0, 8)
              .map((message) => (
                <div
                  key={message.id}
                  className="pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1.5 shadow-lg backdrop-blur-md">
                    <span className="text-[10px] font-black text-cyan-300">
                      {message.username}
                    </span>

                    <span className="text-[10px] font-bold text-white/40">
                      :{' '}
                    </span>

                    <span className="text-[10px] font-semibold text-white/90">
                      {message.text}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ======================================================
            CHAT INPUT
        ====================================================== */}

        <form
          onSubmit={
            handleChatSubmit
          }
          className="shrink-0 border-t border-white/10 bg-slate-950/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(event) =>
              setChatInput(
                event.target.value,
              )
            }
            placeholder="Say something..."
            maxLength={280}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
          />
        </form>

        {/* ======================================================
            PHONE CONTROL BAR
        ====================================================== */}

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

          {/* RANDOM MATCH */}

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

        {/* ======================================================
            GIFT MODAL
        ====================================================== */}

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

        <GiftVideoOverlay
          gifts={recentGifts}
          onFinish={(giftId) =>
            setRecentGifts((prev) =>
              prev.filter((gift) => gift.id !== giftId),
            )
          }
        />
      </div>
    </GiftSystemProvider>
  )
}

/*
 * ================================================================
 * CONTROL BUTTON
 * ================================================================
 */

function ControlButton({
  active,
  onClick,
  icon: Icon,
  label,
  danger = false,
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
      aria-label={label}
      className={`
        flex h-14 w-14 shrink-0
        flex-col items-center justify-center
        gap-1 rounded-2xl border
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
}
