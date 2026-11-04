import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPublicSiteUpdatesClient, SITE_UPDATE_COLUMNS } from './_shared/site-updates'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = getPublicSiteUpdatesClient()
    let query = supabase
      .from('site_updates')
      .select(SITE_UPDATE_COLUMNS, { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false })

    const type = req.query.type
    if (type === 'blog' || type === 'update') query = query.eq('post_type', type)
    if (typeof req.query.slug === 'string') query = query.eq('slug', req.query.slug)
    else query = query.limit(100)

    const { data, error, count } = await query
    if (error) throw error
    return res.status(200).json({ posts: data || [], count: count ?? data?.length ?? 0 })
  } catch (error) {
    console.error('[SiteUpdates] Public query failed:', error)
    return res.status(500).json({ error: 'Failed to load site updates' })
  }
}
