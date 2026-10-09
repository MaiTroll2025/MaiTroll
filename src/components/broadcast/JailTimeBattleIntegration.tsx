/**
 * JailTimeBattleIntegration
 *
 * Wrapper components and helpers for integrating JAIL TIME effects
 * into the existing BattleView/BattleArena without modifying core files.
 *
 * Two integration approaches:
 *
 *  APPROACH A — Drop-in wrapper (recommended):
 *    Wrap the BattleArena output with <JailTimeArenaWrapper>
 *    and pass score props. Overlays are auto-positioned.
 *
 *  APPROACH B — Per-tile injection:
 *    Use <JailTimeHostTile> to wrap individual host tiles
 *    for granular control.
 */

import React from 'react';
import JailBarOverlay from './JailBarOverlay';
import { useJailTime } from '../../hooks/useJailTime';

// ─── Approach A: Arena Wrapper ───────────────────────────────────
// Wraps the entire battle arena and auto-injects overlays on the
// two host tile containers using DOM refs.

export interface JailTimeArenaWrapperProps {
  children: React.ReactNode;
  challengerScore: number;
  opponentScore: number;
  battleActive: boolean;
  soundEnabled?: boolean;
  ambientEnabled?: boolean;
  ambientVolume?: number;
}

export function JailTimeArenaWrapper({
  children,
  challengerScore,
  opponentScore,
  battleActive,
  soundEnabled = true,
  ambientEnabled = true,
  ambientVolume = 0.04,
}: JailTimeArenaWrapperProps) {
  const {
    challengerLosing,
    opponentLosing,
    onChallengerJailLock,
    onChallengerJailUnlock,
    onOpponentJailLock,
    onOpponentJailUnlock,
  } = useJailTime({
    challengerScore,
    opponentScore,
    battleActive,
    soundEnabled,
    ambientEnabled,
    ambientVolume,
  });

  // We use a portal-like approach: render overlays as absolutely
  // positioned divs that track the host tile positions.
  // For simplicity, we render them as siblings inside a relative container.
  return (
    <div className="relative w-full h-full">
      {children}

      {/* Jail overlays rendered as absolute overlays.
          They use position: absolute inset: 0 to cover their parent.
          We place them here at the arena level and they cover the
          entire arena — CSS clip-path or containment handles per-side. */}
      {challengerLosing && (
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <JailBarOverlay
            side="challenger"
            isLosing={true}
            onBarsLocked={onChallengerJailLock}
            onBarsFreed={onChallengerJailUnlock}
          />
        </div>
      )}
      {opponentLosing && (
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <JailBarOverlay
            side="opponent"
            isLosing={true}
            onBarsLocked={onOpponentJailLock}
            onBarsFreed={onOpponentJailUnlock}
          />
        </div>
      )}
    </div>
  );
}

// ─── Approach B: Per-Host-Tile Injection ─────────────────────────
// Wraps a single host tile with the jail overlay.
// Use this when you have direct access to the host tile JSX.

export interface JailTimeHostTileProps {
  children: React.ReactNode;
  side: 'challenger' | 'opponent';
  isLosing: boolean;
  onJailLock?: () => void;
  onJailUnlock?: () => void;
  showWarningLights?: boolean;
  showTextBanner?: boolean;
}

export function JailTimeHostTile({
  children,
  side,
  isLosing,
  onJailLock,
  onJailUnlock,
  showWarningLights = true,
  showTextBanner = true,
}: JailTimeHostTileProps) {
  return (
    <div className="relative w-full h-full">
      {children}
      <JailBarOverlay
        side={side}
        isLosing={isLosing}
        onBarsLocked={onJailLock}
        onBarsFreed={onJailUnlock}
        showWarningLights={showWarningLights}
        showTextBanner={showTextBanner}
      />
    </div>
  );
}

// ─── Approach C: Hook-only (for custom integrations) ─────────────
// Just use useJailTime() hook directly and render JailBarOverlay
// wherever you need it.

// Re-export for convenience
export { default as JailBarOverlay } from './JailBarOverlay';
