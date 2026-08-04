import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Hls from 'hls.js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Crown, Eye, Users, Heart, Clock, Play, Verified, Radio, ChevronRight } from 'lucide-react';
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
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff / 60) % 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getStreamUrl(streamId: string, username?: string) {
  return `/live/${encodeURIComponent(username || streamId)}`;
}

/* ─── Diamond Sparkle Component ─── */
function DiamondSparkles() {
  const diamonds = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${2 + Math.random() * 3}s`,
      size: `${4 + Math.random() * 6}px`,
      rotation: `${Math.random() * 360}deg`,
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
            transform: `rotate(${d.rotation})`,
            background: `linear-gradient(135deg, #FFD700 0%, #FFF8DC 50%, #FFD700 100%)`,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            boxShadow: '0 0 6px rgba(255, 215, 0, 0.6)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── HLS Video Preview ─── */
function LivePreview({ stream, isActive, onClick }: { stream: LiveStream; isActive: boolean; onClick: () => void }) {
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
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
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
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Radio size={32} className="text-purple-400" />
          <span className="text-xs font-bold">LIVE PREVIEW</span>
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

/* ─── Broadcaster Card ─── */
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
  const { user } = useAuthStore();
  const broadcaster = stream.broadcaster;

  const streamUrl = getStreamUrl(stream.id, broadcaster?.username);

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-500',
        'bg-[#0a0612]/90 backdrop-blur-xl',
        isActive
          ? 'scale-[1.02] shadow-[0_0_40px_rgba(255,215,0,0.3),0_0_80px_rgba(168,85,247,0.2)]'
          : isHovered
            ? 'scale-[1.01] shadow-[0_0_30px_rgba(255,215,0,0.2),0_0_60px_rgba(168,85,247,0.15)]'
            : 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        isTop1 && 'ring-2 ring-yellow-400/60',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        border: isTop1
          ? '3px solid transparent'
          : '2px solid transparent',
        backgroundClip: 'padding-box',
        ...(isTop1 ? {
          borderImage: 'linear-gradient(135deg, #FFD700, #FFF8DC, #FFD700, #B8860B) 1',
        } : {}),
      }}
    >
      {/* Animated gold border background */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500',
          isHovered || isActive ? 'opacity-100' : 'opacity-60',
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

      {/* Animated glow */}
      <div
        className={cn(
          'pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-xl transition-opacity duration-700',
          isHovered || isActive ? 'opacity-40' : 'opacity-20',
        )}
        style={{
          background: 'radial-gradient(circle at center, rgba(255,215,0,0.4), transparent 70%)',
          animation: 'goldPulse 4s ease-in-out infinite',
        }}
      />

      {/* Diamond sparkles */}
      <DiamondSparkles />

      {/* Rank Badge */}
      <div className="absolute top-3 left-3 z-20">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full font-black text-sm shadow-lg',
            rank === 1
              ? 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 text-yellow-950 shadow-[0_0_20px_rgba(255,215,0,0.6)]'
              : rank === 2
                ? 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 text-gray-800 shadow-[0_0_15px_rgba(192,192,192,0.5)]'
                : rank === 3
                  ? 'bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 text-orange-950 shadow-[0_0_15px_rgba(251,146,60,0.5)]'
                  : 'bg-gradient-to-br from-slate-600 via-slate-500 to-slate-700 text-white shadow-[0_0_10px_rgba(100,116,139,0.4)]',
          )}
        >
          {rank <= 3 ? <Crown size={16} /> : `#${rank}`}
        </div>
      </div>

      {/* Live Badge + Viewers */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md shadow-[0_0_12px_rgba(220,38,38,0.5)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
            <span className="relative rounded-full h-2 w-2 bg-red-500" />
          </span>
          LIVE
        </div>
        <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/10">
          <Eye size={10} className="text-cyan-400" />
          {formatViewers(stream.current_viewers)}
        </div>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        <LivePreview stream={stream} isActive={isActive} onClick={onClick} />

        {/* Play overlay when not active */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 group-hover:opacity-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 transition-transform duration-300 group-hover:scale-110">
              <Play size={20} className="text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Top 1 shimmer effect */}
        {isTop1 && (
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,215,0,0.08),transparent)] bg-[length:200%_100%] animate-shimmer" />
        )}

        {/* Category tag */}
        {stream.category && (
          <div className="absolute bottom-2 left-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm border border-white/10">
            {stream.category}
          </div>
        )}
      </div>

      {/* Broadcaster Info */}
      <div className="relative z-10 flex flex-1 flex-col gap-2 p-4">
        {/* Username + Verified */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            {broadcaster?.avatar_url && !imageError ? (
              <img
                src={broadcaster.avatar_url}
                alt={broadcaster.username}
                className="h-9 w-9 rounded-full border-2 border-yellow-500/40 object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-500/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-xs font-black text-white">
                {(broadcaster?.username || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 rounded-full border-2 border-[#0a0612] bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-black text-white">
                {broadcaster?.display_name || broadcaster?.username || 'Unknown'}
              </span>
              {broadcaster?.is_verified && (
                <Verified size={14} className="shrink-0 text-cyan-400" />
              )}
            </div>
            <div className="truncate text-[10px] text-slate-400">
              @{broadcaster?.username || 'unknown'}
            </div>
          </div>
        </div>

        {/* Bio */}
        {broadcaster?.bio && (
          <p className="line-clamp-2 text-xs text-slate-300">{broadcaster.bio}</p>
        )}

        {/* Stream title */}
        <h3 className="line-clamp-1 text-sm font-bold text-white/90">{stream.title}</h3>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <Users size={10} className="text-cyan-400" />
            {formatViewers(stream.current_viewers)} watching
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} className="text-purple-400" />
            {formatDuration(stream.started_at)}
          </span>
          {broadcaster?.followers_count != null && (
            <span className="flex items-center gap-1">
              <Heart size={10} className="text-pink-400" />
              {formatViewers(broadcaster.followers_count)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200',
              'bg-gradient-to-r from-yellow-500 to-amber-600 text-black',
              'hover:from-yellow-400 hover:to-amber-500 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)]',
            )}
          >
            Follow
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200',
              'border border-purple-400/40 bg-purple-500/10 text-purple-200',
              'hover:bg-purple-500/20 hover:border-purple-400/60',
            )}
          >
            Subscribe
          </button>
          <Link
            to={streamUrl}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200',
              'border border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
              'hover:bg-cyan-500/20 hover:border-cyan-400/60',
            )}
          >
            <Play size={12} className="mr-1" />
            Watch
          </Link>
        </div>
      </div>

      {/* Top 1 special ribbon */}
      {isTop1 && (
        <div className="absolute -top-px right-6 z-20 rounded-b-lg bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-950 shadow-[0_0_15px_rgba(255,215,0,0.5)]">
          Top Broadcaster
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function HighBcastersPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const { user } = useAuthStore();

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
      .channel('high-bcasters-page')
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

  const handleCardClick = useCallback((streamId: string) => {
    setActiveStreamId(streamId);
  }, []);

  return (
    <div className="min-h-screen bg-[#050715]">
      {/* Custom keyframes for gold shimmer and pulse */}
      <style>{`
        @keyframes goldPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.05); }
        }
        @keyframes diamond-sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(255, 215, 0, 0.6); }
          50% { border-color: rgba(255, 215, 0, 1); }
        }
        .animate-diamond-sparkle {
          animation: diamond-sparkle 3s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
        .animate-border-pulse {
          animation: borderPulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050715] via-[#0a0612] to-[#050715]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,215,0,0.06),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-yellow-500/20 blur-lg" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-400 bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-[0_0_30px_rgba(255,215,0,0.4)]">
                <Crown size={28} className="text-yellow-950" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
              High Bcasters
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
            The most prestigious live creators on Mai Troll. Exclusive access to the top 10 broadcasters.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Radio size={14} className="text-red-400" />
            <span>{streams.length} Elite Broadcasters Live</span>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-500/20 border-t-yellow-400" />
            <p className="mt-4 text-sm text-slate-400">Loading elite broadcasters...</p>
          </div>
        )}

        {/* Error state */}
        {pageError && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
              <p className="text-sm text-red-300">{pageError}</p>
              <button
                onClick={fetchTopBroadcasters}
                className="mt-4 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !pageError && streams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Radio size={32} className="text-slate-500" />
            </div>
            <h3 className="mt-4 text-lg font-black text-white">No Live Broadcasters</h3>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              There are no active broadcasters right now. Check back later to see the top creators.
            </p>
          </div>
        )}

        {/* Broadcaster Grid */}
        {!loading && streams.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  onClick={() => handleCardClick(stream.id)}
                />
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && streams.length > 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <div className="h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
            <p className="text-xs text-slate-500">
              Rankings update in real-time based on viewer count. Only the top 10 broadcasters are displayed.
            </p>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20 hover:bg-white/10"
            >
              View All Live Streams
              <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
