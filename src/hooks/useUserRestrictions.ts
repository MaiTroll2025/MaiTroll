import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type UserRestrictionType = 'maipiks' | 'chat' | 'broadcast' | 'podcast' | 'hytrogames'

export interface UserRestriction {
  id: string
  restriction_type: UserRestrictionType
  actor_id: string | null
  actor_username: string | null
  actor_role: string | null
  reason: string
  source: string
  source_report_id: string | null
  source_page: string
  created_at: string
  expires_at: string | null
  status: 'active' | 'revoked'
  details: Record<string, unknown>
}

export function useUserRestrictions(userId?: string | null) {
  const [restrictions, setRestrictions] = useState<UserRestriction[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [requestLoading, setRequestLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setRestrictions([])
      setLoadedUserId(null)
      setRequestLoading(false)
      return
    }

    setRequestLoading(true)
    const { data, error } = await supabase.rpc('get_user_restrictions', { p_user_id: userId })
    if (error) {
      console.error('[useUserRestrictions] Failed to load restrictions:', error)
      setRestrictions([])
    } else {
      setRestrictions((data || []) as UserRestriction[])
    }
    setLoadedUserId(userId)
    setRequestLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
    if (!userId) return

    const channel = supabase
      .channel(`user-restrictions:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_restrictions',
        filter: `target_user_id=eq.${userId}`,
      }, () => { void refresh() })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, userId])

  useEffect(() => {
    const nearestExpiry = restrictions
      .map((restriction) => restriction.expires_at ? new Date(restriction.expires_at).getTime() : null)
      .filter((timestamp): timestamp is number => timestamp !== null && timestamp > Date.now())
      .sort((a, b) => a - b)[0]

    if (!nearestExpiry) return
    const timer = window.setTimeout(() => { void refresh() }, Math.max(0, nearestExpiry - Date.now()) + 250)
    return () => window.clearTimeout(timer)
  }, [refresh, restrictions])

  const activeByType = useMemo(() => {
    const active = new Map<UserRestrictionType, UserRestriction>()
    for (const restriction of restrictions) {
      if (restriction.status !== 'active') continue
      if (restriction.expires_at && new Date(restriction.expires_at).getTime() <= Date.now()) continue
      const existing = active.get(restriction.restriction_type)
      if (!existing || (!restriction.expires_at && existing.expires_at)
        || (restriction.expires_at && existing.expires_at
          && new Date(restriction.expires_at).getTime() > new Date(existing.expires_at).getTime())) {
        active.set(restriction.restriction_type, restriction)
      }
    }
    return active
  }, [restrictions])

  return {
    restrictions,
    loading: Boolean(userId && (requestLoading || loadedUserId !== userId)),
    refresh,
    activeByType,
    isRestricted: (type: UserRestrictionType) => activeByType.has(type),
    restrictionFor: (type: UserRestrictionType) => activeByType.get(type) || null,
  }
}