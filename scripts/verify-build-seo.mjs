/**
 * Verifies the SEO-critical files survived the production build.
 *
 * robots.txt and the sitemaps are what actually get Google crawling, and they
 * are also the files most easily destroyed by a misconfigured SPA rewrite. This
 * runs after `vite build` and fails loudly if any of them are missing or empty.
 *
 * Run: node ./scripts/verify-build-seo.mjs
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')

const failures = []
const notes = []

function fail(msg) {
  failures.push(msg)
}

function check(label, relPath, { required = true, validate } = {}) {
  const path = join(dist, relPath)

  if (!existsSync(path)) {
    if (required) fail(`${label}: missing from build output (${relPath})`)
    else notes.push(`${label}: absent (${relPath}) — optional`)
    return
  }

  const size = statSync(path).size
  if (size === 0) {
    fail(`${label}: empty file (${relPath})`)
    return
  }

  const body = readFileSync(path, 'utf-8')

  if (validate) {
    const problem = validate(body)
    if (problem) {
      fail(`${label}: ${problem}`)
      return
    }
  }

  notes.push(`${label}: OK (${relPath}, ${size} bytes)`)
}

function validateXml(body) {
  if (!body.trimStart().startsWith('<?xml')) return 'not an XML document'
  const open = (body.match(/<url>/g) || []).length
  const close = (body.match(/<\/url>/g) || []).length
  if (open !== close) return `malformed: ${open} <url> vs ${close} </url>`
  if (open === 0) return 'contains no <url> entries'
  return null
}

if (!existsSync(dist)) {
  console.error('❌ dist/ does not exist. Run the production build first.')
  process.exit(1)
}

check('robots.txt', 'robots.txt', {
  validate(body) {
    if (!/User-agent/i.test(body)) return 'no User-agent directive'
    if (!/Sitemap:/i.test(body)) return 'no Sitemap directive'
    return null
  },
})

check('sitemap.xml', 'sitemap.xml', { validate: validateXml })
check('sitemap-dynamic.xml', 'sitemap-dynamic.xml', { validate: validateXml })

// A SPA rewrite that swallows these files is the exact failure mode that made
// Google see HTML where it expected XML.
const dynamic = join(dist, 'sitemap-dynamic.xml')
if (existsSync(dynamic)) {
  const body = readFileSync(dynamic, 'utf-8')
  if (/<head[\s>]/i.test(body) || /<div id="root"/i.test(body)) {
    fail('sitemap-dynamic.xml contains SPA markup — it was served index.html instead')
  }
}

console.log('SEO build verification:')
for (const note of notes) console.log(`  ✓ ${note}`)

if (failures.length > 0) {
  console.error('\n❌ SEO verification failed:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error('\nGoogle cannot discover pages without these files. Fix before deploying.')
  process.exit(1)
}

console.log('\n✅ All SEO files present and valid.')