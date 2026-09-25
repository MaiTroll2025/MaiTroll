import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSoundBuffer } from '../../troll/soundUtils';
import ConfettiTrumpets from '../entrance/ConfettiTrumpets';

/**
 * TrollTimeBanner — major battle overlay shown to ALL battle participants
 * when the server-authoritative Troll Time event is active.
 *
 * CRITICAL:
 * - The multiplier, start, and end times come ONLY from the server.
 * - The countdown is computed from server timestamps, never a drifting timer.
 * - Confetti + alarm fire ONCE on activation, not per gift, not per render.
 * - Respects reduced-motion accessibility settings.
 * - Cleans up timers/listeners on unmount.
 */
interface TrollTimeBannerProps {
  active: boolean
  multiplier: number // 1, 2, 4, or 6
  endsAt: string | null
  eventId: string | null
  reducedMotion?: boolean
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TrollTimeBanner({
  active,
  multiplier,
  endsAt,
  eventId,
  reducedMotion = false,
}: TrollTimeBannerProps) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [fired, setFired] = useState(false);
  const firedRef = useRef(false);
  const prevActiveRef = useRef(false);
  const audioPlayedRef = useRef(false);

  // Recompute countdown from the server-provided endsAt timestamp.
  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const end = new Date(endsAt).getTime();
      setRemainingMs(Math.max(0, end - Date.now()));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Fire confetti + alarm exactly once when Troll Time ACTIVATES.
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      if (!firedRef.current) {
        firedRef.current = true;
        setFired(true);
        // Reset confetti trigger shortly after it renders so a future
        // activation can fire again.
        const t = setTimeout(() => setFired(false), 1500);
        return () => clearTimeout(t);
      }
    }
    prevActiveRef.current = active;
  }, [active]);

  // Alarm sound — plays once on activation, guarded by a ref so React
  // rerenders never re-trigger it. Respects autoplay restrictions gracefully.
  useEffect(() => {
    if (active && !prevActiveRef.current && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      if (!reducedMotion) {
        playSoundBuffer('/sounds/entrance/royal_fanfare.mp3', 0.7).catch(() => {
          /* autoplay blocked — non-critical */
        });
      }
    }
    if (!active) {
      audioPlayedRef.current = false;
    }
  }, [active, reducedMotion]);

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="troll-time-banner pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-[90] flex justify-center px-3"
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        aria-live="polite"
      >
        <div className="relative">
          {/* Glow/pulse backdrop */}
          <motion.div
            className="absolute inset-0 rounded-3xl blur-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(0,229,255,0.55), rgba(168,85,247,0.55), rgba(77,255,160,0.45))',
            }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative flex items-center gap-3 rounded-3xl border border-cyan-400/60 bg-black/70 px-4 py-2.5 shadow-[0_0_40px_rgba(0,229,255,0.45)] backdrop-blur-md">
            <span className="text-xl">🔥</span>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-extrabold tracking-[0.25em] text-cyan-300">
                TROLL TIME
              </span>
              <span className="text-sm font-bold text-white">
                {multiplier}X BATTLE POINTS
              </span>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/60 bg-purple-500/15">
              <span className="text-xl font-black text-purple-300">{multiplier}x</span>
            </div>

            <div className="flex flex-col leading-none text-right">
              <span className="text-[10px] font-extrabold tracking-[0.25em] text-green-300">
                COUNTDOWN
              </span>
              <span className="font-mono text-lg font-bold text-green-300">
                {formatCountdown(remainingMs)}
              </span>
            </div>
          </div>

          {/* Confetti — fires once on activation */}
          {fired && !reducedMotion && (
            <ConfettiTrumpets active lowPower={false} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}