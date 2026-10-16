import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPublicSiteUpdatesClient, SITE_UPDATE_COLUMNS } from './_shared/site-updates'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
const HOME_TITLE = 'MaiTroll | The Live Broadcasting App & Social Media Network'
const HOME_DESCRIPTION = 'MaiTroll is a new live broadcasting app and social media platform built for creators. Stream games instantly, build a broadcast career with daily cashouts, and engage with an interactive virtual community.'

const STATIC_PAGES: Record<string, { title: string; description: string; paragraphs: string[]; canonicalPath?: string }> = {
  '/terms': {
    title: 'Terms of Service | MaiTroll',
    description: 'Review the MaiTroll Terms of Service for information about using the website, applications, community, broadcasts, and related platform features.',
    paragraphs: [
      'These Terms of Service describe the rules that apply when using MaiTroll, including its website, applications, community features, broadcasts, and creator tools.',
      'By accessing or using MaiTroll, you agree to follow these terms and applicable laws. Please review the complete terms before using the platform.',
      'For questions about these terms, contact the MaiTroll support team.',
    ],
    canonicalPath: '/terms',
  },
  '/terms-of-service': {
    title: 'Terms of Service | MaiTroll',
    description: 'Review the MaiTroll Terms of Service for information about using the website, applications, community, broadcasts, and related platform features.',
    paragraphs: [
      'These Terms of Service describe the rules that apply when using MaiTroll, including its website, applications, community features, broadcasts, and creator tools.',
      'By accessing or using MaiTroll, you agree to follow these terms and applicable laws. Please review the complete terms before using the platform.',
      'For questions about these terms, contact the MaiTroll support team.',
    ],
    canonicalPath: '/terms',
  },
  '/legal/terms': {
    title: 'Terms of Service | MaiTroll',
    description: 'Review the MaiTroll Terms of Service for information about using the website, applications, community, broadcasts, and related platform features.',
    paragraphs: [
      'These Terms of Service describe the rules that apply when using MaiTroll, including its website, applications, community features, broadcasts, and creator tools.',
      'By accessing or using MaiTroll, you agree to follow these terms and applicable laws. Please review the complete terms before using the platform.',
      'For questions about these terms, contact the MaiTroll support team.',
    ],
    canonicalPath: '/terms',
  },
  '/features/broadcasting-app': {
    title: 'Live Broadcasting App for Creators | MaiTroll',
    description: 'Explore MaiTroll, a live broadcasting app for creators to stream games, connect with viewers, and build an audience from supported phones, tablets, and computers.',
    paragraphs: [
      'MaiTroll brings live broadcasts, creator profiles, and community interaction together. Stream games and other content from a supported device, then connect with viewers through live chat and the wider MaiTroll community.',
      'Use a compatible phone, tablet, laptop, or desktop browser to access MaiTroll. Device capabilities and browser support vary, so check your camera, microphone, and network before starting a broadcast.',
      'Creators can use a mobile setup for convenient streaming or a computer setup when they want to work with their preferred streaming equipment. No single setup is required for every broadcast.',
      'Broadcast quality and delay are affected by your network, device, browser, and streaming conditions. A stable connection and supported, up-to-date device can help provide a smoother viewing experience.',
      'MaiTroll does not promise a fixed latency or video resolution across every device and connection. Viewers can join the broadcast conversation and engage with creators while watching.',
    ],
  },
  '/features/social-media': {
    title: 'Social Media Platform and Virtual Community | MaiTroll',
    description: 'Discover MaiTroll’s social media platform, with creator profiles, live chat, short-form video, community spaces, and interactive virtual city features.',
    paragraphs: [
      'MaiTroll combines creator profiles, live broadcasts, short-form video, chat, and virtual community spaces. Members can discover people and content, then take part in shared experiences across the platform.',
      'Public profiles help people find creators and see their public content. Live chat makes it possible for viewers to take part in a broadcast conversation, while short-form video offers another way to share and discover content.',
      'The MaiTroll virtual city includes interactive civic-style features such as city laws and an elected president, alongside community events and shared spaces. These are digital platform experiences, not a physical municipality or government.',
      'MaiTroll brings broadcasting and social interaction into one platform, so creators can build relationships with viewers and audiences can participate in more than passive viewing.',
    ],
  },
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderBody(title: string, paragraphs: string[], links: Array<{ href: string; label: string }> = []): string {
  const text = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
  const linkList = links.map(({ href, label }) =>
    `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`,
  ).join('')
  return `<main><h1>${escapeHtml(title)}</h1>${text}${linkList ? `<ul>${linkList}</ul>` : ''}</main>`
}

function getPath(req: VercelRequest): string {
  const value = req.query.path
  const candidate = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : ''
  if (!candidate) return ''
  let pathname = candidate.startsWith('/') ? candidate : `/${candidate}`
  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    // Keep the original path; HTML output is escaped before rendering.
  }
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).send('Method not allowed')
  }

  const pathname = getPath(req)
  if (!pathname || pathname.startsWith('/api/') || /\.[a-z0-9]{1,12}$/i.test(pathname)) {
    return res.status(404).send('Not found')
  }

  let title = HOME_TITLE
  let description = HOME_DESCRIPTION
  let canonicalPath = pathname
  let bodyHtml: string | undefined
  let statusCode = 200
  let noindex = /^\/(admin|account|settings|wallet)(\/|$)/i.test(pathname)

  const staticPage = STATIC_PAGES[pathname]
  if (staticPage) {
    title = staticPage.title
    description = staticPage.description
    canonicalPath = staticPage.canonicalPath || pathname
    bodyHtml = renderBody(title, staticPage.paragraphs, [
      { href: '/features/broadcasting-app', label: 'MaiTroll broadcasting features' },
      { href: '/features/social-media', label: 'MaiTroll social community' },
    ])
  }

  const profileMatch = pathname.match(/^\/profile\/([a-zA-Z0-9_-]{2,30})$/)
  const liveMatch = pathname.match(/^\/live\/([a-zA-Z0-9_-]{2,30})$/)
  if (profileMatch || liveMatch) {
    const username = profileMatch?.[1] || liveMatch?.[1]
    if (username) {
      let displayName = username
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
        || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (url && key) {
        try {
          const supabase = getPublicSiteUpdatesClient()
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, display_name, is_banned, account_state')
            .ilike('username', username)
            .maybeSingle()
          if (error) throw error
          if (profile?.is_banned || ['suspended', 'banned'].includes(profile?.account_state || '')) {
            noindex = true
            statusCode = 404
          } else if (profile) {
            displayName = profile.display_name || profile.username || username
          }
        } catch (error) {
          console.error('[SEOHTML] Profile lookup failed:', error)
          return res.status(500).send('Unable to render this page right now')
        }
      }

      if (profileMatch) {
        title = `${displayName} (@${username}) | MaiTroll`
        description = `View ${displayName}'s profile on MaiTroll, connect with the creator, and discover their public posts and broadcasts.`
        bodyHtml = renderBody(title, [description], [{ href: '/explore', label: 'Explore MaiTroll' }])
      } else {
        title = `${displayName} is Live | MaiTroll`
        description = `Watch ${displayName} live on MaiTroll, join the conversation, and explore more creator broadcasts.`
        bodyHtml = renderBody(title, [description], [{ href: `/profile/${encodeURIComponent(username)}`, label: `View ${displayName}'s profile` }])
      }
    }
  }

  const contentMatch = pathname.match(/^\/(blog|updates)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i)
  const collectionMatch = pathname.match(/^\/(blog|updates)$/)
  try {
    if (contentMatch) {
      const postType = contentMatch[1].toLowerCase() === 'blog' ? 'blog' : 'update'
      const { data: post, error } = await getPublicSiteUpdatesClient()
        .from('site_updates')
        .select(SITE_UPDATE_COLUMNS)
        .eq('slug', contentMatch[2])
        .eq('post_type', postType)
        .eq('is_published', true)
        .maybeSingle()
      if (error) throw error
      if (!post) {
        title = 'Page Not Found | MaiTroll'
        description = 'This MaiTroll article or update could not be found.'
        bodyHtml = renderBody(title, [description], [{ href: postType === 'blog' ? '/blog' : '/updates', label: 'Browse recent posts' }])
        statusCode = 404
        noindex = true
      } else {
        title = `${post.title} | MaiTroll`
        description = post.summary
        const paragraphs = String(post.content).split(/\r?\n+/).filter(Boolean)
        if (postType === 'update') paragraphs.unshift('Posted by CEO of Mai Corp')
        bodyHtml = renderBody(post.title, paragraphs, [
          { href: postType === 'blog' ? '/blog' : '/updates', label: `More ${postType === 'blog' ? 'articles' : 'updates'}` },
        ])
      }
    } else if (collectionMatch) {
      const type = collectionMatch[1].toLowerCase() === 'blog' ? 'blog' : 'update'
      title = type === 'blog' ? 'MaiTroll Blog | Creator Broadcasting and Community' : 'MaiTroll Updates | News and Feature Releases'
      description = type === 'blog'
        ? 'Read MaiTroll articles about live broadcasting, creator tools, social media, and virtual communities.'
        : 'Read the latest public MaiTroll product updates, feature announcements, and platform news from the CEO of Mai Corp.'
      const { data: posts, error } = await getPublicSiteUpdatesClient()
        .from('site_updates')
        .select(SITE_UPDATE_COLUMNS)
        .eq('is_published', true)
        .eq('post_type', type)
        .order('published_at', { ascending: false })
        .limit(50)
      if (error) throw error
      bodyHtml = renderBody(type === 'blog' ? 'MaiTroll Blog' : 'MaiTroll Updates', [description], (posts || []).map((post) => ({
        href: `/${type === 'blog' ? 'blog' : 'updates'}/${encodeURIComponent(post.slug)}`,
        label: post.title,
      })))
    }
  } catch (error) {
    console.error('[SEOHTML] Failed to load published content:', error)
    return res.status(500).send('Unable to render this page right now')
  }

  try {
    let html = await readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8')
    const pageUrl = new URL(canonicalPath, APP_URL).toString()
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`)
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`)
    if (noindex) html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow" />\n  </head>')
    if (bodyHtml) html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
    if (req.method === 'HEAD') return res.status(statusCode).end()
    return res.status(statusCode).send(html)
  } catch (error) {
    console.error('[SEOHTML] Failed to read production SPA entry:', error)
    return res.status(503).send('The production site has not been built yet.')
  }
}
