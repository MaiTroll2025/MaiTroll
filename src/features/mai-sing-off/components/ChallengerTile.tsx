import { Video, Send, Coins, Crown } from 'lucide-react'
import type { SingOffUser } from '../types'
import type { GiftItem } from '@/lib/giftConstants'
import { RemoteVideoRenderer } from './RemoteVideoRenderer'

interface ChallengerTileProps {
  participant?: SingOffUser
  videoTrack?: any
  position: 'challenger_a' | 'challenger_b'
  countdown?: number | null
  isHost: boolean
  onGift?: (gift: GiftItem) => void
  onKick?: () => void
}

export function ChallengerTile({ participant, videoTrack, position, countdown, isHost, onGift, onKick }: ChallengerTileProps) {
  const label = position === 'challenger_a' ? 'CHALLENGER' : 'CHALLENGER'
  const hasVideo = !!participant?.can_publish && !!videoTrack
  return (
    <div className="relative flex flex-col items-center w-48">
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 bg-zinc-900 border-zinc-700 shadow-xl">
        {hasVideo ? (
          <RemoteVideoRenderer track={videoTrack} className="h-full w-full object-cover" />
        ) : (
          <>
            <img src={participant?.avatar_url || '/placeholder.svg'} alt={participant?.display_name} className="h-full w-full object-cover opacity-60" />
            <Video className="absolute top-2 right-2 w-4 h-4 text-zinc-400" />
          </>
        )}
        {participant && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">{participant.display_name}</span>
              {participant.role === 'challenger' && <Crown className="w-3 h-3 text-yellow-400" />}
            </div>
            <div className="text-[10px] text-zinc-300">Level {participant.level} · {participant.troll_coins.toLocaleString()} 🪙</div>
          </div>
        )}

        {countdown !== null && countdown !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-4xl font-extrabold text-yellow-400 drop-shadow">{countdown}</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-center">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</div>
        {participant && isHost && (
          <button
            onClick={onGift?.bind(null, { id: 'gift', name: 'Gift', cost: 0 } as GiftItem)}
            className="mt-1 flex items-center gap-1 rounded-md bg-pink-600/20 px-2 py-0.5 text-xs text-pink-300 hover:bg-pink-600/30"
          >
            <Send className="w-3 h-3" /> Send Gift
          </button>
        )}
        {participant && isHost && onKick && (
          <button onClick={onKick} className="mt-0.5 text-[10px] text-red-400 hover:text-red-300">Remove</button>
        )}
      </div>
    </div>
  )
}
