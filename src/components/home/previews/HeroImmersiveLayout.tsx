import React, { useMemo } from 'react';
import { Play, Eye, Radio, Users, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import TrollWallFeed from '@/components/home/TrollWallFeed';

interface HeroImmersiveLayoutProps {
  liveItems: any[];
  totalViewers: number;
  loadingLive: boolean;
  onLiveItemClick: (item: any) => void;
  onRequireAuth: (intent?: string) => boolean;
}

export default function HeroImmersiveLayout({
  liveItems,
  totalViewers: _totalViewers,
  loadingLive: _loadingLive,
  onLiveItemClick,
  onRequireAuth,
}: HeroImmersiveLayoutProps) {
  const { user: _user } = useAuthStore();

  const featuredStream = useMemo(() =>
    liveItems.find(item => item.isFeatured) || liveItems[0],
    [liveItems]
  );

  const otherStreams = useMemo(() =>
    liveItems.filter(item => item.id !== featuredStream?.id).slice(0, 6),
    [liveItems, featuredStream]
  );

  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex flex-col">
      {/* Ambient background blurs */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-[90px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Hero Section - Single Featured Stream */}
      {featuredStream && (
        <div className="relative w-full aspect-[21/9] md:aspect-[18/7] mb-8 group">
          <div
            onClick={() => onLiveItemClick(featuredStream)}
            className="absolute inset-0 rounded-3xl overflow-hidden cursor-pointer shadow-2xl hover:shadow-purple-500/20 transition-all duration-500"
          >
            {/* Background image with gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
              {featuredStream.streamerAvatar && (
                <img
                  src={featuredStream.streamerAvatar}
                  alt=""
                  className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-700"
                />
              )}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Floating decorative elements */}
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <div className="px-3 py-1 bg-gradient-to-r from-yellow-600/90 to-amber-600/90 backdrop-blur-md rounded-full text-xs font-bold text-white border border-yellow-400/30 shadow-lg">
                ⭐ FEATURED
              </div>
            </div>

            {/* Main content - bottom left */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  {/* Streamer avatar + name */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 ring-purple-400/50 shadow-lg">
                        {featuredStream.streamerAvatar ? (
                          <img src={featuredStream.streamerAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center">
                            <Users className="w-6 h-6 text-white/50" />
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-600 rounded-full border-2 border-slate-900 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-4xl font-bold text-white mb-1 tracking-tight">
                        {featuredStream.title || 'Live Experience'}
                      </h2>
                      <p className="text-lg text-purple-300 font-medium">
                        {featuredStream.streamerName}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 text-sm text-white/60">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span className="font-semibold text-white">{featuredStream.viewerCount?.toLocaleString() || '0'}</span>
                      <span className="text-white/40">watching</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-red-400" />
                      <span className="font-semibold text-white">LIVE</span>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <button className="hidden md:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600/90 to-pink-600/90 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-full shadow-lg hover:shadow-purple-500/40 transition-all transform hover:scale-105 backdrop-blur-sm border border-purple-400/30">
                  <Play className="w-5 h-5" fill="white" />
                  Watch Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border-2 border-white/30">
                <Play className="w-10 h-10 text-white ml-1" fill="white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Grid */}
      {otherStreams.length > 0 && (
        <div className="px-6 md:px-10 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Live Now
              </span>
            </h3>
            <span className="text-sm text-white/40">{otherStreams.length} streams</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {otherStreams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => onLiveItemClick(stream)}
                className="relative aspect-video bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl overflow-hidden cursor-pointer group hover:ring-2 hover:ring-cyan-400/50 transition-all duration-300 hover:-translate-y-1"
              >
                <img
                  src={stream.streamerAvatar || `https://ui-avatars.com/api/?name=${stream.streamerName}&background=random`}
                  alt=""
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Live indicator */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-600/90 backdrop-blur-sm rounded text-[9px] font-bold text-white">
                  <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>

                {/* Viewer count */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] font-medium text-white">
                  <Eye className="w-2.5 h-2.5" />
                  {stream.viewerCount || 0}
                </div>

                {/* Title + streamer */}
                <div className="absolute bottom-2 left-2 right-8 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{stream.title}</p>
                  <p className="text-[9px] text-white/60 truncate">{stream.streamerName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wall Feed */}
      <div className="flex-1 min-h-0 px-6 md:px-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <h3 className="text-lg font-bold text-white">Troll Wall</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        <div className="h-[calc(100vh-32rem)] min-h-[400px]">
          <TrollWallFeed onRequireAuth={onRequireAuth} />
        </div>
      </div>
    </div>
  );
}
