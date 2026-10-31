import { useEffect, useState } from 'react';
import { Gamepad2, ArrowRight, Trophy, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

interface GameEntry {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
}

const GAMES: GameEntry[] = [
  {
    id: 'maitroll-run',
    title: 'MaiTroll Run',
    description: 'Auto-runner: tap to jump, swipe down to crouch. Collect MAITROLL letters across eight realms. Costs real Troll Coins per run.',
    path: '/mai-troll-run',
    icon: Gamepad2,
  },
];

interface LeaderboardEntry {
  player_name: string;
  score: number;
  levels_cleared: number;
  letters_collected?: number;
  finished_at?: string;
}

export default function GamesSection() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const balance = Number(profile?.troll_coins ?? 0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('mai_run_leaderboard', { p_limit: 5 });
        if (!active) return;
        if (error) {
          setLeaderboard([]);
        } else {
          setLeaderboard((data || []).map((r: any) => ({
            player_name: String(r.player_name || 'Troll'),
            score: Number(r.score ?? 0),
            levels_cleared: Number(r.levels_cleared ?? 0),
            letters_collected: r.letters_collected,
            finished_at: r.finished_at,
          })));
        }
      } catch {
        if (!active) return;
        setLeaderboard([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-900/20 via-[#080c1a]/40 to-purple-900/20 p-3">
        <Gamepad2 className="h-5 w-5 text-orange-400" />
        <h2 className="text-sm font-black tracking-wider text-white">Mai Troll Games</h2>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          {balance} troll_coins
        </span>
      </div>

      <p className="mb-3 text-[10px] font-semibold text-stone-400">Games are public but not fully done — playable preview only.</p>

      <div className="grid gap-4 justify-center sm:grid-cols-2 lg:grid-cols-3 max-w-[560px] mx-auto">
        {GAMES.map((game) => (
          <button
            key={game.id}
            onClick={() => navigate(game.path)}
            className={`group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#080c1a]/90 text-left transition-all hover:border-orange-400/30 hover:shadow-[0_0_24px_rgba(251,146,60,0.12)] w-[170px] h-[170px] flex-shrink-0`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/20 via-[#080c1a] to-red-900/20 opacity-60" />
            <div className="relative z-10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <game.icon className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-bold text-orange-300/70 uppercase tracking-wider">Game</span>
              </div>
              <h3 className="text-base font-black text-white">{game.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-stone-300 line-clamp-3">{game.description}</p>
              <div className="mt-auto pt-3 flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-300">Play now</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#080c1a]/90 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-black text-white">Games Leaderboard</h3>
          </div>
          {leaderboard.length > 0 && <Crown className="h-3 w-3 text-yellow-400 animate-pulse" />}
        </div>
        {loading ? (
          <p className="text-[11px] text-stone-400">Loading rankings…</p>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center text-stone-500">
            <Trophy className="h-6 w-6 text-stone-700/50" />
            <p className="text-xs font-bold">No finished runs yet</p>
            <p className="text-[10px]">Be the first troll on the board.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={`${entry.player_name}-${entry.finished_at}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/3 p-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-black text-[10px] ${
                    i === 0 ? 'bg-amber-500 text-stone-950' : 'bg-white/10 text-stone-400'
                  }`}>#{i + 1}</span>
                  <span className="truncate text-[11px] font-bold text-stone-200">{entry.player_name}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-[10px] font-mono font-bold text-amber-300">{entry.score.toLocaleString()}</span>
                  <span className="text-[10px] text-stone-500">{entry.levels_cleared}/8 lvls</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
