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

function sitemapDate(value: unknown): string | null {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function publicHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function validVideoDuration(value: unknown): number | null {
  const duration = Number(value)
  return Number.isFinite(duration) && duration >= 1 && duration <= 28800
    ? Math.floor(duration)
    : null
}

function addUrl(urls: string[], loc: string, lastmod: string | null, changefreq: string, priority: number) {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
  ]
  const normalizedLastmod = sitemapDate(lastmod)
  if (normalizedLastmod) lines.push(`    <lastmod>${normalizedLastmod}</lastmod>`)
  lines.push(
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  )
  urls.push(lines.join('\n'))
}

function addVideoUrl(
  urls: string[],
  pageUrl: string,
  lastmod: string | null,
  video: {
    thumbnailUrl: string
    title: string
    description: string
    contentUrl: string
    duration?: number | null
    publicationDate?: string | null
  },
) {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(pageUrl)}</loc>`,
    ...(sitemapDate(lastmod) ? [`    <lastmod>${sitemapDate(lastmod)}</lastmod>`] : []),
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.6</priority>',
    '    <video:video>',
    `      <video:thumbnail_loc>${escapeXml(video.thumbnailUrl)}</video:thumbnail_loc>`,
    `      <video:title>${escapeXml(video.title.slice(0, 2048))}</video:title>`,
    `      <video:description>${escapeXml(video.description.slice(0, 2048))}</video:description>`,
    `      <video:content_loc>${escapeXml(video.contentUrl)}</video:content_loc>`,
    ...(video.duration && video.duration > 0
      ? [`      <video:duration>${Math.floor(video.duration)}</video:duration>`]
      : []),
    ...(sitemapDate(video.publicationDate)
      ? [`      <video:publication_date>${escapeXml(sitemapDate(video.publicationDate))}</video:publication_date>`]
      : []),
    '    </video:video>',
    '  </url>',
  ]
  urls.push(lines.join('\n'))
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

type PublicStreamRow = {
  id: string
  status: string | null
  is_live: boolean | null
  updated_at: string | null
  created_at: string | null
  is_public: boolean | null
  is_private: boolean | null
  password_hash: string | null
  user_profiles:
    | { username: string | null; is_banned: boolean | null; account_state: string | null; is_private: boolean | null }
    | Array<{ username: string | null; is_banned: boolean | null; account_state: string | null; is_private: boolean | null }>
    | null
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
    const urls: string[] = []

    let posts: Array<{ slug: string | null; post_type: string | null; updated_at: string | null; published_at: string | null }> = []
    try {
      posts = await fetchAllPages(async (from, to) => supabase
        .from('site_updates')
        .select('slug, post_type, updated_at, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .order('slug', { ascending: true })
        .range(from, to))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("Could not find the table 'public.site_updates'")) {
        console.warn('[Sitemap] site_updates table is not available; omitting blog and update URLs')
      } else {
        throw error
      }
    }
    for (const post of posts) {
      if (post.post_type !== 'blog' && post.post_type !== 'update') continue
      if (!post.slug) continue
      const collection = post.post_type === 'blog' ? 'blog' : 'updates'
      const lastmod = post.updated_at || post.published_at
      addUrl(urls, new URL(`/${collection}/${encodeURIComponent(post.slug)}`, APP_URL).toString(), lastmod, 'weekly', 0.7)
    }

    try {
      const treelzPosts = await fetchAllPages(async (from, to) => supabase
        .from('treelz_posts')
        .select('id, video_url, thumbnail_url, caption, video_duration_seconds, status, ai_review_status, updated_at, created_at, author:user_profiles(is_private, is_banned, account_state)')
        .eq('status', 'active')
        .or('ai_review_status.is.null,ai_review_status.neq.actioned')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to))

      for (const post of treelzPosts) {
        const author = Array.isArray(post.author) ? post.author[0] : post.author
        const videoUrl = publicHttpUrl(post.video_url)
        const thumbnailUrl = publicHttpUrl(post.thumbnail_url)
        if (
          !videoUrl ||
          !thumbnailUrl ||
          !author ||
          author.is_private !== false ||
          author?.is_banned === true ||
          ['banned', 'suspended', 'jailed', 'exiled'].includes(author?.account_state || '')
        ) continue
        const title = String(post.caption || 'Public Treelz video').trim() || 'Public Treelz video'
        addVideoUrl(
          urls,
          new URL(`/treelz?post=${encodeURIComponent(post.id)}`, APP_URL).toString(),
          sitemapDate(post.updated_at) || sitemapDate(post.created_at),
          {
            thumbnailUrl,
            title,
            description: title,
            contentUrl: videoUrl,
            duration: validVideoDuration(post.video_duration_seconds),
            publicationDate: post.created_at,
          },
        )
      }
    } catch (error) {
      console.warn('[Sitemap] Treelz video URLs unavailable; omitting Treelz videos:', error)
    }

    try {
      const wallVideos = await fetchAllPages(async (from, to) => supabase
        .from('troll_wall_posts')
        .select('id, content, metadata, created_at, deleted_at, privacy_mode, post_type, author:user_profiles!troll_wall_posts_user_id_fkey(is_private, is_banned, account_state)')
        .eq('post_type', 'video')
        .eq('privacy_mode', 'public')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to))

      for (const post of wallVideos) {
        const metadata = post.metadata && typeof post.metadata === 'object' ? post.metadata : {}
        const videoUrl = publicHttpUrl(metadata.video_url)
        const thumbnailUrl = publicHttpUrl(metadata.thumbnail_url)
        const author = Array.isArray(post.author) ? post.author[0] : post.author
        if (
          !videoUrl ||
          !thumbnailUrl ||
          !author ||
          author.is_private !== false ||
          author.is_banned === true ||
          ['banned', 'suspended', 'jailed', 'exiled'].includes(author.account_state || '')
        ) continue
        const title = String(post.content || 'Public MaiTroll wall video').trim() || 'Public MaiTroll wall video'
        addVideoUrl(
          urls,
          new URL(`/post/${encodeURIComponent(post.id)}`, APP_URL).toString(),
          sitemapDate(post.created_at),
          {
            thumbnailUrl,
            title,
            description: title,
            contentUrl: videoUrl,
            publicationDate: post.created_at,
          },
        )
      }
    } catch (error) {
      console.warn('[Sitemap] Wall video URLs unavailable; omitting wall videos:', error)
    }

    let profiles: Array<{
      username: string | null
      updated_at: string | null
      created_at: string | null
      is_banned: boolean | null
      account_state: string | null
      is_private?: boolean | null
    }>
    try {
      profiles = await fetchAllPages(async (from, to) => supabase
        .from('user_profiles')
        .select('username, updated_at, created_at, is_banned, account_state, is_private')
        .not('username', 'is', null)
        .not('username', 'eq', '')
        .order('username', { ascending: true })
        .range(from, to))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('column user_profiles.is_private does not exist')) throw error
      console.warn('[Sitemap] user_profiles.is_private is unavailable; omitting profile URLs to fail closed')
      profiles = []
    }
    for (const profile of profiles) {
      if (
        profile.is_private !== false ||
        profile.is_banned === true ||
        ['banned', 'suspended', 'jailed', 'exiled'].includes(profile.account_state || '')
      ) continue
      if (!profile.username) continue
      addUrl(
        urls,
        new URL(`/profile/${encodeURIComponent(profile.username)}`, APP_URL).toString(),
        profile.updated_at || profile.created_at,
        'daily',
        0.8,
      )
    }

    let streams: PublicStreamRow[] = []
    try {
      streams = await fetchAllPages(async (from, to) => supabase
        .from('streams')
        .select('id, status, is_live, updated_at, created_at, is_public, is_private, password_hash, user_profiles!streams_broadcaster_id_fkey(username, is_banned, account_state, is_private)')
        .eq('is_public', true)
        .eq('is_private', false)
        .is('password_hash', null)
        .not('status', 'in', '("deleted","suspended","ended")')
        .eq('is_live', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('is_private')) throw error
      console.warn('[Sitemap] Stream/profile privacy columns are unavailable; omitting stream URLs to fail closed')
    }
    for (const stream of streams) {
      const profile = Array.isArray(stream.user_profiles) ? stream.user_profiles[0] : stream.user_profiles
      const username = profile?.username
      if (
        !username ||
        profile.is_private !== false ||
        profile.is_banned === true ||
        ['suspended', 'banned', 'jailed', 'exiled'].includes(profile.account_state || '')
      ) continue
      const lastmod = stream.updated_at || stream.created_at
      addUrl(
        urls,
        new URL(`/live/${encodeURIComponent(username)}`, APP_URL).toString(),
        lastmod,
        stream.status === 'live' ? 'always' : 'daily',
        stream.status === 'live' ? 0.9 : 0.6,
      )
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
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
