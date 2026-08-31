import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Zap, Trophy, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type QueuePhase = 'regular' | 'queue' | 'starting' | 'active' | 'ended';

interface RandomBattleBannerProps {
  phase: QueuePhase;
  delayUntil: number | null;
  isBroadcaster: boolean;
  onStartQueue?: () => void;
  onStopQueue?: () => void;
  isBusy?: boolean;
  mobileSafe?: boolean;
}

export default function RandomBattleBanner({
  phase,
  delayUntil,
  isBroadcaster,
  onStartQueue,
  onStopQueue,
  isBusy = false,
  mobileSafe = false,
}: RandomBattleBannerProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!delayUntil) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((delayUntil - Date.now()) / 1000));
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [delayUntil]);

  // Reset dismissed state when phase changes
  useEffect(() => {
    setDismissed(false);
  }, [phase]);

  if (dismissed) return null;

  // Active battle — show prominent banner
  if (phase === 'active' || phase === 'starting') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={cn(
            'relative z-30 mx-auto w-full max-w-2xl',
            mobileSafe ? 'px-3 pt-2' : 'px-4 pt-3',
          )}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border-2',
              'bg-gradient-to-r from-purple-950/95 via-fuchsia-950/95 to-pink-950/95',
              'border-purple-400/50',
              'shadow-[0_0_40px_rgba(168,85,247,0.35),0_0_80px_rgba(236,72,153,0.15)]',
            )}
          >
            {/* Animated background shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />

            <div className="relative flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Swords className="w-6 h-6 text-purple-300" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-black text-purple-100 tracking-wide">
                    ⚔️ MAi BATTLE {phase === 'starting' ? 'STARTING' : 'ACTIVE'}!
                  </p>
                  <p className="text-xs text-purple-300/80">
                    {phase === 'starting'
                      ? 'Get ready — battle arena loading...'
                      : 'Battle is live! Send gifts to support your side!'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition text-purple-300/60 hover:text-purple-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Queue phase — show searching banner
  if (phase === 'queue') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'relative z-30 mx-auto w-full max-w-2xl',
            mobileSafe ? 'px-3 pt-2' : 'px-4 pt-3',
          )}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border',
              'bg-gradient-to-r from-amber-950/90 via-orange-950/90 to-red-950/90',
              'border-amber-400/40',
              'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
            )}
          >
            <div className="relative flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-100">
                    🔍 SEARCHING FOR YOUR OPPONENT...
                  </p>
                  <p className="text-xs text-amber-300/70">
                    {countdown !== null && countdown > 0
                      ? `Matching in ${countdown}s...`
                      : 'Finding your next challenge...'}
                  </p>
                </div>
              </div>

              {isBroadcaster && onStopQueue && (
                <button
                  onClick={onStopQueue}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-xs font-bold hover:bg-red-500/30 transition"
                >
                  Stop Queue
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-black/30">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
                initial={{ width: '0%' }}
                animate={{
                  width: countdown !== null && countdown > 0
                    ? `${Math.max(5, 100 - (countdown / 10) * 100)}%`
                    : '80%',
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Regular phase — show CTA for broadcaster to start queue
  if (phase === 'regular' && isBroadcaster) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            'relative z-30 mx-auto w-full max-w-2xl',
            mobileSafe ? 'px-3 pt-2' : 'px-4 pt-3',
          )}
        >
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border',
              'bg-gradient-to-r from-indigo-950/80 via-purple-950/80 to-fuchsia-950/80',
              'border-indigo-400/30',
              'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
            )}
          >
            <div className="relative flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-indigo-300" />
                <div>
                  <p className="text-sm font-bold text-indigo-100">
                    🎲 MAi Battle Queue
                  </p>
                  <p className="text-xs text-indigo-300/70">
                    Get matched with a random opponent for a 1v1 battle!
                  </p>
                </div>
              </div>

              {onStartQueue && (
                <button
                  onClick={onStartQueue}
                  disabled={isBusy}
                  className={cn(
                    'px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all',
                    'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
                    'shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40',
                    'hover:scale-105 active:scale-95',
                    isBusy && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Swords size={14} />
                  Start Queue
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
  return null;
}
