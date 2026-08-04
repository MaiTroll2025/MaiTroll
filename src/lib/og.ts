const APP_ORIGIN = import.meta.env.VITE_APP_URL || import.meta.env.APP_URL || 'https://maiMaiTroll.com'

export function buildOGImageUrl(params: {
  kind: 'profile' | 'tcnn' | 'academy' | 'default'
  id?: string
  slug?: string
  username?: string
}): string {
  const base = `${APP_ORIGIN}/api/og`
  const sp = new URLSearchParams()

  if (params.kind === 'profile' && params.username) {
    return `${base}/profile?username=${encodeURIComponent(params.username)}`
  }

  if (params.kind === 'tcnn') {
    if (params.id) sp.set('id', params.id)
    if (params.slug) sp.set('slug', params.slug)
    return `${base}/tcnn?${sp.toString()}`
  }

  if (params.kind === 'academy') {
    if (params.id) sp.set('id', params.id)
    if (params.slug) sp.set('slug', params.slug)
    return `${base}/academy?${sp.toString()}`
  }

  if (params.kind === 'default') {
    return `${base}/default`
  }

  return `${base}/default`
}
