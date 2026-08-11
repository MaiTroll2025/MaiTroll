import { Mic, PauseCircle } from 'lucide-react'

interface MicStandProps {
  live: boolean
  muted: boolean
}

export function MicStand({ live, muted }: MicStandProps) {
  return (
    <div className="absolute bottom-[-18px] left-1/2 -translate-x-1/2 z-20">
      <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-b from-yellow-400 via-yellow-500 to-amber-600 shadow-xl shadow-yellow-500/50 border-2 border-black">
        {live && !muted ? (
          <div className="absolute -inset-1 rounded-full bg-yellow-300 animate-ping opacity-60" />
        ) : null}
        {muted ? <PauseCircle className="w-6 h-6 text-black" /> : <Mic className="w-6 h-6 text-black" />}
      </div>
    </div>
  )
}
