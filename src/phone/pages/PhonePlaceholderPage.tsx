import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import PhoneDrawer from '../PhoneDrawer'
import { useState } from 'react'
import { neonButton, neonCard, neonTextGradient } from '../phoneTheme'

/**
 * Neon catch-all screen for any phone route that does not yet have a
 * dedicated phone page. Guarantees every role's menu link resolves to a
 * real phone screen (a representation of the web page) instead of the
 * homepage. As purpose-built phone pages are added, they take precedence
 * over this fallback via the explicit routes in PhoneApp.
 */
export default function PhonePlaceholderPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const title = location.pathname
    .replace(/^\//, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="relative min-h-screen w-full pb-20 text-white">
      <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className={`sticky top-0 z-50 flex items-center justify-between border-b bg-[#0a0420]/80 px-4 py-4 backdrop-blur border-[#BF00FF]/30`}>
        <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">☰</span>
        </button>
        <h1 className={`text-xl font-black tracking-tight ${neonTextGradient}`}>MAITROLL</h1>
        <div className="w-6" />
      </header>

      <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${neonCard}`}>
          <Construction className="text-[#00BFFF]" size={36} />
        </div>
        <h2 className="mt-5 text-2xl font-black">
          <span className={neonTextGradient}>{title || 'Home'}</span>
        </h2>
        <p className="mt-2 max-w-xs text-sm text-white/60">
          This is the phone view of the web page. A fully tailored phone screen is on the way.
        </p>
        <button onClick={() => navigate('/')} className={`mt-6 px-5 py-3 text-sm ${neonButton}`}>
          <ArrowLeft size={16} className="mr-2 inline" />
          Back to Home
        </button>
      </main>
    </div>
  )
}
