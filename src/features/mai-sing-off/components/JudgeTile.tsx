import { Crown, Mic, User } from 'lucide-react'
import { RemoteVideoRenderer } from './RemoteVideoRenderer'
import type { SingOffUser } from '../types'

interface JudgeTileProps {
  participant?: SingOffUser
  seatIndex: 1 | 2 | 3 | 4
  isSpeaking: boolean
  isMe: boolean
}

export function JudgeTile({ participant, seatIndex, isSpeaking, isMe }: JudgeTileProps) {
  return (
    <div className="relative flex flex-col items-center w-20">
      <div className="relative aspect-square w-20 rounded-lg overflow-hidden border-2 bg-zinc-800 border-zinc-700 shadow-md">
        {participant ? (
          <RemoteVideoRenderer track={participant?.can_publish ? null : null} className="hidden" />
        ) : null}
        <img src={participant?.avatar_url || '/placeholder.svg'} alt={participant?.display_name} className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 rounded-lg ring-2 ring-cyan-400/50" />
        <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-black">
          {seatIndex}
        </div>
        {participant && <Crown className="absolute bottom-0 left-0 w-3 h-3 text-yellow-400" />}
        {!participant && <User className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />}
      </div>
      <span className="mt-0.5 block text-[9px] text-zinc-400 truncate max-w-full">
        {participant?.display_name?.split(' ')[0] ?? `Judge ${seatIndex}`}
      </span>
      {isSpeaking && <Mic className="w-2.5 h-2.5 text-cyan-400" />}
      {isMe && <span className="text-[9px] text-cyan-300">(you)</span>}
    </div>
  )
}
