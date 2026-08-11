import { Play, Pause, SkipForward, Square, UserX } from 'lucide-react'
import { useSingOffStore } from '../store/useSingOffStore'
import { useSingOffActions } from '../hooks/useSingOffActions'

export function StageControls() {
  const store = useSingOffStore()
  const actions = useSingOffActions()
  const { session, currentRound, decisions, authority } = store
  const isHost = authority.is_host
  const isStaff = authority.is_staff
  const canManage = isHost || isStaff

  const yesA = decisions.filter((d) => d.decision === 'yes' && d.challenger_id === currentRound?.challenger_a_id).length
  const yesB = decisions.filter((d) => d.decision === 'yes' && d.challenger_id === currentRound?.challenger_b_id).length
  const hasMaiWinner = decisions.some((d) => d.decision === 'mai_winner')

  if (!session || !canManage) return null

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
      {session.status !== 'active' && (
        <button onClick={() => actions.startLiveShow(session.id)} className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
          <Play className="w-3 h-3" /> GO LIVE
        </button>
      )}
      {!currentRound && (
        <button onClick={() => actions.startRound()} className="flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-500">
          <SkipForward className="w-3 h-3" /> START ROUND
        </button>
      )}
      {currentRound && currentRound.status === 'active' && (
        <button
          onClick={() => actions.endRound()}
          disabled={!hasMaiWinner && (yesA < 2 && yesB < 2)}
          className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          <Pause className="w-3 h-3" /> END ROUND
        </button>
      )}
      <button
        onClick={() => actions.endLiveShow(session.id)}
        className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
      >
        <Square className="w-3 h-3" /> END SHOW
      </button>
    </div>
  )
}
