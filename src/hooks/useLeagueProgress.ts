import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import {
  T_LEAGUE_TIERS,
  getNextSubTier,
  getScoreForNextSubTier,
  getSubTierColor,
  getSubTierFromScore,
  getSubTierProgress,
} from '../config/T_LEAGUE_CONFIG'

export interface WeeklyGoalProgress {
  id: string
  goalType: string
  title: string
  description: string
  target: number
  current: number
  reward: number
  completed: boolean
  claimed: boolean
  icon: string
}

export interface LeagueProgressState {
  userId: string
  streamId: string
  username: string
  seasonKey: string
  leagueScore: number
  giftCoinsReceived: number
  totalLiveMinutes: number
  giftCount: number
  streamCount: number
  totalGiftsSent: number
  weeklyGiftsSent: number
  weeklyScore: number
  weeklyGoalsCompleted: number
  leagueLevel: number
  mainTier: string
  subTier: string
  weeklyGoals: WeeklyGoalProgress[]
  weeklyResetAt: string | null
  eligibleLifetimeCoins: number
  tier500CoinGateMet: boolean
  pendingReferralPoints: number
  pendingReferralCount: number
  isLoading: boolean
}

export interface LevelUpEvent {
  type: 'sub_tier' | 'main_tier' | 'league_level'
  previous: string
  current: string
  reward: RewardInfo
}

export interface RewardInfo {
  trollCoins: number
  xp: number
  trollmonds: number
  perk: string
  label: string
}

interface TLeagueMission {
  id: string
  missionKey: string
  title: string
  description: string
  target: number
  current: number
  reward: number
  completed: boolean
  icon: string
}

interface TLeagueResponse {
  user_id: string
  total_points: number
  eligible_lifetime_coins: number
  tier: number
  tier_500_coin_gate_met: boolean
  pending_referral_points: number
  pending_referral_count: number
  missions: TLeagueMission[]
}

export function useLeagueProgress(streamId?: string | null) {
  const { user, profile } = useAuthStore()
  const userId = user?.id || profile?.id
  const [state, setState] = useState<LeagueProgressState | null>(null)
  const stateRef = useRef<LeagueProgressState | null>(null)
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null)
  const previousTierRef = useRef<string | null>(null)
  const initialLoadRef = useRef(true)
  const requestRef = useRef(false)
  const pendingRequestRef = useRef(false)
  const seasonKey = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const fetchProgress = useCallback(async () => {
    if (!userId) {
      setState(null)
      return
    }
    if (requestRef.current) {
      pendingRequestRef.current = true
      return
    }
    requestRef.current = true

    try {
      const { data, error } = await supabase.rpc('get_t_league_state')
      if (error) throw error
      if (!data) throw new Error('T League state returned no data')

      const response = data as TLeagueResponse
      const points = Number(response.total_points) || 0
      const serverTier = Math.max(0, Math.min(500, Number(response.tier) || 0))
      const nextTier = T_LEAGUE_TIERS[serverTier + 1]
      const tierScore = nextTier && points >= nextTier.minScore
        ? nextTier.minScore - 1
        : points
      const subInfo = getSubTierFromScore(tierScore)
      const mainTier = T_LEAGUE_TIERS[serverTier]?.tier ?? subInfo.tier.tier
      const missions = Array.isArray(response.missions) ? response.missions : []
      const weeklyGoals: WeeklyGoalProgress[] = missions.map((mission) => ({
        id: mission.id,
        goalType: mission.missionKey,
        title: mission.title,
        description: mission.description,
        target: Number(mission.target) || 0,
        current: Number(mission.current) || 0,
        reward: Number(mission.reward) || 0,
        completed: Boolean(mission.completed),
        claimed: Boolean(mission.completed),
        icon: mission.icon || '🎯',
      }))
      const fullTier = `${mainTier}${subInfo.sub}`

      if (!initialLoadRef.current && previousTierRef.current && previousTierRef.current !== fullTier) {
        const previousMain = previousTierRef.current.replace(/[a-d]$/, '')
        const previousMainIndex = T_LEAGUE_TIERS.findIndex((tier) => tier.tier === previousMain)
        const currentMainIndex = T_LEAGUE_TIERS.findIndex((tier) => tier.tier === mainTier)
        const reward = {
          trollCoins: 0,
          xp: 0,
          trollmonds: 0,
          perk: `Reach ${fullTier}`,
          label: `T League progress: ${fullTier}`,
        }
        setLevelUpEvent({
          type: currentMainIndex > previousMainIndex ? 'main_tier' : 'sub_tier',
          previous: previousTierRef.current,
          current: fullTier,
          reward,
        })
      }

      const nextState: LeagueProgressState = {
        userId,
        streamId: streamId || '',
        username: profile?.username || user?.email?.split('@')?.[0] || 'Broadcaster',
        seasonKey,
        leagueScore: points,
        giftCoinsReceived: 0,
        totalLiveMinutes: 0,
        giftCount: 0,
        streamCount: 0,
        totalGiftsSent: 0,
        weeklyGiftsSent: 0,
        weeklyScore: 0,
        weeklyGoalsCompleted: weeklyGoals.filter((goal) => goal.completed).length,
        leagueLevel: 0,
        mainTier,
        subTier: subInfo.sub,
        weeklyGoals,
        weeklyResetAt: null,
        eligibleLifetimeCoins: Number(response.eligible_lifetime_coins) || 0,
        tier500CoinGateMet: Boolean(response.tier_500_coin_gate_met),
        pendingReferralPoints: Number(response.pending_referral_points) || 0,
        pendingReferralCount: Number(response.pending_referral_count) || 0,
        isLoading: false,
      }

      previousTierRef.current = fullTier
      initialLoadRef.current = false
      stateRef.current = nextState
      setState(nextState)
    } catch (error) {
      console.error('[useLeagueProgress] Failed to load authoritative T League state:', error)
      setState((previous) => previous ? { ...previous, isLoading: false } : null)
    } finally {
      requestRef.current = false
      if (pendingRequestRef.current) {
        pendingRequestRef.current = false
        window.setTimeout(() => { void fetchProgress() }, 0)
      }
    }
  }, [profile?.username, seasonKey, streamId, user?.email, userId])

  const dismissLevelUp = useCallback(() => {
    setLevelUpEvent(null)
  }, [])

  useEffect(() => {
    void fetchProgress()
  }, [fetchProgress])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`t-league-progress-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 't_league_mission_assignments',
          filter: `user_id=eq.${userId}`,
        },
        () => { void fetchProgress() },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 't_league_progress',
          filter: `user_id=eq.${userId}`,
        },
        () => { void fetchProgress() },
      )
      .subscribe()

    const fallbackRefresh = window.setInterval(() => {
      void fetchProgress()
    }, 60_000)

    return () => {
      window.clearInterval(fallbackRefresh)
      void supabase.removeChannel(channel)
    }
  }, [fetchProgress, userId])

  const stateTierIndex = state
    ? T_LEAGUE_TIERS.findIndex((tier) => tier.tier === state.mainTier)
    : -1
  const nextMainTier = stateTierIndex >= 0 ? T_LEAGUE_TIERS[stateTierIndex + 1] : undefined
  const progressScore = state && nextMainTier
    ? Math.min(state.leagueScore, nextMainTier.minScore - 1)
    : state?.leagueScore || 0
  const subTierProgress = state ? getSubTierProgress(progressScore) : 0
  const currentTier = state
    ? T_LEAGUE_TIERS.find((tier) => tier.tier === state.mainTier) || T_LEAGUE_TIERS[0]
    : T_LEAGUE_TIERS[0]
  const nextSubTier = state ? getNextSubTier(currentTier, state.subTier) : null
  const scoreForNext = state ? getScoreForNextSubTier(progressScore) : null
  const subTierColor = state ? getSubTierColor(state.mainTier, state.subTier) : 'from-gray-600 to-gray-500'

  return {
    state,
    subTierProgress,
    nextSubTier,
    scoreForNext,
    subTierColor,
    levelUpEvent,
    dismissLevelUp,
    refreshProgress: fetchProgress,
  }
}
