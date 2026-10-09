// ============================================================
// State Rankings Page
// ============================================================
// Displays the state battle leaderboard with real-time updates.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, TrendingUp, TrendingDown, Crown, ChevronLeft, Loader2, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { StateLeaderboardEntry } from '@/types/stateBattle';
import { subscribeToStateLeaderboard } from '@/services/stateBattleService';

export default function StateRankings() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<StateLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_state_leaderboard', { p_limit: 51 });
      if (error) throw error;
      setEntries(data ?? []);
    } catch (err) {
      console.error('[StateRankings] Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();

    const channel = subscribeToStateLeaderboard(() => {
      fetchLeaderboard();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-400" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-slate-300" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-slate-500 w-5 text-center">{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-amber-950/60 via-yellow-950/40 to-amber-950/60 border-amber-500/30';
    if (rank === 2) return 'bg-gradient-to-r from-slate-800/60 via-slate-700/40 to-slate-800/60 border-slate-400/20';
    if (rank === 3) return 'bg-gradient-to-r from-amber-900/40 via-orange-900/30 to-amber-900/40 border-amber-600/20';
    return 'bg-slate-900/40 border-slate-700/20';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading state rankings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0814]/95 backdrop-blur-xl border-b border-emerald-500/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-white/5 transition text-slate-400 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-emerald-400" />
            <h1 className="text-lg font-black tracking-wide">State Rankings</h1>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
        {entries.length === 0 && (
          <div className="text-center py-16">
            <Swords className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No state battles yet. Be the first to battle!</p>
          </div>
        )}

        {entries.map((entry) => (
          <button
            key={entry.state_code}
            onClick={() => navigate(`/state/${entry.state_code}`)}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl border p-3 transition-all hover:scale-[1.01] active:scale-[0.99]',
              getRankBg(entry.rank),
            )}
          >
            {/* Rank */}
            <div className="w-8 flex items-center justify-center shrink-0">
              {getRankIcon(entry.rank)}
            </div>

            {/* State info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm truncate">
                  {entry.state_name}
                </span>
                {entry.rank === 1 && (
                  <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                    #1
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <TrendingUp size={10} className="text-emerald-400" />
                  {entry.wins}W
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <TrendingDown size={10} className="text-red-400" />
                  {entry.losses}L
                </span>
                {entry.representative_username && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                    <Crown size={10} className="text-amber-400" />
                    <span className="truncate">{entry.representative_username}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Points */}
            <div className="text-right shrink-0">
              <div className="text-sm font-black text-emerald-300 tabular-nums">
                {entry.battle_points.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">POINTS</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


