import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import BattleArenaRoomPreview from './BattleArenaRoomPreview';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Swords, Radio, Users, Eye, Trophy, Crown, Flame, Zap, Search, Plus,
  ArrowUpRight, ChevronRight, Clock3, Sparkles, ShieldCheck, SlidersHorizontal,
  Play, CircleDot, Gamepad2, Music2, Mic2, CalendarDays,
} from 'lucide-react';

const BattleArenaRoomPreviewView = BattleArenaRoomPreview as React.ComponentType<
  Parameters<typeof BattleArenaRoomPreview>[0]
>;

// DEV-ONLY PREVIEW — premium BattleArena discovery concept.
// Fake data only. No Supabase calls and no production battle actions.
// Route: /dev/battle-arena-preview

type BattleStatus = 'active' | 'starting' | 'scheduled';
type Battle = {
  id: string;
  status: BattleStatus;
  challenger: string;
  opponent: string;
  scoreC: number;
  scoreO: number;
  viewers: number;
  mode: string;
  category: string;
  startsIn?: string;
  featured?: boolean;
  accent: 'cyan' | 'violet' | 'lime' | 'rose';
  artC: string;
  artO: string;
};

const SAMPLE_BATTLES: Battle[] = [
  { id: 'b1', status: 'active', challenger: 'NeonReaper', opponent: 'HyperSpecter', scoreC: 18420, scoreO: 16110, viewers: 1240, mode: 'Random Battle', category: 'Spotlight', featured: true, accent: 'cyan', artC: 'from-cyan-300/35 via-blue-900/20 to-[#07101d]', artO: 'from-fuchsia-300/35 via-violet-900/20 to-[#12091d]' },
  { id: 'b2', status: 'active', challenger: 'VoidTroll', opponent: 'FrostNomad', scoreC: 9200, scoreO: 8750, viewers: 680, mode: 'Challenge', category: 'Creator Clash', accent: 'violet', artC: 'from-violet-300/30 via-indigo-950/30 to-[#080b18]', artO: 'from-sky-300/25 via-blue-950/30 to-[#080b18]' },
  { id: 'b3', status: 'active', challenger: 'PlasmaBandit', opponent: 'AstroRazor', scoreC: 4100, scoreO: 4300, viewers: 412, mode: 'Random Battle', category: 'Open Arena', accent: 'lime', artC: 'from-lime-300/25 via-emerald-950/30 to-[#07140f]', artO: 'from-orange-300/25 via-rose-950/30 to-[#16090d]' },
  { id: 'b4', status: 'starting', challenger: 'CrimsonWraith', opponent: 'ToxicGlitch', scoreC: 0, scoreO: 0, viewers: 205, mode: 'Challenge', category: 'Starting Soon', accent: 'rose', artC: 'from-rose-300/30 via-red-950/30 to-[#16090d]', artO: 'from-lime-300/20 via-emerald-950/30 to-[#07140f]' },
  { id: 'b5', status: 'scheduled', challenger: 'ShadowComet', opponent: 'EmberSpecter', scoreC: 0, scoreO: 0, viewers: 0, mode: 'Scheduled Match', category: 'Upcoming', startsIn: '12 min', accent: 'violet', artC: 'from-indigo-300/30 via-violet-950/30 to-[#0b0817]', artO: 'from-amber-300/25 via-orange-950/30 to-[#160d06]' },
  { id: 'b6', status: 'active', challenger: 'EchoVandal', opponent: 'LunarFury', scoreC: 11750, scoreO: 12900, viewers: 936, mode: 'Creator Clash', category: 'Trending', accent: 'cyan', artC: 'from-teal-300/25 via-cyan-950/30 to-[#061319]', artO: 'from-purple-300/30 via-fuchsia-950/30 to-[#160718]' },
];

const accentMap = {
  cyan: { text: 'text-cyan-200', border: 'border-cyan-300/25', glow: 'shadow-[0_0_45px_rgba(34,211,238,0.12)]', bar: 'bg-cyan-300', soft: 'bg-cyan-300/10' },
  violet: { text: 'text-violet-200', border: 'border-violet-300/25', glow: 'shadow-[0_0_45px_rgba(167,139,250,0.12)]', bar: 'bg-violet-300', soft: 'bg-violet-300/10' },
  lime: { text: 'text-lime-200', border: 'border-lime-300/25', glow: 'shadow-[0_0_45px_rgba(163,230,53,0.10)]', bar: 'bg-lime-300', soft: 'bg-lime-300/10' },
  rose: { text: 'text-rose-200', border: 'border-rose-300/25', glow: 'shadow-[0_0_45px_rgba(251,113,133,0.10)]', bar: 'bg-rose-300', soft: 'bg-rose-300/10' },
};

const initials = (name: string) => name.slice(0, 2).toUpperCase();
const compact = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toLocaleString();

function StatusPill({ status }: { status: BattleStatus }) {
  if (status === 'active') return <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rose-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" /> Live now</span>;
  if (status === 'starting') return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-100"><Clock3 size={11} /> Starting</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/65"><CalendarDays size={11} /> Scheduled</span>;
}

function BattleCard({ battle, onSelect }: { battle: Battle; onSelect: (battle: Battle) => void }) {
  const a = accentMap[battle.accent];
  const total = Math.max(1, battle.scoreC + battle.scoreO);
  const leftPct = battle.status === 'scheduled' || battle.status === 'starting' ? 50 : (battle.scoreC / total) * 100;
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(battle)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`group relative w-full overflow-hidden rounded-[22px] border ${a.border} bg-[#0c0e16] p-3.5 text-left transition-colors hover:bg-[#111420] ${a.glow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.07),transparent_40%)] opacity-70" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{battle.category}</span>
        <StatusPill status={battle.status} />
      </div>
      <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`flex min-w-0 flex-col items-center rounded-2xl border border-white/[0.07] bg-gradient-to-br ${battle.artC} px-2 py-4`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-sm font-black text-white shadow-lg">{initials(battle.challenger)}</span>
          <span className="mt-2 max-w-full truncate text-xs font-extrabold text-white">{battle.challenger}</span>
          <span className="mt-1 text-lg font-black tabular-nums text-white">{compact(battle.scoreC)}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-black italic tracking-[-0.12em] text-white/80">VS</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
        </div>
        <div className={`flex min-w-0 flex-col items-center rounded-2xl border border-white/[0.07] bg-gradient-to-br ${battle.artO} px-2 py-4`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-sm font-black text-white shadow-lg">{initials(battle.opponent)}</span>
          <span className="mt-2 max-w-full truncate text-xs font-extrabold text-white">{battle.opponent}</span>
          <span className="mt-1 text-lg font-black tabular-nums text-white">{compact(battle.scoreO)}</span>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${a.bar} transition-all`} style={{ width: `${leftPct}%` }} />
      </div>
      <div className="relative mt-3 flex items-center justify-between gap-2 text-[11px] text-white/50">
        <span className="inline-flex items-center gap-1.5"><Eye size={12} /> {battle.status === 'scheduled' ? 'Not live yet' : `${battle.viewers.toLocaleString()} watching`}</span>
        <span className="inline-flex items-center gap-1.5 font-bold text-white/70">{battle.status === 'scheduled' ? `Starts in ${battle.startsIn}` : battle.mode}<ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </motion.button>
  );
}

export default function BattleArenaPreview() {
  const navigate = useNavigate();
  const { battleId } = useParams<{ battleId: string }>();
  const [state, setState] = useState<'active' | 'empty' | 'loading' | 'error'>('active');
  const [filter, setFilter] = useState<'All battles' | 'Live now' | 'Starting soon' | 'Upcoming'>('All battles');
  const [query, setQuery] = useState('');
  const featured = SAMPLE_BATTLES.find((b) => b.featured)!;
  const selectedBattle = SAMPLE_BATTLES.find((battle) => battle.id === battleId);
  const liveCount = SAMPLE_BATTLES.filter((b) => b.status === 'active').length;

  const filteredBattles = useMemo(() => SAMPLE_BATTLES.filter((b) => {
    if (b.featured) return false;
    const matchesQuery = `${b.challenger} ${b.opponent} ${b.mode} ${b.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'All battles'
      || (filter === 'Live now' && b.status === 'active')
      || (filter === 'Starting soon' && b.status === 'starting')
      || (filter === 'Upcoming' && b.status === 'scheduled');
    return matchesQuery && matchesFilter;
  }), [filter, query]);

  if (battleId && selectedBattle) {
    return (
      <BattleArenaRoomPreviewView
        battle={selectedBattle}
        onClose={() => navigate('/dev/battle-arena-preview')}
      />
    );
  }

  const handleAction = (_message: string) => {};

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080d] text-white selection:bg-cyan-300/30">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-violet-700/15 blur-[130px]" />
        <div className="absolute -right-40 top-20 h-[480px] w-[480px] rounded-full bg-cyan-500/[0.09] blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[380px] w-[480px] rounded-full bg-lime-400/[0.035] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080910]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-cyan-200/20 bg-gradient-to-br from-cyan-300 to-violet-500 text-[#05070b] shadow-[0_0_28px_rgba(34,211,238,0.2)]">
              <Swords size={20} strokeWidth={2.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h1 className="truncate text-[15px] font-black tracking-[-0.04em] sm:text-lg">BATTLE<span className="text-cyan-200">ARENA</span></h1><span className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/35 sm:inline">MaiTroll</span></div>
              <p className="hidden text-[10px] font-medium tracking-wide text-white/40 sm:block">Where creators go head-to-head.</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-rose-300/15 bg-rose-400/[0.07] px-3 py-2 sm:flex"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-300" /></span><span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-rose-100">{liveCount} live arenas</span></div>
            <label className="relative hidden md:block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search battles or creators" className="w-56 rounded-xl border border-white/10 bg-white/[0.035] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-white/30 focus:border-cyan-200/35 focus:bg-white/[0.06]" /></label>
            <button type="button" onClick={() => handleAction('DEV PREVIEW: Start Battle action is not connected.')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-200 via-cyan-300 to-violet-300 px-3.5 py-2.5 text-[11px] font-black text-[#07080d] shadow-[0_5px_24px_rgba(34,211,238,0.16)] transition hover:brightness-110 sm:px-4 sm:text-xs"><Plus size={15} strokeWidth={3} /><span className="hidden xs:inline">Start a battle</span><span className="xs:hidden">Start</span></button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] px-4 pb-12 pt-6 sm:px-6 sm:pt-9 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35"><span>MaiTroll</span><ChevronRight size={12} /><span className="text-white/70">BattleArena</span><span className="ml-1 rounded border border-amber-200/20 bg-amber-200/[0.06] px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-amber-100/80">DEV CONCEPT</span></div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/35"><ShieldCheck size={13} className="text-lime-200/70" /> Preview environment · Sample data only</div>
        </div>

        {/* Developer state controls intentionally remain visible for visual testing. */}
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2.5">
          <span className="mr-1 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/30">Preview state</span>
          {(['active', 'empty', 'loading', 'error'] as const).map((s) => <button key={s} type="button" onClick={() => setState(s)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold capitalize transition ${state === s ? 'border-cyan-200/30 bg-cyan-200/10 text-cyan-100' : 'border-white/[0.07] text-white/45 hover:bg-white/[0.05] hover:text-white/80'}`}>{s}</button>)}
        </div>

        {state === 'loading' && <div className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr]"><div className="h-[430px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.035]" /><div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.035]" />)}</div></div>}

        {state === 'error' && <div className="mx-auto flex min-h-[380px] max-w-xl flex-col items-center justify-center rounded-[28px] border border-rose-300/15 bg-rose-300/[0.035] p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-200"><Radio size={28} /></div><h2 className="mt-5 text-xl font-black">The arena couldn&apos;t load</h2><p className="mt-2 max-w-sm text-sm leading-6 text-white/45">Something interrupted the preview. Try again to return to the sample battle lineup.</p><button type="button" onClick={() => setState('active')} className="mt-6 rounded-xl bg-white px-5 py-3 text-xs font-black text-black transition hover:bg-cyan-100">Retry preview</button></div>}

        {state === 'empty' && <div className="relative mx-auto flex min-h-[450px] max-w-3xl flex-col items-center justify-center overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0d15]/80 px-6 py-14 text-center"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(139,92,246,0.15),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.08),transparent_40%)]" /><div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-violet-200/20 bg-violet-300/[0.08] text-violet-100 shadow-[0_0_55px_rgba(167,139,250,0.12)]"><Crown size={34} /></div><p className="relative mt-7 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/70">The stage is yours</p><h2 className="relative mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Every legend starts <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-violet-300">somewhere.</span></h2><p className="relative mt-3 max-w-md text-sm leading-6 text-white/45">No battles are live in this preview right now. Bring the energy, challenge a creator, and make the first moment count.</p><div className="relative mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => handleAction('DEV PREVIEW: Start Battle action is not connected.')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-200 to-violet-300 px-5 py-3 text-xs font-black text-[#07080d]"><Plus size={15} /> Start a battle</button><button type="button" onClick={() => { setState('active'); setFilter('All battles'); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold text-white/80 hover:bg-white/[0.08]">Explore sample battles</button></div></div>}

        {state === 'active' && <>
          {/* Hero */}
          <section className="relative overflow-hidden rounded-[30px] border border-white/[0.11] bg-[#0b0d15] shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_20%,rgba(34,211,238,0.13),transparent_42%),radial-gradient(ellipse_at_85%_15%,rgba(168,85,247,0.16),transparent_42%),linear-gradient(115deg,rgba(255,255,255,0.025),transparent_55%)]" />
            <div className="absolute right-[-7%] top-[-50%] h-[420px] w-[420px] rounded-full border border-white/[0.035]" /><div className="absolute right-[-3%] top-[-38%] h-[330px] w-[330px] rounded-full border border-white/[0.045]" />
            <div className="relative grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="flex flex-col justify-center p-5 sm:p-8 lg:p-10 xl:p-12">
                <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/20 bg-violet-200/[0.08] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-violet-100"><Sparkles size={11} /> Arena spotlight</span><StatusPill status="active" /></div>
                <h2 className="mt-6 max-w-xl text-[38px] font-black leading-[0.98] tracking-[-0.065em] sm:text-5xl xl:text-[62px]">TWO CREATORS.<br /><span className="bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text text-transparent">ONE ARENA.</span></h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/50 sm:text-base sm:leading-7">The spotlight is on. Catch the live clash, back your favorite creator, and watch the leaderboard shift in real time.</p>
                <div className="mt-6 flex flex-wrap items-center gap-3"><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5"><Eye size={15} className="text-cyan-100/70" /><span className="text-xs font-extrabold tabular-nums">{featured.viewers.toLocaleString()}</span><span className="text-[10px] text-white/40">watching</span></div><div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5"><Trophy size={15} className="text-amber-100/80" /><span className="text-xs font-extrabold">{(featured.scoreC + featured.scoreO).toLocaleString()}</span><span className="text-[10px] text-white/40">combined score</span></div></div>
                <div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={() => navigate(`/dev/battle-arena-preview/${featured.id}`)} className="group inline-flex items-center gap-2.5 rounded-xl bg-white px-5 py-3.5 text-xs font-black text-[#080910] transition hover:bg-cyan-100"><Play size={15} fill="currentColor" /> Enter featured battle <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button><button type="button" onClick={() => { setFilter('Live now'); document.getElementById('battle-discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-xs font-bold text-white/75 transition hover:bg-white/[0.08]">Explore all live battles</button></div>
                <div className="mt-7 flex items-center gap-2 text-[10px] font-semibold text-white/30"><CircleDot size={12} className="text-lime-200/70" /> Live sample experience <span className="text-white/15">/</span> Updated preview concept</div>
              </div>

              {/* Featured head-to-head visual */}
              <div className="relative min-h-[330px] overflow-hidden border-t border-white/[0.07] lg:min-h-[490px] lg:border-l lg:border-t-0">
                <div className={`absolute inset-y-0 left-0 w-1/2 bg-gradient-to-br ${featured.artC}`} /><div className={`absolute inset-y-0 right-0 w-1/2 bg-gradient-to-bl ${featured.artO}`} />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,16,0.05),rgba(8,9,16,0.18)_50%,rgba(8,9,16,0.95))]" />
                <div className="absolute left-[20%] top-[18%] h-40 w-40 rounded-full bg-cyan-300/15 blur-[65px] sm:h-56 sm:w-56" /><div className="absolute right-[10%] top-[14%] h-44 w-44 rounded-full bg-fuchsia-400/15 blur-[65px] sm:h-56 sm:w-56" />
                <div className="absolute inset-x-0 top-5 flex justify-center"><span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-white/65 backdrop-blur-md">Featured matchup · #{featured.id.toUpperCase()}</span></div>
                <div className="absolute inset-x-4 top-[22%] grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:inset-x-7 sm:gap-4">
                  <div className="flex flex-col items-center"><div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-[28px] border border-cyan-100/40 bg-gradient-to-br from-cyan-100/25 to-blue-950/60 text-2xl font-black shadow-[0_0_60px_rgba(34,211,238,0.2)] backdrop-blur-md sm:h-28 sm:w-28 sm:rounded-[34px] sm:text-3xl">{initials(featured.challenger)}<span className="absolute -bottom-2 rounded-full border border-cyan-100/30 bg-[#081017] px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-100">Challenger</span></div><p className="mt-5 max-w-full truncate text-xs font-black sm:mt-6 sm:text-sm">{featured.challenger}</p><p className="mt-1 text-2xl font-black tabular-nums text-cyan-100 sm:text-3xl">{featured.scoreC.toLocaleString()}</p></div>
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-sm font-black italic text-white shadow-[0_0_35px_rgba(255,255,255,0.08)] backdrop-blur-xl sm:h-16 sm:w-16 sm:text-base">VS<div className="absolute -inset-2 -z-10 rounded-3xl border border-white/[0.07]" /></div>
                  <div className="flex flex-col items-center"><div className="relative flex h-[88px] w-[88px] items-center justify-center rounded-[28px] border border-fuchsia-100/35 bg-gradient-to-br from-fuchsia-100/20 to-violet-950/60 text-2xl font-black shadow-[0_0_60px_rgba(217,70,239,0.16)] backdrop-blur-md sm:h-28 sm:w-28 sm:rounded-[34px] sm:text-3xl">{initials(featured.opponent)}<span className="absolute -bottom-2 rounded-full border border-fuchsia-100/25 bg-[#110914] px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-fuchsia-100">Opponent</span></div><p className="mt-5 max-w-full truncate text-xs font-black sm:mt-6 sm:text-sm">{featured.opponent}</p><p className="mt-1 text-2xl font-black tabular-nums text-fuchsia-100 sm:text-3xl">{featured.scoreO.toLocaleString()}</p></div>
                </div>
                <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7"><div className="mb-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-white/45"><span>{featured.challenger}</span><span>Battle momentum</span><span>{featured.opponent}</span></div><div className="flex h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-l-full bg-gradient-to-r from-cyan-300 to-cyan-100" style={{ width: `${featured.scoreC / (featured.scoreC + featured.scoreO) * 100}%` }} /><div className="h-full flex-1 bg-gradient-to-r from-fuchsia-100 to-violet-300" /></div><div className="mt-3 flex items-center justify-between text-[10px] text-white/40"><span className="inline-flex items-center gap-1.5"><Flame size={12} className="text-amber-200" /> Battle is heating up</span><span className="inline-flex items-center gap-1.5"><Radio size={12} className="text-rose-200" /> Live arena</span></div></div>
              </div>
            </div>
          </section>

          {/* Discovery controls */}
          <section id="battle-discovery" className="scroll-mt-24 pt-9 sm:pt-11">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/65"><Zap size={13} /> Find your next matchup</div><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] sm:text-3xl">Inside the arena<span className="text-white/30">.</span></h2><p className="mt-1.5 text-xs text-white/40 sm:text-sm">Pick a side. Catch the moment. Stay for the showdown.</p></div>
              <div className="flex flex-wrap items-center gap-2"><label className="relative md:hidden"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creators" className="w-full min-w-[180px] rounded-xl border border-white/10 bg-white/[0.035] py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-cyan-200/35" /></label><div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1"><SlidersHorizontal size={13} className="ml-2 text-white/35" />{(['All battles', 'Live now', 'Starting soon', 'Upcoming'] as const).map((t) => <button type="button" key={t} onClick={() => setFilter(t)} className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-[10px] font-bold transition sm:px-3 ${filter === t ? 'bg-white text-[#080910]' : 'text-white/45 hover:text-white/80'}`}>{t}</button>)}</div></div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredBattles.map((battle) => <BattleCard key={battle.id} battle={battle} onSelect={(selected) => navigate(`/dev/battle-arena-preview/${selected.id}`)} />)}
            </div>
            {filteredBattles.length === 0 && <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/45"><Search size={20} /></div><h3 className="mt-4 text-sm font-extrabold">No matchups found</h3><p className="mt-1 text-xs text-white/40">Try another search or choose a different arena filter.</p><button type="button" onClick={() => { setQuery(''); setFilter('All battles'); }} className="mt-4 text-xs font-bold text-cyan-100 hover:text-white">Clear filters</button></div>}

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-200/[0.08] text-cyan-100"><Users size={18} /></div><div><p className="text-xs font-extrabold">Find your crowd</p><p className="mt-1 text-[10px] text-white/40">Discover creators and live matchups.</p></div></div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-200/[0.08] text-violet-100"><Trophy size={18} /></div><div><p className="text-xs font-extrabold">Every point matters</p><p className="mt-1 text-[10px] text-white/40">Follow the score as the action unfolds.</p></div></div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-200/[0.08] text-lime-100"><Sparkles size={18} /></div><div><p className="text-xs font-extrabold">Make it a moment</p><p className="mt-1 text-[10px] text-white/40">Show up for the creators you back.</p></div></div>
            </div>
          </section>

          {/* Small category strip gives the page a curated, premium finish. */}
          <section className="mt-10 rounded-[24px] border border-white/[0.08] bg-gradient-to-r from-white/[0.035] via-white/[0.015] to-white/[0.035] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">Choose your energy</p><h3 className="mt-1.5 text-lg font-black tracking-[-0.03em]">There’s more than one way to compete.</h3></div><div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/65"><Swords size={13} className="text-cyan-100" /> Random battles</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/65"><Crown size={13} className="text-violet-100" /> Creator clashes</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/65"><Mic2 size={13} className="text-lime-100" /> Live talent</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/65"><Gamepad2 size={13} className="text-rose-100" /> Game streams</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold text-white/65"><Music2 size={13} className="text-fuchsia-100" /> Music</span></div></div></section>
        </>}

        <footer className="mt-8 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-[10px] text-white/25 sm:flex-row sm:items-center sm:justify-between"><span>MAITROLL BATTLEARENA <span className="mx-1 text-white/15">/</span> DESIGN PREVIEW</span><span>Fictional creator names, scores, and viewer counts · No live services connected</span></footer>
      </main>

    </div>
  );
}
