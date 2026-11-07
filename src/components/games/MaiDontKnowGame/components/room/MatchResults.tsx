import { useState } from 'react';
import { Check, Crown, Copy, Home, Repeat, Share2, Swords, Zap } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { formatPoints, playerName, rankPlayers } from '../../lib/players';
import type { RoomState } from '../../lib/types';

interface MatchResultsProps {
  state: RoomState;
  userId: string;
  busy: boolean;
  onPlayAgain: () => void;
  onRematch: () => void;
  onHome: () => void;
}

export default function MatchResults({ state, userId, busy, onPlayAgain, onRematch, onHome }: MatchResultsProps) {
  const { room, players } = state;
  const ranked = rankPlayers(players.filter((player) => !player.has_left));
  const mine = ranked.find((player) => player.user_id === userId);
  const winner = ranked[0];
  const isSolo = room.visibility === 'solo';
  const abandoned = room.status === 'abandoned';
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const [shared, setShared] = useState<'idle' | 'shared' | 'copied'>('idle');

  const share = async () => {
    const text = mine
      ? `I finished #${mine.rank} in MAI DON'T KNOW! with ${formatPoints(mine.score)} points at the MaiTroll Arcade.`
      : `Come play MAI DON'T KNOW! at the MaiTroll Arcade.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "MAI DON'T KNOW!", text });
        setShared('shared');
      } else {
        await navigator.clipboard.writeText(text);
        setShared('copied');
      }
    } catch {
      setShared('idle');
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8 text-center animate-pop-in">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neon-green">
          {abandoned ? 'Match ended early' : 'Match complete'}
        </p>
        <h1 className="neon-title mt-3 text-3xl sm:text-5xl">
          {winner?.user_id === userId ? 'You win!' : winner ? `${playerName(winner)} wins` : 'Game over'}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {abandoned
            ? 'Not enough players stayed connected to finish. Standings reflect the rounds played.'
            : `${room.name} Â· ${room.total_rounds} rounds`}
        </p>
      </header>

      {podium.length > 0 && (
        <section aria-label="Podium" className="mx-auto mb-10 flex max-w-3xl items-end justify-center gap-3 sm:gap-6">
          {podium.map((player) => {
            const rank = player.rank;
            const height = rank === 1 ? 'h-44 sm:h-56' : rank === 2 ? 'h-32 sm:h-40' : 'h-24 sm:h-28';
            const tone =
              rank === 1
                ? 'border-neon-amber/60 bg-gradient-to-b from-neon-amber/25 to-arena-900'
                : rank === 2
                  ? 'border-neon-blue/50 bg-gradient-to-b from-neon-blue/20 to-arena-900'
                  : 'border-neon-green/40 bg-gradient-to-b from-neon-green/15 to-arena-900';
            const name = playerName(player);
            return (
              <div key={player.user_id} className="flex w-1/3 max-w-[180px] flex-col items-center">
                <div className={`mb-3 flex flex-col items-center gap-2 ${rank === 1 ? 'animate-float' : ''}`}>
                  {rank === 1 && <Crown className="h-7 w-7 text-neon-amber" aria-label="Winner" />}
                  <Avatar
                    name={name}
                    seed={player.user_id}
                    src={player.avatar_url}
                    size={rank === 1 ? 'lg' : 'md'}
                    ringClass={rank === 1 ? 'ring-neon-amber' : 'ring-neon-blue/50'}
                  />
                  <p className="max-w-full truncate text-center text-sm font-semibold text-slate-100">
                    {name}
                    {player.user_id === userId && <span className="ml-1 text-xs text-neon-blue">(you)</span>}
                  </p>
                  <p className="font-display text-sm font-bold text-neon-amber">{formatPoints(player.score)}</p>
                </div>
                <div
                  className={`${height} ${tone} flex w-full origin-bottom animate-rise items-start justify-center rounded-t-xl border-x border-t pt-3 font-display text-3xl font-extrabold text-slate-100`}
                >
                  {rank}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="neon-panel p-5 sm:p-6">
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-slate-200">Final rankings</h2>
          <ol className="divide-y divide-arena-600/70">
            {ranked.map((player, index) => {
              const isMe = player.user_id === userId;
              return (
                <li
                  key={player.user_id}
                  className={`flex animate-pop-in items-center gap-4 px-2 py-3 ${isMe ? 'text-neon-blue' : 'text-slate-200'}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="w-8 font-display text-sm font-bold text-slate-400">#{player.rank}</span>
                  <Avatar name={playerName(player)} seed={player.user_id} src={player.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {playerName(player)}
                    {isMe && <span className="ml-2 text-xs">(you)</span>}
                  </span>
                  <span className="font-display text-sm font-bold text-neon-amber">{formatPoints(player.score)}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Game points count toward the leaderboards only. Each answer costs 1 Troll Coin, and each correct answer earns 10.
          </p>
        </section>

        <aside className="neon-panel flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-slate-200">Next move</h2>
          <button type="button" disabled={busy} onClick={onPlayAgain} className="neon-button">
            {isSolo ? <Repeat className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {isSolo ? 'Play again' : 'Quick match again'}
          </button>
          {!isSolo && (
            <button type="button" disabled={busy} onClick={onRematch} className="neon-button-ghost">
              <Swords className="h-4 w-4" /> Rematch with a private lobby
            </button>
          )}
          <button type="button" onClick={() => void share()} className="neon-button-ghost">
            {shared === 'idle' ? <Share2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {shared === 'shared' ? 'Shared' : shared === 'copied' ? 'Copied to clipboard' : 'Share results'}
          </button>
          <button type="button" onClick={onHome} className="neon-button-ghost">
            <Home className="h-4 w-4" /> Return to arcade
          </button>
          {shared === 'copied' && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Copy className="h-3.5 w-3.5" /> Paste it anywhere to brag.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

