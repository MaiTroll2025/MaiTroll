import { Users, Check, X, Crown, Gavel, ClipboardCheck } from 'lucide-react'
import { useSingOffStore } from '../store/useSingOffStore'
import { useShallow } from 'zustand/react/shallow'

export function JudgeManagementPanel() {
  const store = useSingOffStore(
    useShallow((s) => ({
      participants: s.participants,
      currentRound: s.currentRound,
      decisions: s.decisions,
      authority: s.authority,
    })),
  )
  const judges = store.participants.filter((p) => ['judge', 'host_judge', 'ceo_judge'].includes(p.role) && p.position)

  if (!store.currentRound) {
    return (
      <div className="h-full p-4 text-sm text-zinc-400">No active round.</div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Gavel className="w-5 h-5 text-cyan-400" /> Judges
      </h2>
      <div className="space-y-2">
        {judges.map((j) => {
          const votes = store.decisions
            .filter((d) => d.judge_id === j.user_id && d.round_id === store.currentRound!.id)
            .map((d) => `${d.decision === 'yes' ? '✅ Yes' : d.decision === 'no' ? '❌ No' : '👑 Mai Winner'} — ${d.challenger_id.slice(0, 6)}`)
          return (
            <div key={j.user_id} className="flex items-center justify-between rounded-md bg-zinc-800/50 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <img src={j.avatar_url || '/placeholder.svg'} alt={j.display_name} className="h-6 w-6 rounded-full" />
                <span className="text-sm text-white">{j.display_name} <span className="text-xs text-zinc-400">({j.position})</span></span>
              </div>
              {votes.length ? <span className="text-xs text-cyan-300">{votes.join('; ')}</span> : <span className="text-xs text-zinc-500">pending</span>}
            </div>
          )
        })}
      </div>
      {store.authority.is_staff && (
        <div className="rounded-md bg-zinc-800/30 p-2 text-xs text-zinc-300">
          <ClipboardCheck className="w-3 h-3 inline mr-1" /> {store.authority.is_host ? 'Host' : 'Staff'} managing judges. Use the staff tab to approve applications.
        </div>
      )}
    </div>
  )
}
