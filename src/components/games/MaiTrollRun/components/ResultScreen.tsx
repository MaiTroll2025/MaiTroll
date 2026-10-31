import { useEffect, useRef, useState } from 'react';
import { DIFFICULTIES } from '@/components/games/MaiTrollRun/game/config';
import { finishRun, type ActiveRun } from '@/components/games/MaiTrollRun/lib/trollApi';
import type { RunSummary } from '@/components/games/MaiTrollRun/game/types';

interface ResultScreenProps {
  run: ActiveRun;
  summary: RunSummary;
  playerId: string;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
}

type Settlement =
  | { status: 'saving' }
  | { status: 'saved'; balance: number }
  | { status: 'error'; message: string };

const HEADLINES: Record<RunSummary['outcome'], { title: string; body: string }> = {
  won: { title: 'MAITROLL is complete', body: 'You claimed every letter and conquered the throne.' },
  escaped: { title: 'You escaped the realms', body: 'Every level cleared, but not every letter was yours.' },
  dead: { title: 'The realm claimed you', body: 'Another attempt will be sharper. Run it back.' },
};

export function ResultScreen({
  run,
  summary,
  playerId,
  onPlayAgain,
  onOpenLeaderboard,
}: ResultScreenProps) {
  const [settlement, setSettlement] = useState<Settlement>({ status: 'saving' });
  const [attempt, setAttempt] = useState(0);
  const settledRef = useRef(false);

  useEffect(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setSettlement({ status: 'saving' });
    finishRun({
      runId: run.runId,
      playerId,
      score: summary.score,
      levelsCleared: summary.levelsCleared,
      lettersCollected: summary.lettersCollected,
      coins: summary.coins,
    })
      .then((result) => {
        setSettlement({ status: 'saved', balance: result.balance });
      })
      .catch((err: unknown) => {
        setSettlement({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not save this run.',
        });
      });
  }, [attempt, playerId, run.runId, summary]);

  const headline = HEADLINES[summary.outcome];

  const retry = () => {
    settledRef.current = false;
    setAttempt((value) => value + 1);
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-stone-800 bg-stone-900/80 p-8 text-center shadow-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-amber-400">{DIFFICULTIES[run.difficulty].label} run</p>
      <h2 className="mt-3 font-serif text-3xl font-bold text-stone-50">{headline.title}</h2>
      <p className="mt-2 text-sm text-stone-400">{headline.body}</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={summary.score.toLocaleString()} />
        <Stat label="Levels" value={`${summary.levelsCleared} / 8`} />
        <Stat label="Letters" value={`${summary.lettersCollected} / 8`} />
        <Stat label="Game coins collected" value={String(summary.coins)} />
      </dl>

      <div className="mt-8 rounded-xl bg-stone-950 px-5 py-4">
        {settlement.status === 'saving' && <p className="text-sm text-stone-400">Saving your run...</p>}
        {settlement.status === 'saved' && (
          <p className="text-sm text-stone-200">
            Troll Coins balance (no unverified winnings paid): <span className="font-mono text-lg font-bold text-amber-300">{settlement.balance}</span>{' '}
            troll_coins
          </p>
        )}
        {settlement.status === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="text-sm text-red-300">
              {settlement.message}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-stone-600 px-4 py-1.5 text-sm text-stone-200 hover:border-amber-400"
            >
              Try saving again
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onPlayAgain}
          className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-stone-950 transition hover:bg-amber-300"
        >
          Run again
        </button>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="rounded-xl border border-stone-700 px-6 py-3 font-semibold text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
        >
          View leaderboard
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-950 px-3 py-3">
      <dt className="text-[11px] uppercase tracking-[0.15em] text-stone-500">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-stone-100">{value}</dd>
    </div>
  );
}
