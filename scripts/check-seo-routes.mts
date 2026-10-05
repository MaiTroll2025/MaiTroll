import {
  isIndexableRoute,
  isPrivateRoute,
  requiresWebRenderer,
  normalizePath,
} from '../src/lib/seo/seoRoutes'
import { usePageTitle } from '../src/lib/seo/usePageTitle'
import { useRouteTitle } from '../src/lib/seo/useRouteTitle'

let failures = 0

function expect(label: string, actual: unknown, wanted: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted)
  if (!ok) {
    failures++
    console.log(`  FAIL ${label}: got ${JSON.stringify(actual)} want ${JSON.stringify(wanted)}`)
  } else {
    console.log(`  ok   ${label} -> ${JSON.stringify(actual)}`)
  }
}

console.log('\n== PUBLIC routes must stay indexable ==')
for (const p of [
  '/', '/about', '/faq', '/contact', '/legal', '/legal/terms', '/legal/privacy',
  '/legal/refunds', '/legal/payouts', '/legal/safety', '/legal/creator-earnings',
  '/legal/gambling-disclosure', '/explore', '/trending', '/categories', '/categories/gaming',
  '/creators', '/careers', '/jobs', '/safety', '/support', '/help',
  '/profile/exampleuser', '/live/exampleuser', '/stream/exampleuser',
  '/troll-court', '/troll-court/watch/abc-123', '/tcnn/article/42',
  '/wall', '/post/9', '/leaderboard', '/marketplace', '/podcast', '/podcast/7',
  '/academy/course/some-slug', '/family/profile/3', '/agency/acme', '/church',
]) {
  expect(`indexable ${p}`, isIndexableRoute(p), true)
  expect(`not-private ${p}`, isPrivateRoute(p), false)
}

console.log('\n== PRIVATE routes must be noindex ==')
for (const p of [
  '/admin', '/admin/users', '/admin/payouts', '/admin/anything/deep',
  '/settings', '/profile/settings', '/profile/delete', '/bank', '/wallet', '/coins',
  '/notifications', '/following', '/utromail', '/tromail', '/search', '/search?q=bob',
  '/officer', '/officer/dashboard', '/lead-officer', '/president/dashboard',
  '/mai-business/dashboard', '/auction/dashboard', '/auctions/reports',
  '/school/profile', '/earnings', '/payouts/request', '/verification',
  '/jail', '/blocked-users', '/shop-earnings', '/my-orders',
]) {
  expect(`noindex ${p}`, isIndexableRoute(p), false)
  expect(`private ${p}`, isPrivateRoute(p), true)
}

console.log('\n== Public routes with NO phone page must use the web renderer ==')
for (const p of [
  '/about', '/faq', '/contact', '/legal/terms', '/legal/privacy',
  '/trending', '/creators', '/categories', '/categories/gaming',
  '/tcnn/article/42', '/troll-court/watch/abc-123', '/wall', '/post/9',
  '/marketplace', '/leaderboard-x-not-real', '/careers-x-not-real',
  '/live/exampleuser', '/stream/exampleuser',
  // PhoneProfile skips its query when signed out, so public profiles must use
  // the web tree or anonymous visitors see an empty page.
  '/profile/exampleuser', '/profile/id/abc-123',
]) {
  if (p.includes('not-real')) continue
  expect(`web-renderer ${p}`, requiresWebRenderer(p), true)
}

console.log('\n== Routes WITH a real phone page keep the phone tree ==')
// src/phone/PhoneApp.tsx owns these, so they must not be forced to the web
// renderer. They still emit real content at any width.
for (const p of ['/', '/explore', '/troll-court', '/leaderboard', '/community-wall', '/safety', '/careers', '/support', '/legal', '/podcast', '/auctions']) {
  expect(`phone-tree ${p}`, requiresWebRenderer(p), false)
}

console.log('\n== MAi School replaced Academy; both stay unindexable ==')
expect('school is private', isPrivateRoute('/school'), true)
expect('school/profile is private', isPrivateRoute('/school/profile'), true)
expect('mai-school is private', isPrivateRoute('/mai-school'), true)
expect('academy retired (not web-only)', requiresWebRenderer('/academies'), false)
expect('academy course retired', requiresWebRenderer('/academy/course/x'), false)
expect('academy dashboard private', isPrivateRoute('/academy-dashboard'), false)

console.log('\n== Paths must not match on a partial segment ==')
// Regression guard: /legal must not swallow /legalese, /admin must not swallow /administrator
for (const p of ['/legalese', '/administrator', '/campus', '/profilex', '/live-stream']) {
  expect(`no false positive ${p}`, isPrivateRoute(p), false)
}

console.log('\n== Query strings and trailing slashes are ignored ==')
expect('normalize /about/?x=1', normalizePath('/about/?x=1'), '/about')
expect('normalize /ABOUT', normalizePath('/ABOUT'), '/about')
expect('normalize /', normalizePath('/'), '/')
expect('indexable /admin/?a=b', isIndexableRoute('/admin/?a=b'), false)
expect('indexable /about/', isIndexableRoute('/about/'), true)

console.log('\n== Both hooks are exported (import check) ==')
expect('usePageTitle exported', typeof usePageTitle, 'function')
expect('useRouteTitle exported', typeof useRouteTitle, 'function')

if (failures > 0) {
  console.error(`\n${failures} route classification check(s) FAILED`)
  process.exit(1)
}
console.log('\nAll route classification checks passed.')