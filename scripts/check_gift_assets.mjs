#!/usr/bin/env node
/*
  check_gift_assets.mjs

  Diagnostics for gift animation/video assets.

  Requires environment variables:
    SUPABASE_URL - e.g. https://xyz.supabase.co
    SUPABASE_KEY - anon or service key with read access to gift_items and user_profiles
    ASSETS_BASE_URL - optional base URL where relative assets are hosted (e.g. https://your-app.example.com). If omitted, SUPABASE_URL origin will be used as fallback.

  Usage:
    node scripts/check_gift_assets.mjs

  Output:
    - prints summary to stdout
    - writes diagnostic_outputs/gift_asset_report.json
*/
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const ASSETS_BASE_URL = process.env.ASSETS_BASE_URL || null

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment')
  process.exit(2)
}

function originFromUrl(u) {
  try {
    const url = new URL(u)
    return `${url.protocol}//${url.host}`
  } catch (_e) {
    return null
  }
}

const FALLBACK_ASSETS_BASE = ASSETS_BASE_URL || originFromUrl(SUPABASE_URL) || ''

function getAnimationKeyFromName(name = '', slug = '') {
  if (!name && !slug) return 'gift_boost'
  const normalized = `${name || ''} ${slug || ''}`.toLowerCase()
  if (normalized.includes('alien')) return 'alien_invasion'
  if (normalized.includes('yacht')) return 'yacht'
  if (normalized.includes('phoenix')) return 'phoenix'
  if (normalized.includes('private jet') || normalized.includes('jet')) return 'private_jet'
  if (normalized.includes('dragon')) return 'dragon'
  if (normalized.includes('black hole') || normalized.includes('blackhole')) return 'black_hole'
  if (normalized.includes('gold bar') || normalized.includes('gold_bar') || normalized.includes('goldbar')) return 'gold_bar'
  if (normalized.includes('planet')) return 'planet'
  if (normalized.includes('rocket')) return 'rocket'
  if (normalized.includes('rolex') || normalized.includes('watch')) return 'rolex'
  if (normalized.includes('cash stack') || normalized.includes('money stack') || normalized.includes('cash')) return 'cash_stack'
  if (normalized.includes('time machine') || normalized.includes('time portal') || normalized.includes('time')) return 'time_machine'
  if (normalized.includes('sports car') || normalized.includes('sportscar') || normalized.includes('car')) return 'sports_car'
  if (normalized.includes('galaxy')) return 'galaxy'
  if (normalized.includes('diamond')) return 'diamond'
  if (normalized.includes('unicorn')) return 'unicorn'
  if (normalized.includes('ring')) return 'ring'
  if (normalized.includes('mansion')) return 'mansion'
  if (normalized.includes('404') || normalized.includes('error')) return 'error_404'
  if (normalized.includes('lag switch') || normalized.includes('lag_switch')) return 'lag_switch'
  if (normalized.includes('trophy')) return 'trophy'
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'gift_boost'
}

function resolveGiftName(gift) {
  const metadata = (gift.metadata && typeof gift.metadata === 'string') ? (() => { try { return JSON.parse(gift.metadata) } catch (_e) { return {} } })() : (gift.metadata || {})
  return (
    gift.gift_name || gift.name || gift.title || metadata.gift_name || metadata.name || metadata.title || 'Gift'
  )
}

function candidateAnimationUrl(gift, animationKey) {
  const metadata = (gift.metadata && typeof gift.metadata === 'string') ? (() => { try { return JSON.parse(gift.metadata) } catch (_e) { return {} } })() : (gift.metadata || {})
  const candidates = []
  if (gift.animationUrl) candidates.push(gift.animationUrl)
  if (gift.animation_url) candidates.push(gift.animation_url)
  if (gift.videoUrl) candidates.push(gift.videoUrl)
  if (gift.video_url) candidates.push(gift.video_url)
  if (gift.mediaUrl) candidates.push(gift.mediaUrl)
  if (gift.media_url) candidates.push(gift.media_url)
  if (metadata.animation_url) candidates.push(metadata.animation_url)
  if (metadata.video_url) candidates.push(metadata.video_url)
  if (metadata.media_url) candidates.push(metadata.media_url)
  if (metadata.animationUrl) candidates.push(metadata.animationUrl)
  if (metadata.videoUrl) candidates.push(metadata.videoUrl)
  if (metadata.mediaUrl) candidates.push(metadata.mediaUrl)

  const slug = gift.slug || gift.gift_slug || gift.animation_key || gift.animationKey
  if (slug) candidates.push(`/gift-videos/gift_${slug}.webm`)
  candidates.push(`/gift-animations/${animationKey}.webm`)

  // remove duplicates and falsy
  return Array.from(new Set(candidates.filter(Boolean)))
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (res.status === 200) return { ok: true, status: res.status }
    // some servers may not support HEAD; try GET for 200
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      const r2 = await fetch(url, { method: 'GET' })
      return { ok: r2.status === 200, status: r2.status }
    }
    return { ok: false, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, error: String(e) }
  }
}

function buildFullUrlsForCandidate(candidate) {
  if (!candidate) return []
  try {
    const _parsed = new URL(candidate)
    return [candidate]
  } catch (_e) {
    // relative path - try ASSETS_BASE_URL and SUPABASE origin
    const urls = []
    if (FALLBACK_ASSETS_BASE) urls.push((FALLBACK_ASSETS_BASE.replace(/\/+$/,'') + candidate))
    // also try supabase origin
    const supabaseOrigin = originFromUrl(SUPABASE_URL)
    if (supabaseOrigin && !urls.includes(supabaseOrigin + candidate)) urls.push(supabaseOrigin + candidate)
    return urls
  }
}

async function run() {
  console.log('Connecting to Supabase REST at', SUPABASE_URL)
  const restUrl = SUPABASE_URL.replace(/\/+$/,'') + '/rest/v1/gift_items?select=*&limit=1000'
  const res = await fetch(restUrl, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json'
    }
  })
  if (!res.ok) {
    console.error('Failed to fetch gift_items:', res.status, await res.text())
    process.exit(3)
  }

  const gifts = await res.json()
  console.log(`Found ${gifts.length} gift_items to inspect`)

  const report = {
    checkedAt: new Date().toISOString(),
    counts: { total: gifts.length },
    missingFiles: [],
    genericNameGifts: [],
    nullUrlGifts: [],
    perGift: []
  }

  for (const gift of gifts) {
    const name = resolveGiftName(gift)
    const slug = gift.slug || gift.gift_slug || gift.animation_key || gift.animationKey || ''
    const animationKey = getAnimationKeyFromName(name, slug)
    const candidates = candidateAnimationUrl(gift, animationKey)

    const candidateChecks = []
    let anyOk = false
    for (const c of candidates) {
      const urlsToTry = buildFullUrlsForCandidate(c)
      if (urlsToTry.length === 0) urlsToTry.push(c)
      const tried = []
      for (const u of urlsToTry) {
        const check = await urlExists(u)
        tried.push({ url: u, ...check })
        if (check.ok) anyOk = true
      }
      candidateChecks.push({ candidate: c, tried })
    }

    const per = {
      id: gift.id || null,
      slug: slug || null,
      resolvedName: name,
      animationKey,
      candidates: candidateChecks
    }
    report.perGift.push(per)

    if (!anyOk) {
      report.missingFiles.push({ id: gift.id || null, slug, resolvedName: name, suggestedPaths: candidates.slice(0,2) })
    }

    if ((name || '').trim() === 'Gift') report.genericNameGifts.push({ id: gift.id || null, slug })

    const hasAnyUrl = !!(
      gift.animation_url || gift.animationUrl || gift.video_url || gift.videoUrl || gift.media_url || gift.mediaUrl ||
      (gift.metadata && ((typeof gift.metadata === 'string' && gift.metadata.match(/animation|video|media/i)) || (typeof gift.metadata === 'object' && (gift.metadata.animation_url || gift.metadata.video_url || gift.metadata.media_url || gift.metadata.animationUrl || gift.metadata.videoUrl || gift.metadata.mediaUrl))))
    )
    if (!hasAnyUrl) report.nullUrlGifts.push({ id: gift.id || null, slug, resolvedName: name })
  }

  // write report
  const outDir = path.join(process.cwd(), 'diagnostic_outputs')
  try { fs.mkdirSync(outDir, { recursive: true }) } catch (_e) {}
  const outPath = path.join(outDir, 'gift_asset_report.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  // Print concise summary
  console.log('\n--- Gift Asset Diagnostic Summary ---')
  console.log('Total gifts checked:', report.counts.total)
  console.log('Missing files (no candidate resolved):', report.missingFiles.length)
  console.log('Gifts with generic name "Gift":', report.genericNameGifts.length)
  console.log('Gifts with no animation/video fields:', report.nullUrlGifts.length)
  console.log(`Report written to: ${outPath}`)
  console.log('\nMissing gifts examples (up to 10):')
  for (const m of report.missingFiles.slice(0,10)) {
    console.log('-', m.id, '|', m.resolvedName, '| suggested:', m.suggestedPaths.join(' , '))
  }

  process.exit(0)
}

run().catch((e) => { console.error('Fatal error:', e); process.exit(4) })
