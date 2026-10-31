import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Coins, Gavel, Mail, Play, Radio, Sparkles, Trophy, Users, Shield, Gamepad2, Mic, BriefcaseBusiness, Landmark, Church, RefreshCw } from 'lucide-react';

import PhoneHeader from '../PhoneHeader'
import DynamicWeatherBackground from '@/components/home/DynamicWeatherBackground'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useLiveContent } from '@/hooks/useLiveContent'
import type { LiveItem } from '@/contexts/LiveContentContext'
import { useRandomFreeSeat } from '@/hooks/useRandomFreeSeat'
import { PhoneButton } from '../components/PhoneButton'
import TreelzHomeRow from '@/components/home/TreelzHomeRow'

const glass =
  'border border-[#39FF14]/10 bg-[#0D0814]/85 backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.40)]'

const _neonGradient =
  'bg-gradient-to-br from-[#39FF14] via-[#a855f7] to-[#A855F7]'

const neonBorder =
  'border border-[#39FF14]/30 shadow-[0_0_25px_rgba(0,191,255,0.10),0_0_35px_rgba(191,0,255,0.08)]'

const PHONE_CITY_BUILDINGS = [
  { title: 'City Post Office', path: '/tromail/office', icon: Mail },
  { title: 'Treelz Cinema', path: '/treelz', icon: Play },
  { title: 'Broadcast Tower', path: '/broadcast/setup', icon: Radio },
  { title: 'Municipal Court', path: '/court', icon: Gavel },
  { title: 'Town Hall', path: '/town-meeting', icon: Landmark },
  { title: 'City Jail', path: '/jail', icon: Shield },
  { title: 'City Church', path: '/church', icon: Church },
  { title: 'Game Center', path: '/games', icon: Gamepad2 },
  { title: 'City Treasury', path: '/president/treasury', icon: Coins },
  { title: 'Employment Office', path: '/jobs/opportunities', icon: BriefcaseBusiness },
] as const

function PhoneCityBuildings({ onOpen }: { onOpen: (path: string) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const scroll = (direction: number) => {
    const strip = stripRef.current
    if (!strip) return
    const visible = 4
    strip.scrollBy({ left: direction * (strip.clientWidth / visible), behavior: 'smooth' })
  }

  return (
    <section className="overflow-hidden rounded-[23px] border border-[#BF00FF]/55 bg-[#0B0711]/95 shadow-[0_0_22px_rgba(191,0,255,.16),0_22px_70px_rgba(0,0,0,.28)]">
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2 pb-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-white"><Building2 className="h-[18px] w-[18px] text-[#39FF14]"/> MAITROLL <span className="text-[#39FF14]">CITY</span></h2>
          <p className="mt-0.5 text-[9px] text-slate-400">Explore your city • Swipe to visit more buildings</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button aria-label="Previous city buildings" onClick={() => scroll(-1)} disabled={index === 0} className={`grid h-8 w-8 place-items-center rounded-full border border-[#00BFFF]/50 bg-[#00BFFF]/10 text-[#00BFFF] ${index === 0 ? 'opacity-30 pointer-events-none' : ''}`}><ChevronLeft size={16}/></button>
          <button aria-label="Next city buildings" onClick={() => scroll(1)} disabled={index >= Math.ceil(PHONE_CITY_BUILDINGS.length / 4) - 1} className={`grid h-8 w-8 place-items-center rounded-full border border-[#39FF14]/60 bg-[#39FF14]/10 text-[#39FF14] ${index >= Math.ceil(PHONE_CITY_BUILDINGS.length / 4) - 1 ? 'opacity-30 pointer-events-none' : ''}`}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#100719_0%,#190B22_47%,#0C1713_68%,#090711_100%)]">
        <div ref={stripRef} onScroll={(event) => { const el = event.currentTarget; setIndex(Math.min(Math.ceil(PHONE_CITY_BUILDINGS.length / 4) - 1, Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))) }} className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth px-2 pt-2 pb-0 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {PHONE_CITY_BUILDINGS.map((building) => {
            const Icon = building.icon
            return (
              <button key={building.title} onClick={() => onOpen(building.path)} title={building.title} className="group flex min-w-0 shrink-0 basis-1/4 snap-start flex-col items-center justify-end px-[2px] text-center active:scale-[.98]">
                <div className="relative flex h-[75px] w-full max-w-[95px] items-end justify-center">
                  {building.title === 'Broadcast Tower' ? (
                    <div className="relative mb-0 flex h-[70px] w-[45px] flex-col items-center justify-end">
                      <span className="absolute -top-1 h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_#ff5353]"/>
                      <div className="absolute top-3 h-[53px] w-[2px] bg-slate-300/80"/>
                      <div className="relative mb-[9px] h-[35px] w-[38px] bg-[#27153A] [clip-path:polygon(50%_0,100%_100%,0_100%)]"/>
                      <div className="absolute bottom-0 flex h-[20px] w-[52px] items-center justify-around rounded-t-md border border-lime-300/30 bg-[#110F20] text-[#39FF14]"><Radio size={13}/><Users size={13}/></div>
                    </div>
                  ) : (
                    <div className={`relative flex w-[91%] flex-col items-center justify-end overflow-visible border border-[#00BFFF]/60 bg-gradient-to-b from-[#25133A] via-[#171123] to-[#0B1515] shadow-[3px_5px_0_#090610,0_0_16px_rgba(0,191,255,.23)] ${['Municipal Court','Town Hall','City Treasury'].includes(building.title) ? 'h-[64px]' : building.title === 'City Church' ? 'h-[61px] rounded-t-3xl' : 'h-[55px]'}`}>
                      {['Municipal Court','Town Hall','City Treasury'].includes(building.title) && <div className="absolute -top-[9px] left-[-6%] h-3 w-[112%] bg-[#b9b6b2] [clip-path:polygon(50%_0,100%_100%,0_100%)]"/>}
                      {building.title === 'City Church' && <div className="absolute -top-5 text-xl text-amber-200">✝</div>}
                      <div className="absolute top-1 w-[92%] truncate bg-[#11091A]/90 px-[1px] py-1 text-[6px] font-black uppercase tracking-[-.02em] text-white">{building.title}</div>
                      <div className="mb-[10px] grid w-[85%] flex-1 grid-cols-3 gap-[3px] pt-5 pb-1">{Array.from({length:9}, (_,i)=><span key={i} className="rounded-[1px] border border-black/20 bg-[#00BFFF]/35 shadow-[inset_1px_1px_0_rgba(255,255,255,.13)]"/>)}</div>
                      <span className="absolute bottom-0 h-[12px] w-[15px] border border-[#39FF14]/50 bg-[#071009]"/>
                    </div>
                  )}
                </div>
                <span className="flex h-[25px] w-full items-center justify-center rounded-sm border-t border-white/10 bg-[#090710] px-[2px] text-center text-[7px] font-extrabold leading-[10px] text-white group-active:text-[#39FF14]">{building.title}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 py-1">{[0,1,2].map(n=>(
        <span key={n} className={`h-1 rounded-full transition-all ${index===n ? 'w-6 bg-[#39FF14]' : 'w-2 bg-white/20'}`}/>
      ))}</div>
    </section>
  )
}

interface PhoneHomepageProps {
  onNavigate?: (path: string) => void
}

/* -------------------------------------------------------------------------- */
/* Live Stream Tile                                                           */
/* -------------------------------------------------------------------------- */

const PhoneLiveTile = React.memo(function PhoneLiveTile({
  item,
  onClick,
}: {
  item: LiveItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-[105px] w-[108px] shrink-0 overflow-hidden rounded-xl border border-[#BF00FF]/65 bg-[#0C0612] text-left shadow-[0_8px_30px_rgba(0,0,0,0.40)] transition-all duration-200 active:scale-[0.97] hover:border-[#00BFFF]/80 hover:shadow-[0_0_25px_rgba(0,191,255,0.35)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/30 via-[#0A0610] to-[#BF00FF]/30" />
      <div className="absolute -right-2 -top-2 z-10 text-xl drop-shadow-[0_0_8px_rgba(255,122,0,.7)]">🎃</div>
      <div className="absolute -left-1 bottom-14 z-10 text-sm opacity-80">🕷️</div>
      <div className="absolute inset-0 z-[1] pointer-events-none opacity-25 [background-image:radial-gradient(circle_at_20%_20%,#a3f529_1px,transparent_1px),radial-gradient(circle_at_80%_70%,#A855F7_1px,transparent_1px)] [background-size:18px_18px]" />

      {item.streamerAvatar ? (
        <img
          src={item.streamerAvatar}
          alt={item.streamerName || 'Live streamer'}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/10">
            <Play className="h-7 w-7 text-[#39FF14]/50" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-[#09050F]/10 via-transparent to-[#09050F]" />

      {/* Neon LIVE badge */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-[#39FF14]/60 bg-[#05050c]/75 px-2 py-1 text-[8px] font-black tracking-wider text-white backdrop-blur-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#39FF14] shadow-[0_0_8px_#a3f529]" />
        LIVE
      </div>

      <div className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/55 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
        👁 {item.viewerCount || 0}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="truncate text-[10px] font-black text-white">
          {item.title || 'Live Broadcast'}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-bold text-[#39FF14]/70">
          {item.streamerName || 'Unknown'}
        </p>
      </div>
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

function PhoneSection({
  title,
  icon: Icon,
  count,
  children,
  onViewAll,
}: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
  onViewAll?: () => void
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#39FF14]/50 bg-[#39FF14]/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#39FF14]/25 to-[#A855F7]/25" />
            <span className="absolute -right-1 -top-1 text-[10px]">🕷️</span>
            <Icon size={15} className="relative text-[#39FF14]" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[12px] font-black tracking-tight text-white">
              {title}
            </h2>

            {count !== undefined && (
              <p className="text-[9px] font-bold text-[#39FF14]/55">
                {count} {count === 1 ? 'active stream' : 'active streams'}
              </p>
            )}
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#39FF14] transition hover:bg-[#39FF14]/10"
          >
            Explore
            <ChevronRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Live Now                                                                    */
/* -------------------------------------------------------------------------- */

function PhoneLiveNow({
  items,
  loading,
  onItemClick,
  onViewAll,
}: {
  items: LiveItem[]
  loading: boolean
  onItemClick: (item: LiveItem) => void
  onViewAll?: () => void
}) {
  if (loading) {
    return (
      <PhoneSection title="Live Now" icon={Radio}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[105px] w-[108px] shrink-0 animate-pulse rounded-xl border border-[#00BFFF]/45 bg-gradient-to-br from-[#00BFFF]/10 to-[#BF00FF]/10"
          />
        ))}
      </PhoneSection>
    )
  }

  return (
    <PhoneSection
      title="Live Now"
      icon={Radio}
      count={items.length}
      onViewAll={onViewAll}
    >
      {items.length === 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className={`flex h-[86px] w-full min-w-[260px] flex-col items-center justify-center rounded-2xl ${neonBorder} bg-gradient-to-br from-[#39FF14]/5 via-[#0D0814] to-[#A855F7]/5 px-5 text-center transition active:scale-[0.98]`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#39FF14]/50 bg-[#39FF14]/10">
            <Radio className="h-6 w-6 text-[#39FF14]/60" />
          </div>

          <p className="mt-1 text-xs font-black text-zinc-300">
            The network is quiet
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Explore MaiTroll or be the first to go live.
          </p>
        </button>
      ) : (
        items.slice(0, 12).map((item) => (
          <PhoneLiveTile
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))
      )}
    </PhoneSection>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick Links                                                                 */
/* -------------------------------------------------------------------------- */

function PhoneQuickLinks() {
  const navigate = useNavigate()

  const links = [
    {
      label: 'Battles',
      icon: Sparkles,
      path: '/battles',
    },
    {
      label: 'T League',
      icon: Trophy,
      path: '/leagues',
    },
  ]

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div>
          <h2 className="text-[12px] font-black tracking-tight text-white">
            Explore MaiTroll
          </h2>

          <p className="text-[9px] font-bold text-[#39FF14]/45">
            More ways to connect, compete and create
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {links.map((link, index) => {
          const Icon = link.icon

          return (
            <button
              key={link.label}
              type="button"
              onClick={() => navigate(link.path)}
              className="group relative flex min-h-[78px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#00BFFF]/65 bg-[#0B0711] px-1 text-center transition-all active:scale-95 hover:border-[#39FF14]/25"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/20 via-[#39FF14]/10 to-[#BF00FF]/20 opacity-70 transition-opacity group-hover:opacity-100" />
              <span className="absolute right-1 top-1 text-[9px] opacity-70">{index % 2 === 0 ? '🦇' : '🕸️'}</span>

              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#39FF14]/15 bg-gradient-to-br ${
                  index % 2 === 0
                    ? 'from-[#39FF14]/15 to-[#A855F7]/10'
                    : 'from-[#A855F7]/15 to-[#39FF14]/10'
                }`}
              >
                <Icon
                  size={16}
                  className={
                    index % 2 === 0
                      ? 'text-[#39FF14]'
                      : 'text-[#A855F7]'
                  }
                />
              </div>

              <span className="relative text-[8px] font-black leading-tight text-zinc-400">
                {link.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Homepage                                                                    */
/* -------------------------------------------------------------------------- */

export default function PhoneHomepage({
  onNavigate,
}: PhoneHomepageProps) {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile) as any
  const isLoading = useAuthStore((state) => state.isLoading)

  const {
    liveItems,
    onlineUsers,
    loadingLive,
    refresh,
  } = useLiveContent()


  const [refreshing, setRefreshing] = useState(false)

  const [podcasts, setPodcasts] = useState<any[]>([])
  const [podcastsLoading, setPodcastsLoading] = useState(false)

  const loadPodcasts = useCallback(async () => {
    if (!user?.id) return
    setPodcastsLoading(true)
    try {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      setPodcasts(data || [])
    } catch (err) {
      console.error('Failed to load podcasts:', err)
      setPodcasts([])
    } finally {
      setPodcastsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadPodcasts()
  }, [loadPodcasts])

  const battleItems = useMemo(
    () => liveItems.filter((item) => item.isBattle),
    [liveItems],
  )

  const courtItems = useMemo(
    () => liveItems.filter((item) => item.category === 'court'),
    [liveItems],
  )

  const hytroItems = useMemo(
    () => liveItems.filter((item) => item.category === 'gaming'),
    [liveItems],
  )

  const totalLive = liveItems.length

  const go = useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path)
      } else {
        navigate(path)
      }
    },
    [navigate, onNavigate],
  )

  const { joinRandomFreeSeat, joiningRandomSeat } = useRandomFreeSeat(user?.id, go)

  const handleStreamClick = useCallback(
    (item: LiveItem) => {
      if (item.category === 'gaming') {
        go(`/gaming/watch/${item.id}`)
      } else {
        go(`/watch/${item.id}`)
      }
    },
    [go],
  )

  const refreshLiveContent = useCallback(async () => {
    setRefreshing(true)

    try {
      await refresh()
      await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
  }, [])

  useEffect(() => {
    const handleOpenLive = () => {
      go('/live')
    }

    window.addEventListener('phone-open-live', handleOpenLive)

    return () => {
      window.removeEventListener('phone-open-live', handleOpenLive)
    }
  }, [go])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [refresh])

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#09070E] text-sm font-semibold text-[#BF00FF]"><span className="animate-pulse">Entering MaiTroll City...</span></div>
  }

  const displayName = profile?.display_name || profile?.username || 'MaiTroll Citizen'
  const citizenAvatar = profile?.avatar_url || ''
  const open = (path: string) => go(path)
  const socialLinks = [
    { label: 'Live', icon: Radio, path: '/live' },
    { label: 'People', icon: Users, path: '/explore' },
    { label: 'Treelz', icon: Play, path: '/treelz' },
    { label: 'Battles', icon: Trophy, path: '/battles' },
    { label: 'Podcasts', icon: Mic, path: '/podcast' },
    { label: 'Coins', icon: Coins, path: '/coins' },
  ]
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#09070E] text-white">
      <DynamicWeatherBackground
        isDark={true}
        showWalker={!!user}
        showBuildings={false}
        onBuildingClick={open}
        onJoinRandomSeat={joinRandomFreeSeat}
        isJoiningRandomSeat={joiningRandomSeat}
      />
      <PhoneHeader showTickerLinks={false} />
      <main className="relative z-10 mx-auto flex w-full max-w-[800px] flex-col gap-2 px-2.5 pb-20 pt-2">
        <section className="flex items-center justify-between gap-2 rounded-xl border border-[#BF00FF]/55 bg-[#100818]/95 shadow-[0_0_18px_rgba(191,0,255,.11)] px-2.5 py-1.5">
          <button onClick={() => user ? go(`/profile/id/${user.id}`) : go('/auth')} className="flex min-w-0 items-center gap-2 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#BF00FF]/80 bg-[#BF00FF]/15 text-sm font-black">{citizenAvatar ? <img src={citizenAvatar} alt="" className="h-full w-full object-cover"/> : displayName[0]?.toUpperCase()}</div>
            <div className="min-w-0"><p className="text-[8px] text-slate-400">{user ? 'Welcome back, citizen' : 'Welcome to the city'}</p><p className="truncate text-[12px] font-black">{displayName}</p></div>
          </button>
          <button onClick={() => go('/coins')} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#39FF14]/65 bg-[#39FF14]/10 px-2 py-1.5"><Coins className="h-4 w-4 text-[#39FF14]"/><span className="text-[9px] font-bold">Troll Coins</span><ArrowRight size={12} className="text-[#39FF14]"/></button>
        </section>

        <section className="grid grid-cols-4 gap-1.5">
          {socialLinks.map(({label,icon:Icon,path},i)=><button key={label} onClick={()=>go(path)} className={`flex h-[43px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 active:scale-95 ${i % 3 === 0 ? 'border border-[#00BFFF]/65 bg-[#07121B] shadow-[0_0_12px_rgba(0,191,255,.20)]' : i % 3 === 1 ? 'border border-[#39FF14]/65 bg-[#0A170A] shadow-[0_0_12px_rgba(57,255,20,.18)]' : 'border border-[#BF00FF]/65 bg-[#16091C] shadow-[0_0_12px_rgba(191,0,255,.20)]'}`}><Icon size={16} className={i%3===0 ? 'text-[#00BFFF]' : i%3===1 ? 'text-[#39FF14]' : 'text-[#BF00FF]'}/><span className="text-[9px] font-semibold text-slate-200">{label}{label === 'Battles' && battleItems.length > 0 ? ` (${battleItems.length})` : ''}</span></button>)}
        </section>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={()=>go('/broadcast/setup')} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#39FF14]/70 bg-[#0B1709]/90 shadow-[0_0_14px_rgba(57,255,20,.18)] text-[10px] font-black text-[#39FF14]"><Radio size={14}/> GO LIVE</button>
          <button disabled={joiningRandomSeat} onClick={joinRandomFreeSeat} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#BF00FF]/60 bg-[#BF00FF]/10 text-[10px] font-black text-[#BF00FF] disabled:opacity-50"><Users size={14}/>{joiningRandomSeat ? 'FINDING...' : 'RANDOM SEAT'}</button>
        </div>

        <section className="relative overflow-hidden rounded-xl border border-[#BF00FF]/55 bg-[#0F0817]/95 shadow-[0_0_18px_rgba(191,0,255,.12)] p-2">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(180deg,transparent,#080c17),radial-gradient(ellipse_at_85%_20%,rgba(160,67,239,.4),transparent_45%)]"/>
          <div className="relative flex items-center justify-between gap-2 pb-1.5"><div><h2 className="text-[13px] font-black">Live in MaiTroll City</h2><p className="text-[9px] text-slate-400">{totalLive} broadcasts • {onlineUsers.toLocaleString()} online</p></div><div className="flex gap-1.5"><button onClick={refreshLiveContent} disabled={refreshing} aria-label="Refresh streams" className="rounded-md border border-[#00BFFF]/50 bg-[#00BFFF]/10 p-1 text-[#00BFFF]"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/></button><button onClick={()=>go('/live')} className="text-[9px] font-bold text-[#39FF14]">View All ›</button></div></div>
          <div className="relative flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={()=>go('/broadcast/setup')} className="flex h-[105px] w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#39FF14]/75 bg-[#0E1B0A]/90 shadow-[0_0_16px_rgba(57,255,20,.19)] text-[#39FF14]"><Radio size={20}/><span className="text-[10px] font-black">GO LIVE</span></button>
            {loadingLive ? Array.from({length:3},(_,i)=><div key={i} className="h-[105px] w-[108px] shrink-0 animate-pulse rounded-xl bg-white/10"/>) : liveItems.length ? liveItems.slice(0,12).map(item=><PhoneLiveTile key={item.id} item={item} onClick={()=>handleStreamClick(item)}/>) : <div className="flex h-[105px] flex-1 items-center justify-center text-center text-[10px] text-slate-400">No broadcasts live yet. Be the first!</div>}
          </div>
        </section>

        {/* Separate, compact live Hytro Gaming stream carousel. */}
        <section className="rounded-xl border border-[#BF00FF]/55 bg-[#0F0817]/95 shadow-[0_0_18px_rgba(191,0,255,.12)] p-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[12px] font-black text-white"><Gamepad2 size={15} className="text-[#39FF14]"/> Hytro Gaming Streams</h2>
            <button onClick={() => go('/hytro')} className="text-[9px] font-bold text-[#39FF14]">View All ›</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {loadingLive ? Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[105px] w-[108px] shrink-0 animate-pulse rounded-xl bg-white/10"/>)
              : hytroItems.length ? hytroItems.slice(0, 12).map(item => <PhoneLiveTile key={item.id} item={item} onClick={() => handleStreamClick(item)}/>)
              : <button onClick={() => go('/hytro')} className="flex h-[72px] w-full items-center gap-2 rounded-lg border border-[#00BFFF]/55 bg-[#07131B] shadow-[0_0_12px_rgba(0,191,255,.12)] px-3 text-left"><Gamepad2 size={20} className="text-[#39FF14]"/><span className="text-[10px] text-slate-300">No Hytro gaming streams live. Explore Hytro Gaming ›</span></button>}
          </div>
        </section>

        {/* Podcast discovery — grid of all podcasts */}
        <section className="rounded-xl border border-[#BF00FF]/55 bg-[#0F0817]/95 shadow-[0_0_18px_rgba(191,0,255,.12)] p-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[12px] font-black text-white"><Mic size={15} className="text-[#BF00FF]"/> Podcasts</h2>
            <button onClick={() => go('/podcast')} className="text-[9px] font-bold text-[#BF00FF]">View All ›</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {podcastsLoading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-white/5" />
            )) : podcasts.length === 0 ? (
              <button onClick={() => go('/podcast')} className="flex h-[72px] flex-col items-center gap-3 rounded-lg border border-[#BF00FF]/60 bg-gradient-to-r from-[#BF00FF]/15 to-[#0C0613] px-3 text-left"><Mic size={23} className="text-[#BF00FF]"/><span className="flex-1"><span className="block text-[11px] font-bold text-white">Discover MaiTroll Podcasts</span><span className="block text-[9px] text-slate-400">Listen to shows from the city</span></span><ChevronRight size={15} className="text-[#BF00FF]"/></button>
            ) : (
              podcasts.slice(0, 8).map((podcast) => (
                <button key={podcast.id} onClick={() => go(`/podcast/${podcast.id}`)} className="flex h-40 flex-col items-start justify-center gap-1 rounded-lg border border-[#00BFFF]/55 bg-[#07111A]/90 shadow-[0_0_13px_rgba(0,191,255,.12)] p-2 active:scale-95">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#BF00FF]/60 bg-[#BF00FF]/10 text-[#BF00FF]"><Mic size={16}/></div>
                  <p className="text-[10px] font-black text-white truncate">{podcast.title || 'Untitled Podcast'}</p>
                  <p className="text-[8px] text-slate-400 truncate">{podcast.host_username || podcast.host_user_id || 'Unknown Host'}</p>
                  <span className="text-[8px] font-black text-emerald-400">{Number(podcast.listener_count || 0)} listeners</span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* City comes after the broadcast, gaming, and podcast rows. */}
        <PhoneCityBuildings onOpen={open}/>
        <div className="flex justify-center gap-3 pb-1 text-[9px] text-slate-500"><Link to="/about">About</Link><Link to="/support">Support</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/privacy">Privacy</Link></div>
      </main>
      <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{scrollbar-width:none;-ms-overflow-style:none}`}</style>
    </div>
  )
}
