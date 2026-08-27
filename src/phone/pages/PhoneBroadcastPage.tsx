import React, { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { useStreamSeats } from '@/hooks/useStreamSeats'
import { useLiveBroadcast } from '@/hooks/useLiveBroadcast'
import { GiftSystemProvider } from '@/lib/hooks/useGiftSystem'
import { useRandomBattleQueueController } from '@/hooks/useRandomBattleQueueController'

import BroadcastGrid from '@/components/broadcast/BroadcastGrid'
import BroadcastChat from '@/components/broadcast/BroadcastChat'
import RandomBattleBanner from '@/components/broadcast/RandomBattleBanner'
import ErrorBoundary from '@/components/ErrorBoundary'
import BattleView from '@/pages/broadcast/BattleView'
import { LocalAudioTrack, LocalVideoTrack } from 'livekit-client'

import { supabase } from '@/lib/supabase'
import type { Stream } from '@/types/broadcast'

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
    facingMode: 'user',
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

  /*
   * -------------------------------------------------------------
   * END STREAM
   * -------------------------------------------------------------
   */

  const endStream = async () => {
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
        });
      } catch (forfeitErr) {
        console.warn('[PhoneBroadcastPage] forfeit_random_battle failed:', forfeitErr);
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

    window.history.back()
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
    const battleLocalTracks =
      session.localTracks?.[0] || session.localTracks?.[1]
        ? ([session.localTracks?.[0], session.localTracks?.[1]] as [LocalAudioTrack | undefined, LocalVideoTrack | undefined])
        : null;

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
              RANDOM BATTLE BANNER
          ====================================================== */}

          <div className="pointer-events-auto absolute left-0 right-0 top-0 z-20">
            <RandomBattleBanner
              phase={randomBattle.phase}
              delayUntil={
                randomBattle.delayUntil
              }
              isBroadcaster
              onStartQueue={
                randomBattle.startQueue
              }
              onStopQueue={
                randomBattle.stopQueue
              }
              isBusy={
                randomBattle.isBusy
              }
              mobileSafe
            />
          </div>

        </div>

        {/* =======================================================
            CHAT
        ======================================================== */}

        <div className="h-[32vh] shrink-0 border-t border-white/10">
          <BroadcastChat
            streamId={streamId}
            hostId={
              stream?.user_id || ''
            }
            isHost
          />
        </div>

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
            GIFT MODAL / MAI BAG
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