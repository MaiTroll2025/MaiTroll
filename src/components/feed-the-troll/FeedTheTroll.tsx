import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import TrollCharacter from './TrollCharacter';
import TrollPanel from './TrollPanel';
import { useFeedTheTroll } from './useFeedTheTroll';
import type { TrollPersonalityState } from '@/types/feedTheTroll';
import './trollAnimations.css';

interface FeedTheTrollProps {
  broadcasterId: string;
  streamId?: string | null;
  /** Battle mode: render smaller, near the broadcaster's video. */
  battleMode?: boolean;
  battleId?: string | null;
  /** External battle state to drive winning/losing animations. */
  battleResult?: 'win' | 'lose' | 'tie' | null;
  /** Compact mode for mobile safe-area constraints. */
  compact?: boolean;
  /**
   * Stable key used to persist the draggable character position independently
   * per surface (e.g. 'broadcast' vs 'viewer') so the troll does not sit in the
   * same spot on both pages.
   */
  positionKey?: string;
}

interface FloatingIndicator {
  id: number;
  text: string;
  variant: string;
}

const ANIMATION_VARIANTS_BY_SIZE: Record<string, string[]> = {
  small: ['bite_1', 'bite_2', 'catch_and_chew', 'quick_snack'],
  medium: ['happy_hop', 'two_hand_feast', 'spin_and_bite', 'mini_dance'],
  large: ['belly_pat', 'big_burp', 'victory_dance', 'confetti_jump'],
  legendary: ['royal_feast', 'firework_pose', 'crown_glow', 'stage_transformation'],
};

function _pickVariant(size?: string): string {
  const list = ANIMATION_VARIANTS_BY_SIZE[size ?? 'small'] ?? ANIMATION_VARIANTS_BY_SIZE.small;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Persistent animated troll companion. Mounted on BroadcastPage, ViewerPage and
 * both BattleViews. All financial data comes from useFeedTheTroll (DB-backed);
 * the browser only drives *visual* state from safe event payloads.
 */
const FeedTheTroll: React.FC<FeedTheTrollProps> = ({
  broadcasterId,
  streamId,
  battleMode = false,
  battleId = null,
  battleResult = null,
  compact = false,
  positionKey = 'default',
}) => {
  const { state, leaderboard, recentFeedings, milestoneConfigs, milestones, settings, giftTrain, lastEvent, refresh } =
    useFeedTheTroll(broadcasterId, streamId, { battleId });

  const [panelOpen, setPanelOpen] = useState(false);
  const [visualState, setVisualState] = useState<TrollPersonalityState>('idle');
  const [indicators, setIndicators] = useState<FloatingIndicator[]>([]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const indicatorId = useRef(0);
  const particleId = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = state?.evolution_stage ?? 'baby';

  // ── Draggable position ────────────────────────────────────────────────
  // The troll defaults to the CSS anchor (bottom-right). Once the user drags
  // it, we store an absolute {x,y} (top-left, in px) in localStorage under a
  // surface-specific key so BroadcastPage and ViewerPage keep independent spots.
  const storageKey = `tc_troll_pos:${positionKey}`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(`tc_troll_pos:${positionKey}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
    } catch {
      /* ignore */
    }
    return null;
  });
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampToViewport = useCallback((x: number, y: number) => {
    const el = anchorRef.current;
    const w = el?.offsetWidth ?? 90;
    const h = el?.offsetHeight ?? 120;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only start dragging with primary button / touch / pen.
    if (e.button != null && e.button !== 0) return;
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) < 4) return; // tolerance so taps still open the panel
    if (!st.moved) {
      st.moved = true;
      setIsDragging(true);
      try {
        anchorRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const next = clampToViewport(st.originX + dx, st.originY + dy);
    setPosition(next);
  }, [clampToViewport]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragState.current = null;
    if (st.moved) {
      setIsDragging(false);
      try {
        anchorRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setPosition((pos) => {
        if (pos) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(pos));
          } catch {
            /* ignore */
          }
        }
        return pos;
      });
    }
  }, [storageKey]);

  // Keep the troll on-screen if the viewport is resized.
  useEffect(() => {
    if (!position) return;
    const onResize = () => setPosition((pos) => (pos ? clampToViewport(pos.x, pos.y) : pos));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position, clampToViewport]);

  // Resolve the highest-priority visual state from the latest event.
  useEffect(() => {
    if (!lastEvent) return;
    let next: TrollPersonalityState = 'eating';
    if (lastEvent.evolved) next = 'evolving';
    else if (lastEvent.cashoutCompleted) next = 'celebrating';
    else if (lastEvent.sizeCategory === 'legendary') next = 'surprised';
    else if (lastEvent.sizeCategory === 'large') next = 'excited';
    else next = 'eating';

    setVisualState(next);

    // Floating "+N" contribution indicator.
    if (lastEvent.trollAllocation && lastEvent.trollAllocation > 0) {
      const id = ++indicatorId.current;
      setIndicators((p) => [...p, { id, text: `+${lastEvent.trollAllocation}`, variant: lastEvent.sizeCategory ?? 'small' }]);
      setTimeout(() => setIndicators((p) => p.filter((i) => i.id !== id)), 1400);
    }

    // Particles for medium+ gifts (capped, mobile-aware).
    const cap = compact ? 6 : 12;
    const count = lastEvent.sizeCategory === 'legendary' ? cap : lastEvent.sizeCategory === 'large' ? Math.ceil(cap / 2) : 0;
    if (count > 0) {
      const colors = ['#fde047', '#fb7185', '#34d399', '#60a5fa', '#c084fc'];
      const burst = Array.from({ length: count }).map(() => ({
        id: ++particleId.current,
        x: (Math.random() - 0.5) * 80,
        y: -30 - Math.random() * 40,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles((p) => [...p, ...burst]);
      setTimeout(() => setParticles((p) => p.filter((b) => !burst.find((x) => x.id === b.id))), 1000);
    }

    // Revert to idle/sleep after the reaction.
    const revert = setTimeout(() => setVisualState('idle'), 1600);
    return () => clearTimeout(revert);
  }, [lastEvent, compact]);

  // Sleep / wake behavior based on last interaction time.
  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const sleepyMs = settings?.sleepy_after_idle_ms ?? 180000;
    const sleepMs = settings?.sleep_after_idle_ms ?? 300000;
    const last = state?.last_interaction_at ? new Date(state.last_interaction_at).getTime() : Date.now();
    const elapsed = Date.now() - last;
    if (elapsed >= sleepMs) {
      setVisualState('sleeping');
      return;
    }
    if (elapsed >= sleepyMs) setVisualState('sleepy');
    idleTimer.current = setTimeout(() => {
      const e2 = Date.now() - (state?.last_interaction_at ? new Date(state.last_interaction_at).getTime() : Date.now());
      if (e2 >= sleepMs) setVisualState('sleeping');
      else if (e2 >= sleepyMs) setVisualState('sleepy');
    }, Math.max(1000, sleepMs - elapsed));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [state?.last_interaction_at, settings]);

  // Battle result overrides visual state.
  useEffect(() => {
    if (!battleMode || !battleResult) return;
    if (battleResult === 'win') setVisualState('winning');
    else if (battleResult === 'lose') setVisualState('losing');
    else if (battleResult === 'tie') setVisualState('idle');
  }, [battleMode, battleResult]);

  const effectiveState = useMemo<TrollPersonalityState>(() => {
    if (battleMode && battleResult === 'win') return 'winning';
    if (battleMode && battleResult === 'lose') return 'losing';
    return visualState;
  }, [visualState, battleMode, battleResult]);

  const onTrollClick = useCallback(() => {
    // Ignore the click that ends a drag so dragging never opens the panel.
    if (isDragging) return;
    // Wake on click.
    setVisualState('excited');
    setPanelOpen(true);
    refresh();
  }, [refresh, isDragging]);

  const anchorClass = [
    'troll-live-anchor',
    battleMode ? 'troll-battle' : '',
    compact ? 'troll-compact' : '',
    isDragging ? 'troll-dragging' : '',
    !position ? `troll-surface-${positionKey}` : '',
  ].filter(Boolean).join(' ');

  // When a custom position exists, override the CSS anchor (bottom/right) with
  // an absolute left/top. `pointer-events` must be enabled on the anchor so the
  // whole troll area is grabbable for dragging (the CSS sets it to none).
  const anchorStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto',
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }
    : { position: 'fixed', pointerEvents: 'auto', touchAction: 'none', cursor: 'grab' };

  return (
    <>
      <div
        ref={anchorRef}
        className={anchorClass}
        style={anchorStyle}
        aria-hidden={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          type="button"
          onClick={onTrollClick}
          className="troll-character-button"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label="Open Feed the Troll panel"
        >
          <TrollCharacter stage={stage} state={effectiveState} seasonalTheme={state?.current_seasonal_theme ?? null} />
        </button>

        {indicators.map((ind) => (
          <div key={ind.id} className="troll-float-indicator">
            {ind.text} 🪙
          </div>
        ))}

        {particles.map((p) => (
          <span
            key={p.id}
            className="troll-particle"
            style={
              {
                left: '50%',
                top: '40%',
                background: p.color,
                '--px': `${p.x}px`,
                '--py': `${p.y}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <TrollPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        broadcasterId={broadcasterId}
        streamId={streamId}
        state={state}
        leaderboard={leaderboard}
        recentFeedings={recentFeedings}
        milestoneConfigs={milestoneConfigs}
        milestones={milestones}
        settings={settings}
        giftTrain={giftTrain}
        lastEvent={lastEvent}
        battleMode={battleMode}
      />
    </>
  );
};

export default FeedTheTroll;
