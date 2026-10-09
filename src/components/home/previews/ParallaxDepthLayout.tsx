import React, { useMemo } from 'react';
import { Play, Eye, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import TrollWallFeed from '@/components/home/TrollWallFeed';

interface ParallaxDepthLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function ParallaxDepthLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: ParallaxDepthLayoutProps) {
  const { user: _user } = useAuthStore();

  const featured = useMemo(() => liveItems[0], [liveItems]);
  const secondary = useMemo(() => liveItems.slice(1, 4), [liveItems]);
  const tertiary = useMemo(() => liveItems.slice(4, 10), [liveItems]);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] overflow-hidden">
      {/* Multi-layer parallax backgrounds */}
      <ParallaxLayer speed={0.2}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </ParallaxLayer>

      <ParallaxLayer speed={0.4}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-[120px]" />
      </ParallaxLayer>

      <ParallaxLayer speed={0.6}>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      </ParallaxLayer>

      <ParallaxLayer speed={0.8}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(236,72,153,0.08),transparent_50%)]" />
      </ParallaxLayer>

      {/* Content layers */}
      <div className="relative z-10 px-6 md:px-10">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="pt-8 pb-12"
        >
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
                TROLL
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  CITY
                </span>
              </h1>
              <p className="mt-2 text-sm text-white/50 max-w-md">
                Enter the live social universe. Watch, interact, compete.
              </p>
            </div>

            <div className="hidden md:block text-right">
              <div className="text-3xl font-bold text-white">{totalViewers.toLocaleString()}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider">online now</div>
            </div>
          </div>

          {/* Featured stream carousel */}
          {featured && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative rounded-3xl overflow-hidden cursor-pointer group"
              onClick={() => onLiveItemClick(featured)}
            >
              {/* Card layers */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900" />
                {featured.streamerAvatar && (
                  <img
                    src={featured.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-all duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
              </div>

              {/* Content */}
              <div className="relative p-6 md:p-10">
                <div className="absolute top-6 right-6">
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-600/90 to-pink-600/90 backdrop-blur-md rounded-full text-sm font-bold text-white border border-purple-400/30 shadow-xl">
                    FEATURED
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-end gap-6 pt-10">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-white/10 shadow-2xl group-hover:ring-purple-400/40 transition-all">
                      <img
                        src={featured.streamerAvatar || ''}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-1">
                        {featured.streamerName}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                        {featured.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 ml-auto text-white/60">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-cyan-400" />
                      <span className="font-bold text-white text-lg">{featured.viewerCount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-red-400" />
                      <span className="font-bold text-white">LIVE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-3 border-white/30 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
                  <Play className="w-10 h-10 text-white ml-1" fill="white" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Secondary row (parallax offset) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">
              Trending Now
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondary.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                  onClick={() => onLiveItemClick(item)}
                  className="group relative aspect-video bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-cyan-400/30 transition-all duration-300 hover:-translate-y-1"
                >
                  <img
                    src={item.streamerAvatar}
                    alt=""
                    className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-all"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      {item.isBattle && (
                        <span className="px-2 py-0.5 bg-yellow-500/90 text-[8px] font-black text-black rounded">
                          ⚡ BATTLE
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-red-600 text-[9px] font-bold text-white rounded flex items-center gap-1">
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-white/50">
                        <span>{item.streamerName}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {item.viewerCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tertiary grid */}
          {tertiary.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-8"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {tertiary.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onLiveItemClick(item)}
                    className="group relative aspect-video bg-slate-950 rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-white/20 transition-all"
                  >
                    <img
                      src={item.streamerAvatar}
                      alt=""
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-500"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[10px] font-semibold text-white truncate leading-tight">
                        {item.title}
                      </p>
                    </div>

                    <div className="absolute top-2 right-2 w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Wall feed */}
        <div className="mt-10">
          <div className="h-[300px]">
            <TrollWallFeed onRequireAuth={onRequireAuth} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Parallax Layer helper ─── */
function ParallaxLayer({ children, speed = 1 }: { children: React.ReactNode; speed?: number }) {
  return (
    <motion.div
      initial={{ y: 0 }}
      animate={{ y: [0, 10 * speed, -5 * speed, 0] }}
      transition={{
        duration: 8 + speed * 4,
        repeat: Infinity,
        ease: 'easeInOut',
        repeatDelay: Math.random() * 2,
      }}
    >
      {children}
    </motion.div>
  );
}
