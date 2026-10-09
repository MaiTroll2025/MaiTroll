import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Stream } from '@/types/broadcast';
import { Eye, Play, Camera } from 'lucide-react';
import LazyLiveThumbnail from '@/components/broadcast/LazyLiveThumbnail';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

interface FeaturedStream extends Stream {
  user_profiles?: {
    username: string;
    avatar_url: string;
  };
}

export default function FeaturedBroadcasts() {
  const [streams, setStreams] = useState<FeaturedStream[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const fetchFeaturedStreams = async () => {
    try {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          user_id,
          title,
          is_live,
          is_featured,
          featured_at,
          current_viewers,
          thumbnail_url,
          user_profiles:user_profiles!streams_broadcaster_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('is_featured', true)
        .eq('is_live', true)
        .order('featured_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      setStreams((data as any[] as FeaturedStream[]) || []);
    } catch (err) {
      console.error('Error fetching featured streams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeaturedStreams();
    
    // Poll every 30 seconds (reduced from 10s, realtime handles instant updates)
    const interval = setInterval(fetchFeaturedStreams, 30000);
    
    // Subscribe to stream updates
    const channel = supabase
      .channel('featured_streams')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'streams',
        filter: 'is_featured=eq.true'
      }, () => {
        fetchFeaturedStreams();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Handle stream click - navigate to username-based stream URL for SEO
  const handleStreamClick = (streamId: string, username?: string) => {
    if (!user) {
      toast.info('Sign in to watch.')
      navigate('/auth')
      return
    }
    if (username) {
      navigate(`/live/${encodeURIComponent(username)}`);
    } else {
      navigate(`/stream/${streamId}`);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-3">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className="aspect-video bg-slate-900/50 rounded-xl animate-pulse border border-white/5" 
          />
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return null; // Don't show anything if no featured streams
  }

  return (
    <div className="w-full">
      {/* Featured Streams Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded text-xs font-bold text-white">
            FEATURED
          </div>
          <span className="text-xs text-zinc-400">
            Live now
          </span>
        </div>
      </div>

      {/* Featured Streams Grid */}
      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        <div
          onClick={() => {
            if (!user) {
              toast.info('Sign in to start broadcasting.')
              navigate('/auth')
              return
            }
            navigate('/broadcast/setup')
          }}
          className="relative aspect-video bg-gradient-to-br from-red-600/40 via-red-900/30 to-amber-500/20 rounded-xl overflow-hidden border-2 border-red-500/50 cursor-pointer group shadow-[0_0_25px_rgba(239,68,68,0.4),0_0_50px_rgba(250,204,21,0.25)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6),0_0_70px_rgba(250,204,21,0.35)] transition-all hover:scale-[1.02]"
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/10 via-transparent to-amber-400/10" />
          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-amber-400/30" />
          <div className="absolute inset-0 rounded-xl animate-ping bg-red-500/10" style={{ animationDuration: '2s' }} />
          <div className="relative h-full flex flex-col items-center justify-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-amber-400 shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_30px_rgba(250,204,21,0.4)]">
              <Camera className="h-7 w-7 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.4)]" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-white drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">
              Go Live
            </span>
            <span className="text-[9px] font-bold text-white/60">Start Broadcasting</span>
          </div>
        </div>
        {streams.slice(0, 4).map((stream) => {
          return (
            <div
              key={stream.id}
              onClick={() => handleStreamClick(stream.id, stream.user_profiles?.username)}
              className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-pink-500/30 hover:border-pink-500/60 transition-all cursor-pointer group"
            >
              {/* Lazy-loaded live thumbnail with hover preview */}
              <LazyLiveThumbnail
                streamId={stream.id}
                category="broadcast"
                thumbnailUrl={stream.thumbnail_url}
                avatarUrl={stream.user_profiles?.avatar_url}
                title={stream.title}
                isLive={stream.is_live}
                onClick={() => handleStreamClick(stream.id, stream.user_profiles?.username)}
              />

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Featured Badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded text-[10px] font-bold text-white">
                ★ FEATURED
              </div>

              {/* Live Badge */}
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded text-[10px] font-bold text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>

              {/* Host Info - Bottom Left */}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-slate-800">
                  {stream.user_profiles?.avatar_url ? (
                    <img 
                      src={stream.user_profiles.avatar_url} 
                      alt={stream.user_profiles.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
                      <span className="text-white text-xs font-bold">
                        {stream.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold truncate max-w-[80px]">
                    {stream.user_profiles?.username || 'Unknown'}
                  </span>
                  <span className="text-white/60 text-[10px] truncate max-w-[80px]">
                    {stream.title || 'Live Stream'}
                  </span>
                </div>
              </div>

              {/* Viewer Count - Bottom Right */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded text-[10px] font-medium text-white">
                <Eye className="w-3 h-3" />
                {stream.current_viewers || 0}
              </div>

              {/* Play Button - Shows on hover */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleStreamClick(stream.id, stream.user_profiles?.username);
                }}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              </div>

              {/* Tap to watch indicator - Mobile */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none md:hidden">
                <div className="px-3 py-1.5 bg-black/60 rounded-full text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  Tap to watch
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
