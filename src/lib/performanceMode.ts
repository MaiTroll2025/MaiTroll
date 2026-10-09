export type BatterySaverMode = 'normal' | 'reduced' | 'ultra'

const HEAVY_ROUTE_PATTERNS = [
  /^\/broadcast(\/|$)/,
  /^\/watch(\/|$)/,
  /^\/live(\/|$)/,
  /^\/store(\/|$)/,
  /^\/coins(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/government\/streams(\/|$)/,
]

export function applyBatterySaverClass(mode: BatterySaverMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('tc-battery-reduced', mode === 'reduced' || mode === 'ultra')
  document.documentElement.classList.toggle('tc-battery-ultra', mode === 'ultra')
}

export function isRealtimeRoute(pathname: string) {
  const normalized = pathname.toLowerCase()
  return (
    normalized.startsWith('/broadcast/') ||
    normalized.startsWith('/watch/') ||
    normalized.startsWith('/live') ||
    normalized.startsWith('/stream') ||
    normalized.startsWith('/government/streams')
  )
}

export function isHeavyRoute(pathname: string) {
  return HEAVY_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname.toLowerCase()))
}

export function shouldSkipNonCriticalFetch(url: string, mode: BatterySaverMode) {
  if (mode === 'normal') return false
  const lower = url.toLowerCase()
  const nonCriticalKeywords = ['promo', 'ad', 'ads', 'ticker', 'leaderboard', 'stock', 'market', 'campaign', 'analytics', 'banner', 'background', 'wallet/refresh', 'profile/refresh']
  const isNonCritical = nonCriticalKeywords.some((keyword) => lower.includes(keyword))
  if (!isNonCritical) return false
  return true
}
