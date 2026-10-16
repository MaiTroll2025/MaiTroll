import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getAdminSiteUpdatesClient,
  normalizeSiteUpdateInput,
  notifyIndexNow,
  requireSiteUpdateAdmin,
  SITE_UPDATE_COLUMNS,
} from '../_shared/site-updates'

async function handleAdminSiteUpdates(req: VercelRequest, res: VercelResponse) {
  let adminId: string
  try {
    adminId = await requireSiteUpdateAdmin(req)
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 500
    if (status === 500) console.error('[SiteUpdates] Admin authorization failed:', error)
    return res.status(status).json({
      error: status === 500 ? 'Failed to verify administrator access' : (error as Error).message,
    })
  }

  const supabase = getAdminSiteUpdatesClient()
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('site_updates')
        .select(SITE_UPDATE_COLUMNS)
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return res.status(200).json({ posts: data || [] })
    } catch (error) {
      console.error('[SiteUpdates] Admin query failed:', error)
      return res.status(500).json({ error: 'Failed to load site updates' })
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let post
  try {
    post = normalizeSiteUpdateInput(req.body)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }

  try {
    const { data, error } = await supabase
      .from('site_updates')
      .insert({
        ...post,
        created_by: adminId,
        published_at: post.is_published ? new Date().toISOString() : null,
      })
      .select(SITE_UPDATE_COLUMNS)
      .single()
    if (error) throw error

    if (data.is_published) {
      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
      const collection = data.post_type === 'blog' ? 'blog' : 'updates'
      await notifyIndexNow([
        `${appUrl}/${collection}/${encodeURIComponent(data.slug)}`,
        `${appUrl}/${collection}`,
        `${appUrl}/sitemap.xml`,
      ])
    }
    return res.status(201).json({ post: data })
  } catch (error) {
    console.error('[SiteUpdates] Create failed:', error)
    const duplicate = (error as { code?: string }).code === '23505'
    return res.status(duplicate ? 409 : 500).json({
      error: duplicate ? 'That slug is already in use for this post type' : 'Failed to create site update',
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleAdminSiteUpdates(req, res)
  } catch (error) {
    console.error('[SiteUpdates] Unhandled admin endpoint failure:', error)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Site updates endpoint failed unexpectedly' })
    }
  }
}
