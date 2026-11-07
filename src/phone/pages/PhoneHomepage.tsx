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
import ActiveOfficialEventTiles from '@/components/maiCalendar/ActiveOfficialEventTiles'

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
  { title: 'Employment Office', path: '/careers', icon: BriefcaseBusiness, kind: 'post' },
] as const

const panel = 'mai-neon-panel relative overflow-hidden rounded-[22px] bg-[#100b25]'
const action = 'mai-neon-cta inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-5 py-2 text-[13px] font-black transition active:scale-[.98]'

/**
 * MAiTroll neon-gloss home skin.
 * All visual rules are scoped to this page. No new package, image, DB call,
 * route, authentication logic, or app-wide color override is introduced.
 * The existing PhoneHeader and the application's bottom navigation remain
 * independent components and keep their original behavior.
 */
const MAI_NEON_STYLES = `
.scrollbar-hide::-webkit-scrollbar {display:none}
.scrollbar-hide {scrollbar-width:none;-ms-overflow-style:none}
.mai-neon-home {
  --mai-lime:#39ff14; --mai-cyan:#00d9ff; --mai-pink:#ff25e8;
  --mai-purple:#af20ff; --mai-dark:#080615;
  background:radial-gradient(ellipse at 50% 12%,#25103c 0,transparent 38%),#080615;
  color:#faf7ff;
  isolation:isolate;
}
.mai-neon-home *, .mai-neon-home *::before, .mai-neon-home *::after {box-sizing:border-box}
.mai-neon-home button:focus-visible, .mai-neon-home a:focus-visible {
  outline:2px solid var(--mai-cyan);outline-offset:3px;
}
.mai-neon-home button:disabled {opacity:.5;cursor:not-allowed;box-shadow:none!important}
.mai-page-aura {
  background: radial-gradient(circle at 2% 25%,#6200cb15,transparent 24%),
  radial-gradient(circle at 95% 48%,#008aff14,transparent 30%),
  radial-gradient(circle at 55% 86%,#b100f31c,transparent 37%);
}
.mai-header-stage {min-height:130px;overflow:hidden;
  background:linear-gradient(180deg,#060511 0%,#100a26 76%,#27064a 100%);
  border-bottom:1px solid #00d9ff77;
  box-shadow:0 8px 26px #8f0fff35,0 2px 6px #00d9ff44;
}
.mai-header-stage::after {content:'';position:absolute;bottom:0;left:0;right:0;
  height:12px;background:#c317f5;opacity:.55;filter:blur(11px);pointer-events:none}
.mai-skyline {height:90px;display:flex;align-items:flex-end;justify-content:space-between;
  gap:2px;opacity:.78;overflow:hidden;
  background:linear-gradient(0deg,#b700ff66 0,transparent 45%);
}
.mai-skyscraper {display:block;position:relative;flex:1;min-width:5px;max-width:35px;
  border:1px solid #3a16ae; border-bottom:0;
  background:repeating-linear-gradient(180deg,#00d9ff55 0 2px,transparent 2px 9px),
   repeating-linear-gradient(90deg,#130b33 0 5px,#201049 5px 8px);
  box-shadow:0 0 12px #a700fa75, inset 1px 0 3px #00d9ff50;
}
.mai-skyscraper:nth-child(3n){border-color:#a700ff;background-color:#2b0758}
.mai-skyscraper:nth-child(5n){box-shadow:0 0 14px #00d9ff99}
.mai-neon-hero,.mai-neon-panel,.mai-citizen-panel,.mai-random-seat,.mai-shortcut,
.mai-feature-card,.mai-building-card,.mai-podcast-tile,.mai-live-tile {
  -webkit-tap-highlight-color:transparent;
}
.mai-neon-hero {
  border:2px solid transparent;
  background:
   linear-gradient(115deg,#0d1025 0%,#0e0a25 45%,#310e50 85%,#111029 100%) padding-box,
   linear-gradient(115deg,#39ff14 0%,#00d9ff 22%,#a100ff 58%,#ff25e8 100%) border-box;
  box-shadow:0 0 8px #39ff1480,0 0 19px #00d9ff6b,0 0 26px #a100ff7c,
    inset 0 2px 0 #ffffff18,inset 0 18px 35px #ffffff08,0 18px 28px #000a;
}
.mai-neon-hero::before,.mai-neon-panel::before,.mai-citizen-panel::before,
.mai-feature-card::before,.mai-shortcut::before,.mai-random-seat::before {
  content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(160deg,#ffffff1e 0%,#ffffff05 18%,transparent 38%,#ffffff06 100%);
}
.mai-neon-hero::after {content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 80% 58%,#de1cff56,transparent 42%),
  radial-gradient(circle at 54% 100%,#00d9ff20,transparent 55%)}
.mai-neon-hero .mai-hero-mic {filter:drop-shadow(0 0 4px #ff91ff) drop-shadow(0 0 19px #f317ed);z-index:1}
.mai-hero-kicker {text-shadow:0 0 9px #c16eff9c}
.mai-green-word {color:var(--mai-lime);text-shadow:0 0 16px #39ff1480}
.mai-energy-waves {overflow:hidden;opacity:.65;z-index:1}
.mai-energy-waves span {display:block;position:absolute;width:92%;height:160px;right:-20%;bottom:-136px;
  border-top:2px solid #ff27ec;border-radius:50%;transform:rotate(-12deg);
  box-shadow:0 -7px 25px #ff27ec80}
.mai-energy-waves span:nth-child(2){bottom:-144px;right:-8%;border-color:#00d9ff;box-shadow:0 -8px 20px #00d9ff8c}
.mai-energy-waves span:nth-child(3){bottom:-153px;right:1%;border-color:#39ff14;box-shadow:0 -4px 12px #39ff1499}
.mai-neon-home .mai-neon-cta {
  background:linear-gradient(180deg,#b2ff3e 0%,#39ff14 37%,#16d100 100%);
  border:1px solid #b3ff79;color:#090b0a;font-weight:900;
  text-shadow:none;box-shadow:inset 0 2px 0 #ffffffa0,inset 0 -3px 6px #0b5c0c70,
   0 0 5px #39ff14,0 0 16px #39ff14cf,0 7px 22px #39ff1465;
}
.mai-neon-home .mai-neon-cta:hover {filter:brightness(1.08);box-shadow:0 0 22px #39ff14,0 0 40px #39ff1466}
.mai-neon-home .mai-outline-cta {background:linear-gradient(170deg,#281044e6,#0b0927f2);
  border:1.5px solid #fc4cfe;color:#fff;
  box-shadow:inset 0 2px 0 #ffffff20,0 0 13px #ec20fd9e;
  text-shadow:0 0 9px #e332fc75;
}
.mai-neon-home .mai-shortcut {
  position:relative;--tile-accent:#af20ff;--tile-glow:#af20ff7c;
  color:#fff; border:2px solid var(--tile-accent);
  background:radial-gradient(ellipse at 45% 0%,#312052 0%,#130d2b 55%,#0d0a20 100%);
  box-shadow:0 0 10px var(--tile-glow),inset 0 1px 0 #ffffff24,0 9px 19px #0008;
  transition:transform .18s ease,filter .18s ease,box-shadow .18s ease;
}
.mai-neon-home .mai-shortcut:hover {transform:translateY(-2px);filter:brightness(1.12);box-shadow:0 0 22px var(--tile-glow)}
.mai-neon-home .mai-shortcut-icon {position:relative;z-index:1;color:var(--tile-accent);
  filter:drop-shadow(0 0 5px var(--tile-accent)) drop-shadow(0 0 10px var(--tile-accent))}
.mai-neon-home .mai-shortcut span {position:relative;z-index:1;text-shadow:0 1px 9px #000}
.mai-neon-home .mai-shortcut-green {--tile-accent:#39ff14;--tile-glow:#39ff148e}
.mai-neon-home .mai-shortcut-cyan {--tile-accent:#00d9ff;--tile-glow:#00d9ff88}
.mai-neon-home .mai-shortcut-pink {--tile-accent:#ff25e8;--tile-glow:#ff25e87d}
.mai-neon-home .mai-shortcut-purple {--tile-accent:#b134ff;--tile-glow:#ad21ff99}
.mai-neon-home .mai-shortcut-green:first-child {background:linear-gradient(145deg,#126a14,#071c0e 65%,#06120c)}
.mai-neon-panel {border:1.5px solid #ab34ff;
  background:radial-gradient(ellipse at 50% 100%,#2a0b54,#100a24 70%);
  box-shadow:0 0 8px #a117ff70,0 0 21px #9b1aff38,
   inset 0 1px 0 #ffffff2e,0 13px 25px #0008;
}
.mai-live-panel {border-color:#be31ff;
  box-shadow:0 0 9px #ce17ff7c,0 0 24px #00d9ff2a,inset 0 1px 0 #ffffff26}
.mai-neon-home .mai-citizen-panel {position:relative;border:1.5px solid transparent;
 background:linear-gradient(120deg,#18112c,#111026) padding-box,
  linear-gradient(100deg,#9a22ff,#00d9ff,#39ff14) border-box;
 box-shadow:0 0 12px #970eff60,inset 0 1px 0 #ffffff12;
}
.mai-avatar-ring {border-color:#d742ff;box-shadow:0 0 12px #c900ffce,0 0 23px #a10fff80}
.mai-citizen-name {color:#6dff36;text-shadow:0 0 12px #39ff1480}
.mai-neon-home .mai-wallet-button {background:linear-gradient(155deg,#0c2b18,#07160e);
  color:#fff;border:2px solid #39ff14;box-shadow:inset 0 2px 0 #ffffff22,0 0 14px #39ff14af;
  font-weight:800}
.mai-neon-home .mai-random-seat {position:relative;
 background:linear-gradient(110deg,#3e0c67,#5e1098,#40055c);color:#fff;
 border:1.5px solid #f242ff;box-shadow:0 0 14px #d013ff88,inset 0 2px 0 #ffffff2b;
 font-weight:900;text-shadow:0 0 10px #fd9aff}
.mai-neon-home .mai-refresh-button {border:1px solid #00d9ff;background:#081526;
 color:#00d9ff;box-shadow:0 0 10px #00d9ff70}
.mai-neon-home .mai-view-all {background:linear-gradient(145deg,#124020,#050f0b);
 border:1.5px solid #39ff14;border-radius:12px;color:#fff;
 box-shadow:0 0 13px #39ff14af;text-shadow:0 0 8px #39ff14a0;font-weight:900}
.mai-live-empty {background:radial-gradient(ellipse at 50% 100%,#46116b9c,transparent 78%)}
.mai-icon-purple {color:#cf4cff;filter:drop-shadow(0 0 9px #b00dff)}
.mai-icon-pink {color:#ff45e9;filter:drop-shadow(0 0 9px #ff25e8)}
.mai-icon-cyan {color:#00d9ff;filter:drop-shadow(0 0 9px #00d9ff)}
.mai-neon-home .mai-live-tile {border:1.5px solid #a52fff;
 box-shadow:0 0 12px #9c31ff8c,inset 0 1px 0 #ffffff28}
.mai-live-badge {background:linear-gradient(135deg,#ff297c,#d5007c);box-shadow:0 0 9px #ff2085a3}
.mai-equalizer span {flex:1;min-width:2px;
 background:linear-gradient(0deg,#a72bff,#f22cfb,#00d9ff,#39ff14);
 box-shadow:0 0 5px #b416fa75}
.mai-equalizer span:nth-child(4n) {background:linear-gradient(0deg,#bb20ff,#00d9ff)}
.mai-equalizer span:nth-child(5n) {background:linear-gradient(0deg,#8c16ff,#39ff14)}
.mai-neon-home .mai-feature-card {position:relative;border:1.5px solid #962bff;
 background:radial-gradient(ellipse at 80% 50%,#372059,#110d2a 75%);
 box-shadow:0 0 13px #b81dff90,inset 0 2px 0 #ffffff23;color:#fff;
}
.mai-neon-home .mai-feature-gaming {border-color:#00d9ff;box-shadow:0 0 13px #00d9ffab,inset 0 2px 0 #ffffff23}
.mai-neon-home .mai-feature-podcast {border-color:#e027f8;box-shadow:0 0 13px #e027f8a1,inset 0 2px 0 #ffffff23}
.mai-feature-cta {background:linear-gradient(110deg,#a119eb,#e522cc);
 border:1px solid #ff88ff;box-shadow:0 0 9px #ad20ff88}
.mai-city-panel {border-color:#00d9ff;box-shadow:0 0 18px #00d9ff5e,0 0 8px #b12cff8f}
.mai-building-art {border-bottom:1px solid #ff27fa90}
.mai-building-card {border:1px solid #ae38ff;box-shadow:0 0 9px #a11bff75}
.mai-building-card:hover {border-color:#00d9ff;box-shadow:0 0 15px #00d9ff98}
.mai-neon-home .mai-nav-arrow {background:linear-gradient(145deg,#8309d1,#db21e7);
 border:1px solid #ff61f4;box-shadow:0 0 9px #ec21ff9a}
.mai-neon-home .mai-podcast-tile {background:linear-gradient(120deg,#371b52,#0b142e);
 border:1px solid #d343ff;box-shadow:0 0 9px #a735ff8a}
@media(max-width:400px){
 .mai-neon-home .mai-neon-hero h1 {font-size:25px}
 .mai-neon-home .mai-neon-hero .mai-hero-mic {right:-26px;opacity:.5}
 .mai-neon-home .mai-neon-hero {min-height:248px}
 .mai-neon-home .mai-wallet-button {padding:7px 10px;font-size:11px}
 .mai-neon-home .mai-shortcut {min-height:88px}
}
@media(prefers-reduced-motion:reduce){
 .mai-neon-home .mai-shortcut{transition:none}
 .mai-neon-home .mai-shortcut:hover{transform:none}
}
`

/** CSS-drawn city facade: no additional asset URLs or image dependencies required. */
function CityArtwork({ kind, label, Icon }: {
  kind: string
  label: string
  Icon: React.ElementType
}) {
  return (
    <div className="mai-building-art relative flex h-[120px] w-full items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,#55317b_0%,#1d1846_48%,#091326_100%)] sm:h-[155px]">
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
    <section className={`${panel} mai-city-panel px-3 py-4 sm:px-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[19px] font-black uppercase tracking-tight sm:text-[24px]"><Building2 className="mai-icon-purple"/> MaiTroll City</h2>
          <p className="text-[11px] text-[#a6a7c4] sm:text-[13px]">Explore the city • Visit buildings • Discover what&apos;s live</p>
        </div>
        <div className="flex gap-2">
          <UniversalButton iconOnly aria-label="Previous city buildings" icon={<ChevronLeft size={20}/>} onClick={() => scrollToPage(page - 1)} disabled={page === 0} className="h-9 w-9 rounded-full p-0" />
          <UniversalButton iconOnly aria-label="Next city buildings" icon={<ChevronRight size={20}/>} onClick={() => scrollToPage(page + 1)} disabled={page >= maxPage} className="mai-nav-arrow h-9 w-9 rounded-full p-0 text-white" />
        </div>
      </div>
      <div ref={stripRef} onScroll={(event) => {
        const el = event.currentTarget
        setPage(Math.min(maxPage, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))))
      }} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {PHONE_CITY_BUILDINGS.map(({ title, path, icon: Icon, kind }) => (
          <UniversalButton type="button" key={title} onClick={() => onOpen(path)} aria-label={`Visit ${title}`} variant="ghost" className="group h-auto w-1/4 shrink-0 snap-start p-0 text-left sm:px-1.5">
            <div className="mai-building-card overflow-hidden rounded-xl bg-[#141428] transition">
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
    <UniversalButton type="button" onClick={onClick} variant="ghost" className="mai-live-tile group relative h-[152px] w-[136px] shrink-0 overflow-hidden rounded-2xl bg-[#17122b] p-0 text-left sm:h-[180px] sm:w-[165px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#6939bd,#17122b_65%)]" />
      {item.streamerAvatar ? <img src={item.streamerAvatar} alt={item.streamerName || 'Broadcaster'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <Radio className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#c343ff]/70" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090716] via-transparent to-[#090716]/25" />
      <span className="mai-live-badge absolute left-2 top-2 flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-black text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white"/> LIVE</span>
      <span className="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-bold text-white">{item.viewerCount || 0} watching</span>
      <div className="absolute inset-x-0 bottom-0 p-3"><div className="truncate text-[12px] font-black text-white">{item.title || 'Live Broadcast'}</div><div className="truncate text-[10px] font-semibold text-[#deb9ff]">{item.streamerName || 'MaiTroll Citizen'}</div></div>
    </UniversalButton>
  )
})

function FeatureCard({ type, title, description, cta, onClick }: { type: 'gaming' | 'podcast', title: string, description: string, cta: string, onClick: () => void }) {
  const gaming = type === 'gaming'
  const Icon = gaming ? Gamepad2 : Mic
  return (
    <UniversalButton onClick={onClick} variant="ghost" icon={<ArrowRight size={13} />} iconPosition="end" className={`mai-feature-card relative min-h-[164px] w-full overflow-hidden rounded-[20px] p-4 text-left transition active:scale-[.99] ${gaming ? 'mai-feature-gaming' : 'mai-feature-podcast'}`}>
      <Icon className={`absolute -right-4 bottom-5 h-28 w-28 rotate-[-12deg] opacity-30 sm:h-36 sm:w-36 ${gaming ? 'text-[#338eff]' : 'text-[#fc63db]'}`}/>
      <div className="relative z-10 flex items-center gap-2 text-[15px] font-black sm:text-lg"><Icon size={22} className={gaming ? 'mai-icon-cyan' : 'mai-icon-pink'}/>{title}</div>
      <p className="relative z-10 mt-2 max-w-[220px] text-[11px] leading-relaxed text-[#c6c5de] sm:text-[13px]">{description}</p>
      <span className="mai-feature-cta relative z-10 mt-4 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-white sm:text-[12px]">{cta}<ArrowRight size={13}/></span>
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

  if (isLoading) return <div className="mai-loading flex min-h-screen items-center justify-center bg-[#080916] font-semibold text-[#39ff14]"><span className="animate-pulse">Entering MaiTroll City...</span></div>

  const displayName = profile?.display_name || profile?.username || 'MaiTroll Citizen'
  const citizenAvatar = profile?.avatar_url || ''
  const links = [
    { label: 'Live', icon: Radio, path: '/live' },
    { label: 'Squads', icon: Users, path: '/squads' },
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
    <div className="mai-neon-home relative min-h-[100dvh] overflow-x-hidden bg-[#070511] text-white">
      {/* Decorative layers cannot block any existing touch targets or navigation. */}
      <div className="mai-page-aura pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[.08]" aria-hidden="true">
        <DynamicWeatherBackground isDark={true} showWalker={!!user} showBuildings={false} onBuildingClick={go} onJoinRandomSeat={joinRandomFreeSeat} isJoiningRandomSeat={joiningRandomSeat}/>
      </div>
      {/* Reuse the real PhoneHeader: existing menu, account, notifications and events stay wired. */}
      <header className="mai-header-stage relative z-20">
        <div className="mai-skyline pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true">
          {[34, 58, 46, 82, 62, 97, 71, 51, 90, 62, 40, 75, 57, 98, 65, 44, 78, 55, 36, 89, 68, 51, 32, 74].map((height, index) => (
            <span key={index} className="mai-skyscraper" style={{ height: `${height}%` }} />
          ))}
        </div>
        <PhoneHeader showTickerLinks={false}/>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col gap-4 px-3 pb-28 pt-4 sm:gap-5 sm:px-5">
        {/* Cinematic branded hero */}
        <section className="mai-neon-hero relative min-h-[232px] overflow-hidden rounded-[24px] sm:min-h-[280px]">
          <div className="pointer-events-none absolute -right-10 top-4 h-40 w-40 rounded-full bg-[#e322dc]/40 blur-[65px]"/>
          <div className="pointer-events-none absolute bottom-0 right-[-12%] h-28 w-[80%] rotate-[-18deg] bg-gradient-to-r from-transparent via-[#fa3be6]/40 to-transparent blur-[20px]"/>
          <div className="mai-hero-mic pointer-events-none absolute right-[2%] top-[9%] rotate-[12deg] text-[#f59aff] opacity-80"><HeroIcon size={160} strokeWidth={1.1}/></div>
          <div className="mai-energy-waves pointer-events-none absolute inset-x-0 bottom-0 h-24" aria-hidden="true"><span/><span/><span/></div>
          <div className="relative z-10 flex h-full min-h-[232px] flex-col justify-center px-5 py-6 sm:min-h-[280px] sm:px-8">
            <p className="mai-hero-kicker max-w-[89%] text-[9px] font-black uppercase tracking-[.16em] text-[#e1d8ff] sm:text-xs">{hero.kicker}</p>
            <h1 className="mt-2 max-w-[88%] text-[27px] font-black leading-[1.08] tracking-tight sm:text-[40px]">Welcome to <span className="mai-green-word">MaiTroll</span></h1>
            <p className="mt-3 max-w-[79%] text-[11px] leading-relaxed text-[#ebe7ff] sm:max-w-[65%] sm:text-sm">{hero.text}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <UniversalButton onClick={() => go('/broadcast/setup')} icon={<Radio size={17}/>} className={`${action} px-3 text-[11px] sm:px-5 sm:text-sm`}>Go Live Now</UniversalButton>
              <UniversalButton onClick={() => document.getElementById('maitroll-city-phone')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} variant="secondary" icon={<Building2 size={16}/>} className="mai-outline-cta min-h-10 px-3 text-[11px] sm:px-5 sm:text-sm">Explore City</UniversalButton>
            </div>
          </div>
        </section>

        {/* Six main shortcuts — same navigation as existing home */}
        <section aria-label="MaiTroll quick navigation" className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {links.map(({ label, icon: Icon, path }, i) => (
            <UniversalButton key={label} onClick={() => go(path)} variant="ghost" className={`mai-shortcut mai-shortcut-${['green', 'purple', 'cyan', 'cyan', 'green', 'pink'][i]} flex min-h-[94px] w-full flex-col gap-2 rounded-[18px] p-2 text-center sm:min-h-[112px]`}>
              <Icon size={27} strokeWidth={2.2} className="mai-shortcut-icon"/>
              <span className="text-[12px] font-extrabold sm:text-[13px]">{label}{label === 'Battles' && battleItems.length > 0 ? ` (${battleItems.length})` : ''}</span>
            </UniversalButton>
          ))}
        </section>

        {/* Personalized citizen card + dedicated random seat action */}
        <section className="mai-citizen-panel relative flex flex-wrap items-center justify-between gap-3 rounded-[20px] p-3 sm:p-4">
          <UniversalButton onClick={() => user ? go(`/profile/id/${user.id}`) : go('/auth')} variant="ghost" className="h-auto min-w-0 flex-1 justify-start p-0 text-left">
            <div className="mai-avatar-ring flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-[#25114a] text-xl font-black text-[#e4acff]">
              {citizenAvatar ? <img src={citizenAvatar} alt="Your profile avatar" className="h-full w-full object-cover"/> : displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0"><p className="text-[10px] text-[#c4c0dc]">{user ? 'Welcome back, citizen' : 'Welcome to MaiTroll'}</p><p className="mai-citizen-name truncate text-[15px] font-black sm:text-lg">{displayName}</p></div>
          </UniversalButton>
          <UniversalButton onClick={() => go('/coins')} variant="secondary" icon={<Coins size={19} className="mai-icon-cyan"/>} iconPosition="start" className="mai-wallet-button min-h-10 shrink-0 rounded-full px-3 text-[12px]">Troll Coins <ChevronRight size={17}/></UniversalButton>
        </section>

        <UniversalButton loading={joiningRandomSeat} onClick={joinRandomFreeSeat} variant="secondary" icon={<Users size={18}/>} className="mai-random-seat min-h-11 w-full rounded-2xl">{joiningRandomSeat ? 'Finding a free seat…' : 'Join a Random Seat'}</UniversalButton>

        {/* Active broadcasters: real hook data, visible empty state */}
        <section className={`${panel} mai-live-panel min-h-[238px] p-4 sm:p-5`}>
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-[18px] font-black sm:text-[22px]"><Radio size={22} className="mai-icon-pink"/> Live in MaiTroll City</h2><p className="text-[10px] text-[#acaac5]">{liveItems.length} broadcasts • {onlineUsers.toLocaleString()} online</p></div>
            <div className="flex items-center gap-2"><UniversalButton iconOnly aria-label="Refresh live streams" loading={refreshing} onClick={() => void refreshLiveContent()} variant="ghost" className="mai-refresh-button h-9 w-9 p-2"><RefreshCw size={16}/></UniversalButton><UniversalButton onClick={() => go('/live')} variant="ghost" icon={<ArrowRight size={15}/>} iconPosition="end" className="mai-view-all min-h-8 whitespace-nowrap px-3 text-[11px]">View All</UniversalButton></div>
          </div>
          {loadingLive ? (
            <div className="mt-4 flex gap-3 overflow-hidden">{Array.from({length: 3}, (_, i) => <div key={i} className="h-[152px] w-[136px] shrink-0 animate-pulse rounded-xl bg-white/10"/>)}</div>
          ) : liveItems.length > 0 ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">{liveItems.slice(0, 12).map(item => <PhoneLiveTile key={item.id} item={item} onClick={() => handleStreamClick(item)}/>)}</div>
          ) : (
            <div className="mai-live-empty relative mt-3 flex min-h-[183px] flex-col items-center justify-center overflow-hidden rounded-xl px-3 pb-6 text-center">
              <Radio size={42} className="mai-icon-pink mb-2"/>
              <h3 className="text-[15px] font-black">No broadcasts live yet</h3>
              <p className="mt-1 text-[11px] text-[#b3a8cd]">Be the first to go live and bring MaiTroll City to life!</p>
              <UniversalButton onClick={() => go('/broadcast/setup')} icon={<Radio size={16}/>} className={`${action} mt-3 min-h-9 py-1.5`}>Go Live Now</UniversalButton>
              <div className="mai-equalizer pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-between gap-1 opacity-80" aria-hidden="true">
                {[19, 27, 35, 40, 28, 45, 36, 23, 31, 37, 20, 42, 32, 21, 35, 25, 43, 31, 22, 36, 44, 30, 26, 39, 23, 35, 42, 29, 17, 36, 25, 38].map((height, i) => (
                  <span key={i} style={{height: `${height}px`}} />
                ))}
              </div>
            </div>
          )}
        </section>

        <ActiveOfficialEventTiles compact />

        {/* Gaming and podcast discovery */}
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard type="gaming" title="Hytro Gaming Streams" description="Watch live gaming, compete and connect with the Hytro community." cta="Explore Gaming" onClick={() => go('/hytro')}/>
          <FeatureCard type="podcast" title="Podcasts" description="Discover live and recorded podcasts from creators in the city." cta="Browse Podcasts" onClick={() => go('/podcast')}/>
        </div>
        {hytroItems.length > 0 && <section className={`${panel} p-3 sm:p-4`}><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Gamepad2 size={18} className="mai-icon-cyan"/> Gaming live now</h3><div className="flex gap-3 overflow-x-auto scrollbar-hide">{hytroItems.slice(0, 12).map(item => <PhoneLiveTile key={item.id} item={item} onClick={() => handleStreamClick(item)}/>)}</div></section>}
        {(podcastsLoading || podcasts.length > 0) && <section className={`${panel} p-3 sm:p-4`}><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Mic size={18} className="mai-icon-pink"/> Discover podcasts</h3><div className="flex gap-3 overflow-x-auto scrollbar-hide">{podcastsLoading ? Array.from({length:3}, (_, i) => <div key={i} className="h-[104px] w-[160px] shrink-0 animate-pulse rounded-xl bg-white/10"/>) : podcasts.slice(0,8).map(podcast =>         <UniversalButton key={podcast.id} onClick={() => go(`/podcast/${podcast.id}`)} variant="ghost" icon={<Mic size={20} className="mb-2 text-[#ec6ee8]"/>} className="mai-podcast-tile min-h-[105px] w-[170px] shrink-0 flex-col justify-center rounded-xl p-3 text-left"><span className="truncate text-xs font-black">{podcast.title || 'Untitled Podcast'}</span><span className="mt-1 truncate text-[10px] text-[#b7aacb]">{podcast.host_username || podcast.host_user_id || 'Unknown Host'}</span><span className="mt-1 text-[10px] text-[#d9afff]">{Number(podcast.listener_count || 0)} listeners</span></UniversalButton>)}</div></section>}

        <div id="maitroll-city-phone"><PhoneCityBuildings onOpen={go}/></div>
        <footer className="flex justify-center gap-4 pb-2 text-[11px] text-[#aa8bc8]"><Link to="/about">About</Link><Link to="/support">Support</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/privacy">Privacy</Link></footer>
      </main>
      <MaiTrollRulesPopup/>
      <style>{MAI_NEON_STYLES}</style>
    </div>
  )
}
