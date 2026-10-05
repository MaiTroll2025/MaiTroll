/**
 * Live verification of the SEO files as actually served.
 *
 * Confirms Google receives real XML/robots content rather than the SPA shell,
 * which was the original indexing blocker.
 */

const BASE = process.argv[2] || 'http://localhost:4178'

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

// A SPA deep link must still resolve to the app shell (not 404).
{
  const { res, body } = await get('/profile/someuser')
  if (res.status === 200 && body.includes('<div id="root"')) {
    ok('/profile/someuser — 200 SPA shell (deep link intact)')
  } else {
    fail(`/profile/someuser returned ${res.status} without an SPA shell`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} served-file check(s) FAILED`)
  process.exit(1)
}
console.log('\nAll served-file checks passed.')