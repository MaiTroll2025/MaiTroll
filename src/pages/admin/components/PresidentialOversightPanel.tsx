import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Crown,
  FileClock,
  Gavel,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  UserMinus,
  Users,
  Vote,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card'
import { ScrollArea } from '../../../components/ui/scroll-area'
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

const roleAccent: Record<OversightRoleKey, string> = {
  president: 'from-yellow-500/30 via-amber-400/15 to-cyan-500/10 border-yellow-400/30 text-yellow-100',
  vice_president: 'from-cyan-500/25 via-purple-500/15 to-slate-500/10 border-cyan-300/25 text-cyan-100',
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
         .limit(50);

       if (error) throw error;

       const rawLogs = (data || []) as AuditLog[];
       const profileIds = rawLogs.flatMap((log) => [log.actor_id, log.target_id]).filter(Boolean) as string[];
       const profileMap = await fetchProfilesByIds(profileIds);

       const hydratedLogs = rawLogs.map((log) => ({
         ...log,
         actor: log.actor_id ? profileMap.get(log.actor_id) || null : null,
         target: log.target_id ? profileMap.get(log.target_id) || null : null,
       }));

       setAuditLogs(hydratedLogs);
       return hydratedLogs;
     } catch (err: any) {
       // If the table doesn't exist, we just set an empty array and log a warning.
       if (err?.code === 'PGRST205') {
         console.warn('[PresidentialOversightPanel] Audit logs table not found, proceeding with empty logs.');
         setAuditLogs([]);
         return [];
       }
       // Otherwise, rethrow to be caught by the outer try/catch in loadPanelData
       throw err;
     }
   }, [fetchProfilesByIds]);

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

  const renderOfficialCard = (official: OfficialRecord) => {
    const label = roleLabels[official.roleKey]
    const isVacant = !official.userId
    const isBusy = actionLoading === official.roleKey

    return (
      <div
        key={official.roleKey}
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${roleAccent[official.roleKey]}`}
      >
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/25">
              {official.avatarUrl ? (
                <img
                  src={official.avatarUrl}
                  alt={official.username}
                  className="h-full w-full object-cover"
                />
              ) : official.roleKey === 'president' ? (
                <Crown className="h-7 w-7 text-yellow-200" />
              ) : (
                <Shield className="h-7 w-7 text-cyan-200" />
              )}
            </div>

            <div>
              <div className="text-xs font-black uppercase tracking-wider opacity-80">{label}</div>

              {isVacant ? (
                <div className="mt-1 text-lg font-black text-white/80 italic">Vacant</div>
              ) : (
                <>
                  <div className="mt-1 text-xl font-black text-white">{official.username}</div>
                  <div className="mt-1 text-xs text-white/65">
                    User ID: <span className="font-mono">{official.userId}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <Badge variant="outline" className="border-white/20 bg-black/20 text-white">
            {official.source === 'role_grant' ? 'Live DB' : official.source === 'hook' ? 'Hook Fallback' : 'Vacant'}
          </Badge>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55">Granted</div>
            <div className="mt-1 text-sm font-bold text-white">
              {safeDate(official.grantedAt, 'MMM d, yyyy h:mm a')}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55">Term Ends</div>
            <div className="mt-1 text-sm font-bold text-white">
              {safeDate(official.expiresAt || currentElection?.ends_at, 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={isVacant || isBusy}
            onClick={() => handleEmergencyRemove(official)}
            className="gap-2"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            {isBusy ? `Removing ${label}` : `Emergency Remove ${label}`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-white">
            <ShieldAlert className="h-7 w-7 text-yellow-400" />
            Presidential Oversight
          </h2>
          <p className="text-slate-400">
            Real-time oversight of elected officials, role grants, elections, and audit actions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => loadPanelData('refresh')}
          className="gap-2"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {refreshing ? 'Refreshing Real Data' : 'Refresh Real Data'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Users className="h-4 w-4 text-cyan-400" />
              Active Officials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{activeOfficialsCount}/2</div>
            <p className="text-xs text-slate-500">President and Vice President seats</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <Vote className="h-4 w-4 text-purple-400" />
              Election
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-black text-white">
              {activeElection?.status || currentElection?.status || 'No Active Election'}
            </div>
            <p className="text-xs text-slate-500">
              Ends {safeDate(activeElection?.ends_at || currentElection?.ends_at, 'MMM d, yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
              <FileClock className="h-4 w-4 text-yellow-400" />
              Audit Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white">{auditLogs.length}</div>
            <p className="text-xs text-slate-500">Latest loaded audit records</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading real presidential data...
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Gavel className="h-5 w-5 text-yellow-400" />
                Current Administration
              </CardTitle>
              <CardDescription>
                Pulled from system_roles, user_role_grants, and user_profiles.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {officialList.map(renderOfficialCard)}

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
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
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <FileClock className="h-5 w-5 text-cyan-400" />
                  Real Audit Log
                </span>
                <Badge variant="outline">{auditLogs.length} Actions</Badge>
              </CardTitle>
              <CardDescription>
                Pulled from president_audit_logs and hydrated with user_profiles.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[520px] pr-4">
                {auditLogs.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 py-10 text-center text-slate-500">
                    No actions recorded
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black uppercase tracking-wide text-slate-100">
                              {log.action?.replace(/_/g, ' ') || 'Unknown Action'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {safeDate(log.created_at, 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>

                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            Audit
                          </Badge>
                        </div>

                        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div className="rounded-xl bg-black/25 p-2">
                            <div className="text-slate-500">Actor</div>
                            <div className="font-bold text-slate-200">
                              {log.actor?.username || 'Unknown'}
                            </div>
                          </div>

                          <div className="rounded-xl bg-black/25 p-2">
                            <div className="text-slate-500">Target</div>
                            <div className="font-bold text-slate-200">
                              {log.target?.username || log.target_id || 'N/A'}
                            </div>
                          </div>
                        </div>

                        <pre className="max-h-40 overflow-auto rounded-xl bg-black/35 p-3 text-xs text-slate-400">
                          {JSON.stringify(log.details || {}, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}