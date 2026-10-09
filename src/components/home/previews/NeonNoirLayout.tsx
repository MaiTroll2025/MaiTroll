import React from 'react';
import { Eye } from 'lucide-react';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import { useAuthStore } from '@/lib/store';

interface NeonNoirLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function NeonNoirLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: NeonNoirLayoutProps) {
  const { user: _user } = useAuthStore();

  return (
    <div className="relative min-h-[calc(100vh-12rem)] bg-black overflow-hidden">
      {/* Grid pattern background */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Subtle radial glow behind content */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-gradient-radial from-purple-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Minimal header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-black text-white tracking-tighter">
              TC
              <span className="text-purple-400">.</span>
            </span>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest hidden sm:block">
              Underground Broadcast Network
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right hidden sm:block">
              <div className="text-white font-mono">{totalViewers.toLocaleString()}</div>
              <div className="text-white/40 text-[10px] uppercase">Active</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">
              Live Signals
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-2xl font-bold text-white">
                {liveItems.length}
                <span className="text-white/30 text-lg font-normal ml-1">transmissions</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-medium text-white/60 border border-white/10">
              FILTER: <span className="text-white ml-1">ALL</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {liveItems.slice(0, 12).map((item) => (
            <div
              key={item.id}
              onClick={() => onLiveItemClick(item)}
              className="group relative aspect-video bg-slate-950 border border-white/5 hover:border-purple-500/60 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Background - dark gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black">
                {item.streamerAvatar && (
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-all duration-500"
                  />
                )}
              </div>

              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />

              {/* Content - top-left */}
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                {/* Left: Badges + title */}
                <div className="min-w-0 flex-1 mr-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    {item.isBattle && (
                      <span className="px-1.5 py-0.5 bg-yellow-500 text-[8px] font-black text-black rounded">
                        BATTLE
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 bg-red-600 text-[8px] font-bold text-white rounded flex items-center gap-1">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                      LIVE
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50 truncate max-w-[120px]">
                    {item.streamerName}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-white/40">
                    <Eye className="w-3 h-3" />
                    {item.viewerCount}
                  </div>
                </div>
              </div>

              {/* Neon border on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0.4), inset 0 0 20px rgba(56, 189, 248, 0.1)',
                }}
              />

              {/* Subtle shimmer on hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 via-cyan-500/0 to-cyan-500/0 group-hover:via-cyan-500/5 transition-all duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </main>

      {/* Wall feed */}
      <div className="border-t border-white/5 bg-black/30 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h3 className="text-lg font-bold text-white mb-4">Troll Wall</h3>
          <div className="h-[300px] overflow-hidden">
            <TrollWallFeed onRequireAuth={onRequireAuth} />
          </div>
        </div>
      </div>
    </div>
  );
}
