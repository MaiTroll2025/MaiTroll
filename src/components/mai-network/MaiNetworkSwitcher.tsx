/**
 * MAI Network App Switcher
 * Universal component for navigating between all MAI platform applications.
 *
 * Mobile-first bottom sheet with fixed internal scrolling.
 */

import React, { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Store,
  Apple,
  Globe,
  Zap,
  Radio,
  Building2,
  Heart,
  CreditCard,
  Car,
  Stethoscope,
  Cookie,
  LogIn,
  User,
} from 'lucide-react'

export type AppStatus = 'live' | 'beta' | 'coming_soon'
export type AppTheme =
  | 'city'
  | 'premium'
  | 'corporate'
  | 'auto'
  | 'health'
  | 'food'
  | 'payments'
  | 'default'

export type PlatformTheme = 'troll-city' | 'maiplay' | 'maicorp' | 'default'

export interface MaiApp {
  id: string
  name: string
  tagline: string
  category: string
  websiteUrl: string
  googlePlayUrl?: string
  appleStoreUrl?: string
  status: AppStatus
  theme: AppTheme
  icon?: React.ReactNode
}

export interface MaiNetworkSwitcherProps {
  apps?: MaiApp[]
  isOpen?: boolean
  onClose?: () => void
  platformTheme?: PlatformTheme
  user?: any
  onSignIn?: () => void
}

const DEFAULT_MAI_APPS: MaiApp[] = [
  {
    id: 'troll-city',
    name: 'MaiTroll',
    tagline: 'Go live, earn coins, enter the virtual city.',
    category: 'Live Social City',
    websiteUrl: 'https://maiMaiTroll.com',
    googlePlayUrl: 'https://play.google.com/store/apps/details?id=com.Mai Troll.twa',
    appleStoreUrl: '',
    status: 'live',
    theme: 'city',
  },
  {
    id: 'maiplay',
    name: 'MaiPlay',
    tagline: 'Shorts, movies, music, and creator monetization.',
    category: 'Creator Video Platform',
    websiteUrl: 'https://maiplay.cloud',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'beta',
    theme: 'premium',
  },
  {
    id: 'maicorp',
    name: 'MaiCorp',
    tagline: 'The official home of the MAI ecosystem.',
    category: 'Corporate',
    websiteUrl: 'https://maicorp.online',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'live',
    theme: 'corporate',
  },
  {
    id: 'udryve-auto',
    name: 'UDryve Auto',
    tagline: 'Automotive services powered by MAI.',
    category: 'Auto',
    websiteUrl: 'https://udryveauto.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'auto',
  },
  {
    id: 'udryve-health',
    name: 'UDryve Health',
    tagline: 'Health services in the UDryve network.',
    category: 'Health',
    websiteUrl: 'https://udryvehealth.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'health',
  },
  {
    id: 'udryve-food',
    name: 'UDryve Food',
    tagline: 'Food delivery and local food services.',
    category: 'Food',
    websiteUrl: 'https://udryvefood.com',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'food',
  },
  {
    id: 'maipay',
    name: 'MaiPay',
    tagline: 'Coins, payouts, and future MAI payments.',
    category: 'Payments',
    websiteUrl: 'https://maipay.app',
    googlePlayUrl: '',
    appleStoreUrl: '',
    status: 'coming_soon',
    theme: 'payments',
  },
]

const getPlatformTheme = (platform: PlatformTheme) => {
  const themes = {
    'troll-city': {
      primaryGradient: 'from-purple-600 via-pink-600 to-cyan-500',
      buttonGlow: 'shadow-[0_0_30px_rgba(168,85,247,0.4)]',
      headerGlow: 'shadow-[0_0_25px_rgba(147,51,234,0.4)]',
    },
    maiplay: {
      primaryGradient: 'from-red-600 via-rose-600 to-yellow-500',
      buttonGlow: 'shadow-[0_0_30px_rgba(239,68,68,0.4)]',
      headerGlow: 'shadow-[0_0_25px_rgba(234,179,8,0.4)]',
    },
    maicorp: {
      primaryGradient: 'from-slate-600 via-zinc-600 to-neutral-500',
      buttonGlow: 'shadow-[0_0_30px_rgba(100,116,139,0.4)]',
      headerGlow: 'shadow-[0_0_25px_rgba(148,163,184,0.4)]',
    },
    default: {
      primaryGradient: 'from-purple-600 via-pink-600 to-cyan-500',
      buttonGlow: 'shadow-[0_0_30px_rgba(147,51,234,0.4)]',
      headerGlow: 'shadow-[0_0_25px_rgba(147,51,234,0.4)]',
    },
  }

  return themes[platform] || themes.default
}

const getThemeStyles = (theme: AppTheme) => {
  const themes: Record<AppTheme, { gradient: string; glow: string; icon: React.ReactNode }> = {
    city: {
      gradient: 'from-purple-600 via-blue-600 to-cyan-500',
      glow: 'shadow-[0_0_20px_rgba(6,182,212,0.2)]',
      icon: <Radio className="h-4 w-4 text-cyan-400" />,
    },
    premium: {
      gradient: 'from-red-600 via-rose-600 to-yellow-500',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]',
      icon: <Heart className="h-4 w-4 text-yellow-400" />,
    },
    corporate: {
      gradient: 'from-slate-600 via-gray-600 to-zinc-500',
      glow: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]',
      icon: <Building2 className="h-4 w-4 text-slate-300" />,
    },
    auto: {
      gradient: 'from-blue-600 via-cyan-600 to-teal-500',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]',
      icon: <Car className="h-4 w-4 text-blue-400" />,
    },
    health: {
      gradient: 'from-emerald-600 via-green-600 to-lime-500',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
      icon: <Stethoscope className="h-4 w-4 text-emerald-400" />,
    },
    food: {
      gradient: 'from-orange-600 via-amber-600 to-yellow-500',
      glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]',
      icon: <Cookie className="h-4 w-4 text-orange-400" />,
    },
    payments: {
      gradient: 'from-green-600 via-emerald-600 to-cyan-500',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.2)]',
      icon: <CreditCard className="h-4 w-4 text-green-400" />,
    },
    default: {
      gradient: 'from-purple-600 via-pink-600 to-cyan-500',
      glow: 'shadow-[0_0_20px_rgba(147,51,234,0.2)]',
      icon: <Globe className="h-4 w-4 text-purple-400" />,
    },
  }

  return themes[theme] || themes.default
}

const getStatusBadge = (status: AppStatus) => {
  const statusMap = {
    live: {
      bg: 'bg-green-500/20 border-green-500/30 text-green-400',
      label: 'LIVE',
    },
    beta: {
      bg: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
      label: 'BETA',
    },
    coming_soon: {
      bg: 'bg-slate-500/20 border-slate-500/30 text-slate-400',
      label: 'COMING SOON',
    },
  }

  return statusMap[status]
}

function openExternal(url?: string) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function AppCard({ app }: { app: MaiApp }) {
  const theme = getThemeStyles(app.theme)
  const status = getStatusBadge(app.status)

  return (
    <article className="group rounded-xl border border-white/10 bg-slate-900/70 p-3 shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(147,51,234,0.15)]">
      <div className="mb-2 flex items-center gap-2">
        <div className={`h-9 w-9 flex-shrink-0 rounded-lg bg-gradient-to-br ${theme.gradient} p-[1.5px] ${theme.glow}`}>
          <div className="flex h-full w-full items-center justify-center rounded-[5px] bg-slate-900/90">
            {app.icon || theme.icon}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-black text-white">{app.name}</h3>
            <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${status.bg}`}>
              {status.label}
            </span>
          </div>
          <p className="truncate text-[10px] text-slate-400">{app.category}</p>
        </div>
      </div>

      <p className="mb-3 line-clamp-2 text-xs leading-snug text-slate-300">
        {app.tagline}
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => openExternal(app.websiteUrl)}
          className="flex items-center justify-center gap-1 rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-600/80 to-pink-600/80 px-2 py-2 text-[10px] font-bold text-white transition hover:from-purple-600 hover:to-pink-600"
        >
          <Globe className="h-3 w-3" />
          Site
        </button>

        {app.googlePlayUrl ? (
          <button
            type="button"
            onClick={() => openExternal(app.googlePlayUrl)}
            className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-800/80 px-2 py-2 text-[10px] font-bold text-white transition hover:bg-slate-700/80"
          >
            <Store className="h-3 w-3" />
            Play
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-slate-700/30 bg-slate-800/50 px-2 py-2 text-[10px] font-bold text-slate-500 opacity-60"
          >
            Play
          </button>
        )}

        {app.appleStoreUrl ? (
          <button
            type="button"
            onClick={() => openExternal(app.appleStoreUrl)}
            className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-800/80 px-2 py-2 text-[10px] font-bold text-white transition hover:bg-slate-700/80"
          >
            <Apple className="h-3 w-3" />
            iOS
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-slate-700/30 bg-slate-800/50 px-2 py-2 text-[10px] font-bold text-slate-500 opacity-60"
          >
            iOS
          </button>
        )}
      </div>
    </article>
  )
}

function AppSection({
  title,
  dotClass,
  apps,
}: {
  title: string
  dotClass: string
  apps: MaiApp[]
}) {
  if (apps.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className={`h-2 w-2 rounded-full ${dotClass}`} />
        <h3 className="text-sm font-black uppercase tracking-wider text-white">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  )
}

export default function MaiNetworkSwitcher({
  apps = DEFAULT_MAI_APPS,
  isOpen = false,
  onClose,
  platformTheme = 'default',
  user,
  onSignIn,
}: MaiNetworkSwitcherProps) {
  const theme = getPlatformTheme(platformTheme)

  const liveApps = useMemo(() => apps.filter((app) => app.status === 'live'), [apps])
  const betaApps = useMemo(() => apps.filter((app) => app.status === 'beta'), [apps])
  const comingSoonApps = useMemo(
    () => apps.filter((app) => app.status === 'coming_soon'),
    [apps]
  )

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    const frame = requestAnimationFrame(() => {
      const contentEl = document.querySelector('.mai-network-content')
      if (contentEl) contentEl.scrollTop = 0
    })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [isOpen])

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn()
      return
    }

    console.warn('[MaiNetworkSwitcher] No onSignIn handler was provided.')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-[70] flex h-[85dvh] max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-slate-950 shadow-2xl shadow-black"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="MAI Network app switcher"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className="flex-shrink-0 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${theme.primaryGradient} p-[2px] ${theme.headerGlow}`}>
                      <div className="flex h-full w-full items-center justify-center rounded-[9px] bg-slate-900">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-base font-black text-white">MAI Network</h2>
                      <p className="text-[10px] text-slate-400">
                        One account. Multiple platforms.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close MAI Network app switcher"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              <main className="mai-network-content min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-24 [-webkit-overflow-scrolling:touch]">
                <div className="mx-auto max-w-7xl space-y-6">
                  <div className="py-2 text-center">
                    <p className="text-sm text-slate-300">
                      Powered by{' '}
                      <span className="font-bold text-purple-400">MAI</span>. One account
                      across all platforms.
                    </p>
                  </div>

                  {!user && (
                    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-600/10 to-cyan-600/10 p-4 text-center">
                      <div className="mb-3 flex items-center justify-center gap-3">
                        <User className="h-8 w-8 text-purple-400" />
                        <div className="text-left">
                          <h3 className="text-sm font-black text-white">
                            Sign in to access all MAI apps
                          </h3>
                          <p className="text-xs text-slate-400">
                            Your account works everywhere
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSignIn}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${theme.primaryGradient} px-4 py-2.5 font-bold text-white transition hover:opacity-90 ${theme.buttonGlow}`}
                      >
                        <LogIn className="h-4 w-4" />
                        Sign In with Google
                      </button>
                    </div>
                  )}

                  <AppSection
                    title="Live Now"
                    dotClass="bg-green-500 animate-pulse"
                    apps={liveApps}
                  />

                  <AppSection
                    title="In Beta"
                    dotClass="bg-yellow-500 animate-pulse"
                    apps={betaApps}
                  />

                  <AppSection
                    title="Coming Soon"
                    dotClass="bg-slate-500"
                    apps={comingSoonApps}
                  />
                </div>
              </main>

              <footer className="flex-shrink-0 border-t border-white/10 bg-slate-900/90 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center backdrop-blur-xl">
                <p className="text-xs text-slate-500">
                  Powered by <span className="font-bold text-purple-400">MAI</span>
                </p>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}