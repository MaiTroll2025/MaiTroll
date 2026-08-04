import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Menu,
  Home,
  LogIn,
  UserPlus,
  X,
  Video,
  Coins,
  Trophy,
  Gavel,
  Shield,
  Store,
  Wallet,
  Users,
  Newspaper,
  Briefcase,
  Building2,
  Landmark,
  Mail,
  Search,
  Sparkles,
  Radio,
  Gamepad2,
  Megaphone,
  Scale,
  Crown,
  Package,
  Star,
  Waves,
  LifeBuoy,
  Church,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { UserRole } from '@/lib/supabase'
import { canAccessTromail } from '@/lib/tromail'

type NavItem = {
  label: string
  path: string
  icon: React.ElementType
  requiresAuth?: boolean
  show?: boolean
  badge?: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function NavBubble() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const { balances } = useCoins()

  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    setIsOpen(false)
    setQuery('')
  }, [location.pathname])

  const handleNavigate = useCallback(
    (path: string) => {
      setIsOpen(false)
      navigate(path)
    },
    [navigate],
  )

  const isAdmin =
    profile?.role === UserRole.ADMIN ||
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    String(profile?.role ?? '') === 'admin' ||
    String(profile?.role ?? '') === 'superadmin' ||
    String(profile?.troll_role ?? '') === 'admin' ||
    String(profile?.troll_role ?? '') === 'ceo' ||
    profile?.is_admin ||
    profile?.is_superadmin

  const isBroadcaster =
    String(profile?.role ?? '') === 'broadcaster' ||
    String(profile?.troll_role ?? '') === 'broadcaster' ||
    profile?.is_broadcaster ||
    isAdmin

  const isOfficer =
    profile?.role === 'troll_officer' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.troll_role === 'troll_officer' ||
    profile?.troll_role === 'lead_troll_officer' ||
    profile?.is_lead_officer ||
    isAdmin

  const isSecretary =
    profile?.role === UserRole.SECRETARY ||
    String(profile?.role ?? '') === 'secretary' ||
    profile?.troll_role === UserRole.SECRETARY ||
    String(profile?.troll_role ?? '') === 'secretary' ||
    profile?.is_secretary ||
    isAdmin

  const trollCoins = Number(
    (balances as any)?.troll_coins ??
      (balances as any)?.balance ??
      (balances as any)?.coins ??
      0,
  )

  const hypeCoins = Number(
    (balances as any)?.hype_coins ??
      (balances as any)?.hypeCoins ??
      (balances as any)?.broadcast_hype_coins ??
      0,
  )

  const xpTotal = Number(profile?.xp ?? 0)
  const xpLevel = Number(profile?.level ?? 1)
  const xpInLevel = xpTotal % 1000
  const xpProgress = Math.min((xpInLevel / 1000) * 100, 100)
  const roleLabel = String(profile?.role || profile?.troll_role || 'Citizen')

  const sortItems = (items: NavItem[]) => {
    return [...items].sort((a, b) => a.label.localeCompare(b.label))
  }

  const navGroups: NavGroup[] = useMemo(() => {
    const groups: NavGroup[] = [
      {
        title: 'Broadcasting',
        items: [
          {
            label: 'Go Live',
            path: '/broadcast/setup',
            icon: Video,
            requiresAuth: true,
            show: isBroadcaster,
            badge: 'LIVE',
          },
          {
            label: 'Leagues',
            path: '/leagues',
            icon: Trophy,
            requiresAuth: true,
          },
        ],
      },
      {
        title: 'Careers + Work',
        items: [
          {
            label: 'Jobs',
            path: '/jobs',
            icon: Briefcase,
          },
          {
            label: 'Mai Class',
            path: '/mai-class',
            icon: Briefcase,
            requiresAuth: true,
          },
          {
            label: 'Organization',
            path: '/organization/dashboard',
            icon: Building2,
            requiresAuth: true,
          },
        ],
      },
      {
        title: 'City Core',
        items: [
          {
            label: 'Appeals',
            path: '/city-registry',
            icon: Scale,
            requiresAuth: true,
          },
          {
            label: 'Buy Coins',
            path: '/store',
            icon: Coins,
            requiresAuth: true,
          },
          {
            label: 'Home',
            path: '/home',
            icon: Home,
          },
          {
            label: 'Leaderboard',
            path: '/leaderboard',
            icon: Trophy,
            requiresAuth: true,
          },
          {
            label: 'Live Auctions',
            path: '/auctions',
            icon: Gavel,
            requiresAuth: true,
          },
          {
            label: 'Marketplace',
            path: '/marketplace',
            icon: Store,
            requiresAuth: true,
          },
          {
            label: 'Troll Court',
            path: '/troll-court',
            icon: Gavel,
            requiresAuth: true,
          },
          {
            label: 'Wallet',
            path: '/wallet',
            icon: Wallet,
            requiresAuth: true,
          },
        ],
      },
      {
        title: 'Community',
        items: [
          {
            label: 'Agencies',
            path: '/agencies',
            icon: Building2,
            requiresAuth: true,
          },
          {
            label: 'Insurance',
            path: '/insurance',
            icon: Shield,
            requiresAuth: true,
          },
          {
            label: 'Inventory',
            path: '/inventory',
            icon: Package,
            requiresAuth: true,
          },
          {
            label: 'Living',
            path: '/living',
            icon: Building2,
            requiresAuth: true,
          },

          {
            label: 'My Agency',
            path: '/agency-dashboard',
            icon: Users,
            requiresAuth: true,
          },
          {
            label: 'My Family',
            path: '/family/home',
            icon: Users,
            requiresAuth: true,
          },
          {
            label: 'Pool',
            path: '/pool',
            icon: Waves,
            requiresAuth: true,
          },
          {
            label: 'Safety',
            path: '/safety',
            icon: Shield,
            requiresAuth: true,
          },
          {
            label: 'Troll Church',
            path: '/church',
            icon: Church,
            requiresAuth: true,
          },
          {
            label: 'Troll Wheel',
            path: '/troll-wheel',
            icon: Gamepad2,
            requiresAuth: true,
          },
        ],
      },
      {
        title: 'Control Room',
        items: [
          {
            label: 'Agency HR',
            path: '/agency-hr-dashboard',
            icon: Briefcase,
            requiresAuth: true,
            show:
              isAdmin ||
              profile?.role === UserRole.AGENCY_HR_MANAGER ||
              String(profile?.role ?? '') === 'agency_hr_manager' ||
              String(profile?.role ?? '') === 'agency_hr',
          },
          {
            label: 'Government',
            path: '/government',
            icon: Landmark,
            requiresAuth: true,
            show: isAdmin || isOfficer || isSecretary,
          },
          {
            label: 'Inmates',
            path: '/inmates',
            icon: Users,
            requiresAuth: true,
            show: isAdmin || isOfficer,
          },
          {
            label: 'President',
            path: '/president',
            icon: Crown,
            requiresAuth: true,
          },
          {
            label: 'Secretary',
            path: '/secretary',
            icon: Briefcase,
            requiresAuth: true,
            show: isAdmin || isSecretary,
          },
          {
            label: 'Streams',
            path: '/government/streams',
            icon: Radio,
            requiresAuth: true,
            show: isAdmin || isOfficer || isSecretary,
          },
          {
            label: 'Treasury',
            path: '/president/treasury',
            icon: Wallet,
            requiresAuth: true,
            show:
              isAdmin ||
              profile?.role === UserRole.PRESIDENT ||
              profile?.troll_role === UserRole.PRESIDENT,
          },
          {
            label: 'Tromail',
            path: '/tromail',
            icon: Mail,
            requiresAuth: true,
            show: !!profile && canAccessTromail(profile),
          },
        ],
      },
      {
        title: 'News + Ads',
        items: [
          {
            label: 'Advertise',
            path: '/city-registry/advertise',
            icon: Megaphone,
            requiresAuth: true,
          },
          {
            label: 'TCNN',
            path: '/tcnn/dashboard',
            icon: Newspaper,
            requiresAuth: true,
          },
          {
            label: 'Trollified',
            path: '/trollifieds',
            icon: Store,
            requiresAuth: true,
          },
        ],
      },
      {
        title: 'Support',
        items: [
          {
            label: 'Support',
            path: '/support',
            icon: LifeBuoy,
          },
        ],
      },
    ]

    return groups
      .map((group) => ({
        ...group,
        items: sortItems(
          group.items.filter((item) => {
            if (item.show === false) return false
            if (item.requiresAuth && !user) return false
            return true
          }),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [user, profile, isAdmin, isBroadcaster, isOfficer, isSecretary])

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    if (!normalized) return navGroups

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.label.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [navGroups, query])

  if (!isMobile) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:hidden">
      {user && (
        <button
          type="button"
          onClick={() => handleNavigate('/broadcast/setup')}
          className="group inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_30px_rgba(34,211,238,0.35)] transition hover:scale-[1.03]"
        >
          <Video className="h-4 w-4" />
          Go Live
        </button>
      )}

      <div
        className={cx(
          'w-[min(92vw,360px)] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/95 shadow-[0_20px_70px_rgba(0,0,0,0.65),0_0_40px_rgba(34,211,238,0.16)] backdrop-blur-2xl transition-all duration-300',
          isOpen ? 'max-h-[72vh] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(168,85,247,0.18),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_40%)]" />

          <div className="relative border-b border-white/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">
                  Mai Troll OS
                </p>
                <h2 className="text-lg font-black text-white">Pages</h2>
                <p className="mt-1 text-sm text-slate-400">Quick access to your city world, role tools, and rewards.</p>
              </div>

              <div className="relative rounded-3xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-right text-white">
                <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100">Level</p>
                <p className="mt-1 text-sm font-black">{xpLevel}</p>
                <p className="mt-1 text-[10px] text-slate-300">{xpInLevel.toLocaleString()} / 1000 XP</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-950/80 p-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-900/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{xpInLevel.toLocaleString()} XP</span>
              <span>{Math.max(0, 1000 - xpInLevel).toLocaleString()} to next</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-cyan-300/15 bg-white/[0.04] p-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Troll Coins</p>
                <p className="mt-1 text-sm font-black text-white">{trollCoins.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/15 bg-white/[0.04] p-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200">Hype</p>
                <p className="mt-1 text-sm font-black text-white">{hypeCoins.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Role</p>
                <p className="truncate text-sm font-black text-white">{roleLabel}</p>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => handleNavigate('/profile/settings')}
                  className="rounded-2xl border border-white/10 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                >
                  My Profile
                </button>
              )}
            </div>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/50" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages..."
                className="w-full rounded-2xl border border-white/10 bg-black/35 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
              />
            </label>
          </div>

          <div className="relative max-h-[48vh] overflow-y-auto p-3">
            {!user && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigate('/auth?mode=login')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-black text-cyan-100"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('/auth?mode=signup')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-purple-300/20 bg-purple-400/10 px-3 py-3 text-sm font-black text-purple-100"
                >
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </button>
              </div>
            )}

            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <section key={group.title}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/40 to-transparent" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/70">
                      {group.title}
                    </p>
                    <span className="h-px flex-1 bg-gradient-to-l from-pink-300/40 to-transparent" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const active = location.pathname === item.path

                      return (
                        <button
                          key={`${group.title}-${item.path}`}
                          type="button"
                          onClick={() => handleNavigate(item.path)}
                          className={cx(
                            'relative flex min-h-[74px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border p-3 text-center transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 active:scale-[0.98] active:shadow-[0_0_20px_rgba(34,211,238,0.25),0_0_20px_rgba(34,253,154,0.15)]',
                            active
                              ? 'border-cyan-300/60 bg-cyan-300/15 text-white shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                              : 'border-white/10 bg-white/[0.045] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-white',
                          )}
                        >
                          {item.badge && (
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-pink-400 px-1.5 py-0.5 text-[8px] font-black text-white">
                              {item.badge}
                            </span>
                          )}

                          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-slate-950/55">
                            <Icon className="h-5 w-5" />
                          </span>

                          <span className="text-[10px] font-black leading-tight">
                            {item.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}

              {filteredGroups.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400">
                  No pages found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/35 bg-gradient-to-br from-slate-950 via-cyan-950 to-purple-950 text-white shadow-[0_0_32px_rgba(34,211,238,0.45),0_20px_60px_rgba(0,0,0,0.5)] ring-2 ring-white/10 transition hover:scale-105 hover:ring-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        aria-label={isOpen ? 'Close navigation bubble' : 'Open navigation bubble'}
      >
        {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
      </button>
    </div>
  )
}