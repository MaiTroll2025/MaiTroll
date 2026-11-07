import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPublicSiteUpdatesClient, SITE_UPDATE_COLUMNS } from './_shared/site-updates'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
const HOME_TITLE = 'MaiTroll | The Live Broadcasting App & Social Media Network'
const HOME_DESCRIPTION = 'MaiTroll is a new live broadcasting app and social media platform built for creators. Stream games instantly, build a broadcast career with daily cashouts, and engage with an interactive virtual community.'

const STATIC_PAGES: Record<string, { title: string; description: string; paragraphs: string[]; canonicalPath?: string }> = {
  '/': {
    title: 'MaiTroll | Live Broadcasting and Creator Community',
    description: 'Discover MaiTroll, a live broadcasting and social community platform for creators and viewers. Watch public broadcasts, connect through live chat, share content, and explore interactive community features.',
    paragraphs: [
      'MaiTroll brings live broadcasting, creator profiles, short-form video, chat, and interactive community experiences together in one platform.',
      'Discover public broadcasts, connect with creators and viewers, and explore the features available across the MaiTroll community.',
    ],
  },
  '/about': {
    title: 'About MAiTROLL | Virtual Business City for Students & Entrepreneurs | MaiTroll',
    description: 'Learn about MAiTROLL, a virtual city connecting education, entrepreneurship, broadcasting, commerce, and community for students, instructors, and entrepreneurs.',
    paragraphs: [
      'MAiTROLL connects education, entrepreneurship, broadcasting, commerce, and community in an interactive virtual city.',
      'Explore how students, instructors, creators, and entrepreneurs can participate in community experiences and platform features.',
    ],
  },
  '/contact': {
    title: 'Contact Us | Mai Troll | MaiTroll',
    description: 'Contact the MaiTroll support team for account help, issue reports, or feedback. Find support resources and ways to get in touch.',
    paragraphs: [
      'Contact MaiTroll for help with your account, to report an issue, or to share feedback about the platform.',
      'For common questions, browse the FAQ or visit the support center.',
    ],
  },
  '/faq': {
    title: 'Frequently Asked Questions | MAiTROLL | MaiTroll',
    description: 'Find answers about MAiTROLL, including education, entrepreneurship, broadcasting, Troll Coins, payments, safety, and community features.',
    paragraphs: [
      'Find answers to common questions about MaiTroll accounts, broadcasting, creator tools, community features, payments, and safety.',
      'If you need additional help, contact the MaiTroll support team.',
    ],
  },
  '/privacy': {
    title: 'Privacy Policy | Troll City | MaiTroll',
    description: 'Read the MaiTroll privacy policy to learn how personal information is collected, used, and protected when you use the platform.',
    paragraphs: [
      'The MaiTroll privacy policy explains how information is handled when you use the website, applications, and community features.',
      'Review the full policy for details about data collection, use, sharing, and your privacy choices.',
    ],
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Troll City | MaiTroll',
    description: 'Read the MaiTroll privacy policy to learn how personal information is collected, used, and protected when you use the platform.',
    paragraphs: [
      'The MaiTroll privacy policy explains how information is handled when you use the website, applications, and community features.',
      'Review the full policy for details about data collection, use, sharing, and your privacy choices.',
    ],
    canonicalPath: '/privacy',
  },
  '/legal/privacy': {
    title: 'Privacy Policy | Troll City | MaiTroll',
    description: 'Read the MaiTroll privacy policy to learn how personal information is collected, used, and protected when you use the platform.',
    paragraphs: [
      'The MaiTroll privacy policy explains how information is handled when you use the website, applications, and community features.',
      'Review the full policy for details about data collection, use, sharing, and your privacy choices.',
    ],
    canonicalPath: '/privacy',
  },
  '/app-downloads': {
    title: 'App Downloads | MaiTroll',
    description: 'Download official MaiTroll Android APK releases and review app version details.',
    paragraphs: [
      'Find official MaiTroll app downloads and version information.',
      'Review release details and install instructions before downloading an app package.',
    ],
  },
  '/donate': {
    title: 'Support MaiTroll City | Help Our Live Streaming Community Grow',
    description: 'Help MaiTroll City grow! Support live-streaming infrastructure, platform development, future hiring, and community expansion through secure PayPal contributions.',
    paragraphs: [
      'MaiTroll is an independently growing platform that brings live broadcasting, creator communities, and interactive virtual city experiences together.',
      'Voluntary contributions support the platform as a whole. MaiTroll is a commercial platform, not a charitable organization, and contributions are not tax-deductible.',
    ],
  },
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
  '/hytrogaming': {
    title: 'Hytro Gaming | MaiTroll',
    description: 'Explore Hytro Gaming on MaiTroll for gaming broadcasts, creators, viewers, and gaming community experiences.',
    paragraphs: [
      'Hytro Gaming is MaiTroll’s gaming-focused community for broadcasts, gaming creators, and viewers.',
      'Explore public gaming content and connect with the MaiTroll gaming community.',
    ],
  },
  '/troll-wheel': {
    title: 'Troll Wheel | MaiTroll',
    description: 'Play Troll Wheel on MaiTroll, an interactive community game with random challenges and rewards.',
    paragraphs: [
      'Troll Wheel is an interactive MaiTroll community game built for fun, participation, and random outcomes.',
      'Sign in to participate where required and follow the game rules shown in the experience.',
    ],
  },
  '/mai-troll-run': {
    title: 'MaiTroll Run | MaiTroll',
    description: 'Play MaiTroll Run, an interactive running game inside the MaiTroll virtual city.',
    paragraphs: [
      'MaiTroll Run is an interactive game inside the MaiTroll virtual city.',
      'Play, improve your run, and take part in the wider MaiTroll community experience.',
    ],
  },
  '/podcast': {
    title: 'MaiTroll Podcast Central | MaiTroll',
    description: 'Discover public MaiTroll podcasts, live audio rooms, conversations, and creator shows.',
    paragraphs: [
      'Podcast Central helps visitors discover public MaiTroll podcasts and live audio conversations.',
      'Browse available shows and join public podcast rooms when they are live.',
    ],
  },
  '/broadcast': {
    title: 'MaiTroll Broadcasts | Live Broadcasting',
    description: 'Discover live broadcasts and creator streams on MaiTroll.',
    paragraphs: [
      'MaiTroll brings creators and viewers together through live broadcasting, chat, and community interaction.',
      'Explore public broadcasts and discover creators on MaiTroll.',
    ],
  },
  '/wall': {
    title: 'MaiTroll Wall | Community Posts',
    description: 'Explore public community posts and conversations on the MaiTroll Wall.',
    paragraphs: [
      'The MaiTroll Wall is a public community space for posts, conversations, and shared updates.',
      'Explore public posts and join the wider MaiTroll community.',
    ],
  },
  '/troll-court': {
    title: 'Troll Court | MaiTroll',
    description: 'Explore Troll Court on MaiTroll, a public community moderation and civic experience.',
    paragraphs: [
      'Troll Court is a public community experience within the MaiTroll virtual city.',
      'Explore available court sessions and public proceedings while following MaiTroll community standards.',
    ],
  },
  '/mai-piks': {
    title: 'Mai Piks | MaiTroll',
    description: 'Discover Mai Piks on MaiTroll, a community space for sharing and discovering visual content.',
    paragraphs: [
      'Mai Piks is a MaiTroll community experience for sharing and discovering visual content.',
      'Explore public content and participate in the MaiTroll community.',
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

function renderDonationBody(): string {
  const areas: Array<[string, string[]]> = [
    ['Infrastructure & Technology', ['Live-streaming servers', 'Database infrastructure', 'Bandwidth and hosting', 'Security and platform reliability']],
    ['Future Payroll & Hiring', ['Future paid employment opportunities', 'Developers and engineers', 'Community moderators', 'Customer support and marketing staff']],
    ['Platform Development', ['Broadcasting improvements', 'Live battle enhancements', 'Mobile optimization', 'New city features']],
    ['Community Growth', ['Creator recruitment', 'College outreach', 'Marketing campaigns', 'Community events']],
  ];
  const areaHtml = areas.map(([title, items]) =>
    `<section><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`,
  ).join('');
  return `<main>
    <h1>Help Build the Future of MaiTroll City</h1>
    <p><strong>A New Era of Live Broadcasting. A City Built Around Its Community.</strong></p>
    <p>MaiTroll is more than a live-streaming platform. We&apos;re building an interactive digital city where people can broadcast, compete in live battles, connect, create content, and build communities.</p>
    <p>As an independently growing platform, we welcome voluntary financial contributions from people who believe in our vision.</p>
    <h2>Where Your Contributions Go</h2>
    <p>Contributions support the platform as a whole and are not restricted to any individual category.</p>
    ${areaHtml}
    <h2>Support MaiTroll City</h2>
    <p>Choose a contribution amount of $5, $10, $25, $50, $100, or a custom amount. Secure checkout is handled by PayPal. Guest contributions are supported without a MaiTroll account.</p>
    <p>Contributions to MaiTroll are voluntary and support the development, operation, and growth of our platform. MaiTroll is a commercial platform, not a charitable organization. Contributions are not tax-deductible charitable donations and do not provide ownership, investment returns, or guaranteed benefits.</p>
    <h2>Refunds and support</h2>
    <p>Because contributions are voluntary, they are generally non-refundable. We will review requests involving duplicate, unauthorized, or accidental payments and any refund required by law. Contact us through the <a href="/support">support center</a> or at <a href="mailto:ceo@maitroll.com">ceo@maitroll.com</a>. Refunds, when approved, are returned through PayPal to the original payment method.</p>
    <p><a href="/legal/privacy">Privacy Policy</a> · <a href="/legal/terms">Terms of Service</a> · <a href="/legal/refunds">Refund &amp; Purchase Policy</a></p>
    <noscript><p>JavaScript is required to start a PayPal checkout. The contribution details, policies, and platform information on this page are available without JavaScript.</p></noscript>
  </main>`;
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
  let noindex = /^\/(admin|account|settings|wallet|bank|coins|earnings|cashout|payouts|search|tromail|utromail|notifications|following|messages|blocked-users|trollifications|trollifieds|jail|inmates|onboarding|creator-onboarding|broadcast\/setup|live\/command-center|live\/overlay|officer|lead-officer|president)(\/|$)/i.test(pathname)
  let articleStructuredData: Record<string, unknown> | null = null

  const staticPage = STATIC_PAGES[pathname]
  if (staticPage) {
    title = staticPage.title
    description = staticPage.description
    canonicalPath = staticPage.canonicalPath || pathname
    bodyHtml = renderBody(title, staticPage.paragraphs, [
      { href: '/features/broadcasting-app', label: 'MaiTroll broadcasting features' },
      { href: '/features/social-media', label: 'MaiTroll social community' },
    ])
    if (pathname === '/donate') bodyHtml = renderDonationBody()
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
        if (postType === 'blog') {
          articleStructuredData = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.summary,
            datePublished: post.published_at,
            dateModified: post.updated_at || post.published_at,
            mainEntityOfPage: new URL(pathname, APP_URL).toString(),
            author: { '@type': 'Organization', name: 'MaiTroll' },
            publisher: {
              '@type': 'Organization',
              name: 'MaiTroll',
              url: APP_URL,
              logo: { '@type': 'ImageObject', url: `${APP_URL}/assets/maitrolllogo.png` },
            },
          }
        }
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
    const pageUrl = pathname === '/donate'
      ? 'https://www.maitroll.com/donate'
      : new URL(canonicalPath, APP_URL).toString()
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    if (contentMatch) {
      html = html.replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${contentMatch[1].toLowerCase() === 'blog' ? 'article' : 'website'}" />`)
    }
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`)
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`)
    html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    html = html.replace(/<meta\s+name=["']twitter:image["'][^>]*>/i, '<meta name="twitter:image" content="https://www.maitroll.com/assets/maitrolllogo.png" />')
    const robots = noindex ? 'noindex, nofollow' : 'index, follow'
    if (/<meta\s+name=["']robots["'][^>]*>/i.test(html)) {
      html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`)
    } else {
      html = html.replace('</head>', `<meta name="robots" content="${robots}" />\n  </head>`)
    }
    if (pathname === '/donate') {
      const organizationSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'MaiTroll',
        url: 'https://www.maitroll.com',
        logo: 'https://www.maitroll.com/assets/maitrolllogo.png',
      }
      html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(organizationSchema)}</script>\n  </head>`)
    }
    if (articleStructuredData) {
      html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(articleStructuredData).replace(/</g, '\\u003c')}</script>\n  </head>`)
    }
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
