import { useCallback, useEffect, useState } from 'react'
import { Radio, RefreshCw, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { usePresenceStore } from '@/lib/presenceStore'

const MAIUSER_OPEN_EVENT = 'maiuser-monitor:open'

interface PublicUser {
  id: string
  username: string | null
  avatar_url: string | null
}

function formatCompactCount(value: number | null): string {
  if (value === null) return '—'
  if (value < 1000) return String(value)
  const units = ['k', 'm', 'b']
  let scaled = value
  let unitIndex = -1
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000
    unitIndex += 1
  }
  const rounded = Math.round(scaled * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${units[unitIndex]}`
}

export default function MaiUserMonitor() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds)
  const totalUserCount = usePresenceStore((state) => state.totalUserCount)
  const [isOpen, setIsOpen] = useState(false)
  const [users, setUsers] = useState<PublicUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    setError(null)
    try {
      const ids = Array.from(usePresenceStore.getState().onlineUserIds)
      if (ids.length === 0) {
        setUsers([])
        return
      }

      const { data, error: queryError } = await supabase
        .from('user_profiles_public_identity')
        .select('id, username, avatar_url')
        .in('id', ids)

      if (queryError) throw queryError
      const onlineSet = new Set(ids)
      setUsers(((data || []) as PublicUser[]).filter((entry) => onlineSet.has(entry.id)))
    } catch (loadError) {
      console.error('[MaiUser Monitor] Error loading users:', loadError)
      setError('Unable to load online users.')
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    const handleOpen = () => {
      if (!user?.id) return
      setIsOpen(true)
      void loadUsers()
    }
    window.addEventListener(MAIUSER_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(MAIUSER_OPEN_EVENT, handleOpen)
  }, [loadUsers, user?.id])

  useEffect(() => {
    if (isOpen) void loadUsers()
  }, [isOpen, onlineUserIds, loadUsers])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-end bg-black/30 p-3 sm:p-5" onClick={(event) => {
      if (event.target === event.currentTarget) setIsOpen(false)
    }}>
      <section className="flex max-h-[min(78vh,560px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0A0814] text-white shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-100">
              <Radio className="h-4 w-4" /> MaiUser
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Online {formatCompactCount(onlineUserIds.size)} <span className="mx-1 text-slate-600">|</span> All {formatCompactCount(totalUserCount)}
            </div>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close MaiUser">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading users...</div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-rose-300">{error}</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-xs text-slate-400"><Users className="h-5 w-5" /> No users are currently online.</div>
          ) : (
            <div className="space-y-1.5">
              {users.map((entry, index) => {
                const isGhost = entry.username === 'xxxxx'
                return (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                    {entry.avatar_url ? <img src={entry.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-cyan-400/20" />}
                    {isGhost ? (
                      <span className="text-sm font-semibold text-slate-400">
                        MaiUser {users.slice(0, index + 1).filter((candidate) => candidate.username === 'xxxxx').length}
                      </span>
                    ) : (
                      <button type="button" onClick={() => { setIsOpen(false); navigate(`/profile/${entry.username}`) }} className="truncate text-left text-sm font-semibold text-cyan-100 hover:text-cyan-300">
                        @{entry.username || 'User'}
                      </button>
                    )}
                    <span className="ml-auto h-2 w-2 rounded-full bg-emerald-300" aria-label="Online" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
