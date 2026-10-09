import React, { useMemo } from 'react';
import { Play, Eye, Radio, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import { cn } from '@/lib/utils';

interface SpreadMagazineLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function SpreadMagazineLayout({
  liveItems,
  totalViewers,
  loadingLive: _loadingLive,
  onLiveItemClick,
  onRequireAuth,
}: SpreadMagazineLayoutProps) {
  const { user: _user } = useAuthStore();

  const featured = useMemo(() => liveItems.filter(i => i.isFeatured).slice(0, 2), [liveItems]);
  const battles = useMemo(() => liveItems.filter(i => i.isBattle).slice(0, 4), [liveItems]);
  const _rest = useMemo(() => liveItems.slice(6), [liveItems]);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] bg-black">
      {/* Typographic background watermark */}
      <div className="absolute top-20 left-4 md:left-10 text-[12rem] md:text-[18rem] font-black text-white/[0.02] pointer-events-none select-none leading-none tracking-tighter">
        TC
      </div>

      <div className="relative z-10 px-4 md:px-8 py-6">
        {/* Editorial Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">
              Est. 2026
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
            TROLL
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300">
              CITY
            </span>
          </h1>

          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="px-4 py-2 border border-white/10 rounded-full">
              <span className="text-white/60">Online:</span>{' '}
              <span className="font-bold text-white">{totalViewers.toLocaleString()}</span>
            </div>
            <div className="px-4 py-2 border border-white/10 rounded-full">
              <span className="text-white/60">Broadcasts:</span>{' '}
              <span className="font-bold text-white">{liveItems.length}</span>
            </div>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main editorial column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Featured Lead */}
            {featured[0] && (
              <article
                onClick={() => onLiveItemClick(featured[0])}
                className="group relative overflow-hidden rounded-3xl cursor-pointer"
              >
                <div className="absolute inset-0">
                  {featured[0].streamerAvatar ? (
                    <img
                      src={featured[0].streamerAvatar}
                      alt=""
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-all duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/80 to-slate-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                </div>

                <div className="relative p-8 md:p-10">
                  <div className="absolute top-6 right-6">
                    <span className="px-3 py-1.5 bg-gradient-to-r from-yellow-600 to-amber-600 text-xs font-bold text-white rounded-full border border-yellow-400/30 shadow-lg">
                      ★ FEATURED STORY
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full ring-2 ring-white/30">
                      <img
                        src={featured[0].streamerAvatar || ''}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/80 uppercase tracking-wider">
                        {featured[0].streamerName}
                      </p>
                      <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mt-1">
                        {featured[0].title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-sm text-white/60">
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span className="font-semibold text-white">{featured[0].viewerCount?.toLocaleString()}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-red-400" />
                      <span className="font-semibold text-white">LIVE</span>
                    </span>
                  </div>

                  {/* Read more indicator */}
                  <div className="absolute bottom-6 right-6 flex items-center gap-2 text-sm font-bold text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity">
                    Watch Stream
                    <Play className="w-4 h-4" fill="current" />
                  </div>
                </div>
              </article>
            )}

            {/* Sub-featured grid */}
            {liveItems.length > 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveItems.slice(1, 5).map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => onLiveItemClick(item)}
                    className={cn(
                      "relative group rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1",
                      idx === 0 ? "md:col-span-2 aspect-[21/9]" : "aspect-video"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900">
                      <img
                        src={item.streamerAvatar}
                        alt=""
                        className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-all"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <div className="absolute inset-0 p-5 flex flex-col justify-end">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {item.isBattle && (
                          <span className="px-2 py-0.5 bg-yellow-500/90 text-[8px] font-bold text-black rounded">
                            BATTLE
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-red-600/90 text-[8px] font-bold text-white rounded flex items-center gap-1">
                          <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                          LIVE
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white line-clamp-2 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-white/60">
                        {item.streamerName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Universe Battles Module */}
            {battles.length > 0 && (
              <div className="rounded-3xl border border-yellow-500/20 bg-gradient-to-b from-yellow-900/10 to-transparent p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold text-white">Universe Battles</h3>
                </div>

                <div className="space-y-3">
                  {battles.map(battle => (
                    <div
                      key={battle.id}
                      onClick={() => onLiveItemClick(battle)}
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-yellow-500/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            {battle.title}
                          </h4>
                          <p className="text-xs text-white/50">
                            {battle.streamerName}
                          </p>
                        </div>
                        <span className="text-xs text-yellow-300 font-bold">
                          {battle.battleFormat}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Wall Posts */}
            <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
              <div className="h-[300px] overflow-hidden">
                <TrollWallFeed onRequireAuth={onRequireAuth} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
