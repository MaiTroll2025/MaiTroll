/**
 * JailBarOverlay — "JAIL TIME" Battle Effect
 *
 * Renders animated steel prison bars that rise from the bottom of a
 * broadcaster's camera frame when they are losing a Random Battle.
 *
 * Props:
 *   side         — 'challenger' | 'opponent'  (which broadcaster)
 *   isLosing     — true when this side's score is behind
 *   isLocked     — true when bars are fully risen (triggers slam sound)
 *   showWarningLights — toggle red corner warning lights
 *   showTextBanner     — toggle "JAIL TIME" text flash
 *
 * The component is fully self-contained and uses only CSS animations
 * for 60 fps performance. No JS animation libraries needed.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './JailBarOverlay.css';

// ─── Types ───────────────────────────────────────────────────────
export interface JailBarOverlayProps {
  /** Which battle side this overlay belongs to */
  side: 'challenger' | 'opponent';
  /** Is this side currently losing? */
  isLosing: boolean;
  /** Callback fired when bars fully lock into place (for sound) */
  onBarsLocked?: () => void;
  /** Callback fired when bars fully descend (for sound) */
  onBarsFreed?: () => void;
  /** Show red warning lights in corners */
  showWarningLights?: boolean;
  /** Show "JAIL TIME" text banner on lock */
  showTextBanner?: boolean;
  /** Number of vertical bars (auto-calculated if not set) */
  barCount?: number;
  /** Show horizontal cross-bars */
  showCrossbars?: boolean;
  /** Show chain links at the top */
  showChains?: boolean;
  /** Show dark vignette overlay */
  showVignette?: boolean;
  /** Custom className for the root container */
  className?: string;
}

// ─── Constants ───────────────────────────────────────────────────
const DEFAULT_BAR_COUNT = 9;
const CROSSBAR_COUNT = 3;
const RIVETS_PER_BAR = 4;
const LOCK_DELAY_MS = 800; // matches CSS animation duration

// ─── Component ───────────────────────────────────────────────────
export default function JailBarOverlay({
  side,
  isLosing,
  onBarsLocked,
  onBarsFreed,
  showWarningLights = true,
  showTextBanner = true,
  barCount = DEFAULT_BAR_COUNT,
  showCrossbars = true,
  showChains = true,
  showVignette = true,
  className = '',
}: JailBarOverlayProps) {
  // Track animation state
  const [animState, setAnimState] = useState<'hidden' | 'rising' | 'locked' | 'descending'>('hidden');
  const [showText, setShowText] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLosingRef = useRef(isLosing);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  // React to losing state changes
  useEffect(() => {
    const prevLosing = prevLosingRef.current;
    prevLosingRef.current = isLosing;

    if (isLosing && !prevLosing) {
      // ── Start rising ──
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      setAnimState('rising');
      setShowText(true);

      // After bars reach full height, trigger lock
      lockTimerRef.current = setTimeout(() => {
        setAnimState('locked');
        onBarsLocked?.();
        // Hide text banner after a short display
        setTimeout(() => setShowText(false), 1500);
      }, LOCK_DELAY_MS);

    } else if (!isLosing && prevLosing) {
      // ── Start descending ──
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      setAnimState('descending');
      setShowText(false);

      // After bars descend, go hidden
      lockTimerRef.current = setTimeout(() => {
        setAnimState('hidden');
        onBarsFreed?.();
      }, 600);
    }
  }, [isLosing, onBarsLocked, onBarsFreed]);

  // ─── Generate bar elements ─────────────────────────────────────
  const bars = useMemo(() =>
    Array.from({ length: barCount }, (_, i) => {
      const rivets = Array.from({ length: RIVETS_PER_BAR }, (_, j) => {
        const topPct = 15 + (j * (70 / RIVETS_PER_BAR));
        return (
          <div
            key={`rivet-${i}-${j}`}
            className="jail-bar-rivet"
            style={{ top: `${topPct}%` }}
          />
        );
      });

      return (
        <div key={`bar-${i}`} className="jail-bar">
          {rivets}
        </div>
      );
    }),
    [barCount]
  );

  // ─── Generate crossbars ────────────────────────────────────────
  const crossbars = useMemo(() =>
    showCrossbars
      ? Array.from({ length: CROSSBAR_COUNT }, (_, i) => {
          const topPct = 20 + (i * 30);
          return (
            <div
              key={`crossbar-${i}`}
              className="jail-crossbar"
              style={{ top: `${topPct}%` }}
            />
          );
        })
      : null,
    [showCrossbars]
  );

  // ─── Generate chain links ──────────────────────────────────────
  const chainLinks = useMemo(() =>
    showChains
      ? Array.from({ length: barCount + 3 }, (_, i) => (
          <div
            key={`chain-${i}`}
            className="jail-chain-link"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))
      : null,
    [showChains, barCount]
  );

  // ─── Bar group animation (framer-motion for cross-browser) ──
  const barGroupAnimate = useMemo(() => {
    if (animState === 'rising' || animState === 'locked') {
      return { y: '0%' };
    }
    if (animState === 'descending') {
      return { y: '105%' };
    }
    return { y: '100%' };
  }, [animState]);

  const barGroupTransition = useMemo<{ duration: number; ease?: number[] }>(() => {
    if (animState === 'rising') {
      return { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] };
    }
    if (animState === 'locked') {
      return { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] };
    }
    if (animState === 'descending') {
      return { duration: 0.6, ease: [0.55, 0.06, 0.68, 0.19] };
    }
    return { duration: 0 };
  }, [animState]);

  // ─── Don't render anything when hidden ─────────────────────────
  if (animState === 'hidden' && !isLosing) return null;

  // ─── Side-specific accent color for warning lights ─────────────
  const warningColor = side === 'challenger'
    ? 'rgba(16, 185, 129, 0.8)'
    : 'rgba(192, 38, 211, 0.8)';

  return (
    <div className={`jail-bar-overlay ${className}`} aria-hidden="true">
      {/* Dark vignette */}
      {showVignette && (
        <div
          className={`jail-vignette ${animState === 'locked' || animState === 'rising' ? 'jail-vignette--active' : ''}`}
        />
      )}

      {/* Chain links at the top */}
      {showChains && chainLinks && (
        <div className="jail-chain">{chainLinks}</div>
      )}

      {/* Main bar group */}
      <motion.div
        className="jail-bars"
        initial={{ y: '100%' }}
        animate={barGroupAnimate}
        transition={barGroupTransition as any}
      >
        {bars}
        {crossbars}
      </motion.div>

      {/* Red warning lights */}
      {showWarningLights && (animState === 'locked' || animState === 'rising') && (
        <>
          <div className="jail-warning-light jail-warning-light--top-left" />
          <div className="jail-warning-light jail-warning-light--top-right" />
          <div className="jail-warning-light jail-warning-light--bottom-left" />
          <div className="jail-warning-light jail-warning-light--bottom-right" />
        </>
      )}

      {/* "JAIL TIME" text banner */}
      <AnimatePresence>
        {showText && showTextBanner && (
          <motion.div
            key="jail-text"
            initial={{ opacity: 0, scale: 1.8, rotate: -5 }}
            animate={{ opacity: 0.9, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="jail-text-banner"
          >
            ⛓️ JAIL TIME ⛓️
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Hook: useJailTimeState ──────────────────────────────────────
/**
 * Convenience hook that tracks battle scores and returns losing state
 * for each side. Use this in the parent battle component.
 *
 * Returns { challengerLosing, opponentLosing, leadChanged }
 */
export function useJailTimeState(
  challengerScore: number,
  opponentScore: number,
  battleActive: boolean
) {
  const [challengerLosing, setChallengerLosing] = useState(false);
  const [opponentLosing, setOpponentLosing] = useState(false);
  const [leadChanged, setLeadChanged] = useState(false);
  const prevLeaderRef = useRef<'challenger' | 'opponent' | 'tie' | null>(null);

  useEffect(() => {
    if (!battleActive) {
      setChallengerLosing(false);
      setOpponentLosing(false);
      setLeadChanged(false);
      prevLeaderRef.current = null;
      return;
    }

    const currentLeader: 'challenger' | 'opponent' | 'tie' =
      challengerScore > opponentScore ? 'challenger' :
      opponentScore > challengerScore ? 'opponent' : 'tie';

    const prevLeader = prevLeaderRef.current;

    // Detect lead change
    const didLeadChange = prevLeader !== null && currentLeader !== prevLeader && currentLeader !== 'tie';
    setLeadChanged(didLeadChange);
    prevLeaderRef.current = currentLeader;

    // Update losing states
    setChallengerLosing(opponentScore > challengerScore);
    setOpponentLosing(challengerScore > opponentScore);

    // Reset lead changed flag after a short delay
    if (didLeadChange) {
      const timer = setTimeout(() => setLeadChanged(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [challengerScore, opponentScore, battleActive]);

  return { challengerLosing, opponentLosing, leadChanged };
}
