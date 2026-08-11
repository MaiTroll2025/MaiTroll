import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useSingOffStore } from '../store/useSingOffStore'
import { useSingOffActions } from '../hooks/useSingOffActions'
import { useShallow } from 'zustand/react/shallow'
import { useSingOffLiveKit } from '../hooks/useSingOffLiveKit'
import { useSingOffRealtime } from '../hooks/useSingOffRealtime'
import { RemoteVideoRenderer } from './RemoteVideoRenderer'
import { MicStand } from './MicStand'
import { ChallengerTile } from './ChallengerTile'
import { HostTile } from './HostTile'
import { JudgeTile } from './JudgeTile'
import { CEOSeat } from './CEOSeat'
import { CountdownOverlay } from './CountdownOverlay'
import { JudgeControls } from './JudgeControls'
import { StageControls } from './StageControls'
import { GiftPanel } from './GiftPanel'
import { SingOffCoinStore } from './SingOffCoinStore'
import { MaiWinnerEffect } from './MaiWinnerEffect'

interface StageLayoutProps {
  sessionId: string
  onBack: () => void
}

export function StageLayout({ sessionId, onBack }: StageLayoutProps) {
  const { user } = useAuthStore()
  const store = useSingOffStore(
    useShallow((s) => ({
      session: s.session,
      participants: s.participants,
      rounds: s.rounds,
      currentRound: s.currentRound,
      decisions: s.decisions,
      hostPosition: s.hostPosition,
      countdown: s.countdown,
      authority: s.authority,
      liveKit: s.liveKit,
      maiWinnerEffect: s.maiWinnerEffect,
      coinStoreOpen: s.coinStoreOpen,
    })),
  )
  const {
    setHostPosition,
    setCountdown,
    clearCountdown,
    setCoinStoreOpen,
    clearMaiWinnerEffect,
    setLiveKit,
  } = useSingOffStore.getState()

  const actions = useSingOffActions()

  useSingOffRealtime(sessionId, user?.id)

  const me = store.participants.find((p) => p.user_id === user?.id)
  const isOnStage = !!me && ['host', 'challenger', 'judge', 'host_judge', 'ceo_judge'].includes(me.role) && !!me.position
  const liveKitMode: 'singoff-publisher' | 'singoff-viewer' = isOnStage ? 'singoff-publisher' : 'singoff-viewer'

  const {
    isConnected,
    isPublishing,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    connect,
    publish,
    toggleMic,
    toggleCamera,
    leaveRoom,
  } = useSingOffLiveKit({
    roomName: store.session?.room_name ?? '',
    userId: user?.id ?? '',
    userName: me?.display_name || user?.user_metadata?.full_name || 'User',
    mode: liveKitMode,
    autoPublish: false,
    isAdmin: store.authority.is_ceo,
  })

  useEffect(() => {
    if (!store.session || !user?.id) return
    let cancelled = false
    connect().then((ok) => {
      if (cancelled) return
      setLiveKit({ isConnected: ok })
    })
    return () => {
      cancelled = true
      leaveRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.session?.id, user?.id, liveKitMode])

  // Challenger publishes after the 10s countdown resolves
  const [published, setPublished] = useState(false)
  const myCountdown = store.countdown?.targetUserId === user?.id ? store.countdown : null
  const [tick, setTick] = useState(0)
  const countdownRemaining = myCountdown ? Math.max(0, Math.ceil((myCountdown.startAt - Date.now()) / 1000)) : null

  useEffect(() => {
    if (!myCountdown) return
    const t = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [myCountdown])

  useEffect(() => {
    if (!myCountdown || !me || me.role !== 'challenger' || published) return
    if (!isConnected) return
    if (countdownRemaining <= 0) {
      void publish().then(() => {
        setPublished(true)
        clearCountdown()
        setTimeout(() => setTick((n) => n + 1), 250)
      })
      return
    }
    const t = setTimeout(() => setTick((n) => n + 1), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownRemaining, myCountdown, published, isConnected])

  const hostParticipant = store.participants.find((p) => p.position === 'host_stage')
  const challengerA = store.participants.find((p) => p.position === 'challenger_a')
  const challengerB = store.participants.find((p) => p.position === 'challenger_b')
  const judge1 = store.participants.find((p) => p.position === 'judge_1')
  const judge2 = store.participants.find((p) => p.position === 'judge_2')
  const judge3 = store.participants.find((p) => p.position === 'judge_3')
  const judge4 = store.participants.find((p) => p.position === 'judge_4')
  const hostJudge = store.participants.find((p) => p.position === 'host_judge')
  const ceoParticipant = store.participants.find((p) => p.position === 'ceo')

  const trackForUser = (userId?: string, participant?: { can_publish?: boolean }) => {
    if (!userId) return null
    if (userId === user?.id) return localVideoTrack ?? (participant?.can_publish ? undefined : null)
    return remoteUsers[userId]?.videoTrack ?? null
  }

  const isHostOrStaff = store.authority.is_host || store.authority.is_staff
  const canSeeGift = isHostOrStaff || store.authority.is_judge

  const [giftTarget, setGiftTarget] = useState<{ userId: string; name: string } | null>(null)

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-zinc-950 to-black p-4">
      <button onClick={onBack} className="absolute top-3 left-3 z-20 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700">
        ← Back to Lobby
      </button>
      <StageControls />

      {/* Center: Host + challengers */}
      <div className="relative flex items-end justify-center gap-12">
        <ChallengerTile
          participant={challengerA}
          videoTrack={trackForUser(challengerA?.user_id, challengerA)}
          position="challenger_a"
          countdown={challengerA?.user_id === store.countdown?.targetUserId ? countdownRemaining : null}
          isHost={isHostOrStaff}
          onGift={() => setGiftTarget({ userId: challengerA!.user_id, name: challengerA!.display_name || 'Challenger' })}
          onKick={() => actions.kickUser(challengerA?.user_id ?? '')}
        />
        <div className="relative">
          <HostTile
            participant={(hostParticipant ?? me) as any}
            videoTrack={trackForUser(hostParticipant?.user_id ?? me?.user_id, hostParticipant ?? me)}
            isSpeaking={!!isPublishing}
            muted={!isPublishing}
            onSitToggle={() => setHostPosition(store.hostPosition === 'host_stage' ? 'host_judge' : 'host_stage')}
            sitting={store.hostPosition === 'host_judge'}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
          />
          {store.hostPosition === 'host_stage' && <MicStand live={!!isPublishing} muted={!isPublishing} />}
        </div>
        <ChallengerTile
          participant={challengerB}
          videoTrack={trackForUser(challengerB?.user_id, challengerB)}
          position="challenger_b"
          countdown={challengerB?.user_id === store.countdown?.targetUserId ? countdownRemaining : null}
          isHost={isHostOrStaff}
          onGift={() => setGiftTarget({ userId: challengerB!.user_id, name: challengerB!.display_name || 'Challenger' })}
          onKick={() => actions.kickUser(challengerB?.user_id ?? '')}
        />
      </div>

      {/* Judge panel (bottom) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <div className="relative flex items-end justify-center gap-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 px-4 py-3">
          <JudgeTile participant={judge1} seatIndex={1} isSpeaking={false} isMe={judge1?.user_id === user?.id} />
          <JudgeTile participant={judge2} seatIndex={2} isSpeaking={false} isMe={judge2?.user_id === user?.id} />
          <JudgeTile participant={judge3} seatIndex={3} isSpeaking={false} isMe={judge3?.user_id === user?.id} />
          <JudgeTile participant={judge4} seatIndex={4} isSpeaking={false} isMe={judge4?.user_id === user?.id} />
          {hostJudge && (
            <div className="flex flex-col items-center">
              <div className="relative aspect-square w-20 rounded-lg overflow-hidden border-2 border-cyan-500 bg-zinc-800">
                <img src={hostJudge.avatar_url || '/placeholder.svg'} alt={hostJudge.display_name} className="h-full w-full object-cover opacity-80" />
              </div>
              <span className="mt-0.5 text-[9px] text-cyan-300">{hostJudge.display_name?.split(' ')[0]} (host)</span>
            </div>
          )}
          <CEOSeat
            participant={ceoParticipant}
            videoTrack={trackForUser(ceoParticipant?.user_id, ceoParticipant)}
            canDeclare={store.authority.is_ceo}
            onMaiWinner={(challengerId) => actions.submitDecision(challengerId, 'yes', true)}
            currentRoundChallengers={{
              a: store.currentRound?.challenger_a_id ?? '',
              b: store.currentRound?.challenger_b_id ?? '',
            }}
          />
        </div>
      </div>

      <JudgeControls />

      {/* Floating coins control */}
      <div className="absolute bottom-4 right-4 z-20">
        <button
          onClick={() => setCoinStoreOpen(true)}
          className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-500/30"
          title="Buy coins"
        >
          <Coins className="w-3 h-3" /> Coins
        </button>
      </div>

      <GiftPanel open={!!giftTarget} recipientUserId={giftTarget?.userId ?? null} recipientName={giftTarget?.name ?? ''} onClose={() => setGiftTarget(null)} />
      <SingOffCoinStore open={store.coinStoreOpen} onClose={() => setCoinStoreOpen(false)} />

      {store.maiWinnerEffect && (
        <MaiWinnerEffect challengerName={store.maiWinnerEffect.challengerName} onComplete={() => clearMaiWinnerEffect()} />
      )}
      {me?.role === 'challenger' && countdownRemaining !== null && countdownRemaining > 0 && (
        <CountdownOverlay remaining={countdownRemaining} targetName={me?.display_name || 'Performer'} />
      )}
    </div>
  )
}
