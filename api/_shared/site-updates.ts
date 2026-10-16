import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

export const SITE_UPDATE_COLUMNS =
  'id, title, slug, summary, content, post_type, is_published, published_at, updated_at, created_at'

let publicClient: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

function databaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) throw new Error('Supabase URL is not configured')
  return url
}

export function getPublicSiteUpdatesClient(): SupabaseClient {
  if (publicClient) return publicClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!key) throw new Error('Supabase public key is not configured')
  publicClient = createClient(databaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return publicClient
}

export function getAdminSiteUpdatesClient(): SupabaseClient {
  if (adminClient) return adminClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!key) throw new Error('Supabase service role key is not configured')
  adminClient = createClient(databaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}

export async function requireSiteUpdateAdmin(req: VercelRequest): Promise<string> {
  const authorization = req.headers.authorization || ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    const error = new Error('Authentication required')
    Object.assign(error, { status: 401 })
    throw error
  }

  const supabase = getAdminSiteUpdatesClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    const error = new Error('Invalid or expired authentication token')
    Object.assign(error, { status: 401 })
    throw error
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile?.role !== 'admin' && profile?.is_admin !== true) {
    const error = new Error('Administrator access required')
    Object.assign(error, { status: 403 })
    throw error
  }
  return user.id
}

export function normalizeSiteUpdateInput(value: unknown) {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const postType = body.post_type

  if (!title || title.length > 160) throw new Error('Title is required and must be 160 characters or fewer')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new Error('Slug must contain lowercase letters, numbers, and single hyphens')
  }
  if (!summary || summary.length > 320) throw new Error('Summary is required and must be 320 characters or fewer')
  if (!content || content.length > 50000) throw new Error('Content is required and must be 50,000 characters or fewer')
  if (postType !== 'update' && postType !== 'blog') throw new Error('Post type must be update or blog')

  return {
    title,
    slug,
    summary,
    content,
    post_type: postType,
    is_published: body.is_published === true,
  }
}

export async function notifyIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY
  if (!key || urls.length === 0) return

  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
  const host = new URL(appUrl).host
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `${appUrl}/${encodeURIComponent(key)}.txt`
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) console.warn(`[IndexNow] Submission returned HTTP ${response.status}`)
  } catch (error) {
    console.warn('[IndexNow] Submission failed:', error)
  }
}
