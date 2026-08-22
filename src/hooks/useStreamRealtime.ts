import { useEffect, useRef } from 'react'
import { subscribeToStreamRealtime, StreamRealtimeEvent } from '../lib/realtime/streamRealtimeManager'

interface UseStreamRealtimeHandlers {
  onStream?: (event: StreamRealtimeEvent) => void
  onMessage?: (event: StreamRealtimeEvent) => void
  onGift?: (event: StreamRealtimeEvent) => void
  onParticipant?: (event: StreamRealtimeEvent) => void
  onBattle?: (event: StreamRealtimeEvent) => void
  onAudiencePresence?: (event: StreamRealtimeEvent) => void
  onSeatSession?: (event: StreamRealtimeEvent) => void
  onSeatEvent?: (event: StreamRealtimeEvent) => void
  onFloatingChat?: (event: StreamRealtimeEvent) => void
  onPresenceBroadcast?: (event: StreamRealtimeEvent) => void
  onLeagueLevelUp?: (event: StreamRealtimeEvent) => void
}

export function useStreamRealtime(streamId?: string | null, handlers: UseStreamRealtimeHandlers = {}, battleId?: string | null) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!streamId) return

    return subscribeToStreamRealtime(streamId, (event) => {
      const current = handlersRef.current
      switch (event.table) {
        case 'streams':
          current.onStream?.(event)
          break
        case 'stream_messages':
          current.onMessage?.(event)
          break
        case 'stream_gifts':
        case 'broadcast:gift_sent':
          current.onGift?.(event)
          break
        case 'stream_participants':
          current.onParticipant?.(event)
          break
        case 'battle_sessions':
          current.onBattle?.(event)
          break
        case 'stream_audience_presence':
          current.onAudiencePresence?.(event)
          break
        case 'stream_seat_sessions':
          current.onSeatSession?.(event)
          break
        case 'broadcast:floating_chat':
          current.onFloatingChat?.(event)
          break
        case 'broadcast:seat_joined':
        case 'broadcast:seat_live':
        case 'broadcast:seat_left':
        case 'broadcast:seat_refreshed':
          current.onSeatEvent?.(event)
          break
        case 'broadcast:like_sent':
          current.onPresenceBroadcast?.(event)
          break
        case 'broadcast:box_count_changed':
        case 'broadcast:ping':
        case 'broadcast:league_level_up':
          current.onLeagueLevelUp?.(event)
          break
      }
    }, battleId)
  }, [streamId, battleId])
}
