import { useEffect, useState } from 'react';
import { DIFFICULTIES } from '@/components/games/MaiTrollRun/game/config';
import { fetchLeaderboard, type LeaderboardEntry } from '@/components/games/MaiTrollRun/lib/trollApi';

interface LeaderboardScreenProps {
  onBack: () => void;
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchLeaderboard(10)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the leaderboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-stone-800 bg-stone-900/80 p-6 shadow-2xl sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Hall of trolls</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-stone-50">Leaderboard</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-stone-700 px-4 py-2 text-sm text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
        >
          Back
        </button>
      </div>

      {entries === null && !error && <p className="mt-8 text-sm text-stone-400">Loading rankings...</p>}

      {error && (
        <div className="mt-8 flex flex-col items-start gap-3">
          <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="rounded-full border border-stone-600 px-4 py-1.5 text-sm text-stone-200 hover:border-amber-400"
          >
            Try again
          </button>
        </div>
      )}

      {entries && entries.length === 0 && (
        <p className="mt-8 text-sm text-stone-400">No finished runs yet. Be the first troll on the board.</p>
      )}

      {entries && entries.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.15em] text-stone-500">
              <tr>
                <th className="pb-3 pr-3 font-semibold">#</th>
                <th className="pb-3 pr-3 font-semibold">Troll</th>
                <th className="pb-3 pr-3 font-semibold">Difficulty</th>
                <th className="pb-3 pr-3 text-right font-semibold">Levels</th>
                <th className="pb-3 pr-3 text-right font-semibold">Letters</th>
                <th className="pb-3 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={`${entry.playerName}-${entry.finishedAt}-${index}`}
                  className="border-t border-stone-800 text-stone-200 transition hover:bg-stone-800/40"
                >
                  <td className="py-3 pr-3 font-mono text-stone-400">{index + 1}</td>
                  <td className="py-3 pr-3">
                    <span className="font-semibold text-stone-100">{entry.playerName}</span>
                    <span className="ml-2 text-xs capitalize text-stone-500">{entry.gender}</span>
                  </td>
                  <td className="py-3 pr-3">{DIFFICULTIES[entry.difficulty]?.label ?? entry.difficulty}</td>
                  <td className="py-3 pr-3 text-right font-mono">{entry.levelsCleared}</td>
                  <td className="py-3 pr-3 text-right font-mono">{entry.lettersCollected}</td>
                  <td className="py-3 text-right font-mono font-semibold text-amber-300">
                    {entry.score.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
