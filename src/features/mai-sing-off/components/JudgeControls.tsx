import { Check, Crown } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useSingOffStore } from '../store/useSingOffStore'
import { useSingOffActions } from '../hooks/useSingOffActions'
import { useShallow } from 'zustand/react/shallow'

export function JudgeControls() {
  const { user } = useAuthStore()
  const store = useSingOffStore(
    useShallow((s) => ({
      currentRound: s.currentRound,
      decisions: s.decisions,
      authority: s.authority,
    })),
  )
  const actions = useSingOffActions()
  const { currentRound, decisions, authority } = store
  const isJudge = authority.is_judge || authority.is_staff
  const isCeo = authority.is_ceo

  if (!currentRound || currentRound.status !== 'active' || !isJudge || !user) return null

  const myYes = decisions.find((d) => d.judge_id === user.id && d.decision === 'yes')
  const voted = !!myYes

  const vote = (challengerId: string) => {
    if (voted) return
    actions.submitDecision(challengerId, 'yes')
  }

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-xl bg-zinc-900/80 border border-zinc-700 px-4 py-2">
      <span className="text-xs font-semibold text-zinc-300">Judge your round:</span>
      <button
        onClick={() => vote(currentRound.challenger_a_id as string)}
        disabled={voted}
        className="flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
      >
        <Check className="w-3 h-3" /> Challenger A — Yes
      </button>
      <button
        onClick={() => vote(currentRound.challenger_b_id as string)}
        disabled={voted}
        className="flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
      >
        <Check className="w-3 h-3" /> Challenger B — Yes
      </button>
      {voted && (
        <span className="text-xs text-cyan-300">
          You voted for {myYes?.challenger_id === currentRound.challenger_a_id ? 'A' : 'B'} ✓
        </span>
      )}
      {isCeo && (
        <>
          <button
            onClick={() => actions.submitDecision(currentRound.challenger_a_id as string, 'yes', true)}
            className="flex items-center gap-1 rounded-md bg-yellow-400 px-3 py-1 text-xs font-bold text-black hover:bg-yellow-300"
          >
            <Crown className="w-3 h-3" /> Mai Winner A
          </button>
          <button
            onClick={() => actions.submitDecision(currentRound.challenger_b_id as string, 'yes', true)}
            className="flex items-center gap-1 rounded-md bg-yellow-400 px-3 py-1 text-xs font-bold text-black hover:bg-yellow-300"
          >
            <Crown className="w-3 h-3" /> Mai Winner B
          </button>
        </>
      )}
    </div>
  )
}
