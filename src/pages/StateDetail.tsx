// ============================================================
// State Detail Page
// ============================================================
// Shows details for a single state: rank, points, wins/losses,
// representative, recent battles.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Trophy, Crown, Swords, TrendingUp, TrendingDown, Loader2, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getStateName } from '@/config/usStates';
import type { StateRow, StateBattleRow, StateLeaderboardEntry } from '@/types/stateBattle';
import { subscribeToStateBattles } from '@/services/stateBattleService';

export default function StateDetail() {
  const navigate = useNavigate();
  const { stateCode } = useParams<{ stateCode: string }>();
  const code = stateCode?.toUpperCase() ?? '';

  const [state, setState] = useState<StateRow | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [recentBattles, setRecentBattles] = useState<StateBattleRow[]>([]);
  const [representativeName, setRepresentativeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!code) return;
    try {
      // Fetch state row
      const { data: stateData } = await supabase
        .from('states')
        .select('*')
        .eq('state_code', code)
        .maybeSingle();
      setState(stateData);

      // Fetch leaderboard to get rank
      const { data: lbData } = await supabase.rpc('get_state_leaderboard', { p_limit: 51 });
      if (lbData) {
        const entry = (lbData as StateLeaderboardEntry[]).find(
          (e: StateLeaderboardEntry) => e.state_code === code
        );
        if (entry) {
          setRank(entry.rank);
          setRepresentativeName(entry.representative_username);
        }
      }

      // Fetch recent battles
      const { data: battles } = await supabase
        .from('state_battles')
        .select('*')
        .or(`state_a.eq.${code},state_b.eq.${code}`)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentBattles(battles ?? []);
    } catch (err) {
      console.error('[StateDetail] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchData();
    if (!code) return;
    const channel = subscribeToStateBattles(code, () => fetchData());
    return () => { supabase.removeChannel(channel); };
  }, [code, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading state details...</span>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">State not found</p>
          <button onClick={() => navigate(-1)} className="text-emerald-400 text-sm mt-2">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const winRate = state.wins + state.losses > 0
    ? Math.round((state.wins / (state.wins + state.losses)) * 100)
    : 0;

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
            <h1 className="text-lg font-black tracking-wide">{state.state_name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Stats Card */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 via-slate-900/50 to-cyan-950/50 p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-emerald-300">
                #{rank ?? '—'}
              </div>
              <div className="text-xs text-slate-400 font-semibold mt-1">RANK</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white tabular-nums">
                {state.battle_points.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 font-semibold mt-1">TOTAL POINTS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400 flex items-center justify-center gap-1">
                <TrendingUp size={16} />
                {state.wins}
              </div>
              <div className="text-xs text-slate-400 font-semibold mt-1">WINS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-400 flex items-center justify-center gap-1">
                <TrendingDown size={16} />
                {state.losses}
              </div>
              <div className="text-xs text-slate-400 font-semibold mt-1">LOSSES</div>
            </div>
          </div>

          {/* Win rate bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Win Rate</span>
              <span className="font-bold text-emerald-300">{winRate}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Representative */}
        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-amber-400/70 font-semibold uppercase tracking-wider">
                State Representative
              </div>
              <div className="text-sm font-bold text-white">
                {representativeName ?? 'No representative yet'}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="rounded-2xl border border-slate-700/30 bg-slate-900/30 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            This Month
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-black text-white tabular-nums">
                {state.monthly_points.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500">Points</div>
            </div>
            <div>
              <div className="text-lg font-black text-emerald-400">{state.monthly_wins}</div>
              <div className="text-[10px] text-slate-500">Wins</div>
            </div>
            <div>
              <div className="text-lg font-black text-red-400">{state.monthly_losses}</div>
              <div className="text-[10px] text-slate-500">Losses</div>
            </div>
          </div>
        </div>

        {/* Recent Battles */}
        <div>
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Swords size={14} className="text-emerald-400" />
            Recent Battles
          </h3>
          {recentBattles.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No battles yet for this state.
            </div>
          ) : (
            <div className="space-y-2">
              {recentBattles.map((battle) => {
                const isStateA = battle.state_a === code;
                const opponentState = isStateA ? battle.state_b : battle.state_a;
                const won = battle.winner_state === code;
                const draw = !battle.winner_state;

                return (
                  <div
                    key={battle.id}
                    className={cn(
                      'flex items-center justify-between rounded-xl border p-3',
                      won
                        ? 'border-emerald-500/20 bg-emerald-950/20'
                        : draw
                        ? 'border-slate-600/20 bg-slate-900/20'
                        : 'border-red-500/20 bg-red-950/20',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{won ? '🏆' : draw ? '🤝' : '💔'}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-300">
                          VS {getStateName(opponentState)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(battle.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          'text-xs font-bold',
                          won ? 'text-emerald-400' : draw ? 'text-slate-400' : 'text-red-400',
                        )}
                      >
                        {won ? 'WIN' : draw ? 'DRAW' : 'LOSS'}
                      </div>
                      {battle.points_awarded > 0 && (
                        <div className="text-[10px] text-slate-500">
                          +{battle.points_awarded} pts
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
