import React, { useMemo } from 'react';
import { Play, Eye, Radio, Sparkles, Gem } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import TrollWallFeed from '@/components/home/TrollWallFeed';

interface DarkCrystallineLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function DarkCrystallineLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: DarkCrystallineLayoutProps) {
  const { user: _user } = useAuthStore();

  const featured = useMemo(() => liveItems.find(i => i.isFeatured) || liveItems[0], [liveItems]);
  const battles = useMemo(() => liveItems.filter(i => i.isBattle).slice(0, 4), [liveItems]);
  const others = useMemo(() => liveItems.slice(1, 7), [liveItems]);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] bg-[#050505] overflow-hidden">
      {/* Crystalline background - geometric patterns */}
      <div className="absolute inset-0 -z-10">
        {/* Large crystal shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 border border-white/5 bg-gradient-to-bl from-purple-900/10 to-transparent clip-path-polygon" />
        <div className="absolute bottom-0 left-0 w-64 h-64 border border-white/5 bg-gradient-to-tr from-cyan-900/10 to-transparent clip-path-polygon rotate-45" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-gradient-to-br from-pink-500/5 to-transparent clip-path-polygon rotate-12" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-8 py-6 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="text-2xl font-black text-white tracking-tighter">
                TROLL
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                  CITY
                </span>
              </div>
              <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-purple-500 to-cyan-500" />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-right hidden md:block">
              <div className="text-xl font-mono font-bold text-white">{totalViewers.toLocaleString()}</div>
              <div className="text-xs text-white/40 uppercase">online</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white text-sm font-bold uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-8 py-8">
        {/* Hero with crystalline accent */}
        <div className="mb-12">
          {featured && (
            <div
              onClick={() => onLiveItemClick(featured)}
              className="group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500"
            >
              {/* Faceted glass background */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <img
                  src={featured.streamerAvatar}
                  alt=""
                  className="w-full h-full object-cover opacity-25 group-hover:opacity-35 transition-all duration-500"
                />
              </div>

              {/* Crystalline overlay */}
              <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity"
                style={{
                  backgroundImage: `
                    linear-gradient(30deg, transparent 40%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.03) 60%, transparent 60%),
                    linear-gradient(-30deg, transparent 40%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.02) 60%, transparent 60%)
                  `,
                  backgroundSize: '100px 100px',
                }}
              />

              {/* Gradient border bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500" />

              <div className="relative p-8 md:p-10">
                {/* Featured badge - top right */}
                <div className="absolute top-6 right-6">
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded text-xs font-bold text-white border border-purple-400/40 shadow-lg shadow-purple-500/20">
                    <span className="flex items-center gap-2">
                      <Gem className="w-3.5 h-3.5" />
                      FEATURED
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex items-start gap-6 max-w-4xl">
                  {/* Large numeric holographic element */}
                  <div className="hidden lg:block absolute right-8 top-8">
                    <div className="text-[8rem] font-black text-white/5 pointer-events-none select-none leading-none">
                      01
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden ring-2 ring-white/10">
                        <img src={featured.streamerAvatar || ''} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-0.5">
                          {featured.streamerName}
                        </p>
                        <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                          {featured.title}
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 text-sm">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono font-bold text-white">{featured.viewerCount?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full">
                        <Radio className="w-4 h-4 text-red-400" />
                        <span className="font-bold text-red-300">LIVE</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
              </div>

              {/* Bottom glow */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-purple-900/40 to-transparent pointer-events-none" />
            </div>
          )}
        </div>

        {/* Battle spotlight */}
        {battles.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Universal Battles
              </h3>
              <span className="text-sm text-white/40">{battles.length} active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {battles.map((battle, idx) => (
                <motion.div
                  key={battle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => onLiveItemClick(battle)}
                  className="relative group rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-yellow-500/50 transition-all duration-300"
                >
                  {/* Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-yellow-900/20 to-slate-900">
                    <img src={battle.streamerAvatar} alt="" className="w-full h-full object-cover opacity-30" />
                  </div>

                  {/* Crystalline faceted pattern overlay */}
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(135deg, transparent 40%, rgba(255,215,0,0.1) 40%, rgba(255,215,0,0.1) 60%, transparent 60%),
                        linear-gradient(-135deg, transparent 40%, rgba(255,215,0,0.1) 40%, rgba(255,215,0,0.1) 60%, transparent 60%)
                      `,
                      backgroundSize: '60px 60px',
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  <div className="relative p-5">
                    <div className="absolute -right-2 -top-2 w-12 h-12 border-l-2 border-t-2 border-yellow-500/50 rounded-tl-xl" />

                    <div className="mb-2">
                      <span className="px-2 py-1 bg-yellow-600 text-xs font-bold text-white inline-block">
                        ⚡ {battle.battleFormat?.toUpperCase()} BATTLE
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white mb-1 line-clamp-2">
                      {battle.title}
                    </h4>
                    <p className="text-sm text-white/50">
                      {battle.streamerName}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-white/40">
                        <Eye className="w-3 h-3" />
                        {battle.viewerCount}
                      </span>
                      <span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border ${
                        battle.battleStatus === 'active' ? 'bg-red-600 text-white border-red-400' :
                        battle.battleStatus === 'ready' ? 'bg-green-600 text-white border-green-400' :
                        'bg-yellow-600 text-black border-yellow-400'
                      }`}>
                        {battle.battleStatus}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Main grid */}
        {others.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4">
              Live Channels
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {others.map((item, _idx) => (
                <div
                  key={item.id}
                  onClick={() => onLiveItemClick(item)}
                  className="group relative aspect-video bg-slate-900/80 rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300"
                >
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
                  />

                  {/* Geometric accent */}
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-bl from-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] font-bold text-white line-clamp-2 leading-tight">
                      {item.title}
                    </p>
                  </div>

                  <div className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full">
                    {item.isBattle && (
                      <span className="absolute -right-1 -top-1 text-[8px]">◆</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wall */}
        <div className="mt-10">
          <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Troll Wall
            </h3>
            <div className="h-[350px]">
              <TrollWallFeed onRequireAuth={onRequireAuth} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
