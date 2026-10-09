import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Trophy, Swords, Calendar, Users, Award, PlayCircle, XCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Tournament {
  id: string;
  month_start: string;
  status: string;
  started_at: string;
  completed_at?: string;
  winner_user_id?: string;
  participant_count: number;
  current_round: number;
}

interface Participant {
  user_id: string;
  seed: number;
  status: string;
  username: string;
  wins: number;
  losses: number;
  coins_earned: number;
}

interface TournamentBattle {
  id: string;
  round: number;
  bracket_position: number;
  participant1_username: string;
  participant2_username: string;
  winner_username?: string;
  status: string;
  battle_id?: string;
}

interface WeeklyPayout {
  week_start: string;
  user_id: string;
  rank: number;
  payout_coins: number;
  username: string;
  created_at: string;
}

export default function TrollmersTournament() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [bracket, setBracket] = useState<TournamentBattle[]>([]);
  const [weeklyPayouts, setWeeklyPayouts] = useState<WeeklyPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Check admin/secretary access
  const isAuthorized = profile?.role === 'admin' || profile?.troll_role === 'secretary';

  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
      return;
    }
    fetchTournamentData();
  }, [isAuthorized, navigate]);

  const fetchTournamentData = async () => {
    setLoading(true);
    try {
      // Get active tournament
      const { data: tournamentData } = await supabase.rpc('get_active_trollmers_tournament');
      if (tournamentData && tournamentData.length > 0) {
        setActiveTournament(tournamentData[0]);

        // Get participants
        const { data: participantData } = await supabase
          .from('trollmers_tournament_participants')
          .select(`
            user_id,
            seed,
            status,
            user:user_profiles!trollmers_tournament_participants_user_id_fkey(username)
          `)
          .eq('tournament_id', tournamentData[0].tournament_id)
          .order('seed');

        const participantsWithStats = await Promise.all(
          (participantData || []).map(async (p: any) => {
            // Get this month's stats
            const monthStart = new Date(tournamentData[0].month_start);
            const prevMonthStart = new Date(monthStart);
            prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

            const { data: stats } = await supabase
              .from('trollmers_weekly_leaderboard')
              .select('wins, losses, coins_earned')
              .eq('user_id', p.user_id)
              .gte('week_start', prevMonthStart.toISOString().split('T')[0])
              .lt('week_start', monthStart.toISOString().split('T')[0]);

            const totalWins = stats?.reduce((sum, s) => sum + s.wins, 0) || 0;
            const totalLosses = stats?.reduce((sum, s) => sum + s.losses, 0) || 0;
            const totalCoins = stats?.reduce((sum, s) => sum + s.coins_earned, 0) || 0;

            return {
              user_id: p.user_id,
              seed: p.seed,
              status: p.status,
              username: p.user?.username || 'Unknown',
              wins: totalWins,
              losses: totalLosses,
              coins_earned: totalCoins
            };
          })
        );

        setParticipants(participantsWithStats);

        // Get bracket
        const { data: bracketData } = await supabase
          .from('trollmers_tournament_battles')
          .select(`
            id,
            round,
            bracket_position,
            status,
            battle_id,
            participant1:user_profiles!trollmers_tournament_battles_participant1_id_fkey(username),
            participant2:user_profiles!trollmers_tournament_battles_participant2_id_fkey(username),
            winner:user_profiles!trollmers_tournament_battles_winner_id_fkey(username)
          `)
          .eq('tournament_id', tournamentData[0].tournament_id)
          .order('round')
          .order('bracket_position');

        setBracket((bracketData || []).map((b: any) => ({
          id: b.id,
          round: b.round,
          bracket_position: b.bracket_position,
          participant1_username: b.participant1?.username || 'TBD',
          participant2_username: b.participant2?.username || 'TBD',
          winner_username: b.winner?.username,
          status: b.status,
          battle_id: b.battle_id
        })));
      } else {
        setActiveTournament(null);
      }

      // Get last 10 weekly payouts
      const { data: payoutData, error: payoutError } = await supabase
        .from('trollmers_weekly_payouts')
        .select(`
          week_start,
          user_id,
          rank,
          payout_coins,
          created_at
        `)
        .order('week_start', { ascending: false })
        .order('rank')
        .limit(30);
      if (payoutError) throw payoutError;

      const payoutUserIds = [...new Set((payoutData || []).map((payout) => payout.user_id))];
      const { data: payoutUsers, error: payoutUsersError } = payoutUserIds.length
        ? await supabase
            .from('user_profiles')
            .select('id, username')
            .in('id', payoutUserIds)
        : { data: [], error: null };
      if (payoutUsersError) throw payoutUsersError;
      const payoutUserById = new Map((payoutUsers || []).map((profile) => [profile.id, profile.username]));

      setWeeklyPayouts((payoutData || []).map((p: any) => ({
        week_start: p.week_start,
        user_id: p.user_id,
        rank: p.rank,
        payout_coins: p.payout_coins,
        username: payoutUserById.get(p.user_id) || 'Unknown',
        created_at: p.created_at
      })));

    } catch (error: any) {
      console.error('Error fetching tournament data:', error);
      toast.error('Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTournament = async () => {
    if (!confirm('Start the monthly Trollmers tournament? This will qualify the top 16 players from last month.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_trollmers_monthly_tournament');

      if (error) throw error;

      if (data?.success) {
        toast.success(`Tournament started with ${data.qualifiers} participants!`);
        fetchTournamentData();
      } else {
        toast.error(data?.message || 'Failed to start tournament');
      }
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      toast.error(error.message || 'Failed to start tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelTournament = async () => {
    if (!activeTournament) return;
    if (!confirm('Cancel the active tournament? This cannot be undone.')) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('cancel_trollmers_tournament', {
        p_tournament_id: activeTournament.id
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Tournament cancelled');
        fetchTournamentData();
      } else {
        toast.error('Failed to cancel tournament');
      }
    } catch (error: any) {
      console.error('Error cancelling tournament:', error);
      toast.error(error.message || 'Failed to cancel tournament');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualPayout = async () => {
    if (!confirm('Manually trigger weekly payout? This will pay top 3 Trollmers for the last completed week.')) {
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('payout_trollmers_weekly');

      if (error) throw error;

      if (data?.success) {
        toast.success(`Weekly payout completed! Paid ${data.total_payout} coins`);
        fetchTournamentData();
      } else {
        toast.error(data?.message || 'Failed to process payout');
      }
    } catch (error: any) {
      console.error('Error processing payout:', error);
      toast.error(error.message || 'Failed to process payout');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthorized) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="text-amber-500" size={40} />
            <div>
              <h1 className="text-3xl font-bold">Trollmers Tournament Management</h1>
              <p className="text-gray-400">Weekly leaderboard & monthly championship system</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
          >
            Back to Admin
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleStartTournament}
            disabled={actionLoading || activeTournament?.status === 'active'}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <PlayCircle size={20} />
            Start Monthly Tournament
          </button>
          {activeTournament && (
            <button
              onClick={handleCancelTournament}
              disabled={actionLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <XCircle size={20} />
              Cancel Tournament
            </button>
          )}
          <button
            onClick={handleManualPayout}
            disabled={actionLoading}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Award size={20} />
            Manual Weekly Payout
          </button>
        </div>

        {/* Active Tournament */}
        {activeTournament ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="text-amber-500" />
                Active Tournament
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">Status</div>
                  <div className="text-lg font-bold capitalize">{activeTournament.status}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Month</div>
                  <div className="text-lg font-bold">
                    {new Date(activeTournament.month_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Participants</div>
                  <div className="text-lg font-bold">{activeTournament.participant_count}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Current Round</div>
                  <div className="text-lg font-bold">Round {activeTournament.current_round}</div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="text-blue-400" />
                Qualified Participants
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map((p) => (
                  <div
                    key={p.user_id}
                    className="bg-slate-800/50 border border-white/5 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center font-bold text-amber-400">
                        {p.seed}
                      </div>
                      <div>
                        <div className="font-bold">{p.username}</div>
                        <div className="text-xs text-gray-400">
                          {p.wins}W-{p.losses}L • {p.coins_earned} coins
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      p.status === 'winner' ? 'bg-green-500/20 text-green-400' :
                      p.status === 'eliminated' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {p.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bracket */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Swords className="text-red-400" />
                Tournament Bracket
              </h3>
              <div className="space-y-6">
                {[...new Set(bracket.map(b => b.round))].map((round) => (
                  <div key={round}>
                    <h4 className="text-lg font-bold text-amber-400 mb-3">
                      Round {round} {round === 4 ? '(Finals)' : round === 3 ? '(Semifinals)' : round === 2 ? '(Quarterfinals)' : ''}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bracket.filter(b => b.round === round).map((match) => (
                        <div
                          key={match.id}
                          className={`border rounded-lg p-4 ${
                            match.status === 'completed' ? 'bg-green-900/20 border-green-500/30' :
                            match.status === 'active' ? 'bg-blue-900/20 border-blue-500/30' :
                            'bg-slate-800/50 border-white/10'
                          }`}
                        >
                          <div className="text-xs text-gray-400 mb-2">Match {match.bracket_position}</div>
                          <div className="space-y-2">
                            <div className={`flex items-center justify-between p-2 rounded ${
                              match.winner_username === match.participant1_username ? 'bg-green-500/20' : 'bg-slate-700/30'
                            }`}>
                              <span className="font-bold">{match.participant1_username}</span>
                              {match.winner_username === match.participant1_username && (
                                <Trophy className="text-yellow-400" size={16} />
                              )}
                            </div>
                            <div className="text-center text-gray-500 text-xs">VS</div>
                            <div className={`flex items-center justify-between p-2 rounded ${
                              match.winner_username === match.participant2_username ? 'bg-green-500/20' : 'bg-slate-700/30'
                            }`}>
                              <span className="font-bold">{match.participant2_username}</span>
                              {match.winner_username === match.participant2_username && (
                                <Trophy className="text-yellow-400" size={16} />
                              )}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 capitalize">
                            Status: {match.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-12 text-center">
            <Calendar className="text-gray-500 mx-auto mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Active Tournament</h3>
            <p className="text-gray-500">Click &quot;Start Monthly Tournament&quot; to begin qualification</p>
          </div>
        )}

        {/* Weekly Payouts History */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award className="text-green-400" />
            Weekly Payout History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="pb-2 text-gray-400">Week Start</th>
                  <th className="pb-2 text-gray-400">Rank</th>
                  <th className="pb-2 text-gray-400">User</th>
                  <th className="pb-2 text-gray-400">Payout</th>
                  <th className="pb-2 text-gray-400">Paid At</th>
                </tr>
              </thead>
              <tbody>
                {weeklyPayouts.map((payout, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2">{payout.week_start}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        payout.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        payout.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                        'bg-amber-700/20 text-amber-600'
                      }`}>
                        #{payout.rank}
                      </span>
                    </td>
                    <td className="py-2 font-bold">{payout.username}</td>
                    <td className="py-2 text-green-400 font-bold">{payout.payout_coins} 🪙</td>
                    <td className="py-2 text-sm text-gray-400">
                      {new Date(payout.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
