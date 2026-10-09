/**
 * JailTimeManager — Orchestrates the full JAIL TIME battle effect.
 *
 * This component wraps the battle arena and:
 *   1. Monitors both sides' scores in real-time
 *   2. Determines who is losing
 *   3. Renders JailBarOverlay on each losing broadcaster's frame
 *   4. Triggers all sound effects (lock, unlock, lead change, ambient)
 *   5. Manages the background stadium atmosphere
 *
 * Usage:
 *   <JailTimeManager
 *     challengerScore={challengerScore}
 *     opponentScore={opponentScore}
 *     battleActive={battleStatus === 'active'}
 *     challengerHostName={challengerHostName}
 *     opponentHostName={opponentHostName}
 *   >
 *     {children}
 *   </JailTimeManager>
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import JailBarOverlay from './JailBarOverlay';
import { JailTimeSounds } from '../../lib/jailTimeSounds';

// ─── Types ───────────────────────────────────────────────────────
export interface JailTimeManagerProps {
  /** Challenger side's current score */
  challengerScore: number;
  /** Opponent side's current score */
  opponentScore: number;
  /** Is the battle currently active? */
  battleActive: boolean;
  /** Challenger broadcaster's display name */
  challengerHostName?: string;
  /** Opponent broadcaster's display name */
  opponentHostName?: string;
  /** Enable all sound effects */
  soundEnabled?: boolean;
  /** Enable ambient background audio */
  ambientEnabled?: boolean;
  /** Ambient volume (0-1) */
  ambientVolume?: number;
  /** Children (the battle arena grid) */
  children: React.ReactNode;
  /** Ref to the challenger's video container element */
  challengerVideoRef?: React.RefObject<HTMLDivElement | null>;
  /** Ref to the opponent's video container element */
  opponentVideoRef?: React.RefObject<HTMLDivElement | null>;
}

// ─── Score difference severity ───────────────────────────────────
function getScoreSeverity(diff: number): 'small' | 'medium' | 'large' {
  if (diff > 5000) return 'large';
  if (diff > 1000) return 'medium';
  return 'small';
}

// ─── Component ───────────────────────────────────────────────────
export default function JailTimeManager({
  challengerScore,
  opponentScore,
  battleActive,
  challengerHostName = 'Challenger',
  opponentHostName = 'Opponent',
  soundEnabled = true,
  ambientEnabled = true,
  ambientVolume = 0.04,
  children,
  challengerVideoRef,
  opponentVideoRef,
}: JailTimeManagerProps) {
  // ── State ────────────────────────────────────────────────────
  const [challengerLosing, setChallengerLosing] = useState(false);
  const [opponentLosing, setOpponentLosing] = useState(false);
  const [_challengerLocked, setChallengerLocked] = useState(false);
  const [_opponentLocked, setOpponentLocked] = useState(false);

  // Refs for tracking previous state
  const prevChallengerLosing = useRef(false);
  const prevOpponentLosing = useRef(false);
  const prevLeaderRef = useRef<'challenger' | 'opponent' | 'tie' | null>(null);
  const prevScoreDiff = useRef(0);
  const comboCountRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Determine losing states ───────────────────────────────────
  useEffect(() => {
    if (!battleActive) {
      setChallengerLosing(false);
      setOpponentLosing(false);
      setChallengerLocked(false);
      setOpponentLocked(false);
      prevLeaderRef.current = null;
      comboCountRef.current = 0;
      return;
    }

    const newChallengerLosing = opponentScore > challengerScore;
    const newOpponentLosing = challengerScore > opponentScore;

    // ── Lead change detection ──
    const currentLeader: 'challenger' | 'opponent' | 'tie' =
      challengerScore > opponentScore ? 'challenger' :
      opponentScore > challengerScore ? 'opponent' : 'tie';

    const prevLeader = prevLeaderRef.current;
    const leadChanged = prevLeader !== null
      && currentLeader !== prevLeader
      && currentLeader !== 'tie';

    if (leadChanged && soundEnabled) {
      JailTimeSounds.leadChange();

      // Combo detection: rapid lead changes
      comboCountRef.current++;
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        if (comboCountRef.current >= 3) {
          JailTimeSounds.jailCombo();
        }
        comboCountRef.current = 0;
      }, 5000);

      // Victory stinger for decisive lead changes
      const scoreDiff = Math.abs(challengerScore - opponentScore);
      if (scoreDiff > 2000) {
        setTimeout(() => JailTimeSounds.victoryStinger(), 300);
      }
    }

    // ── Score swing detection ──
    const currentDiff = Math.abs(challengerScore - opponentScore);
    const diffIncrease = currentDiff - prevScoreDiff.current;
    if (diffIncrease > 500 && soundEnabled) {
      const severity = getScoreSeverity(diffIncrease);
      JailTimeSounds.scoreSwing(severity);
    }
    prevScoreDiff.current = currentDiff;

    // ── Tension riser for close battles ──
    if (battleActive && currentDiff < 500 && currentDiff > 0 && soundEnabled) {
      // Only occasionally
      if (Math.random() > 0.92) {
        JailTimeSounds.tensionRiser();
      }
    }

    prevLeaderRef.current = currentLeader;
    prevChallengerLosing.current = challengerLosing;
    prevOpponentLosing.current = opponentLosing;

    setChallengerLosing(newChallengerLosing);
    setOpponentLosing(newOpponentLosing);
  }, [challengerScore, opponentScore, battleActive, soundEnabled, challengerLosing, opponentLosing]);

  // ── Ambient audio management ──────────────────────────────────
  useEffect(() => {
    if (battleActive && ambientEnabled && soundEnabled) {
      if (!JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.startAmbient(ambientVolume);
      }
    } else {
      if (JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.stopAmbient();
      }
    }

    return () => {
      if (JailTimeSounds.isAmbientPlaying()) {
        JailTimeSounds.stopAmbient();
      }
    };
  }, [battleActive, ambientEnabled, soundEnabled, ambientVolume]);

  // ── Sound callbacks for bar lock/unlock ──────────────────────
  const handleChallengerBarsLocked = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailLock();
    setChallengerLocked(true);
  }, [soundEnabled]);

  const handleChallengerBarsFreed = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailUnlock();
    setChallengerLocked(false);
  }, [soundEnabled]);

  const handleOpponentBarsLocked = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailLock();
    setOpponentLocked(true);
  }, [soundEnabled]);

  const handleOpponentBarsFreed = useCallback(() => {
    if (soundEnabled) JailTimeSounds.jailUnlock();
    setOpponentLocked(false);
  }, [soundEnabled]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      {/* Main battle content */}
      {children}

      {/* Jail bar overlays — positioned over each broadcaster's frame */}
      {challengerVideoRef?.current && (
        <JailBarOverlay
          side="challenger"
          isLosing={challengerLosing}
          onBarsLocked={handleChallengerBarsLocked}
          onBarsFreed={handleChallengerBarsFreed}
          showWarningLights={true}
          showTextBanner={true}
        />
      )}

      {opponentVideoRef?.current && (
        <JailBarOverlay
          side="opponent"
          isLosing={opponentLosing}
          onBarsLocked={handleOpponentBarsLocked}
          onBarsFreed={handleOpponentBarsFreed}
          showWarningLights={true}
          showTextBanner={true}
        />
      )}

      {/* Status indicators (debug mode) */}
      {import.meta.env.DEV && battleActive && (
        <div className="absolute bottom-1 left-1 z-50 flex gap-2 text-[9px] font-mono pointer-events-none">
          {challengerLosing && (
            <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded">
              🔒 {challengerHostName} IN JAIL
            </span>
          )}
          {opponentLosing && (
            <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded">
              🔒 {opponentHostName} IN JAIL
            </span>
          )}
          {!challengerLosing && !opponentLosing && (
            <span className="bg-green-600/80 text-white px-1.5 py-0.5 rounded">
              ⚖️ TIED
            </span>
          )}
        </div>
      )}
    </div>
  );
}
