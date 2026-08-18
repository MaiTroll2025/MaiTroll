import { supabase } from './supabase'

type BatchOperation = () => Promise<void>

interface BatchConfig {
  /** Max time between flushes (ms) */
  flushIntervalMs: number
  /** Max operations before forced flush */
  maxBatchSize: number
}

const DEFAULT_CONFIG: BatchConfig = {
  flushIntervalMs: 5_000, // 5 seconds — reduced from 60s to prevent data loss
  maxBatchSize: 50,
}

/**
 * Creates a batched write collector.
 * Operations are queued and flushed on interval or before page unload.
 */
export function createBatchWriter(config: Partial<BatchConfig> = {}) {
  const { flushIntervalMs, maxBatchSize } = { ...DEFAULT_CONFIG, ...config }
  const queue: BatchOperation[] = []
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let flushing = false

  async function flush() {
    if (flushing || queue.length === 0) return
    flushing = true

    const ops = spliceQueue()
    for (const op of ops) {
      try {
        await op()
      } catch (error) {
        console.warn('[batchWrite] operation failed', error)
      }
    }

    flushing = false
  }

  function spliceQueue(): BatchOperation[] {
    const ops = queue.splice(0, maxBatchSize)
    return ops
  }

  function enqueue(op: BatchOperation) {
    queue.push(op)

    if (queue.length >= maxBatchSize) {
      flush()
    }
  }

  function start() {
    if (flushTimer) return
    flushTimer = setInterval(flush, flushIntervalMs)

    // Flush before page unload and on tab hide
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  function stop() {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    window.removeEventListener('beforeunload', flush)
    document.removeEventListener('visibilitychange', flush)
  }

  return { enqueue, flush, start, stop, getQueueSize: () => queue.length }
}

// --- city_ads batching (aggregated per ad) ---

const adImpressionCounts = new Map<number, number>()
const adClickCounts = new Map<number, number>()
let cityAdsFlushTimer: ReturnType<typeof setInterval> | null = null

async function flushCityAds() {
  if (adImpressionCounts.size === 0 && adClickCounts.size === 0) return

  // Fire-and-forget: send aggregated counts per ad
  for (const [adId, count] of adImpressionCounts.entries()) {
    const { error } = await supabase.rpc('increment_ad_impressions', { ad_id: adId, count })
    if (error) {
      const msg = typeof error === 'string' ? error : error?.message || ''
      if (msg.includes('not found', true)) {
        adImpressionCounts.delete(adId)
        continue
      }
      console.warn('[cityAds] impression flush failed', error)
    }
  }
  for (const [adId, count] of adClickCounts.entries()) {
    const { error } = await supabase.rpc('increment_ad_clicks', { ad_id: adId, count })
    if (error) {
      const msg = typeof error === 'string' ? error : error?.message || ''
      if (msg.includes('not found', true)) {
        adClickCounts.delete(adId)
        continue
      }
      console.warn('[cityAds] click flush failed', error)
    }
  }
}

function startCityAdsFlush() {
  if (cityAdsFlushTimer) return
  cityAdsFlushTimer = setInterval(flushCityAds, 60_000)
  window.addEventListener('beforeunload', flushCityAds)
}

/**
 * Record a city ad impression. Counts are aggregated per ad ID and flushed
 * every 60s or before unload. 50,000 impressions → ~100 writes instead of 50,000.
 */
export function queueCityAdImpression(adId: number) {
  adImpressionCounts.set(adId, (adImpressionCounts.get(adId) || 0) + 1)
  startCityAdsFlush()
}

/**
 * Record a city ad click. Counts are aggregated per ad ID and flushed
 * every 60s or before unload.
 */
export function queueCityAdClick(adId: number) {
  adClickCounts.set(adId, (adClickCounts.get(adId) || 0) + 1)
  startCityAdsFlush()
}

/**
 * Flush all pending city ad writes immediately.
 */
export function flushCityAdsNow() {
  flushCityAds()
}

// --- app_bug_reports dedup ---

const reportedErrors = new Map<string, number>()
const DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

function getDedupKey(type: string, message: string, route: string): string {
  return `${type}:${message}:${route}`
}

/**
 * Report a bug with client-side deduplication.
 * Same error within the dedup window is only inserted once.
 */
export async function reportBugDedup(
  type: string,
  message: string,
  route: string,
  extra?: Record<string, unknown>,
) {
  const key = getDedupKey(type, message, route)
  const now = Date.now()
  const lastReported = reportedErrors.get(key)

  if (lastReported && now - lastReported < DEDUP_WINDOW_MS) {
    return // Skip duplicate
  }

  reportedErrors.set(key, now)

  // Clean up old entries periodically
  if (reportedErrors.size > 100) {
    for (const [k, v] of reportedErrors.entries()) {
      if (now - v > DEDUP_WINDOW_MS) {
        reportedErrors.delete(k)
      }
    }
  }

  await supabase.from('app_bug_reports').insert({
    type,
    message,
    route,
    extra: extra || {},
    created_at: new Date().toISOString(),
  })
}

// --- user_presence route dedup ---

let lastWrittenRoute: string | null = null

/**
 * Update user presence route, skipping if route hasn't changed.
 */
export async function updatePresenceRoute(userId: string, route: string) {
  if (lastWrittenRoute === route) return // Skip duplicate

  lastWrittenRoute = route

  await supabase
    .from('user_presence_routes')
    .upsert(
      { user_id: userId, route, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
}

/**
 * Reset the route dedup cache (call on mount).
 */
export function resetPresenceRouteCache() {
  lastWrittenRoute = null
}
