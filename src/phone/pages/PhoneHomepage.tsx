import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Building2, ChevronLeft, ChevronRight, Coins, Gavel, Mail,
  Play, Radio, Trophy, Users, Shield, Gamepad2, Mic,
  BriefcaseBusiness, Landmark, Church, RefreshCw, Sparkles,
} from 'lucide-react'

import PhoneHeader from '../PhoneHeader'
import DynamicWeatherBackground from '@/components/home/DynamicWeatherBackground'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useLiveContent } from '@/hooks/useLiveContent'
import type { LiveItem } from '@/contexts/LiveContentContext'
import { useRandomFreeSeat } from '@/hooks/useRandomFreeSeat'
import MaiTrollRulesPopup from '@/components/MaiTrollRulesPopup'
import UniversalButton from '@/components/ui/UniversalButton'

interface PhoneHomepageProps {
  onNavigate?: (path: string) => void
}

type PodcastItem = {
  id: string
  title?: string | null
  host_username?: string | null
  host_user_id?: string | null
  listener_count?: number | null
}

const PHONE_CITY_BUILDINGS = [
  { title: 'City Post Office', path: '/tromail/office', icon: Mail, kind: 'post' },
  { title: 'Treelz Cinema', path: '/treelz', icon: Play, kind: 'cinema' },
  { title: 'Broadcast Tower', path: '/broadcast/setup', icon: Radio, kind: 'tower' },
  { title: 'Municipal Court', path: '/court', icon: Gavel, kind: 'court' },
  { title: 'Town Hall', path: '/town-meeting', icon: Landmark, kind: 'court' },
  { title: 'City Jail', path: '/jail', icon: Shield, kind: 'post' },
  { title: 'City Church', path: '/church', icon: Church, kind: 'court' },
  { title: 'Game Center', path: '/games', icon: Gamepad2, kind: 'cinema' },
  { title: 'City Treasury', path: '/president/treasury', icon: Coins, kind: 'court' },
  { title: 'Employment Office', path: '/jobs/opportunities', icon: BriefcaseBusiness, kind: 'post' },
] as const

const panel = 'relative overflow-hidden rounded-[22px] border border-[#a64aff]/35 bg-[#111022]/95 shadow-[0_12px_38px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.045)]'
const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9515f3] to-[#f12dc9] px-5 py-2 text-[13px] font-black text-white shadow-[0_8px_22px_rgba(173,25,239,.25)] transition hover:brightness-110 active:scale-[.98]'

/** CSS-drawn city facade: no additional asset URLs or image dependencies required. */
function CityArtwork({ kind, label, Icon }: {
  kind: string
  label: string
  Icon: React.ElementType
}) {
  return (
    <div className="relative flex h-[120px] w-full items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,#55317b_0%,#1d1846_48%,#091326_100%)] sm:h-[155px]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(#e0b6ff_1px,transparent_1px)] [background-size:37px_31px]" />
      <div className="absolute bottom-0 h-9 w-full bg-[linear-gradient(0deg,#080b19,transparent)]" />
      {kind === 'tower' ? (
        <div className="relative flex h-[110px] w-[83px] items-end justify-center">
          <span className="absolute top-0 z-10 h-2.5 w-2.5 rounded-full bg-[#ff75b7] shadow-[0_0_18px_6px_#e943d0]" />
          <div className="absolute top-3 h-[88px] w-[4px] bg-gradient-to-b from-[#e4c7ff] to-[#53408a]" />
          <div className="absolute bottom-[17px] h-[55px] w-[65px] border-x-[3px] border-[#ab72fc] bg-[linear-gradient(110deg,#211c56,#5a3a93,#131b40)] [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />
          <div className="absolute bottom-[23px] h-[2px] w-[82px] bg-[#e48aff] shadow-[0_0_12px_#d42cff]" />
          <div className="relative z-10 mb-0 flex h-[26px] w-[77px] items-center justify-center rounded-t-xl border border-[#bf7bff] bg-[#17143d] text-[#f279ff] shadow-[0_0_20px_#a92ff088]"><Radio size={24}/></div>
        </div>
      ) : kind === 'cinema' ? (
        <div className="relative mb-0 flex h-[91px] w-[85%] flex-col items-center rounded-t-[24px] border-2 border-[#bb50d9] bg-[linear-gradient(105deg,#1e1332,#4d1746,#231136)] shadow-[0_0_28px_#f02ca966]">
          <div className="absolute -top-4 rounded-xl border-2 border-[#ff80d9] bg-[#541552] px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider text-[#ffc2ed] shadow-[0_0_12px_#ed36cd]">{label.replace(' Cinema','')}</div>
          <div className="mt-7 flex w-[85%] justify-around border-y border-[#c74dbd] py-1 text-[#ff8ee1]"><Icon size={18}/><Sparkles size={16}/><Icon size={18}/></div>
          <div className="mt-2 flex h-full w-[70%] justify-center gap-2"><span className="w-5 bg-[#3b204e]"/><span className="w-5 bg-[#3b204e]"/></div>
        </div>
      ) : kind === 'court' ? (
        <div className="relative mb-0 flex h-[83px] w-[85%] flex-col items-center border-x-2 border-[#ddb46f] bg-[linear-gradient(120deg,#815174,#e6a875,#54375e)] shadow-[0_0_27px_#ea9c7277]">
          <div className="absolute -top-[22px] h-[24px] w-[112%] bg-[#deb38c] [clip-path:polygon(50%_0%,100%_100%,0%_100%)]" />
          <div className="absolute -top-[10px] text-[#ffe49d]"><Icon size={17}/></div>
          <div className="mt-4 flex h-[65px] w-[83%] justify-around border-y-[5px] border-[#eac8a0] bg-[#33233c] px-1">
            {[0,1,2,3].map(i => <span key={i} className="h-full w-[12%] border-x-2 border-[#d3a67d] bg-[#a3797b]" />)}
          </div>
        </div>
      ) : (
        <div className="relative flex h-[91px] w-[77%] flex-col items-center rounded-t-md border-2 border-[#608bf6] bg-[linear-gradient(110deg,#1b2b66,#553779,#161f50)] shadow-[0_0_25px_#6386f077]">
          <span className="absolute -top-4 h-4 w-[85%] rounded-t-lg bg-[#6b7fe3]" />
          <div className="mt-2 w-[85%] bg-[#182049] py-1 text-center text-[8px] font-black uppercase text-[#ffe0ac]">{label}</div>
          <div className="mt-2 grid w-[81%] flex-1 grid-cols-3 gap-[5px] pb-2">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-[#4e84d7]/50 bg-[#4b71ba]/65 shadow-[0_0_7px_#4a8bdf66]" />)}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#e295e5]/50 blur-[1px]" />
    </div>
  )
}

function PhoneCityBuildings({ onOpen }: { onOpen: (path: string) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const maxPage = Math.ceil(PHONE_CITY_BUILDINGS.length / 4) - 1

  const scrollToPage = (nextPage: number) => {
    const el = stripRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(maxPage, nextPage))
    el.scrollTo({ left: el.clientWidth * clamped, behavior: 'smooth' })
    setPage(clamped)
  }

  return (
    <section className={`${panel} px-3 py-4 sm:px-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[19px] font-black uppercase tracking-tight sm:text-[24px]"><Building2 className="text-[#c34eff]"/> MaiTroll City</h2>
          <p className="text-[11px] text-[#a6a7c4] sm:text-[13px]">Explore the city • Visit buildings • Discover what&apos;s live</p>
        </div>
        <div className="flex gap-2">
          <UniversalButton iconOnly aria-label="Previous city buildings" icon={<ChevronLeft size={20}/>} onClick={() => scrollToPage(page - 1)} disabled={page === 0} className="h-9 w-9 rounded-full p-0" />
          <UniversalButton iconOnly aria-label="Next city buildings" icon={<ChevronRight size={20}/>} onClick={() => scrollToPage(page + 1)} disabled={page >= maxPage} className="h-9 w-9 rounded-full border-[#d447ff]/60 bg-gradient-to-br from-[#9318ec] to-[#da24c3] p-0 text-white" />
        </div>
      </div>
      <div ref={stripRef} onScroll={(event) => {
        const el = event.currentTarget
        setPage(Math.min(maxPage, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))))
      }} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {PHONE_CITY_BUILDINGS.map(({ title, path, icon: Icon, kind }) => (
          <UniversalButton type="button" key={title} onClick={() => onOpen(path)} aria-label={`Visit ${title}`} variant="ghost" className="group h-auto w-1/4 shrink-0 snap-start p-0 text-left sm:px-1.5">
            <div className="overflow-hidden rounded-xl border border-[#8663cd]/40 bg-[#141428] shadow-[0_6px_20px_#0009] transition group-hover:border-[#d55aff]">
              <CityArtwork kind={kind} label={title} Icon={Icon}/>
              <div className="flex h-10 items-center justify-center bg-[#0f1223] px-1 text-center text-[9px] font-extrabold leading-tight text-white sm:h-12 sm:text-xs">{title}</div>
            </div>
          </UniversalButton>
        ))}
      </div>
    </section>
  )
}

const PhoneLiveTile = React.memo(function PhoneLiveTile({ item, onClick }: { item: LiveItem, onClick: () => void }) {
  return (
    <UniversalButton type="button" onClick={onClick} variant="ghost" className="group relative h-[152px] w-[136px] shrink-0 overflow-hidden rounded-2xl border border-[#ab63fc]/40 bg-[#17122b] p-0 text-left sm:h-[180px] sm:w-[165px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#6939bd,#17122b_65%)]" />
      {item.streamerAvatar ? <img src={item.streamerAvatar} alt={item.streamerName || 'Broadcaster'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <Radio className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#c343ff]/70" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090716] via-transparent to-[#090716]/25" />
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-[#eb2389] px-2 py-1 text-[9px] font-black text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"/> LIVE</span>
      <span className="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-bold text-white">{item.viewerCount || 0} watching</span>
      <div className="absolute inset-x-0 bottom-0 p-3"><div className="truncate text-[12px] font-black text-white">{item.title || 'Live Broadcast'}</div><div className="truncate text-[10px] font-semibold text-[#deb9ff]">{item.streamerName || 'MaiTroll Citizen'}</div></div>
    </UniversalButton>
  )
})

function FeatureCard({ type, title, description, cta, onClick }: { type: 'gaming' | 'podcast', title: string, description: string, cta: string, onClick: () => void }) {
  const gaming = type === 'gaming'
  const Icon = gaming ? Gamepad2 : Mic
  return (
    <UniversalButton onClick={onClick} variant="ghost" icon={<ArrowRight size={13} />} iconPosition="end" className={`relative min-h-[164px] w-full overflow-hidden rounded-[20px] border p-4 text-left transition active:scale-[.99] ${gaming ? 'border-[#4164e9]/60 bg-[radial-gradient(ellipse_at_85%_65%,#303795_0%,#171536_55%,#0b1429_100%)]' : 'border-[#a33bd8]/60 bg-[radial-gradient(ellipse_at_86%_55%,#66235e_0%,#271334_51%,#130e29_100%)]'}`}>
      <Icon className={`absolute -right-4 bottom-5 h-28 w-28 rotate-[-12deg] opacity-30 sm:h-36 sm:w-36 ${gaming ? 'text-[#338eff]' : 'text-[#fc63db]'}`}/>
      <div className="relative z-10 flex items-center gap-2 text-[15px] font-black sm:text-lg"><Icon size={22} className={gaming ? 'text-[#6da9ff]' : 'text-[#ff70da]'}/>{title}</div>
      <p className="relative z-10 mt-2 max-w-[220px] text-[11px] leading-relaxed text-[#c6c5de] sm:text-[13px]">{description}</p>
      <span className="relative z-10 mt-4 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#8a19e8] to-[#d527c9] px-3 py-2 text-[11px] font-bold text-white sm:text-[12px]">{cta}<ArrowRight size={13}/></span>
    </UniversalButton>
  )
}

export default function PhoneHomepage({ onNavigate }: PhoneHomepageProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile) as { display_name?: string, username?: string, avatar_url?: string } | null
  const isLoading = useAuthStore((state) => state.isLoading)
  const { liveItems, onlineUsers, loadingLive, refresh } = useLiveContent()
  const [refreshing, setRefreshing] = useState(false)
  const [podcasts, setPodcasts] = useState<PodcastItem[]>([])
  const [podcastsLoading, setPodcastsLoading] = useState(false)

  const go = useCallback((path: string) => {
    if (onNavigate) onNavigate(path)
    else navigate(path)
  }, [navigate, onNavigate])

  const { joinRandomFreeSeat, joiningRandomSeat } = useRandomFreeSeat(user?.id, go)

  const loadPodcasts = useCallback(async () => {
    if (!user?.id) { setPodcasts([]); return }
    setPodcastsLoading(true)
    try {
      const { data, error } = await supabase.from('podcasts').select('*').order('created_at', { ascending: false }).limit(24)
      if (error) throw error
      setPodcasts((data || []) as PodcastItem[])
    } catch (err) {
      console.error('Failed to load podcasts:', err)
      setPodcasts([])
    } finally {
      setPodcastsLoading(false)
    }
  }, [user?.id])

  useEffect(() => { void loadPodcasts() }, [loadPodcasts])
  const battleItems = useMemo(() => liveItems.filter(item => item.isBattle), [liveItems])
  const hytroItems = useMemo(() => liveItems.filter(item => item.category === 'gaming'), [liveItems])

  const handleStreamClick = useCallback((item: LiveItem) => {
    go(item.category === 'gaming' ? `/gaming/watch/${item.id}` : `/watch/${item.id}`)
  }, [go])

  const refreshLiveContent = useCallback(async () => {
    setRefreshing(true)
    try { await refresh(); await new Promise(resolve => setTimeout(resolve, 300)) }
    finally { setRefreshing(false) }
  }, [refresh])

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])
  useEffect(() => {
    const openLive = () => go('/live')
    window.addEventListener('phone-open-live', openLive)
    return () => window.removeEventListener('phone-open-live', openLive)
  }, [go])
  useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refresh])

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#080916] font-semibold text-[#d16aff]"><span className="animate-pulse">Entering MaiTroll City...</span></div>

  const displayName = profile?.display_name || profile?.username || 'MaiTroll Citizen'
  const citizenAvatar = profile?.avatar_url || ''
  const links = [
    { label: 'Live', icon: Radio, path: '/live' },
    { label: 'People', icon: Users, path: '/explore' },
    { label: 'Treelz', icon: Play, path: '/treelz' },
    { label: 'Battles', icon: Trophy, path: '/battles' },
    { label: 'Podcasts', icon: Mic, path: '/podcast' },
    { label: 'Coins', icon: Coins, path: '/coins' },
  ]
  const heroCopy = [
    { kicker: 'BROADCAST  •  BATTLE  •  PODCAST  •  EARN', heading: 'Welcome to MaiTroll', text: 'Go live, join a seat, watch, and earn Troll Coins with the city’s live network.', icon: Mic },
    { kicker: 'YOUR CITY. YOUR WORLD.', heading: 'Explore MaiTroll City', text: 'Discover the post office, cinema, live broadcasts, court, and much more.', icon: Building2 },
    { kicker: 'GO LIVE  •  CONNECT  •  CREATE', heading: 'Your moment starts here', text: 'Meet creators, enjoy live shows, battle, and build your place in the city.', icon: Radio },
  ]
  const hero = heroCopy[0]
  const HeroIcon = hero.icon

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#090b18] text-white">
      {/* Preserve existing background/city-related event integration, but dim it behind the new cards. */}
      <div className="absolute inset-0 opacity-[.13]">
        <DynamicWeatherBackground isDark={true} showWalker={!!user} showBuildings={false} onBuildingClick={go} onJoinRandomSeat={joinRandomFreeSeat} isJoiningRandomSeat={joiningRandomSeat}/>
      </div>
      {/* Existing PhoneHeader owns your app header/menu and may coexist with the app-level bottom navigation. */}
      <PhoneHeader showTickerLinks={false}/>

      <main className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col gap-4 px-3 pb-24 pt-3 sm:gap-5 sm:px-5">
        {/* Cinematic branded hero */}
        <section className="relative min-h-[232px] overflow-hidden rounded-[24px] border border-[#9858db]/60 bg-[radial-gradient(ellipse_at_75%_70%,#63159d_0%,#24123f_37%,#091125_85%)] shadow-[inset_0_1px_0_#c68aff44,0_15px_38px_#0007] sm:min-h-[280px]">
          <div className="pointer-events-none absolute -right-10 top-4 h-40 w-40 rounded-full bg-[#e322dc]/40 blur-[65px]"/>
          <div className="pointer-events-none absolute bottom-0 right-[-12%] h-28 w-[80%] rotate-[-18deg] bg-gradient-to-r from-transparent via-[#fa3be6]/40 to-transparent blur-[20px]"/>
          <div className="pointer-events-none absolute right-[2%] top-[9%] rotate-[12deg] text-[#f59aff] drop-shadow-[0_0_30px_#c326ef] opacity-50"><HeroIcon size={160} strokeWidth={1.1}/></div>
          <div className="relative z-10 flex h-full min-h-[232px] flex-col justify-center px-5 py-6 sm:min-h-[280px] sm:px-8">
            <p className="max-w-[75%] text-[9px] font-black uppercase tracking-[.19em] text-[#bca7ff] sm:text-xs">{hero.kicker}</p>
            <h1 className="mt-2 max-w-[77%] text-[27px] font-black leading-[1.06] tracking-tight sm:text-[40px]">{hero.heading}</h1>
            <p className="mt-3 max-w-[72%] text-[11px] leading-relaxed text-[#c3c5df] sm:max-w-[65%] sm:text-sm">{hero.text}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <UniversalButton onClick={() => go('/broadcast/setup')} icon={<Radio size={17}/>} className={`${action} px-3 text-[11px] sm:px-5 sm:text-sm`}>Go Live Now</UniversalButton>
              <UniversalButton onClick={() => document.getElementById('maitroll-city-phone')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} variant="secondary" icon={<Building2 size={16}/>} className="min-h-10 border-[#cf84f9]/65 bg-[#0c1024]/70 px-3 text-[11px] sm:px-5 sm:text-sm">Explore City</UniversalButton>
            </div>
          </div>
        </section>

        {/* Six main shortcuts — same navigation as existing home */}
        <section aria-label="MaiTroll quick navigation" className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {links.map(({ label, icon: Icon, path }, i) => (
            <UniversalButton key={label} onClick={() => go(path)} variant="ghost" className={`flex min-h-[86px] w-full flex-col gap-2 rounded-[18px] border p-2 text-center ${i === 0 ? 'border-[#b436fb] bg-gradient-to-br from-[#8f16dc] to-[#c425cf] shadow-[0_6px_24px_#9210c855]' : 'border-white/[.065] bg-gradient-to-b from-[#1b1b37] to-[#131428] hover:border-[#b761fb]/40'}`}>
              <Icon size={23} strokeWidth={2.2} className={i === 0 ? 'text-white' : i === 5 ? 'text-[#ffc75c]' : 'text-[#d8a0ff]'}/>
              <span className="text-[12px] font-extrabold sm:text-[13px]">{label}{label === 'Battles' && battleItems.length > 0 ? ` (${battleItems.length})` : ''}</span>
            </UniversalButton>
          ))}
        </section>

        {/* Personalized citizen card + dedicated random seat action */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#6a56a5]/30 bg-[linear-gradient(110deg,#191a35,#201c3c,#100f24)] p-3 sm:p-4">
          <UniversalButton onClick={() => user ? go(`/profile/id/${user.id}`) : go('/auth')} variant="ghost" className="h-auto min-w-0 flex-1 justify-start p-0 text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#b84aff] bg-[#25114a] text-xl font-black text-[#e4acff] shadow-[0_0_15px_#a728e850]">
              {citizenAvatar ? <img src={citizenAvatar} alt="Your profile avatar" className="h-full w-full object-cover"/> : displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0"><p className="text-[10px] text-[#c4c0dc]">{user ? 'Welcome back, citizen' : 'Welcome to MaiTroll'}</p><p className="truncate text-[15px] font-black sm:text-lg">{displayName}</p></div>
          </UniversalButton>
          <UniversalButton onClick={() => go('/coins')} variant="secondary" icon={<Coins size={19} className="text-[#ffd15f]"/>} iconPosition="start" className="min-h-10 shrink-0 rounded-full border-[#dc71f6] bg-[#19132c] px-3 text-[12px]">Troll Coins <ChevronRight size={17}/></UniversalButton>
        </section>

        <UniversalButton loading={joiningRandomSeat} onClick={joinRandomFreeSeat} variant="secondary" icon={<Users size={18}/>} className="min-h-11 rounded-2xl">{joiningRandomSeat ? 'Finding a free seat…' : 'Join a Random Seat'}</UniversalButton>

        {/* Active broadcasters: real hook data, visible empty state */}
        <section className={`${panel} min-h-[238px] p-4 sm:p-5`}>
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-[18px] font-black sm:text-[22px]"><Radio size={22} className="text-[#ff40b9]"/> Live in MaiTroll City</h2><p className="text-[10px] text-[#acaac5]">{liveItems.length} broadcasts • {onlineUsers.toLocaleString()} online</p></div>
            <div className="flex items-center gap-2"><UniversalButton iconOnly aria-label="Refresh live streams" loading={refreshing} onClick={() => void refreshLiveContent()} variant="ghost" className="h-9 w-9 p-2"><RefreshCw size={16}/></UniversalButton><UniversalButton onClick={() => go('/live')} variant="ghost" icon={<ArrowRight size={15}/>} iconPosition="end" className="min-h-8 whitespace-nowrap px-1 text-[11px] text-[#ec83eb]">View All</UniversalButton></div>
          </div>
          {loadingLive ? (
            <div className="mt-4 flex gap-3 overflow-hidden">{Array.from({length: 3}, (_, i) => <div key={i} className="h-[152px] w-[136px] shrink-0 animate-pulse rounded-xl bg-white/10"/>)}</div>
          ) : liveItems.length > 0 ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">{liveItems.slice(0, 12).map(item => <PhoneLiveTile key={item.id} item={item} onClick={() => handleStreamClick(item)}/>)}</div>
          ) : (
            <div className="relative mt-3 flex min-h-[154px] flex-col items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_bottom,#441a6c_0%,transparent_70%)] px-3 text-center">
              <Radio size={42} className="mb-2 text-[#d946e9] drop-shadow-[0_0_20px_#c128f4]"/>
              <h3 className="text-[15px] font-black">No broadcasts live yet</h3>
              <p className="mt-1 text-[11px] text-[#b3a8cd]">Be the first to go live and bring MaiTroll City to life!</p>
              <UniversalButton onClick={() => go('/broadcast/setup')} icon={<Radio size={16}/>} className={`${action} mt-3 min-h-9 py-1.5`}>Go Live Now</UniversalButton>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-30 [background:repeating-linear-gradient(90deg,#a448f5_0_14px,transparent_14px_22px,#6931aa_22px_38px,transparent_38px_44px)] [clip-path:polygon(0_60%,15%_20%,22%_45%,30%_0%,40%_55%,52%_15%,61%_40%,69%_0%,79%_50%,91%_20%,100%_60%,100%_100%,0_100%)]"/>
            </div>
          )}
        </section>

        {/* Gaming and podcast discovery */}
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard type="gaming" title="Hytro Gaming Streams" description="Watch live gaming, compete and connect with the Hytro community." cta="Explore Gaming" onClick={() => go('/hytro')}/>
          <FeatureCard type="podcast" title="Podcasts" description="Discover live and recorded podcasts from creators in the city." cta="Browse Podcasts" onClick={() => go('/podcast')}/>
        </div>
        {hytroItems.length > 0 && <section className={`${panel} p-3 sm:p-4`}><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Gamepad2 size={18} className="text-[#8f90ff]"/> Gaming live now</h3><div className="flex gap-3 overflow-x-auto scrollbar-hide">{hytroItems.slice(0, 12).map(item => <PhoneLiveTile key={item.id} item={item} onClick={() => handleStreamClick(item)}/>)}</div></section>}
        {(podcastsLoading || podcasts.length > 0) && <section className={`${panel} p-3 sm:p-4`}><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Mic size={18} className="text-[#f16cda]"/> Discover podcasts</h3><div className="flex gap-3 overflow-x-auto scrollbar-hide">{podcastsLoading ? Array.from({length:3}, (_, i) => <div key={i} className="h-[104px] w-[160px] shrink-0 animate-pulse rounded-xl bg-white/10"/>) : podcasts.slice(0,8).map(podcast =>         <UniversalButton key={podcast.id} onClick={() => go(`/podcast/${podcast.id}`)} variant="ghost" icon={<Mic size={20} className="mb-2 text-[#ec6ee8]"/>} className="min-h-[105px] w-[170px] shrink-0 flex-col justify-center rounded-xl border border-[#ae4fde]/40 bg-gradient-to-br from-[#371b52] to-[#13152e] p-3 text-left"><span className="truncate text-xs font-black">{podcast.title || 'Untitled Podcast'}</span><span className="mt-1 truncate text-[10px] text-[#b7aacb]">{podcast.host_username || podcast.host_user_id || 'Unknown Host'}</span><span className="mt-1 text-[10px] text-[#d9afff]">{Number(podcast.listener_count || 0)} listeners</span></UniversalButton>)}</div></section>}

        <div id="maitroll-city-phone"><PhoneCityBuildings onOpen={go}/></div>
        <footer className="flex justify-center gap-4 pb-2 text-[11px] text-[#aa8bc8]"><Link to="/about">About</Link><Link to="/support">Support</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/privacy">Privacy</Link></footer>
      </main>
      <MaiTrollRulesPopup/>
      <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{scrollbar-width:none;-ms-overflow-style:none}`}</style>
    </div>
  )
}
