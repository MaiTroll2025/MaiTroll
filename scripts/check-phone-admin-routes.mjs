/**
 * Guards against phone admin links that silently fall through to PhoneWebPage.
 *
 * Every `path: '/admin/...'` in the phone drawer (src/phone/phoneNav.ts) must be
 * resolvable on the phone: either a dedicated route in PhoneApp.tsx or an entry
 * in phoneAdminRoutes.ts. Anything else renders the "available on the web
 * version" placeholder at runtime, which is invisible until someone opens the
 * tab on a real device.
 *
 * Run: npm run check:phone-routes
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const unique = (values) => [...new Set(values)]

const navSource = read('src/phone/phoneNav.ts')
const routesSource = read('src/phone/phoneAdminRoutes.ts')
const appSource = read('src/phone/PhoneApp.tsx')

const navPaths = unique(
  [...navSource.matchAll(/path:\s*'(\/admin[^']*)'/g)].map((m) => m[1]),
).sort()

const tablePaths = unique(
  [...routesSource.matchAll(/'(\/admin[^']*)'\s*,\s*\{/g)].map((m) => m[1]),
)

const appPaths = unique(
  [...appSource.matchAll(/<Route path="(\/admin[^"]*)"/g)].map((m) => m[1]),
)

const appExact = appPaths.filter((p) => !p.includes('*'))

const resolves = (navPath) => {
  if (appExact.includes(navPath)) return 'PhoneApp route'
  if (tablePaths.includes(navPath)) return 'phoneAdminRoutes entry'
  const prefix = tablePaths.find((p) => p.endsWith('/') && navPath.startsWith(p))
  if (prefix) return `phoneAdminRoutes prefix ${prefix}`
  return null
}

const unresolved = navPaths.filter((p) => !resolves(p))

if (unresolved.length === 0) {
  console.log(
    `check-phone-admin-routes: OK — ${navPaths.length} phone admin links all resolve.`,
  )
  process.exit(0)
}

console.error('check-phone-admin-routes: FAILED')
console.error(
  'These phone drawer admin links have no phone route, so they render the',
)
console.error('"available on the web version" placeholder:',
)
for (const navPath of unresolved) console.error(`  - ${navPath}`)
console.error('')
console.error('Fix: add an entry to src/phone/phoneAdminRoutes.ts, or a dedicated')
console.error('<Route path="..."> in src/phone/PhoneApp.tsx.')
process.exit(1)
