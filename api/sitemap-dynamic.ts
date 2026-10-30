import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'

function escapeXml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function addUrl(urls: string[], loc: string, lastmod: string, changefreq: string, priority: number) {
  urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).send('Method not allowed')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).send('Sitemap generation is unavailable until database credentials are configured')
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const today = new Date().toISOString().slice(0, 10)
    const urls: string[] = []
    const staticPages = [
      ['/', 1, 'daily'], ['/terms', 0.3, 'monthly'],
      ['/features/broadcasting-app', 0.8, 'monthly'], ['/features/social-media', 0.8, 'monthly'],
      ['/updates', 0.8, 'daily'], ['/blog', 0.8, 'daily'],
      ['/about', 0.5, 'monthly'], ['/privacy', 0.3, 'monthly'],
      ['/donate', 0.7, 'monthly'],
    ] as const
    for (const [route, priority, changefreq] of staticPages) {
      const location = route === '/donate'
        ? 'https://www.maitroll.com/donate'
        : new URL(route, APP_URL).toString()
      addUrl(urls, location, today, changefreq, priority)
    }

    const { data: posts, error: postError } = await supabase
      .from('site_updates')
      .select('slug, post_type, updated_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(5000)
    const siteUpdatesTableMissing = postError?.message.includes("Could not find the table 'public.site_updates'")
    if (postError && !siteUpdatesTableMissing) throw postError
    if (siteUpdatesTableMissing) {
      console.warn('[Sitemap] site_updates table is not available yet; omitting blog and update URLs')
    }
    for (const post of posts || []) {
      if (post.post_type !== 'blog' && post.post_type !== 'update') continue
      const collection = post.post_type === 'blog' ? 'blog' : 'updates'
      const lastmod = String(post.updated_at || post.published_at || today).slice(0, 10)
      addUrl(urls, new URL(`/${collection}/${encodeURIComponent(post.slug)}`, APP_URL).toString(), lastmod, 'weekly', 0.7)
    }

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('username, updated_at')
      .eq('is_banned', false)
      .not('username', 'is', null)
      .not('username', 'eq', '')
      .limit(5000)
    if (profileError) throw profileError
    for (const profile of profiles || []) {
      addUrl(
        urls,
        new URL(`/profile/${encodeURIComponent(profile.username)}`, APP_URL).toString(),
        String(profile.updated_at || today).slice(0, 10),
        'daily',
        0.8,
      )
    }

    const { data: streams, error: streamError } = await supabase
      .from('streams')
      .select('slug, status, updated_at, user_profiles!streams_broadcaster_id_fkey(username, is_banned, account_state)')
      .eq('is_public', true)
      .is('password_hash', null)
      .not('status', 'eq', 'deleted')
      .not('slug', 'is', null)
      .not('slug', 'eq', '')
    if (streamError) throw streamError
    for (const stream of streams || []) {
      const profile = Array.isArray(stream.user_profiles) ? stream.user_profiles[0] : stream.user_profiles
      const username = profile?.username
      if (!username || profile.is_banned || ['suspended', 'banned'].includes(profile.account_state)) continue
      const lastmod = String(stream.updated_at || today).slice(0, 10)
      addUrl(
        urls,
        new URL(`/${encodeURIComponent(username)}/live/${encodeURIComponent(stream.slug)}`, APP_URL).toString(),
        lastmod,
        stream.status === 'live' ? 'always' : 'daily',
        stream.status === 'live' ? 0.9 : 0.6,
      )
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
    if (req.method === 'HEAD') return res.status(200).end()
    return res.status(200).send(xml)
  } catch (error) {
    console.error('[Sitemap] Dynamic sitemap generation failed:', error)
    return res.status(500).send('Error generating sitemap')
  }
}
