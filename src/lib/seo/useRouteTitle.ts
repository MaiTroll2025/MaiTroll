import { useLocation } from 'react-router-dom'
import { normalizePath } from './seoRoutes'
import { usePageTitle } from './usePageTitle'

/**
 * Human-readable titles for the public routes that have no page of their own to
 * set them. Keeping them here means a route is described in exactly one place
 * alongside the private-route list, rather than as a `document.title` assignment
 * scattered across components that may not even render on a phone viewport.
 *
 * `{path}` is replaced with the normalised request path. Anything not listed
 * falls back to a generic branded title, which is still better than every page
 * claiming to be the homepage.
 */
const TITLES: Record<string, string> = {
  '/about': 'About Mai Troll | Live Social Broadcasting',
  '/contact': 'Contact Mai Troll | Support & Help',
  '/faq': 'Frequently Asked Questions | Mai Troll',
  '/privacy': 'Privacy Policy | Mai Troll',
  '/terms': 'Terms of Service | Mai Troll',
  '/terms-of-service': 'Terms of Service | Mai Troll',
  '/privacy-policy': 'Privacy Policy | Mai Troll',
  '/payment-terms': 'Payment Terms | Mai Troll',
  '/creator-agreement': 'Creator Agreement | Mai Troll',
  '/legal': 'Policies & Legal | Mai Troll',
  '/legal/terms': 'Terms of Service | Mai Troll',
  '/legal/privacy': 'Privacy Policy | Mai Troll',
  '/legal/refunds': 'Refund Policy | Mai Troll',
  '/legal/refund': 'Refund Policy | Mai Troll',
  '/legal/payouts': 'Creator Payouts Policy | Mai Troll',
  '/legal/safety': 'Safety Policy | Mai Troll',
  '/legal/creator-earnings': 'Creator Earnings Policy | Mai Troll',
  '/legal/gambling-disclosure': 'Gambling Disclosure | Mai Troll',
  '/explore': 'Explore Live Streams & Creators | Mai Troll',
  '/trending': 'Trending Creators & Live Streams | Mai Troll',
  '/creators': 'Browse Creators | Mai Troll',
  '/top-creators': 'Top Creators | Mai Troll',
  '/leaderboard': 'Creator Leaderboards | Mai Troll',
  '/categories': 'Browse Categories | Mai Troll',
  '/state-rankings': 'State Rankings | Mai Troll',
  '/high-bcasters': 'Top Broadcasters | Mai Troll',
  '/live-swipe': 'Swipe Through Live Streams | Mai Troll',
  '/verified-badge': 'Verified Badge | Mai Troll',
  '/wall': 'Community Wall | Mai Troll',
  '/marketplace': 'Marketplace | Mai Troll',
  '/safety': 'Safety Center | Mai Troll',
  '/support': 'Support | Mai Troll',
  '/help': 'Help Center | Mai Troll',
  '/careers': 'Careers at Mai Troll',
  '/jobs': 'Jobs at Mai Troll',
  '/apply': 'Apply to Mai Troll',
  '/church': 'Mai Troll Church | Community',
}

const PAGE_PREFIXES: Array<[string, string]> = [
  ['/tcnn/article', 'Article | TCNN | Mai Troll'],
  ['/troll-court/watch', 'Court Session | Troll Court | Mai Troll'],
  ['/troll-court', 'Troll Court | Mai Troll'],
  ['/profile', 'Profile | Mai Troll'],
  ['/live', 'Live Broadcast | Mai Troll'],
  ['/categories', 'Category | Mai Troll'],
  ['/podcast', 'Podcast | Mai Troll'],
  ['/agency', 'Agency | Mai Troll'],
  ['/family/profile', 'Family | Mai Troll'],
  ['/battle', 'Troll Battle | Mai Troll'],
  ['/post', 'Post | Mai Troll'],
  ['/wall', 'Community Wall | Mai Troll'],
]

function resolveTitle(path: string): string {
  const exact = TITLES[path]
  if (exact) return exact

  for (const [prefix, template] of PAGE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return template
  }

  return 'Mai Troll | Live Broadcasting, Battles & Social Community'
}

/**
 * Applies the route title for public pages. The three dynamic pages that build
 * their own metadata (Profile, BroadcastRouter, tcnn/ArticleReader) call
 * `usePageTitle` with a page-specific value inside their own effect, which runs
 * after this one, so their titles are not overwritten.
 */
export function useRouteTitle() {
  const { pathname } = useLocation()
  const path = normalizePath(pathname)

  usePageTitle(resolveTitle(path))
}