import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Eye,
  Flame,
  Gift,
  Lock,
  Medal,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { formatDistanceToNowStrict, isAfter, isBefore } from 'date-fns'

import { useLeagueSnapshot } from '@/hooks/useLeagueSnapshot'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import {
  formatTierLabel,
  getTierFromXp,
  getTierInfo,
  getNextTier,
  getTierProgress,
  getTierTasks,
  getCurrentWeek,
  getCycleKey,
  TaskProgressSnapshot,
  DEFAULT_SNAPSHOT,
  LeagueTask,
} from '@/lib/leagueHelpers'

import { neonCard, neonTextGradient } from '../phoneTheme'

type LeaderboardRow = {
  supporter_id?: string | null
  supporter_username?: string | null
  supporter_display_name?: string | null
  supporter_avatar_url?: string | null
  broadcaster_id?: string | null
  broadcaster_username?: string | null
  broadcaster_display_name?: string | null
  stream_id?: string | null
  gift_coins?: number | null
  total_gifts?: number | null
  score?: number | null
  rank?: number | null
}

type LeagueEventLike = {
  id?: string
  name?: string
  type?: string
  status?: string
  starts_at?: string
  ends_at?: string
  metadata?: Record<string, unknown> | null
  points_multiplier?: number
}

const formatCompactNumber = (value?: number | null) => {
  const number = Number(value || 0)

  if (number >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(1)}M`
  }

  if (number >= 1_000) {
    return `${(number / 1_000).toFixed(1)}K`
  }

  return number.toLocaleString()
}

const getDisplayName = (row: LeaderboardRow) =>
  row.supporter_display_name ||
  row.supporter_username ||
  row.broadcaster_display_name ||
  row.broadcaster_username ||
  'Troll Citizen'

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

const getEventTypeLabel = (event?: LeagueEventLike | null) => {
  const type = String(event?.type || '').replace(/_/g, ' ')

  if (!type) return 'Live League'

  return type
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

const getTimeStatus = (event?: LeagueEventLike | null) => {
  if (!event?.starts_at || !event?.ends_at) {
    return {
      label: 'Open now',
      isActive: !!event,
    }
  }

  try {
    const now = new Date()
    const starts = new Date(event.starts_at)
    const ends = new Date(event.ends_at)

    if (isBefore(now, starts)) {
      return {
        label: `Starts in ${formatDistanceToNowStrict(starts)}`,
        isActive: false,
      }
    }

    if (isAfter(now, ends)) {
      return {
        label: 'Recently ended',
        isActive: false,
      }
    }

    return {
      label: `${formatDistanceToNowStrict(ends)} left`,
      isActive: true,
    }
  } catch {
    return {
      label: 'Ending soon',
      isActive: true,
    }
  }
}

function SectionHeader({
  eyebrow,
  title,
  icon,
  action,
}: {
  eyebrow: string
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10 text-[#00BFFF]">
            {icon}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 truncate text-base font-black text-white">
            {title}
          </h2>
        </div>
      </div>

      {action}
    </div>
  )
}

function PodiumCard({
  row,
  rank,
}: {
  row: LeaderboardRow
  rank: number
}) {
  const name = getDisplayName(row)
  const score = Number(row.gift_coins ?? row.score ?? 0)
  const gifts = Number(row.total_gifts || 0)

  const isFirst = rank === 1
  const isSecond = rank === 2

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-4 ${
        isFirst
          ? 'border-yellow-300/30 bg-yellow-300/[0.08] shadow-[0_0_30px_rgba(250,204,21,0.10)]'
          : isSecond
            ? 'border-cyan-300/25 bg-cyan-300/[0.06]'
            : 'border-pink-300/20 bg-pink-400/[0.06]'
      }`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00BFFF]/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 text-xs font-black">
          {row.supporter_avatar_url ? (
            <img
              src={row.supporter_avatar_url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(name) || '?'
          )}

          {rank === 1 && (
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-yellow-300 text-yellow-950">
              <Crown className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">
            {name}
          </p>

          <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500">
            {rank === 1
              ? 'City Crown'
              : rank === 2
                ? 'Neon Runner-Up'
                : 'Pulse Champion'}
          </p>
        </div>

        <div className="grid h-8 min-w-8 place-items-center rounded-full bg-white/10 px-2 text-[10px] font-black text-white">
          #{rank}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-500">
            Points
          </p>
          <p className="mt-1 text-base font-black text-cyan-100">
            {formatCompactNumber(score)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-500">
            Gifts
          </p>
          <p className="mt-1 text-base font-black text-pink-100">
            {formatCompactNumber(gifts)}
          </p>
        </div>
      </div>
    </div>
  )
}

function LeaderboardRowCard({
  row,
  index,
}: {
  row: LeaderboardRow
  index: number
}) {
  const rank = Number(row.rank || index + 1)
  const name = getDisplayName(row)
  const score = Number(row.gift_coins ?? row.score ?? 0)
  const gifts = Number(row.total_gifts || 0)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-black text-white">
          {rank}
        </div>

        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#00BFFF]/20 via-[#BF00FF]/20 to-pink-500/20 text-xs font-black">
          {row.supporter_avatar_url ? (
            <img
              src={row.supporter_avatar_url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(name) || '?'
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">
            {name}
          </p>

          <p className="mt-1 text-[9px] text-zinc-500">
            {formatCompactNumber(gifts)} gifts
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-black text-cyan-100">
            {formatCompactNumber(score)}
          </p>
          <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
            pts
          </p>
        </div>
      </div>
    </div>
  )
}

function TierTaskCard({ task }: { task: LeagueTask }) {
  const locked = task.status === 'locked'
  const completed = task.status === 'completed'
  const claimed = task.status === 'claimed'

  const target = Number(task.target || 0)
  const current = Number(task.current || 0)

  const progress =
    target > 0
      ? Math.min(100, Math.max(0, Math.round((current / target) * 100)))
      : 0

  return (
    <div
      className={`rounded-3xl border p-4 ${
        locked
          ? 'border-white/5 bg-white/[0.02] opacity-60'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-cyan-100">
              {task.tierLabel}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">
              {locked
                ? 'Locked'
                : claimed
                  ? 'Claimed'
                  : completed
                    ? 'Completed'
                    : 'Active'}
            </span>
          </div>

          <h3 className="mt-2 text-sm font-black text-white">
            {task.title}
          </h3>

          <p className="mt-1 text-[11px] leading-5 text-zinc-400">
            {task.description}
          </p>
        </div>

        {locked && (
          <Lock className="h-4 w-4 shrink-0 text-zinc-600" />
        )}
      </div>

      {!locked && (
        <div className="mt-4">
          <div className="flex justify-between text-[9px] font-bold text-zinc-500">
            <span>
              {current}/{target}
            </span>
            <span>{progress}%</span>
          </div>

          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${
                completed || claimed
                  ? 'bg-emerald-400'
                  : 'bg-[#00BFFF]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[9px] font-bold text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-yellow-300" />
          {formatCompactNumber(task.rewardXp)} XP
        </span>

        <span className="inline-flex items-center gap-1">
          <Gift className="h-3 w-3 text-pink-300" />
          {formatCompactNumber(task.rewardCoins)}
        </span>
      </div>
    </div>
  )
}

export default function PhoneLeagues() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)

  const {
    activeEvent,
    leaderboard,
    isLoading,
    userRank,
    userLeagueProgress,
    missions: leagueMissions,
    claimMission,
  } = useLeagueSnapshot({
    streamId: null,
    category: null,
    limit: 10,
  })

  const [taskProgressSnapshot, setTaskProgressSnapshot] =
    useState<TaskProgressSnapshot>(DEFAULT_SNAPSHOT)

  const [showBrowse, setShowBrowse] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueDesc, setNewLeagueDesc] = useState('')
  const [newLeagueType, setNewLeagueType] = useState('standard')

  const [myLeagues, setMyLeagues] = useState<any[]>([])
  const [publicLeagues, setPublicLeagues] = useState<any[]>([])
  const [myMemberships, setMyMemberships] =
    useState<Record<string, any>>({})

  const [loadingPublic, setLoadingPublic] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimingMission, setClaimingMission] = useState<string | null>(
    null,
  )

  const currentWeek = getCurrentWeek()
  const currentCycle = getCycleKey()

  useEffect(() => {
    const loadProgress = async () => {
      if (!profile?.id) return

      try {
        const { data } = await supabase
          .from('user_profiles')
          .select(
            'total_gifts_sent, total_chat_messages, total_streams, login_streak, xp',
          )
          .eq('id', profile.id)
          .maybeSingle()

        setTaskProgressSnapshot({
          totalGiftsSent: data?.total_gifts_sent ?? 0,
          totalChatMessages: data?.total_chat_messages ?? 0,
          totalStreams: data?.total_streams ?? 0,
          loginStreak: data?.login_streak ?? 0,
          xp: data?.xp ?? 0,
          broadcastMinutes: 0,
          battlesWon: 0,
          battlesJoined: 0,
          wallLikes: 0,
          wallReplies: 0,
          familyPoints: 0,
          leaderboardRank: null,
          daysActive: data?.login_streak ?? 0,
        })
      } catch {
        // Keep defaults.
      }
    }

    loadProgress()
  }, [profile?.id])

  const loadMyLeagues = useCallback(async () => {
    if (!profile?.id) return

    try {
      const { data: memberships } = await supabase
        .from('user_league_members')
        .select('league_id, role, contribution_score')
        .eq('user_id', profile.id)

      const membershipMap: Record<string, any> = {}
      const ids: string[] = []

      for (const membership of memberships || []) {
        membershipMap[membership.league_id] = membership
        ids.push(membership.league_id)
      }

      setMyMemberships(membershipMap)

      if (!ids.length) {
        setMyLeagues([])
        return
      }

      const { data: leagues } = await supabase
        .from('user_leagues')
        .select(
          'id, name, description, league_type, member_count, max_members, league_score, icon_emoji, creator_id',
        )
        .in('id', ids)

      setMyLeagues(leagues || [])
    } catch {
      setMyLeagues([])
    }
  }, [profile?.id])

  useEffect(() => {
    loadMyLeagues()
  }, [loadMyLeagues])

  useEffect(() => {
    if (!showBrowse) return

    const loadPublicLeagues = async () => {
      setLoadingPublic(true)

      try {
        const { data } = await supabase
          .from('user_leagues')
          .select(
            'id, name, description, league_type, member_count, max_members, league_score, icon_emoji, creator_id',
          )
          .eq('is_public', true)
          .order('league_score', { ascending: false })
          .limit(20)

        setPublicLeagues(data || [])
      } catch {
        setPublicLeagues([])
      } finally {
        setLoadingPublic(false)
      }
    }

    loadPublicLeagues()
  }, [showBrowse])

  const handleJoin = useCallback(
    async (leagueId: string) => {
      if (!profile?.id) return

      setIsJoining(true)

      try {
        const { error: joinError } = await supabase
          .from('user_league_members')
          .insert({
            user_id: profile.id,
            league_id: leagueId,
            role: 'member',
            contribution_score: 0,
          })

        if (joinError) throw joinError

        await loadMyLeagues()
      } catch (err: any) {
        setError(err?.message || 'Unable to join league')
      } finally {
        setIsJoining(false)
      }
    },
    [profile?.id, loadMyLeagues],
  )

  const handleLeave = useCallback(
    async (leagueId: string) => {
      if (!profile?.id) return

      try {
        await supabase
          .from('user_league_members')
          .delete()
          .eq('user_id', profile.id)
          .eq('league_id', leagueId)

        await loadMyLeagues()
      } catch {
        // Ignore.
      }
    },
    [profile?.id, loadMyLeagues],
  )

  const handleCreate = useCallback(async () => {
    if (!profile?.id || !newLeagueName.trim()) return

    setIsCreating(true)
    setError(null)

    try {
      const { data: authData } = await supabase.auth.getUser()

      if (!authData.user?.id) {
        throw new Error('You must be logged in to create a league')
      }

      const { error: createError } = await supabase
        .from('user_leagues')
        .insert({
          name: newLeagueName.trim(),
          description: newLeagueDesc.trim() || null,
          league_type: newLeagueType,
          creator_id: authData.user.id,
          max_members: 50,
          is_public: true,
          icon_emoji: '🏆',
        })

      if (createError) throw createError

      setNewLeagueName('')
      setNewLeagueDesc('')
      setNewLeagueType('standard')
      setShowCreate(false)

      await loadMyLeagues()
    } catch (err: any) {
      setError(err?.message || 'Failed to create league')
    } finally {
      setIsCreating(false)
    }
  }, [
    profile?.id,
    newLeagueName,
    newLeagueDesc,
    newLeagueType,
    loadMyLeagues,
  ])

  const event = activeEvent as LeagueEventLike | null
  const timeStatus = getTimeStatus(event)

  const normalizedLeaderboard = useMemo(
    () =>
      (leaderboard || [])
        .filter(Boolean)
        .map((row: LeaderboardRow, index: number) => ({
          ...row,
          rank: row.rank || index + 1,
          gift_coins: Number(row.gift_coins ?? row.score ?? 0),
          total_gifts: Number(row.total_gifts || 0),
        }))
        .sort(
          (a: LeaderboardRow, b: LeaderboardRow) =>
            Number(a.rank || 999) - Number(b.rank || 999),
        ),
    [leaderboard],
  )

  const topThree = normalizedLeaderboard.slice(0, 3)
  const remaining = normalizedLeaderboard.slice(3)

  const totalPoints = useMemo(
    () =>
      normalizedLeaderboard.reduce(
        (sum, row) =>
          sum + Number(row.gift_coins ?? row.score ?? 0),
        0,
      ),
    [normalizedLeaderboard],
  )

  const totalGifts = useMemo(
    () =>
      normalizedLeaderboard.reduce(
        (sum, row) => sum + Number(row.total_gifts || 0),
        0,
      ),
    [normalizedLeaderboard],
  )

  const userXpTotal =
    userLeagueProgress?.xpTotal ?? profile?.xp ?? 0

  const userTier = getTierFromXp(userXpTotal)
  const userTierInfo = getTierInfo(userTier)
  const nextTierInfo = getNextTier(userTier)
  const tierProgress = getTierProgress(userXpTotal)

  const canCreateLeague =
    profile?.role === 'admin' || (profile?.xp ?? 0) >= 1000

  const leagueMissionMap = useMemo(() => {
    const map: Record<
      string,
      { current_value?: number; status?: string }
    > = {}

    for (const mission of leagueMissions) {
      if (mission.mission_key) {
        map[mission.mission_key] = {
          current_value: mission.current_value,
          status: mission.status,
        }
      }
    }

    return map
  }, [leagueMissions])

  const tierTasks = useMemo(
    () =>
      getTierTasks(
        userTier,
        currentCycle,
        currentWeek,
        taskProgressSnapshot,
        leagueMissionMap,
      ),
    [
      userTier,
      currentCycle,
      currentWeek,
      taskProgressSnapshot,
      leagueMissionMap,
    ],
  )

  const activeMissions = leagueMissions.filter(
    (mission) => mission.status !== 'completed',
  )

  const completedMissions = leagueMissions.filter(
    (mission) => mission.status === 'completed',
  )

  const handleClaimMission = async (missionId: string) => {
    setClaimingMission(missionId)

    try {
      await claimMission(missionId)
    } finally {
      setClaimingMission(null)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05010f] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-20%] top-[8%] h-72 w-72 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
        <div className="absolute right-[-20%] top-[35%] h-80 w-80 rounded-full bg-[#BF00FF]/10 blur-[110px]" />
        <div className="absolute bottom-[-10%] left-[20%] h-72 w-72 rounded-full bg-pink-500/10 blur-[110px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#00BFFF]/15 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <h1
            className={`text-sm font-black uppercase tracking-[0.22em] ${neonTextGradient}`}
          >
            Leagues
          </h1>
          <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-zinc-600">
            Mai Troll City
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBrowse(true)}
          className="grid h-9 w-9 place-items-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10 text-[#BF00FF]"
        >
          <Trophy className="h-4 w-4" />
        </button>
      </header>

      <main className="relative space-y-4 p-4 pb-24">
        {/* Hero */}
        <section className={`${neonCard} overflow-hidden p-5`}>
          <div className="absolute right-[-25px] top-[-25px] h-32 w-32 rounded-full bg-[#00BFFF]/10 blur-3xl" />
          <div className="absolute bottom-[-35px] left-[-35px] h-36 w-36 rounded-full bg-[#BF00FF]/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">
                <Trophy className="h-7 w-7" />

                {timeStatus.isActive && (
                  <span className="absolute ml-10 mt-[-35px] h-3 w-3 rounded-full border-2 border-[#05010f] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-cyan-100">
                    {getEventTypeLabel(event)}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-zinc-400">
                    {timeStatus.isActive ? 'LIVE' : 'STANDBY'}
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                  {event?.name || 'MaiTroll Clash'}
                </h2>

                <p className="mt-1 text-[11px] leading-5 text-zinc-400">
                  Send gifts during live broadcasts and push your rank higher.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                <Timer className="mx-auto h-4 w-4 text-cyan-200" />
                <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-600">
                  Time
                </p>
                <p className="mt-1 truncate text-[10px] font-black text-white">
                  {timeStatus.label}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                <Zap className="mx-auto h-4 w-4 text-yellow-200" />
                <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-600">
                  Points
                </p>
                <p className="mt-1 text-[10px] font-black text-white">
                  {formatCompactNumber(totalPoints)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                <Gift className="mx-auto h-4 w-4 text-pink-200" />
                <p className="mt-1 text-[8px] uppercase tracking-wider text-zinc-600">
                  Gifts
                </p>
                <p className="mt-1 text-[10px] font-black text-white">
                  {formatCompactNumber(totalGifts)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tier */}
        <section className={`${neonCard} p-4`}>
          <SectionHeader
            eyebrow="Your Progress"
            title="Mai Troll Tier"
            icon={<Sparkles className="h-5 w-5" />}
            action={
              <span className="rounded-full border border-[#BF00FF]/20 bg-[#BF00FF]/10 px-2.5 py-1 text-[9px] font-black text-purple-200">
                #{userRank || '—'}
              </span>
            }
          />

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black text-white">
                {formatTierLabel(userTier)}
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">
                {userTierInfo.name}
              </p>
            </div>

            <p className="text-right text-[10px] font-bold text-cyan-200">
              {formatCompactNumber(userXpTotal)} XP
            </p>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00BFFF] to-[#BF00FF]"
              style={{
                width: `${tierProgress.progressPercent}%`,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[9px] text-zinc-500">
            <span>{tierProgress.progressPercent}% complete</span>

            <span>
              {tierProgress.isMaxTier
                ? 'MAX TIER'
                : `${formatCompactNumber(
                    tierProgress.xpNeededForNextTier,
                  )} XP to next`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                Current
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {userTierInfo.shortLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                Progress
              </p>
              <p className="mt-1 text-sm font-black text-cyan-200">
                {tierProgress.progressPercent}%
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                Next
              </p>
              <p className="mt-1 text-sm font-black text-purple-200">
                {nextTierInfo?.shortLabel || 'MAX'}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 p-3">
            <p className="text-[10px] font-black text-white">
              {nextTierInfo
                ? `Next unlock: ${nextTierInfo.name}`
                : 'Final Boss tier reached'}
            </p>

            <p className="mt-1 text-[10px] leading-5 text-zinc-400">
              {nextTierInfo
                ? `Earn ${formatCompactNumber(
                    tierProgress.xpNeededForNextTier,
                  )} more XP to unlock ${nextTierInfo.reward}.`
                : 'Maintain your activity and complete seasonal goals.'}
            </p>
          </div>
        </section>

        {/* Tier Tasks */}
        <section className={`${neonCard} p-4`}>
          <SectionHeader
            eyebrow="T0–T10"
            title="League Tasks"
            icon={<Zap className="h-5 w-5" />}
          />

          <p className="mt-2 text-[10px] leading-5 text-zinc-500">
            Complete tasks for your current tier and keep climbing toward T10.
          </p>

          <div className="mt-4 space-y-3">
            {tierTasks.map((task) => (
              <TierTaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>

        {/* My Leagues */}
        <section className={`${neonCard} p-4`}>
          <SectionHeader
            eyebrow="Community"
            title="My Leagues"
            icon={<Users className="h-5 w-5" />}
            action={
              <button
                type="button"
                onClick={() => setShowBrowse(true)}
                className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-cyan-100"
              >
                Browse
              </button>
            }
          />

          <div className="mt-4 space-y-2">
            {myLeagues.length > 0 ? (
              myLeagues.map((league) => {
                const membership = myMemberships[league.id]

                return (
                  <div
                    key={league.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {league.icon_emoji || '🏆'}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">
                          {league.name}
                        </p>

                        <p className="mt-1 text-[9px] text-zinc-500">
                          {league.member_count}/{league.max_members} members
                          {' • '}
                          {formatCompactNumber(league.league_score)} score
                        </p>
                      </div>

                      <span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-black text-zinc-400">
                        {membership?.role || 'member'}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
                <Trophy className="mx-auto h-7 w-7 text-zinc-700" />
                <p className="mt-2 text-xs font-black text-zinc-300">
                  No leagues yet
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  Browse public leagues and join one.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowBrowse(true)}
              className="rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10 py-3 text-[10px] font-black uppercase tracking-wider text-cyan-100"
            >
              Browse Leagues
            </button>

            {canCreateLeague && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center justify-center gap-1 rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/10 py-3 text-[10px] font-black uppercase tracking-wider text-purple-100"
              >
                <Plus className="h-3 w-3" />
                Create
              </button>
            )}
          </div>
        </section>

        {/* Missions */}
        {(activeMissions.length > 0 ||
          completedMissions.length > 0) && (
          <section className={`${neonCard} p-4`}>
            <SectionHeader
              eyebrow="League Activity"
              title="Missions"
              icon={<Flame className="h-5 w-5" />}
            />

            <div className="mt-4 space-y-3">
              {[...completedMissions, ...activeMissions].map(
                (mission) => {
                  const target =
                    Number(mission.target_value) || 0
                  const current =
                    Number(mission.current_value) || 0

                  const progress =
                    target > 0
                      ? Math.min(
                          100,
                          Math.round((current / target) * 100),
                        )
                      : 0

                  return (
                    <div
                      key={mission.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white">
                            {mission.title}
                          </p>

                          <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                            {mission.description}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-cyan-400/10 px-2 py-1 text-[8px] font-black uppercase text-cyan-200">
                          {mission.status}
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-[9px] text-zinc-500">
                          <span>
                            {current}/{target}
                          </span>
                          <span>{progress}%</span>
                        </div>

                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-[9px] text-zinc-500">
                        <span>{mission.reward_points} pts</span>
                        <span>{mission.reward_xp} XP</span>
                        <span>{mission.reward_coins} coins</span>
                      </div>

                      {mission.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleClaimMission(mission.id)
                          }
                          disabled={
                            claimingMission === mission.id
                          }
                          className="mt-3 w-full rounded-2xl border border-cyan-300/20 bg-cyan-300/10 py-2.5 text-[10px] font-black uppercase tracking-wider text-cyan-100 disabled:opacity-50"
                        >
                          {claimingMission === mission.id
                            ? 'Claiming...'
                            : 'Claim Reward'}
                        </button>
                      )}
                    </div>
                  )
                },
              )}
            </div>
          </section>
        )}

        {/* Leaderboard */}
        <section className={`${neonCard} p-4`}>
          <SectionHeader
            eyebrow="City Rankings"
            title="Leaderboard"
            icon={<Trophy className="h-5 w-5" />}
            action={
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
                Top {normalizedLeaderboard.length}
              </span>
            }
          />

          {isLoading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-2xl bg-white/[0.04]"
                />
              ))}
            </div>
          ) : normalizedLeaderboard.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-[#00BFFF]/15 bg-white/[0.02] p-6 text-center">
              <Radio className="mx-auto h-8 w-8 text-[#00BFFF]/50" />

              <p className="mt-3 text-sm font-black text-white">
                No supporters ranked yet
              </p>

              <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                Gift during live broadcasts to become one of the first ranked supporters.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {topThree.map((row, index) => (
                  <PodiumCard
                    key={`${row.supporter_id || row.supporter_username || index}`}
                    row={row}
                    rank={Number(row.rank || index + 1)}
                  />
                ))}
              </div>

              {remaining.length > 0 && (
                <div className="mt-4 space-y-2">
                  {remaining.map((row, index) => (
                    <LeaderboardRowCard
                      key={`${row.supporter_id || row.supporter_username || index}`}
                      row={row}
                      index={index + 3}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Rewards */}
        <section className={`${neonCard} p-4`}>
          <SectionHeader
            eyebrow="This Round"
            title="Top Rewards"
            icon={<Gift className="h-5 w-5" />}
          />

          <div className="mt-4 space-y-2">
            {[
              ['Top 1', 'Crown + 5,000 Trollmonds'],
              ['Top 2–3', 'Medal + 2,500 Trollmonds'],
              ['Top 4–10', 'Badge + 1,000 Trollmonds'],
            ].map(([rank, reward]) => (
              <div
                key={rank}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3"
              >
                <span className="text-[10px] font-bold text-zinc-400">
                  {rank}
                </span>

                <span className="text-[10px] font-black text-white">
                  {reward}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Rules */}
        <section className="grid gap-3">
          <div className="rounded-3xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />

              <div>
                <p className="text-sm font-black text-white">
                  How points work
                </p>

                <p className="mt-1 text-[10px] leading-5 text-zinc-400">
                  Eligible gifts during live broadcasts count toward league score. Event multipliers can increase your points.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-pink-300/15 bg-pink-500/5 p-4">
            <div className="flex items-start gap-3">
              <Flame className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />

              <div>
                <p className="text-sm font-black text-white">
                  Live recognition
                </p>

                <p className="mt-1 text-[10px] leading-5 text-zinc-400">
                  Top supporters can appear in broadcast overlays, City Pulse, rankings, and future reward drops.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/live')}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#00BFFF] py-3 text-[10px] font-black text-black shadow-[0_0_25px_rgba(0,191,255,0.2)]"
          >
            <Eye className="h-4 w-4" />
            Watch Live
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/store')}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#BF00FF]/25 bg-[#BF00FF]/10 py-3 text-[10px] font-black text-purple-100"
          >
            <Gift className="h-4 w-4" />
            Get Coins
          </button>
        </div>
      </main>

      {/* Browse Leagues Modal */}
      {showBrowse && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-[#00BFFF]/20 bg-[#080313] p-4 shadow-[0_-20px_80px_rgba(0,191,255,0.12)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Community
                </p>
                <h2 className="text-xl font-black text-white">
                  Public Leagues
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowBrowse(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingPublic ? (
              <div className="mt-5 space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            ) : publicLeagues.length === 0 ? (
              <div className="py-12 text-center">
                <Trophy className="mx-auto h-10 w-10 text-zinc-700" />
                <p className="mt-3 text-sm font-black text-white">
                  No public leagues yet
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  Create the first one.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {publicLeagues.map((league) => {
                  const isMember = !!myMemberships[league.id]
                  const isOwner =
                    league.creator_id === profile?.id

                  return (
                    <div
                      key={league.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {league.icon_emoji || '🏆'}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">
                            {league.name}
                          </p>

                          <p className="mt-1 text-[9px] text-zinc-500">
                            {league.member_count}/
                            {league.max_members} members
                            {' • '}
                            {league.league_type}
                          </p>

                          <p className="mt-0.5 text-[9px] text-zinc-600">
                            Score:{' '}
                            {formatCompactNumber(
                              league.league_score,
                            )}
                          </p>
                        </div>

                        {isOwner ? (
                          <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[8px] font-black text-yellow-300">
                            OWNER
                          </span>
                        ) : isMember ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleLeave(league.id)
                            }
                            className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[9px] font-black text-red-300"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleJoin(league.id)
                            }
                            disabled={isJoining}
                            className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-3 py-1.5 text-[9px] font-black text-cyan-200 disabled:opacity-50"
                          >
                            Join
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {canCreateLeague && (
              <button
                type="button"
                onClick={() => {
                  setShowBrowse(false)
                  setShowCreate(true)
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/10 py-3 text-[10px] font-black uppercase tracking-wider text-purple-100"
              >
                <Plus className="h-4 w-4" />
                Create New League
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create League Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[110] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="w-full rounded-t-[2rem] border-t border-[#BF00FF]/20 bg-[#080313] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  League Builder
                </p>
                <h2 className="text-xl font-black text-white">
                  Create League
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={newLeagueName}
                onChange={(e) =>
                  setNewLeagueName(e.target.value)
                }
                maxLength={50}
                placeholder="League name"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#BF00FF]/40"
              />

              <textarea
                value={newLeagueDesc}
                onChange={(e) =>
                  setNewLeagueDesc(e.target.value)
                }
                maxLength={200}
                rows={3}
                placeholder="Description"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#BF00FF]/40"
              />

              <div className="grid grid-cols-2 gap-2">
                {[
                  'standard',
                  'competitive',
                  'casual',
                  'tournament',
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewLeagueType(type)}
                    className={`rounded-2xl border py-2.5 text-[9px] font-black uppercase tracking-wider ${
                      newLeagueType === type
                        ? 'border-[#BF00FF]/40 bg-[#BF00FF]/15 text-purple-100'
                        : 'border-white/10 bg-white/5 text-zinc-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-[10px] text-red-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  isCreating || !newLeagueName.trim()
                }
                className="w-full rounded-2xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] py-3 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-40"
              >
                {isCreating
                  ? 'Creating League...'
                  : 'Create League'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}