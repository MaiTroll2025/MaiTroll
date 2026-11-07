import { useState } from 'react';
import { Check, Copy, Crown, Hourglass, LogOut, Play, Users, Zap } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { useNow } from '../../hooks/useNow';
import { playerName } from '../../lib/players';
import type { PlayerState, RoomState } from '../../lib/types';

interface WaitingRoomProps {
  state: RoomState;
  userId: string;
  busy: boolean;
  clockOffset: number;
  onToggleReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onHome: () => void;
}

export default function WaitingRoom({
  state,
  userId,
  busy,
  clockOffset,
  onToggleReady,
  onStart,
  onLeave,
  onHome,
}: WaitingRoomProps) {
  const { room } = state;
  const players = state.players.filter((player) => !player.has_left);
  const me = players.find((player) => player.user_id === userId);
  const isHost = room.host_id === userId;
  const isQuick = room.visibility === 'quick';
  const allReady =
    room.visibility === 'solo'
      ? Boolean(me?.is_ready)
      : players.length >= 2 && players.every((player) => player.is_ready);
  const canStart = isHost && !isQuick && allReady;
  const seats = Math.max(room.max_players, players.length);
  const emptySeats = Array.from({ length: seats - players.length });

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          className="mb-6 text-sm font-semibold text-neon-blue transition hover:text-neon-green"
        >
          &larr; Back to arcade
        </button>

        <div className="mb-8 animate-pop-in">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neon-green">
            {isQuick ? 'Quick match' : room.visibility === 'private' ? 'Private lobby' : 'Public lobby'}
          </p>
          <h1 className="neon-title mt-2 text-2xl sm:text-4xl">{room.name}</h1>
          <p className="mt-2 text-sm text-slate-400">10 rounds Â· 15 seconds per question Â· up to {room.max_players} players</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="neon-panel p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-slate-200">
                <Users className="h-4 w-4 text-neon-blue" /> Players
              </h2>
              <span className="text-sm text-slate-400">
                {players.length} / {room.max_players}
              </span>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player, index) => (
                <PlayerSlot
                  key={player.user_id}
                  player={player}
                  isHost={player.user_id === room.host_id}
                  isMe={player.user_id === userId}
                  index={index}
                  showReady={!isQuick}
                />
              ))}
              {emptySeats.map((_, index) => (
                <li
                  key={`empty-${index}`}
                  className="flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-arena-600 bg-arena-950/40 text-sm text-slate-500"
                >
                  Open seat
                </li>
              ))}
            </ul>
          </section>

          <aside className="flex flex-col gap-6">
            {room.join_code && <InviteCard code={room.join_code} />}

            <section className="neon-panel p-5 sm:p-6">
              {isQuick ? (
                <QuickCountdown autostartAt={room.autostart_at} clockOffset={clockOffset} playerCount={players.length} />
              ) : (
                <p className="text-sm leading-relaxed text-slate-300">
                  {!me
                    ? 'Joining the lobby...'
                    : canStart
                      ? 'Everyone is ready. Start the match when you are set.'
                      : room.visibility === 'solo'
                        ? 'Get ready to start your solo match.'
                        : players.length < 2
                          ? 'Waiting for at least one more player to join.'
                          : isHost
                            ? 'Waiting for every player to ready up.'
                            : 'Waiting for the host to start the match.'}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-3">
                {!isQuick && me && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleReady(!me.is_ready)}
                    aria-pressed={me.is_ready}
                    className={
                      me.is_ready
                        ? 'neon-button-ghost border-neon-green/60 text-neon-green hover:bg-neon-green/10'
                        : 'neon-button'
                    }
                  >
                    <Check className="h-4 w-4" />
                    {me.is_ready ? 'Ready! Tap to unready' : "I'm ready"}
                  </button>
                )}
                {isHost && !isQuick && (
                  <button type="button" disabled={busy || !canStart} onClick={onStart} className="neon-button">
                    <Play className="h-4 w-4" /> Start match
                  </button>
                )}
                <button type="button" disabled={busy} onClick={onLeave} className="neon-button-ghost">
                  <LogOut className="h-4 w-4" /> Leave lobby
                </button>
              </div>
            </section>
          </aside>
        </div>
    </main>
  );
}

function PlayerSlot({
  player,
  isHost,
  isMe,
  index,
  showReady,
}: {
  player: PlayerState;
  isHost: boolean;
  isMe: boolean;
  index: number;
  showReady: boolean;
}) {
  const name = playerName(player);
  return (
    <li
      className="flex animate-pop-in items-center gap-3 rounded-xl border border-arena-600 bg-arena-950/60 p-3"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative">
        <Avatar name={name} seed={player.user_id} src={player.avatar_url} />
        <span
          aria-label={player.connected ? 'Online' : 'Reconnecting'}
          title={player.connected ? 'Online' : 'Reconnecting'}
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-arena-950 ${
            player.connected ? 'bg-neon-green' : 'bg-neon-amber animate-glow'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-semibold text-slate-100">
          {isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-neon-amber" aria-label="Host" />}
          <span className="truncate">{name}</span>
          {isMe && <span className="text-xs text-neon-blue">(you)</span>}
        </p>
        {showReady && (
          <p className={`text-xs font-semibold ${player.is_ready ? 'text-neon-green' : 'text-slate-500'}`}>
            {player.is_ready ? 'Ready' : 'Not ready'}
          </p>
        )}
      </div>
    </li>
  );
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="neon-panel p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Room code</p>
      <p className="mt-2 font-display text-3xl font-extrabold tracking-[0.3em] text-neon-green drop-shadow-[0_0_12px_rgba(57,255,136,0.5)]">
        {code}
      </p>
      <p className="mt-2 text-sm text-slate-400">Friends can enter this code on the arcade home screen.</p>
      <button type="button" onClick={() => void copy()} className="neon-button-ghost mt-4 w-full">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy code'}
      </button>
    </section>
  );
}

function QuickCountdown({
  autostartAt,
  clockOffset,
  playerCount,
}: {
  autostartAt: string | null;
  clockOffset: number;
  playerCount: number;
}) {
  const now = useNow(clockOffset, 250);
  if (!autostartAt) {
    return (
      <div className="flex items-center gap-3 text-slate-300">
        <Hourglass className="h-5 w-5 animate-spin text-neon-blue" />
        <p className="text-sm">Looking for opponents. The match starts once a second player joins.</p>
      </div>
    );
  }
  const remaining = Math.max(0, Math.ceil((Date.parse(autostartAt) - now) / 1000));
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-neon-amber font-display text-2xl font-extrabold text-neon-amber animate-glow">
        {remaining}
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-semibold text-slate-100">
          <Zap className="h-4 w-4 text-neon-amber" /> Match launching
        </p>
        <p className="text-sm text-slate-400">
          {playerCount} players are in. More can still jump in before the countdown ends.
        </p>
      </div>
    </div>
  );
}

