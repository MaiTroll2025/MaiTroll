import { supabase } from './supabase'

type SiteAnalyticsEvent = {
  event_type: 'page_view' | 'search_query'
  session_id: string
  page_path: string
  referrer_host: string | null
  campaign_source: string | null
  campaign_medium: string | null
  campaign_name: string | null
  device_type: 'mobile' | 'tablet' | 'desktop'
  bandwidth_bytes: number
  search_term: string | null
}

const SESSION_STORAGE_KEY = 'maitroll_site_analytics_session'
const loggedPageKeys = new Set<string>()
const loggedSearches = new Map<string, number>()
let resourceEntryCursor = 0
let navigationBytesReported = false
let inMemorySessionId: string | null = null

function createSessionId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) return stored

    const sessionId = createSessionId()
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
    return sessionId
  } catch (error) {
    console.warn('[siteAnalytics] Session storage unavailable; using a temporary session ID.', error)
    if (!inMemorySessionId) inMemorySessionId = createSessionId()
    return inMemorySessionId
  }
}

function getPagePath(pathname: string): string {
  const path = pathname || '/'
  return path
    .replace(/(\/profile\/id\/)[^/]+/i, '$1:id')
    .replace(/(\/(?:live|watch)\/)[^/]+/i, '$1:id')
    .replace(/(\/profile\/)(?!id\/)[^/]+/i, '$1:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
    .slice(0, 500)
}

function getReferrerHost(): string | null {
  if (!document.referrer) return null
  try {
    return new URL(document.referrer).hostname.slice(0, 255) || null
  } catch {
    return null
  }
}

function getCampaignValue(key: string): string | null {
  const value = new URLSearchParams(window.location.search).get(key)?.trim()
  return value ? value.replace(/[^\w .-]/g, '').slice(0, 100) || null : null
}

function getDeviceType(): SiteAnalyticsEvent['device_type'] {
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

function getPageBandwidthBytes(): number {
  if (typeof performance === 'undefined') return 0

  let bytes = 0
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  if (resources.length < resourceEntryCursor) resourceEntryCursor = 0

  for (const resource of resources.slice(resourceEntryCursor)) {
    if (resource.name.includes('/rest/v1/site_analytics_events')) continue
    bytes += resource.transferSize
  }
  resourceEntryCursor = resources.length

  if (!navigationBytesReported) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    bytes += navigation?.transferSize || 0
    navigationBytesReported = true
  }

  return Math.min(Math.round(bytes), 1_073_741_824)
}

function recordEvent(event: SiteAnalyticsEvent): void {
  void supabase
    .from('site_analytics_events')
    .insert(event)
    .then(
      ({ error }) => {
        if (error) console.warn('[siteAnalytics] Failed to record site analytics event:', error.message)
      },
      (error: unknown) => {
      console.warn('[siteAnalytics] Failed to record site analytics event:', error)
      },
    )
}

export function trackSitePageView(pathname: string, navigationKey: string): void {
  if (typeof window === 'undefined' || loggedPageKeys.has(navigationKey)) return
  loggedPageKeys.add(navigationKey)
  if (loggedPageKeys.size > 200) loggedPageKeys.clear()

  recordEvent({
    event_type: 'page_view',
    session_id: getSessionId(),
    page_path: getPagePath(pathname),
    referrer_host: getReferrerHost(),
    campaign_source: getCampaignValue('utm_source'),
    campaign_medium: getCampaignValue('utm_medium'),
    campaign_name: getCampaignValue('utm_campaign'),
    device_type: getDeviceType(),
    bandwidth_bytes: getPageBandwidthBytes(),
    search_term: null,
  })
}

export function trackMaitrollSearch(query: string): void {
  if (typeof window === 'undefined') return
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ')
  const isHashtagSearch = /(^|[^a-z0-9])#maitroll([^a-z0-9]|$)/i.test(normalized)
  const isMaitrollSearch = /(^|[^a-z0-9#])maitroll([^a-z0-9]|$)/i.test(normalized)
  if (!isHashtagSearch && !isMaitrollSearch) return

  const searchTerm = isHashtagSearch ? '#maitroll' : 'maitroll'
  const now = Date.now()
  const previous = loggedSearches.get(searchTerm)
  if (previous && now - previous < 1000) return
  loggedSearches.set(searchTerm, now)

  recordEvent({
    event_type: 'search_query',
    session_id: getSessionId(),
    page_path: getPagePath(window.location.pathname),
    referrer_host: null,
    campaign_source: null,
    campaign_medium: null,
    campaign_name: null,
    device_type: getDeviceType(),
    bandwidth_bytes: 0,
    search_term: searchTerm,
  })
}
