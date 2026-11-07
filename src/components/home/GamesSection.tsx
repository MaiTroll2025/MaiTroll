import { useEffect, useState } from 'react';
import { Gamepad2, ArrowRight, Trophy, Crown, Medal, Sparkles } from 'lucide-react';
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
  {
    id: 'mai-dont-know-game',
    title: 'Mai Dont Know Game',
    description: 'Trivia arena: answer fast, bluff smart, and climb the leaderboard. Solo, quick match, private lobby, and party modes.',
    path: '/mai-dont-know-game',
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

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => navigate(game.path)}
            className="group relative flex min-h-40 w-full items-center gap-4 overflow-hidden rounded-2xl border border-orange-300/20 bg-[#080c1a]/90 p-4 text-left transition hover:border-orange-300/55 hover:shadow-[0_0_28px_rgba(251,146,60,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:gap-5 sm:p-5"
            aria-label={`Play ${game.title}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_50%,rgba(249,115,22,.20),transparent_44%),linear-gradient(110deg,rgba(127,29,29,.12),transparent_60%)]" />
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl border border-orange-300/30 bg-orange-400/10 text-orange-300 shadow-[0_0_24px_rgba(251,146,60,.12)] sm:size-20">
              <game.icon className="size-8 sm:size-9" />
              <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-orange-200/40 bg-[#17101a] text-[10px] font-black text-orange-200">
                1
              </span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[.2em] text-orange-300/80">Arcade game</span>
                <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-200">Ready to play</span>
              </div>
              <h3 className="text-lg font-black text-white sm:text-xl">{game.title}</h3>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-300">{game.description}</p>
            </div>
            <div className="relative flex shrink-0 items-center gap-2 rounded-xl border border-orange-300/25 bg-orange-400/10 px-3 py-2 text-xs font-black text-orange-200 transition group-hover:border-orange-200/60 group-hover:bg-orange-400/20">
              <span className="hidden sm:inline">Play now</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#080c1a]/90 shadow-[0_16px_40px_rgba(0,0,0,.2)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-gradient-to-r from-cyan-900/20 via-transparent to-purple-900/20 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10">
              <Trophy className="size-5 text-amber-300" />
            </span>
            <div>
              <h3 className="text-sm font-black text-white sm:text-base">MaiTroll Run leaderboard</h3>
              <p className="mt-0.5 text-[10px] text-stone-400">Top scores from completed runs</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-bold text-cyan-100/80">
            <Sparkles className="size-3 text-cyan-300" /> ALL-TIME TOP 5
          </span>
        </div>

        <div className="p-3 sm:p-5">
          {loading ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-stone-400">
              <span className="size-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
              Loading rankings…
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
              <Trophy className="mb-2 size-7 text-stone-600" />
              <p className="text-sm font-bold text-stone-200">No finished runs yet</p>
              <p className="mt-1 text-xs text-stone-500">Be the first troll to set a score.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {leaderboard.slice(0, 1).map((entry) => (
                <div key={`${entry.player_name}-${entry.finished_at}-champion`} className="relative flex min-h-44 flex-col justify-between overflow-hidden rounded-xl border border-amber-300/25 bg-[radial-gradient(ellipse_at_80%_0%,rgba(245,158,11,.16),transparent_50%),linear-gradient(135deg,rgba(120,53,15,.20),rgba(8,12,26,.8)_58%)] p-4 sm:p-5">
                  <div className="absolute right-4 top-4 opacity-20"><Crown className="size-12 text-amber-300" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-amber-300 text-stone-950"><Crown className="size-4" /></span>
                      <span className="text-[10px] font-black uppercase tracking-[.2em] text-amber-200">Top troll</span>
                    </div>
                    <p className="mt-4 truncate text-xl font-black text-white">{entry.player_name}</p>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex gap-4 text-[10px] text-stone-300">
                      <span><strong className="block text-sm text-white">{entry.levels_cleared}/8</strong>levels</span>
                      <span><strong className="block text-sm text-white">{entry.letters_collected ?? 0}</strong>letters</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-200/70">Score</span>
                      <span className="font-mono text-xl font-black tabular-nums text-amber-200">{entry.score.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}

              {leaderboard.length > 1 && (
                <div className="space-y-2">
                  {leaderboard.slice(1).map((entry, offset) => {
                    const rank = offset + 2;
                    return (
                      <div key={`${entry.player_name}-${entry.finished_at}-${rank}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-black ${rank === 2 ? 'bg-slate-200/15 text-slate-200' : rank === 3 ? 'bg-orange-300/10 text-orange-200' : 'bg-white/[0.06] text-stone-400'}`}>
                          {rank <= 3 ? <Medal className="size-4" /> : `#${rank}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-stone-100">{entry.player_name}</p>
                          <p className="mt-0.5 text-[10px] text-stone-500">{entry.levels_cleared}/8 levels · {entry.letters_collected ?? 0} letters</p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-cyan-200">{entry.score.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
