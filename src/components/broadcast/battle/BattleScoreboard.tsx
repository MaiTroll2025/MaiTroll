import React from 'react';
import { ArrowLeft, Swords, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function BattleScoreboard({
  challengerName,
  opponentName,
  challengerScore,
  opponentScore,
  timeLeft,
  isSuddenDeath,
  battleStatus,
  onBack,
}: {
  challengerName?: string | null;
  opponentName?: string | null;
  challengerScore: number;
  opponentScore: number;
  timeLeft?: number;
  isSuddenDeath?: boolean;
  battleStatus?: string;
  onBack?: () => void;
}) {
  const total = challengerScore + opponentScore;
  const challengerPct = total === 0 ? 50 : Math.round((challengerScore / total) * 100);
  const opponentPct = 100 - challengerPct;
  const leading: 'challenger' | 'opponent' | 'tie' =
    challengerScore > opponentScore ? 'challenger' : opponentScore > challengerScore ? 'opponent' : 'tie';

  const statusLabel =
    battleStatus === 'starting' || battleStatus === 'ready'
      ? 'Starting'
      : battleStatus === 'active'
      ? isSuddenDeath
        ? 'Sudden Death'
        : 'Live'
      : battleStatus === 'paused'
      ? 'Paused'
      : battleStatus === 'ended'
      ? 'Ended'
      : 'Battle';

  const clock = timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : '--:--';

  return (
    <div className="relative z-20 flex items-center gap-3 border-b border-white/10 bg-gradient-to-b from-zinc-900/90 to-black/80 px-3 py-2 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-white transition hover:scale-105 hover:bg-black/60"
      >
        <ArrowLeft size={16} />
        <span className="hidden text-xs font-semibold sm:inline">Back</span>
      </button>

      {/* Blue (Challenger) */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="min-w-0 text-right">
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-blue-300/80">
            {challengerName || 'Blue'}
          </div>
          <div
            className={cn(
              'font-mono text-lg font-black leading-none transition',
              leading === 'challenger' ? 'text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.7)]' : 'text-blue-300/80'
            )}
          >
            {challengerScore.toLocaleString()}
          </div>
        </div>
        <div className="hidden h-8 w-1.5 rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.6)] sm:block" />
      </div>

      {/* Center VS + timer */}
      <div className="flex shrink-0 flex-col items-center">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60',
            leading === 'challenger'
              ? 'text-blue-300 drop-shadow-[0_0_14px_rgba(59,130,246,0.8)]'
              : leading === 'opponent'
              ? 'text-red-300 drop-shadow-[0_0_14px_rgba(239,68,68,0.8)]'
              : 'text-white/90'
          )}
        >
          <Swords size={18} />
        </div>
        <div
          className={cn(
            'mt-0.5 font-mono text-xs font-black leading-none',
            isSuddenDeath ? 'animate-pulse text-red-500' : 'text-white'
          )}
        >
          {battleStatus === 'ended' ? 'ENDED' : clock}
        </div>
        <div
          className={cn(
            'mt-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider',
            isSuddenDeath
              ? 'bg-red-500/20 text-red-300'
              : statusLabel === 'Live'
              ? 'bg-green-500/20 text-green-300'
              : 'bg-white/10 text-white/60'
          )}
        >
          {isSuddenDeath ? <span className="flex items-center gap-0.5"><Zap size={8} /> SD</span> : statusLabel}
        </div>
      </div>

      {/* Red (Opponent) */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="hidden h-8 w-1.5 rounded-full bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_12px_rgba(239,68,68,0.6)] sm:block" />
        <div className="min-w-0 text-left">
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-red-300/80">
            {opponentName || 'Red'}
          </div>
          <div
            className={cn(
              'font-mono text-lg font-black leading-none transition',
              leading === 'opponent' ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]' : 'text-red-300/80'
            )}
          >
            {opponentScore.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="absolute bottom-0 left-0 flex h-0.5 w-full">
        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${challengerPct}%` }} />
        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${opponentPct}%` }} />
      </div>
    </div>
  );
}
