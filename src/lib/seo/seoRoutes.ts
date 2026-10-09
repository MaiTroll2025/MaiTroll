/**
 * Central registry of which routes are public/searchable and which are private.
 *
 * Two separate problems are solved from this one list so they can never drift
 * apart:
 *
 * 1. Indexing control. `robots.txt` cannot deindex anything — a `Disallow` only
 *    stops crawling, so a URL discovered through an internal link can still show
 *    up in results as a bare, useless entry. Private and account routes need a
 *    `noindex` meta tag, and this module is the authority for which those are.
 *
 * 2. Phone/web renderer selection. The app swaps between a lightweight phone
 *    tree and the full web tree by viewport width. Phone routes without a
 *    dedicated phone route also render the full web tree rather than a
 *    "web version" placeholder.
 *
 * Routing is decided purely from the requested path. There is deliberately no
 * user-agent inspection anywhere: bots and humans get identical HTML.
 */

/**
 * Public routes that intentionally render the full web tree at phone widths,
 * even when a similarly named route exists in the phone router.
 *
 * Patterns support a leading `:param` segment. Matching is prefix-aware on a
 * full path-segment boundary, so `/legal` never matches `/legalese`.
 */
export const PUBLIC_WEB_ONLY_ROUTES: string[] = [
  // Marketing / SEO
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms-of-service',
  '/app-downloads',
  '/terms-of-service-web',
  '/privacy-policy',
  '/payment-terms',
  '/creator-agreement',
  '/landing',
  '/seo-government',
  '/government',
  '/government/streams',
  '/government/proposals',
  '/government/openings',
  '/government/newspaper',
  '/church',

  // Legal policy sub-pages (phone only has a bare /legal)
  '/legal/terms',
  '/legal/privacy',
  '/legal/refunds',
  '/legal/refund',
  '/legal/payouts',
  '/legal/safety',
  '/legal/creator-earnings',
  '/legal/gambling-disclosure',

  // Discovery / directory pages.
  //
  // Routes that already have a working phone screen (/explore, /leaderboard,
  // /community-wall, /troll-court, /safety, /careers, /support, /legal,
  // /podcast/:id, /agency/:id, /watch/:id, /broadcast/:id, /gaming/watch/:id)
  // are deliberately absent so real phone visitors keep the native experience.
  // Only routes with no phone equivalent belong here.
  '/trending',
  '/creators',
  '/top-creators',
  '/state-rankings',
  '/high-bcasters',
  '/live-swipe',
  '/verified-badge',
  '/categories',
  '/categories/*',
  '/wall',
  '/marketplace',
  '/stat-rankings',

// Public content with a web-only route shape
  '/tcnn/article/:id',
  '/tcnn/viewer/:streamId',
  '/troll-court/watch/:sessionId',
  '/troll-court/summary/:sessionId',
  '/post/:postId',
  '/wall/:postId',
  '/battle/:id',
  '/auctions/:showId',
  '/treelz/:id',
  '/shop/:username',
  '/hytro/:id',
  '/live/:username',
  '/stream/:username',
  '/:username/live/:slug',
  '/songs/:id',
  '/apply',
  '/jobs',
  '/jobs/apply',
  '/press',
  '/town-meeting',

  /*
   * Public profiles always render the web tree.
   *
   * src/phone/pages/PhoneProfile.tsx skips its profile query entirely when
   * there is no signed-in user, so on a phone viewport a logged-out visitor —
   * including Google's smartphone crawler — was served an empty page instead of
   * the profile. The web Profile also emits the canonical and OG tags that make
   * these URLs indexable, which the phone page does not.
   */
  '/profile/:username',
  '/profile/id/:userId',
]

/**
 * Routes that are private, personal, or administrative. Anything matching these
 * receives `noindex, nofollow` so it can never appear in search results even if
 * a URL leaks through internal linking.
 *
 * These are prefix matches on a segment boundary, so `/admin` covers
 * `/admin/users` and `/admin/...`.
 */
export const PRIVATE_ROUTE_PREFIXES: string[] = [
  // Account / settings / money
  '/account',
  '/settings',
  '/profile/settings',
  '/profile/setup',
  '/profile/delete',
  '/bank',
  '/wallet',
  '/coins',
  '/coins/complete',
  '/mai-pay',
  '/inventory',
  '/earnings',
  '/bonuses',
  '/cashout',
  '/payouts',
  '/credit-scores',
  '/payment/callback',
  '/fast-pay-application',
  '/tax-onboarding',
  '/tax-upload',
  '/add-card',
  '/my-orders',
  '/buyer-orders',
  '/seller-orders',
  '/marketplace/orders',
  '/marketplace/sales',
  '/shop-earnings',
  '/profile-frames',
  '/user-inventory',
  '/verification',
  '/verification/complete',

  // Messaging / social-private
  '/search',
  '/utromail',
  '/tromail',
  '/notifications',
  '/following',
  '/messages',
  '/call/',
  '/meeting/',
  '/team-meeting/',
  '/blocked-users',
  '/trollifications',
  '/trollifieds',
  '/jail',
  '/inmates',
  '/jail/appeal',
  '/survey',

  // Creator-only tooling
  '/broadcast/setup',
  '/live/command-center',
  '/live/overlay',
  '/broadcasting',
  '/treelz/upload',
  '/creator-switch',
  '/creator-onboarding',
  '/onboarding',
  '/neighborhood-setup',
  '/driver-test',
  '/insurance',
  '/go-live',
  '/streaming',

  // Offices / roles / government consoles
  '/officer',
  '/lead-officer',
  '/president',
  '/president/dashboard',
  '/mayor',
  '/city-government',
  '/prosecutor',
  '/attorney',
  '/notary',
  '/secretary',
  '/ceo-assistant-dashboard',
  '/hr-center',
  '/hr',
  '/department-tools',
  '/pastor',
  '/church/pastor',
  '/rtcadminmonitor',
  '/under-construction',
  '/beta-feedback',
  '/rfc',
  '/tickets',
  '/t',
  '/admin-mobile',
  '/founder',
  '/agency-dashboard',
  '/agency-hr-dashboard',
  '/mai-sing-off',
  '/xtrollz',
  '/mai-business',
  '/agency-apply',
  '/hytrogaming/apply',
  '/hytrogaming/contract',

  // MAi School account and learning pages are private.
  '/school',
  '/mai-school',

  // Auctions: only the public show/viewer pages are indexable
  '/auction/dashboard',
  '/auction/studio',
  '/auction/my-shows',
  '/auction/bidders',
  '/auction/sales',
  '/auction/reports',
  '/auction/analytics',
  '/auction/settings',
  '/auction/inventory',
  '/auction/orders',
  '/auction/packing',
  '/auction/devices',
  '/auctions/studio',
  '/auctions/my-shows',
  '/auctions/reports',
  '/auctions/applications',
  '/auctions/bidders',
  '/auctions/sales',
  '/auctions/analytics',
  '/auctions/settings',
  '/auctions/inventory',
  '/auctions/orders',
  '/auctions/packing',
  '/auctions/devices',
  '/auctioneer',
  '/auction-app',

  // Admin. Kept last and matched as a prefix, so /admin and /admin/* are covered.
  '/admin',
]

/** Normalises a pathname: strips a query string, hash, trailing slash and case. */
export function normalizePath(pathname: string): string {
  if (!pathname) return '/'

  let path = pathname
  const queryIndex = path.search(/[?#]/)
  if (queryIndex !== -1) path = path.slice(0, queryIndex)

  try {
    path = decodeURIComponent(path)
  } catch {
    /* Malformed encoding is compared as-is. */
  }

  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  return path.toLowerCase() || '/'
}

/**
 * Matches a concrete path against a pattern that may contain `:param` segments.
 * `:param` matches exactly one non-empty segment.
 */
function matchesPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2)
    return path === base || path.startsWith(`${base}/`)
  }

  const patternParts = pattern.split('/')
  const pathParts = path.split('/')

  if (patternParts.length !== pathParts.length) return false

  return patternParts.every((part, index) => {
    if (part.startsWith(':')) return pathParts[index].length > 0
    return part === pathParts[index]
  })
}

/** True when the path is a private, account or admin route. */
export function isPrivateRoute(pathname: string): boolean {
  const path = normalizePath(pathname)

  return PRIVATE_ROUTE_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return path.startsWith(prefix)
    return path === prefix || path.startsWith(`${prefix}/`)
  })
}

/**
 * True when the route has a public page but no phone equivalent, so the web
 * tree must render it at any viewport width.
 */
export function requiresWebRenderer(pathname: string): boolean {
  const path = normalizePath(pathname)

  return PUBLIC_WEB_ONLY_ROUTES.some((pattern) => matchesPattern(path, pattern))
}

/**
 * Whether the page should be indexable. Defaults to indexable so a new public
 * route is discoverable unless it is explicitly classified as private.
 */
export function isIndexableRoute(pathname: string): boolean {
  return !isPrivateRoute(pathname)
}