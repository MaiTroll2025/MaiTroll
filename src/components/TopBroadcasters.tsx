import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Gift, TrendingUp, Crown } from 'lucide-react';

interface TopBroadcaster {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_gifts: number;
  level?: number;
}

export default function TopBroadcasters() {
  const [broadcasters, setBroadcasters] = useState<TopBroadcaster[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopBroadcasters();
    
    // Rotate every 5 seconds
    const rotateInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(broadcasters.length, 1));
    }, 5000);

    return () => clearInterval(rotateInterval);
  }, [broadcasters.length]);

  const fetchTopBroadcasters = async () => {
    try {
      // Get top 5 broadcasters by gift amount in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('gift_transactions')
        .select('recipient_id, coins_spent', { count: 'exact' })
        .gte('created_at', yesterday.toISOString())
        .order('coins_spent', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Gift transactions not available:', error);
        setLoading(false);
        return;
      }

      // Get user profiles for recipients
      const recipientIds = [...new Set(data?.map((t: any) => t.recipient_id) || [])];
      
      if (recipientIds.length === 0) {
        setBroadcasters([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, level')
        .in('id', recipientIds);

      // Aggregate by user
      const aggregated = new Map<string, TopBroadcaster>();
      
      data?.forEach((transaction: any) => {
        const userId = transaction.recipient_id;
        const profile = profiles?.find((p: any) => p.id === userId);
        const existing = aggregated.get(userId);
        
        if (existing) {
          existing.total_gifts += transaction.coins_spent;
        } else {
          aggregated.set(userId, {
            user_id: userId,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url,
            total_gifts: transaction.coins_spent,
            level: profile?.level
          });
        }
      });

      // Sort and get top 5
      const top = Array.from(aggregated.values())
        .sort((a, b) => b.total_gifts - a.total_gifts)
        .slice(0, 5);

      setBroadcasters(top);
    } catch (error) {
      console.warn('Error fetching top broadcasters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.3)] animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <div className="h-3 bg-slate-700 rounded w-24" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-700 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-2 bg-slate-700 rounded w-20" />
                <div className="h-2 bg-slate-700 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (broadcasters.length === 0) {
    // No overlay on landing page; render nothing when there are no top broadcasters.
    return null;
  }

  const currentBroadcaster = broadcasters[currentIndex];

  return (
    <div className="p-4 bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.3)] space-y-3 animate-float-slow">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <div className="text-xs text-slate-400 font-semibold">TOP GIFTERS (24H)</div>
      </div>

      {/* Featured Broadcaster */}
      <div className="p-3 bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full overflow-hidden border-2 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.4)]">
              {currentBroadcaster.avatar_url ? (
                <img src={currentBroadcaster.avatar_url} alt={currentBroadcaster.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg">
              #{currentIndex + 1}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-white font-bold truncate">{currentBroadcaster.username}</div>
              {currentBroadcaster.level && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-violet-600/80 to-purple-500/80 rounded text-white text-[10px] font-bold">
                  T{currentBroadcaster.level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Gift className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-bold">
                ${currentBroadcaster.total_gifts.toLocaleString()}
              </span>
              <span className="text-slate-400">gifts</span>
            </div>
          </div>

          <TrendingUp className="w-5 h-5 text-green-400 animate-pulse" />
        </div>
      </div>

      {/* Other Top Broadcasters */}
      <div className="space-y-2">
        {broadcasters.filter((_, idx) => idx !== currentIndex).slice(0, 2).map((broadcaster, idx) => (
          <div key={broadcaster.user_id} className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg border border-white/5">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full overflow-hidden border border-white/10">
                {broadcaster.avatar_url ? (
                  <img src={broadcaster.avatar_url} alt={broadcaster.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Crown className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-300">
                #{(currentIndex + idx + 2) % broadcasters.length || broadcasters.length}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white font-semibold truncate">{broadcaster.username}</div>
              <div className="text-[10px] text-slate-400">${broadcaster.total_gifts.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Indicator Dots */}
      <div className="flex justify-center gap-1.5 pt-1">
        {broadcasters.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'bg-amber-400 w-6'
                : 'bg-slate-600 hover:bg-slate-500'
            }`}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          
          .animate-float-slow {
            animation: float-slow 6s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
