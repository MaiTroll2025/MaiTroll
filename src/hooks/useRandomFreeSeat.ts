import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { MAX_GUEST_SEATS } from '@/config/broadcastCategories'

const ACTIVE_SEAT_STATUSES = new Set(['reserved', 'camera_starting', 'active', 'live'])

interface RandomSeatTarget {
  streamId: string
  seatIndex: number
}

export function useRandomFreeSeat(
  userId: string | undefined,
  navigate: (path: string) => void,
) {
  const [joiningRandomSeat, setJoiningRandomSeat] = useState(false)

  const joinRandomFreeSeat = useCallback(async () => {
    if (!userId) {
      toast.info('Sign in to join a broadcast seat.')
      navigate('/auth')
      return
    }

    setJoiningRandomSeat(true)
    try {
      const { data: streams, error: streamsError } = await supabase
        .from('streams')
        .select('id, seat_count, box_count, seat_price, seat_prices, are_seats_locked, stream_type')
        .eq('is_live', true)
        .limit(100)

      if (streamsError) throw streamsError

      const liveStreams = (streams || []).filter((stream) =>
        !stream.are_seats_locked && stream.stream_type !== 'celeb_stream',
      )

      const availableTargets = (
        await Promise.all(
          liveStreams.map(async (stream) => {
            const { data: seatRows, error: seatsError } = await supabase.rpc('get_stream_seats', {
              p_stream_id: stream.id,
            })

            if (seatsError) throw seatsError

            const configuredGuestSeatsRaw = stream.seat_count != null
              ? Number(stream.seat_count)
              : stream.box_count != null
                ? Number(stream.box_count) - 1
                : Array.isArray(stream.seat_prices)
                  ? stream.seat_prices.length - 1
                  : 0
            const configuredGuestSeats = Number.isFinite(configuredGuestSeatsRaw)
              ? Math.max(0, Math.min(MAX_GUEST_SEATS, configuredGuestSeatsRaw))
              : 0
            if (configuredGuestSeats <= 0) return []

            const occupiedSeats = new Set(
              (seatRows || [])
                .filter((seat: { status?: string | null; user_id?: string | null; guest_id?: string | null }) =>
                  ACTIVE_SEAT_STATUSES.has(String(seat.status || '').trim().toLowerCase()) &&
                  Boolean(seat.user_id || seat.guest_id),
                )
                .map((seat: { seat_index: number }) => Number(seat.seat_index)),
            )

            const available: RandomSeatTarget[] = []
            for (let seatIndex = 1; seatIndex <= configuredGuestSeats; seatIndex += 1) {
              if (occupiedSeats.has(seatIndex)) continue

              const configuredPrice = Array.isArray(stream.seat_prices)
                ? Number(stream.seat_prices[seatIndex])
                : Number.NaN
              const basePrice = Number(stream.seat_price)
              const price = Number.isFinite(configuredPrice)
                ? configuredPrice
                : Number.isFinite(basePrice) ? basePrice : 0

              if (price === 0) available.push({ streamId: stream.id, seatIndex })
            }
            return available
          }),
        )
      ).flat()

      if (availableTargets.length === 0) {
        toast.info('No free open broadcast seats are available right now.')
        return
      }

      const target = availableTargets[Math.floor(Math.random() * availableTargets.length)]
      navigate(`/watch/${target.streamId}?joinSeat=${target.seatIndex}`)
    } catch (error) {
      console.error('[useRandomFreeSeat] Failed to find a free broadcast seat:', error)
      toast.error('Unable to find a free broadcast seat right now.')
    } finally {
      setJoiningRandomSeat(false)
    }
  }, [navigate, userId])

  return { joinRandomFreeSeat, joiningRandomSeat }
}
