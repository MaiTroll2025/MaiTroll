import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageCircle,
  Mic,
  Music,
  Radio,
  Sparkles,
  FileText,
  Trophy,
  BookOpen,
  PenSquare,
  Shuffle,
  Newspaper,
  Coins,
  Gem,
  Crown,
  Plus,
} from 'lucide-react'

import { useLiveContent } from '@/contexts/LiveContentContext'
import FloatingPoster from './FloatingPoster'
import { grantNavCoins } from '@/lib/grantNavCoins'
import { useAuthStore } from '@/lib/store'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'
import { useTheme } from '@/hooks/useTheme'
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
  showPresidentTab,
  wallNotificationCount = 0,
  onMoreClick,
}: LeftNavSidebarProps) {
  const navigate = useNavigate()

  const { user, profile } = useAuthStore()
  const { balances } = useCoins()
  const xpStore = useXPStore()
  const equippedFrame = useUserFrame(user?.id)
  const { theme } = useTheme()

  const trollCoins = Number((balances as any)?.troll_coins ?? 0)
  const trollmonds = Number((profile as any)?.trollmonds ?? 0)
  const crowns = Number((profile as any)?.crowns ?? 0)

  const currentLevel = xpStore.level

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
      label: 'Leagues',
      icon: Trophy,
      activeGradient: 'from-purple-500 to-indigo-600',
      description: 'Compete in leagues and climb the ranks',
    },

    {
      id: 'academy',
      label: 'Academy',
      icon: BookOpen,
      activeGradient: 'from-emerald-500 to-teal-600',
      description: 'Learn with courses from Mai Troll Academy',
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
      label: 'Mai Sing Off',
      icon: Mic,
      activeGradient: 'from-pink-500 to-rose-600',
      isExternal: true,
      path: '/mai-sing-off',
      description: 'Compete in Mai Sing Off music battles',
    },

    {
      label: 'MAI Record Label',
      icon: Music,
      activeGradient: 'from-purple-500 to-violet-600',
      isExternal: true,
      path: '/mai-record-label',
      description: 'Browse artists and releases on MAI Record Label',
    },
  ]

  const handleTabClick = (tab: NavTab) => {
    grantNavCoins(tab.label)

    if (tab.isExternal && tab.path) {
      navigate(tab.path)
      return
    }

    if (tab.id) {
      setActiveTab(tab.id)
    }
  }

  const handleMoreClick = () => {
    grantNavCoins('More')
    onMoreClick?.()
  }

  function formatCoins(n: number): string {
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1)}M`
    }

    if (n >= 1_000) {
      return `${(n / 1_000).toFixed(1)}K`
    }

    return n.toLocaleString()
  }

  return (
    <aside className="hidden lg:flex lg:w-[180px] lg:shrink-0 lg:flex-col lg:gap-2 lg:sticky lg:top-3 lg:self-start">

      {/* Citizen Profile */}
      {user && (
        <div className={`rounded-xl border p-3 ${theme === 'light' ? 'border-gray-300 bg-gray-50' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className={`mb-2 flex items-center gap-2 border-b pb-1.5 ${theme === 'light' ? 'border-gray-200' : 'border-white/10'}`}>
            <Newspaper className={`h-3.5 w-3.5 ${theme === 'light' ? 'text-gray-500' : 'text-cyan-300'}`} />

            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${theme === 'light' ? 'text-gray-500' : 'text-cyan-300/80'}`}>
              Citizen Profile
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative h-10 w-10 shrink-0">
              {avatarUrl ? (
                <ProfileFrame
                  frame={equippedFrame}
                  avatarUrl={avatarUrl}
                  username={displayName}
                  size="sm"
                  fillParent
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-xs font-black text-white ring-2 ring-cyan-400/50">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className={`truncate text-[11px] font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {displayName}
              </p>

              <p className={`text-[9px] font-bold ${theme === 'light' ? 'text-gray-500' : 'text-cyan-300/80'}`}>
                City Rank Lv. {currentLevel}
              </p>

              <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-bold ${theme === 'light' ? 'text-gray-600' : ''}`}>
                <span className={`flex items-center gap-0.5 ${theme === 'light' ? 'text-amber-600' : 'text-yellow-300'}`}>
                  <Coins className="h-2.5 w-2.5" />
                  {formatCoins(trollCoins)}
                </span>

                <span className={`flex items-center gap-0.5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-300'}`}>
                  <Gem className="h-2.5 w-2.5" />
                  {formatCoins(trollmonds)}
                </span>

                {crowns > 0 && (
                  <span className={`flex items-center gap-0.5 ${theme === 'light' ? 'text-amber-700' : 'text-amber-300'}`}>
                    <Crown className="h-2.5 w-2.5" />
                    {crowns}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#070b19]/70 p-2 backdrop-blur-xl">

        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = !!tab.id && activeTab === tab.id

          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => handleTabClick(tab)}
              className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                isActive
                  ? `bg-gradient-to-r ${tab.activeGradient} shadow-lg`
                  : 'hover:bg-white/[0.06]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 group-hover:text-white'
                }`}
              />

              <span
                className={`text-xs font-bold ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-300 group-hover:text-white'
                }`}
              >
                {tab.label}
              </span>

              {!!tab.count && (
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-cyan-500/15 text-cyan-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}

              <span className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2.5 w-max min-w-[110px] max-w-[220px] -translate-y-1/2 rounded-md bg-slate-800/95 px-2.5 py-1.5 text-[10px] font-semibold text-white opacity-0 shadow-lg shadow-black/60 ring-1 ring-white/10 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
                {tab.description}
              </span>
            </button>
          )
        })}

        {/* MORE — opens existing More container */}
        <button
          type="button"
          onClick={handleMoreClick}
          className="group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20"
        >
          <Plus className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:rotate-90 group-hover:text-cyan-300" />

          <span className="text-xs font-bold text-slate-300 group-hover:text-white">
            More
          </span>

          <span className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2.5 w-max rounded-md bg-slate-800/95 px-2.5 py-1.5 text-[10px] font-semibold text-white opacity-0 shadow-lg shadow-black/60 ring-1 ring-white/10 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
            Open More Options
          </span>
        </button>
      </div>

      {/* Floating Poster */}
      <FloatingPoster />
    </aside>
  )
}