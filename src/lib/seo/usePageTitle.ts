import { useEffect } from 'react'

/**
 * Sets the document title for a public page and keeps the `og:title` /
 * `twitter:title` tags in agreement with it.
 *
 * The global `<title>` in index.html is the homepage title, and every route is
 * served the same HTML shell, so without this a listing page such as /explore or
 * /categories/gaming is delivered to Google with the homepage title. Combined
 * with no page-specific description that makes those pages near-duplicates of
 * the homepage, which is the other half of why they were not being indexed.
 *
 * This updates existing tags in place instead of appending, so a page never ends
 * up with two conflicting titles.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return

    document.title = title

    const sync = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(key, selector.includes('property=') ? 'property' : 'name')
        el.setAttribute(selector.includes('property=') ? 'property' : 'name', selector.match(/"([^"]+)"/)?.[1] ?? '')
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }

    sync('meta[property="og:title"]', 'content', 'property', title)
    sync('meta[name="twitter:title"]', 'content', 'name', title)
  }, [title])
}