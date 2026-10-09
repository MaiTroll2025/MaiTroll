import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { LeagueMission } from '../lib/leagueHelpers'

export interface UseLeagueMissionsResult {
  missions: LeagueMission[]
  activeMissions: LeagueMission[]
  completedMissions: LeagueMission[]
  isLoading: boolean
  isClaiming: boolean
  claimingMissionId: string | null
  error: string | null
  refreshMissions: () => Promise<void>
  claimMission: (missionId: string) => Promise<{ success: boolean; error?: string; data?: any }>
}

export function useLeagueMissions(leagueEventId?: string | null): UseLeagueMissionsResult {
  const { user, profile } = useAuthStore()
  const [missions, setMissions] = useState<LeagueMission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMissions = useCallback(async () => {
    if (!user?.id || !profile?.id) {
      setMissions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let eventId = leagueEventId
      if (!eventId) {
        try {
          const { data: eventData } = await supabase.rpc('ensure_league_system_ready')
          eventId = eventData?.id ?? eventId
        } catch {
          // RPC may not exist yet or has mismatched signature — non-fatal
        }

        if (!eventId) {
          const now = new Date().toISOString()
          const { data: activeEvents, error: activeEventError } = await supabase
            .from('league_events')
            .select('id')
            .eq('status', 'active')
            .lte('starts_at', now)
            .gte('ends_at', now)
            .order('starts_at', { ascending: false })
            .limit(1)

          if (activeEventError && activeEventError.code !== 'PGRST104') {
            if (process.env.NODE_ENV === 'development') {
              console.error('[useLeagueMissions] active league event fallback failed:', activeEventError)
            }
          } else if (Array.isArray(activeEvents) && activeEvents.length > 0) {
            eventId = activeEvents[0].id
          }
        }
      }

      let loadedMissions: any[] = []
      try {
        const { data, error: missionError } = await supabase
          .from('user_league_missions')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'completed'])
          .order('created_at', { ascending: false })

        if (missionError && missionError.code !== 'PGRST116') {
          throw missionError
        }
        loadedMissions = Array.isArray(data) ? data : []
      } catch {
        // Table may not exist yet — missions will be empty
      }

      setMissions(loadedMissions as LeagueMission[])

      const activeCount = loadedMissions.filter((mission: any) => mission.status === 'active').length
      if (activeCount < 3 && user?.id) {
        try {
          await supabase.rpc('generate_user_league_missions', {
            p_user_id: user.id,
            p_league_event_id: null,
            p_count: 3,
          })
        } catch {
          // RPC may not exist yet
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[useLeagueMissions] failed to load missions:', err)
      }
      setError(err instanceof Error ? err.message : 'Unable to load league missions')
    } finally {
      setIsLoading(false)
    }
  }, [leagueEventId, profile?.id, user.id])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const refreshMissions = useCallback(async () => {
    await fetchMissions()
  }, [fetchMissions])

  const claimMission = useCallback(
    async (missionId: string) => {
      if (!user?.id || !missionId) {
        return { success: false, error: 'Missing user or mission id' }
      }

      setIsClaiming(true)
      setClaimingMissionId(missionId)
      setError(null)

      try {
        const { data, error: claimError } = await supabase.rpc('claim_user_league_mission', {
          p_user_id: user.id,
          p_mission_id: missionId,
        })

        if (claimError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[useLeagueMissions] claim_user_league_mission failed:', claimError)
          }
          setError(claimError.message)
          return { success: false, error: claimError.message }
        }

        await fetchMissions()
        // Refresh user profile so XP/coin balance updates immediately
        try {
          await useAuthStore.getState().refreshProfile(true)
        } catch {
          // Non-fatal — profile will refresh on next mount
        }
        return { success: true, data }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useLeagueMissions] claim mission error:', err)
        }
        const message = err instanceof Error ? err.message : 'Failed to claim mission'
        setError(message)
        return { success: false, error: message }
      } finally {
        setIsClaiming(false)
        setClaimingMissionId(null)
      }
    },
    [fetchMissions, user?.id]
  )

  return {
    missions,
    activeMissions: missions.filter((mission) => mission.status === 'active'),
    completedMissions: missions.filter((mission) => mission.status === 'completed'),
    isLoading,
    isClaiming,
    claimingMissionId,
    error,
    refreshMissions,
    claimMission,
  }
}
