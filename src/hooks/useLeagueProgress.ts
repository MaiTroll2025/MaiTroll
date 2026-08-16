import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useXPStore } from '../stores/useXPStore'
import { sendStreamBroadcast } from '../lib/realtime/streamRealtimeManager'
import {
  T_LEAGUE_TIERS,
  LEAGUE_LEVELS,
  getSubTierFromScore,
  getSubTierProgress,
  getNextSubTier,
  getScoreForNextSubTier,
  getLeagueLevel,
  getNextLeagueLevel,
  getLeagueLevelProgress,
  getSubTierColor,
  getWeeklyGoalsForTier,
  type TLeagueTier,
  type LeagueLevel,
  type WeeklyGoal,
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

function getTierReward(mainTier: string, subTier: string): RewardInfo {
  const tierNum = parseInt(mainTier.replace('T', ''))
  const subIdx = ['a', 'b', 'c', 'd'].indexOf(subTier)
  const tierLabel = T_LEAGUE_TIERS.find(t => t.tier === mainTier)?.label || mainTier

  if (subIdx === 0) {
    return {
      trollCoins: (tierNum + 1) * 100,
      xp: (tierNum + 1) * 50,
      trollmonds: (tierNum + 1) * 50,
      perk: `Reach ${tierLabel}`,
      label: `${mainTier} reached! +${(tierNum + 1) * 100} coins, +${(tierNum + 1) * 50} XP, +${(tierNum + 1) * 50} trollmonds`,
    }
  }

  return {
    trollCoins: (tierNum + 1) * 25,
    xp: (tierNum + 1) * 15,
    trollmonds: (tierNum + 1) * 10,
    perk: `Advance to ${mainTier}${subTier}`,
    label: `${mainTier}${subTier} reached! +${(tierNum + 1) * 25} coins, +${(tierNum + 1) * 15} XP`,
  }
}

function getLeagueLevelReward(level: number): RewardInfo {
  const lvl = LEAGUE_LEVELS.find(l => l.level === level)
  return {
    trollCoins: level * 200,
    xp: level * 100,
    trollmonds: level * 75,
    perk: lvl?.perk || 'Level up!',
    label: `League Level ${level} — ${lbl?.label || 'Level up!'} +${level * 200} coins, +${level * 100} XP`,
  }
}

export function useLeagueProgress(streamId?: string | null) {
  const { user, profile } = useAuthStore()
  const xpStore = useXPStore()
  const userId = user?.id || profile?.id
  const [state, setState] = useState<LeagueProgressState | null>(null)
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null)
  const prevTierRef = useRef<string | null>(null)
  const prevLevelRef = useRef<number>(0)
  const isInitialLoad = useRef(true)

  const seasonKey = new Date().toISOString().slice(0, 7)

  const fetchProgress = useCallback(async () => {
    if (!userId) return

    try {
      const { data: statsData } = await supabase
        .from('broadcast_league_stats')
        .select('*')
        .eq('broadcaster_id', userId)
        .eq('season_key', seasonKey)
        .maybeSingle()

      const leagueScore = statsData
        ? Number(statsData.total_xp) || 0
        : xpStore.xpTotal || 0

      const subInfo = getSubTierFromScore(leagueScore)
      const mainTier = statsData?.league_tier || subInfo.tier.tier
      const subTier = statsData?.sub_tier || subInfo.sub
      const leagueLevel = statsData?.league_level || getLeagueLevel(Number(statsData?.total_gifts_sent) || 0).level

      let weeklyGoals: WeeklyGoalProgress[] = []
      try {
        const { data: goalsData } = await supabase
          .from('weekly_league_goals')
          .select('*')
          .eq('user_id', userId)
          .eq('season_key', seasonKey)
          .eq('main_tier', mainTier)
          .eq('sub_tier', subTier)

        if (goalsData && goalsData.length > 0) {
          weeklyGoals = goalsData.map((g: any) => ({
            id: g.id,
            goalType: g.goal_type,
            title: g.goal_type === 'gift_weekly' ? 'Gift Spree'
              : g.goal_type === 'live_weekly' ? 'Go Live'
              : g.goal_type === 'chat_weekly' ? 'Chat Active'
              : 'Watch & Support',
            description: g.goal_type === 'gift_weekly' ? 'Send gifts in any live broadcast'
              : g.goal_type === 'live_weekly' ? 'Broadcast for at least 15 minutes'
              : g.goal_type === 'chat_weekly' ? 'Send 20 chat messages in broadcasts'
              : 'Watch 30 minutes of live broadcasts',
            target: Number(g.target_value) || 0,
            current: Number(g.current_value) || 0,
            reward: Number(g.reward_score) || 0,
            completed: g.completed || false,
            claimed: g.claimed || false,
            icon: g.goal_type === 'gift_weekly' ? '🎁'
              : g.goal_type === 'live_weekly' ? '📡'
              : g.goal_type === 'chat_weekly' ? '💬'
              : '👁️',
          }))
        } else {
          const templates = getWeeklyGoalsForTier(mainTier, subTier)
          for (const tmpl of templates) {
            try {
              const { data: inserted } = await supabase
                .from('weekly_league_goals')
                .insert({
                  user_id: userId,
                  season_key: seasonKey,
                  main_tier: mainTier,
                  sub_tier: subTier,
                  goal_type: tmpl.id,
                  target_value: tmpl.target,
                  reward_score: tmpl.reward,
                  current_value: 0,
                  completed: false,
                  claimed: false,
                })
                .select()
                .single()
              if (inserted) {
                weeklyGoals.push({
                  id: inserted.id,
                  goalType: tmpl.id,
                  title: tmpl.title,
                  description: tmpl.description,
                  target: tmpl.target,
                  current: 0,
                  reward: tmpl.reward,
                  completed: false,
                  claimed: false,
                  icon: tmpl.icon,
                })
              }
            } catch (e) {
              if (import.meta.env.DEV) console.warn('[useLeagueProgress] goal insert failed:', e)
            }
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[useLeagueProgress] goals fetch failed:', e)
      }

      const newState: LeagueProgressState = {
        userId,
        streamId: streamId || '',
        username: profile?.username || user?.email?.split('@')?.[0] || 'Broadcaster',
        seasonKey,
        leagueScore,
        giftCoinsReceived: Number(statsData?.gift_coins_received) || 0,
        totalLiveMinutes: Number(statsData?.total_live_minutes) || 0,
        giftCount: Number(statsData?.gift_count) || 0,
        streamCount: Number(statsData?.stream_count) || 0,
        totalGiftsSent: Number(statsData?.total_gifts_sent) || 0,
        weeklyGiftsSent: Number(statsData?.weekly_gifts_sent) || 0,
        weeklyScore: Number(statsData?.weekly_score) || 0,
        weeklyGoalsCompleted: Number(statsData?.weekly_goals_completed) || 0,
        leagueLevel,
        mainTier,
        subTier,
        weeklyGoals,
        weeklyResetAt: statsData?.weekly_reset_at || null,
        isLoading: false,
      }

      const currentFullTier = `${mainTier}${subTier}`

      if (!isInitialLoad.current) {
        if (prevTierRef.current && currentFullTier !== prevTierRef.current) {
          const prevMain = prevTierRef.current.replace(/[a-d]$/, '')
          const prevSub = prevTierRef.current.slice(-1)
          const prevMainIdx = T_LEAGUE_TIERS.findIndex(t => t.tier === prevMain)
          const curMainIdx = T_LEAGUE_TIERS.findIndex(t => t.tier === mainTier)

          if (curMainIdx > prevMainIdx) {
            const reward = getTierReward(mainTier, subTier)
            const event = { type: 'main_tier' as const, previous: prevTierRef.current, current: currentFullTier, reward }
            setLevelUpEvent(event)
            if (state) {
              await distributeReward(reward, state.userId)
              const tierLabel = T_LEAGUE_TIERS.find(t => t.tier === mainTier)?.label || mainTier
              void sendStreamBroadcast(state.streamId || '', 'league_level_up', {
                user_id: state.userId,
                username: state.username || 'Broadcaster',
                type: 'main_tier',
                previous: prevTierRef.current,
                current: currentFullTier,
                tierLabel,
                icon: T_LEAGUE_TIERS.find(t => t.tier === mainTier)?.icon || '⭐',
              }).catch(() => {})
            }
          } else {
            const reward = getTierReward(mainTier, subTier)
            const event = { type: 'sub_tier' as const, previous: prevTierRef.current, current: currentFullTier, reward }
            setLevelUpEvent(event)
            if (state) {
              await distributeReward(reward, state.userId)
              const tierLabel = T_LEAGUE_TIERS.find(t => t.tier === mainTier)?.label || mainTier
              void sendStreamBroadcast(state.streamId || '', 'league_level_up', {
                user_id: state.userId,
                username: state.username || 'Broadcaster',
                type: 'sub_tier',
                previous: prevTierRef.current,
                current: currentFullTier,
                tierLabel,
                icon: T_LEAGUE_TIERS.find(t => t.tier === mainTier)?.icon || '⭐',
              }).catch(() => {})
            }
          }
        }

        if (prevLevelRef.current > 0 && leagueLevel > prevLevelRef.current) {
          const reward = getLeagueLevelReward(leagueLevel)
          const event = { type: 'league_level' as const, previous: `Lv.${prevLevelRef.current}`, current: `Lv.${leagueLevel}`, reward }
          setLevelUpEvent(event)

          if (state) {
            await distributeReward(reward, state.userId)
            const lvlInfo = LEAGUE_LEVELS.find(l => l.level === leagueLevel)
            void sendStreamBroadcast(state.streamId || '', 'league_level_up', {
              user_id: state.userId,
              username: state.username || 'Broadcaster',
              type: 'league_level',
              previous: `Lv.${prevLevelRef.current}`,
              current: `Lv.${leagueLevel}`,
              tierLabel: lvlInfo?.label || `Level ${leagueLevel}`,
              icon: lvlInfo?.icon || '🏆',
            }).catch(() => {})
          }
        }
      }

      prevTierRef.current = currentFullTier
      prevLevelRef.current = leagueLevel
      isInitialLoad.current = false

      setState(newState)
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[useLeagueProgress] fetch failed:', err)
      setState(prev => prev ? { ...prev, isLoading: false } : null)
    }
  }, [userId, seasonKey])

  const distributeReward = async (reward: RewardInfo, uid: string) => {
    try {
      await supabase.rpc('grant_league_reward', {
        p_user_id: uid,
        p_troll_coins: reward.trollCoins,
        p_xp: reward.xp,
        p_trollmonds: reward.trollmonds,
        p_label: reward.label,
      })
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[useLeagueProgress] reward grant failed:', err)
      try {
        await supabase
          .from('user_profiles')
          .update({
            troll_coins: (profile?.troll_coins || 0) + reward.trollCoins,
            xp: (profile?.xp || 0) + reward.xp,
          })
          .eq('id', uid)
      } catch (e2) {
        if (import.meta.env.DEV) console.warn('[useLeagueProgress] fallback reward failed:', e2)
      }
    }
  }

  const claimWeeklyGoal = useCallback(async (goalId: string) => {
    if (!state) return
    const goal = state.weeklyGoals.find(g => g.id === goalId)
    if (!goal || !goal.completed || goal.claimed) return

    try {
      const { error } = await supabase
        .from('weekly_league_goals')
        .update({ claimed: true, updated_at: new Date().toISOString() })
        .eq('id', goalId)

      if (error) throw error

      await supabase
        .from('broadcast_league_stats')
        .update({
          weekly_score: state.weeklyScore + goal.reward,
          weekly_goals_completed: state.weeklyGoalsCompleted + 1,
          league_score: state.leagueScore + goal.reward,
          updated_at: new Date().toISOString(),
        })
        .eq('broadcaster_id', state.userId)
        .eq('season_key', state.seasonKey)

      setState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          weeklyGoals: prev.weeklyGoals.map(g =>
            g.id === goalId ? { ...g, claimed: true } : g
          ),
          weeklyScore: prev.weeklyScore + goal.reward,
          weeklyGoalsCompleted: prev.weeklyGoalsCompleted + 1,
          leagueScore: prev.leagueScore + goal.reward,
        }
      })
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[useLeagueProgress] claim goal failed:', err)
    }
  }, [state])

  const dismissLevelUp = useCallback(() => {
    setLevelUpEvent(null)
  }, [])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`league-progress-${userId}-${streamId || 'global'}`)
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_league_stats', filter: `broadcaster_id=eq.${userId}` },
        () => fetchProgress()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_league_goals', filter: `user_id=eq.${userId}` },
        () => fetchProgress()
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId, streamId, fetchProgress])

  const subTierProgress = state ? getSubTierProgress(state.leagueScore) : 0
  const nextSubTier = state ? getNextSubTier(
    T_LEAGUE_TIERS.find(t => t.tier === state.mainTier) || T_LEAGUE_TIERS[0],
    state.subTier
  ) : null
  const scoreForNext = state ? getScoreForNextSubTier(state.leagueScore) : null
  const leagueLevelInfo = state ? getLeagueLevel(state.totalGiftsSent) : LEAGUE_LEVELS[0]
  const nextLeagueLevel = state ? getNextLeagueLevel(state.totalGiftsSent) : null
  const leagueLevelProgress = state ? getLeagueLevelProgress(state.totalGiftsSent) : 0
  const subTierColor = state ? getSubTierColor(state.mainTier, state.subTier) : 'from-gray-600 to-gray-500'

  return {
    state,
    subTierProgress,
    nextSubTier,
    scoreForNext,
    leagueLevelInfo,
    nextLeagueLevel,
    leagueLevelProgress,
    subTierColor,
    levelUpEvent,
    claimWeeklyGoal,
    dismissLevelUp,
    refreshProgress: fetchProgress,
  }
}
