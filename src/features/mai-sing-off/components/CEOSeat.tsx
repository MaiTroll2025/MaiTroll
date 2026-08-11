import { Crown, Gavel } from 'lucide-react'
import { RemoteVideoRenderer } from './RemoteVideoRenderer'
import type { SingOffUser } from '../types'

interface CEOSeatProps {
  participant?: SingOffUser
  videoTrack?: any
  canDeclare: boolean
  onMaiWinner: (challengerId: string) => void
  currentRoundChallengers: { a: string; b: string }
}

export function CEOSeat({ participant, videoTrack, canDeclare, onMaiWinner, currentRoundChallengers }: CEOSeatProps) {
  return (
    <div className="relative flex flex-col items-center w-24">
      <div className="relative aspect-square w-24 rounded-full overflow-hidden border-2 bg-gradient-to-b from-purple-500 via-violet-600 to-fuchsia-700 border-yellow-300 shadow-xl shadow-purple-500/40">
        {participant && videoTrack ? <RemoteVideoRenderer track={videoTrack} className="h-full w-full object-cover" /> : null}
        <img src={participant?.avatar_url || '/placeholder.svg'} alt={participant?.display_name} className="h-full w-full object-cover opacity-75" />
        <div className="absolute inset-0 rounded-full ring-2 ring-yellow-300" />
        <Crown className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 text-yellow-400" />
      </div>
      <span className="mt-1 text-xs font-semibold text-yellow-300">Mai (CEO)</span>
      {participant && canDeclare && (
        <div className="mt-1 flex gap-1">
          <button onClick={() => onMaiWinner(currentRoundChallengers.a)} className="rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            Winner A
          </button>
          <button onClick={() => onMaiWinner(currentRoundChallengers.b)} className="rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            Winner B
          </button>
        </div>
      )}
    </div>
  )
}
