// ============================================================
// StateBattleBanner Component
// ============================================================
// Displays state battle info above the broadcast:
// - VS header with state names
// - Live score for each state
// - Countdown timer
// ============================================================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, X, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStateName } from '@/config/usStates';

interface StateBattleBannerProps {
  isActive: boolean;
  isStarting: boolean;
  stateA: string | null;
  stateB: string | null;
  scoreA: number;
  scoreB: number;
  battleEndTime: string | null;
  isBroadcaster: boolean;
  onDismiss?: () => void;
}

export default function StateBattleBanner({
  isActive,
  isStarting,
  stateA,
  stateB,
  scoreA,
  scoreB,
  battleEndTime,
  isBroadcaster: _isBroadcaster,
  onDismiss,
}: StateBattleBannerProps) {
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!battleEndTime) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [battleEndTime]);

  useEffect(() => {
    setDismissed(false);
  }, [isActive, isStarting]);

  if (dismissed || (!isActive && !isStarting)) return null;

  const timeRemaining = battleEndTime
    ? Math.max(0, Math.ceil((new Date(battleEndTime).getTime() - now) / 1000))
    : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stateAName = stateA ? getStateName(stateA) : '???';
  const stateBName = stateB ? getStateName(stateB) : '???';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative z-30 mx-auto w-full max-w-3xl px-3 pt-2"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border-2',
            'bg-gradient-to-r from-emerald-950/95 via-teal-950/95 to-cyan-950/95',
            'border-emerald-400/50',
            'shadow-[0_0_40px_rgba(16,185,129,0.3),0_0_80px_rgba(6,182,212,0.15)]',
          )}
        >
          {/* Animated shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />

          <div className="relative px-4 py-3">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-emerald-300" />
                <span className="text-sm font-black text-emerald-100 tracking-wide">
                  🏛️ STATE BATTLE {isStarting ? 'STARTING' : ''}
                </span>
              </div>
              {onDismiss && (
                <button
                  onClick={() => setDismissed(true)}
                  className="p-1 rounded-lg hover:bg-white/10 transition text-emerald-300/60 hover:text-emerald-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* VS Row */}
            <div className="flex items-center justify-center gap-3 my-2">
              {/* State A */}
              <div className="flex-1 text-center">
                <div className="text-xs font-bold text-emerald-300/70 uppercase tracking-wider mb-1">
                  {stateAName}
                </div>
                <div className="text-2xl font-black text-white tabular-nums">
                  {scoreA.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-400/60 font-semibold">POINTS</div>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center gap-1">
                <Swords className="w-5 h-5 text-amber-400" />
                <span className="text-[10px] font-black text-amber-300/80">VS</span>
              </div>

              {/* State B */}
              <div className="flex-1 text-center">
                <div className="text-xs font-bold text-cyan-300/70 uppercase tracking-wider mb-1">
                  {stateBName}
                </div>
                <div className="text-2xl font-black text-white tabular-nums">
                  {scoreB.toLocaleString()}
                </div>
                <div className="text-[10px] text-cyan-400/60 font-semibold">POINTS</div>
              </div>
            </div>

            {/* Timer */}
            {timeRemaining > 0 && (
              <div className="text-center mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-amber-200">
                  ⏱️ {formatTime(timeRemaining)}
                </span>
              </div>
            )}

            {isStarting && (
              <div className="text-center mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-xs font-bold text-amber-200 animate-pulse">
                  ⚔️ Battle starting soon...
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
