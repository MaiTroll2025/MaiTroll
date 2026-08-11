import { useEffect, useState } from 'react'
import { BarChart3, Trophy, Users, Vote } from 'lucide-react'
import { useSingOffStore } from '../store/useSingOffStore'
import { useShallow } from 'zustand/react/shallow'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { SingOffStats } from '../types'

export function StatisticsView() {
  const actions = useSingOffActions()
  const store = useSingOffStore(
    useShallow((s) => ({
      rounds: s.rounds,
      decisions: s.decisions,
      currentRound: s.currentRound,
      authority: s.authority,
      participants: s.participants,
    })),
  )
  const [stats, setStats] = useState<SingOffStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    actions.loadStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  const judgesThisRound = store.currentRound
    ? store.decisions.filter((d) => d.round_id === store.currentRound?.id && d.decision === 'yes').length
    : 0
  const totalJudges = store.participants.filter((p) => ['judge', 'host_judge', 'ceo_judge'].includes(p.role) && p.position).length

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-cyan-400" /> Mai Sing Off Stats
      </h2>

      {loading && <div className="text-zinc-400">Loading stats…</div>}

      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.total_shows}</div>
            <div className="text-xs text-zinc-400">Shows hosted</div>
          </div>
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.active_shows}</div>
            <div className="text-xs text-zinc-400">Active shows</div>
          </div>
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.my_wins}</div>
            <div className="text-xs text-zinc-400">Your wins</div>
          </div>
          <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.my_judged}</div>
            <div className="text-xs text-zinc-400">Rounds judged</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-zinc-400">No stats available yet.</div>
      )}

      {store.currentRound && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-sm font-semibold text-white mb-1">
            Round {store.currentRound.round_number} — live vote
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Vote className="w-3 h-3 text-cyan-400" />
            {judgesThisRound} of {totalJudges} judges have voted Yes so far.
          </div>
        </div>
      )}

      {stats?.top_winners?.length ? (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-400" /> Top winners
          </div>
          {stats.top_winners.map((w) => (
            <div key={w.user_id} className="flex items-center justify-between rounded-md bg-zinc-800/40 px-2 py-1 text-xs">
              <span className="text-zinc-300">• {w.user_id.slice(0, 8)}</span>
              <span className="text-yellow-400">{w.wins} wins</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
