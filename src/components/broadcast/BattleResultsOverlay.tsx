import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Crown, RotateCcw } from 'lucide-react';

interface BattleResultsOverlayProps {
  isVisible: boolean;
  winningTeam: 'A' | 'B' | 'draw' | null;
  teamAScore: number;
  teamBScore: number;
  teamAName?: string;
  teamBName?: string;
  bonusPercentage?: number;
  onRematch?: () => void;
  onClose?: () => void;
  rematchAccepted?: { A: boolean; B: boolean };
}

export default function BattleResultsOverlay({
  isVisible,
  winningTeam,
  teamAScore,
  teamBScore,
  teamAName = 'Team A',
  teamBName = 'Team B',
  bonusPercentage = 2,
  onRematch,
  onClose,
  rematchAccepted = { A: false, B: false }
}: BattleResultsOverlayProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(false);
      setTimeout(() => setShowAnimation(true), 100);
    }
  }, [isVisible]);

  // Auto-close countdown
  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose?.();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const isWinner = (team: 'A' | 'B') => winningTeam === team;
  const isDraw = winningTeam === 'draw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Main Results Card */}
      <div
        className={cn(
          "relative max-w-md w-full rounded-2xl overflow-hidden transition-all duration-500",
          "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-white/20",
          showAnimation ? "scale-100 opacity-100" : "scale-90 opacity-0"
        )}
      >
        {/* Winner Glow Background */}
        {!isDraw && (
          <div
            className={cn(
              "absolute -inset-1 rounded-2xl blur-2xl opacity-50",
              isWinner('A') ? "bg-amber-500" : "bg-purple-500"
            )}
            style={{ zIndex: -1 }}
          />
        )}

        {/* Content */}
        <div className="relative p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className={cn(
              "text-3xl md:text-4xl font-black",
              isDraw ? "text-gray-300" : isWinner('A') ? "text-amber-400" : "text-purple-400"
            )}>
              {isDraw ? "🤝 IT'S A TIE!" : isWinner('A') ? "🏆 TEAM A WINS!" : "🏆 TEAM B WINS!"}
            </div>
            <p className="text-xs md:text-sm text-gray-400">
              {isDraw ? "Both teams showed great effort!" : "Congratulations to the winning team!"}
            </p>
          </div>

          {/* Scores Comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Team A Score */}
            <div className={cn(
              "rounded-lg p-4 text-center transition-all",
              isWinner('A') 
                ? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/30"
                : "bg-white/5 border border-white/10"
            )}>
              <div className="text-sm md:text-base font-bold text-amber-300 mb-2">{teamAName}</div>
              <div className={cn(
                "text-3xl md:text-4xl font-black",
                isWinner('A') ? "text-amber-300" : "text-gray-400"
              )}>
                {teamAScore}
              </div>
              {isWinner('A') && (
                <div className="text-[10px] text-amber-300 mt-1 flex items-center justify-center gap-1">
                  <Crown size={12} />
                  +2 Crowns
                </div>
              )}
            </div>

            {/* Team B Score */}
            <div className={cn(
              "rounded-lg p-4 text-center transition-all",
              isWinner('B')
                ? "bg-purple-500/20 border-2 border-purple-500 shadow-lg shadow-purple-500/30"
                : "bg-white/5 border border-white/10"
            )}>
              <div className="text-sm md:text-base font-bold text-purple-300 mb-2">{teamBName}</div>
              <div className={cn(
                "text-3xl md:text-4xl font-black",
                isWinner('B') ? "text-purple-300" : "text-gray-400"
              )}>
                {teamBScore}
              </div>
              {isWinner('B') && (
                <div className="text-[10px] text-purple-300 mt-1 flex items-center justify-center gap-1">
                  <Crown size={12} />
                  +2 Crowns
                </div>
              )}
            </div>
          </div>

          {/* Bonus Info */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-[10px] md:text-xs text-green-400 font-bold uppercase mb-1">Bonus Coins</div>
            <div className="text-sm md:text-base text-green-300 font-black">
              +{bonusPercentage}% to all coins earned
            </div>
            <div className="text-[9px] text-green-400/70 mt-1">
              Applied to winning team members
            </div>
          </div>

          {/* Rematch Section */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onRematch}
              disabled={!onRematch}
              className={cn(
                "w-full py-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2",
                "text-sm md:text-base",
                onRematch
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border border-blue-400/50"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              )}
            >
              <RotateCcw size={16} />
              Rematch?
            </button>

            {/* Rematch Status */}
            {(rematchAccepted.A || rematchAccepted.B) && (
              <div className="text-center text-[10px] text-yellow-400">
                {rematchAccepted.A && rematchAccepted.B
                  ? "✓ Both teams ready! Starting new battle..."
                  : `Waiting for ${rematchAccepted.A ? 'Team B' : rematchAccepted.B ? 'Team A' : 'both teams'}...`}
              </div>
            )}
          </div>

          {/* Auto-close Countdown */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400">
            <span>Closing in</span>
            <span className="font-bold text-yellow-400">{countdown}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
