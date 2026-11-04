/**
 * Live verification of the SEO files as actually served.
 *
 * Confirms Google receives real XML/robots content rather than the SPA shell,
 * which was the original indexing blocker.
 */

const BASE = process.argv[2] || 'http://localhost:3002'

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const ok = (m) => console.log(`  ok   ${m}`)

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { res, body: await res.text() }
}

// Minimal but strict enough to catch unescaped entities and mismatched tags.
function parseXmlErrors(xml) {
  const problems = []

  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    problems.push('missing XML declaration')
  }
  if (!xml.includes('<urlset') || !xml.includes('</urlset>')) {
    problems.push('missing urlset root element')
  }

  const opens = (xml.match(/<url>/g) || []).length
  const closes = (xml.match(/<\/url>/g) || []).length
  if (opens !== closes) problems.push(`unbalanced <url>: ${opens} vs ${closes}`)
  if (opens === 0) problems.push('no <url> entries')

  const locs = (xml.match(/<loc>/g) || []).length
  if (locs !== opens) problems.push(`<loc> count ${locs} != <url> count ${opens}`)

  const locValues = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
  for (const loc of locValues) {
    if (/\s/.test(loc)) problems.push(`whitespace in <loc>: ${loc}`)
    if (!/^https:\/\/www\.maitroll\.com\//.test(loc)) {
      problems.push(`unexpected host in <loc>: ${loc}`)
    }
    // An unescaped & would mean the file is not valid XML.
    if (loc.includes('&')) problems.push(`raw ampersand in <loc>: ${loc}`)
  }

  return problems
}

console.log(`\nVerifying served SEO files at ${BASE}\n`)

for (const path of ['/sitemap.xml', '/sitemap-dynamic.xml']) {
  const { res, body } = await get(path)

  if (res.status !== 200) {
    fail(`${path} returned ${res.status}`)
    continue
  }
  if (body.includes('<div id="root"')) {
    fail(`${path} served the SPA shell instead of XML`)
    continue
  }
  if (!/xml/.test(res.headers.get('content-type') || '')) {
    fail(`${path} content-type is ${res.headers.get('content-type')}, expected XML`)
    continue
  }

  const problems = parseXmlErrors(body)
  if (problems.length > 0) {
    problems.forEach((p) => fail(`${path}: ${p}`))
    continue
  }

  const count = (body.match(/<url>/g) || []).length
  ok(`${path} — 200, valid XML, ${count} URLs`)
}

{
  const { body } = await get('/sitemap.xml')
  for (const pathname of [
    '/about',
    '/app-downloads',
    '/contact',
    '/faq',
    '/privacy',
    '/terms',
    '/features/broadcasting-app',
    '/features/social-media',
    '/blog',
    '/updates',
  ]) {
    if (body.includes(`<loc>https://www.maitroll.com${pathname}</loc>`)) {
      ok(`/sitemap.xml lists ${pathname}`)
    } else {
      fail(`/sitemap.xml is missing ${pathname}`)
    }
  }
}

// robots.txt must be plain text, reference both sitemaps, and not be the SPA.
{
  const { res, body } = await get('/robots.txt')
  if (res.status !== 200) fail(`robots.txt returned ${res.status}`)
  else if (body.includes('<div id="root"')) fail('robots.txt served the SPA shell')
  else if (!/User-agent/i.test(body)) fail('robots.txt has no User-agent directive')
  else if (!/Sitemap:\s*https:\/\/www\.maitroll\.com\/sitemap\.xml/.test(body)) {
    fail('robots.txt does not declare sitemap.xml')
  } else if (!/Sitemap:\s*https:\/\/www\.maitroll\.com\/sitemap-dynamic\.xml/.test(body)) {
    fail('robots.txt does not declare sitemap-dynamic.xml')
  } else ok(`robots.txt — 200, declares both sitemaps`)
}

{
  const { res, body } = await get('/utromail')
  const robots = /<meta name="robots" content="([^"]+)"/i.exec(body)?.[1]
  if (res.status === 200 && robots === 'noindex, nofollow') {
    ok('/utromail — private messaging route is noindex')
  } else {
    fail('/utromail is missing its noindex directive')
  }
}

// Blog collection and published articles must be discoverable as real URLs,
// with route-specific metadata in the first HTML response.
{
  const { res, body } = await get('/blog')
  const title = /<title>(.*?)<\/title>/i.exec(body)?.[1]
  const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(body)?.[1]
  const robots = /<meta name="robots" content="([^"]+)"/i.exec(body)?.[1]
  if (res.status === 200 && title === 'MaiTroll Blog | Creator Broadcasting and Community'
    && canonical === 'https://www.maitroll.com/blog' && robots === 'index, follow'
    && body.includes('<div id="root"><main>')) {
    ok('/blog — indexable collection with server-rendered HTML')
  } else {
    fail('/blog is missing indexable collection metadata or server-rendered content')
  }

  const { res: sitemapRes, body: sitemap } = await get('/sitemap-dynamic.xml')
  if (sitemap.includes('<loc>https://www.maitroll.com/about</loc>')) {
    fail('/sitemap-dynamic.xml should contain dynamic URLs only')
  }
  const articleUrl = /<loc>(https:\/\/www\.maitroll\.com\/blog\/[^<]+)<\/loc>/.exec(sitemap)?.[1]
  if (sitemapRes.status !== 200 || !articleUrl) {
    fail('/sitemap-dynamic.xml does not list a published blog article URL')
  } else {
    const articlePath = new URL(articleUrl).pathname
    const { res: articleRes, body: articleHtml } = await get(articlePath)
    const articleTitle = /<title>(.*?)<\/title>/i.exec(articleHtml)?.[1]
    const articleCanonical = /<link rel="canonical" href="([^"]+)"/i.exec(articleHtml)?.[1]
    const articleRobots = /<meta name="robots" content="([^"]+)"/i.exec(articleHtml)?.[1]
    if (articleRes.status === 200 && articleTitle && articleTitle !== 'MaiTroll | The Live Broadcasting App & Social Media Network'
      && articleCanonical === articleUrl && articleRobots === 'index, follow'
      && articleHtml.includes('"@type":"BlogPosting"') && articleHtml.includes('<div id="root"><main>')) {
      ok(`${articlePath} — sitemap-listed article has canonical, indexable metadata, and BlogPosting schema`)
    } else {
      fail(`${articlePath} is missing sitemap-backed, indexable article HTML`)
    }
  }
}

// Deep links must return route-specific metadata in the initial HTML response.
{
  const expectedPages = [
    ['/', 'MaiTroll | Live Broadcasting and Creator Community', 'https://www.maitroll.com/'],
    ['/about', 'About MAiTROLL | Virtual Business City for Students & Entrepreneurs | MaiTroll', 'https://www.maitroll.com/about'],
    ['/contact', 'Contact Us | Mai Troll | MaiTroll', 'https://www.maitroll.com/contact'],
    ['/faq', 'Frequently Asked Questions | MAiTROLL | MaiTroll', 'https://www.maitroll.com/faq'],
    ['/privacy', 'Privacy Policy | Troll City | MaiTroll', 'https://www.maitroll.com/privacy'],
    ['/app-downloads', 'App Downloads | MaiTroll', 'https://www.maitroll.com/app-downloads'],
    ['/donate', 'Support MaiTroll City | Help Our Live Streaming Community Grow', 'https://www.maitroll.com/donate'],
  ] as const
  for (const [route, expectedTitle, expectedCanonical] of expectedPages) {
    const { res, body } = await get(route)
    const title = /<title>(.*?)<\/title>/i.exec(body)?.[1]?.replace(/&amp;/g, '&')
    const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(body)?.[1]
    const robots = /<meta name="robots" content="([^"]+)"/i.exec(body)?.[1]
    if (res.status === 200 && title === expectedTitle && canonical === expectedCanonical
      && robots === 'index, follow' && body.includes('<div id="root"><main>')) {
      ok(`${route} — route-specific title, canonical, and server-rendered content`)
    } else {
      fail(`${route} returned ${res.status} without expected indexable metadata/content`)
    }
  }

  for (const route of ['/terms', '/terms-of-service', '/legal/terms']) {
    const { res, body } = await get(route)
    const title = /<title>(.*?)<\/title>/i.exec(body)?.[1]
    const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(body)?.[1]
    if (res.status === 200 && title === 'Terms of Service | MaiTroll'
      && canonical === 'https://www.maitroll.com/terms') {
      ok(`${route} — legal title and canonical`)
    } else {
      fail(`${route} returned ${res.status} without legal title/canonical metadata`)
    }
  }

  {
    const { res, body } = await get('/features/broadcasting-app')
    if (res.status === 200 && body.includes('<title>Live Broadcasting App for Creators | MaiTroll</title>')
      && body.includes('Streaming quality and latency')) {
      ok('/features/broadcasting-app — route-specific metadata and content')
    } else {
      fail(`/features/broadcasting-app returned ${res.status} without feature metadata/content`)
    }
  }

  const { res, body } = await get('/profile/someuser')
  if (res.status === 200 && /<title>someuser \(@someuser\) \| MaiTroll<\/title>/i.test(body)
    && body.includes('href="https://www.maitroll.com/profile/someuser"')
    && body.includes('<div id="root"><main>')) {
    ok('/profile/someuser — route-specific title, canonical, and server-rendered content')
  } else {
    fail(`/profile/someuser returned ${res.status} without route-specific HTML metadata`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} served-file check(s) FAILED`)
  process.exit(1)
}
console.log('\nAll served-file checks passed.')