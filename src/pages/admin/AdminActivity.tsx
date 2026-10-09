import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Search, ChevronDown, ChevronUp, AlertTriangle, Monitor, Clock, User as UserIcon, X, Trash2, Bell } from 'lucide-react'
import { toast } from 'sonner'

interface PresenceRow {
  user_id: string
  current_path: string | null
  current_title: string | null
  session_id: string | null
  user_agent: string | null
  last_seen_at: string
  updated_at: string
}

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  email: string | null
  is_online: boolean | null
  last_active: string | null
}

interface SystemErrorRow {
  id: string
  message: string | null
  stack: string | null
  url: string | null
  component: string | null
  status: string | null
  created_at: string
}

interface ActivityUser {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  email: string | null
  currentPath: string | null
  currentTitle: string | null
  sessionId: string | null
  userAgent: string | null
  lastSeenAt: string | null
  lastActive: string | null
  isOnline: boolean
  errorCount: number
  errors: SystemErrorRow[]
}

const RECENT_THRESHOLD_MS = 5 * 60 * 1000
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000
const STALE_ERROR_THRESHOLD_MS = 24 * 60 * 60 * 1000

function getStatus(lastSeen: string | null): 'active' | 'recent' | 'offline' {
  if (!lastSeen) return 'offline'
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff <= ACTIVE_THRESHOLD_MS) return 'active'
  if (diff <= RECENT_THRESHOLD_MS) return 'recent'
  return 'offline'
}

function isStaleError(error: SystemErrorRow, userLastSeen: string | null): boolean {
  const errorAge = Date.now() - new Date(error.created_at).getTime()
  if (errorAge < STALE_ERROR_THRESHOLD_MS) return false
  if (!userLastSeen) return true
  const userOffline = getStatus(userLastSeen) === 'offline'
  return userOffline
}

function formatRelative(timestamp: string | null): string {
  if (!timestamp) return '—'
  const diffMs = Date.now() - new Date(timestamp).getTime()
  if (diffMs < 0) return 'just now'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '—'
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return '—'
  }
}

function getPageLabel(path: string | null): string {
  if (!path) return 'Unknown'
  if (path === '/' || path === '/home') return 'Home'
  const cleaned = path.split('?')[0].replace(/\/$/, '')
  const segments = cleaned.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'

  // Dynamic route patterns where the last segment is a username/ID
  const dynamicPatterns = [
    /^profile$/i,
    /^user$/i,
    /^u$/i,
    /^watch$/i,
    /^broadcast$/i,
    /^live$/i,
    /^stream$/i,
    /^agency$/i,
    /^shop$/i,
    /^watch$/i,
  ]

  const lastSegment = segments[segments.length - 1]
  const secondLast = segments.length >= 2 ? segments[segments.length - 2] : null

  // If second-to-last is a dynamic pattern, use it as the page name instead of the username/ID
  if (secondLast && dynamicPatterns.some((p) => p.test(secondLast))) {
    const decoded = decodeURIComponent(secondLast).replace(/[-_]/g, ' ')
    return decoded.charAt(0).toUpperCase() + decoded.slice(1)
  }

  // Skip UUIDs and numeric IDs
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment) ||
               /^\d+$/.test(lastSegment)

  if (isId && secondLast) {
    const decoded = decodeURIComponent(secondLast).replace(/[-_]/g, ' ')
    return decoded.charAt(0).toUpperCase() + decoded.slice(1)
  }

  const decoded = decodeURIComponent(lastSegment).replace(/[-_]/g, ' ')
  return decoded.charAt(0).toUpperCase() + decoded.slice(1)
}

function getUserAgentSummary(ua: string | null): string {
  if (!ua) return 'Not logged yet'
  try {
    if (ua.includes('Mobile')) return 'Mobile'
    if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablet'
    return 'Desktop'
  } catch {
    return 'Unknown'
  }
}

export default function AdminActivity() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [deletingErrors, setDeletingErrors] = useState<Set<string>>(new Set())
  const [liveErrorCount, setLiveErrorCount] = useState(0)

  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceRow>>({})
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({})
  const [errorsByUser, setErrorsByUser] = useState<Record<string, SystemErrorRow[]>>({})
  const activityStateRef = useRef({ errorsByUser, presenceMap, profileMap })
  activityStateRef.current = { errorsByUser, presenceMap, profileMap }

  const deleteError = useCallback(async (errorId: string) => {
    setDeletingErrors((prev) => new Set(prev).add(errorId))
    try {
      const { error: deleteError } = await supabase
        .from('system_errors')
        .delete()
        .eq('id', errorId)
      if (deleteError) throw deleteError
      toast.success('Error deleted')
      setErrorsByUser((prev) => {
        const next = { ...prev }
        for (const userId of Object.keys(next)) {
          next[userId] = next[userId].filter((e) => e.id !== errorId)
          if (next[userId].length === 0) delete next[userId]
        }
        return next
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete error')
    } finally {
      setDeletingErrors((prev) => {
        const next = new Set(prev)
        next.delete(errorId)
        return next
      })
    }
  }, [])

  const cleanupStaleErrors = useCallback(async () => {
    const { errorsByUser, presenceMap, profileMap } = activityStateRef.current
    const staleErrorIds: string[] = []
    for (const [userId, errors] of Object.entries(errorsByUser)) {
      const userLastSeen = presenceMap[userId]?.last_seen_at || profileMap[userId]?.last_active || null
      for (const err of errors) {
        if (isStaleError(err, userLastSeen)) {
          staleErrorIds.push(err.id)
        }
      }
    }
    if (staleErrorIds.length === 0) return
    try {
      const { error: deleteError } = await supabase
        .from('system_errors')
        .delete()
        .in('id', staleErrorIds)
      if (deleteError) throw deleteError
      setErrorsByUser((prev) => {
        const next = { ...prev }
        for (const userId of Object.keys(next)) {
          next[userId] = next[userId].filter((e) => !staleErrorIds.includes(e.id))
          if (next[userId].length === 0) delete next[userId]
        }
        return next
      })
      toast.info(`Cleaned up ${staleErrorIds.length} stale error${staleErrorIds.length === 1 ? '' : 's'}`)
    } catch (_err: any) {
      toast.error('Failed to cleanup stale errors')
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const presencePromise = supabase
        .from('user_presence_routes')
        .select('user_id,current_path,current_title,session_id,user_agent,last_seen_at,updated_at')
        .order('last_seen_at', { ascending: false })
        .limit(500)

      const profilePromise = supabase
        .from('user_profiles')
        .select('id,username,display_name,avatar_url,email,is_online,last_active')
        .order('last_active', { ascending: false })
        .limit(500)

      const errorPromise = supabase
        .from('system_errors')
        .select('id,user_id,message,stack,url,component,status,created_at')
        .order('created_at', { ascending: false })
        .limit(500)

      const [presenceRes, profileRes, errorRes] = await Promise.allSettled([
        presencePromise,
        profilePromise,
        errorPromise,
      ])
      const queryErrors: string[] = []
      const settledData = <T,>(
        result: PromiseSettledResult<{ data: T | null; error: { message: string } | null }>,
        source: string,
      ): T | null => {
        if (result.status === 'rejected') {
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
          queryErrors.push(`${source}: ${message}`)
          return null
        }
        if (result.value.error) {
          queryErrors.push(`${source}: ${result.value.error.message}`)
          return null
        }
        return result.value.data
      }

      const presenceData = (settledData(presenceRes, 'Presence') as PresenceRow[] | null) || []

      const profileData = (settledData(profileRes, 'Profiles') as ProfileRow[] | null) || []

      const errorData = (settledData(errorRes, 'System errors') as (SystemErrorRow & { user_id: string })[] | null) || []

      const newPresenceMap: Record<string, PresenceRow> = {}
      for (const row of presenceData) {
        if (!row?.user_id) continue
        const existing = newPresenceMap[row.user_id]
        if (!existing || new Date(row.last_seen_at).getTime() > new Date(existing.last_seen_at).getTime()) {
          newPresenceMap[row.user_id] = row
        }
      }

      const newProfileMap: Record<string, ProfileRow> = {}
      for (const row of profileData) {
        if (!row?.id) continue
        if (!newProfileMap[row.id]) {
          newProfileMap[row.id] = row
        }
      }

      const newErrorsByUser: Record<string, SystemErrorRow[]> = {}
      for (const row of errorData) {
        if (!row?.user_id) continue
        if (!newErrorsByUser[row.user_id]) newErrorsByUser[row.user_id] = []
        newErrorsByUser[row.user_id].push({
          id: row.id,
          message: row.message,
          stack: row.stack,
          url: row.url,
          component: row.component,
          status: row.status,
          created_at: row.created_at,
        })
      }

      setPresenceMap(newPresenceMap)
      setProfileMap(newProfileMap)
      setErrorsByUser(newErrorsByUser)
      if (queryErrors.length > 0) {
        setError(`Some activity data could not be loaded: ${queryErrors.join('; ')}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => { void loadData() }, 30000)
    const cleanupInterval = setInterval(() => { void cleanupStaleErrors() }, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      clearInterval(cleanupInterval)
    }
  }, [loadData, cleanupStaleErrors])

  useEffect(() => {
    const totalErrors = Object.values(errorsByUser).reduce((sum, errs) => sum + errs.length, 0)
    setLiveErrorCount(totalErrors)
  }, [errorsByUser])

  useEffect(() => {
    if (liveErrorCount === 0) return
    const handler = () => {
      if (document.hidden) {
        toast.warning(`⚠️ ${liveErrorCount} active error${liveErrorCount === 1 ? '' : 's'} require attention`, {
          duration: 5000,
        })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [liveErrorCount])

  const allUsers: ActivityUser[] = useMemo(() => {
    const userIds = new Set<string>([
      ...Object.keys(presenceMap),
      ...Object.keys(profileMap),
      ...Object.keys(errorsByUser),
    ])

    const users: ActivityUser[] = []
    for (const userId of userIds) {
      const presence = presenceMap[userId]
      const profile = profileMap[userId]
      const userErrors = errorsByUser[userId] || []

      const lastSeen = presence?.last_seen_at || profile?.last_active || null
      const username = profile?.username || 'unknown'
      const displayName = profile?.display_name || profile?.username || 'Unknown User'

      users.push({
        userId,
        username,
        displayName,
        avatarUrl: profile?.avatar_url || null,
        email: profile?.email || null,
        currentPath: presence?.current_path || null,
        currentTitle: presence?.current_title || null,
        sessionId: presence?.session_id || null,
        userAgent: presence?.user_agent || null,
        lastSeenAt: lastSeen,
        lastActive: profile?.last_active || null,
        isOnline: profile?.is_online || getStatus(lastSeen) === 'active',
        errorCount: userErrors.length,
        errors: userErrors,
      })
    }

    return users.sort((a, b) => {
      const aTime = new Date(a.lastSeenAt || a.lastActive || 0).getTime()
      const bTime = new Date(b.lastSeenAt || b.lastActive || 0).getTime()
      return bTime - aTime
    })
  }, [presenceMap, profileMap, errorsByUser])

  const pathCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const user of allUsers) {
      const status = getStatus(user.lastSeenAt)
      if (status === 'offline') continue
      const path = user.currentPath || '/'
      counts[path] = (counts[path] || 0) + 1
    }
    return counts
  }, [allUsers])

  const sortedPaths = useMemo(() => {
    return Object.entries(pathCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path)
  }, [pathCounts])

  const filteredUsers = useMemo(() => {
    let users = allUsers
    if (selectedPath) {
      users = users.filter((u) => (u.currentPath || '/') === selectedPath)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      users = users.filter((u) => {
        const haystack = [
          u.username,
          u.displayName,
          u.email,
          u.userId,
          u.currentPath,
          u.currentTitle,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }
    return users
  }, [allUsers, selectedPath, searchQuery])

  const onlineUsers = useMemo(() => {
    return allUsers.filter((u) => getStatus(u.lastSeenAt) !== 'offline')
  }, [allUsers])

  const _selectedUser = expandedUserId
    ? allUsers.find((u) => u.userId === expandedUserId) || null
    : null

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Activity</h1>
            <p className="text-sm text-gray-400 mt-1">
              {onlineUsers.length} online · {allUsers.length} tracked · {sortedPaths.length} pages
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 self-start"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {liveErrorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300">
                <Bell className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">
                  {liveErrorCount} active error{liveErrorCount === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, display name, email, user ID, or page..."
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <button
            onClick={() => setSelectedPath(null)}
            className={`p-4 rounded-xl text-left transition-all border ${
              selectedPath === null
                ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/10'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <div className="text-xs text-gray-400 mb-1">All Pages</div>
            <div className="text-2xl font-bold">{onlineUsers.length}</div>
            <div className="text-xs text-gray-500 mt-1">online now</div>
          </button>
          {sortedPaths.map((path) => {
            const label = getPageLabel(path)
            const count = pathCounts[path]
            const isSelected = selectedPath === path
            return (
              <button
                key={path}
                onClick={() => setSelectedPath(path)}
                className={`p-4 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1 truncate" title={path}>
                  {label}
                </div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {count === 1 ? 'user online' : 'users online'}
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && allUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            Loading activity data...
          </div>
        ) : !loading && filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No activity found</p>
            <p className="text-sm mt-1">
              {searchQuery || selectedPath
                ? 'Try adjusting your search or filter'
                : 'No user activity has been logged yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.slice(0, 100).map((user) => {
              const status = getStatus(user.lastSeenAt)
              const isExpanded = expandedUserId === user.userId
              return (
                <div
                  key={user.userId}
                  className="bg-[#13131F] border border-[#2C2C2C] rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedUserId(isExpanded ? null : user.userId)}
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center overflow-hidden">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-purple-300">
                            {(user.displayName || user.username || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#13131F] ${
                          status === 'active'
                            ? 'bg-green-500'
                            : status === 'recent'
                            ? 'bg-yellow-500'
                            : 'bg-gray-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">
                          {user.displayName || user.username || 'Unknown'}
                        </span>
                        {user.errorCount > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            {user.errorCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        @{user.username || 'unknown'} · {user.userId.slice(0, 8)}...
                      </div>
                    </div>

                    <div className="hidden md:flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        <Monitor className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">
                          {user.currentTitle || getPageLabel(user.currentPath)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatRelative(user.lastSeenAt)}
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <UserDetailPanel
                      user={user}
                      onClose={() => setExpandedUserId(null)}
                      onDeleteError={deleteError}
                      deletingErrors={deletingErrors}
                    />
                  )}
                </div>
              )
            })}
            {filteredUsers.length > 100 && (
              <div className="text-center py-4 text-sm text-gray-400">
                Showing 100 of {filteredUsers.length} users. Refine search to see more.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function UserDetailPanel({
  user,
  onClose,
  onDeleteError,
  deletingErrors,
}: {
  user: ActivityUser
  onClose: () => void
  onDeleteError: (errorId: string) => void
  deletingErrors: Set<string>
}) {
  const status = getStatus(user.lastSeenAt)
  return (
    <div className="border-t border-[#2C2C2C] bg-black/20 p-4">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">User Details</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <DetailItem label="Username" value={user.username || 'Not logged yet'} />
        <DetailItem label="Display Name" value={user.displayName || 'Not logged yet'} />
        <DetailItem label="User ID" value={user.userId} />
        <DetailItem label="Email" value={user.email || 'Not logged yet'} />
        <DetailItem label="Current Page" value={user.currentPath || 'Not logged yet'} />
        <DetailItem label="Page Title" value={user.currentTitle || 'Not logged yet'} />
        <DetailItem label="Last Seen" value={formatTimestamp(user.lastSeenAt)} />
        <DetailItem label="Last Active" value={formatTimestamp(user.lastActive)} />
        <DetailItem label="Session ID" value={user.sessionId || 'Not logged yet'} />
        <DetailItem label="Device" value={getUserAgentSummary(user.userAgent)} />
        <DetailItem
          label="Status"
          value={
            status === 'active'
              ? 'Active'
              : status === 'recent'
              ? 'Recent'
              : 'Offline'
          }
        />
        <DetailItem label="Error Count" value={user.errorCount.toString()} />
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <Monitor className="w-4 h-4" />
          Recent Actions
        </h4>
        <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-400">
          {user.currentPath ? (
            <div className="space-y-1">
              <div>
                <span className="text-gray-500">Current path:</span>{' '}
                <span className="text-white">{user.currentPath}</span>
              </div>
              <div>
                <span className="text-gray-500">Navigated at:</span>{' '}
                <span className="text-white">{formatTimestamp(user.lastSeenAt)}</span>
              </div>
            </div>
          ) : (
            <span>Not logged yet</span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Button Clicks</h4>
        <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-400">
          Not logged yet
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Navigation Events</h4>
        <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-400">
          {user.currentPath ? (
            <div className="space-y-1">
              <div>
                <span className="text-gray-500">Last route:</span>{' '}
                <span className="text-white">{user.currentPath}</span>
              </div>
              <div>
                <span className="text-gray-500">Updated:</span>{' '}
                <span className="text-white">{formatTimestamp(user.lastSeenAt)}</span>
              </div>
            </div>
          ) : (
            <span>Not logged yet</span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Browser / Device Info</h4>
        <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-400 break-all">
          {user.userAgent || 'Not logged yet'}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Errors
        </h4>
        {user.errors.length === 0 ? (
          <div className="bg-black/30 rounded-lg p-3 text-sm text-gray-400">
            No errors found for this user/page
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {user.errors.slice(0, 10).map((err) => {
              const isDeleting = deletingErrors.has(err.id)
              return (
                <div key={err.id} className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          err.status === 'open'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-green-500/20 text-green-300'
                        }`}
                      >
                        {err.status || 'unknown'}
                      </span>
                      <span className="text-xs text-gray-400">{formatTimestamp(err.created_at)}</span>
                    </div>
                    <button
                      onClick={() => onDeleteError(err.id)}
                      disabled={isDeleting}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Delete error"
                    >
                      <Trash2 className={`w-3 h-3 ${isDeleting ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                  <div className="text-sm text-white mb-1">{err.message || 'No message'}</div>
                  {err.url && <div className="text-xs text-gray-400">URL: {err.url}</div>}
                  {err.component && (
                    <div className="text-xs text-gray-400">Component: {err.component}</div>
                  )}
                  {err.stack && (
                    <pre className="mt-2 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                      {err.stack}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-white break-all">{value}</div>
    </div>
  )
}
