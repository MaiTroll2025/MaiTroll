import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Coins, Users } from 'lucide-react';
import AnswerGrid from '../../components/room/AnswerGrid';
import RankingList from '../../components/room/RankingList';
import RoundReveal from '../../components/room/RoundReveal';
import { useNow } from '../../hooks/useNow';
import { TROLL_COIN_COST_PER_ANSWER, TROLL_COIN_CORRECT_REWARD } from '../../lib/trollCoins';
import type { RoomState, RoundState } from '../../lib/types';

const ROUND_SECONDS = 15;

interface MatchScreenProps {
  state: RoomState;
  userId: string;
  busy: boolean;
  clockOffset: number;
  onAnswer: (choice: number) => void;
  onHome: () => void;
}

export default function MatchScreen({ state, userId, busy, clockOffset, onAnswer, onHome }: MatchScreenProps) {
  const { room, players, round } = state;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neon-blue transition hover:text-neon-green"
        >
          <ArrowLeft className="h-4 w-4" /> Arcade
        </button>
        <RoundProgress current={room.current_round} total={room.total_rounds} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          {round ? (
            round.status === 'open' ? (
              <QuestionCard
                key={round.id}
                round={round}
                connectedCount={players.filter((player) => !player.has_left && player.connected).length}
                clockOffset={clockOffset}
                busy={busy}
                onAnswer={onAnswer}
              />
            ) : (
              <RoundReveal
                key={round.id}
                round={round}
                players={players}
                userId={userId}
                clockOffset={clockOffset}
                totalRounds={room.total_rounds}
              />
            )
          ) : (
            <div className="neon-panel flex min-h-[320px] items-center justify-center p-8 text-slate-300">
              Starting the next question...
            </div>
          )}
        </section>

        <aside className="neon-panel h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-slate-300">
            <Users className="h-4 w-4 text-neon-blue" /> Live standings
          </h2>
          <RankingList
            key={round?.id ?? 'none'}
            players={players}
            userId={userId}
            showAnswered={round?.status === 'open'}
          />
        </aside>
      </div>
    </main>
  );
}

function RoundProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-sm font-bold text-slate-200">
        Round {current} <span className="text-slate-500">/ {total}</span>
      </span>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-2 w-4 rounded-full transition-colors duration-300 ${
              index + 1 < current ? 'bg-neon-green' : index + 1 === current ? 'bg-neon-blue animate-glow' : 'bg-arena-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface QuestionCardProps {
  round: RoundState;
  connectedCount: number;
  clockOffset: number;
  busy: boolean;
  onAnswer: (choice: number) => void;
}

function QuestionCard({ round, connectedCount, clockOffset, busy, onAnswer }: QuestionCardProps) {
  const now = useNow(clockOffset);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!busy) {
      setPending(null);
    }
  }, [busy]);

  const remainingMs = Date.parse(round.deadline_at) - now;
  const remaining = Math.min(ROUND_SECONDS, Math.max(0, Math.ceil(remainingMs / 1000)));
  const expired = remainingMs <= 0;
  const selected = round.my_choice ?? pending;
  const locked = selected !== null;
  const waitingOn = Math.max(0, connectedCount - round.answered_count);

  const pick = (index: number) => {
    if (locked || busy || expired) {
      return;
    }
    setPending(index);
    onAnswer(index);
  };

  let status = 'Choose fast. Quicker answers earn more points.';
  if (expired) {
    status = "Time's up! Revealing the answers...";
  } else if (locked) {
    status = waitingOn > 0 ? `Locked in. Waiting on ${waitingOn} more...` : 'Everyone is in. Revealing...';
  }

  return (
    <div className="neon-panel animate-pop-in p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-block rounded-full border border-neon-purple/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon-purple">
            {round.category}
          </span>
          <h1 className="mt-4 text-balance font-display text-xl font-bold leading-snug text-slate-50 sm:text-3xl">
            {round.prompt}
          </h1>
        </div>
        <TimerRing remaining={remaining} />
      </div>

      <div className="mt-8">
        <AnswerGrid
          options={round.options}
          selected={selected}
          correctIndex={null}
          disabled={locked || busy || expired}
          onPick={pick}
        />
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-neon-amber/90">
        <Coins className="h-3.5 w-3.5 shrink-0" /> Each answer costs {TROLL_COIN_COST_PER_ANSWER} Troll Coin. Correct answers pay {TROLL_COIN_CORRECT_REWARD}.
      </p>

      <p
        role="status"
        aria-live="polite"
        className={`mt-6 flex items-center gap-2 text-sm ${
          expired ? 'text-neon-amber' : locked ? 'text-neon-green' : 'text-slate-400'
        }`}
      >
        <Clock className="h-4 w-4 shrink-0" /> {status}
      </p>
    </div>
  );
}

function TimerRing({ remaining }: { remaining: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / ROUND_SECONDS;
  const urgent = remaining <= 5;

  return (
    <div
      className={`relative flex h-20 w-20 shrink-0 items-center justify-center ${urgent ? 'animate-shake text-neon-red' : 'text-neon-amber'}`}
    >
      <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#283057" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-200 ease-linear"
        />
      </svg>
      <span
        key={remaining}
        className="animate-count font-display text-2xl font-extrabold"
        aria-label={`${remaining} seconds left`}
      >
        {remaining}
      </span>
    </div>
  );
}

