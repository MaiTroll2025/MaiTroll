import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface BattleScoreBarProps {
  teamAScore: number;
  teamBScore: number;
  timerSeconds: number;
  totalDuration?: number;
  isActive?: boolean;
}

export default function BattleScoreBar({
  teamAScore,
  teamBScore,
  timerSeconds,
  totalDuration = 180,
  isActive = true
}: BattleScoreBarProps) {
  // Format timer as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timerSeconds]);

  // Calculate progress bar width
  const progressPercent = (timerSeconds / totalDuration) * 100;

  // Determine color based on time remaining
  const getTimerColor = () => {
    if (timerSeconds <= 10) return 'from-red-600 to-orange-600';
    if (timerSeconds <= 30) return 'from-yellow-600 to-orange-600';
    return 'from-green-600 to-blue-600';
  };

  // Determine winner/leader
  const isTeamALeading = teamAScore > teamBScore;
  const isTeamBLeading = teamBScore > teamAScore;
  const _isTied = teamAScore === teamBScore;

  return (
    <div className="w-full bg-gradient-to-b from-slate-900/80 to-slate-900/40 backdrop-blur-md border-b border-white/10 p-2 md:p-4 space-y-2">
      {/* Teams + Scores */}
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* Team A */}
        <div className={cn(
          "flex-1 rounded-lg p-2 md:p-3 transition-all",
          isTeamALeading ? "bg-amber-500/20 border border-amber-500/50 shadow-lg shadow-amber-500/20" : "bg-white/5 border border-white/10"
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs md:text-sm font-bold text-amber-300">TEAM A</span>
            <span className={cn(
              "text-lg md:text-2xl font-black",
              isTeamALeading ? "text-amber-300" : "text-gray-300"
            )}>
              {teamAScore}
            </span>
          </div>
        </div>

        {/* Timer + VS */}
        <div className="flex flex-col items-center gap-1">
          <div className={cn(
            "px-3 md:px-4 py-1 rounded-lg font-bold transition-all",
            `bg-gradient-to-r ${getTimerColor()}`
          )}>
            <div className="flex items-center gap-1.5 text-white">
              <Clock size={14} />
              <span className="text-sm md:text-base font-mono">{formattedTime}</span>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-bold uppercase">4v4</span>
        </div>

        {/* Team B */}
        <div className={cn(
          "flex-1 rounded-lg p-2 md:p-3 transition-all",
          isTeamBLeading ? "bg-purple-500/20 border border-purple-500/50 shadow-lg shadow-purple-500/20" : "bg-white/5 border border-white/10"
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-lg md:text-2xl font-black",
              isTeamBLeading ? "text-purple-300" : "text-gray-300"
            )}>
              {teamBScore}
            </span>
            <span className="text-xs md:text-sm font-bold text-purple-300">TEAM B</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-200",
            `bg-gradient-to-r ${getTimerColor()}`
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status / Sudden Death Warning */}
      {timerSeconds <= 10 && isActive && (
        <div className="flex items-center justify-center gap-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-center">
          <span className="text-[10px] md:text-xs font-bold text-red-300 uppercase animate-pulse">
            ⚡ SUDDEN DEATH - TROLL BUTTON ACTIVE ⚡
          </span>
        </div>
      )}
    </div>
  );
}
