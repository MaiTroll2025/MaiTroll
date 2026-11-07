import Avatar from '../../components/Avatar';
import { formatPoints, playerName, rankPlayers } from '../../lib/players';
import type { PlayerState } from '../../lib/types';

interface RankingListProps {
  players: PlayerState[];
  userId: string;
  deltas?: Record<string, number>;
  showAnswered?: boolean;
}

export default function RankingList({ players, userId, deltas, showAnswered = false }: RankingListProps) {
  const ranked = rankPlayers(players.filter((player) => !player.has_left));
  const topScore = Math.max(1, ...ranked.map((player) => player.score));

  return (
    <ol className="space-y-2">
      {ranked.map((player, index) => {
        const name = playerName(player);
        const isMe = player.user_id === userId;
        const width = Math.max(4, Math.round((player.score / topScore) * 100));
        const delta = deltas?.[player.user_id] ?? 0;

        return (
          <li
            key={player.user_id}
            className={`animate-pop-in rounded-xl border p-3 ${
              isMe ? 'border-neon-blue/50 bg-neon-blue/10' : 'border-arena-600 bg-arena-950/60'
            } ${player.connected ? '' : 'opacity-60'}`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-center font-display text-sm font-bold text-slate-400">{player.rank}</span>
              <Avatar name={name} seed={player.user_id} src={player.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {name}
                  {isMe && <span className="ml-1 text-xs text-neon-blue">(you)</span>}
                </p>
              </div>
              {showAnswered && (
                <span
                  className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${
                    player.answered ? 'bg-neon-green/15 text-neon-green' : 'bg-arena-700 text-slate-400'
                  }`}
                >
                  {player.answered ? 'Locked' : 'Thinking'}
                </span>
              )}
              {delta > 0 && (
                <span className="shrink-0 animate-pop-in rounded-full bg-neon-green/15 px-2 py-0.5 text-xs font-bold text-neon-green">
                  +{formatPoints(delta)}
                </span>
              )}
              <span className="shrink-0 font-display text-sm font-bold text-slate-100">{formatPoints(player.score)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-arena-700">
              <div
                className="animate-bar h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-green"
                style={{ ['--w' as string]: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

