import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getAdminSiteUpdatesClient,
  normalizeSiteUpdateInput,
  notifyIndexNow,
  requireSiteUpdateAdmin,
  SITE_UPDATE_COLUMNS,
} from '../../_shared/site-updates'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function handleAdminSiteUpdate(req: VercelRequest, res: VercelResponse) {
  try {
    await requireSiteUpdateAdmin(req)
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 500
    if (status === 500) console.error('[SiteUpdates] Admin authorization failed:', error)
    return res.status(status).json({
      error: status === 500 ? 'Failed to verify administrator access' : (error as Error).message,
    })
  }

  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!UUID_PATTERN.test(id)) return res.status(400).json({ error: 'Invalid post ID' })

  const supabase = getAdminSiteUpdatesClient()
  if (req.method === 'PUT') {
    let post
    try {
      post = normalizeSiteUpdateInput(req.body)
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message })
    }

    try {
      const { data, error } = await supabase
        .from('site_updates')
        .update({
          ...post,
          published_at: post.is_published ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(SITE_UPDATE_COLUMNS)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Site update not found' })

      if (data.is_published) {
        const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
        const collection = data.post_type === 'blog' ? 'blog' : 'updates'
        await notifyIndexNow([
          `${appUrl}/${collection}/${encodeURIComponent(data.slug)}`,
          `${appUrl}/${collection}`,
          `${appUrl}/sitemap.xml`,
        ])
      }
      return res.status(200).json({ post: data })
    } catch (error) {
      console.error('[SiteUpdates] Update failed:', error)
      const duplicate = (error as { code?: string }).code === '23505'
      return res.status(duplicate ? 409 : 500).json({
        error: duplicate ? 'That slug is already in use for this post type' : 'Failed to update site update',
      })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { data, error } = await supabase
        .from('site_updates')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Site update not found' })
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('[SiteUpdates] Delete failed:', error)
      return res.status(500).json({ error: 'Failed to delete site update' })
    }
  }

  res.setHeader('Allow', 'PUT, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleAdminSiteUpdate(req, res)
  } catch (error) {
    console.error('[SiteUpdates] Unhandled admin item endpoint failure:', error)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Site update endpoint failed unexpectedly' })
    }
  }
}
