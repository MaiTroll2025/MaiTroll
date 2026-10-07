import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Eye, Radio, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import LiveStreamsModule from '@/components/home/LiveStreamsModule';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import { cn } from '@/lib/utils';

interface AmbientAuroraLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function AmbientAuroraLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: AmbientAuroraLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const featured = liveItems[0];
  const secondary = liveItems.slice(1, 4);
  const grid = liveItems.slice(4, 10);

  return (
    <div ref={containerRef} className="relative min-h-[calc(100vh-12rem)] overflow-hidden">
      {/* Animated aurora background */}
      <AuroraBackground />

      {/* Floating orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <FloatingOrb
            key={i}
            delay={i * 2}
            left={`${10 + i * 20}%`}
            top={`${20 + (i % 2) * 30}%`}
            color={i % 3 === 0 ? 'cyan' : i % 3 === 1 ? 'purple' : 'pink'}
            size={60 + i * 20}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 md:px-10 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="text-2xl font-black text-white tracking-tighter">
                TROLL
                <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  CITY
                </span>
              </div>
            </div>
            <p className="text-sm text-white/50">
              {totalViewers.toLocaleString()} connected • {liveItems.length} streams
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs font-medium text-white/40">
            <span>▸ EST. 2026</span>
            <span>▸ LIVE MODE</span>
          </div>
        </header>

        {/* Featured hero */}
        {featured && (
          <div
            onClick={() => onLiveItemClick(featured)}
            className="group relative mb-10 rounded-3xl overflow-hidden cursor-pointer"
          >
            <GlassPanel size="xl">
              <div className="absolute inset-0">
                <img
                  src={featured.streamerAvatar}
                  alt=""
                  className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-transparent" />
              </div>

              <div className="relative p-6 md:p-8 h-[400px] flex items-end">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/20">
                    <img src={featured.streamerAvatar || ''} alt="" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-xs font-bold text-white rounded-full border border-cyan-400/30">
                        ★ FEATURED
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-1">
                      {featured.title}
                    </h2>
                    <p className="text-lg text-cyan-200/80">
                      {featured.streamerName}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-sm text-white/50">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-cyan-300" />
                        <span className="font-semibold text-white">{featured.viewerCount?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-red-400" />
                        <span className="font-semibold text-white">LIVE</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-0.5" fill="white" />
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>
        )}

        {/* Secondary section */}
        {secondary.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">
              Live Channels
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondary.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onLiveItemClick(item)}
                  className="group relative aspect-video bg-slate-900/60 backdrop-blur rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:-translate-y-1"
                >
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-all duration-500"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  <div className="absolute inset-0 p-5 flex flex-col justify-between">
                    <div className="flex justify-end gap-2">
                      {item.isBattle && (
                        <span className="px-2 py-0.5 bg-yellow-500/90 text-[8px] font-bold text-black rounded">
                          BATTLE
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-red-600 text-[9px] font-bold text-white rounded flex items-center gap-1">
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                        LIVE
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white mb-0.5 line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/60">{item.streamerName}</span>
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <Eye className="w-3 h-3" />
                          {item.viewerCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid section */}
        {grid.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">
              Discover
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {grid.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onLiveItemClick(item)}
                  className="group relative aspect-video bg-slate-950 rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-400/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300"
                >
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] font-semibold text-white line-clamp-2 leading-tight">
                      {item.title}
                    </p>
                    <p className="text-[9px] text-white/50 truncate mt-1">
                      {item.streamerName}
                    </p>
                  </div>

                  <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wall } */}
        <div className="mt-10">
          <div className="rounded-3xl border border-cyan-500/10 bg-cyan-950/10 backdrop-blur-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Troll Wall</h3>
            </div>
            <div className="h-[350px]">
              <TrollWallFeed onRequireAuth={onRequireAuth} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlassPanel({ size = 'md', children }: { size?: 'sm' | 'md' | 'lg' | 'xl'; children: React.ReactNode }) {
  return (
    <div className={cn(
      "absolute inset-0 glass-panel-premium border border-white/10 rounded-3xl",
      size === 'xl' ? 'p-6 md:p-10' : 'p-4 md:p-6'
    )}>
      {children}
    </div>
  );
}

function AuroraBackground() {
  return (
    <div className="absolute inset-0 -z-20">
      <div className="aurora-bg opacity-40" />
    </div>
  );
}

function FloatingOrb({ delay, left, top, color, size }: { delay: number; left: string; top: string; color: 'cyan' | 'purple' | 'pink'; size: number }) {
  const colorMap = {
    cyan: 'bg-cyan-500/10',
    purple: 'bg-purple-500/10',
    pink: 'bg-pink-500/10',
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{
        y: [-20, -60, -20],
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        delay,
        duration: 8 + delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`absolute rounded-full blur-[80px] ${colorMap[color]}`}
      style={{ left, top, width: size, height: size }}
    />
  );
}
