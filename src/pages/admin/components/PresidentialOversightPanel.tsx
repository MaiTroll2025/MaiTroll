import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Crown,
  FileClock,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  UserMinus,
  Vote,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { usePresidentSystem } from '../../../hooks/usePresidentSystem'

type OversightRoleKey = 'president' | 'vice_president'

interface UserProfileLite {
  id: string
  username: string | null
  avatar_url: string | null
  role?: string | null
  troll_role?: string | null
  is_admin?: boolean | null
}

interface SystemRole {
  id: string
  name: string
  display_name?: string | null
}

interface RoleGrant {
  id: string
  user_id: string
  role_id: string
  expires_at?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

interface OfficialRecord {
  roleKey: OversightRoleKey
  roleId: string | null
  grantId: string | null
  userId: string | null
  username: string
  avatarUrl: string | null
  grantedAt: string | null
  expiresAt: string | null
  source: 'role_grant' | 'hook' | 'empty'
}

interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  target_id: string | null
  details: any
  created_at: string
  actor?: UserProfileLite | null
  target?: UserProfileLite | null
}

interface ElectionRow {
  id: string
  status?: string | null
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string | null
}

const roleLabels: Record<OversightRoleKey, string> = {
  president: 'President',
  vice_president: 'Vice President',
}

const safeDate = (value?: string | null, pattern = 'MMM d, yyyy') => {
  if (!value) return 'N/A'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return format(date, pattern)
}

const getUserIdFromUnknownRecord = (value: any): string | null => {
  return (
    value?.user_id ||
    value?.appointee_id ||
    value?.profile_id ||
    value?.id ||
    value?.user?.id ||
    value?.appointee?.id ||
    null
  )
}

const getUsernameFromUnknownRecord = (value: any): string => {
  return (
    value?.username ||
    value?.user?.username ||
    value?.appointee?.username ||
    value?.profile?.username ||
    'Unknown'
  )
}

export default function PresidentialOversightPanel() {
  const { currentPresident, currentVP, currentElection, refresh } = usePresidentSystem()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeModule, setActiveModule] = useState<string>('officials')

  const [systemRoles, setSystemRoles] = useState<Record<OversightRoleKey, SystemRole | null>>({
    president: null,
    vice_president: null,
  })

  const [officials, setOfficials] = useState<Record<OversightRoleKey, OfficialRecord>>({
    president: {
      roleKey: 'president',
      roleId: null,
      grantId: null,
      userId: null,
      username: 'Vacant',
      avatarUrl: null,
      grantedAt: null,
      expiresAt: null,
      source: 'empty',
    },
    vice_president: {
      roleKey: 'vice_president',
      roleId: null,
      grantId: null,
      userId: null,
      username: 'Vacant',
      avatarUrl: null,
      grantedAt: null,
      expiresAt: null,
      source: 'empty',
    },
  })

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [activeElection, setActiveElection] = useState<ElectionRow | null>(null)

  const officialList = useMemo(() => {
    return [officials.president, officials.vice_president]
  }, [officials])

  const activeOfficialsCount = useMemo(() => {
    return officialList.filter((official) => Boolean(official.userId)).length
  }, [officialList])

  const vacantSeatsCount = useMemo(() => {
    return 2 - activeOfficialsCount
  }, [activeOfficialsCount])

  const fetchProfilesByIds = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

    if (uniqueIds.length === 0) return new Map<string, UserProfileLite>()

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, role, troll_role, is_admin')
      .in('id', uniqueIds)

    if (error) throw error

    const map = new Map<string, UserProfileLite>()
    ;(data || []).forEach((profile) => {
      map.set(profile.id, profile as UserProfileLite)
    })

    return map
  }, [])

  const fetchSystemRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_roles')
      .select('id, name, display_name')
      .in('name', ['president', 'vice_president'])

    if (error) throw error

    const nextRoles: Record<OversightRoleKey, SystemRole | null> = {
      president: null,
      vice_president: null,
    }

    ;(data || []).forEach((role) => {
      if (role.name === 'president') nextRoles.president = role as SystemRole
      if (role.name === 'vice_president') nextRoles.vice_president = role as SystemRole
    })

    setSystemRoles(nextRoles)
    return nextRoles
  }, [])

  const buildFallbackOfficialsFromHook = useCallback(() => {
    const presidentUserId = getUserIdFromUnknownRecord(currentPresident)
    const vpUserId = getUserIdFromUnknownRecord(currentVP)

    return {
      president: {
        roleKey: 'president' as const,
        roleId: null,
        grantId: null,
        userId: presidentUserId,
        username: presidentUserId ? getUsernameFromUnknownRecord(currentPresident) : 'Vacant',
        avatarUrl: currentPresident?.avatar_url || null,
        grantedAt: null,
        expiresAt: currentElection?.ends_at || null,
        source: presidentUserId ? ('hook' as const) : ('empty' as const),
      },
      vice_president: {
        roleKey: 'vice_president' as const,
        roleId: null,
        grantId: null,
        userId: vpUserId,
        username: vpUserId ? getUsernameFromUnknownRecord(currentVP) : 'Vacant',
        avatarUrl: currentVP?.avatar_url || currentVP?.appointee?.avatar_url || null,
        grantedAt: null,
        expiresAt: currentElection?.ends_at || null,
        source: vpUserId ? ('hook' as const) : ('empty' as const),
      },
    }
  }, [currentPresident, currentVP, currentElection])

  const fetchOfficials = useCallback(
    async (roles: Record<OversightRoleKey, SystemRole | null>) => {
      const fallback = buildFallbackOfficialsFromHook()

      const roleIds = [roles.president?.id, roles.vice_president?.id].filter(Boolean) as string[]

      if (roleIds.length === 0) {
        setOfficials(fallback)
        return fallback
      }

      const { data: grants, error } = await supabase
        .from('user_role_grants')
        .select('id, user_id, role_id, expires_at, created_at, is_active')
        .in('role_id', roleIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const activeGrants = (grants || []).filter((grant: any) => {
        if (grant.is_active === false) return false
        if (grant.expires_at && new Date(grant.expires_at) < new Date()) return false
        return true
      }) as RoleGrant[]

      const profileMap = await fetchProfilesByIds(activeGrants.map((grant) => grant.user_id))
      const findOfficial = (roleKey: OversightRoleKey): OfficialRecord => {
        const role = roles[roleKey]
        const fallbackOfficial = fallback[roleKey]

        if (!role?.id) return fallbackOfficial

        const grant = activeGrants.find((item) => item.role_id === role.id)

        if (!grant) return fallbackOfficial

        const profile = profileMap.get(grant.user_id)
        return {
          roleKey,
          roleId: role.id,
          grantId: grant.id,
          userId: grant.user_id,
          username: profile?.username || `user_${grant.user_id.slice(0, 8)}`,
          avatarUrl: profile?.avatar_url || null,
          grantedAt: grant.created_at || null,
          expiresAt: grant.expires_at || currentElection?.ends_at || null,
          source: 'role_grant',
        }
      }

      const nextOfficials = {
        president: findOfficial('president'),
        vice_president: findOfficial('vice_president'),
      }

      setOfficials(nextOfficials)
      return nextOfficials
    },
    [buildFallbackOfficialsFromHook, currentElection?.ends_at, fetchProfilesByIds]
  )

  const fetchAuditLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_audit_logs')
        .select('id, actor_id, action, target_id, details, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const rawLogs = (data || []) as AuditLog[]
      const profileIds = rawLogs.flatMap((log) => [log.actor_id, log.target_id]).filter(Boolean) as string[]
      const profileMap = await fetchProfilesByIds(profileIds)

      const hydratedLogs = rawLogs.map((log) => ({
        ...log,
        actor: log.actor_id ? profileMap.get(log.actor_id) || null : null,
        target: log.target_id ? profileMap.get(log.target_id) || null : null,
      }))

      setAuditLogs(hydratedLogs)
      return hydratedLogs
    } catch (err: any) {
      if (err?.code === 'PGRST205') {
        console.warn('[PresidentialOversightPanel] Audit logs table not found, proceeding with empty logs.')
        setAuditLogs([])
        return []
      }
      throw err
    }
  }, [fetchProfilesByIds])

  const fetchActiveElection = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('president_elections')
        .select('id, status, title, starts_at, ends_at, created_at')
        .in('status', ['active', 'voting', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      setActiveElection((data as ElectionRow) || null)
      return data as ElectionRow | null
    } catch (err) {
      console.warn('[PresidentialOversightPanel] Active election fetch failed:', err)
      setActiveElection(currentElection || null)
      return currentElection || null
    }
  }, [currentElection])

  const loadPanelData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') setLoading(true)
      setRefreshing(true)

      try {
        await refresh?.()

        const roles = await fetchSystemRoles()

        await Promise.all([
          fetchOfficials(roles),
          fetchAuditLogs(),
          fetchActiveElection(),
        ])
      } catch (err: any) {
        console.error('[PresidentialOversightPanel] Error loading real data:', err)
        toast.error(err?.message || 'Failed to load presidential oversight data')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [refresh, fetchSystemRoles, fetchOfficials, fetchAuditLogs, fetchActiveElection]
  )

  useEffect(() => {
    loadPanelData('initial')
  }, [loadPanelData])

  const insertAuditLog = useCallback(
    async (payload: {
      action: string
      targetId: string | null
      details: Record<string, any>
    }) => {
      const { data: authData } = await supabase.auth.getUser()
      const actorId = authData?.user?.id || null

      const { error } = await supabase.from('president_audit_logs').insert({
        actor_id: actorId,
        action: payload.action,
        target_id: payload.targetId,
        details: payload.details,
      })

      if (error) {
        console.warn('[PresidentialOversightPanel] Audit insert failed:', error)
      }
    },
    []
  )

  const handleEmergencyRemove = useCallback(
    async (official: OfficialRecord) => {
      if (!official.userId) {
        toast.error(`${roleLabels[official.roleKey]} is already vacant`)
        return
      }

      const label = roleLabels[official.roleKey]

      const confirmed = window.confirm(
        `⚠️ EMERGENCY ACTION\n\nRemove current ${label}: ${official.username}?\n\nThis will revoke their active ${label} role grant.`
      )

      if (!confirmed) return

      setActionLoading(official.roleKey)
      try {
        let deleted = false

        if (official.grantId) {
          const { error } = await supabase
            .from('user_role_grants')
            .delete()
            .eq('id', official.grantId)

          if (error) throw error
          deleted = true
        } else {
          const roleId = official.roleId || systemRoles[official.roleKey]?.id

          if (!roleId) {
            throw new Error(`Missing system role id for ${label}`)
          }

          const { error } = await supabase
            .from('user_role_grants')
            .delete()
            .eq('user_id', official.userId)
            .eq('role_id', roleId)

          if (error) throw error
          deleted = true
        }

        await insertAuditLog({
          action: `emergency_remove_${official.roleKey}`,
          targetId: official.userId,
          details: {
            role: official.roleKey,
            username: official.username,
            grant_id: official.grantId,
            deleted,
            source: 'PresidentialOversightPanel',
          },
        })

        toast.success(`${label} removed successfully`)
        await loadPanelData('refresh')
      } catch (err: any) {
        console.error('[PresidentialOversightPanel] Emergency remove failed:', err)
        toast.error(err?.message || `Failed to remove ${label}`)
      } finally {
        setActionLoading(null)
      }
    },
    [systemRoles, insertAuditLog, loadPanelData]
  )

  const modules = [
    {
      id: 'officials',
      label: 'Administration',
      icon: <Crown className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      count: activeOfficialsCount,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: <FileClock className="w-4 h-4" />,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30',
      count: auditLogs.length,
    },
    {
      id: 'election',
      label: 'Election',
      icon: <Vote className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      count: activeElection ? 1 : 0,
    },
  ]

  const renderOfficialCard = (official: OfficialRecord) => {
    const label = roleLabels[official.roleKey]
    const isVacant = !official.userId
    const isBusy = actionLoading === official.roleKey

    return (
      <div key={official.roleKey} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2C2C2C] bg-[#141414]">
              {official.avatarUrl ? (
                <img
                  src={official.avatarUrl}
                  alt={official.username}
                  className="h-full w-full object-cover"
                />
              ) : official.roleKey === 'president' ? (
                <Crown className="h-7 w-7 text-yellow-400" />
              ) : (
                <Shield className="h-7 w-7 text-cyan-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</div>

              {isVacant ? (
                <div className="mt-1 text-lg font-bold text-gray-300 italic">Vacant</div>
              ) : (
                <>
                  <div className="mt-1 truncate text-xl font-bold text-white">{official.username}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    User ID: <span className="font-mono">{official.userId}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <span
            className={`shrink-0 px-2 py-1 rounded text-xs font-bold border uppercase ${
              official.source === 'role_grant'
                ? 'bg-green-500/20 text-green-400 border-green-500/50'
                : official.source === 'hook'
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                  : 'bg-slate-500/20 text-slate-400 border-slate-500/50'
            }`}
          >
            {official.source === 'role_grant' ? 'Live DB' : official.source === 'hook' ? 'Hook Fallback' : 'Vacant'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
          <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-3">
            <div className="text-xs text-gray-500">Granted</div>
            <div className="mt-1 text-sm font-bold text-white">
              {safeDate(official.grantedAt, 'MMM d, yyyy h:mm a')}
            </div>
          </div>

          <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-3">
            <div className="text-xs text-gray-500">Term Ends</div>
            <div className="mt-1 text-sm font-bold text-white">
              {safeDate(official.expiresAt || currentElection?.ends_at, 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        <button
          onClick={() => handleEmergencyRemove(official)}
          disabled={isVacant || isBusy}
          className="flex items-center gap-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition-colors disabled:opacity-50"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
          {isBusy ? `Removing ${label}` : `Emergency Remove ${label}`}
        </button>
      </div>
    )
  }

  const renderOfficialsModule = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          Current Administration ({activeOfficialsCount}/2)
        </h4>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading real presidential data...
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {officialList.map(renderOfficialCard)}

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-300" />
              <div>
                <div className="font-bold text-yellow-100">Emergency actions are logged</div>
                <p className="mt-1 text-sm text-yellow-100/70">
                  Removing an official revokes the role grant and writes to president_audit_logs when the table allows inserts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderAuditModule = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white flex items-center gap-2">
          <FileClock className="w-4 h-4 text-cyan-400" />
          Real Audit Log ({auditLogs.length})
        </h4>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading audit log...
        </div>
      ) : auditLogs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No actions recorded
        </div>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold uppercase tracking-wide text-white">
                    {log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {safeDate(log.created_at, 'MMM d, yyyy h:mm a')}
                  </div>
                </div>

                <span className="shrink-0 px-2 py-1 rounded text-xs font-bold border border-slate-700 text-slate-300 bg-slate-500/10 uppercase">
                  Audit
                </span>
              </div>

              <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-2">
                  <div className="text-gray-500">Actor</div>
                  <div className="font-bold text-gray-200">
                    {log.actor?.username || 'Unknown'}
                  </div>
                </div>

                <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-2">
                  <div className="text-gray-500">Target</div>
                  <div className="font-bold text-gray-200">
                    {log.target?.username || log.target_id || 'N/A'}
                  </div>
                </div>
              </div>

              <pre className="max-h-40 overflow-auto rounded-lg border border-[#2C2C2C] bg-black/40 p-3 text-xs text-gray-400">
                {JSON.stringify(log.details || {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderElectionModule = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white flex items-center gap-2">
          <Vote className="w-4 h-4 text-purple-400" />
          Active Election
        </h4>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading election data...
        </div>
      ) : !activeElection ? (
        <div className="text-center py-8 text-gray-500">
          <Vote className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No active election
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-sm font-bold text-white">
                {activeElection.title || 'Presidential Election'}
              </div>
              <span className="px-2 py-1 rounded text-xs font-bold border bg-purple-500/20 text-purple-400 border-purple-500/50 uppercase">
                {activeElection.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-3">
                <div className="text-xs text-gray-500">Starts</div>
                <div className="mt-1 text-sm font-bold text-white">
                  {safeDate(activeElection.starts_at, 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-3">
                <div className="text-xs text-gray-500">Ends</div>
                <div className="mt-1 text-sm font-bold text-white">
                  {safeDate(activeElection.ends_at, 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#2C2C2C] bg-[#141414] p-4">
            <div className="text-xs text-gray-500">Election ID</div>
            <div className="mt-1 font-mono text-sm font-bold text-white">{activeElection.id}</div>
          </div>
        </div>
      )}
    </div>
  )

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'officials':
        return renderOfficialsModule()
      case 'audit':
        return renderAuditModule()
      case 'election':
        return renderElectionModule()
      default:
        return renderOfficialsModule()
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Presidential Oversight</h3>
            <p className="text-sm text-gray-400">
              Real-time oversight of elected officials, role grants, and audit actions.
            </p>
          </div>
        </div>
        <button
          onClick={() => loadPanelData('refresh')}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {refreshing ? 'Refreshing...' : 'Refresh Real Data'}
        </button>
      </div>

      {/* Module Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setActiveModule(module.id)}
            className={`relative p-4 rounded-lg border transition-all duration-200 ${
              activeModule === module.id
                ? `${module.bgColor} ${module.borderColor} border-opacity-100`
                : 'bg-[#0A0814] border-[#2C2C2C] hover:border-[#3C3C3C]'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeModule === module.id ? module.bgColor : 'bg-[#2C2C2C]'
                }`}
              >
                <div className={activeModule === module.id ? module.color : 'text-gray-400'}>
                  {module.icon}
                </div>
              </div>
              <div className="text-left">
                <div
                  className={`text-sm font-medium ${
                    activeModule === module.id ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  {module.label}
                </div>
                <div className="text-xs text-gray-400">{module.count}</div>
              </div>
            </div>
            {activeModule === module.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            )}
          </button>
        ))}
      </div>

      {/* Active Module Content */}
      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
        {renderActiveModule()}
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-400">{activeOfficialsCount}/2</div>
          <div className="text-xs text-gray-400">Active Officials</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-cyan-400">{auditLogs.length}</div>
          <div className="text-xs text-gray-400">Audit Actions</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="truncate text-lg font-bold text-purple-400">
            {activeElection?.status || currentElection?.status || 'None'}
          </div>
          <div className="text-xs text-gray-400">Election</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-400">{vacantSeatsCount}</div>
          <div className="text-xs text-gray-400">Vacant Seats</div>
        </div>
      </div>
    </div>
  )
}
