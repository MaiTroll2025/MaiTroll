import { useEffect, useState } from 'react'
import {
  BarChart3,
  Crown,
  Gavel,
  Mic2,
  ShieldOff,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { ActiveRolesList, SingOffStats } from '../types'

export function StatisticsLobby() {
  const { profile } = useAuthStore()
  const actions = useSingOffActions()

  const isStaff = !!profile && (profile.is_ceo || profile.is_admin || profile.role === 'ceo' || profile.role === 'admin')

  const [stats, setStats] = useState<SingOffStats | null>(null)
  const [activeRoles, setActiveRoles] = useState<ActiveRolesList>({ judges: [], hosts: [] })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, roles] = await Promise.all([
      actions.loadStats(),
      isStaff ? actions.listActiveRoles() : Promise.resolve({ judges: [], hosts: [] }),
    ])
    setStats(s)
    setActiveRoles(roles)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRelease = async (targetUserId: string, role: 'judge' | 'host') => {
    if (!window.confirm(`Release this ${role}? Their access is revoked immediately.`)) return
    const res = await actions.releaseRole(targetUserId, role)
    if (res.success) {
      toast.success(`${role === 'judge' ? 'Judge' : 'Host'} released.`)
      void load()
    } else {
      toast.error(res.error || 'Could not release role.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/40 via-black to-teal-950/30 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(16,185,129,.35), transparent 35%), radial-gradient(circle at 80% 40%, rgba(45,212,191,.3), transparent 35%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black">
              STATISTICS <span className="text-emerald-400">AND</span> CONTROL
            </h2>
            <p className="text-sm text-white/50">Platform performance and {isStaff ? 'staff control center.' : 'your personal record.'}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-white/40">Loading...</p>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-center">
              <Crown className="mx-auto h-5 w-5 text-yellow-400" />
              <div className="mt-2 text-2xl font-black text-white">{stats?.total_shows ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Shows</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-cyan-400" />
              <div className="mt-2 text-2xl font-black text-white">{stats?.active_shows ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Active Shows</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-center">
              <Trophy className="mx-auto h-5 w-5 text-yellow-400" />
              <div className="mt-2 text-2xl font-black text-white">{stats?.my_wins ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Your Wins</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-center">
              <Gavel className="mx-auto h-5 w-5 text-purple-400" />
              <div className="mt-2 text-2xl font-black text-white">{stats?.my_judged ?? 0}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Rounds Judged</div>
            </div>
          </div>

          {/* Top winners */}
          {stats?.top_winners && stats.top_winners.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/50">
                <Trophy className="h-3.5 w-3.5 text-yellow-400" /> Top Winners
              </h3>
              <div className="space-y-1.5">
                {stats.top_winners.map((w, i) => (
                  <div key={w.user_id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-white/70">
                      <span className="font-black text-white/40">{i + 1}.</span>
                      {w.user_id.slice(0, 8)}
                    </span>
                    <span className="font-black text-yellow-400">{w.wins} wins</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff control center */}
          {isStaff && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/50">
                <ShieldOff className="h-3.5 w-3.5 text-red-400" /> Staff Control — Active Roles
              </h3>

              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/40">
                  <Gavel className="h-3 w-3 text-purple-400" /> Judges ({activeRoles.judges.length})
                </div>
                {activeRoles.judges.length === 0 ? (
                  <p className="text-xs text-white/30">No active judges.</p>
                ) : (
                  activeRoles.judges.map((j) => (
                    <div key={j.user_id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-sm text-white/70">{j.display_name || `@${j.user_id.slice(0, 8)}`}</span>
                      <button
                        type="button"
                        onClick={() => handleRelease(j.user_id, 'judge')}
                        className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/10"
                      >
                        <ShieldOff className="h-3 w-3" />
                        Release
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/40">
                  <Mic2 className="h-3 w-3 text-cyan-400" /> Hosts ({activeRoles.hosts.length})
                </div>
                {activeRoles.hosts.length === 0 ? (
                  <p className="text-xs text-white/30">No active hosts.</p>
                ) : (
                  activeRoles.hosts.map((h) => (
                    <div key={h.user_id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <span className="text-sm text-white/70">{h.display_name || `@${h.user_id.slice(0, 8)}`}</span>
                      <button
                        type="button"
                        onClick={() => handleRelease(h.user_id, 'host')}
                        className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/10"
                      >
                        <ShieldOff className="h-3 w-3" />
                        Release
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
