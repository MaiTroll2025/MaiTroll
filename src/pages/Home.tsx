import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { lazyWithRetry } from '@/utils/lazyImport'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BookOpen,
  Crown,
  FileText,
  Gavel,
  MessageCircle,
  Music,
  PenSquare,
  Play,
  Radio,
  Scale,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Tv,
  Users,
  X,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import useSEO from '@/hooks/useSEO'
import { websiteSchema, organizationSchema } from '@/utils/seoSchemas'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { useLiveContent, type AuctionShow, type LiveItem } from '@/contexts/LiveContentContext'
import { usePresenceStore } from '@/lib/presenceStore'
import { supabase } from '@/lib/supabase'
import useGlobalActivity from '@/hooks/useGlobalActivity'
import type { ActivityEvent } from '@/hooks/useGlobalActivity'
import CityLawsFeesTab from '@/components/home/CityLawsFeesTab'
import LeaguesTab from '@/components/home/LeaguesTab'
import PresidentCandidatesTab from '@/components/home/PresidentCandidatesTab'
import AcademyTab from '@/components/home/AcademyTab'
import UnderConstructionPage from '@/components/UnderConstructionPage'
import WallPage from '@/pages/WallPage'
import LiveAuctionMiniWindow from '@/components/home/LiveAuctionMiniWindow'
import SupportGoalReminderModal from '@/components/SupportGoalReminderModal'
import { useSupportGoalReminder } from '@/hooks/useSupportGoalReminder'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import { useWallNotifications } from '@/hooks/useWallNotifications'
import LeftNavSidebar from '@/components/home/LeftNavSidebar'
import UniverseBattlesPage from '@/pages/UniverseBattlesPage'
import HowToVideosPage from '@/pages/JobsHowToPage'
import DynamicWeatherBackground from '@/components/home/DynamicWeatherBackground'
import FeaturedBroadcastersRow from '@/components/home/FeaturedBroadcastersRow'
import HyTroGamingRow from '@/components/home/HyTroGamingRow'
import PodcastRow from '@/components/home/PodcastRow'
import HorizontalScrollRow from '@/components/home/HorizontalScrollRow'
import NewStreamersRow from '@/components/home/NewStreamersRow'
import BestTrollersRow from '@/components/home/BestTrollersRow'
import PromoSlot from '@/components/promo/PromoSlot'
import PodcastCentral from '@/pages/PodcastCentral'
import { HOME_PAGE_PROMO_PLACEMENTS } from '@/types/cityAds'
import LearnAboutMaiTrollBanner from '@/components/learn-about/LearnAboutMaiTrollBanner'
import type { TabType } from '@/types/homeTabs'

const PWAInstallPrompt = lazyWithRetry(() => import('../components/PWAInstallPrompt'))
const TCNNPopupWidget = lazyWithRetry(() => import('@/components/tcnn/TCNNPopupWidget'))
const FeaturedBroadcasts = lazyWithRetry(() => import('@/components/broadcast/FeaturedBroadcasts'))

const glass =
  'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]'

const LiveGrid = React.memo(function LiveGrid({
   liveItems,
   loadingLive,
   totalViewers,
   onlineUsers,
   showLiveGrid,
   setShowLiveGrid,
   onClickItem,
   user,
   navigate,
   theme,
 }: {
   liveItems: LiveItem[]
   loadingLive: boolean
   totalViewers: number
   onlineUsers: number
   showLiveGrid: boolean | null
   setShowLiveGrid: (value: boolean | null) => void
   onClickItem: (item: LiveItem) => void
   user: { id: string } | null
   navigate: (path: string) => void
   theme: string
 }) {
    const visible = showLiveGrid ?? true
    const [showOnlineUsers, setShowOnlineUsers] = React.useState(false)
    const [onlineUserList, setOnlineUserList] = React.useState<any[]>([])
    const [loadingUsers, setLoadingUsers] = React.useState(false)
    const onlineUserIds = usePresenceStore(state => state.onlineUserIds)

   const groupedItems = useMemo(() => {
    const groups: Record<string, LiveItem[]> = {}
    for (const item of liveItems) {
      const groupKey = item.category || item.type || 'other'
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(item)
    }
    return groups
  }, [liveItems])

  const groupLabels: Record<string, string> = {
    stream: 'Live Streams',
    podcast: 'Podcasts',
    auction: 'Auctions',
    gaming: 'Gaming',
    court: 'Troll Court',
    tcnn: 'TCNN News',
    other: 'Other',
  }

   const visibleGroupKeys = useMemo(() => {
     return Object.keys(groupedItems).filter((key) => groupedItems[key].length > 0)
   }, [groupedItems])

   React.useEffect(() => {
     if (!showOnlineUsers) return
     setLoadingUsers(true)
     const fetchOnlineUsers = async () => {
       try {
         const userIds = Array.from(onlineUserIds).slice(0, 200)
         if (userIds.length === 0) {
           setOnlineUserList([])
           setLoadingUsers(false)
           return
         }
         const { data } = await supabase
           .from('user_profiles')
           .select('id, username, display_name, avatar_url, role, is_admin')
           .in('id', userIds)
         setOnlineUserList((data || []) as any[])
       } catch (e) {
         setOnlineUserList([])
       } finally {
         setLoadingUsers(false)
       }
     }
     void fetchOnlineUsers()
   }, [showOnlineUsers, onlineUserIds])

   return (
     <div className="space-y-4">
       <div className={`${glass} rounded-2xl p-4`}>
         <div className="flex flex-wrap items-center justify-between gap-3">
           <div>
             <h2 className={`flex items-center gap-2 text-xl font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
               <Radio className="h-5 w-5 text-red-400" />
               Live Now
             </h2>
            <p className={`mt-1 text-xs font-bold ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
               {liveItems.length} broadcasting • {totalViewers.toLocaleString()} watching now • <button onClick={() => setShowOnlineUsers(!showOnlineUsers)} className="text-emerald-300 hover:text-emerald-200 underline">{onlineUsers.toLocaleString()} online</button>
             </p>
           </div>
          {liveItems.length > 0 && (
            <button
              onClick={() => setShowLiveGrid(visible ? false : true)}
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100"
            >
              {visible ? 'Hide Broadcasts' : 'Show Broadcasts'}
            </button>
          )}
        </div>

        <Suspense fallback={<div className="mt-4 aspect-video rounded-xl bg-white/5" />}>
          {liveItems.some((item) => item.isFeatured) && (
            <div className="mt-4">
              <FeaturedBroadcasts />
            </div>
          )}
        </Suspense>

        {visible && (
          <div className="mt-4 space-y-4">
            {loadingLive ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
              ))
            ) : liveItems.length === 0 ? (
              <button
                onClick={() => {
                  if (user) {
                    navigate('/broadcast/setup')
                  } else {
                    toast.info('Sign in to start broadcasting.')
                    navigate('/auth')
                  }
                }}
                className="col-span-full rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] py-12 text-center transition hover:border-cyan-400/50 hover:bg-cyan-500/[0.08] cursor-pointer"
              >
                <Radio className="mx-auto h-10 w-10 text-cyan-500/50" />
                <p className="mt-3 text-sm font-bold text-cyan-300/70">No one is live right now</p>
                <p className="mt-1 text-xs text-cyan-400/50">Click here to start your broadcast!</p>
              </button>
            ) : (
              visibleGroupKeys.map((groupKey) => (
                <div key={groupKey}>
                  <h3 className={`text-sm font-black uppercase tracking-[0.14em] mb-2 ${theme === 'light' ? 'text-gray-600' : 'text-slate-300'}`}>
                    {groupLabels[groupKey] || groupKey}
                  </h3>
                  <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                    {groupedItems[groupKey].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => onClickItem(item)}
                        className={`group relative aspect-square overflow-hidden rounded-xl border text-left transition ${theme === 'light' ? 'border-gray-300 bg-white hover:border-cyan-300/60' : 'border-white/10 bg-slate-900 hover:border-cyan-300/60'}`}
                      >
                        <div className={`absolute inset-0 ${theme === 'light' ? 'bg-gradient-to-br from-purple-100/70 via-gray-50 to-cyan-100/50' : 'bg-gradient-to-br from-purple-900/70 via-slate-950 to-cyan-900/50'}`} />
                        {item.type === 'auction' ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Gavel className="h-8 w-8 text-cyan-300/40" />
                          </div>
                        ) : item.streamerAvatar ? (
                          <img src={item.streamerAvatar} alt={item.streamerName} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                        ) : (
                          <Play className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white/20" />
                        )}
                        <div className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white">LIVE</div>
                        <div className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[8px] font-black ${theme === 'light' ? 'bg-gray-200 text-gray-700' : 'bg-black/50 text-white'}`}>
                          👁 {item.viewerCount}
                        </div>
                        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t p-2 ${theme === 'light' ? 'from-white via-white/70 to-transparent' : 'from-black via-black/70 to-transparent'}`}>
                          <p className={`truncate text-[10px] font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{item.title}</p>
                          <p className={`truncate text-[8px] font-bold ${theme === 'light' ? 'text-gray-600' : 'text-slate-300'}`}>{item.streamerName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
           </div>
         )}
         {showOnlineUsers && (
           <div className={`${glass} mt-4 rounded-2xl p-4`}>
             <div className="mb-3 flex items-center justify-between">
               <h3 className="flex items-center gap-2 text-sm font-black text-white">
                 <Users className="h-4 w-4 text-emerald-300" />
                 Online Users
               </h3>
               <button onClick={() => setShowOnlineUsers(false)} className="text-xs text-slate-400 hover:text-white">Close</button>
             </div>
             {loadingUsers ? (
               <div className="space-y-2">
                 {Array.from({ length: 6 }).map((_, i) => (
                   <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
                 ))}
               </div>
             ) : onlineUserList.length === 0 ? (
               <p className="py-6 text-center text-xs text-slate-500">No users online right now</p>
             ) : (
                <div className="max-h-[50vh] space-y-1 overflow-y-auto">
                  {onlineUserList
                    .sort((a: any, b: any) => {
                      const aIsMe = a.id === user?.id
                      const bIsMe = b.id === user?.id
                      const aAdmin = a.is_admin || ['admin', 'ceo', 'superadmin'].includes(a.role || '')
                      const bAdmin = b.is_admin || ['admin', 'ceo', 'superadmin'].includes(b.role || '')
                      if (aIsMe && !bIsMe) return 1
                      if (!aIsMe && bIsMe) return -1
                      if (aAdmin && !bAdmin) return -1
                      if (!aAdmin && bAdmin) return 1
                      return (a.display_name || a.username).localeCompare(b.display_name || b.username)
                    })
                    .map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => navigate(`/profile/id/${u.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-black text-white">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            (u.display_name || u.username || '?')[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {u.display_name || u.username}
                            {u.id === user?.id && <span className="ml-1 text-[9px] font-bold text-cyan-300">(you)</span>}
                            {(u.is_admin || ['admin', 'ceo', 'superadmin'].includes(u.role || '')) && (
                              <Crown className="ml-1 inline h-3 w-3 text-yellow-400" />
                            )}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                </div>
             )}
           </div>
         )}
       </div>
     </div>
   )
 })

const HomeAuctionGrid = React.memo(function HomeAuctionGrid({
  auctions,
  onClickAuction,
  theme,
}: {
  auctions: AuctionShow[]
  onClickAuction: (id: string) => void
  theme: string
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`flex items-center gap-2 text-xl font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            <Gavel className="h-5 w-5 text-cyan-300" />
            Live Auctions
          </h2>
          <p className={`mt-1 text-xs font-bold ${theme === 'light' ? 'text-gray-500' : 'text-slate-400'}`}>
            {auctions.length} auction{auctions.length === 1 ? '' : 's'} live now
          </p>
        </div>
        <button
          onClick={() => onClickAuction('')}
          className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100"
        >
          View All
        </button>
      </div>

      {auctions.length === 0 ? (
        <button
          onClick={() => onClickAuction('')}
          className={`mt-4 w-full rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] py-10 text-center transition hover:border-cyan-400/50 hover:bg-cyan-500/[0.08]`}
        >
          <Gavel className="mx-auto h-10 w-10 text-cyan-500/50" />
          <p className="mt-3 text-sm font-bold text-cyan-300/70">No auctions live right now</p>
        </button>
      ) : (
         <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
           {auctions.map((auction) => (
             <button
               key={auction.id}
               onClick={() => onClickAuction(auction.id)}
               className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border text-left transition ${theme === 'light' ? 'border-gray-300 bg-white hover:border-cyan-300/60' : 'border-white/10 bg-slate-900 hover:border-cyan-300/60'}`}
             >
               <div className={`absolute inset-0 ${theme === 'light' ? 'bg-gradient-to-br from-cyan-100/70 via-gray-50 to-purple-100/50' : 'bg-gradient-to-br from-cyan-900/70 via-slate-950 to-purple-900/50'}`} />
               <Gavel className={`absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'text-cyan-600/40' : 'text-cyan-300/40'}`} />
               <div className="absolute right-2 top-2 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                 LIVE
               </div>
               <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t p-3 ${theme === 'light' ? 'from-white via-white/70 to-transparent' : 'from-black via-black/70 to-transparent'}`}>
                 <p className={`truncate text-sm font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{auction.title}</p>
               </div>
             </button>
           ))}
         </div>
       )}
    </div>
  )
})

/* Reusable tile sized identically to the Broadcasters / Podcasts row tiles. */
const LiveNowTile = React.memo(function LiveNowTile({
  title,
  subtitle,
  imageUrl,
  fallbackIcon: Icon,
  onClick,
  isMobileWidth,
  theme,
}: {
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  fallbackIcon: React.ElementType
  onClick: () => void
  isMobileWidth: boolean
  theme: string
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:border-cyan-300/40 ${isMobileWidth ? 'h-[120px] w-full' : 'h-[180px] w-[150px]'} ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-white/[0.08] bg-[#080c1a]/95'}`}
    >
      <div className={`absolute inset-0 ${theme === 'light' ? 'bg-gradient-to-br from-purple-100/70 via-gray-50 to-cyan-100/50' : 'bg-gradient-to-br from-purple-900/70 via-slate-950 to-cyan-900/50'}`} />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.06]"
        />
      ) : (
        <Icon className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 ${theme === 'light' ? 'text-gray-400/40' : 'text-white/20'}`} />
      )}
      <div className={`absolute inset-0 bg-gradient-to-b ${theme === 'light' ? 'from-white/20 via-transparent to-white' : 'from-black/20 via-transparent to-[#080c1a]/95'}`} />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </div>
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t p-2.5 ${theme === 'light' ? 'from-white via-white/70 to-transparent' : 'from-black via-black/70 to-transparent'}`}>
        <p className={`truncate text-[11px] font-black ${theme === 'light' ? 'tile-text' : 'text-white'}`}>{title}</p>
        {subtitle ? <p className={`truncate text-[8px] font-bold ${theme === 'light' ? 'tile-text-sub' : 'text-slate-300'}`}>{subtitle}</p> : null}
      </div>
    </button>
  )
})

/* Auctions — live auction shows from the existing auction system,
   rendered as a row of tiles matching the Broadcasters / Podcasts row. */
const AuctionsRow = React.memo(function AuctionsRow({
  auctions,
  onClickAuction,
  isMobileWidth,
  theme,
}: {
  auctions: AuctionShow[]
  onClickAuction: (id: string) => void
  isMobileWidth: boolean
  theme: string
}) {
  return (
    <HorizontalScrollRow
      title="Auctions"
      icon={<Gavel className="h-3.5 w-3.5 text-cyan-300" />}
      onViewAll={() => onClickAuction('')}
      theme={theme}
    >
      {auctions.length === 0 ? (
        <div className={`flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] p-4 text-center ${isMobileWidth ? 'h-[120px] w-full' : 'h-[180px] w-[150px]'}`}>
          <Gavel className="h-8 w-8 text-cyan-500/50" />
          <p className="text-xs font-bold text-cyan-300/70">No Auctions Live</p>
          <p className="text-[10px] text-cyan-400/50">Active auctions will appear here!</p>
        </div>
      ) : (
        auctions.map((auction) => (
          <LiveNowTile
            key={auction.id}
            title={auction.title}
            imageUrl={auction.thumbnail_url}
            fallbackIcon={Gavel}
            isMobileWidth={isMobileWidth}
            theme={theme}
            onClick={() => onClickAuction(auction.id)}
          />
        ))
      )}
    </HorizontalScrollRow>
  )
})

/* Troll Court & TCNN — active broadcasts from the existing stream system,
   rendered as rows of tiles matching the Broadcasters / Podcasts row. */
const CareerBroadcastRow = React.memo(function CareerBroadcastRow({
  title,
  subtitle,
  icon: Icon,
  items,
  onClickItem,
  emptyTitle,
  emptySubtitle,
  isMobileWidth,
  theme,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  items: LiveItem[]
  onClickItem: (item: LiveItem) => void
  emptyTitle: string
  emptySubtitle: string
  isMobileWidth: boolean
  theme: string
}) {
  return (
    <HorizontalScrollRow
      title={title}
      subtitle={subtitle}
      icon={<Icon className="h-3.5 w-3.5 text-emerald-300" />}
      theme={theme}
    >
      {items.length === 0 ? (
        <div className={`flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center ${isMobileWidth ? 'h-[120px] w-full' : 'h-[180px] w-[150px]'}`}>
          <Icon className="h-8 w-8 text-slate-500/50" />
          <p className="text-xs font-bold text-slate-300">{emptyTitle}</p>
          <p className="text-[10px] text-slate-500">{emptySubtitle}</p>
        </div>
      ) : (
        items.map((item) => (
          <LiveNowTile
            key={item.id}
            title={item.title}
            subtitle={item.streamerName}
            imageUrl={item.streamerAvatar}
            fallbackIcon={Play}
            isMobileWidth={isMobileWidth}
            theme={theme}
            onClick={() => onClickItem(item)}
          />
        ))
      )}
    </HorizontalScrollRow>
  )
})

const BattleGrid = React.memo(function BattleGrid({ items, onClickItem }: { items: LiveItem[]; onClickItem: (item: LiveItem) => void }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <h2 className="flex items-center gap-2 text-xl font-black text-white">
        <Sparkles className="h-5 w-5 text-yellow-300" />
        Universal Battles
      </h2>
      <p className="mt-1 text-xs font-bold text-slate-400">{items.length} active battle streams</p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-yellow-600" />
          <p className="mt-3 text-sm font-bold text-slate-400">No Universal Battles active</p>
          <p className="mt-1 text-xs text-slate-500">Start a battle from your live stream.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onClickItem(item)}
              className="rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-900/35 to-orange-950/45 p-4 text-left transition hover:border-yellow-300/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-yellow-500 px-2 py-1 text-[10px] font-black text-black">
                  {item.battleFormat?.toUpperCase() || 'BATTLE'}
                </span>
                <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                  {item.battleStatus || 'active'}
                </span>
              </div>
              <p className="mt-3 truncate text-base font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs font-bold text-yellow-200">
                {item.streamerName} • {item.viewerCount} viewers
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/* ─── Mobile Global Ticker ─── */
const MobileGlobalTicker = React.memo(function MobileGlobalTicker() {
  const events = useGlobalActivity()

  if (!events || events.length === 0) {
    return (
      <div className="relative flex items-center justify-between gap-2 border-b border-cyan-400/15 bg-[#070b19]/80 px-3 py-1.5 backdrop-blur-md">
        <span className="text-[10px] font-bold text-cyan-200/70">Mai Troll</span>
      </div>
    )
  }

  return (
    <div className="relative flex items-stretch border-b border-cyan-400/15 bg-[#070b19]/80 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 py-1.5">
        <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20">
          <Radio className="h-2.5 w-2.5 text-red-400" />
        </span>
        <div className="overflow-hidden whitespace-nowrap">
          <div className="inline-flex animate-[ticker_20s_linear_infinite] items-center gap-6 text-[10px] font-bold text-cyan-200/80">
            {events.slice(0, 8).map((event, i) => (
              <span key={`${event.id}-${i}`} className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-cyan-400/60" />
                {event.message}
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
})
MobileGlobalTicker.displayName = 'MobileGlobalTicker'

/* ─── Mobile Tab Bar ─── */
const MobileTabBar = React.memo(function MobileTabBar({
  activeTab,
  setActiveTab,
  liveCount,
  battleCount,
  wallNotificationCount,
  navigate,
}: {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  liveCount: number
  battleCount: number
  wallNotificationCount: number
  navigate: ReturnType<typeof useNavigate>
}) {
  const tabs: Array<{ id: TabType; label: string; icon: React.ElementType; count?: number; onClick?: () => void }> = [
    { id: 'home', label: 'Home', icon: MessageCircle },
    { id: 'live', label: 'Live', icon: Radio, count: liveCount + battleCount },
    { id: 'universe', label: 'Battles', icon: Sparkles, count: battleCount },
    { id: 'leagues', label: 'Leagues', icon: Trophy },
    { id: 'mai-record-label', label: 'MAI Record Label', icon: Music, onClick: () => navigate('/mai-record-label') },
    { id: 'laws-fees', label: 'Laws', icon: FileText },
    { id: 'academy', label: 'Academy', icon: BookOpen },
    { id: 'wall', label: 'Wall', icon: PenSquare, count: wallNotificationCount },
  ]

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[#050715]/95 backdrop-blur-xl">
      <div className="flex items-center gap-0.5 overflow-x-auto px-1 py-1.5 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => tab.onClick ? tab.onClick() : setActiveTab(tab.id)}
              className={`relative flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[7px] font-black ${
                  isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-cyan-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})
MobileTabBar.displayName = 'MobileTabBar'

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const { isMobile, isMobileWidth } = useIsMobile()
  const { theme, toggleTheme } = useTheme()

  useSEO({
    title: 'MaiTroll | Live Broadcasting, Battles & Social Community',
    description: 'MaiTroll is a live social broadcasting platform where creators go live, battle, build communities, interact with viewers, send gifts and grow their audience.',
    keywords: [
      'MaiTroll', 'live streaming', 'social broadcasting', 'creator platform',
      'livestream battles', 'virtual gifts', 'creator community', 'live video',
      'streaming app', 'social live stream', 'go live', 'watch live streams',
      'creator battles', 'live broadcast', 'trending streams', 'online entertainment'
    ],
    structuredData: [websiteSchema(), organizationSchema()]
  })

  const [activeTab, setActiveTab] = useState<TabType>('home')
  const { newPostCount: wallNotificationCount } = useWallNotifications(false)
  const [showLiveGrid, setShowLiveGrid] = useState<boolean | null>(null)
  const [kickedReason, setKickedReason] = useState<string | null>(null)
  // Read tab query param on mount (e.g. from More panel navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['home', 'live', 'universe', 'jobs', 'laws-fees', 'leagues', 'president', 'academy', 'wall', 'mai-record-label'].includes(tabParam)) {
      setActiveTab(tabParam as TabType)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kicked = params.get('kicked')
    if (kicked) {
      setKickedReason(kicked)
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const { liveItems, liveAuctions, totalViewers, onlineUsers, loadingLive } = useLiveContent()
  const [supportGoalReminder, setSupportGoalReminder] = useState<any>(null)
  const [reminderLoading, setReminderLoading] = useState(false)

  const {
    reminder: supportReminder,
    loading: reminderLoadingState,
    refetch: fetchSupportReminder,
  } = useSupportGoalReminder()
  const { currentElection, currentPresident } = usePresidentSystem()

  const presidentTabLabel = currentElection?.status === 'open'
    ? 'President Candidates'
    : currentPresident
      ? 'President'
      : 'President Office'

  const battleItems = useMemo(() => liveItems.filter((item) => item.isBattle), [liveItems])

  const auctionItems = useMemo(() => liveAuctions.map((auction) => ({
    id: auction.id,
    title: auction.title || 'Untitled Auction',
    type: 'auction' as const,
    viewerCount: 0,
    streamerName: 'Auction',
    streamerAvatar: null,
    isFeatured: false,
    isBattle: false,
  })), [liveAuctions])

  const allLiveItems = useMemo(() => [...liveItems, ...auctionItems], [liveItems, auctionItems])

  // Active Troll Court & TCNN broadcasts already live in liveItems (realtime-fed
  // by LiveContentContext). Reuse them rather than adding duplicate subscriptions.
  const trollCourtItems = useMemo(
    () => liveItems.filter((item) => item.category === 'court'),
    [liveItems],
  )
  const tcnnItems = useMemo(
    () => liveItems.filter((item) => item.category === 'tcnn'),
    [liveItems],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    setSupportGoalReminder(supportReminder)
    setReminderLoading(reminderLoadingState)
  }, [supportReminder, reminderLoadingState])

  useEffect(() => {
    if (activeTab === 'president' && currentElection?.status !== 'open') {
      setActiveTab('home')
    }
  }, [activeTab, currentElection?.status])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user],
  )
  const handleScrollItemClick = useCallback((id: string | LiveItem) => {
     const targetId = typeof id === 'string' ? id : id?.id
     if (!targetId) return
     if (!user) {
       toast.info('Sign in to watch.')
       navigate('/auth')
       return
     }
     navigate(`/watch/${targetId}`)
   }, [navigate, user])

   const handleAuctionClick = useCallback((id: string) => {
     navigate(id ? `/auctions/${id}` : '/auctions')
   }, [navigate])

    const handleTrollCourtClick = useCallback((item: LiveItem) => {
      const sessionId = item.id.startsWith('court-') ? item.id.slice('court-'.length) : item.id
      navigate(`/court/${sessionId}`)
    }, [navigate])

   const handleTcnnClick = useCallback((item: LiveItem) => {
     navigate(`/tcnn/viewer/${item.id}`)
   }, [navigate])

   const showPresidentTab = currentElection?.status === 'open'

  return (
    <div
      className="relative min-h-full w-full overflow-y-auto overflow-x-hidden md:overflow-hidden text-white"
    >
          <DynamicWeatherBackground isDark={theme === 'dark'} showWalker={!!user} />

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050715]/85 backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-purple-500/30 border-t-cyan-300" />
            <p className="text-sm font-bold text-slate-300">Loading Mai Troll...</p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <TCNNPopupWidget onRequireAuth={requireAuth} />
      </Suspense>

      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>

      <div className="relative z-10 flex w-full">
        <LeftNavSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          liveCount={allLiveItems.length}
          battleCount={battleItems.length}
          followersLiveCount={0}
          presidentTabLabel={presidentTabLabel}
          showPresidentTab={showPresidentTab}
          wallNotificationCount={wallNotificationCount}
        />
        
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-[1920px] px-3 pb-8 pt-3 md:px-5">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-all"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Sun className="h-4 w-4" />
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            {/* Mobile Global Ticker */}
            {isMobile && <MobileGlobalTicker />}

            {/* Mobile Tab Bar — hidden on the home tab because the clickable
                city buildings already act as the primary navigation there */}
            {isMobile && activeTab !== 'home' && (
              <MobileTabBar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                liveCount={allLiveItems.length}
                battleCount={battleItems.length}
                wallNotificationCount={wallNotificationCount}
                navigate={navigate}
              />
            )}

            {kickedReason && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                    <X className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-300">You&apos;ve been kicked</p>
                    <p className="text-xs text-red-400/80">{kickedReason}</p>
                  </div>
                </div>
                <button
                  onClick={() => setKickedReason(null)}
                  className="shrink-0 rounded-lg p-1 text-red-400/60 transition hover:bg-red-500/10 hover:text-red-300"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Sign In / Sign Up prompt for non-authenticated users */}
            {!user && (
              <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-purple-900/40 via-slate-900/60 to-cyan-900/40 backdrop-blur-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-base sm:text-lg font-bold text-white">Welcome to Mai Troll!</h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      Sign in to join the community, go live, send gifts, and more.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate('/auth?mode=login')}
                      className="px-4 py-2 text-sm font-semibold text-slate-200 border border-white/15 rounded-xl hover:bg-white/10 transition-all duration-200"
                      type="button"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => navigate('/auth?mode=signup')}
                      className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] transition-all duration-300 hover:scale-[1.03] active:scale-95 text-white"
                      type="button"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'home' && (
              <section className="flex gap-4">
                <div className="min-w-0 flex-1 space-y-4">
                  <FeaturedBroadcastersRow onItemClick={handleScrollItemClick} />
                  <PodcastRow />
                  <HyTroGamingRow onItemClick={handleScrollItemClick} />

                  <AuctionsRow auctions={liveAuctions} onClickAuction={handleAuctionClick} isMobileWidth={isMobileWidth} theme={theme} />
                </div>
              </section>
            )}

            {activeTab === 'live' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1 space-y-4">
                    <LiveGrid
                      liveItems={liveItems.slice(0, 4)}
                      loadingLive={loadingLive}
                      totalViewers={totalViewers}
                      onlineUsers={onlineUsers}
                      showLiveGrid={showLiveGrid}
                      setShowLiveGrid={setShowLiveGrid}
                      onClickItem={handleScrollItemClick}
                      user={user}
                      navigate={navigate}
                      theme={theme}
                    />
                    <HomeAuctionGrid
                      auctions={liveAuctions}
                      onClickAuction={(id) => navigate(id ? `/auctions/${id}` : '/auctions')}
                      theme={theme}
                    />
                    <NewStreamersRow onClickItem={handleScrollItemClick} />
                    <BestTrollersRow onClickItem={handleScrollItemClick} />
                    <HyTroGamingRow onItemClick={handleScrollItemClick} />
                  </div>
                </div>
            )}

            {activeTab === 'universe' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-300 border-t-transparent" /></div>}>
                    <UniverseBattlesPage />
                  </Suspense>
                </div>
              </div>
            )}

            {activeTab === 'jobs' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>}>
                      <HowToVideosPage />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'podcast' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>}>
                      <PodcastCentral />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'laws-fees' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>}>
                      <CityLawsFeesTab />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'leagues' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>}>
                      <LeaguesTab />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'president' && showPresidentTab && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>}>
                      <PresidentCandidatesTab />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'academy' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" /></div>}>
                      <UnderConstructionPage pageName="Academy" openingDate="Oct 1, 2026" />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'wall' && (
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <section className={`${glass} rounded-2xl p-4`}>
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-300 border-t-transparent" /></div>}>
                      <WallPage />
                    </Suspense>
                  </section>
                </div>
              </div>
            )}
          </div>
        </main>
        
        <aside className="hidden xl:flex xl:flex-col xl:gap-4 xl:w-[320px] xl:shrink-0 xl:sticky xl:top-3 xl:self-start">
          <PromoSlot placement={HOME_PAGE_PROMO_PLACEMENTS[0]} variant="featured" />
          <LearnAboutMaiTrollBanner />
          <PromoSlot placement={HOME_PAGE_PROMO_PLACEMENTS[1]} variant="featured" />
        </aside>
      </div>


      {supportGoalReminder && !reminderLoading && (
        <SupportGoalReminderModal
          isOpen={true}
          onClose={() => setSupportGoalReminder(null)}
          broadcaster={supportGoalReminder}
        />
      )}
      <style>{`
        .grid-pulse {
          width: 18px;
          height: 18px;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background: var(--pulse-color);
          opacity: 0;
          box-shadow:
            0 0 0 0 var(--pulse-color),
            0 0 0 0 var(--pulse-color);
          animation: mai-grid-pulse 1800ms cubic-bezier(0.16, 1, 0.3, 1)
            forwards;
        }

         @keyframes mai-grid-pulse {
           0% {
             width: 12px;
             height: 12px;
             opacity: 0.28;
             box-shadow:
               0 0 0 0 var(--pulse-color),
               0 0 18px 2px var(--pulse-color);
          }

            35% {
             opacity: 0.16;
           }

            100% {
             width: 900px;
             height: 900px;
             opacity: 0;
             box-shadow:
               0 0 0 1px transparent,
               0 0 80px 20px transparent;
          }
        }
        `}</style>
    </div>
  )
}