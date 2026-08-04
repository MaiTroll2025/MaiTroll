import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Scale,
  Shield,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../lib/store'

interface LegalLayoutProps {
  children: React.ReactNode
}

const navItems = [
  {
    path: '/legal/terms',
    label: 'Terms of Service',
    description: 'Platform rules',
    icon: FileText,
  },
  {
    path: '/legal/privacy',
    label: 'Privacy Policy',
    description: 'Data and privacy',
    icon: Shield,
  },
  {
    path: '/legal/refunds',
    label: 'Refund & Purchase Policy',
    description: 'Coins and purchases',
    icon: DollarSign,
  },
  {
    path: '/legal/payouts',
    label: 'Creator & Payout Policy',
    description: 'Cashouts and creator pay',
    icon: Scale,
  },
  {
    path: '/legal/safety',
    label: 'Safety & Community Guidelines',
    description: 'Conduct and moderation',
    icon: Shield,
  },
]

export default function LegalLayout({ children }: LegalLayoutProps) {
  const location = useLocation()
  const { user } = useAuthStore()

  const backTo = user ? '/' : '/auth'
  const backLabel = user ? 'Back to App' : 'Back to Login'

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#030712] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[12rem] h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/15 blur-[120px]" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_35%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:100%_100%,42px_42px,42px_42px]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:py-10">
        <aside className="w-full rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl lg:sticky lg:top-6 lg:h-fit lg:max-w-[20rem]">
          <Link
            to={backTo}
            className="group mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>{backLabel}</span>
          </Link>

          <div className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
              Mai Troll
            </p>

            <h2 className="mt-2 text-xl font-black tracking-tight text-white">
              Policy Center
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Terms, refunds, payouts, privacy, and safety rules for the Troll
              City world.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`)

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'group flex items-center gap-3 rounded-2xl border px-3 py-3 transition',
                    isActive
                      ? 'border-cyan-300/40 bg-cyan-400/15 text-white shadow-lg shadow-cyan-950/30'
                      : 'border-white/5 bg-white/[0.03] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-white',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition',
                      isActive
                        ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-200'
                        : 'border-white/10 bg-slate-900/70 text-slate-400 group-hover:border-cyan-300/30 group-hover:text-cyan-200',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-slate-500 group-hover:text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="prose prose-invert max-w-none prose-headings:text-white prose-a:text-cyan-300 prose-strong:text-white prose-li:text-slate-300 prose-p:text-slate-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}