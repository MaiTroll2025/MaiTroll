import { useEffect, useState } from 'react';
import { ArrowLeft, Crown, Loader2, Medal, Trophy } from 'lucide-react';
import Avatar from '../components/Avatar';
import { errorText, gameApi } from '../lib/gameApi';
import { formatPoints, playerName } from '../lib/players';
import type { LeaderboardPeriod, LeaderboardRow } from '../lib/types';

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'This week' },
  { id: 'all', label: 'All time' },
];

const PODIUM_STYLES = [
  'text-neon-amber border-neon-amber/50 shadow-neon-amber',
  'text-slate-200 border-slate-400/50',
  'text-neon-purple border-neon-purple/50 shadow-neon-purple',
];

interface LeaderboardProps {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: LeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null);
    setError(null);
    gameApi
      .getLeaderboard(period)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorText(caught));
      });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-neon-blue">
        <ArrowLeft className="h-4 w-4" /> Back to arcade
      </button>

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neon-green">Hall of fame</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-100">Leaderboards</h1>
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl border border-arena-600 bg-arena-900/80 p-1">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={period === option.id}
              onClick={() => setPeriod(option.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                period === option.id ? 'bg-neon-green text-arena-950 shadow-neon-green' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-neon-red/40 bg-neon-red/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {rows === null && !error && (
        <div className="flex justify-center py-20 text-neon-green">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="neon-panel animate-pop-in p-10 text-center">
          <Medal className="mx-auto h-10 w-10 text-neon-amber" />
          <p className="mt-4 font-display text-lg font-bold text-slate-100">No champions yet</p>
          <p className="mt-2 text-sm text-slate-400">Finish a match to claim the first spot on this board.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div key={period} className="animate-pop-in">
          <ol className="space-y-3">
            {rows.map((row, index) => {
              const name = playerName(row);
              const podium = index < 3;
              return (
                <li
                  key={row.user_id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`neon-panel animate-pop-in flex items-center gap-4 p-4 sm:p-5 ${podium ? `border ${PODIUM_STYLES[index]}` : ''}`}
                >
                  <span className={`w-10 text-center font-display text-xl font-extrabold ${podium ? PODIUM_STYLES[index].split(' ')[0] : 'text-slate-500'}`}>
                    {index === 0 ? <Crown className="mx-auto h-6 w-6" /> : index + 1}
                  </span>
                  <Avatar name={name} seed={row.user_id} src={row.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-100">{name}</p>
                    <p className="text-xs text-slate-400">
                      {row.matches_played} {row.matches_played === 1 ? 'match' : 'matches'} Â· best {formatPoints(row.best_score)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold text-neon-green">{formatPoints(row.total_points)}</p>
                    <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
                      <Trophy className="h-3 w-3" /> points
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

