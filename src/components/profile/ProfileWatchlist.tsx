import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Gavel, Heart, Calendar, Loader2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { MaiTrollTheme } from '../../styles/trollCityTheme';

interface WatchlistShow {
  id: string;
  auction_show_id: string;
  created_at: string;
  auction_shows: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    thumbnail_url: string | null;
    status: string;
    scheduled_for: string | null;
    live_started_at: string | null;
  };
}

interface ProfileWatchlistProps {
  userId: string;
}

export default function ProfileWatchlist({ userId }: ProfileWatchlistProps) {
  const { profile: currentUser } = useAuthStore();
  const [watchlistItems, setWatchlistItems] = useState<WatchlistShow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('auction_watchlist')
        .select(`
          id,
          auction_show_id,
          created_at,
          auction_shows (
            id,
            title,
            description,
            category,
            thumbnail_url,
            status,
            scheduled_for,
            live_started_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (data || []).filter((item: any) => item.auction_shows);
      setWatchlistItems(items as unknown as WatchlistShow[]);
    } catch (err) {
      console.error('[ProfileWatchlist] Error fetching watchlist:', err);
      toast.error('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchWatchlist();
  }, [userId, fetchWatchlist]);

  const handleRemove = async (auctionShowId: string, watchlistId: string) => {
    try {
      const { error } = await supabase
        .from('auction_watchlist')
        .delete()
        .eq('id', watchlistId);

      if (error) throw error;

      setWatchlistItems((prev) => prev.filter((item) => item.id !== watchlistId));
      toast.success('Removed from watchlist');
    } catch (err) {
      console.error('[ProfileWatchlist] Error removing:', err);
      toast.error('Failed to remove from watchlist');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live':
        return { label: 'Live Now', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
      case 'scheduled':
        return { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'ended':
        return { label: 'Ended', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      default:
        return { label: status, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading watchlist...</span>
      </div>
    );
  }

  if (watchlistItems.length === 0) {
    return (
      <div className={`text-center py-12 ${MaiTrollTheme.backgrounds.card} rounded-xl border border-white/10`}>
        <div className="text-4xl mb-3">🔖</div>
        <h3 className="text-lg font-bold text-white mb-2">No Watchlisted Auctions</h3>
        <p className="text-gray-400">Add auctions to your watchlist to track them here!</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-white">
          <Heart className="inline h-5 w-5 text-red-400 mr-2" />
          Watchlisted Auctions ({watchlistItems.length})
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlistItems.map((item) => {
          const show = item.auction_shows;
          const statusInfo = getStatusLabel(show.status);

          return (
            <div
              key={item.id}
              className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all group`}
            >
              <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-cyan-900 overflow-hidden">
                {show.thumbnail_url ? (
                  <img
                    src={show.thumbnail_url}
                    alt={show.title || 'Auction'}
                    className="w-full h-full object-cover transition group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gavel className="h-16 w-16 text-white/20" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className={`text-xs px-2 py-1 rounded-lg border font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-current" />
                    Watchlisted
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-white text-sm line-clamp-2 mb-1" title={show.title}>
                  {show.title || 'Untitled Auction'}
                </h3>

                {show.category && (
                  <span className="inline-block text-xs px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded-lg mb-2">
                    {show.category}
                  </span>
                )}

                <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                  <Calendar className="w-3 h-3" />
                  Added {formatDate(item.created_at)}
                </div>

                {show.scheduled_for && show.status === 'scheduled' && (
                  <div className="flex items-center gap-1 text-xs text-blue-400 mt-1">
                    <Calendar className="w-3 h-3" />
                    Scheduled: {formatDate(show.scheduled_for)}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <a
                    href={`/auction/${show.id}`}
                    className="flex-1 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View Auction
                  </a>
                  {isOwnProfile && (
                    <button
                      onClick={() => handleRemove(show.id, item.id)}
                      className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
