import React, { useState } from 'react';
import { Play, Eye, Radio, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store';

interface SwissMinimalLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function SwissMinimalLayout({
  liveItems,
  totalViewers,
  onLiveItemClick,
  onRequireAuth: _onRequireAuth,
}: SwissMinimalLayoutProps) {
  const { user: _user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const featured = liveItems[0];
  const regular = liveItems.slice(1, 7);
  const _grid = liveItems.slice(7, 13);

  return (
    <div className="min-h-[calc(100vh-12rem)] bg-white text-black">
      {/* Swiss minimalist - white background with black type */}
      <div className="relative">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-black" />

        {/* Main content */}
        <div className="relative z-10">
          {/* Header */}
          <header className="border-b-2 border-black px-6 md:px-10 py-6">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 hover:bg-black/5 rounded"
                >
                  <Menu size={20} />
                </button>

                <h1 className="text-xl font-black tracking-tight uppercase">
                  Troll<span className="text-white bg-black px-1">City</span>
                </h1>

                <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                  <span className="text-black/60">Live</span>
                  <span className="text-black/60">Battles</span>
                  <span className="text-black/60">Feed</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm font-mono">
                <div className="text-right">
                  <div className="text-lg font-bold">{totalViewers.toLocaleString()}</div>
                  <div className="text-xs text-black/40 uppercase">Online</div>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden border-b border-black/10 px-6 py-4 bg-white shadow-lg"
              >
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="absolute top-4 right-4"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col gap-3 pt-6">
                  <NavLink>Live Streams</NavLink>
                  <NavLink>Universal Battles</NavLink>
                  <NavLink>Troll Wall</NavLink>
                  <NavLink>Profile</NavLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Featured section */}
          <section className="px-6 md:px-10 py-10">
            {featured && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                {/* Image side */}
                <div
                  onClick={() => onLiveItemClick(featured)}
                  className="relative aspect-video cursor-pointer group"
                >
                  <div className="absolute inset-0 bg-black">
                    <img
                      src={featured.streamerAvatar}
                      alt=""
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                    />
                  </div>

                  {/* Black border overlay */}
                  <div className="absolute inset-4 border-2 border-black/20 pointer-events-none" />

                  {/* Red circle accent */}
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-red-500 rounded-full border-4 border-white" />

                  {/* Live badge */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 bg-black text-white font-bold">
                    <Radio className="w-4 h-4" />
                    LIVE
                  </div>
                </div>

                {/* Text side */}
                <div>
                  <div className="mb-2">
                    <span className="bg-black text-white text-xs font-bold px-3 py-1 uppercase tracking-wider">
                      Featured Broadcast
                    </span>
                  </div>

                  <h2 className="text-4xl md:text-5xl font-black leading-tight mb-4">
                    {featured.title}
                  </h2>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-black text-white font-bold text-lg rounded-full flex items-center justify-center">
                      {featured.streamerName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{featured.streamerName}</p>
                      <p className="text-sm text-black/60">Host</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => onLiveItemClick(featured)}
                      className="border-2 border-black bg-black text-white px-6 py-3 font-bold hover:bg-white hover:text-black transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Play className="w-4 h-4" fill="current" />
                        Watch Live
                      </span>
                    </button>

                    <div className="flex items-center gap-2 px-4 py-3 border border-black/20">
                      <Eye className="w-4 h-4" />
                      <span className="font-mono font-bold">{featured.viewerCount?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Swiss grid */}
          <section className="px-6 md:px-10 pb-10">
            <div className="border-t-2 border-black mb-6 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">
                All Broadcasts
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {regular.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onLiveItemClick(item)}
                    className="group border-2 border-black cursor-pointer hover:bg-black hover:text-white transition-colors"
                  >
                    {/* Image */}
                    <div className="aspect-video bg-black relative overflow-hidden">
                      <img
                        src={item.streamerAvatar}
                        alt=""
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-all"
                      />

                      {/* Corner bracket */}
                      <div className="absolute top-2 right-2 w-3 h-3 bg-red-500" />

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-12 h-12 text-white" fill="white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h4 className="font-bold text-sm leading-tight mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-black/60 group-hover:text-white/60">
                        <span>{item.streamerName}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {item.viewerCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NavLink({ children }: { children: React.ReactNode }) {
  return (
    <a href="#" className="block py-2 border-b border-black/10 font-bold uppercase tracking-wide hover:text-red-600 transition-colors">
      {children}
    </a>
  );
}
