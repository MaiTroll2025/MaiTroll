import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Mic, Radio, Sparkles, FileText, Trophy, PenSquare, Newspaper, Coins, Gem, Crown, Plus, Building2, Shuffle, ChevronRight, Compass, ExternalLink, LayoutGrid } from 'lucide-react';

import FloatingPoster from './FloatingPoster'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { isAdminEmail } from '@/lib/supabase'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useIsActiveFounder } from '@/hooks/useFounderProgram'
import type { TabType } from '@/types/homeTabs'

interface LeftNavSidebarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  liveCount: number
  battleCount: number
  followersLiveCount: number
  presidentTabLabel: string
  showPresidentTab: boolean
  wallNotificationCount?: number

  // Opens the existing More container/drawer.
  onMoreClick?: () => void
}

interface NavTab {
  id?: TabType
  label: string
  icon: React.ElementType
  activeGradient: string
  description: string
  count?: number
  isExternal?: boolean
  path?: string
}

export default function LeftNavSidebar({
  activeTab,
  setActiveTab,
  liveCount,
  battleCount,
  followersLiveCount,
  showPresidentTab: _showPresidentTab,
  wallNotificationCount = 0,
  onMoreClick,
}: LeftNavSidebarProps) {
  const navigate = useNavigate()

  const { user, profile } = useAuthStore()
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
    ['admin', 'superadmin', 'owner', 'ceo', 'hr_admin', 'agency_hr_manager'].includes(role) ||
    ['admin', 'superadmin', 'owner', 'ceo'].includes(trollRole)
  )
  const { balances, refreshCoins } = useCoins()
  const _xpStore = useXPStore()
  const equippedFrame = useUserFrame(user?.id)

  const trollCoins = Number((balances as any)?.troll_coins ?? 0)
  const trollmonds = Number((profile as any)?.trollmonds ?? 0)
  const crowns = Number((profile as any)?.crowns ?? 0)

  // Always read the live balance from the DB so the sidebar never shows a
  // stale troll_coins amount after spending coins (e.g. MaiTroll Run entry fee).
  useEffect(() => {
    if (user?.id) {
      void refreshCoins()
    }
  }, [user?.id, refreshCoins])

  const displayName =
    profile?.display_name ||
    profile?.username ||
    'Citizen'

  const avatarUrl = profile?.avatar_url

  const tabs: NavTab[] = [
    {
      id: 'home',
      label: 'Home',
      icon: MessageCircle,
      activeGradient: 'from-pink-500 to-purple-600',
      description: 'Discover posts, trends, and community updates',
    },

    {
      label: 'Wall',
      icon: PenSquare,
      activeGradient: 'from-purple-500 to-pink-600',
      count: wallNotificationCount,
      isExternal: true,
      path: '/wall',
      description: 'View the community wall and recent posts',
    },

    {
      id: 'live',
      label: 'Live Now',
      icon: Radio,
      activeGradient: 'from-red-500 to-pink-600',
      count: liveCount + battleCount,
      description: 'Watch live streams happening now',
    },

    {
      id: 'universe',
      label: 'Universe Battles',
      icon: Sparkles,
      activeGradient: 'from-yellow-500 to-orange-600',
      count: followersLiveCount,
      description: 'Join universe-wide battles and events',
    },

    {
      id: 'laws-fees',
      label: 'City Laws',
      icon: FileText,
      activeGradient: 'from-cyan-500 to-blue-600',
      description: 'Browse city laws, fees, and regulations',
    },

    {
      id: 'leagues',
      label: 'T League',
      icon: Trophy,
      activeGradient: 'from-purple-500 to-indigo-600',
      description: 'Compete in leagues and climb the ranks',
    },

    {
      label: 'Troll Wheel',
      icon: Shuffle,
      activeGradient: 'from-amber-500 to-orange-600',
      isExternal: true,
      path: '/troll-wheel',
      description: 'Spin the Troll Wheel for rewards',
    },

    {
      label: 'MAI Business',
      icon: Building2,
      activeGradient: 'from-emerald-500 to-teal-600',
      isExternal: true,
      path: '/mai-business',
      description: 'Start and grow your business on MaiTroll',
    },

    {
      label: 'MaiLife',
      icon: Sparkles,
      activeGradient: 'from-cyan-500 to-blue-600',
      isExternal: true,
      path: '/mai-life',
      description: 'Your city identity, progression, and place in MaiTroll',
    },

    {
      label: 'Mai Talent Show',
      icon: Mic,
      activeGradient: 'from-pink-500 to-rose-600',
      isExternal: true,
      path: '/mai-sing-off',
      description: 'Compete in Mai Talent Show music battles',
    },

    ...(canSeeFounderHub
      ? [{
          label: 'Founder Hub',
          icon: Sparkles,
          activeGradient: 'from-yellow-500 to-orange-600',
          isExternal: true,
          path: '/founder',
          description: 'Open the Founder hub and administration tools',
        }]
      : []),

    ]

  const handleTabClick = (tab: NavTab) => {
    if (tab.isExternal && tab.path) {
      navigate(tab.path)
      return
    }

    if (tab.id) {
      setActiveTab(tab.id)
    }
  }

  const handleMoreClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-more-panel'))
    }
    onMoreClick?.()
  }

  function formatCoins(n: number): string {
    return Math.floor(n).toLocaleString()
  }

  // Navigation is intentionally always dark, independent of the sky/daylight theme.
  const isLight = false
  const navigationGroups: Array<{ heading: string; tabs: NavTab[] }> = [
    { heading: 'Explore', tabs: tabs.slice(0, 4) },
    { heading: 'City & community', tabs: tabs.slice(4, 9) },
    { heading: 'Entertainment & access', tabs: tabs.slice(9) },
  ]

  const sidebarCard = isLight
    ? 'border-slate-200/90 bg-white/95 shadow-[0_12px_35px_rgba(15,23,42,0.07)]'
    : 'border-white/[0.09] bg-[#101827]/95 shadow-[0_18px_45px_rgba(0,0,0,0.24)]'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const primary = isLight ? 'text-slate-900' : 'text-slate-50'

  const renderTab = (tab: NavTab) => {
    const Icon = tab.icon
    const isActive = Boolean(tab.id && activeTab === tab.id)
    const count = Math.max(0, Number(tab.count || 0))
    return (
      <button
        key={tab.id || tab.path || tab.label}
        type="button"
        title={tab.description}
        aria-label={`${tab.label}${count > 0 ? `, ${count} updates` : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => handleTabClick(tab)}
        className={[
          'group relative flex min-h-[43px] w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
          isLight ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-[#101827]',
          isActive
            ? isLight
              ? 'bg-slate-900 text-white shadow-[0_5px_18px_rgba(15,23,42,.16)]'
              : 'bg-gradient-to-r from-sky-500/20 to-indigo-500/15 text-white ring-1 ring-sky-400/35'
            : isLight
              ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              : 'text-slate-300 hover:bg-white/[0.065] hover:text-white',
        ].join(' ')}
      >
        {isActive && <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-sky-400" />}
        <span className={[
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
          isActive
            ? isLight ? 'bg-white/15 text-white' : 'bg-sky-400/15 text-sky-200'
            : isLight ? 'bg-slate-100 text-slate-500 group-hover:text-slate-800' : 'bg-white/[0.045] text-slate-400 group-hover:text-sky-200',
        ].join(' ')}>
          <Icon className="h-[17px] w-[17px]" strokeWidth={isActive ? 2.3 : 1.9} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-5">{tab.label}</span>
        {count > 0 ? (
          <span className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
            isActive ? 'bg-white/15 text-white' : isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-400/10 text-sky-300',
          ].join(' ')}>{count > 99 ? '99+' : count}</span>
        ) : tab.isExternal ? (
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden="true" />
        ) : isActive ? (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        ) : null}
      </button>
    )
  }

  return (
    <aside
      aria-label="MaiTroll desktop navigation"
      className="pointer-events-auto hidden lg:sticky lg:top-3 lg:flex lg:[height:calc(var(--tc-sidebar-vh,100dvh)-84px)] lg:w-[236px] lg:shrink-0 lg:self-start lg:flex-col xl:w-[248px] rounded-xl bg-[#0b1220]/95"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pb-3 pr-1 [scrollbar-color:rgba(148,163,184,.5)_transparent] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        {/* Unified top brand, not another intrusive app header. */}
        <div className={`relative shrink-0 overflow-hidden rounded-2xl border p-4 ${sidebarCard}`}>
          <div aria-hidden="true" className={`pointer-events-none absolute -right-9 -top-11 h-32 w-32 rounded-full blur-3xl ${isLight ? 'bg-sky-100' : 'bg-sky-500/10'}`} />
          <div className="relative flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isLight ? 'bg-slate-900 text-white' : 'bg-gradient-to-br from-sky-400/25 to-indigo-400/15 text-sky-200 ring-1 ring-sky-300/20'}`}>
              <Compass className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <p className={`text-[13px] font-black tracking-tight ${primary}`}>MaiTroll</p>
              <p className={`text-[10px] font-medium ${muted}`}>Your city, your community</p>
            </div>
          </div>
        </div>

        {user && (
          <section aria-label="Citizen profile and balances" className={`shrink-0 rounded-2xl border p-3.5 ${sidebarCard}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.15em] ${muted}`}>
                <Newspaper className="h-3.5 w-3.5" /> Citizen profile
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${isLight ? 'bg-emerald-500' : 'bg-emerald-400'}`} aria-hidden="true" />
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
                <p title={displayName} className={`truncate text-[13px] font-bold ${primary}`}>{displayName}</p>
                <p className={`mt-0.5 text-[10px] ${muted}`}>MaiTroll Citizen</p>
              </div>
            </div>
            <div className={`mt-3 grid grid-cols-2 gap-2 border-t pt-3 ${isLight ? 'border-slate-100' : 'border-white/[0.08]'}`}>
              <div title={`${trollCoins.toLocaleString()} Troll Coins`} className={`min-w-0 rounded-xl px-2.5 py-2 ${isLight ? 'bg-amber-50' : 'bg-amber-400/[0.065]'}`}>
                <div className="mb-1 flex items-center gap-1.5 text-amber-500"><Coins className="h-3.5 w-3.5" /><span className={`text-[9px] font-semibold ${muted}`}>Troll Coins</span></div>
                <p className={`truncate text-[13px] font-extrabold tabular-nums ${primary}`}>{formatCoins(trollCoins)}</p>
              </div>
              <div title={`${trollmonds.toLocaleString()} Trollmonds`} className={`min-w-0 rounded-xl px-2.5 py-2 ${isLight ? 'bg-violet-50' : 'bg-violet-400/[0.065]'}`}>
                <div className="mb-1 flex items-center gap-1.5 text-violet-400"><Gem className="h-3.5 w-3.5" /><span className={`text-[9px] font-semibold ${muted}`}>Trollmonds</span></div>
                <p className={`truncate text-[13px] font-extrabold tabular-nums ${primary}`}>{formatCoins(trollmonds)}</p>
              </div>
            </div>
            {crowns > 0 && (
              <div className={`mt-2 flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] ${isLight ? 'bg-yellow-50 text-amber-800' : 'bg-yellow-400/[0.065] text-amber-200'}`}>
                <span className="flex items-center gap-1.5 font-semibold"><Crown className="h-3.5 w-3.5" /> Crowns</span>
                <span className="font-black tabular-nums">{formatCoins(crowns)}</span>
              </div>
            )}
          </section>
        )}

        <nav aria-label="Main navigation" className={`shrink-0 rounded-2xl border px-2 py-3 ${sidebarCard}`}>
          <div className="mb-2 flex items-center gap-2 px-2">
            <LayoutGrid className={`h-3.5 w-3.5 ${muted}`} />
            <span className={`text-[10px] font-bold uppercase tracking-[.16em] ${muted}`}>Navigation</span>
          </div>
          {navigationGroups.map((group, index) => group.tabs.length > 0 && (
            <div key={group.heading} className={index ? `mt-2 border-t pt-2 ${isLight ? 'border-slate-100' : 'border-white/[0.07]'}` : ''}>
              <p className={`px-3 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[.16em] ${muted}`}>{group.heading}</p>
              <div className="space-y-0.5">{group.tabs.map(renderTab)}</div>
            </div>
          ))}
          <div className={`mt-2 border-t pt-2 ${isLight ? 'border-slate-100' : 'border-white/[0.07]'}`}>
            <button
              type="button"
              onClick={handleMoreClick}
              title="Open More Options"
              className={`group flex min-h-[43px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.065]'}`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.045] text-slate-400'}`}><Plus className="h-[17px] w-[17px] transition-transform group-hover:rotate-90" /></span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold">More</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/site-updates')}
                title="Manage public website updates"
                className={`flex min-h-[43px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.065]'}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.045] text-slate-400'}`}><Newspaper className="h-[17px] w-[17px]" /></span>
                <span className="min-w-0 flex-1 text-[12px] font-semibold leading-4">Website Updates &amp; Blog</span>
              </button>
            )}
          </div>
        </nav>

        <div className="min-w-0 shrink-0"><FloatingPoster /></div>
      </div>
    </aside>
  )
}
