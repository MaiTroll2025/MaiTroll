const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'

export interface OGMetaOptions {
  title: string
  description: string
  image?: string | null
  url: string
  type?: string
  isLive?: boolean
  videoUrl?: string | null
  twitterCard?: string
  twitterPlayerUrl?: string | null
  /** Override the auto-generated OG image URL */
  ogImageUrl?: string | null
}

/**
 * Build a dynamic OG image URL pointing to our Vercel edge functions.
 */
export function buildOGImageUrl(params: {
  kind: 'profile' | 'tcnn' | 'academy'
  id?: string
  slug?: string
  username?: string
}): string {
  const base = `${APP_URL}/api/og`
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
  return `${APP_URL}/images/mai-troll-city-preview.png`
}

function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Generate a full HTML page with OG/Twitter meta tags for social crawlers.
 * This is the shared helper used by all social/OG endpoints.
 */
export function generateOGHTML(data: OGMetaOptions): string {
  const {
    title,
    description,
    image,
    url,
    type = 'website',
    isLive = false,
    videoUrl,
    twitterCard = 'summary_large_image',
    twitterPlayerUrl,
    ogImageUrl,
  } = data

  // Use explicit OG image URL, or the provided image, or fallback
  const ogImage = ogImageUrl || image || `${APP_URL}/images/mai-troll-city-preview.png`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">

  <meta property="og:type" content="${esc(type)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:site_name" content="MaiTroll">
  <meta property="og:locale" content="en_US">

  ${videoUrl ? `
  <meta property="og:video" content="${esc(videoUrl)}">
  <meta property="og:video:secure_url" content="${esc(videoUrl)}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  ` : ''}

  <meta name="twitter:card" content="${esc(twitterCard)}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <meta name="twitter:image:alt" content="${esc(title)}">
  ${site ? `<meta name="twitter:site" content="${esc(site)}">` : ''}

  ${twitterPlayerUrl ? `
  <meta name="twitter:player" content="${esc(twitterPlayerUrl)}">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">
  ` : ''}

  ${isLive ? `
  <meta property="og:live" content="true">
  <meta property="og:stream:status" content="live">
  ` : ''}

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f0a1e 0%, #1a1035 40%, #2d1b69 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      width: 90%;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background: #ef4444;
      color: white;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; line-height: 1.3; }
    p { font-size: 16px; color: rgba(255,255,255,0.6); margin-bottom: 28px; line-height: 1.5; }
    .cta {
      display: inline-block;
      background: linear-gradient(135deg, #9333ea, #db2777);
      color: white;
      padding: 14px 36px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: linear-gradient(135deg, #9333ea, #db2777);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(90deg, #9333ea, #db2777);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    img.preview {
      width: 100%;
      max-width: 520px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
  </style>
</head>
<body>
  <div class="card">
    ${isLive ? '<span class="badge">● LIVE</span>' : ''}
    ${image ? `<img class="preview" src="${esc(image)}" alt="${esc(title)}" onerror="this.style.display='none'">` : ''}
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(url)}">${isLive ? 'Watch Now' : 'Learn More'}</a>
    <div class="brand">
      <div class="brand-icon">👁</div>
      <span class="brand-name">MaiTroll</span>
    </div>
  </div>
</body>
</html>`
}
