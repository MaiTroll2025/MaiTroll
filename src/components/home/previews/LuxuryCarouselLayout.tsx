import React, { useRef, useState } from 'react';
import { Play, Eye, Radio, Sparkles, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import TrollWallFeed from '@/components/home/TrollWallFeed';
import { cn } from '@/lib/utils';

interface LuxuryCarouselLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function LuxuryCarouselLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: LuxuryCarouselLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const featured = liveItems.filter(i => i.isFeatured);
  const others = liveItems.filter(i => !i.isFeatured);

  const allItems = [...featured, ...others];

  const scrollTo = (idx: number) => {
    if (!scrollRef.current) return;
    const cardWidth = 360 + 16; // card + gap
    scrollRef.current.scrollTo({
      left: idx * cardWidth - scrollRef.current.clientWidth / 2 + cardWidth / 2,
      behavior: 'smooth',
    });
    setActiveIdx(idx);
  };

  return (
    <div className="relative min-h-[calc(100vh-12rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />

      <div className="absolute top-20 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 right-1/3 w-48 h-48 bg-cyan-500/8 rounded-full blur-[100px]" />

      {/* Branding */}
      <div className="relative z-10 px-8 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-black text-white tracking-tighter">
              TROLL<span className="text-purple-400">.</span>CITY
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white/60">{liveItems.length} live</span>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-8 text-sm">
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-white">{totalViewers.toLocaleString()}</div>
              <div className="text-xs text-white/40">viewers</div>
            </div>
          </div>
        </div>

        {/* Carousel heading */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Live Broadcasts
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Swipe through curated experiences
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative z-10 px-8 pb-8">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allItems.map((item, idx) => (
            <motion.div
              key={item.id}
              layout
              onClick={() => onLiveItemClick(item)}
              className={cn(
                "flex-shrink-0 relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 snap-center",
                idx === activeIdx
                  ? "w-[85vw] md:w-[500px] h-[60vh] md:h-[500px] scale-105 shadow-2xl shadow-purple-500/20"
                  : "w-[80vw] md:w-[400px] h-[55vh] md:h-[420px] scale-95 opacity-80"
              )}
              style={{ scrollSnapAlign: 'center' }}
              whileHover={{ scale: idx === activeIdx ? 1.05 : 1.03 }}
            >
              {/* Card bg */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/90 to-black">
                <img
                  src={item.streamerAvatar}
                  alt=""
                  className="w-full h-full object-cover opacity-25"
                />
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

              {/* Content - bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                {/* Badge */}
                <div className="mb-3">
                  {item.isFeatured && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-600/90 to-amber-600/90 text-xs font-bold text-white rounded-full border border-yellow-400/30 mb-2">
                      <Star className="w-3 h-3 fill-current" />
                      FEATURED
                    </span>
                  )}
                  {item.isBattle && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-600/90 to-pink-600/90 text-xs font-bold text-white rounded-full border border-purple-400/30 ml-2">
                      <Sparkles className="w-3 h-3" />
                      BATTLE
                    </span>
                  )}
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-white mb-1 leading-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-white/60 mb-3">
                  {item.streamerName}
                </p>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-white">{item.viewerCount?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Radio className="w-4 h-4 text-red-400" />
                    <span className="font-semibold text-white">LIVE</span>
                  </div>
                </div>
              </div>

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/40 flex items-center justify-center">
                  <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                </div>
              </div>

              {/* Corner glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-all duration-500" />
            </motion.div>
          ))}
        </div>

        {/* Navigation arrows */}
        {activeIdx > 0 && (
          <button
            onClick={() => scrollTo(activeIdx - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all z-20"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {activeIdx < allItems.length - 1 && (
          <button
            onClick={() => scrollTo(activeIdx + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all z-20"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mt-6">
          {allItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                idx === activeIdx
                  ? "bg-purple-400 w-6"
                  : "bg-white/20 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      </div>

      {/* Wall */}
      <div className="mt-8 border-t border-white/5 bg-black/40">
        <div className="px-8 pt-6">
          <h3 className="text-lg font-bold text-white mb-4">City Pulse</h3>
        </div>
        <div className="h-[300px]">
          <TrollWallFeed onRequireAuth={onRequireAuth} />
        </div>
      </div>
    </div>
  );
}
