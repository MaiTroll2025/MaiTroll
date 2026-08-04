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
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Clock3,
  Crown,
  Eye,
  Flame,
  Gamepad2,
  Loader2,
  MonitorPlay,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { cn, formatCompactNumber } from '@/lib/utils';
import useSEO from '@/hooks/useSEO';
import LazyLiveThumbnail from '@/components/broadcast/LazyLiveThumbnail';
import { useIsMobile } from '@/hooks/useIsMobile';
import { isStandalone } from '@/pwa/install';

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
        'flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl',
        toneClass
      )}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {label}
        </p>
        <p className="truncate text-lg font-black text-white">{value}</p>
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
  const viewers = getStreamViewers(stream);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-3xl text-left transition-all duration-300',
        'border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl',
        'hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_0_45px_rgba(34,211,238,0.16)]',
        featured && 'lg:col-span-2'
      )}
    >
      <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-cyan-400/20 via-purple-500/10 to-emerald-400/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div
        className={cn(
          'relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#090117] to-cyan-950/40',
          featured ? 'aspect-[16/8.5]' : 'aspect-[16/10]'
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
  const { user, profile } = useAuthStore();
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
  }, [user?.id, profile?.role, (profile as any)?.troll_role]);

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

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(168,85,247,0.16),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.10),transparent_34%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:36px_36px]" />

      {/* Sticky Arena Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/78 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10 hover:text-white sm:hidden"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0 shrink-0">
              <HytroLogo compact />
            </div>

            <div className="hidden flex-1 justify-center sm:flex">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search gamers, battles, streams..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-400/15"
                />
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              {(['viewers', 'featured', 'recent'] as SortMode[]).map((mode) => (
                <SortChip
                  key={mode}
                  mode={mode}
                  active={sortMode === mode}
                  onClick={() => setSortMode(mode)}
                />
              ))}
            </div>

            {!isMobileOrPWA && (
              <button
                type="button"
                onClick={() => navigate('/broadcast/setup/gaming')}
                className="hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 px-4 py-2.5 text-xs font-black text-white shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:scale-[1.02] lg:inline-flex"
              >
                Go Live
              </button>
            )}
          </div>

          <div className="mt-3 sm:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search gaming streams..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {(['viewers', 'featured', 'recent'] as SortMode[]).map((mode) => (
              <SortChip
                key={mode}
                mode={mode}
                active={sortMode === mode}
                onClick={() => setSortMode(mode)}
              />
            ))}
          </div>
        </div>
      </header>

      {/* ── Mobile/PWA Notice ────────────────────────────────────────────────── */}
      {isMobileOrPWA && (
        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-center">
            <p className="text-sm font-semibold text-cyan-100">
              HytroGame streaming is currently available on desktop. You can still watch and interact with streams from this device.
            </p>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-6 sm:pt-8">
        {/* ── Desktop Agency Gate ───────────────────────────────────────────── */}
        {!isMobileOrPWA && agencyStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            <p className="text-sm text-slate-400">Checking agency status...</p>
          </div>
        )}

        {!isMobileOrPWA && agencyStatus === 'pending' && (
          <div className="mx-auto max-w-7xl px-4 py-12">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-amber-300" />
              <h3 className="mt-3 text-lg font-black text-amber-100">Agency Application Pending</h3>
              <p className="mt-2 text-sm text-slate-400">
                Your agency application is under review. You'll be able to access HytroGaming once approved.
              </p>
              <button
                type="button"
                onClick={() => navigate('/hytrogaming/apply')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-200"
              >
                <Briefcase className="h-4 w-4" />
                View Application
              </button>
            </div>
          </div>
        )}

        {!isMobileOrPWA && agencyStatus === 'none' && user && (
          <div className="mx-auto max-w-7xl px-4 py-12">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-6 text-center sm:p-8">
              <Gamepad2 className="mx-auto h-10 w-10 text-cyan-300" />
              <h3 className="mt-4 text-xl font-black text-white">Apply for Agency to Game Share</h3>
              <p className="mt-2 max-w-lg mx-auto text-sm text-slate-400">
                To stream on HytroGaming, you need to apply for an agency. 
                The startup fee is the same as regular agencies, with a monthly fee of 5,000 Troll Coins.
                You can also apply for a loan to cover the fees.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/hytrogaming/apply')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 px-6 py-3 text-sm font-black text-white shadow-[0_0_35px_rgba(34,211,238,0.20)] transition hover:scale-[1.02]"
                >
                  <Briefcase className="h-4 w-4" />
                  Apply for Agency
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/agencies')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-3 text-sm font-bold text-white/90 transition hover:bg-white/[0.1]"
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Streams Content ───────────────────────────────────────────────── */}
        {/* Mobile/PWA always shows streams. Desktop requires approved/exempt. */}
        {(isMobileOrPWA || agencyStatus === 'approved' || agencyStatus === 'exempt') && (
        <>
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.18),transparent_32%)]" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Viewer-powered gaming arena
              </div>

              <HytroLogo />

              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Watch live gaming battles with{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Hype, Gifts, and Seats.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Jump into live gaming streams, discover featured creators, join the arena,
                and power up the room with viewer energy.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {!isMobileOrPWA && (
                  <button
                    type="button"
                    onClick={() => navigate('/broadcast/setup/gaming')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 px-5 py-3 text-sm font-black text-white shadow-[0_0_35px_rgba(34,211,238,0.20)] transition hover:scale-[1.02]"
                  >
                    <Radio className="h-4 w-4" />
                    Start Gaming Stream
                  </button>
                )}

                <button
                  type="button"
                  onClick={scrollToStreams}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3 text-sm font-black text-white/90 transition hover:bg-white/[0.1]"
                >
                  <Play className="h-4 w-4" />
                  Explore Live
                </button>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <StatPill
                  icon={<Radio className="h-5 w-5 text-red-300" />}
                  label="Live Streams"
                  value={streams.length.toLocaleString()}
                  tone="cyan"
                />
                <StatPill
                  icon={<Users className="h-5 w-5 text-emerald-300" />}
                  label="Watching"
                  value={formatCompactNumber(totalViewers)}
                  tone="green"
                />
                <StatPill
                  icon={<Flame className="h-5 w-5 text-orange-300" />}
                  label="Featured"
                  value={featuredStreams.length.toLocaleString()}
                  tone="orange"
                />
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 p-4 shadow-[0_0_60px_rgba(34,211,238,0.12)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-900 via-[#080217] to-cyan-950/40 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)]" />
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                        Arena Preview
                      </p>
                    </div>

                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-cyan-100">
                      60 FPS
                    </div>
                  </div>

                  <div className="grid aspect-video place-items-center overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                    <div className="text-center">
                      <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_40px_rgba(34,211,238,0.18)]">
                        <MonitorPlay className="h-12 w-12 text-cyan-200" />
                      </div>
                      <p className="mt-4 text-lg font-black text-white">Gaming Lobby</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Featured streams, live battles, and creator rooms.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-purple-300/20 bg-purple-400/10 p-3">
                      <Crown className="h-5 w-5 text-purple-200" />
                      <p className="mt-2 text-xs font-black text-white">Top Fans</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
                      <Zap className="h-5 w-5 text-cyan-200" />
                      <p className="mt-2 text-xs font-black text-white">Hype</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                      <Trophy className="h-5 w-5 text-emerald-200" />
                      <p className="mt-2 text-xs font-black text-white">Battles</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Arena */}
        {featuredStreams.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-300" />
                  <h2 className="text-xl font-black text-white">Featured Arena</h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Hot gaming streams getting pushed to the front.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSortMode('featured')}
                className="hidden rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-xs font-black text-orange-100 transition hover:bg-orange-400/15 sm:inline-flex"
              >
                View Featured
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {featuredStreams.slice(0, 3).map((stream, index) => (
                <GamingStreamCard
                  key={stream.id}
                  stream={stream}
                  featured={index === 0}
                  onClick={() => handleStreamClick(stream)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Streams */}
        <section ref={streamsSectionRef} className="mt-10 scroll-mt-28">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-black text-white">Live Gaming Streams</h2>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {filteredStreams.length.toLocaleString()}{' '}
                {filteredStreams.length === 1 ? 'stream' : 'streams'} available
                {searchQuery.trim() ? ` for “${searchQuery.trim()}”` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
              <Radio className="h-4 w-4 text-red-300" />
              Realtime updates active
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-[280px] place-items-center rounded-[2rem] border border-white/10 bg-white/[0.035]">
              <div className="flex flex-col items-center gap-4">
                <div className="grid h-20 w-20 place-items-center rounded-3xl border border-cyan-300/25 bg-cyan-300/10">
                  <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  Loading HytroGaming arena...
                </p>
              </div>
            </div>
          ) : filteredStreams.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-center">
              <div>
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-white/10 bg-white/[0.04]">
                  <Gamepad2 className="h-12 w-12 text-slate-600" />
                </div>

                <h3 className="mt-5 text-xl font-black text-white">
                  No gaming streams live
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                  {searchQuery.trim()
                    ? `No streams matched “${searchQuery.trim()}”. Try another gamer name or stream title.`
                    : 'Be the first creator to light up the HytroGaming arena.'}
                </p>

                {!searchQuery.trim() && !isMobileOrPWA && (
                  <button
                    type="button"
                    onClick={() => navigate('/broadcast/setup/gaming')}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 px-5 py-3 text-sm font-black text-white transition hover:scale-[1.02]"
                  >
                    <Radio className="h-4 w-4" />
                    Start Gaming Stream
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredStreams.map((stream) => (
                <GamingStreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={() => handleStreamClick(stream)}
                />
              ))}
            </div>
          )}
        </section>
        </>
        )}
      </main>
    </div>
  );
}

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
