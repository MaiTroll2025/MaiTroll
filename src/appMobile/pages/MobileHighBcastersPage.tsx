import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Hls from 'hls.js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Crown, Eye, Clock, Play, Verified, Radio, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Types ─── */
interface BroadcasterInfo {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_verified?: boolean;
  bio?: string;
  followers_count?: number;
  subscribers_count?: number;
  total_likes?: number;
}

interface LiveStream {
  id: string;
  title: string;
  category?: string;
  current_viewers: number;
  started_at: string | null;
  hls_url?: string;
  hls_path?: string;
  broadcaster_id: string;
  broadcaster?: BroadcasterInfo;
  thumbnail_url?: string;
  is_featured?: boolean;
}

/* ─── Helpers ─── */
function formatViewers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return 'LIVE';
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getStreamUrl(streamId: string, username?: string) {
  return `/live/${encodeURIComponent(username || streamId)}`;
}

/* ─── Diamond Sparkles ─── */
function DiamondSparkles() {
  const diamonds = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2 + Math.random() * 2}s`,
      size: `${3 + Math.random() * 4}px`,
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {diamonds.map((d) => (
        <span
          key={d.id}
          className="absolute block animate-diamond-sparkle"
          style={{
            left: d.left,
            top: d.top,
            animationDelay: d.delay,
            animationDuration: d.duration,
            width: d.size,
            height: d.size,
            background: 'linear-gradient(135deg, #FFD700 0%, #FFF8DC 50%, #FFD700 100%)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: '0 0 4px rgba(255, 215, 0, 0.5)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── HLS Video Preview ─── */
function LivePreview({ stream, isActive }: { stream: LiveStream; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream.hls_url) return;
    setHasError(false);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 8,
        maxMaxBufferLength: 16,
      });
      hlsRef.current = hls;
      hls.loadSource(stream.hls_url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setHasError(true);
          hls.destroy();
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.hls_url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }
  }, [stream.hls_url, stream.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.muted = false;
      video.volume = 0.5;
      video.play().catch(() => {});
    } else {
      video.muted = true;
      video.play().catch(() => {});
    }
  }, [isActive]);

  if (hasError || !stream.hls_url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <Radio size={24} className="text-purple-400" />
          <span className="text-[10px] font-bold">LIVE</span>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      muted={!isActive}
      playsInline
      preload="metadata"
      loop
    />
  );
}

/* ─── Broadcaster Card (Mobile) ─── */
function BroadcasterCard({
  stream,
  rank,
  isTop1,
  isActive,
  onClick,
}: {
  stream: LiveStream;
  rank: number;
  isTop1: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { user: _user } = useAuthStore();
  const broadcaster = stream.broadcaster;
  const streamUrl = getStreamUrl(stream.id, broadcaster?.username);

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl transition-all duration-500',
        'bg-[#0a0612]/90 backdrop-blur-xl',
        isActive
          ? 'scale-[1.02] shadow-[0_0_30px_rgba(255,215,0,0.3),0_0_60px_rgba(168,85,247,0.2)]'
          : isHovered
            ? 'scale-[1.01] shadow-[0_0_20px_rgba(255,215,0,0.2)]'
            : 'shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
        isTop1 && 'ring-2 ring-yellow-400/60',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Gold border */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500',
          isHovered || isActive ? 'opacity-100' : 'opacity-50',
        )}
        style={{
          background: isTop1
            ? 'linear-gradient(135deg, #FFD700, #FFF8DC, #FFD700, #B8860B, #FFD700)'
            : 'linear-gradient(135deg, #FFD700, #DAA520, #FFD700, #B8860B)',
          padding: '2px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Glow */}
      <div
        className={cn(
          'pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-lg transition-opacity duration-700',
          isHovered || isActive ? 'opacity-30' : 'opacity-15',
        )}
        style={{
          background: 'radial-gradient(circle at center, rgba(255,215,0,0.4), transparent 70%)',
          animation: 'goldPulse 4s ease-in-out infinite',
        }}
      />

      {/* Sparkles */}
      <DiamondSparkles />

      {/* Rank Badge */}
      <div className="absolute top-2 left-2 z-20">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full font-black text-xs shadow-lg',
            rank === 1
              ? 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 text-yellow-950 shadow-[0_0_15px_rgba(255,215,0,0.6)]'
              : rank === 2
                ? 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 text-gray-800'
                : rank === 3
                  ? 'bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 text-orange-950'
                  : 'bg-gradient-to-br from-slate-600 via-slate-500 to-slate-700 text-white',
          )}
        >
          {rank <= 3 ? <Crown size={14} /> : `#${rank}`}
        </div>
      </div>

      {/* Live + Viewers */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-sm shadow-[0_0_8px_rgba(220,38,38,0.4)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          LIVE
        </div>
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm border border-white/10">
          <Eye size={8} className="text-cyan-400" />
          {formatViewers(stream.current_viewers)}
        </div>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        <LivePreview stream={stream} isActive={isActive} />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
              <Play size={16} className="text-white ml-0.5" />
            </div>
          </div>
        )}
        {stream.category && (
          <div className="absolute bottom-1.5 left-1.5 z-10 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm border border-white/10">
            {stream.category}
          </div>
        )}
      </div>

      {/* Broadcaster Info */}
      <div className="relative z-10 flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            {broadcaster?.avatar_url && !imageError ? (
              <img
                src={broadcaster.avatar_url}
                alt={broadcaster.username}
                className="h-8 w-8 rounded-full border border-yellow-500/40 object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-yellow-500/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-[10px] font-black text-white">
                {(broadcaster?.username || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full border-2 border-[#0a0612] bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-xs font-black text-white">
                {broadcaster?.display_name || broadcaster?.username || 'Unknown'}
              </span>
              {broadcaster?.is_verified && (
                <Verified size={12} className="shrink-0 text-cyan-400" />
              )}
            </div>
            <div className="truncate text-[9px] text-slate-400">
              @{broadcaster?.username || 'unknown'}
            </div>
          </div>
        </div>

        <h3 className="line-clamp-1 text-xs font-bold text-white/90">{stream.title}</h3>

        <div className="flex flex-wrap items-center gap-2 text-[9px] font-semibold text-slate-400">
          <span className="flex items-center gap-0.5">
            <Eye size={9} className="text-cyan-400" />
            {formatViewers(stream.current_viewers)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock size={9} className="text-purple-400" />
            {formatDuration(stream.started_at)}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1.5">
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 py-1.5 text-[10px] font-bold text-black"
          >
            Follow
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg border border-purple-400/40 bg-purple-500/10 py-1.5 text-[10px] font-bold text-purple-200"
          >
            Sub
          </button>
          <Link
            to={streamUrl}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1.5 text-[10px] font-bold text-cyan-200"
          >
            <Play size={10} />
          </Link>
        </div>
      </div>

      {/* Top 1 ribbon */}
      {isTop1 && (
        <div className="absolute -top-px right-4 z-20 rounded-b-md bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-950 shadow-[0_0_10px_rgba(255,215,0,0.5)]">
          Top Broadcaster
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function MobileHighBcastersPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchTopBroadcasters = useCallback(async () => {
    try {
      setLoading(true);
      setPageError(null);

      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          current_viewers,
          started_at,
          hls_url,
          hls_path,
          broadcaster_id,
          is_featured,
          broadcaster:user_profiles!streams_broadcaster_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            bio,
            followers_count,
            subscribers_count,
            total_likes
          )
        `)
        .eq('is_live', true)
        .order('current_viewers', { ascending: false })
        .limit(10);

      if (error) throw error;

      const mapped: LiveStream[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || 'Untitled Stream',
        category: row.category,
        current_viewers: row.current_viewers || 0,
        started_at: row.started_at,
        hls_url: row.hls_url,
        hls_path: row.hls_path,
        broadcaster_id: row.broadcaster_id,
        broadcaster: row.broadcaster
          ? {
              id: row.broadcaster.id,
              username: row.broadcaster.username || 'Unknown',
              display_name: row.broadcaster.display_name,
              avatar_url: row.broadcaster.avatar_url,
              is_verified: row.broadcaster.is_verified,
              bio: row.broadcaster.bio,
              followers_count: row.broadcaster.followers_count,
              subscribers_count: row.broadcaster.subscribers_count,
              total_likes: row.broadcaster.total_likes,
            }
          : undefined,
        thumbnail_url: undefined,
        is_featured: row.is_featured,
      }));

      setStreams(mapped);
    } catch (err: any) {
      console.error('Error fetching top broadcasters:', err);
      setPageError(err.message || 'Failed to load broadcasters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopBroadcasters();

    const channel = supabase
      .channel('mobile-high-bcasters')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: 'is_live=eq.true',
      }, () => {
        fetchTopBroadcasters();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTopBroadcasters]);

  return (
    <div className="min-h-screen bg-[#050715]">
      <style>{`
        @keyframes goldPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        @keyframes diamond-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
        .animate-diamond-sparkle {
          animation: diamond-sparkle 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050715] via-[#0a0612] to-[#050715]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.1),transparent_50%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-lg px-3 py-4">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute -inset-2 rounded-full bg-yellow-500/20 blur-lg" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-400 bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-[0_0_20px_rgba(255,215,0,0.4)]">
              <Crown size={24} className="text-yellow-950" />
            </div>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
              High Bcasters
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Top {streams.length} Elite Broadcasters
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-500/20 border-t-yellow-400" />
            <p className="mt-3 text-xs text-slate-400">Loading...</p>
          </div>
        )}

        {/* Error */}
        {pageError && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs text-red-300">{pageError}</p>
              <button
                onClick={fetchTopBroadcasters}
                className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-bold text-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !pageError && streams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Radio size={28} className="text-slate-500" />
            <h3 className="mt-3 text-sm font-black text-white">No Live Broadcasters</h3>
            <p className="mt-1 text-xs text-slate-400">Check back later</p>
          </div>
        )}

        {/* Grid: 2 columns, 5 rows */}
        {!loading && streams.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {streams.map((stream, index) => {
              const rank = index + 1;
              const isTop1 = rank === 1;
              const isActive = activeStreamId === stream.id;

              return (
                <BroadcasterCard
                  key={stream.id}
                  stream={stream}
                  rank={rank}
                  isTop1={isTop1}
                  isActive={isActive}
                  onClick={() => setActiveStreamId(stream.id)}
                />
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && streams.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
            <Link
              to="/live"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold text-white"
            >
              View All Live
              <ChevronRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
