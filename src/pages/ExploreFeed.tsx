import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Radio, Play, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MaiTrollTheme } from '../styles/trollCityTheme';
import UserNameWithAge from '../components/UserNameWithAge';
import { toast } from 'sonner';
import { VirtuosoGrid } from 'react-virtuoso';
import useSEO from '@/hooks/useSEO';
import { collectionPageSchema } from '@/utils/seoSchemas';

interface Broadcast {
  id: string;
  broadcaster_id: string;
  title: string;
  category: string;
  viewer_count?: number;
  current_viewers: number;
  started_at: string;
  ended_at?: string
  thumbnail_url?: string
  type: 'stream';
  is_ended?: boolean
  recording_url?: string | null
  user_profiles: {
    username: string;
    avatar_url?: string;
    level?: number;
    created_at?: string;
  };
}

export default function ExploreFeed() {
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'gaming' | 'irl'>('all');

  useSEO({
    title: 'Explore Live Streams | MaiTroll - Watch Trending Content',
    description: 'Explore trending live streams on MaiTroll. Watch gaming, music, podcasts, and more from creators worldwide. Discover viral content and join the community.',
    keywords: [
      'explore live streams', 'trending streams', 'watch live', 'live streaming',
      'gaming streams', 'podcast streams', 'music streams', 'viral content',
      'content discovery', 'live broadcasts', 'streaming platform', 'MaiTroll explore'
    ],
    structuredData: collectionPageSchema({
      name: 'Live Streams on MaiTroll',
      description: 'Discover and watch trending live streams from creators worldwide',
      url: 'https://www.maitroll.com/explore'
    })
  });

  // Auto-scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [_page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  const fetchBroadcasts = useCallback(async (targetPage: number, isLoadMore?: boolean) => {
    // Thundering Herd Prevention: Add random jitter to fetch (0-500ms)
    // This prevents 100k users from hitting the DB at the exact same millisecond on route enter
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

    try {
      if (targetPage === 0) setLoading(true);
      const from = targetPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // 1. Fetch Streams
      let query = supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          current_viewers,
          viewer_count,
          is_live,
          is_featured,
          broadcaster_id,
          battle_mode,
          battle_format
        `, { count: 'exact' })
        .eq('is_live', true)
        .order('current_viewers', { ascending: false })
        .range(from, to);

      if (filter !== 'all') {
        // If filter is podcast, we might still want streams categorized as podcast
        query = query.eq('category', filter);
      }

      const { data: streamsData, error: streamsError, count } = await query;
      if (streamsError) throw streamsError;

      // Fetch broadcaster info separately
      const streamsWithBroadcasters: any[] = [];
      if (streamsData && streamsData.length > 0) {
        const broadcasterIds = Array.from(new Set(streamsData.map((s: any) => s.broadcaster_id).filter(Boolean)))
        let broadcasterMap = new Map<string, any>()
        
        if (broadcasterIds.length > 0) {
          const { data: broadcasters } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, level, created_at')
            .in('id', broadcasterIds)
          
          if (broadcasters) {
            broadcasterMap = new Map(broadcasters.map((b: any) => [b.id, b]))
          }
        }

        streamsWithBroadcasters.push(...(streamsData || []).map((stream: any) => ({
          ...stream,
          user_profiles: broadcasterMap.get(stream.broadcaster_id)
        })))
      }

      const formattedStreams: Broadcast[] = (streamsWithBroadcasters || []).map(stream => ({
        ...stream,
        type: 'stream'
      }));

      // 2. If no live streams on first page, fetch recent ended streams as VOD suggestions
      let endedStreams: Broadcast[] = [];
      if (targetPage === 0 && formattedStreams.length === 0) {
        const { data: endedData, error: endedError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            category,
            viewer_count,
            current_viewers,
            is_live,
            is_featured,
            broadcaster_id,
            battle_mode,
            battle_format,
            ended_at,
            started_at,
            recording_url
          `)
          .eq('status', 'ended')
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(20);

        if (!endedError && endedData && endedData.length > 0) {
          const endedBroadcasterIds = Array.from(new Set(endedData.map((s: any) => s.broadcaster_id).filter(Boolean)))
          let endedBroadcasterMap = new Map<string, any>()

          if (endedBroadcasterIds.length > 0) {
            const { data: endedBroadcasters } = await supabase
              .from('user_profiles')
              .select('id, username, avatar_url, level, created_at')
              .in('id', endedBroadcasterIds)

            if (endedBroadcasters) {
              endedBroadcasterMap = new Map(endedBroadcasters.map((b: any) => [b.id, b]))
            }
          }

          endedStreams = (endedData || []).map((stream: any) => ({
            ...stream,
            type: 'stream' as const,
            user_profiles: endedBroadcasterMap.get(stream.broadcaster_id),
            is_ended: true
          }));
        }
      }

      // Combine results — live streams first, then ended streams
      const newBroadcasts = [...formattedStreams, ...endedStreams];

      if (isLoadMore) {
        setBroadcasts(prev => [...prev, ...newBroadcasts]);
        setPage(targetPage);
      } else {
        setBroadcasts(newBroadcasts);
        setPage(0);
      }

      // Check if we reached the end (based on streams count mostly, as pods are all fetched at once)
      if (count !== null) {
        setHasMore(to < count);
      } else {
        setHasMore((streamsData?.length || 0) === ITEMS_PER_PAGE);
      }

    } catch (error: any) {
      console.error('Error fetching broadcasts:', error);
      toast.error('Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial load
  useEffect(() => {
    fetchBroadcasts(0, false);
    
    // Polling every 60s as a fallback - resets list to keep "Top" fresh
    const interval = setInterval(() => {
       if (document.hidden) return;
       if (window.scrollY < 500) {
         fetchBroadcasts(0, false);
       }
    }, 60000);

    // Real-time subscription for live status changes
    const streamsChannel = supabase.channel('explore_streams')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: 'is_live=eq.true',
        },
        () => {
          // Only refresh when live streams change (not ended/inserted)
          if (window.scrollY < 500) {
            fetchBroadcasts(0, false);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      if (streamsChannel) {
        supabase.removeChannel(streamsChannel);
      }
    };
  }, [filter, fetchBroadcasts]);

  const getTimeSince = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleBroadcastClick = (broadcast: Broadcast) => {
    if (broadcast.is_ended) {
                        navigate(`/replay/id/${broadcast.id}`, { state: { fromExplore: true } });
    } else {
      navigate(`/watch/${broadcast.id}`, { state: { fromExplore: true } });
    }
  };

  return (
    <div className={`min-h-screen w-full ${MaiTrollTheme.backgrounds.primary} relative overflow-x-hidden`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none max-md:hidden">
        {useMemo(() => Array.from({ length: 10 }).map((_, i) => {
          const seed = i * 137.508;
          const left = ((seed * 7.31) % 100);
          const top = ((seed * 13.17) % 100);
          const duration = 5 + (i % 5) * 2;
          const delay = (i % 5);
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animation: `float-particle ${duration}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        }), [])}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div>
            <h1 className={`text-4xl md:text-5xl font-black ${MaiTrollTheme.text.gradient} mb-2`}>
              Explore Live Streams
            </h1>
            <p className={`text-lg ${MaiTrollTheme.text.secondary}`}>
              Discover amazing live content from creators around Mai Troll
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {['all', 'irl'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat as typeof filter)}
                className={`px-6 py-3 rounded-xl font-semibold capitalize transition-all duration-300 ${
                  filter === cat
                    ? `${MaiTrollTheme.gradients.primary} text-white ${MaiTrollTheme.shadows.glow}`
                    : `${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} ${MaiTrollTheme.text.secondary} hover:border-purple-500/30`
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stats Bar */}
          <div className={`flex flex-wrap items-center gap-6 p-4 ${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className={MaiTrollTheme.text.primary}>
                <span className="font-bold">{broadcasts.filter(b => !b.is_ended).length}</span> Live Now
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className={MaiTrollTheme.text.secondary}>
                {broadcasts.reduce((sum, b) => sum + (b.current_viewers || b.viewer_count || 0), 0).toLocaleString()} Total Viewers
              </span>
            </div>
            {broadcasts.some(b => b.is_ended) && (
              <>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-purple-400" />
                  <span className={MaiTrollTheme.text.secondary}>
                    <span className="font-bold">{broadcasts.filter(b => b.is_ended).length}</span> Replays Available
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Broadcasts Grid */}
        {loading && broadcasts.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl overflow-hidden animate-pulse`}>
                <div className="aspect-video bg-slate-800/50" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-800/50 rounded" />
                  <div className="h-3 bg-slate-800/50 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : broadcasts.length === 0 ? (
          <div className={`text-center py-20 ${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-3xl`}>
            <Radio className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className={`text-2xl font-bold ${MaiTrollTheme.text.primary} mb-2`}>No one is live right now</h3>
            <p className={MaiTrollTheme.text.muted}>Check back later to see who is streaming, or browse past broadcasts below.</p>
          </div>
        ) : (
          <VirtuosoGrid
            useWindowScroll
            data={broadcasts}
            listClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            itemContent={(index, broadcast) => (
              <div
                key={broadcast.id}
                onClick={() => handleBroadcastClick(broadcast)}
                className={`group cursor-pointer ${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl overflow-hidden ${MaiTrollTheme.interactive.hover} ${MaiTrollTheme.borders.glassHover} ${MaiTrollTheme.shadows.card}`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 overflow-hidden">
                  {broadcast.thumbnail_url ? (
                    <img
                      src={broadcast.thumbnail_url}
                      alt={broadcast.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-16 h-16 text-white/30" />
                    </div>
                  )}
                  
                  {/* Live Badge or Replay Badge */}
                  {broadcast.is_ended ? (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-purple-600/90 backdrop-blur-sm rounded-full shadow-lg">
                      <Play className="w-3 h-3 text-white" fill="white" />
                      <span className="text-white font-bold text-xs uppercase">Replay</span>
                    </div>
                  ) : (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm rounded-full shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="text-white font-bold text-xs uppercase">Live</span>
                    </div>
                  )}

                  {/* Viewer Count */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                    <Eye className="w-3 h-3 text-white" />
                    <span className="text-white font-semibold text-xs">
                      {(broadcast.current_viewers || broadcast.viewer_count || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Hover Play Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className={`w-16 h-16 ${MaiTrollTheme.gradients.primary} rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform`}>
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  {/* Streamer Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 flex-shrink-0 overflow-hidden border-2 border-white/10">
                      {broadcast.user_profiles?.avatar_url ? (
                        <img src={broadcast.user_profiles.avatar_url} alt={broadcast.user_profiles.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${MaiTrollTheme.text.primary} truncate`}>
                        <UserNameWithAge 
                          user={{
                            username: broadcast.user_profiles?.username || 'Unknown',
                            id: broadcast.broadcaster_id,
                            ...broadcast.user_profiles
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {broadcast.user_profiles?.level && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-violet-600 to-purple-500 rounded text-white font-bold text-xs">
                            T League
                          </span>
                        )}
                        <span className={MaiTrollTheme.text.muted}>
                          {getTimeSince(broadcast.started_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`font-bold ${MaiTrollTheme.text.primary} line-clamp-2 group-hover:text-cyan-400 transition-colors`}>
                     {broadcast.title || 'Untitled Stream'}
                  </h3>

                  {/* Category */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-full ${MaiTrollTheme.text.muted} capitalize`}>
                      {broadcast.category}
                    </span>
                  </div>
                </div>
              </div>
            )}
          />
        )}

        {/* Load More Button */}
        {hasMore && !loading && broadcasts.length > 0 && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => fetchBroadcasts(_page + 1, true)}
              className={`px-8 py-3 rounded-xl font-bold text-white ${MaiTrollTheme.gradients.primary} ${MaiTrollTheme.shadows.glow} hover:scale-105 transition-transform duration-300`}
            >
              Load More Streams
            </button>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
        `}
      </style>
    </div>
  );
}
