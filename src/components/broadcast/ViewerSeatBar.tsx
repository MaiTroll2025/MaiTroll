import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000

function getKickStorageKey(streamId: string, userId: string) {
  return `kick_${streamId}_${userId}`
}

function isKickBanActive(kickData: any) {
  if (!kickData || typeof kickData.timestamp !== 'number') return false
  return Date.now() - kickData.timestamp < KICK_BAN_DURATION_MS
}

export type ViewerSeatBarProps = {
  streamId?: string
  boxCount?: number
  stream?: any
  areSeatsLocked?: boolean
  onJoinSeat: (index: number, price: number) => Promise<boolean> | boolean
}

export default function ViewerSeatBar({ streamId, boxCount, stream, areSeatsLocked, onJoinSeat }: ViewerSeatBarProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const seats = useMemo(() => {
    const maxSeats = Math.max(0, Number(boxCount ?? stream?.box_count ?? 0))
    return Array.from({ length: maxSeats }, (_, i) => i)
  }, [boxCount, stream?.box_count])

  const handleJoin = useCallback(
    async (seatIndex: number) => {
      if (!streamId) return

      // Check if user is kicked from this stream
      if (user?.id) {
        const kickKey = getKickStorageKey(streamId, user.id)
        const kickRaw = localStorage.getItem(kickKey)
        if (kickRaw) {
          try {
            const kickData = JSON.parse(kickRaw)
            if (isKickBanActive(kickData)) {
              const timeSinceKick = Date.now() - kickData.timestamp
              const remainingMs = Math.max(KICK_BAN_DURATION_MS - timeSinceKick, 0)
              const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
              toast.error(
                `You were kicked from this broadcast and cannot rejoin for ${hoursRemaining} hour${
                  hoursRemaining === 1 ? '' : 's'
                }.`
              )
              return
            }
          } catch (e) {
            console.warn('Error parsing kick data:', e)
          }
        }
      }

      if (areSeatsLocked) {
        toast.error('Seats are currently locked')
        return
      }

      const ok = await Promise.resolve(onJoinSeat(seatIndex, 0))
      if (!ok) return

      navigate(`/broadcast/${streamId}?seat=${seatIndex + 1}&mode=seat`)
    },
    [areSeatsLocked, navigate, onJoinSeat, streamId, user?.id]
  )

  if (!streamId) return null

  return (
    <div className="w-full px-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {seats.map((seatIndex) => {
          const locked = areSeatsLocked

          return (
            <button
              key={seatIndex}
              type="button"
              onClick={() => void handleJoin(seatIndex)}
              disabled={locked}
              className={cn(
                'flex items-center justify-center rounded-full border px-3 py-2 text-xs font-black uppercase tracking-wide shadow-sm backdrop-blur',
                locked
                  ? 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                  : 'border-yellow-400/35 bg-black/55 text-yellow-100 hover:bg-black/70'
              )}
              title={`Join seat ${seatIndex + 1}`}
            >
              {seatIndex + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
