/**
 * HytroGaming — MaiTroll neon live gaming arena.
 * Standalone, full-viewport page (no application sidebar).
 * Keeps the existing Supabase gaming-stream query, realtime refresh,
 * search, sorting, featured streams, restrictions, game library,
 * and /gaming/watch/:id navigation.
 * The Tournaments tab is a truthful placeholder until tournament data
 * and routes exist; the Arcade Games tab renders the real GamesSection.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bell, ChevronLeft, ChevronRight, Clock3,
  Eye, Flame, Gamepad2, Loader2, Play, Radio, Search,
  ShieldCheck, Trophy, Users, X, MonitorPlay,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { cn, formatCompactNumber } from '@/lib/utils';
import useSEO from '@/hooks/useSEO';
import LazyLiveThumbnail from '@/components/broadcast/LazyLiveThumbnail';
import { useIsMobile } from '@/hooks/useIsMobile';
import { isStandalone } from '@/pwa/install';
import HytroGamingLanding from './HytroGamingLanding';
import GamesSection from '@/components/home/GamesSection';

type SortMode = 'viewers' | 'featured' | 'recent';
type ArenaTab = 'streams' | 'tournaments' | 'arcade' | 'share';

interface GamingStream {
  id: string;
  title: string;
  broadcaster_id: string;
  broadcaster_name: string;
  broadcaster_avatar: string | null;
  thumbnail_url: string | null;
  viewer_count: number;
  current_viewers: number;
  is_live: boolean;
  is_featured: boolean;
  category: string;
  started_at: string | null;
  agora_channel: string | null;
  layout_mode: string;
}

const viewerTotal = (stream: GamingStream) =>
  stream.current_viewers || stream.viewer_count || 0;

function ago(date: string | null) {
  if (!date) return 'Just now';
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m ago` : minutes ? `${minutes}m ago` : 'Just now';
}

function StreamCard({
  stream, onOpen, featured = false,
}: {
  stream: GamingStream;
  onOpen: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group min-w-0 overflow-hidden rounded-2xl border bg-[#080d21] text-left transition-all duration-200',
        'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
        featured
          ? 'border-fuchsia-400/60 shadow-[0_0_18px_rgba(217,70,239,.17)] hover:border-fuchsia-300'
          : 'border-cyan-400/35 shadow-[0_0_18px_rgba(0,229,255,.08)] hover:border-cyan-300',
      )}
      aria-label={`Watch ${stream.title} by ${stream.broadcaster_name}`}
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#122341] via-[#261244] to-[#07182c]">
        <LazyLiveThumbnail
          streamId={stream.id}
          agoraChannel={stream.agora_channel}
          category="gaming"
          thumbnailUrl={stream.thumbnail_url}
          avatarUrl={stream.broadcaster_avatar}
          title={stream.title}
          isLive={stream.is_live}
          onClick={onOpen}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030614]/60 via-transparent to-black/15" />
        <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-1 text-[10px] font-black uppercase text-white shadow-lg">
          <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
        </span>
        <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
          <Eye size={12} /> {formatCompactNumber(viewerTotal(stream))}
        </span>
        {stream.is_featured && <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-md bg-amber-300 px-2 py-0.5 text-[9px] font-black text-black">FEATURED</span>}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full border border-white/25 bg-black/65 p-2 opacity-0 transition-opacity group-hover:opacity-100"><Play size={14} fill="white" /></div>
      </div>
      <div className="flex min-w-0 items-center gap-2.5 p-2.5 sm:p-3">
        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-cyan-300/45 bg-violet-800">
          {stream.broadcaster_avatar ? <img src={stream.broadcaster_avatar} alt="" className="size-full object-cover" /> : <Gamepad2 size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-black text-white">{stream.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-slate-300">
            <span className="truncate">{stream.broadcaster_name}</span> <ShieldCheck size={12} className="shrink-0 text-cyan-300" />
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{ago(stream.started_at)}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-slate-500 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function EmptyStreamState({ searching }: { searching: boolean }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/20 bg-[#0b1430]/45 px-5 text-center">
    <Radio className="mb-3 size-9 text-cyan-400/60" />
    <h3 className="font-bold">{searching ? 'No matching game streams' : 'No gaming streams are live yet'}</h3>
    <p className="mt-1 max-w-sm text-xs text-slate-400">{searching ? 'Try another streamer or broadcast title.' : 'The arena will populate as broadcasters go live.'}</p>
  </div>;
}

export default function HytroGaming() {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuthStore();
  const { isMobile } = useIsMobile();
  const isMobileOrPWA = isMobile || isStandalone();
  const [streams, setStreams] = useState<GamingStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('viewers');
  const [tab, setTab] = useState<ArenaTab>('streams');
  const [featuredOffset, setFeaturedOffset] = useState(0);
  const streamsSectionRef = useRef<HTMLDivElement>(null);

  useSEO({
    title: 'HytroGaming | Live Game Streaming & Arcade | MaiTroll',
    description: 'Play arcade games, watch live gaming broadcasts, and game share on the HytroGaming arena at MaiTroll.',
    keywords: ['HytroGaming', 'MaiTroll', 'live gaming', 'game sharing', 'arcade games', 'stream gaming'],
  });

  const trollRole = (profile as any)?.troll_role;

  const fetchStreams = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('streams')
        .select('id,title,broadcaster_id,category,is_live,is_featured,viewer_count,current_viewers,started_at,agora_channel,layout_mode,thumbnail_url')
        .eq('category', 'gaming').eq('is_live', true)
        .order('is_featured', { ascending: false })
        .order('current_viewers', { ascending: false }).limit(50);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((s: any) => s.broadcaster_id).filter(Boolean))) as string[];
      const map = new Map<string, { username: string | null; avatar_url: string | null }>();
      if (ids.length) {
        const { data: profiles, error: profileError } = await supabase.from('user_profiles')
          .select('id,username,avatar_url').in('id', ids);
        if (profileError) console.warn('[HytroGaming] Profile lookup failed', profileError);
        profiles?.forEach((p: any) => map.set(p.id, p));
      }
      setStreams((data || []).map((s: any) => ({
        id: s.id,
        title: s.title || 'Untitled Gaming Stream',
        broadcaster_id: s.broadcaster_id,
        broadcaster_name: map.get(s.broadcaster_id)?.username || 'Unknown Gamer',
        broadcaster_avatar: map.get(s.broadcaster_id)?.avatar_url || null,
        thumbnail_url: s.thumbnail_url || null,
        viewer_count: s.viewer_count || 0,
        current_viewers: s.current_viewers || 0,
        is_live: Boolean(s.is_live),
        is_featured: Boolean(s.is_featured),
        category: s.category || 'gaming',
        started_at: s.started_at || null,
        agora_channel: s.agora_channel || null,
        layout_mode: s.layout_mode || 'grid',
      })));
    } catch (error) {
      console.error('[HytroGaming] Stream fetch failed', error);
      toast.error('Could not load gaming broadcasts');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchStreams();
    const timer = window.setInterval(() => { void fetchStreams(); }, 30_000);
    const channel = supabase.channel('hytrogaming-streams').on('postgres_changes', {
      event: '*', schema: 'public', table: 'streams', filter: 'category=eq.gaming',
    }, () => { void fetchStreams(); }).subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [fetchStreams, user?.id]);

  const totalViewers = useMemo(() => streams.reduce((sum, stream) => sum + viewerTotal(stream), 0), [streams]);
  const featured = useMemo(() => streams.filter(s => s.is_featured), [streams]);
  const shownFeatured = useMemo(() => {
    const pool = featured.length ? featured : streams;
    if (pool.length <= 4) return pool;
    return [...pool.slice(featuredOffset), ...pool.slice(0, featuredOffset)].slice(0, 4);
  }, [featured, streams, featuredOffset]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return streams.filter(s => !q || s.title.toLowerCase().includes(q) || s.broadcaster_name.toLowerCase().includes(q))
      .sort((a, b) => sort === 'recent'
        ? Date.parse(b.started_at || '') - Date.parse(a.started_at || '') || 0
        : sort === 'featured'
          ? Number(b.is_featured) - Number(a.is_featured) || viewerTotal(b) - viewerTotal(a)
          : viewerTotal(b) - viewerTotal(a));
  }, [streams, query, sort]);
  const canShare = true;
  const openStream = (stream: GamingStream) => navigate(`/gaming/watch/${stream.id}`);
  const selectTab = (selected: ArenaTab) => { setTab(selected); };

  if (isLoading) return <div className="fixed inset-0 z-[90] grid place-items-center bg-[#050816] text-white"><Loader2 className="size-8 animate-spin text-cyan-300" /></div>;
  if (!user) return <HytroGamingLanding />;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#050918] text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(54,27,135,.27),transparent_42%),radial-gradient(ellipse_at_95%_25%,rgba(0,229,255,.1),transparent_40%)]" />

      {/* Custom fullscreen header: the app's sidebar does not render inside this view. */}
      <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-cyan-400/20 bg-[#070b1d]/95 px-3 py-2.5 shadow-[0_4px_18px_rgba(0,0,0,.24)] sm:gap-4 sm:px-6">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 hover:border-cyan-300/50"><ArrowLeft size={17} /></button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl border border-fuchsia-400/45 bg-gradient-to-br from-fuchsia-600/35 to-cyan-500/20 text-fuchsia-200"><Gamepad2 size={21} /></span>
          <div className="leading-tight"><p className="text-sm font-black tracking-wider sm:text-lg">MAITROLL</p><p className="text-[8px] font-bold tracking-[.16em] text-slate-400 sm:text-[10px]">YOUR CITY. YOUR WORLD.</p></div>
        </div>
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="HytroGaming navigation">
          {([['streams','Live Arena',Radio],['tournaments','Tournaments',Trophy],['arcade','Arcade Games',Gamepad2],['share','Game Share',MonitorPlay]] as const).map(([id,label,Icon]) => (
            <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => selectTab(id)}
              className={cn('inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition', tab === id ? 'border border-fuchsia-400/65 bg-fuchsia-500/20 text-white shadow-[0_0_18px_rgba(217,70,239,.25)]' : 'border border-transparent text-slate-300 hover:bg-white/10')}>
              <Icon size={15} />{label}
            </button>
          ))}
        </nav>
        <div className="ml-auto hidden min-w-0 max-w-[285px] flex-1 items-center gap-2 rounded-xl border border-white/15 bg-[#111b36] px-3 py-2 lg:flex">
          <Search size={16} className="shrink-0 text-cyan-300" />
          <input value={query} onChange={e => { setQuery(e.target.value); setTab('streams'); }} placeholder="Search gaming streams..." aria-label="Search gaming streams" className="min-w-0 w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-400" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <span className="hidden items-center gap-1.5 text-xs font-bold text-cyan-100 xl:inline-flex"><Users size={15} className="text-cyan-400" /> {formatCompactNumber(totalViewers)} watching</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15"><Bell size={17} className="text-violet-200" /></span>
      </header>

      {/* All content scrolls; desktop remains a single fullscreen arena, not a long page of stacked tabs. */}
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#47538b_transparent]">
        <div className="mx-auto w-full max-w-[1720px] px-3 pb-8 pt-3 sm:px-5">
          <section className="relative overflow-hidden rounded-[22px] border border-cyan-400/25 bg-[#081129] shadow-[0_0_35px_rgba(0,229,255,.09)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_28%_30%,rgba(38,77,186,.48),transparent_45%),radial-gradient(ellipse_at_80%_70%,rgba(120,36,202,.39),transparent_40%),linear-gradient(135deg,#0c1534,#070a1f_55%,#101639)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[repeating-linear-gradient(90deg,transparent_0px,transparent_70px,rgba(0,229,255,.06)_71px,transparent_72px)]" />
            <div className="relative grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-cyan-300/65 bg-cyan-500/15 shadow-[0_0_30px_rgba(0,229,255,.25)] sm:size-24"><Gamepad2 className="size-9 text-cyan-200 sm:size-14" /></div>
                <div><p className="text-[10px] font-black uppercase tracking-[.35em] text-cyan-200">MaiTroll City Presents</p>
                  <h1 className="mt-1 text-2xl font-black italic tracking-tight sm:text-5xl"><span className="text-white">HYTRO</span><span className="text-[#5DFF6A] [text-shadow:0_0_22px_rgba(93,255,106,.45)]">GAMING</span></h1>
                  <p className="mt-1 text-xs font-black uppercase tracking-[.55em] text-slate-200 sm:text-lg">Live Arena</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-100 lg:grid-cols-1">
                {['LIVE GAME STREAMS','GAME SHARING','ARCADE GAMES','TOURNAMENTS'].map(label => <div key={label} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full border border-[#5DFF6A] text-[#5DFF6A]">✓</span>{label}</div>)}
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-2 border-t border-cyan-300/15 bg-[#070c1c]/65 p-3 sm:grid-cols-4 sm:p-4">
              {[
                { label:'Live Now',value:String(streams.length),icon:Radio,tone:'rose' },
                { label:'Start Gaming',value:'Game Share',icon:MonitorPlay,tone:'cyan' },
                { label:'Active Streamers',value:String(streams.length),icon:Gamepad2,tone:'violet' },
                { label:'Arcade Games',value:'Play Now',icon:Trophy,tone:'green' },
              ].map(item => <button key={item.label} type="button" onClick={() => selectTab(item.label === 'Arcade Games' ? 'arcade' : item.label === 'Start Gaming' ? 'share' : 'streams')}
                className={cn('flex min-w-0 items-center gap-3 rounded-xl border bg-[#0d1330]/90 px-3 py-3 text-left transition hover:brightness-125', item.tone==='rose'?'border-rose-500/45':item.tone==='cyan'?'border-cyan-400/45':item.tone==='violet'?'border-violet-400/45':'border-lime-400/45')}>
                <item.icon size={24} className={item.tone==='rose'?'text-rose-400':item.tone==='cyan'?'text-cyan-300':item.tone==='violet'?'text-violet-300':'text-lime-400'} />
                <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.label}</span><span className="block truncate text-lg font-black text-white sm:text-xl">{item.value}</span></span>
              </button>)}
            </div>
          </section>

          {/* Mobile navbar mirrors desktop; Arcade Games is beside Tournaments. */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden" role="tablist" aria-label="HytroGaming sections">
            {([['streams','Live Arena',Radio],['tournaments','Tournaments',Trophy],['arcade','Arcade Games',Gamepad2],['share','Game Share',MonitorPlay]] as const).map(([id,label,Icon]) => <button key={id} role="tab" aria-selected={tab===id} onClick={() => selectTab(id)} className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black',tab===id?'border-fuchsia-400/65 bg-fuchsia-500/20 text-white':'border-white/15 bg-white/5 text-slate-300')}><Icon size={15} />{label}</button>)}
          </div>

          {tab === 'streams' && <div className="mt-4 space-y-4" role="tabpanel" aria-label="Live Arena">
            <section className="rounded-2xl border border-violet-400/35 bg-[#070c1e]/85 p-3 shadow-[0_0_22px_rgba(139,92,246,.08)] sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div><h2 className="flex items-center gap-2 text-base font-black sm:text-xl"><Flame className="text-rose-400" size={21} /> FEATURED STREAMS</h2><p className="text-xs text-slate-400">Top live gaming broadcasts in HytroGaming</p></div>
                {(featured.length || streams.length) > 4 && <div className="flex gap-1.5"><button type="button" aria-label="Previous featured streams" onClick={() => setFeaturedOffset(i => (i - 1 + (featured.length || streams.length)) % (featured.length || streams.length))} className="rounded-full border border-cyan-500/30 bg-[#10203a] p-2"><ChevronLeft size={16}/></button><button type="button" aria-label="Next featured streams" onClick={() => setFeaturedOffset(i => (i + 1) % (featured.length || streams.length))} className="rounded-full border border-cyan-500/30 bg-[#10203a] p-2"><ChevronRight size={16}/></button></div>}
              </div>
              {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-cyan-400" /></div> : shownFeatured.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{shownFeatured.map(s => <StreamCard key={s.id} stream={s} onOpen={() => openStream(s)} featured />)}</div> : <EmptyStreamState searching={false} />}
            </section>

            <section ref={streamsSectionRef} className="rounded-2xl border border-cyan-400/15 bg-[#081022]/80 p-3 sm:p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <h2 className="mr-2 flex items-center gap-2 text-base font-black sm:text-lg"><Radio className="text-[#61FF64]" size={20} /> LIVE STREAMS</h2>
                {([['viewers','Popular',Users],['featured','Featured',Flame],['recent','Recent',Clock3]] as const).map(([id,label,Icon]) => <button key={id} type="button" onClick={() => setSort(id)} aria-pressed={sort===id} className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold',sort===id?'border-cyan-300/75 bg-cyan-500/25 text-cyan-100':'border-white/15 bg-[#141a34] text-slate-300')}><Icon size={14}/>{label}</button>)}
                <div className="relative ml-auto flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-cyan-400/35 bg-[#10213c] px-3 py-2 sm:max-w-xs"><Search size={15} className="text-cyan-300" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search gaming streams..." className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-400" aria-label="Search gaming streams" /></div>
              </div>
              {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div> : filtered.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(s => <StreamCard key={s.id} stream={s} onOpen={() => openStream(s)} />)}</div> : <EmptyStreamState searching={Boolean(query.trim())} />}
            </section>
          </div>}

          {tab === 'arcade' && <section role="tabpanel" aria-label="Arcade Games" className="mt-4 rounded-2xl border border-fuchsia-400/35 bg-[#0b0f27]/95 p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-fuchsia-300">MaiTroll Arcade</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black"><Gamepad2 className="text-cyan-300" /> ARCADE GAMES</h2><p className="text-xs text-slate-400">Choose your game, compete, and climb the leaderboard.</p></div><span className="rounded-full border border-lime-400/35 bg-lime-400/10 px-3 py-2 text-[10px] font-black text-lime-300">INSERT COIN • PRESS PLAY</span></div>
            {/* Existing implementation owns coin, game, multiplayer and leaderboard flows. */}
            <div className="min-w-0 [&_table]:w-full [&_th]:text-left"><GamesSection /></div>
          </section>}

          {tab === 'tournaments' && <section role="tabpanel" aria-label="Tournaments" className="mt-4 flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-lime-400/30 bg-[#0b1426]/90 p-6 text-center"><Trophy className="mb-3 size-12 text-lime-400" /><h2 className="text-2xl font-black">TOURNAMENTS</h2><p className="mt-2 max-w-md text-sm text-slate-400">Tournament registration and brackets are not connected in this page yet. Browse live streams or play arcade games in the meantime.</p><button type="button" onClick={()=>selectTab('arcade')} className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-lime-400 to-cyan-400 px-5 py-3 text-xs font-black text-[#061321]">Open Arcade Games <ArrowRight size={16}/></button></section>}

          {tab === 'share' && <section role="tabpanel" aria-label="Game Share" className="mt-4 rounded-2xl border border-cyan-400/25 bg-[#0b1428]/90 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3"><MonitorPlay className="size-8 text-cyan-300" /><div><h2 className="text-xl font-black">GAME SHARE ARENA</h2><p className="text-xs text-slate-400">Share your gameplay live or watch active gaming broadcasts.</p></div></div>
            {isMobileOrPWA ? <p className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4 text-sm text-cyan-100">Desktop is required to start game sharing. You can still watch broadcasts on this device.</p> : <button onClick={()=>navigate('/broadcast/setup/gaming')} className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-xs font-black text-black"><Radio className="mr-2 inline size-4" /> Start Game Share</button>}
            <div className="mt-5 border-t border-white/10 pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-black">Live Gaming Broadcasts</h3><button onClick={()=>selectTab('streams')} className="text-xs font-bold text-cyan-300">Browse arena →</button></div>{streams.length ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{streams.slice(0,8).map(s=><StreamCard key={s.id} stream={s} onOpen={()=>openStream(s)} />)}</div> : <EmptyStreamState searching={false} />}</div>
          </section>}
        </div>
      </main>
    </div>
  );
}
