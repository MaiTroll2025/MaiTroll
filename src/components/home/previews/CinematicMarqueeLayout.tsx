import React, { useRef, useState } from 'react';
import { Play, Eye, Radio, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrollWallFeed from '@/components/home/TrollWallFeed';

interface CinematicMarqueeLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function CinematicMarqueeLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth,
}: CinematicMarqueeLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollAmount = container.clientWidth * 0.8;

    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setActiveIndex(prev => Math.min(prev + 1, liveItems.length - 1));
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
      {/* Cinematic gradient overlay */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(147,51,234,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(56,189,248,0.05),transparent_70%)]" />
      </div>

      {/* Header - Minimal */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
            TROLL
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              CITY
            </span>
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{totalViewers.toLocaleString()}</div>
            <div className="text-xs uppercase tracking-wider">Viewers</div>
          </div>
        </div>
      </header>

      {/* Hero Marquee */}
      <div className="relative flex-1 flex items-center">
        {liveItems.length > 0 ? (
          <>
            {/* Left arrow */}
            <button
              onClick={() => scroll('left')}
              className="absolute left-4 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-white/20 hover:border-white/40 text-white flex items-center justify-center transition-all hover:scale-110"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Right arrow */}
            <button
              onClick={() => scroll('right')}
              className="absolute right-4 z-20 w-12 h-12 rounded-full bg-black/50 backdrop-blur border border-white/20 hover:border-white/40 text-white flex items-center justify-center transition-all hover:scale-110"
            >
              <ChevronRight size={24} />
            </button>

            {/* Marquee track */}
            <div
              ref={scrollRef}
              className="flex items-center gap-6 overflow-x-auto scrollbar-hide px-20 py-10 snap-x snap-mandatory"
              style={{ scrollBehavior: 'smooth' }}
            >
              {liveItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onLiveItemClick(item)}
                  className={cn(
                    "flex-shrink-0 relative group rounded-3xl overflow-hidden cursor-pointer transition-all duration-500",
                    idx === activeIndex ? "scale-105 shadow-2xl shadow-purple-500/20" : "scale-95 opacity-60 hover:scale-100 hover:opacity-90",
                    idx === 0 ? "w-[85vw] md:w-[70vw] h-[60vh] md:h-[65vh]" :
                    idx === 1 ? "w-[60vw] md:w-[45vw] h-[50vh] md:h-[55vh]" :
                    "w-[45vw] md:w-[30vw] h-[40vh] md:h-[45vh]"
                  )}
                  style={{ scrollSnapAlign: 'center' }}
                >
                  {/* Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                    {item.streamerAvatar && (
                      <img
                        src={item.streamerAvatar}
                        alt=""
                        className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity"
                      />
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Content - bottom aligned */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                    {item.isBattle && (
                      <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-yellow-600/90 to-orange-600/90 backdrop-blur-md rounded-full text-xs font-bold text-white border border-yellow-400/30">
                        <Sparkles size={12} />
                        UNIVERSAL BATTLE
                      </div>
                    )}

                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 tracking-tight leading-tight">
                      {item.title}
                    </h2>

                    <div className="flex items-center gap-3 text-lg text-white/70">
                      <span className="font-semibold">{item.streamerName}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-cyan-400" />
                        {item.viewerCount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-2 border-white/30 flex items-center justify-center">
                      <Play className="w-10 h-10 text-white ml-1" fill="white" />
                    </div>
                  </div>

                  {/* Live badge */}
                  <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm rounded-full text-xs font-bold text-white">
                    <Radio className="w-3 h-3" />
                    LIVE
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-white/40">
            <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-xl">No live content currently</p>
          </div>
        )}
      </div>

      {/* Wall feed at bottom (collapsed) */}
      <div className="h-64 border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5">
          <span className="text-sm font-bold text-white/80">Latest from the Wall</span>
        </div>
        <div className="h-[calc(100%-48px)] overflow-hidden">
          <TrollWallFeed onRequireAuth={onRequireAuth} />
        </div>
      </div>
    </div>
  );
}
