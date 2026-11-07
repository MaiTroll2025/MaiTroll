import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ElementType } from 'react'
import {
  Calendar,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Eye,
  Gem,
  Home,
  LayoutGrid,
  Mic,
  Newspaper,
  PenSquare,
  Plus,
  Radio,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trophy,
  UserRound,
  Building2,
} from 'lucide-react'

import FloatingPoster from './FloatingPoster'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { isAdminEmail, supabase } from '@/lib/supabase'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useIsActiveFounder } from '@/hooks/useFounderProgram'
import type { TabType } from '@/types/homeTabs'

/**
 * Counts must be produced by the site's REAL cross-platform page-presence
 * service. A page view, stream viewer count, or registered-account total is
 * NOT a valid substitute for a live per-page session count.
 *
 * The service providing this data must:
 * - Track web, mobile web, iOS, and Android sessions, including anonymous ones.
 * - Count active sessions per page (with disconnect/TTL cleanup).
 * - Deduplicate reconnects and apply an explicit session-counting policy.
 * - Authorize admin-only reads on the SERVER, never just in React.
 * - Provide only aggregate counts, not other people's session identities.
 *
 * This component deliberately shows em dashes until real data is supplied;
 * it NEVER presents fake "live" numbers.
 */
export interface SidebarPagePresence {
  users: number
  anonymous: number
}

export type SidebarPresenceKey =
  | 'home'
  | 'wall'
  | 'live'
  | 'calendar'
  | 'universe'
  | 'leagues'
  | 'troll-wheel'
  | 'mai-business'
  | 'mai-life'
  | 'mai-sing-off'
  | 'founder'
  | 'president'

export type SidebarPresenceCounts = Partial<Record<SidebarPresenceKey, SidebarPagePresence>>

interface LeftNavSidebarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  liveCount: number
  battleCount: number
  followersLiveCount: number
  presidentTabLabel: string
  showPresidentTab: boolean
  wallNotificationCount?: number

  /** Existing More panel/drawer; keep its current event contract. */
  onMoreClick?: () => void

  /** Use the app's actual registered Coin Store URL if not /store. */
  coinStorePath?: string
  /** Optional alternative if the parent has its own Coin Store navigation. */
  onBuyCoinsClick?: () => void

  /** Aggregate data from an existing authenticated ADMIN-ONLY presence API. */
  pagePresenceCounts?: SidebarPresenceCounts

  /** Optional existing President route; do not invent an unknown route. */
  presidentTabPath?: string
}

type TileTone = 'cyan' | 'pink' | 'green' | 'amber' | 'purple' | 'teal' | 'blue'

interface NavTile {
  key: SidebarPresenceKey
  id?: TabType
  label: string
  icon: ElementType
  description: string
  tone: TileTone
  count?: number
  path?: string
}

const TONE_CLASSES: Record<TileTone, string> = {
  cyan: 'border-cyan-400/65 bg-gradient-to-b from-cyan-400/[0.11] to-slate-950/80 text-cyan-200 hover:border-cyan-300 hover:shadow-[0_0_16px_rgba(34,211,238,0.21)]',
  pink: 'border-fuchsia-400/65 bg-gradient-to-b from-fuchsia-400/[0.11] to-slate-950/80 text-fuchsia-200 hover:border-fuchsia-300 hover:shadow-[0_0_16px_rgba(232,121,249,0.21)]',
  green: 'border-emerald-400/65 bg-gradient-to-b from-emerald-400/[0.10] to-slate-950/80 text-emerald-200 hover:border-emerald-300 hover:shadow-[0_0_16px_rgba(52,211,153,0.20)]',
  amber: 'border-amber-400/65 bg-gradient-to-b from-amber-400/[0.10] to-slate-950/80 text-amber-200 hover:border-amber-300 hover:shadow-[0_0_16px_rgba(251,191,36,0.20)]',
  purple: 'border-violet-400/65 bg-gradient-to-b from-violet-400/[0.12] to-slate-950/80 text-violet-200 hover:border-violet-300 hover:shadow-[0_0_16px_rgba(167,139,250,0.20)]',
  teal: 'border-teal-400/65 bg-gradient-to-b from-teal-400/[0.10] to-slate-950/80 text-teal-200 hover:border-teal-300 hover:shadow-[0_0_16px_rgba(45,212,191,0.20)]',
  blue: 'border-blue-400/65 bg-gradient-to-b from-blue-400/[0.10] to-slate-950/80 text-blue-200 hover:border-blue-300 hover:shadow-[0_0_16px_rgba(96,165,250,0.20)]',
}

function formatCoins(amount: number): string {
  return Math.floor(Number.isFinite(amount) ? amount : 0).toLocaleString()
}

function formatBadge(value?: number): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value > 99 ? '99+' : String(Math.floor(value))
}

function formatPresence(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—'
  return Math.floor(value).toLocaleString()
}

export default function LeftNavSidebar({
  activeTab,
  setActiveTab,
  liveCount,
  battleCount,
  followersLiveCount,
  presidentTabLabel,
  showPresidentTab,
  wallNotificationCount = 0,
  onMoreClick,
  coinStorePath = '/store',
  onBuyCoinsClick,
  pagePresenceCounts,
  presidentTabPath,
}: LeftNavSidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, profile } = useAuthStore()
  const { balances, refreshCoins } = useCoins()
  const equippedFrame = useUserFrame(user?.id)
  const isActiveFounder = useIsActiveFounder(user?.id)

  const role = String(profile?.role || '').toLowerCase()
  const trollRole = String(profile?.troll_role || '').toLowerCase()
  const isAdmin = isAdminEmail(user?.email) || Boolean(
    profile?.is_admin ||
    (profile as any)?.is_superadmin ||
    ['admin', 'superadmin', 'owner', 'ceo'].includes(role) ||
    ['admin', 'superadmin', 'owner', 'ceo'].includes(trollRole)
  )
  const canSeeFounderHub = isActiveFounder || isAdminEmail(user?.email) || Boolean(
    profile?.is_admin ||
    (profile as any)?.is_superadmin ||
    ['admin', 'superadmin', 'owner', 'ceo', 'hr_admin'].includes(role) ||
    ['admin', 'superadmin', 'owner', 'ceo'].includes(trollRole)
  )

  const [calendarEventCount, setCalendarEventCount] = useState(0)
  const trollCoins = Number((balances as any)?.troll_coins ?? 0)
  const trollmonds = Number((profile as any)?.trollmonds ?? 0)
  const crowns = Number((profile as any)?.crowns ?? 0)
  const displayName = profile?.display_name || profile?.username || 'Citizen'
  const avatarUrl = profile?.avatar_url

  // Preserve existing live Troll Coin refresh behavior.
  useEffect(() => {
    if (user?.id) void refreshCoins()
  }, [user?.id, refreshCoins])

  // This is an UPCOMING EVENT badge, not a per-page presence count.
  useEffect(() => {
    let cancelled = false
    const loadCalendarCount = async () => {
      try {
        const now = new Date().toISOString()
        const { count, error } = await supabase
          .from('mai_calendar_events')
          .select('id', { count: 'exact', head: true })
          .eq('visibility', 'public')
          .eq('status', 'upcoming')
          .gte('starts_at', now)
        if (!cancelled && !error) setCalendarEventCount(count ?? 0)
      } catch {
        // A failed notification badge must not break navigation.
      }
    }
    void loadCalendarCount()
    return () => { cancelled = true }
  }, [])

  const mainTiles: NavTile[] = [
    {
      key: 'home', id: 'home', label: 'Home', icon: Home, tone: 'cyan',
      description: 'Your MaiTroll homepage',
    },
    {
      key: 'wall', label: 'Wall', icon: PenSquare, tone: 'pink', path: '/wall',
      count: wallNotificationCount, description: 'Community wall and posts',
    },
    {
      key: 'live', id: 'live', label: 'Live Now', icon: Radio, tone: 'pink',
      count: liveCount + battleCount, description: 'Watch live streams',
    },
    {
      key: 'calendar', id: 'calendar', label: 'Calendar', icon: Calendar, tone: 'green',
      count: calendarEventCount, description: 'Events and live stream schedules',
    },
    {
      key: 'universe', id: 'universe', label: 'Universe Battles', icon: Sparkles, tone: 'amber',
      count: followersLiveCount, description: 'Universe-wide battles and events',
    },
    {
      key: 'leagues', id: 'leagues', label: 'T League', icon: Trophy, tone: 'purple',
      description: 'Compete in leagues',
    },
  ]

  const communityTiles: NavTile[] = [
    {
      key: 'troll-wheel', label: 'Troll Wheel', icon: Shuffle, tone: 'cyan', path: '/troll-wheel',
      description: 'Spin the Troll Wheel',
    },
    {
      key: 'mai-business', label: 'MAI Business', icon: Building2, tone: 'teal', path: '/mai-business',
      description: 'MaiTroll business tools',
    },
    {
      key: 'mai-life', label: 'MaiLife', icon: Sparkles, tone: 'pink', path: '/mai-life',
      description: 'Your city identity and progression',
    },
    {
      key: 'mai-sing-off', label: 'Mai Talent Show', icon: Mic, tone: 'blue', path: '/mai-sing-off',
      description: 'Mai Talent Show competitions',
    },
  ]

  const entertainmentTiles: NavTile[] = [
    ...(canSeeFounderHub ? [{
      key: 'founder' as const, label: 'Founder Hub', icon: Sparkles, tone: 'purple' as const,
      path: '/founder', description: 'Founder hub and tools',
    }] : []),
    // Only include President when the caller supplies its VERIFIED route.
    ...(showPresidentTab && presidentTabPath ? [{
      key: 'president' as const, label: presidentTabLabel || 'President', icon: Crown,
      tone: 'amber' as const, path: presidentTabPath,
      description: 'Open the president page',
    }] : []),
  ]

  const openTile = (tile: NavTile) => {
    if (tile.path) navigate(tile.path)
    else if (tile.id) setActiveTab(tile.id)
  }

  const openMore = () => {
    // Preserve the existing event and callback used by the current app.
    window.dispatchEvent(new Event('open-more-panel'))
    onMoreClick?.()
  }

  const openCoinStore = () => {
    if (onBuyCoinsClick) onBuyCoinsClick()
    else navigate(coinStorePath)
  }

  const renderTile = (tile: NavTile) => {
    const Icon = tile.icon
    const selected = tile.id
      ? activeTab === tile.id
      : Boolean(tile.path && (pathname === tile.path || pathname.startsWith(`${tile.path}/`)))
    const badge = formatBadge(tile.count)
    // Presence is intentionally NOT inferred from notification, battle, or live counts.
    const presence = isAdmin ? pagePresenceCounts?.[tile.key] : undefined

    return (
      <button
        key={tile.key}
        type="button"
        title={tile.description}
        aria-label={`${tile.label}${badge ? `, ${badge} updates` : ''}`}
        aria-current={selected ? 'page' : undefined}
        onClick={() => openTile(tile)}
        className={[
          'group relative flex min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-1.5 py-2.5 text-center',
          'min-h-[99px] transition-all duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101827]',
          TONE_CLASSES[tile.tone],
          selected ? 'ring-1 ring-cyan-300/80 shadow-[0_0_13px_rgba(34,211,238,0.23)]' : '',
        ].join(' ')}
      >
        {badge && (
          <span
            aria-label={`${badge} updates`}
            className="absolute right-1.5 top-1.5 z-10 min-w-5 rounded-full bg-fuchsia-600 px-1 py-0.5 text-[9px] font-extrabold leading-4 text-white shadow-sm"
          >
            {badge}
          </span>
        )}
        <Icon className="h-[21px] w-[21px] shrink-0 drop-shadow-[0_0_7px_currentColor]" strokeWidth={2.1} aria-hidden="true" />
        <span className="line-clamp-2 w-full text-[10.5px] font-extrabold leading-[1.15] text-slate-50">
          {tile.label}
        </span>
        {isAdmin && (
          <div
            className="mt-0.5 flex max-w-full items-center justify-center gap-1 text-[8.5px] font-bold leading-none text-slate-300"
            title="Current authenticated and anonymous sessions on this page (server-verified counts only)"
          >
            <span className="inline-flex min-w-0 items-center gap-0.5" title="Signed-in users">
              <UserRound className="h-3 w-3 shrink-0 text-sky-300" aria-hidden="true" />
              {formatPresence(presence?.users)}
            </span>
            <span aria-hidden="true" className="text-slate-600">|</span>
            <span className="inline-flex min-w-0 items-center gap-0.5" title="Anonymous users">
              <Eye className="h-3 w-3 shrink-0 text-fuchsia-300" aria-hidden="true" />
              {formatPresence(presence?.anonymous)}
            </span>
          </div>
        )}
      </button>
    )
  }

  const renderGroup = (heading: string, tiles: NavTile[]) => tiles.length > 0 && (
    <section key={heading} aria-label={heading} className="mt-3 first:mt-0">
      <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[.13em] text-slate-400">
        {heading}
      </p>
      {/* 2 columns, continuing downward; NOT a separate admin dashboard. */}
      <div className="grid grid-cols-2 gap-2">{tiles.map(renderTile)}</div>
    </section>
  )

  // Total of listed page sessions, NOT an entire-site user count.
  // Unavailable counts are excluded; do not claim missing data means 0 users.
  const shownTiles = [...mainTiles, ...communityTiles, ...entertainmentTiles]
  const allCountsAvailable = shownTiles.length > 0 && shownTiles.every(
    (tile) => pagePresenceCounts?.[tile.key] &&
      Number.isFinite(pagePresenceCounts?.[tile.key]?.users) &&
      Number.isFinite(pagePresenceCounts?.[tile.key]?.anonymous)
  )
  const totalUsers = allCountsAvailable
    ? shownTiles.reduce((sum, tile) => sum + (pagePresenceCounts?.[tile.key]?.users ?? 0), 0)
    : undefined
  const totalAnonymous = allCountsAvailable
    ? shownTiles.reduce((sum, tile) => sum + (pagePresenceCounts?.[tile.key]?.anonymous ?? 0), 0)
    : undefined

  const sidebarCard = 'border-white/[0.09] bg-[#101827]/95 shadow-[0_18px_45px_rgba(0,0,0,0.24)]'

  return (
    <aside
      aria-label="MaiTroll desktop navigation"
      className="pointer-events-auto hidden lg:sticky lg:top-3 lg:flex lg:[height:calc(var(--tc-sidebar-vh,100dvh)-84px)] lg:w-[236px] lg:shrink-0 lg:self-start lg:flex-col xl:w-[248px] rounded-xl bg-[#0b1220]/95"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pb-3 pr-1 [scrollbar-color:rgba(148,163,184,.5)_transparent] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        {/* KEEP the existing MaiTroll header as it is. */}
        <div className={`relative shrink-0 overflow-hidden rounded-2xl border p-4 ${sidebarCard}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-9 -top-11 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400/25 to-indigo-400/15 text-sky-200 ring-1 ring-sky-300/20">
              <Compass className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-black tracking-tight text-slate-50">MaiTroll</p>
              <p className="text-[10px] font-medium text-slate-400">Your city, your community</p>
            </div>
          </div>
        </div>

        {/* KEEP profile, avatar, Troll Coins and Trollmonds; only make Coins clickable. */}
        {user && (
          <section aria-label="Citizen profile and balances" className={`shrink-0 rounded-2xl border p-3.5 ${sidebarCard}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">
                <Newspaper className="h-3.5 w-3.5" /> Citizen profile
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0">
                {avatarUrl ? (
                  <ProfileFrame frame={equippedFrame} avatarUrl={avatarUrl} username={displayName} size="sm" fillParent />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg font-black text-white shadow-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p title={displayName} className="truncate text-[13px] font-bold text-slate-50">{displayName}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">MaiTroll Citizen</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
              <button
                type="button"
                onClick={openCoinStore}
                title="Buy Troll Coins — open the Coin Store"
                aria-label={`${formatCoins(trollCoins)} Troll Coins. Buy Coins`}
                className="group min-w-0 rounded-xl bg-amber-400/[0.065] px-2.5 py-2 text-left outline-none transition-colors hover:bg-amber-400/[0.13] focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <div className="mb-1 flex items-center gap-1.5 text-amber-500">
                  <Coins className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[9px] font-semibold text-slate-400">Troll Coins</span>
                </div>
                <p className="truncate text-[13px] font-extrabold tabular-nums text-slate-50">{formatCoins(trollCoins)}</p>
                <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-300 group-hover:text-amber-200">
                  <Plus className="h-3 w-3" aria-hidden="true" /> Buy Coins
                </span>
              </button>
              <div title={`${trollmonds.toLocaleString()} Trollmonds`} className="min-w-0 rounded-xl bg-violet-400/[0.065] px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-violet-400">
                  <Gem className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[9px] font-semibold text-slate-400">Trollmonds</span>
                </div>
                <p className="truncate text-[13px] font-extrabold tabular-nums text-slate-50">{formatCoins(trollmonds)}</p>
              </div>
            </div>
            {crowns > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-yellow-400/[0.065] px-2.5 py-2 text-[11px] text-amber-200">
                <span className="flex items-center gap-1.5 font-semibold"><Crown className="h-3.5 w-3.5" /> Crowns</span>
                <span className="font-black tabular-nums">{formatCoins(crowns)}</span>
              </div>
            )}
          </section>
        )}

        <nav aria-label="Main navigation" className={`shrink-0 rounded-2xl border px-2.5 py-3 ${sidebarCard}`}>
          <div className="mb-3 flex items-center gap-2 px-1">
            <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Navigation</span>
          </div>

          {renderGroup('Main pages', mainTiles)}
          {renderGroup('City & community', communityTiles)}
          {renderGroup('Entertainment & access', entertainmentTiles)}

          {/* More uses the EXISTING drawer to reach the rest of the app. */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={openMore}
              title="Open More Pages and Tools"
              className={`group flex min-h-[66px] min-w-0 items-center gap-1.5 rounded-xl border border-blue-400/60 bg-blue-400/[0.08] px-2 text-left text-slate-50 outline-none hover:bg-blue-400/[0.15] focus-visible:ring-2 focus-visible:ring-sky-400 ${!isAdmin ? 'col-span-2' : ''}`}
            >
              <LayoutGrid className="h-5 w-5 shrink-0 text-sky-300" />
              <span className="min-w-0 flex-1 text-[11px] font-bold">More <span className="block text-[9px] font-normal text-slate-400">All pages & tools</span></span>
              <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/site-updates')}
                title="Manage public website updates and blog"
                className="flex min-h-[66px] min-w-0 items-center gap-1.5 rounded-xl border border-purple-400/60 bg-purple-400/[0.08] px-2 text-left text-slate-50 outline-none hover:bg-purple-400/[0.15] focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <Newspaper className="h-5 w-5 shrink-0 text-purple-300" />
                <span className="min-w-0 flex-1 text-[10px] font-bold leading-tight">Website Updates &amp; Blog</span>
              </button>
            )}
          </div>
        </nav>

        {isAdmin && (
          <section aria-label="Admin live page overview" className="shrink-0 rounded-xl border border-purple-500/50 bg-purple-500/[0.08] p-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-50">
              <ShieldCheck className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
              Admin Live Overview
            </div>
            <p className="mb-2 text-[9px] text-slate-400">Sessions on listed pages only</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-cyan-500/[0.09] px-2 py-1.5 text-center">
                <span className="block text-[13px] font-extrabold text-cyan-200 tabular-nums">{formatPresence(totalUsers)}</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-slate-300"><UserRound className="h-3 w-3" /> Users</span>
              </div>
              <div className="rounded-lg bg-emerald-500/[0.09] px-2 py-1.5 text-center">
                <span className="block text-[13px] font-extrabold text-emerald-200 tabular-nums">{formatPresence(totalAnonymous)}</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-slate-300"><Eye className="h-3 w-3" /> Anon</span>
              </div>
            </div>
          </section>
        )}

        {/* Preserve the existing poster; it is not the Coin Store modal. */}
        <div className="min-w-0 shrink-0"><FloatingPoster /></div>
      </div>
    </aside>
  )
}
