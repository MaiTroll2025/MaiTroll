import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye, Radio, Users, Sparkles, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import LiveStreamsModule from '@/components/home/LiveStreamsModule';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import FeaturedBroadcasts from '@/components/broadcast/FeaturedBroadcasts';
import { cn } from '@/lib/utils';

interface GlassBentoLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function GlassBentoLayout({
  liveItems,
  totalViewers,
  loadingLive,
  onLiveItemClick,
  onRequireAuth,
}: GlassBentoLayoutProps) {
  const { user } = useAuthStore();

  const featured = useMemo(() => liveItems.filter(i => i.isFeatured).slice(0, 2), [liveItems]);
  const battles = useMemo(() => liveItems.filter(i => i.isBattle).slice(0, 3), [liveItems]);
  const regular = useMemo(() => liveItems.slice(0, 6), [liveItems]);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] p-4 md:p-6 overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.25),transparent_50%)]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(56,189,248,0.20),transparent_55%)]" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[radial-gradient(circle,rgba(236,72,153,0.18),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Mai Troll
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {totalViewers.toLocaleString()} citizens online now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            ● LIVE
          </span>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-4 gap-4 auto-rows-[minmax(180px,auto)]">

        {/* Hero - Large featured (spans 2 cols, 2 rows) */}
        {featured[0] && (
          <div
            onClick={() => onLiveItemClick(featured[0])}
            className="md:col-span-2 md:row-span-2 relative group rounded-3xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="lg">
              <BackgroundImage url={featured[0].streamerAvatar} />
              <GradientOverlay />
              <div className="absolute inset-0">
                <div className="absolute top-4 right-4">
                  <div className="px-3 py-1 bg-gradient-to-r from-yellow-600/90 to-amber-600/90 backdrop-blur rounded-full text-[10px] font-bold text-white border border-yellow-400/30">
                    FEATURED
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full ring-2 ring-white/40">
                      <img src={featured[0].streamerAvatar || ''} alt="" className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white leading-tight">{featured[0].title}</h3>
                      <p className="text-sm text-white/70">{featured[0].streamerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      {featured[0].viewerCount}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-red-400" />
                      LIVE
                    </span>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
              </div>
            </GlassCard>
            </div>
          )}

        {/* Medium card 1 - Battle or stream */}
        {(battles[0] || regular[1]) && (
          <div
            onClick={() => onLiveItemClick(battles[0] || regular[1])}
            className="md:col-span-1 md:row-span-1 relative group rounded-2xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="md">
              <BackgroundImage url={(battles[0] || regular[1]).streamerAvatar} />
              <GradientOverlay strong />

              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                <div className="flex justify-end">
                  {(battles[0] || regular[1]).isBattle && (
                    <span className="px-2 py-0.5 bg-yellow-500/80 backdrop-blur rounded text-[8px] font-bold text-black">
                      ⚡ BATTLE
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-white truncate">
                    {(battles[0] || regular[1]).title}
                  </p>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    {(battles[0] || regular[1]).streamerName}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Medium card 2 */}
        {regular[2] && (
          <div
            onClick={() => onLiveItemClick(regular[2])}
            className="md:col-span-1 md:row-span-1 relative group rounded-2xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="md">
              <BackgroundImage url={regular[2].streamerAvatar} />
              <GradientOverlay strong />

              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                <div className="flex justify-end">
                  <span className="px-2 py-0.5 bg-red-500/80 backdrop-blur rounded text-[8px] font-bold text-white flex items-center gap-1">
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold text-white truncate">
                    {regular[2].title}
                  </p>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    {regular[2].streamerName}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Tall card */}
        {regular[3] && (
          <div
            onClick={() => onLiveItemClick(regular[3])}
            className="md:col-span-1 md:row-span-2 relative group rounded-2xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="md">
              <BackgroundImage url={regular[3].streamerAvatar} />
              <GradientOverlay strong />

              <div className="absolute inset-0 p-4 flex flex-col justify-between">
                <div className="flex justify-end">
                  <span className="px-2 py-0.5 bg-red-500/80 backdrop-blur rounded text-[8px] font-bold text-white flex items-center gap-1">
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold text-white leading-tight line-clamp-2">
                    {regular[3].title}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    {regular[3].streamerName}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                    <Eye className="w-3 h-3" />
                    {regular[3].viewerCount}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Small card 1 */}
        {regular[4] && (
          <div
            onClick={() => onLiveItemClick(regular[4])}
            className="md:col-span-1 md:row-span-1 relative group rounded-2xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="sm">
              <BackgroundImage url={regular[4].streamerAvatar} />
              <GradientOverlay />

              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-semibold text-white truncate">
                  {regular[4].streamerName}
                </p>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Small card 2 */}
        {regular[5] && (
          <div
            onClick={() => onLiveItemClick(regular[5])}
            className="md:col-span-1 md:row-span-1 relative group rounded-2xl overflow-hidden cursor-pointer"
          >
            <GlassCard size="sm">
              <BackgroundImage url={regular[5].streamerAvatar} />
              <GradientOverlay />

              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-semibold text-white truncate">
                  {regular[5].streamerName}
                </p>
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Wall section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Troll Wall</span>
            <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-white/50">Live Feed</span>
          </div>
        </div>
        <div className="h-[calc(100vh-28rem)] min-h-[300px]">
          <TrollWallFeed onRequireAuth={onRequireAuth} />
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function GlassCard({ size = 'md', children }: { size?: 'sm' | 'md' | 'lg'; children: React.ReactNode }) {
  const sizes = {
    sm: '',
    md: 'p-3',
    lg: 'p-6',
  };

  return (
    <div className={cn(
      "absolute inset-0 glass-panel-premium border border-white/10",
      sizes[size]
    )}>
      {children}
    </div>
  );
}

function BackgroundImage({ url }: { url?: string | null }) {
  return (
    <div className="absolute inset-0">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-500" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-cyan-900/50" />
      )}
    </div>
  );
}

function GradientOverlay({ strong = false }: { strong?: boolean }) {
  return (
    <div className={cn(
      "absolute inset-0 bg-gradient-to-t",
      strong ? "from-black/90 via-black/60 to-transparent" : "from-black/70 via-black/30 to-transparent"
    )} />
  );
}
