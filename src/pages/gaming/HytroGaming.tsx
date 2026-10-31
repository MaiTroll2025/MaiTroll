/**
 * HytroGaming — Premium standalone gaming broadcasts page
 *
 * Shows all active gaming broadcasts using LiveKit.
 * Public page: anyone can view.
 * Preserves:
 * - Supabase stream fetch logic
 * - category = gaming filter
 * - realtime stream refresh
 * - search + sort
 * - featured streams
 * - embedded Agora viewer when agora_channel exists
 * - fallback navigation to /watch/:streamId
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, ChevronRight, Clock3, Eye, Flame, Gamepad2, Loader2, Play, Radio, Search, ShieldCheck, Trophy, Users, ArrowUpRight } from 'lucide-react';
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

type SortMode = 'viewers' | 'featured' | 'recent';

// ─── Small UI Components ─────────────────────────────────────────────────────

function HytroLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-2xl border border-cyan-300/30',
          'bg-gradient-to-br from-cyan-400/25 via-blue-500/15 to-purple-600/25',
          'shadow-[0_0_35px_rgba(34,211,238,0.25)]',
          compact ? 'h-10 w-10' : 'h-12 w-12'
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_80%_90%,rgba(168,85,247,0.35),transparent_38%)]" />
        <Gamepad2 className={cn('relative text-cyan-100', compact ? 'h-5 w-5' : 'h-6 w-6')} />
      </div>

      <div className="leading-none">
        <div
          className={cn(
            'font-black uppercase tracking-tight text-white',
            compact ? 'text-base' : 'text-2xl sm:text-3xl'
          )}
        >
          Hytro
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Gaming
          </span>
        </div>
        {!compact && (
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/60">
            Live Arena
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone = 'cyan',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'cyan' | 'purple' | 'green' | 'orange';
}) {
  const toneClass = {
    cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 shadow-cyan-500/10',
    purple: 'border-purple-400/30 bg-purple-400/10 text-purple-100 shadow-purple-500/10',
    green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 shadow-emerald-500/10',
    orange: 'border-orange-400/30 bg-orange-400/10 text-orange-100 shadow-orange-500/10',
  }[tone];

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-3 shadow-lg backdrop-blur-xl',
        toneClass
      )}
    >
      <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid bg-white/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {label}
        </p>
        <p className="truncate text-base font-black text-white sm:text-lg">{value}</p>
      </div>
    </div>
  );
}

function SortChip({
  mode,
  active,
  onClick,
}: {
  mode: SortMode;
  active: boolean;
  onClick: () => void;
}) {
  const label =
    mode === 'viewers' ? 'Popular' : mode === 'featured' ? 'Featured' : 'Recent';

  const Icon = mode === 'viewers' ? Users : mode === 'featured' ? Flame : Radio;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
        active
          ? 'border border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.18)]'
          : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── Gaming Stream Card ──────────────────────────────────────────────────────

function GamingStreamCard({
  stream,
  onClick,
  featured = false,
}: {
  stream: GamingStream;
  onClick: () => void;
  featured?: boolean;
}) {
  const _viewers = getStreamViewers(stream);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-3xl text-left transition-all duration-300',
        'border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl',
        'hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_0_45px_rgba(34,211,238,0.16)]',
        featured && 'xl:col-span-2'
      )}
    >
      <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-cyan-400/20 via-purple-500/10 to-emerald-400/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#090117] to-cyan-950/40',
          featured ? 'aspect-[16/9]' : 'aspect-[16/9]'
        )}
      >
        {/* Lazy-loaded live thumbnail — loads preview on hover */}
        <LazyLiveThumbnail
          streamId={stream.id}
          agoraChannel={stream.agora_channel}
          category="gaming"
          thumbnailUrl={stream.thumbnail_url}
          avatarUrl={stream.broadcaster_avatar}
          title={stream.title}
          isLive={stream.is_live}
          onClick={onClick}
        />

        {/* Gradient overlay for text readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/15" />

        {/* Live + Gaming badges */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
          {stream.is_live && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-2.5 py-1.5 shadow-lg shadow-red-600/25">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wide text-white">Live</span>
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
            <Gamepad2 className="h-3.5 w-3.5 text-cyan-200" />
            <span className="text-[11px] font-bold text-white/85">Gaming</span>
          </div>
        </div>

        {/* Featured badge */}
        {stream.is_featured && (
          <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-yellow-300 px-2.5 py-1.5 shadow-lg shadow-orange-500/20">
            <Flame className="h-3.5 w-3.5 text-black" />
            <span className="text-[11px] font-black uppercase text-black">Hot</span>
          </div>
        )}

        {/* Viewer count */}
        <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-md">
          <Eye className="h-3.5 w-3.5 text-white/65" />
          <span className="text-xs font-bold text-white">{formatCompactNumber(getStreamViewers(stream))}</span>
        </div>
      </div>

      <div className="relative p-4">
        <div className="flex items-start gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-purple-500 to-cyan-500">
            {stream.broadcaster_avatar ? (
              <img
                src={stream.broadcaster_avatar}
                alt={stream.broadcaster_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <Gamepad2 className="h-5 w-5 text-white" />
              </div>
            )}

            {stream.is_live && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-sm font-black text-white">
              {stream.title || 'Untitled Gaming Stream'}
            </h3>

            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-semibold text-slate-400">
                {stream.broadcaster_name || 'Unknown Gamer'}
              </p>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-purple-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-200">
                <Trophy className="h-3 w-3" />
                Arena
              </span>

              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                <Radio className="h-3 w-3" />
                {getTimeAgo(stream.started_at)}
              </span>
            </div>
          </div>

          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/25 transition-transform group-hover:translate-x-1 group-hover:text-cyan-200" />
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HytroGaming() {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuthStore();
  const { isMobile } = useIsMobile();
  const isPWA = isStandalone();
  const isMobileOrPWA = isMobile || isPWA;

  // ── Agency status check ──────────────────────────────────────────────────
  const [agencyStatus, setAgencyStatus] = useState<'loading' | 'approved' | 'pending' | 'none' | 'exempt'>('loading');

  useEffect(() => {
    if (!user?.id) {
      setAgencyStatus('none');
      return;
    }

    // Admins and certain roles are exempt from agency requirement
    const exemptRoles = ['admin', 'moderator', 'staff', 'troll_officer', 'lead_troll_officer'];
    if (exemptRoles.includes(profile?.role || '') || exemptRoles.includes((profile as any)?.troll_role || '')) {
      setAgencyStatus('exempt');
      return;
    }

    const checkAgency = async () => {
      try {
        // Check if user has an active agency membership
        const { data: agencyMember } = await supabase
          .from('agency_members')
          .select('id, status, agency_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (agencyMember) {
          setAgencyStatus('approved');
          return;
        }

        // Check the latest agency application status
        const { data: latestApp } = await supabase
          .from('agency_applications')
          .select('id, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestApp?.status === 'approved') {
          setAgencyStatus('approved');
          return;
        }

        if (latestApp?.status === 'pending') {
          setAgencyStatus('pending');
          return;
        }

        setAgencyStatus('none');
      } catch (err) {
        console.warn('[HytroGaming] Failed to check agency status:', err);
        setAgencyStatus('none');
      }
    };

    void checkAgency();
  }, [user?.id, profile?.role, profile]);

  useSEO({
    title: 'HydroGaming | Live Game Streaming & Screen Sharing | Mai Troll',
    description: 'Watch live gaming streams on HydroGaming by Mai Troll. Stream games online, share your screen, and join the ultimate gaming community. Live game broadcasts and esports.',
    keywords: [
      'game streaming', 'screen sharing', 'live gaming', 'game broadcasts',
      'gaming community', 'stream games online', 'watch gamers live',
      'HydroGaming', 'esports streaming', 'video game streaming',
      'gaming platform', 'live game streaming', 'broadcast gaming'
    ]
  });

  const [streams, setStreams] = useState<GamingStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('viewers');
  const [activeArcadeTab, setActiveArcadeTab] = useState<'games' | 'share'>('games');

  const streamsSectionRef = useRef<HTMLDivElement | null>(null);

  const fetchStreams = useCallback(async () => {
    try {
      const { data: streamsData, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          broadcaster_id,
          category,
          is_live,
          is_featured,
          viewer_count,
          current_viewers,
          started_at,
          agora_channel,
          layout_mode,
          thumbnail_url
        `)
        .eq('category', 'gaming')
        .eq('is_live', true)
        .order('is_featured', { ascending: false })
        .order('current_viewers', { ascending: false })
        .limit(50);

      if (error) throw error;

      const broadcasterIds = Array.from(
        new Set((streamsData || []).map((s: any) => s.broadcaster_id).filter(Boolean))
      );

      let broadcasterMap = new Map<string, any>();

      if (broadcasterIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', broadcasterIds);

        if (profilesError) {
          console.warn('[HytroGaming] Failed to fetch broadcaster profiles:', profilesError);
        }

        if (profiles) {
          broadcasterMap = new Map(profiles.map((p: any) => [p.id, p]));
        }
      }

      const gamingStreams: GamingStream[] = (streamsData || []).map((s: any) => {
        const broadcaster = broadcasterMap.get(s.broadcaster_id);

        return {
          id: s.id,
          title: s.title || 'Untitled Gaming Stream',
          broadcaster_id: s.broadcaster_id,
          broadcaster_name: broadcaster?.username || 'Unknown Gamer',
          broadcaster_avatar: broadcaster?.avatar_url || null,
          thumbnail_url: s.thumbnail_url || null,
          viewer_count: s.viewer_count || 0,
          current_viewers: s.current_viewers || 0,
          is_live: Boolean(s.is_live),
          is_featured: Boolean(s.is_featured),
          category: s.category || 'gaming',
          started_at: s.started_at || null,
          agora_channel: s.agora_channel || null,
          layout_mode: s.layout_mode || 'grid',
        };
      });

      setStreams(gamingStreams);
    } catch (err) {
      console.error('[HytroGaming] Failed to fetch streams:', err);
      toast.error('Failed to load gaming streams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();

    const interval = window.setInterval(fetchStreams, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchStreams]);

  useEffect(() => {
    const channel = supabase
      .channel('hytrogaming-streams')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: 'category=eq.gaming',
        },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStreams]);

  const totalViewers = useMemo(() => {
    return streams.reduce((sum, stream) => sum + getStreamViewers(stream), 0);
  }, [streams]);

  const featuredStreams = useMemo(() => {
    return streams.filter((stream) => stream.is_featured);
  }, [streams]);

  const filteredStreams = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return streams
      .filter((stream) => {
        if (!normalizedQuery) return true;

        return (
          stream.title.toLowerCase().includes(normalizedQuery) ||
          stream.broadcaster_name.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        if (sortMode === 'featured') {
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return getStreamViewers(b) - getStreamViewers(a);
        }

        if (sortMode === 'recent') {
          return (
            new Date(b.started_at || 0).getTime() -
            new Date(a.started_at || 0).getTime()
          );
        }

        return getStreamViewers(b) - getStreamViewers(a);
      });
  }, [streams, searchQuery, sortMode]);

  const handleStreamClick = useCallback(
    (stream: GamingStream) => {
      navigate(`/gaming/watch/${stream.id}`);
    },
    [navigate]
  );

  const scrollToStreams = useCallback(() => {
    streamsSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  // Session still being restored: loading shell, never user data.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050714] text-white">
        <div className="animate-pulse px-6 py-3 rounded bg-[#0a0c16] border border-white/10">
          Loading HytroGaming…
        </div>
      </div>
    );
  }

  // Signed out: public HytroGaming landing page. No user-specific data loaded.
  if (!user) {
    return <HytroGamingLanding />;
  }

  const canSeeStreams = isMobileOrPWA || agencyStatus === 'approved' || agencyStatus === 'exempt';

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#070812] text-white md:h-[100dvh] md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_5%,rgba(124,58,237,.25),transparent_40%),radial-gradient(ellipse_at_95%_70%,rgba(6,182,212,.13),transparent_40%)]" />
      {/* One toolbar, not a stack of landing-page sections */}
      <header className="relative z-20 shrink-0 border-b border-violet-400/15 bg-[#0b0e20]/95 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"><ArrowLeft className="size-4" /></button>
          <HytroLogo compact />
          <div className="ml-auto flex items-center gap-2 text-[11px] font-bold text-slate-400">
            <span className="hidden rounded-lg border border-white/10 px-3 py-2 sm:inline-flex"><Radio className="mr-2 size-3.5 text-red-400" />{streams.length} live</span>
            <span className="hidden rounded-lg border border-white/10 px-3 py-2 md:inline-flex"><Users className="mr-2 size-3.5 text-cyan-400" />{formatCompactNumber(totalViewers)} watching</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4">
        {/* Arcade marquee and single horizontal navigation */}
        <div className="shrink-0 overflow-hidden rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-[#221038] via-[#12152d] to-[#092a39] p-3 shadow-[inset_0_0_35px_rgba(168,85,247,.09)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/15 shadow-[0_0_28px_rgba(217,70,239,.17)]"><Gamepad2 className="size-6 text-fuchsia-300" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-fuchsia-300">MaiTroll Arcade</p><h1 className="text-lg font-black leading-tight sm:text-2xl">Play games. Share gameplay. Compete.</h1></div>
            </div>
            <div role="tablist" aria-label="Arcade areas" className="flex w-full items-center gap-1 rounded-xl border border-white/10 bg-black/35 p-1 sm:w-auto">
              <button role="tab" aria-selected={activeArcadeTab === 'games'} onClick={() => setActiveArcadeTab('games')} className={cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-black transition sm:flex-none',activeArcadeTab === 'games' ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg':'text-slate-300 hover:bg-white/10')}><Gamepad2 className="size-4" /> Arcade Games</button>
              <button role="tab" aria-selected={activeArcadeTab === 'share'} onClick={() => setActiveArcadeTab('share')} className={cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-black transition sm:flex-none',activeArcadeTab === 'share' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg':'text-slate-300 hover:bg-white/10')}><MonitorPlayIcon /> Game Share</button>
            </div>
          </div>
        </div>

        {/* Only one primary arcade area is displayed at a time. */}
        {activeArcadeTab === 'games' ? (
          <section role="tabpanel" aria-label="Arcade Games" className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1228]/90 p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div><h2 className="flex items-center gap-2 text-base font-black"><Trophy className="size-5 text-amber-300" /> Game Library & Rankings</h2><p className="text-xs text-slate-400">Choose a game and challenge the leaderboard.</p></div>
              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-fuchsia-200">Insert coin • Press play</span>
            </div>
            {/* GamesSection retains ALL existing game, coin, multiplayer and leaderboard logic. */}
            <div className="min-w-0 [&_table]:w-full [&_th]:text-left [&_td]:border-b [&_td]:border-white/5"><GamesSection /></div>
          </section>
        ) : (
          <section role="tabpanel" aria-label="Game Share" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {isMobileOrPWA && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-100">Desktop is required to start game sharing; you can watch streams here.</div>}
            {!isMobileOrPWA && agencyStatus === 'loading' && <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-7 text-sm text-slate-300"><Loader2 className="size-5 animate-spin" /> Checking agency status...</div>}
            {!isMobileOrPWA && agencyStatus === 'pending' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4"><div><h2 className="font-black text-amber-100">Agency application pending</h2><p className="text-xs text-slate-300">Your application is under review.</p></div><button onClick={() => navigate('/hytrogaming/apply')} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-slate-950">View Application</button></div>}
            {!isMobileOrPWA && agencyStatus === 'none' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4"><div><h2 className="font-black">Apply to Game Share</h2><p className="max-w-2xl text-xs text-slate-300">Agency membership is required to stream. The monthly fee is 5,000 Troll Coins; startup fees match regular agencies. Loans may be available.</p></div><div className="flex gap-2"><button onClick={() => navigate('/hytrogaming/apply')} className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950">Apply</button><button onClick={() => navigate('/agencies')} className="rounded-xl border border-white/20 px-4 py-2 text-xs font-bold">Learn More</button></div></div>}
            {canSeeStreams && <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d132a] p-3 sm:p-4">
                <div><h2 className="flex items-center gap-2 text-lg font-black"><Radio className="size-5 text-red-400" /> Game Share Arena</h2><p className="text-xs text-slate-400">Watch creators broadcast their gameplay live.</p></div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">{streams.length} Live</span>
                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">{formatCompactNumber(totalViewers)} Viewers</span>
                  {!isMobileOrPWA && <button onClick={() => navigate('/broadcast/setup/gaming')} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-xs font-black text-slate-950"><Radio className="size-4" /> Start Game Share</button>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[170px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Find streams or gamers" className="w-full rounded-xl border border-white/10 bg-[#121a31] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cyan-400/50" /></div>
                {(['viewers','featured','recent'] as SortMode[]).map(mode => <SortChip key={mode} mode={mode} active={sortMode === mode} onClick={() => setSortMode(mode)} />)}
              </div>
              <div ref={streamsSectionRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1228]/70 p-3">
                {loading ? <div className="flex min-h-36 items-center justify-center gap-2 text-slate-400"><Loader2 className="size-5 animate-spin" /> Loading game shares...</div> : filteredStreams.length === 0 ? <div className="grid min-h-40 place-items-center text-center"><div><Gamepad2 className="mx-auto mb-3 size-8 text-slate-500" /><p className="font-bold">No live gaming streams</p><p className="mt-1 text-xs text-slate-400">{searchQuery.trim() ? 'Try a different search.' : 'No one is game sharing right now.'}</p></div></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredStreams.map(stream => <GamingStreamCard key={stream.id} stream={stream} onClick={() => handleStreamClick(stream)} />)}</div>}
              </div>
            </>}
          </section>
        )}
      </main>
    </div>
  );
}

function MonitorPlayIcon() { return <Gamepad2 className="size-4" />; }

function getStreamViewers(stream: GamingStream) {
  return stream.current_viewers || stream.viewer_count || 0;
}

function getTimeAgo(startedAt: string | null): string {
  if (!startedAt) return 'Just now'
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return 'Just now'
  const elapsedMs = Math.max(0, Date.now() - start)
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}
