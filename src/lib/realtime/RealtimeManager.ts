import { supabase } from '../supabase'
import { connectionBudget } from '../connectionBudget'

type ChannelStatus = 'subscribing' | 'subscribed' | 'error' | 'timed_out' | 'closed'

interface ChannelEntry {
  channel: ReturnType<typeof supabase.channel>
  refCount: number
  status: ChannelStatus
  subscribers: Set<string>
  createdAt: number
  lastError?: string
}

interface RealtimeManagerStats {
  created: number
  removed: number
  active: number
  leaked: number
  channels: Array<{
    name: string
    refCount: number
    status: ChannelStatus
    subscribers: number
    age: number
  }>
}

const channels = new Map<string, ChannelEntry>()
let totalCreated = 0
let totalRemoved = 0

const isDev = () => import.meta.env.DEV

function getChannelName(nameOrConfig: string | { name: string }): string {
  if (typeof nameOrConfig === 'string') return nameOrConfig
  return nameOrConfig.name || 'unknown'
}

function createChannel(name: string): ChannelEntry | null {
  if (!connectionBudget.acquire(name)) {
    console.warn(`[RealtimeManager] Connection budget full — skipping channel "${name}"`)
    return null
  }

  const channel = supabase.channel(name)

  const entry: ChannelEntry = {
    channel,
    refCount: 0,
    status: 'subscribing',
    subscribers: new Set(),
    createdAt: Date.now(),
  }

  totalCreated++
  return entry
}

function subscribeChannel(entry: ChannelEntry, name: string) {
  entry.channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      entry.status = 'subscribed'
    } else if (status === 'CHANNEL_ERROR') {
      entry.status = 'error'
      entry.lastError = 'Channel error'
    } else if (status === 'TIMED_OUT') {
      entry.status = 'timed_out'
      entry.lastError = 'Timed out'
    }
    if (isDev() && status !== 'SUBSCRIBED') {
      console.warn(`[RealtimeManager] channel "${name}" status: ${status}`)
    }
  })
}

function destroyChannel(name: string) {
  const entry = channels.get(name)
  if (!entry) return

  entry.status = 'closed'
  supabase.removeChannel(entry.channel)
  channels.delete(name)
  totalRemoved++
  connectionBudget.release(name)
}

export function subscribe(
  name: string,
  subscriberId: string,
  builder?: (channel: ReturnType<typeof supabase.channel>) => ReturnType<typeof supabase.channel>,
): () => void {
  let entry = channels.get(name)

  if (!entry) {
    entry = createChannel(name)
    if (!entry) {
      // Connection budget full — return a no-op cleanup function
      return () => {}
    }
    channels.set(name, entry)

    if (builder) {
      builder(entry.channel)
    }

    subscribeChannel(entry, name)
  }

  entry.refCount++
  entry.subscribers.add(subscriberId)

  return () => {
    const current = channels.get(name)
    if (!current) return

    current.refCount = Math.max(0, current.refCount - 1)
    current.subscribers.delete(subscriberId)

    if (current.refCount === 0) {
      destroyChannel(name)
    }
  }
}

export function subscribeWithBuilder(
  name: string,
  subscriberId: string,
  builder: (channel: ReturnType<typeof supabase.channel>) => ReturnType<typeof supabase.channel>,
): () => void {
  return subscribe(name, subscriberId, builder)
}

export function getStats(): RealtimeManagerStats {
  const now = Date.now()
  const activeChannels = Array.from(channels.entries()).map(([name, entry]) => ({
    name,
    refCount: entry.refCount,
    status: entry.status,
    subscribers: entry.subscribers.size,
    age: now - entry.createdAt,
  }))

  const leaked = activeChannels.filter(c => c.refCount === 0).length

  return {
    created: totalCreated,
    removed: totalRemoved,
    active: channels.size,
    leaked,
    channels: activeChannels,
  }
}

export function cleanup() {
  for (const name of Array.from(channels.keys())) {
    destroyChannel(name)
  }
}

export function removeChannel(name: string) {
  destroyChannel(name)
}

// --- Page-level channel helpers ---

type PageChannelType = 'home' | 'stream' | 'court' | 'pod' | 'user'

function getPageChannelName(type: PageChannelType, id?: string): string {
  switch (type) {
    case 'home': return 'page:home'
    case 'stream': return `page:stream:${id}`
    case 'court': return `page:court:${id}`
    case 'pod': return `page:pod:${id}`
    case 'user': return `page:user:${id}`
    default: return `page:${type}`
  }
}

/**
 * Subscribe to a page-level channel. If the channel already exists, reuse it.
 * Returns an unsubscribe function.
 */
export function subscribePageChannel(
  type: PageChannelType,
  subscriberId: string,
  builder?: (channel: ReturnType<typeof supabase.channel>) => ReturnType<typeof supabase.channel>,
  id?: string,
): () => void {
  const name = getPageChannelName(type, id)
  return subscribe(name, subscriberId, builder)
}

/**
 * Remove a page-level channel immediately.
 */
export function removePageChannel(type: PageChannelType, id?: string) {
  const name = getPageChannelName(type, id)
  removeChannel(name)
}

// --- Polling registry ---

interface PollingEntry {
  id: string
  label: string
  intervalMs: number
  subscriberId: string
  visibilityOnly: boolean
}

const pollingRegistry = new Map<string, PollingEntry>()

export function registerPolling(
  id: string,
  label: string,
  intervalMs: number,
  subscriberId: string,
  visibilityOnly: boolean = false,
) {
  pollingRegistry.set(id, { id, label, intervalMs, subscriberId, visibilityOnly })
}

export function unregisterPolling(id: string) {
  pollingRegistry.delete(id)
}

export function getPollingRegistry() {
  return Array.from(pollingRegistry.values())
}

// --- Channel health warnings ---

export type ChannelHealth = 'green' | 'yellow' | 'red'

export function getChannelHealth(activeCount: number): ChannelHealth {
  if (activeCount <= 3) return 'green'
  if (activeCount <= 6) return 'yellow'
  return 'red'
}

export function getPageChannelStats() {
  const stats = getStats()
  const pageChannels = stats.channels.filter(c => c.name.startsWith('page:'))
  return {
    totalPageChannels: pageChannels.length,
    channels: pageChannels,
    health: getChannelHealth(pageChannels.length),
  }
}

if (typeof window !== 'undefined' && isDev()) {
  ;(window as any).__MaiTroll_REALTIME_MANAGER__ = {
    getStats,
    cleanup,
    subscribe,
    subscribePageChannel,
    removePageChannel,
    getPageChannelStats,
    getPollingRegistry,
    registerPolling,
    unregisterPolling,
  }
}
