import React, { useMemo } from 'react';
import { Play, Eye, Radio, Sparkles, Settings, Crown } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import LiveStreamsModule from '@/components/home/LiveStreamsModule';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import FeaturedBroadcasts from '@/components/broadcast/FeaturedBroadcasts';
import { cn } from '@/lib/utils';
import { preloadStreamData, preloadBroadcasterProfile, preloadImage } from '@/lib/streamPreload'

interface SwissMinimal2Props {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

// Alternative: Dashboard Grid Layout
export default function DashboardGridLayout({
  liveItems,
  totalViewers,
  loadingLive,
  onLiveItemClick,
  onRequireAuth,
}: SwissMinimal2Props) {
  const { user } = useAuthStore();

  const featured = useMemo(() => liveItems[0], [liveItems]);
  const leftCol = useMemo(() => liveItems.slice(1, 4), [liveItems]);
  const rightCol = useMemo(() => liveItems.slice(4, 8), [liveItems]);
  const battles = useMemo(() => liveItems.filter(i => i.isBattle).slice(0, 4), [liveItems]);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] bg-[#080808] flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 to-black" />
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[radial-gradient(circle,rgba(147,51,234,0.15),transparent_60%)]" />
      </div>

      {/* Top bar */}
      <header className="shrink-0 border-b border-white/5 px-6 py-4 bg-black/30 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-xl font-bold text-white tracking-tight">
              TROLL<span className="text-purple-400">.</span>CITY
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs">
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10 text-white/50">
                DASHBOARD MODE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-white/40 font-mono">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* Dashboard grid */}
      <div className="flex-1 min-h-0 p-6 grid grid-cols-12 gap-4">
        {/* Left column - Featured + live */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Hero module */}
          {featured && (
            <div
              onClick={() => onLiveItemClick(featured)}
              className="relative group cursor-pointer rounded-2xl overflow-hidden bg-gradient-to-r from-purple-900/40 via-slate-900/80 to-slate-900/40 border border-white/5 hover:border-purple-500/40 transition-all duration-300"
            >
              <img
                src={featured.streamerAvatar}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
              />

              <div className="relative p-6 flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-gradient-to-r from-purple-600/90 to-blue-600/90 text-xs font-bold text-white rounded border border-purple-400/30">
                      FEATURED
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                    {featured.title}
                  </h2>
                  <p className="text-sm text-white/50">
                    by {featured.streamerName}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-white">{featured.viewerCount || 0}</div>
                    <div className="text-[10px] text-white/40 uppercase">viewers</div>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                    <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                  </div>
                </div>
              </div>

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
            </div>
          )}

          {/* Spotlight grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leftCol.map((item, idx) => (
              <StreamCard
                key={item.id}
                item={item}
                onClick={() => onLiveItemClick(item)}
                size="md"
                variant={idx === 0 ? 'highlight' : 'default'}
              />
            ))}
          </div>
        </div>

        {/* Right column - supplementary info */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Battle module */}
          {battles.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-b from-yellow-900/20 to-transparent border border-yellow-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Battles
                </h3>
                <span className="ml-auto text-xs text-yellow-300/60">{battles.length}</span>
              </div>

              <div className="space-y-2">
                {battles.slice(0, 3).map(battle => (
                  <div
                    key={battle.id}
                    onClick={() => onLiveItemClick(battle)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-yellow-500/20 flex items-center justify-center">
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{battle.title}</p>
                      <p className="text-[10px] text-white/50">{battle.streamerName}</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-white/40">
                      {battle.battleFormat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini feed */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <h3 className="text-sm font-bold text-white mb-3">Recent Activity</h3>
            <div className="h-[200px] overflow-hidden">
              <TrollWallFeed onRequireAuth={onRequireAuth} />
            </div>
          </div>
        </div>

        {/* Full-width bottom grid */}
        <div className="col-span-12 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {rightCol.map((item) => (
              <StreamCard
                key={item.id}
                item={item}
                onClick={() => onLiveItemClick(item)}
                size="sm"
                variant="default"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamCard({ item, onClick, size = 'md', variant = 'default' }: any) {
  const handlePointerDown = React.useCallback(async () => {
    if (!item?.id) return
    const data = await preloadStreamData(item.id)
    if (data?.user_id) {
      void preloadBroadcasterProfile(data.user_id)
    }
    if (data?.thumbnail_url) {
      preloadImage(data.thumbnail_url)
    }
    if (data?.poster_url) {
      preloadImage(data.poster_url)
    }
  }, [item?.id])

  const handleMouseEnter = React.useCallback(async () => {
    if (!item?.id) return
    const data = await preloadStreamData(item.id)
    if (data?.thumbnail_url) {
      preloadImage(data.thumbnail_url)
    }
  }, [item?.id])

  return (
    <div
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      className={cn(
        "group relative cursor-pointer rounded-xl overflow-hidden border border-white/5 hover:border-cyan-400/30 transition-all duration-300 hover:-translate-y-0.5",
        size === 'sm' ? 'aspect-video' : 'aspect-video'
      )}
    >
      <img
        src={item.streamerAvatar}
        alt=""
        className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className={cn(
          "font-bold text-white line-clamp-1",
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {item.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className={cn(
            "text-white/50",
            size === 'sm' ? 'text-[9px]' : 'text-xs'
          )}>
            {item.streamerName}
          </span>
          <span className="flex items-center gap-0.5 text-white/40 text-[9px]">
            <Eye className="w-2.5 h-2.5" />
            {item.viewerCount}
          </span>
        </div>
      </div>

      {item.isBattle && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-yellow-500/90 text-[8px] font-bold text-black rounded">
          BATTLE
        </div>
      )}

      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-[8px] font-bold text-white rounded">
        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
        LIVE
      </div>
    </div>
  );
}
