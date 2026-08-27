import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PhoneDrawer from '../PhoneDrawer'
import { useAuthStore } from '../../lib/store'

const PUBLIC_ROUTES = new Set([
  '/', '/home', '/auth', '/login', '/support', '/legal', '/jobs', '/careers',
  '/auctions', '/troll-court', '/court', '/hytrogaming', '/podcast', '/safety',
  '/profile', '/search', '/state-rankings', '/verified-badge',
])

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true
  if (pathname.startsWith('/profile/')) return true
  if (pathname.startsWith('/live/')) return true
  if (pathname.startsWith('/watch/')) return true
  if (pathname.startsWith('/stream/')) return true
  if (pathname.startsWith('/broadcast/')) return true
  if (pathname.startsWith('/gaming/watch/')) return true
  if (pathname.startsWith('/podcast/')) return true
  if (pathname.startsWith('/troll-court/')) return true
  if (pathname.startsWith('/court/')) return true
  if (pathname.startsWith('/agency/')) return true
  if (pathname.startsWith('/agency-apply/')) return true
  if (pathname.startsWith('/music/')) return true
  if (pathname.startsWith('/utromail/')) return true
  if (pathname.startsWith('/tromail/')) return true
  if (pathname.startsWith('/academy/')) return true
  if (pathname.startsWith('/family/')) return true
  if (pathname.startsWith('/government/')) return true
  if (pathname.startsWith('/president/')) return true
  if (pathname.startsWith('/secretary/')) return true
  if (pathname.startsWith('/admin/')) return false
  if (pathname.startsWith('/officer/')) return false
  if (pathname.startsWith('/ceo-')) return false
  if (pathname.startsWith('/artist/')) return false
  if (pathname.startsWith('/academy/teacher/')) return false
  if (pathname.startsWith('/academy/classroom/')) return false
  return false
}

export default function PhoneWebPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = location.pathname

  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (!isPublicRoute(pathname) && !user) {
    return <Navigate to="/auth" replace />
  }

  const title = pathname === '/' ? 'Home' : pathname.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="relative min-h-screen w-full bg-[#0A0814] text-white">
      <PhoneDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0A0814]/90 px-4 py-3 backdrop-blur-xl">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
        >
          <span className="text-lg">☰</span>
        </button>

        <h1 className="text-sm font-black uppercase tracking-widest text-white/80">
          {title}
        </h1>

        <div className="w-9" />
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <span className="text-2xl font-black text-white/20">📄</span>
        </div>
        <h2 className="mt-4 text-lg font-black text-white/90">{title}</h2>
        <p className="mt-2 max-w-xs text-xs text-white/50">
          This page is available on the web version. A dedicated phone screen is coming soon.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 rounded-xl border border-[#00BFFF]/30 bg-[#00BFFF]/10 px-4 py-2 text-xs font-bold text-[#00BFFF]"
        >
          Go to Home
        </button>
      </main>
    </div>
  )
}
