import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export interface UserLeague {
  id: string
  name: string
  description: string | null
  creator_id: string
  max_members: number
  is_active: boolean
  is_public: boolean
  league_type: string
  icon_emoji: string
  color: string
  league_score: number
  league_level: number
  member_count: number
  requirements: Record<string, any> | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  role: string
  status: string
  joined_at: string
  contribution_score: number
  last_active_at: string
  username?: string
  display_name?: string
  avatar_url?: string
  level?: number
}

export interface UserLeagueMission {
  id: string
  league_id: string
  user_id: string
  mission_key: string
  title: string
  description: string | null
  event_type: string
  target_value: number
  current_value: number
  reward_points: number
  reward_xp: number
  reward_coins: number
  status: string
  generated_by: string
  completed_at: string | null
  claimed_at: string | null
  expires_at: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface UseUserLeaguesResult {
  myLeagues: UserLeague[]
  myMemberships: Record<string, LeagueMember>
  leagueMissions: UserLeagueMission[]
  isLoading: boolean
  isCreating: boolean
  isJoining: boolean
  error: string | null
  createLeague: (params: CreateLeagueParams) => Promise<string | null>
  joinLeague: (leagueId: string) => Promise<boolean>
  leaveLeague: (leagueId: string) => Promise<boolean>
  claimMission: (missionId: string) => Promise<boolean>
  refreshLeagues: () => Promise<void>
}

export interface CreateLeagueParams {
  name: string
  description?: string
  leagueType?: string
  maxMembers?: number
  isPublic?: boolean
  iconEmoji?: string
  color?: string
  requirements?: Record<string, any>
}

export function useUserLeagues(): UseUserLeaguesResult {
  const { user, profile } = useAuthStore()
  const [myLeagues, setMyLeagues] = useState<UserLeague[]>([])
  const [myMemberships, setMyMemberships] = useState<Record<string, LeagueMember>>({})
  const [leagueMissions, setLeagueMissions] = useState<UserLeagueMission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMyLeagues = useCallback(async () => {
    if (!user?.id) {
      setMyLeagues([])
      setMyMemberships({})
      setLeagueMissions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch leagues where user is a member
      const { data: membershipData, error: membershipError } = await supabase
        .from('user_league_members')
        .select(`
          *,
          user_leagues:league_id (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipError && membershipError.code !== 'PGRST116') {
        throw membershipError
      }

      const memberships: Record<string, LeagueMember> = {}
      const leagues: UserLeague[] = []

      if (Array.isArray(membershipData)) {
        for (const row of membershipData) {
          if (row.user_leagues) {
            leagues.push(row.user_leagues as UserLeague)
            memberships[row.league_id] = {
              id: row.id,
              league_id: row.league_id,
              user_id: row.user_id,
              role: row.role,
              status: row.status,
              joined_at: row.joined_at,
              contribution_score: row.contribution_score,
              last_active_at: row.last_active_at,
            }
          }
        }
      }

      setMyLeagues(leagues)
      setMyMemberships(memberships)

      // Fetch league missions for all leagues the user is in
      if (leagues.length > 0) {
        const leagueIds = leagues.map(l => l.id)
        const { data: missionData, error: missionError } = await supabase
          .from('user_league_missions')
          .select('*')
          .eq('user_id', user.id)
          .in('league_id', leagueIds)
          .in('status', ['active', 'completed'])
          .order('created_at', { ascending: false })

        if (!missionError) {
          setLeagueMissions(Array.isArray(missionData) ? missionData as UserLeagueMission[] : [])
        }
      } else {
        setLeagueMissions([])
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useUserLeagues] Failed to load leagues:', err)
      }
      setError(err instanceof Error ? err.message : 'Failed to load leagues')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchMyLeagues()
  }, [fetchMyLeagues])

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel(`user-leagues-${user.id}`)
    channel
      // OPTIMIZED: Only listen to INSERT/UPDATE events (not DELETE)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_leagues' }, () => fetchMyLeagues())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_leagues' }, () => fetchMyLeagues())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_league_members', filter: `user_id=eq.${user.id}` }, () => fetchMyLeagues())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_league_missions', filter: `user_id=eq.${user.id}` }, () => fetchMyLeagues())
      .subscribe()

    return () => { 
      if (channel) {
        supabase.removeChannel(channel) 
      }
    }
  }, [fetchMyLeagues, user?.id])

  const createLeague = useCallback(async (params: CreateLeagueParams): Promise<string | null> => {
    if (!user?.id) return null

    // Client-side level check (server also enforces)
    const userLevel = profile?.level ?? 0
    const isAdmin = profile?.is_admin === true || profile?.role === 'admin' || profile?.role === 'ceo' || profile?.role === 'superadmin'
    const isRole = profile?.role != null && profile.role !== 'user'

    if (userLevel < 10 && !isAdmin && !isRole) {
      setError('You must be level 10 to create a league')
      return null
    }

    setIsCreating(true)
    setError(null)

    try {
      const { data, error: createError } = await supabase.rpc('create_user_league', {
        p_name: params.name,
        p_description: params.description ?? null,
        p_league_type: params.leagueType ?? 'standard',
        p_max_members: params.maxMembers ?? 50,
        p_is_public: params.isPublic ?? true,
        p_icon_emoji: params.iconEmoji ?? '🏆',
        p_color: params.color ?? '#8b5cf6',
        p_requirements: JSON.stringify(params.requirements ?? { min_level: 0, invite_only: false }),
      })

      if (createError) {
        setError(createError.message)
        return null
      }

      await fetchMyLeagues()
      return data as string
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create league'
      setError(message)
      return null
    } finally {
      setIsCreating(false)
    }
  }, [user?.id, profile, fetchMyLeagues])

  const joinLeague = useCallback(async (leagueId: string): Promise<boolean> => {
    if (!user?.id) return false

    setIsJoining(true)
    setError(null)

    try {
      const { error: joinError } = await supabase.rpc('join_user_league', {
        p_league_id: leagueId,
      })

      if (joinError) {
        setError(joinError.message)
        return false
      }

      await fetchMyLeagues()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join league'
      setError(message)
      return false
    } finally {
      setIsJoining(false)
    }
  }, [user?.id, fetchMyLeagues])

  const leaveLeague = useCallback(async (leagueId: string): Promise<boolean> => {
    if (!user?.id) return false

    setError(null)

    try {
      const { error: leaveError } = await supabase.rpc('leave_user_league', {
        p_league_id: leagueId,
      })

      if (leaveError) {
        setError(leaveError.message)
        return false
      }

      await fetchMyLeagues()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave league'
      setError(message)
      return false
    }
  }, [user?.id, fetchMyLeagues])

  const claimMission = useCallback(async (missionId: string): Promise<boolean> => {
    if (!user?.id) return false

    setError(null)

    try {
      const { data: _data, error: claimError } = await supabase.rpc('claim_user_league_mission', {
        p_mission_id: missionId,
      })

      if (claimError) {
        setError(claimError.message)
        return false
      }

      await fetchMyLeagues()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim mission'
      setError(message)
      return false
    }
  }, [user?.id, fetchMyLeagues])

  return {
    myLeagues,
    myMemberships,
    leagueMissions,
    isLoading,
    isCreating,
    isJoining,
    error,
    createLeague,
    joinLeague,
    leaveLeague,
    claimMission,
    refreshLeagues: fetchMyLeagues,
  }
}
