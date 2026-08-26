import { supabase } from '../supabase'

type StreamRealtimeTable =
  | 'streams'
  | 'stream_messages'
  | 'stream_gifts'
  | 'stream_participants'
  | 'battle_sessions'
  | 'stream_seat_sessions'
  | 'stream_audience_presence'
  | 'broadcast:floating_chat'
  | 'broadcast:seat_joined'
  | 'broadcast:seat_live'
  | 'broadcast:seat_left'
  | 'broadcast:seat_refreshed'
  | 'broadcast:box_count_changed'
  | 'broadcast:like_sent'
  | 'broadcast:gift_sent'
  | 'broadcast:ping'
  | 'broadcast:league_level_up'

type StreamRealtimeStatus = 'idle' | 'subscribing' | 'subscribed' | 'error' | 'closed'

export interface StreamRealtimeEvent {
  table: StreamRealtimeTable
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*' | 'BROADCAST'
  new: any
  old: any
  raw: any
}

type StreamRealtimeHandler = (event: StreamRealtimeEvent) => void

interface StreamEntry {
  streamId: string
  battleId?: string | null
  channel: ReturnType<typeof supabase.channel>
  handlers: Set<StreamRealtimeHandler>
  status: StreamRealtimeStatus
  eventCounts: Record<string, number>
}

const entries = new Map<string, StreamEntry>()

const isDev = () => process.env.NODE_ENV !== 'production'

function emit(entry: StreamEntry, table: StreamRealtimeTable, payload: any) {
  const eventType = payload.eventType || '*'
  const key = `${table}:${eventType}`
  entry.eventCounts[key] = (entry.eventCounts[key] || 0) + 1
  const event: StreamRealtimeEvent = {
    table,
    eventType,
    new: payload.new,
    old: payload.old,
    raw: payload,
  }
  entry.handlers.forEach((handler) => {
    try {
      handler(event)
    } catch (error) {
      if (isDev()) console.warn('[streamRealtimeManager] handler failed', error)
    }
  })
}

function emitBroadcast(entry: StreamEntry, eventName: string, payload: any) {
  const key = `broadcast:${eventName}`
  entry.eventCounts[key] = (entry.eventCounts[key] || 0) + 1
  const event: StreamRealtimeEvent = {
    table: `broadcast:${eventName}` as any,
    eventType: 'BROADCAST',
    new: payload,
    old: null,
    raw: payload,
  }
  entry.handlers.forEach((handler) => {
    try {
      handler(event)
    } catch (error) {
      if (isDev()) console.warn('[streamRealtimeManager] broadcast handler failed', error)
    }
  })
}

function createEntry(streamId: string, battleId?: string | null): StreamEntry {
  if (isDev()) console.debug('[streamRealtimeManager] resolved streamId', { streamId, battleId })
  const entry: StreamEntry = {
    streamId,
    battleId,
    channel: null as unknown as ReturnType<typeof supabase.channel>,
    handlers: new Set<StreamRealtimeHandler>(),
    status: 'subscribing' as StreamRealtimeStatus,
    eventCounts: {},
  }

  const channel = supabase
    .channel(`stream-realtime:${streamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `id=eq.${streamId}` }, (payload) => emit(entry, 'streams', payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_messages', filter: `stream_id=eq.${streamId}` }, (payload) => {
      if (isDev()) console.debug('[streamRealtimeManager] stream_messages INSERT payload.new', { streamId, new: payload.new })
      emit(entry, 'stream_messages', payload)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_gifts', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_gifts', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_participants', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_participants', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_seat_sessions', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_seat_sessions', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_audience_presence', filter: `stream_id=eq.${streamId}` }, (payload) => emit(entry, 'stream_audience_presence', payload))
    .on('broadcast', { event: 'floating_chat' }, (message) => emitBroadcast(entry, 'floating_chat', message.payload))
    .on('broadcast', { event: 'seat_joined' }, (message) => emitBroadcast(entry, 'seat_joined', message.payload))
    .on('broadcast', { event: 'seat_live' }, (message) => emitBroadcast(entry, 'seat_live', message.payload))
    .on('broadcast', { event: 'seat_left' }, (message) => emitBroadcast(entry, 'seat_left', message.payload))
    .on('broadcast', { event: 'seat_refreshed' }, (message) => emitBroadcast(entry, 'seat_refreshed', message.payload))
    .on('broadcast', { event: 'box_count_changed' }, (message) => emitBroadcast(entry, 'box_count_changed', message.payload))
    .on('broadcast', { event: 'like_sent' }, (message) => emitBroadcast(entry, 'like_sent', message.payload))
    .on('broadcast', { event: 'gift_sent' }, (message) => emitBroadcast(entry, 'gift_sent', message.payload))
    .on('broadcast', { event: 'ping' }, (message) => emitBroadcast(entry, 'ping', message.payload))
    .on('broadcast', { event: 'league_level_up' }, (message) => emitBroadcast(entry, 'league_level_up', message.payload))

  entry.channel = channel

  if (battleId) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'battle_sessions', filter: `id=eq.${battleId}` }, (payload) => emit(entry, 'battle_sessions', payload))
  }

  channel.subscribe((status) => {
    entry.status = status === 'SUBSCRIBED' ? 'subscribed' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : entry.status
    if (isDev()) console.debug('[streamRealtimeManager] channel status', { streamId, battleId, status })
  })

  return entry
}

export function subscribeToStreamRealtime(
  streamId: string,
  handler: StreamRealtimeHandler,
  battleId?: string | null
) {
  const key = streamId
  let entry = entries.get(key)
  if (!entry) {
    entry = createEntry(streamId, battleId)
    entries.set(key, entry)
  } else if (battleId && entry.battleId !== battleId) {
    const oldChannel = entry.channel
    if (entry.handlers.size === 0) {
      supabase.removeChannel(oldChannel)
    }
    entry = createEntry(streamId, battleId)
    entries.set(key, entry)
  } else if (battleId && !entry.battleId) {
    entry.battleId = battleId
    entry.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'battle_sessions', filter: `id=eq.${battleId}` },
      (payload) => emit(entry, 'battle_sessions', payload)
    )
  }

  entry.handlers.add(handler)

  return () => {
    const current = entries.get(key)
    if (!current) return

    current.handlers.delete(handler)
    if (current.handlers.size === 0) {
      current.status = 'closed'
      if (isDev()) console.debug('[streamRealtimeManager] channel cleanup', { streamId, battleId: current.battleId, remainingHandlers: current.handlers.size })
      supabase.removeChannel(current.channel)
      entries.delete(key)
    }
  }
}

export function sendStreamBroadcast(streamId: string, event: string, payload: Record<string, any>) {
  const entry = entries.get(streamId)
  if (!entry) return
  entry.channel.send({
    type: 'broadcast',
    event,
    payload,
  }).catch(() => {})
}

export function getStreamRealtimeDebugState() {
  return Array.from(entries.values()).map((entry) => ({
    streamId: entry.streamId,
    battleId: entry.battleId || null,
    status: entry.status,
    handlers: entry.handlers.size,
    tables: entry.battleId
      ? ['streams', 'stream_messages', 'stream_gifts', 'stream_participants', 'stream_seat_sessions', 'stream_audience_presence', 'battle_sessions']
      : ['streams', 'stream_messages', 'stream_gifts', 'stream_participants', 'stream_seat_sessions', 'stream_audience_presence'],
    eventCounts: { ...entry.eventCounts },
  }))
}

if (typeof window !== 'undefined' && isDev()) {
  ;(window as any).__MaiTroll_STREAM_REALTIME__ = {
    getState: getStreamRealtimeDebugState,
  }
}
