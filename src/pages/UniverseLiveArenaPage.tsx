import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Crown,
  Eye,
  Gift,
  Mic,
  Radio,
  ShieldAlert,
  Signal,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  fetchActiveRounds,
  universeActivateAbility,
  universeClaimTrollBag,
} from '../lib/api/universe'
import UniverseArenaBackground from '../components/universe/UniverseArenaBackground'
import UniverseLiveKitStage from '../components/universe/UniverseLiveKitStage'
import BroadcastChat from '../components/broadcast/BroadcastChat'

const ABILITIES = [
  { type: 'triple_gifts', label: 'Triple Gifts', dur: 30, color: 'fuchsia', icon: Gift },
  { type: 'timer_troll', label: 'Timer Troll', dur: 0, color: 'sky', icon: Timer },
  { type: 'hidden_challenger_score', label: 'Hidden Score', dur: 30, color: 'violet', icon: Eye },
  { type: 'turtle_mode', label: 'Turtle Mode', dur: 0, color: 'emerald', icon: ShieldAlert },
  { type: 'troll_mode', label: 'Troll Mode', dur: 20, color: 'rose', icon: Sparkles },
  { type: 'officer_fee', label: 'Officer Fee', dur: 0, color: 'amber', icon: ShieldAlert },
  { type: 'scramble_score', label: 'Scramble Score', dur: 20, color: 'rose', icon: Sparkles },
] as const

const _colorMap: Record<string, { text: string; border: string; glow: string; bg: string; chip: string }> = {
  fuchsia: { text: 'text-fuchsia-200', border: 'border-fuchsia-400/50', glow: 'shadow-[0_0_30px_rgba(232,121,249,0.55)]', bg: 'from-fuchsia-600/20', chip: 'bg-fuchsia-400/15' },
  sky: { text: 'text-sky-200', border: 'border-sky-400/50', glow: 'shadow-[0_0_30px_rgba(56,189,248,0.55)]', bg: 'from-sky-600/20', chip: 'bg-sky-400/15' },
  violet: { text: 'text-violet-200', border: 'border-violet-400/50', glow: 'shadow-[0_0_30px_rgba(167,139,250,0.55)]', bg: 'from-violet-600/20', chip: 'bg-violet-400/15' },
  emerald: { text: 'text-emerald-200', border: 'border-emerald-400/50', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.5)]', bg: 'from-emerald-600/20', chip: 'bg-emerald-400/15' },
  amber: { text: 'text-amber-200', border: 'border-amber-400/50', glow: 'shadow-[0_0_30px_rgba(251,191,36,0.5)]', bg: 'from-amber-600/20', chip: 'bg-amber-400/15' },
  rose: { text: 'text-rose-200', border: 'border-rose-400/50', glow: 'shadow-[0_0_30px_rgba(251,113,133,0.5)]', bg: 'from-rose-600/20', chip: 'bg-rose-400/15' },
}

// Diamond wolf logo (SVG path) for team branding.
function WolfLogo({ side }: { side: 'A' | 'B' }) {
  const fill = side === 'A' ? '#7dd3fc' : '#fda4af'
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={fill} strokeWidth={1.6} strokeLinejoin="round">
      <path d="M3 10 L6 6 L9 9 L12 4 L15 9 L18 6 L21 10 L18 13 L18 20 L14 18 L12 20 L10 18 L6 20 L6 13 Z" />
    </svg>
  )
}

function CrystalDiamond({
  username,
  isHost,
  side,
  score,
  quality,
  locked,
  media,
}: {
  username?: string
  isHost?: boolean
  side: 'A' | 'B'
  score?: number
  quality?: number
  locked?: boolean
  media?: React.ReactNode
}) {
  const sideTint = side === 'A' ? 'from-sky-500/40 to-sky-950/40' : 'from-rose-500/40 to-rose-950/40'
  const sideRing = side === 'A' ? 'border-sky-200/80' : 'border-rose-200/80'
  const sideGlow = side === 'A' ? 'shadow-[0_0_50px_rgba(56,189,248,0.55)]' : 'shadow-[0_0_50px_rgba(244,63,94,0.55)]'
  const live = side === 'A' ? 'bg-sky-400' : 'bg-rose-500'
  return (
    <motion.div
      whileHover={locked ? undefined : { scale: 1.04, y: -4 }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative flex aspect-square w-full items-center justify-center will-change-transform"
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="absolute top-0 left-0 h-1.5 w-1.5 rounded-full bg-white animate-[edgeRun_3s_linear_infinite] [box-shadow:0_0_10px_rgba(255,255,255,0.9)]" />
      </span>
      <span className="absolute left-2 top-2 h-1/3 w-1/3 rounded-full bg-white/25 blur-md" />
      <div
        className={`relative flex h-[88%] w-[92%] items-center justify-center overflow-hidden rounded-2xl border-2 ${sideRing} ${sideGlow} bg-gradient-to-br ${sideTint} backdrop-blur-md`}
      >
        {media ? <div className="absolute inset-0">{media}</div> : null}
        {username ? (
          <div className="flex w-full flex-col items-center px-1 text-center">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-black/50 text-[12px] font-black text-white">
              {username.slice(0, 2).toUpperCase()}
              <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${live}`}>
                <Mic className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
            <p className="mt-1.5 truncate text-[11px] font-black leading-tight text-white">{username}</p>
            {isHost ? (
              <>
                <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-slate-200/80">
                  <Video className="h-3 w-3" /> LIVE
                </p>
                {typeof score === 'number' ? (
                  <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-amber-200">
                    <Trophy className="h-3 w-3" /> {score.toLocaleString()}
                  </p>
                ) : null}
                {typeof quality === 'number' ? (
                  <p className="flex items-center gap-0.5 text-[9px] text-emerald-200">
                    <Signal className="h-3 w-3" /> {quality}%
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <span className="text-[9px] uppercase tracking-widest text-white/30">Open</span>
        )}
        {isHost ? (
          <Crown className="absolute -top-2 right-1 h-5 w-5 text-amber-300 [filter:drop-shadow(0_0_6px_rgba(251,191,36,0.8))]" />
        ) : null}
      </div>
    </motion.div>
  )
}

function CenterBeam({ leader: _leader, transitionPreparing: _transitionPreparing, roundEnding: _roundEnding }: any) {
  return (
    <div className="pointer-events-none relative flex min-h-[120px] items-center justify-center lg:h-full lg:min-h-0">
      <span className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 bg-gradient-to-b from-sky-400 via-fuchsia-400 to-rose-400 opacity-80 blur-[3px] [box-shadow:0_0_40px_rgba(232,121,249,0.8)] animate-pulse" />
      <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white/70 blur-[1px] animate-[beamSlide_3s_linear_infinite]" />
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-fuchsia-200/80"
          style={{
            left: '50%',
            top: `${8 + i * 7}%`,
            animation: `beamSlide ${2 + (i % 3)}s linear ${i * 0.25}s infinite`,
            boxShadow: '0 0 8px rgba(232,121,249,0.9)',
          }}
        />
      ))}
      <motion.div
        animate={{ scale: [1, 1.14, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full border border-fuchsia-300/50 bg-black/70 [box-shadow:0_0_55px_rgba(232,121,249,0.7)] sm:h-32 sm:w-32"
      >
        <motion.span
          className="absolute inset-2 rounded-full border-2 border-fuchsia-300/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ borderStyle: 'dashed' }}
        />
        <motion.span
          className="absolute inset-5 rounded-full border border-white/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <span className="absolute h-1 w-1 rounded-full bg-fuchsia-200 animate-ping" />
        <span className="text-5xl font-black text-fuchsia-200 [text-shadow:0_0_26px_rgba(232,121,249,0.95)] sm:text-6xl">VS</span>
      </motion.div>
      <span className="absolute left-1/2 top-1/4 h-16 w-px -translate-x-1/2 rotate-12 bg-gradient-to-b from-transparent via-fuchsia-200/70 to-transparent animate-pulse" />
      <span className="absolute left-1/2 bottom-1/4 h-16 w-px -translate-x-1/2 -rotate-12 bg-gradient-to-t from-transparent via-fuchsia-200/70 to-transparent animate-pulse" />
    </div>
  )
}

type Side = 'A' | 'B'

type QueueEntry = {
  id: string
  position?: number | null
  status?: string | null
  captain_user_id?: string | null
  captain?: {
    username?: string | null
    avatar_url?: string | null
  } | null
}

export default function UniverseLiveArenaPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [round, setRound] = useState<any>(null)
  const [teams, setTeams] = useState<{ A: any; B: any }>({ A: null, B: null })
  const [scores, setScores] = useState<{ A: any; B: any }>({ A: null, B: null })
  const [abilities, setAbilities] = useState<any[]>([])
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [_giftTarget, setGiftTarget] = useState<{
    teamId: string
    recipientId: string
    captainId: string
    label: string
  } | null>(null)

  const preloadedQueueEntryRef = useRef<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const loadRound = useCallback(async () => {
    const { data: rounds, error: roundError } = await fetchActiveRounds()

    if (roundError) {
      console.error('Unable to load active Universe round:', roundError)
      return
    }

    const activeRound = (rounds || [])[0]

    if (!activeRound) {
      setRound(null)
      setTeams({ A: null, B: null })
      setScores({ A: null, B: null })
      setAbilities([])
      setQueue([])
      return
    }

    setRound(activeRound)

    const { data: teamRows, error: teamError } = await supabase
      .from('universe_round_teams')
      .select(
        '*, captain:user_profiles!captain_user_id(username, avatar_url), s1:user_profiles!seat_one_user_id(username, avatar_url), s2:user_profiles!seat_two_user_id(username, avatar_url), s3:user_profiles!seat_three_user_id(username, avatar_url)',
      )
      .eq('round_id', activeRound.id)

    if (teamError) {
      console.error('Unable to load Universe teams:', teamError)
      return
    }

    const teamA = (teamRows || []).find((team: any) => team.side === 'A') || null
    const teamB = (teamRows || []).find((team: any) => team.side === 'B') || null

    setTeams({ A: teamA, B: teamB })

    const { data: scoreRows, error: scoreError } = await supabase
      .from('universe_round_scores')
      .select('*')
      .eq('round_id', activeRound.id)

    if (scoreError) {
      console.error('Unable to load Universe scores:', scoreError)
    } else {
      setScores({
        A: scoreRows?.find((score: any) => teamA && score.team_id === teamA.id) || null,
        B: scoreRows?.find((score: any) => teamB && score.team_id === teamB.id) || null,
      })
    }

    const { data: activeAbilities, error: abilityError } = await supabase
      .from('universe_abilities')
      .select('*')
      .eq('round_id', activeRound.id)
      .in('status', ['active', 'revealing'])
      .order('activated_at', { ascending: false })

    if (abilityError) {
      console.error('Unable to load Universe abilities:', abilityError)
    } else {
      setAbilities(activeAbilities || [])
    }

    const { data: queueRows, error: queueError } = await supabase
      .from('universe_queue')
      .select('*, captain:user_profiles!captain_user_id(username, avatar_url)')
      .eq('event_id', activeRound.event_id)
      .in('status', ['waiting', 'next', 'battling'])
      .order('position', { ascending: true })

    if (queueError) {
      console.error('Unable to load Universe queue:', queueError)
    } else {
      setQueue((queueRows || []) as QueueEntry[])
    }
  }, [])

  useEffect(() => {
    void loadRound()
  }, [loadRound])

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }

    ;(async () => {
      const { data, error } = await supabase.rpc('is_universe_admin')
      if (error) {
        console.error('Unable to verify Universe admin:', error)
        setIsAdmin(false)
        return
      }
      setIsAdmin(Boolean(data))
    })()
  }, [user])

  useEffect(() => {
    if (!round?.id) return

    const channel = supabase
      .channel(`universe-round:${round.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'universe_round_scores',
          filter: `round_id=eq.${round.id}`,
        },
        () => void loadRound(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'universe_abilities',
          filter: `round_id=eq.${round.id}`,
        },
        () => void loadRound(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'universe_round_teams',
          filter: `round_id=eq.${round.id}`,
        },
        () => void loadRound(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'universe_queue',
          filter: `event_id=eq.${round.event_id}`,
        },
        () => void loadRound(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadRound, round?.event_id, round?.id])

  const timerLeft = useMemo(() => {
    if (!round?.server_end_at) return 0
    return Math.max(0, (new Date(round.server_end_at).getTime() - now) / 1000)
  }, [now, round?.server_end_at])

  const transitionPreparing = Boolean(round && timerLeft > 0 && timerLeft <= 2)
  const roundEnding = Boolean(round && timerLeft <= 0)

  const nextQueueEntry = useMemo(
    () => queue.find((entry) => entry.status === 'next') || queue.find((entry) => entry.status === 'waiting') || null,
    [queue],
  )

  useEffect(() => {
    if (!transitionPreparing || !nextQueueEntry?.id) return
    if (preloadedQueueEntryRef.current === nextQueueEntry.id) return

    preloadedQueueEntryRef.current = nextQueueEntry.id

    if (nextQueueEntry.captain?.avatar_url) {
      const image = new Image()
      image.src = nextQueueEntry.captain.avatar_url
    }
  }, [nextQueueEntry, transitionPreparing])

  useEffect(() => {
    if (!roundEnding) return

    const timeout = window.setTimeout(() => {
      void loadRound()
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [loadRound, roundEnding])

  const openGift = (team: any, side: Side) => {
    if (!team) return

    if (transitionPreparing || roundEnding) {
      toast.info('Gifting is locked while the next match is loading.')
      return
    }

    setGiftTarget({
      teamId: team.id,
      recipientId: team.captain_user_id,
      captainId: team.captain_user_id,
      label: `Team ${side} Captain`,
    })

    toast.info(`Gift target: Team ${side} Captain`)
  }

  const claimBag = async () => {
    if (!round) return

    const result = await universeClaimTrollBag(round.id)

    if (result.success) toast.success(`Troll Bag: ${result.ability_type}`)
    else toast.error(result.error || 'No bag available')
  }

  const activate = async (ability: any, side: Side) => {
    if (transitionPreparing || roundEnding) {
      toast.info('Abilities are locked while the next match is loading.')
      return
    }

    const target = side === 'A' ? teams.A : teams.B
    if (!target) return

    const result = await universeActivateAbility(ability.id, target.id)

    if (result.success) toast.success(`${ability.ability_type} activated`)
    else toast.error(result.error || 'Cannot activate ability')
  }

  const isCaptainOf = (side: Side) =>
    Boolean(user && teams[side] && teams[side].captain_user_id === user.id)

  const hostId =
    teams.A?.captain_user_id ||
    teams.B?.captain_user_id ||
    user?.id ||
    ''

  const scoreA = Number(scores.A?.actual_score || 0)
  const scoreB = Number(scores.B?.actual_score || 0)
  const _scoreDifference = Math.abs(scoreA - scoreB)
  const leader: Side | null = scoreA === scoreB ? null : scoreA > scoreB ? 'A' : 'B'

  const activeTypes = useMemo(
    () => new Set((abilities || []).filter((a: any) => a.status === 'active' || a.status === 'revealing').map((a: any) => a.ability_type)),
    [abilities],
  )
  const hidden = activeTypes.has('hidden_challenger_score')
  const scramble = activeTypes.has('scramble_score')
  const triple = activeTypes.has('triple_gifts')
  const randScore = (seed: number) => Math.floor(8000 + ((Math.sin(seed + now / 200) * 0.5 + 0.5) * 24000))

  // Streaming switch: the current user is "on stage" (LiveKit publisher) when
  // they are the captain or a seat user (s1/s2/s3) of either team. Winning
  // users stay in the team for the next round, so they remain on stage.
  // Everyone else watches via Mux low-latency playback.
  const myOnStageSeat = useMemo(() => {
    if (!user) return null
    for (const side of ['A', 'B'] as Side[]) {
      const team = teams[side]
      if (!team) continue
      if (team.captain_user_id === user.id) return { side, seat: 0 }
      if (team.seat_one_user_id === user.id) return { side, seat: 1 }
      if (team.seat_two_user_id === user.id) return { side, seat: 2 }
      if (team.seat_three_user_id === user.id) return { side, seat: 3 }
    }
    return null
  }, [user, teams])

  const livekitRoomName = round?.livekit_room_name || teams.A?.livekit_room_name || teams.B?.livekit_room_name || null

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <style>{`
        @keyframes beamSlide { 0% { transform: translate(-50%, -120%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, 120%); opacity: 0; } }
        @keyframes edgeRun { 0% { top:0; left:0; } 25% { top:0; left:100%; } 50% { top:100%; left:100%; } 75% { top:100%; left:0; } 100% { top:0; left:0; } }
      `}</style>

      <UniverseArenaBackground />

      <main className="relative z-10 mx-auto w-full max-w-[1600px] px-2 pb-6 pt-3 sm:px-4 lg:px-5">
        <ArenaTopBar
          timerLeft={timerLeft}
          transitionPreparing={transitionPreparing}
          onBack={() => navigate('/universe')}
        />

        {!round ? (
          <EmptyArena />
        ) : (
          <>
            {/* SCORE HEADER BAR — hidden/scramble supported */}
            <div className="mt-3 rounded-3xl border border-white/10 bg-black/50 p-3 backdrop-blur-xl sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  <Radio className="h-4 w-4 text-fuchsia-300" /> Round 1 of 3
                </div>

                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${leader === 'A' ? 'bg-sky-500/15 [box-shadow:0_0_24px_rgba(56,189,248,0.4)]' : ''} ${triple ? 'ring-2 ring-amber-300 [box-shadow:0_0_30px_rgba(251,191,36,0.7)]' : ''}`}>
                    <span className="h-3 w-3 rounded-full bg-sky-400 [box-shadow:0_0_12px_rgba(56,189,248,0.9)]" />
                    <motion.span key={scoreA} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-sky-200 [text-shadow:0_0_16px_rgba(56,189,248,0.7)]">
                      {hidden ? 'SCORE HIDDEN' : scramble ? randScore(1).toLocaleString() : scoreA.toLocaleString()}
                    </motion.span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${leader === 'B' ? 'bg-rose-500/15 [box-shadow:0_0_24px_rgba(244,63,94,0.4)]' : ''}`}>
                    <span className="h-3 w-3 rounded-full bg-rose-400 [box-shadow:0_0_12px_rgba(244,63,94,0.9)]" />
                    <motion.span key={scoreB} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-rose-200 [text-shadow:0_0_16px_rgba(244,63,94,0.7)]">
                      {hidden ? 'SCORE HIDDEN' : scramble ? randScore(2).toLocaleString() : scoreB.toLocaleString()}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <Users className="h-4 w-4 text-slate-300" />
                    <span className="font-black tabular-nums">{teams.A || teams.B ? (scores.A || scores.B ? 'LIVE' : 'LIVE') : '—'}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500">battle</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[240px_minmax(0,1fr)_280px]">
              <div className="relative min-w-0 2xl:h-[760px]">
                <QueueSidebar queue={queue} nextEntry={nextQueueEntry} />
              </div>

              <div className="min-w-0 space-y-3">
                <div className="relative grid min-w-0 grid-cols-1 items-stretch gap-6 overflow-hidden rounded-3xl border border-white/10 bg-black/15 p-4 backdrop-blur-md sm:p-6 lg:grid-cols-[minmax(0,1fr)_clamp(88px,9vw,132px)_minmax(0,1fr)] lg:gap-3 xl:p-8">
                  <ArenaSide
                    side="A"
                    team={teams.A}
                    score={scores.A}
                    now={now}
                    abilities={abilities}
                    isMyTeam={isCaptainOf('A')}
                    onGift={() => openGift(teams.A, 'A')}
                    giftingLocked={transitionPreparing || roundEnding}
                    triple={triple}
                    livekitRoomName={livekitRoomName}
                    myOnStageSeat={myOnStageSeat}
                    userId={user?.id}
                    userName={profile?.username}
                  />
                  <CenterBeam leader={leader} transitionPreparing={transitionPreparing} roundEnding={roundEnding} />
                  <ArenaSide
                    side="B"
                    team={teams.B}
                    score={scores.B}
                    now={now}
                    abilities={abilities}
                    isMyTeam={isCaptainOf('B')}
                    onGift={() => openGift(teams.B, 'B')}
                    giftingLocked={transitionPreparing || roundEnding}
                    triple={triple}
                    livekitRoomName={livekitRoomName}
                    myOnStageSeat={myOnStageSeat}
                    userId={user?.id}
                    userName={profile?.username}
                  />

                  {transitionPreparing && (
                    <TransitionCurtain nextEntry={nextQueueEntry} timerLeft={timerLeft} />
                  )}
                </div>

                <AbilityBar
                  abilities={abilities}
                  onActivateA={(ability: any) => activate(ability, 'A')}
                  onActivateB={(ability: any) => activate(ability, 'B')}
                  onClaimBag={claimBag}
                  isAdmin={isAdmin}
                  disabled={transitionPreparing || roundEnding}
                />
              </div>

              <div className="relative flex min-w-0 flex-col gap-3 2xl:h-[760px]">
                <div className="min-h-0 flex-1">
                  <ActivityFeed
                    round={round}
                    teams={teams}
                    abilities={abilities}
                    scoreA={scoreA}
                    scoreB={scoreB}
                    leader={leader}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                  <BroadcastChat streamId={round.id} hostId={hostId} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function ArenaTopBar({
  timerLeft,
  transitionPreparing,
  onBack,
}: {
  timerLeft: number
  transitionPreparing: boolean
  onBack: () => void
}) {
  const minutes = Math.floor(timerLeft / 60)
  const seconds = String(Math.floor(timerLeft % 60)).padStart(2, '0')
  const danger = timerLeft <= 10

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Back to Universe"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <Sparkles className="hidden h-5 w-5 shrink-0 text-fuchsia-300 sm:block" />

        <h1 className="truncate text-xl font-black tracking-tight sm:text-3xl">
          Universe Live Arena
        </h1>
      </div>

      <div
        className={[
          'relative min-w-[112px] rounded-2xl border px-4 py-2 text-center backdrop-blur-xl transition-all duration-300',
          danger
            ? 'border-rose-400/70 bg-rose-500/15 shadow-[0_0_28px_rgba(244,63,94,0.35)]'
            : 'border-fuchsia-400/40 bg-fuchsia-500/10 shadow-[0_0_24px_rgba(217,70,239,0.18)]',
          transitionPreparing ? 'motion-safe:animate-pulse' : '',
        ].join(' ')}
      >
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-300">
          Round Timer
        </div>
        <div className="mt-0.5 text-2xl font-black tabular-nums sm:text-3xl">
          {minutes}:{seconds}
        </div>
      </div>

      <div className="flex justify-end">
        <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:flex">
          <Eye className="h-4 w-4 text-slate-300" />
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">Spectators</div>
            <div className="text-xs font-black">Live Arena</div>
          </div>
        </div>
      </div>
    </header>
  )
}

function ArenaSide({
  side,
  team,
  score,
  now,
  abilities,
  isMyTeam,
  onGift,
  giftingLocked,
  triple,
  livekitRoomName,
  myOnStageSeat,
  userId,
  userName,
}: {
  side: Side
  team: any
  score: any
  now: number
  abilities: any[]
  isMyTeam: boolean
  onGift: () => void
  giftingLocked: boolean
  triple?: boolean
  livekitRoomName?: string | null
  myOnStageSeat?: { side: Side; seat: number } | null
  userId?: string | null
  userName?: string | null
}) {
  const isBlue = side === 'A'
  const teamName = isBlue ? 'TEAM ALPHA' : 'TEAM OMEGA'
  const header = isBlue ? 'text-sky-200' : 'text-rose-200'
  const headerGlow = isBlue
    ? '[text-shadow:0_0_26px_rgba(56,189,248,0.8)]'
    : '[text-shadow:0_0_26px_rgba(244,63,94,0.8)]'
  const ambient = isBlue
    ? 'before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.20),transparent_70%)] before:blur-2xl'
    : 'before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.20),transparent_70%)] before:blur-2xl'

  const seatClass = 'w-full min-w-0 max-w-[clamp(92px,10vw,172px)] justify-self-center'

  const activeOnTeam = (abilities || []).filter(
    (ability: any) =>
      ability.target_team_id === team?.id &&
      (ability.expires_at == null || new Date(ability.expires_at).getTime() > now),
  )

  // Per-seat video source. If the current user occupies this seat they PUBLISH
  // via LiveKit (lowest latency). Everyone else (and other viewers) sees the
  // seat's Mux playback (low-latency HLS).
  const seatMedia = (seatIndex: number, playbackId?: string | null) => {
    const iAmThisSeat = myOnStageSeat && myOnStageSeat.side === side && myOnStageSeat.seat === seatIndex
    if (!iAmThisSeat) {
      return playbackId ? (
        <UniverseLiveKitStage roomName={null} userId={null} isOnStage={false} playbackId={playbackId} muted />
      ) : null
    }
    return (
      <UniverseLiveKitStage
        roomName={livekitRoomName}
        userId={userId}
        userName={userName}
        isOnStage
        playbackId={playbackId}
        muted
      />
    )
  }

  const seats = team
    ? [
        { username: team.captain?.username, score: Number(score?.actual_score || 0), quality: 98, isHost: true, playbackId: team.host_mux_playback_id },
        { username: team.s1?.username, score: team.s1 ? 420 : undefined, quality: 90, playbackId: team.seat_one_mux_playback_id },
        { username: team.s2?.username, score: team.s2 ? 360 : undefined, quality: 87, playbackId: team.seat_two_mux_playback_id },
        { username: team.s3?.username, score: team.s3 ? 300 : undefined, quality: 84, playbackId: team.seat_three_mux_playback_id },
      ]
    : []

  return (
    <div
      className={`relative flex min-w-0 flex-col items-center gap-3 py-2 sm:gap-4 ${ambient} ${
        triple && isBlue
          ? 'rounded-3xl ring-2 ring-amber-300/70 [box-shadow:0_0_40px_rgba(251,191,36,0.5)]'
          : ''
      }`}
    >
      <motion.div
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className={`flex max-w-full items-center justify-center gap-2 text-center text-lg font-black tracking-[0.12em] sm:text-2xl xl:text-3xl ${header} ${headerGlow}`}
      >
        <WolfLogo side={side} />
        <span className="truncate">{teamName}</span>
        <WolfLogo side={side} />
      </motion.div>

      {activeOnTeam.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1">
          {activeOnTeam.slice(0, 3).map((ability: any) => (
            <div
              key={ability.id}
              className="flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-200 backdrop-blur"
            >
              <Zap className="h-3 w-3" />
              {String(ability.ability_type).replaceAll('_', ' ')}
            </div>
          ))}
        </div>
      ) : null}

      {!team ? (
        <div className="flex min-h-[420px] items-center justify-center text-xs text-slate-600">Waiting for team…</div>
      ) : (
        <>
          <motion.div
            key={score?.actual_score}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
            className={`text-3xl font-black tabular-nums sm:text-5xl xl:text-6xl ${header} ${headerGlow}`}
          >
            {Number(score?.actual_score || 0).toLocaleString()}
          </motion.div>

          <div className="grid w-full min-w-0 max-w-[520px] grid-cols-2 grid-rows-3 items-center justify-items-center gap-x-3 gap-y-2 px-1 sm:gap-x-5 sm:gap-y-3">
            <div className={`${seatClass} col-span-2 row-start-1`}>
              <CrystalDiamond username={seats[0].username} isHost score={seats[0].score} side={side} media={seatMedia(0, seats[0].playbackId)} />
            </div>
            <div className={`${seatClass} col-start-1 row-start-2`}>
              <CrystalDiamond username={seats[1].username} score={seats[1].score} side={side} media={seatMedia(1, seats[1].playbackId)} />
            </div>
            <div className={`${seatClass} col-start-2 row-start-2`}>
              <CrystalDiamond username={seats[2].username} score={seats[2].score} side={side} media={seatMedia(2, seats[2].playbackId)} />
            </div>
            <div className={`${seatClass} col-span-2 row-start-3`}>
              <CrystalDiamond username={seats[3].username} score={seats[3].score} side={side} media={seatMedia(3, seats[3].playbackId)} />
            </div>
          </div>

          <div className="flex w-full max-w-[520px] items-center justify-between px-1">
            {isMyTeam ? (
              <div className="text-[9px] font-bold text-emerald-300">You are this team’s captain</div>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={onGift}
              disabled={giftingLocked}
              className={`group relative flex items-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5 text-sm font-black ${
                isBlue
                  ? 'bg-sky-500/20 hover:bg-sky-500/30'
                  : 'bg-rose-500/20 hover:bg-rose-500/30'
              } ${giftingLocked ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Gift className="h-4 w-4" /> Gift {isBlue ? 'Alpha' : 'Omega'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function QueueSidebar({ queue, nextEntry }: any) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
          <Users className="h-4 w-4 text-fuchsia-300" /> Battle Queue
        </div>
        <span className="text-[10px] text-slate-500">{queue.length} registered</span>
      </div>

      <div className="mt-3 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-b from-fuchsia-400/10 to-transparent p-3 text-center">
        <p className="text-[9px] uppercase tracking-widest text-slate-400">Next challenger</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          {nextEntry?.captain?.avatar_url ? (
            <img src={nextEntry.captain.avatar_url} alt="" className="h-8 w-8 rounded-full bg-zinc-900 object-cover" />
          ) : null}
          <p className="truncate text-sm font-black text-white">{nextEntry?.captain?.username || 'Preparing…'}</p>
        </div>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
          {nextEntry?.status === 'next' ? 'Up Next' : nextEntry ? 'Waiting' : '—'}
        </p>
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {queue.length === 0 ? (
          <div className="rounded-xl bg-white/[0.03] p-4 text-center text-xs text-slate-600">Queue empty.</div>
        ) : (
          queue.map((entry: any, i: number) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                entry.id === nextEntry?.id
                  ? 'border-amber-400/40 bg-amber-400/10 [box-shadow:0_0_20px_rgba(245,158,11,0.25)]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[10px] font-black text-slate-300">
                {entry.position ?? i + 1}
              </div>
              {entry.captain?.avatar_url ? (
                <img src={entry.captain.avatar_url} alt="" className="h-8 w-8 rounded-full bg-zinc-900 object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{entry.captain?.username || 'Unknown'}</p>
                <p className="text-[9px] uppercase tracking-wider text-slate-500">{entry.status || 'waiting'}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
        {[
          { l: 'In Battle', v: 2 },
          { l: 'Queued', v: queue.length },
          { l: 'Total', v: queue.length + 2 },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-white/[0.03] py-2">
            <p className="text-base font-black text-white">{s.v}</p>
            <p className="text-[8px] uppercase tracking-wider text-slate-500">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityFeed({ round: _round, teams, abilities, scoreA: _scoreA, scoreB: _scoreB, leader }: any) {
  const events = [
    ...(abilities || []).slice(0, 4).map((a: any) => ({
      id: `ab-${a.id}`,
      kind: 'ability',
      text: `${String(a.ability_type).replaceAll('_', ' ')} ${a.target_team_id === teams?.A?.id ? 'on Team Alpha' : 'on Team Omega'}`,
    })),
    { id: 's', kind: 'system', text: `Round live — ${leader === 'A' ? 'Alpha' : leader === 'B' ? 'Omega' : 'even'} leading` },
  ].slice(0, 8)

  const meta: Record<string, { icon: any; cls: string }> = {
    gift: { icon: Gift, cls: 'border-fuchsia-400/30 bg-fuchsia-400/5 text-fuchsia-200' },
    system: { icon: Radio, cls: 'border-sky-400/30 bg-sky-400/5 text-sky-200' },
    ability: { icon: Zap, cls: 'border-amber-400/30 bg-amber-400/5 text-amber-200' },
    reveal: { icon: Eye, cls: 'border-violet-400/30 bg-violet-400/5 text-violet-200' },
  }

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
          <Radio className="h-4 w-4 text-fuchsia-300" /> Activity Feed
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">LIVE</span>
      </div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.map((f: any) => {
            const m = meta[f.kind] || meta.system
            const Icon = m.icon
            return (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-2 rounded-2xl border p-2.5 ${m.cls}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-4 font-semibold">{f.text}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TransitionCurtain({
  nextEntry,
  timerLeft,
}: {
  nextEntry: QueueEntry | null
  timerLeft: number
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="rounded-2xl border border-fuchsia-300/30 bg-black/75 px-5 py-4 text-center shadow-[0_0_40px_rgba(217,70,239,0.28)]">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-200">
          Next match loading
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          {Math.max(0, Math.ceil(timerLeft))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-300">
          {nextEntry?.captain?.avatar_url && (
            <img
              src={nextEntry.captain.avatar_url}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          )}
          <span>
            {nextEntry?.captain?.username
              ? `${nextEntry.captain.username} is ready`
              : 'Preparing next challenger'}
          </span>
        </div>
      </div>
    </div>
  )
}

function AbilityBar({
  abilities,
  onActivateA,
  onActivateB,
  onClaimBag,
  isAdmin,
  disabled,
}: {
  abilities: any[]
  onActivateA: (ability: any) => void
  onActivateB: (ability: any) => void
  onClaimBag: () => void
  isAdmin: boolean
  disabled: boolean
}) {
  const activeTypes = new Set(
    abilities
      .filter((ability: any) => ability.status === 'active' || ability.status === 'revealing')
      .map((ability: any) => ability.ability_type),
  )

  return (
    <section className="mt-3 rounded-2xl border border-amber-400/20 bg-black/55 p-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-amber-100">
            <Zap className="h-4 w-4 text-amber-300" />
            Troll Ups
          </div>
          <div className="text-[10px] text-slate-500">
            Only active abilities glow. Inactive abilities remain still.
          </div>
        </div>

        <button
          type="button"
          onClick={onClaimBag}
          disabled={disabled}
          className="rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-2 text-[10px] font-black text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Claim Troll Bag
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {ABILITIES.map((ability) => {
          const active = activeTypes.has(ability.type)

          return (
            <div
              key={ability.type}
              className={[
                'rounded-xl border p-2 transition',
                active
                  ? 'border-emerald-300/45 bg-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.2)]'
                  : 'border-white/10 bg-white/[0.03]',
              ].join(' ')}
            >
              <div className="text-[10px] font-black">{ability.label}</div>
              <div className="mt-1 text-[9px] text-slate-500">
                {ability.dur ? `${ability.dur} seconds` : 'Instant'}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onActivateA({
                      id: ability.type,
                      ability_type: ability.type,
                    })
                  }
                  disabled={disabled}
                  className="rounded-lg bg-blue-500/15 px-2 py-1 text-[9px] font-black text-blue-100 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Alpha
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onActivateB({
                      id: ability.type,
                      ability_type: ability.type,
                    })
                  }
                  disabled={disabled}
                  className="rounded-lg bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Omega
                </button>
              </div>

              <div
                className={[
                  'mt-2 text-[8px] font-black uppercase tracking-wider',
                  active ? 'text-emerald-300' : 'text-slate-600',
                ].join(' ')}
              >
                {active ? 'Active' : 'Inactive'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-3 py-2 text-[10px] font-black text-black shadow-[0_0_20px_rgba(251,191,36,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Star className="h-3.5 w-3.5" />
            CEO Power — Send 2×
          </button>
        )}

        <JailBarsButton disabled={disabled} />
      </div>
    </section>
  )
}

function JailBarsButton({ disabled }: { disabled: boolean }) {
  const { user } = useAuthStore()

  const payJail = async () => {
    if (!user) {
      toast.error('Sign in to use Jail Bars')
      return
    }

    toast.info('Jail Bars: 500 Troll Coins to freeze a team’s gifts for 10 seconds.')
  }

  return (
    <button
      type="button"
      onClick={payJail}
      disabled={disabled}
      className="flex items-center gap-1 rounded-xl bg-zinc-700/40 px-3 py-2 text-[10px] font-black hover:bg-zinc-700/60 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ShieldAlert className="h-3.5 w-3.5 text-slate-200" />
      Jail Bars (500)
    </button>
  )
}

function EmptyArena() {
  return (
    <section className="mt-4 flex min-h-[72vh] items-center justify-center rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-xl">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10">
          <Crown className="h-8 w-8 text-fuchsia-300" />
        </div>
        <h2 className="mt-4 text-lg font-black">No active Universe Battle</h2>
        <p className="mt-1 text-sm text-slate-500">
          The arena will automatically open when the next battle begins.
        </p>
      </div>
    </section>
  )
}