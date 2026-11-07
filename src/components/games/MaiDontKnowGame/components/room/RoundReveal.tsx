import { Clock, Sparkles, XCircle, Trophy } from 'lucide-react';
import AnswerGrid from '../../components/room/AnswerGrid';
import RankingList from '../../components/room/RankingList';
import { useNow } from '../../hooks/useNow';
import { formatPoints, playerName } from '../../lib/players';
import { TROLL_COIN_COST_PER_ANSWER, TROLL_COIN_CORRECT_REWARD } from '../../lib/trollCoins';
import type { PlayerState, RoundState } from '../../lib/types';

const NEXT_ROUND_DELAY_MS = 7000;
const FAST_POINTS_THRESHOLD = 800;

const LINES = {
  fast: ['Big brain energy. Surgical.', 'Instant genius. Did you already know?', 'Lightning reflexes and zero doubt.'],
  slow: ['Correct, but you took your sweet time.', 'Right answer, slow fingers.', 'You got there eventually.'],
  wrong: ['Your gut lied to you.', 'Confidently incorrect. Respect.', 'The internet disagrees with you.', 'Plot twist: wrong again.'],
  missed: ['Ghosted the question. Bold strategy.', 'Asleep at the keyboard?', 'The clock won that one.'],
} as const;

interface RoundRevealProps {
  round: RoundState;
  players: PlayerState[];
  userId: string;
  clockOffset: number;
  totalRounds: number;
}

export default function RoundReveal({ round, players, userId, clockOffset, totalRounds }: RoundRevealProps) {
  const now = useNow(clockOffset, 200);
  const results = round.results ?? [];
  const mine = results.find((result) => result.user_id === userId);
  const isCorrect = mine?.is_correct ?? false;
  const correctAnswer = round.correct_index !== null ? round.options[round.correct_index] : null;

  const votesByIndex: Record<number, string[]> = {};
  for (const result of results) {
    const label = playerName(result);
    votesByIndex[result.choice] = [...(votesByIndex[result.choice] ?? []), result.user_id === userId ? 'You' : label];
  }

  const deltas: Record<string, number> = {};
  for (const result of results) {
    deltas[result.user_id] = result.points;
  }

  const revealedAt = round.revealed_at ? Date.parse(round.revealed_at) : now;
  const secondsLeft = Math.max(0, Math.ceil((revealedAt + NEXT_ROUND_DELAY_MS - now) / 1000));
  const isLast = round.round_number >= totalRounds;

  const verdict = pickVerdict(round.round_number, mine);

  return (
    <div className="space-y-6">
      <div className="neon-panel animate-pop-in p-5 sm:p-8">
        <span className="inline-block rounded-full border border-neon-purple/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon-purple">
          {round.category}
        </span>
        <h1 className="mt-4 text-balance font-display text-xl font-bold leading-snug text-slate-50 sm:text-3xl">
          {round.prompt}
        </h1>

        <div className="mt-8">
          <AnswerGrid
            options={round.options}
            selected={mine?.choice ?? round.my_choice}
            correctIndex={round.correct_index}
            disabled
            votesByIndex={votesByIndex}
          />
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-arena-600 bg-arena-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {isCorrect ? (
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-neon-red" />
            )}
            <div>
              <p className="text-sm text-slate-400">
                Correct answer:{' '}
                <span className="font-display font-bold text-neon-green">
                  {correctAnswer !== null ? formatPoints(correctAnswer) : '-'}
                </span>
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Sparkles className="h-4 w-4 text-neon-amber" /> {verdict}
              </p>
            </div>
          </div>
          {mine && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={`animate-count rounded-full px-4 py-2 font-display text-sm font-bold ${
                  mine.points > 0 ? 'bg-neon-green/15 text-neon-green' : 'bg-arena-700 text-slate-400'
                }`}
              >
                {mine.points > 0 ? `+${formatPoints(mine.points)} points` : '0 points'}
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-neon-red/10 px-2.5 py-1 text-neon-red">-{TROLL_COIN_COST_PER_ANSWER} coin</span>
                {mine.is_correct && (
                  <span className="rounded-full bg-neon-amber/15 px-2.5 py-1 text-neon-amber">+{TROLL_COIN_CORRECT_REWARD} coins</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="neon-panel p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">Standings</h2>
          <span className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="h-4 w-4" />
            {secondsLeft > 0
              ? isLast
                ? `Final scores in ${secondsLeft}s`
                : `Next question in ${secondsLeft}s`
              : isLast
                ? 'Finalizing...'
                : 'Loading next question...'}
          </span>
        </div>
        <RankingList players={players} userId={userId} deltas={deltas} />
      </div>
    </div>
  );
}

function pickVerdict(roundNumber: number, mine: { is_correct: boolean; points: number } | undefined): string {
  const pool = !mine
    ? LINES.missed
    : !mine.is_correct
      ? LINES.wrong
      : mine.points >= FAST_POINTS_THRESHOLD
        ? LINES.fast
        : LINES.slow;
  return pool[roundNumber % pool.length];
}

