export type HapticEvent =
  | 'battle_start' | 'gift' | 'powerup_awarded' | 'powerup_activated' | 'turtle'
  | 'speed' | 'crit' | 'shield_block' | 'ultimate' | 'score_big' | 'timer_warn'
  | 'victory' | 'defeat';

const PATTERNS: Record<HapticEvent, number | number[]> = {
  battle_start: [30, 40, 30],
  gift: 15,
  powerup_awarded: [20, 30, 20],
  powerup_activated: 25,
  turtle: [10, 20, 10],
  speed: [8, 12, 8, 12],
  crit: 40,
  shield_block: [15, 20, 15],
  ultimate: [50, 30, 80],
  score_big: 20,
  timer_warn: [10, 10, 10],
  victory: [40, 30, 40, 30, 60],
  defeat: [60, 40, 60],
};

class BattleHaptics {
  private enabled = true;
  private last = 0;
  private minGap = 120;

  isSupported() { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
  setEnabled(v: boolean) { this.enabled = v; }
  stop() { if (this.isSupported()) try { navigator.vibrate(0); } catch {} }
  dispose() { this.stop(); }

  vibrate(event: HapticEvent) {
    if (!this.enabled || !this.isSupported()) return;
    const now = Date.now();
    if (now - this.last < this.minGap) return;
    this.last = now;
    try { navigator.vibrate(PATTERNS[event]); } catch {}
  }
}

export const battleHaptics = new BattleHaptics();
export function isHapticsSupported() { return battleHaptics.isSupported(); }
