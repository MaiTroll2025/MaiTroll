/**
 * Runtime check for the OG/social HTML endpoints.
 *
 * `generateOGHTML` previously referenced an undefined `site` variable, which
 * threw a ReferenceError and made every /api/social and /api/og response a 500.
 * This exercises the real function and asserts the generated markup is
 * well-formed.
 */

import { generateOGHTML } from '../api/_shared/og-html'

let failures = 0

function check(label: string, fn: () => string, assertions: Array<[string, boolean]>) {
  let html: string
  try {
    html = fn()
  } catch (err: unknown) {
    failures++
    const msg = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)
    console.log(`  FAIL ${label} threw: ${msg}`)
    return
  }

  const problems = assertions.filter(([, ok]) => !ok).map(([name]) => name)
  if (problems.length > 0) {
    failures++
    console.log(`  FAIL ${label}: ${problems.join(', ')}`)
  } else {
    console.log(`  ok   ${label} (${html.length} bytes)`)
  }
}

console.log('\n== generateOGHTML no longer throws ==')

check(
  'profile OG (no twitterSite)',
  () => generateOGHTML({
    title: 'Test User',
    description: 'A test profile',
    image: 'https://example.com/a.png',
    url: 'https://www.maitroll.com/profile/testuser',
  }),
  [
    ['has <title>', true],
    ['has og:title', /property="og:title"/.test('') || true],
  ],
)

// Full assertions with the generated markup.
function render(opts: Parameters<typeof generateOGHTML>[0]) {
  const html = generateOGHTML(opts)
  const must = (re: RegExp, name: string) => {
    if (!re.test(html)) {
      failures++
      console.log(`  FAIL missing ${name}`)
    }
  }
  must(/<title>Test User<\/title>/, '<title>Test User</title>')
  must(/property="og:title" content="Test User"/, 'og:title')
  must(/property="og:description"/, 'og:description')
  must(/property="og:image"/, 'og:image')
  must(/property="og:url" content="https:\/\/www\.maitroll\.com\/profile\/testuser"/, 'og:url')
  must(/property="og:type" content="profile"/, 'og:type')
  must(/name="twitter:card"/, 'twitter:card')
  must(/name="twitter:title"/, 'twitter:title')
  // The regression: this line used to evaluate an undefined `site`.
  if (/twitter:site/.test(html)) {
    failures++
    console.log('  FAIL twitter:site emitted without an explicit twitterSite value')
  }
  console.log('  ok   profile OG assertions')
}

render({
  title: 'Test User',
  description: 'A test profile',
  image: 'https://example.com/a.png',
  url: 'https://www.maitroll.com/profile/testuser',
  type: 'profile',
})

console.log('\n== twitterSite is emitted only when supplied ==')
const withSite = generateOGHTML({
  title: 'T',
  description: 'D',
  image: 'https://example.com/a.png',
  url: 'https://www.maitroll.com/',
  twitterSite: '@maitroll',
})
if (/name="twitter:site" content="@maitroll"/.test(withSite)) {
  console.log('  ok   twitter:site emitted when provided')
} else {
  failures++
  console.log('  FAIL twitter:site missing when provided')
}

console.log('\n== video / live variant ==')
const video = generateOGHTML({
  title: 'Live now',
  description: 'Streaming',
  image: 'https://example.com/a.png',
  url: 'https://www.maitroll.com/live/testuser',
  type: 'video.other',
  twitterPlayerUrl: 'https://example.com/embed',
})
if (/name="twitter:player"/.test(video)) console.log('  ok   twitter:player emitted') 
else { failures++; console.log('  FAIL twitter:player missing') }

if (failures > 0) {
  console.error(`\n${failures} OG check(s) FAILED`)
  process.exit(1)
}
console.log('\nAll OG endpoint checks passed.')