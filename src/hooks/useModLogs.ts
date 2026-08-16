import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { isProtectedPlatformRole } from '@/lib/protectedRoles'

export interface ModLogEntry {
  id: string
  action: string | null
  action_type: string | null
  reason: string | null
  details: string | null
  status: string | null
  created_at: string
  claimed_at?: string | null
  first_action_at?: string | null
  resolved_at?: string | null
  officer?: {
    id: string
    username: string | null
    role?: string | null
    avatar_url?: string | null
  } | null
  target?: {
    id: string
    username: string | null
    avatar_url?: string | null
  } | null
  stream?: {
    id: string
    title?: string | null
  } | null
  report?: {
    id: string
    reason?: string | null
  } | null
}

export interface ModLogsFilters {
  officerId?: string
  targetUserId?: string
  action?: string
  severity?: string
  streamId?: string
  reportId?: string
  dateFrom?: string
  dateTo?: string
  slaMet?: boolean
}

export function useModLogs(filters: ModLogsFilters = {}, pageSize = 25) {
  const { profile } = useAuthStore()
  const [logs, setLogs] = useState<ModLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const fetchSeqRef = useRef(0)

  const isStaff = profile?.is_admin === true || ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'ceo', 'superadmin'].includes(profile?.role || '')

  const fetchLogs = useCallback(async (reset = false) => {
    if (!isStaff) return
    const seq = ++fetchSeqRef.current
    setLoading(true)
    try {
      let query = supabase
        .from('moderation_actions')
        .select('id, action, action_type, reason, details, status, created_at, officer_id, actor_id, target_user_id, stream_id, report_id')
        .order('created_at', { ascending: false })
        .limit(pageSize)

      if (filters.officerId) query = query.eq('officer_id', filters.officerId)
      if (filters.targetUserId) query = query.eq('target_user_id', filters.targetUserId)
      if (filters.action) query = query.eq('action', filters.action)
      if (filters.streamId) query = query.eq('stream_id', filters.streamId)
      if (filters.reportId) query = query.eq('report_id', filters.reportId)
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

      if (cursor && !reset) {
        query = query.lt('created_at', cursor)
      }

      const { data, error } = await query
      if (error) throw error

      if (!mountedRef.current || seq !== fetchSeqRef.current) return

      const rows = (data || []) as any[]
      const ids = new Set<string>()
      rows.forEach((r) => {
        if (r.target_user_id) ids.add(r.target_user_id)
        if (r.officer_id) ids.add(r.officer_id)
        if (r.actor_id) ids.add(r.actor_id)
      })
      const profileMap = new Map<string, any>()
      if (ids.size > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, role, is_admin')
          .in('id', Array.from(ids))
        ;(profiles || []).forEach((p: any) => profileMap.set(p.id, p))
      }

      const mapped: ModLogEntry[] = rows.map((r) => ({
        id: r.id,
        action: r.action,
        action_type: r.action_type,
        reason: r.reason,
        details: r.details,
        status: r.status,
        created_at: r.created_at,
        officer: r.officer_id ? profileMap.get(r.officer_id) || r.actor_id ? { ...profileMap.get(r.actor_id), id: r.actor_id } : { id: r.officer_id, username: null } : null,
        target: r.target_user_id ? { id: r.target_user_id, ...profileMap.get(r.target_user_id) } : null,
        stream: r.stream_id ? { id: r.stream_id } : null,
        report: r.report_id ? { id: r.report_id } : null,
      }))

      if (reset) {
        setLogs(mapped)
        setCursor(mapped.length > 0 ? mapped[mapped.length - 1].created_at : null)
      } else {
        setLogs((prev) => {
          const next = [...prev, ...mapped]
          if (mapped.length > 0) setCursor(mapped[mapped.length - 1].created_at)
          return next
        })
      }
      setHasMore(rows.length >= pageSize)
    } catch (err) {
      console.warn('[useModLogs] fetch error:', err)
    } finally {
      if (mountedRef.current && seq === fetchSeqRef.current) {
        setLoading(false)
      }
    }
  }, [isStaff, filters, pageSize, cursor])

  useEffect(() => {
    mountedRef.current = true
    if (isStaff) {
      void fetchLogs(true)
    }
    return () => {
      mountedRef.current = false
    }
  }, [isStaff, filters, fetchLogs])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      void fetchLogs(false)
    }
  }, [loading, hasMore, fetchLogs])

  const refresh = useCallback(() => {
    setCursor(null)
    setHasMore(true)
    void fetchLogs(true)
  }, [fetchLogs])

  return { logs, loading, hasMore, loadMore, refresh, isStaff }
}
