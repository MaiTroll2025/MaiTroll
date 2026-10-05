import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isIndexableRoute } from './seoRoutes'

const ROBOTS_SELECTOR = 'meta[name="robots"]'

/**
 * Maintains exactly one `<meta name="robots">` tag for the current route.
 *
 * `robots.txt` cannot deindex a URL: `Disallow` only prevents crawling, so a
 * private page discovered through an internal link can still appear in Google
 * results as a bare title with no description. Private routes therefore need a
 * `noindex` meta tag, which is what this hook applies.
 *
 * The tag is created once and then updated in place. Creating a new tag on
 * every navigation would leave stale duplicates behind and, when they disagree,
 * Google is free to honour either one.
 *
 * Public routes are explicitly set to `index, follow` rather than having the tag
 * removed, so a `noindex` left over from a previous private page can never
 * follow the user to a public one.
 */
export function useRobotsMeta() {
  const { pathname } = useLocation()
  const indexable = isIndexableRoute(pathname)

  useEffect(() => {
    let tag = document.head.querySelector<HTMLMetaElement>(ROBOTS_SELECTOR)

    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'robots')
      document.head.appendChild(tag)
    }

    tag.setAttribute('content', indexable ? 'index, follow' : 'noindex, nofollow')
  }, [indexable, pathname])
}