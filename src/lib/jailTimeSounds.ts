/**
 * JailTimeSounds — Web Audio API sound effects for the JAIL TIME battle effect.
 *
 * All sounds are synthesized procedurally — no external audio files needed.
 * Uses a shared AudioContext with lazy initialization.
 *
 * Sound categories:
 *   1. JAIL LOCK   — Heavy steel door slam + metallic clank when bars lock
 *   2. JAIL UNLOCK — Metal latch release + chain rattle when bars descend
 *   3. LEAD CHANGE — Alarm whoosh + crowd burst when battle lead flips
 *   4. AMBIENT     — Background stadium atmosphere during battle
 *   5. SCORE SWING — Deep bass impact for large score differences
 */

// ─── Audio Context Singleton ─────────────────────────────────────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

// ─── Utility helpers ─────────────────────────────────────────────
function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  delay = 0,
  detune = 0
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    if (detune) osc.detune.setValueAtTime(detune, ctx.currentTime + delay);
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch (__) { /* ignore */ }
}

function playNoiseBurst(
  ctx: AudioContext,
  duration: number,
  volume = 0.1,
  delay = 0,
  filterFreq = 2000,
  filterType: BiquadFilterType = 'bandpass'
) {
  try {
    const noise = createNoise(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + delay);
    filter.Q.setValueAtTime(1, ctx.currentTime + delay);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime + delay);
    noise.stop(ctx.currentTime + delay + duration);
  } catch (__) { /* ignore */ }
}

// ─── 1. JAIL LOCK SOUND ─────────────────────────────────────────
// Heavy steel prison door slam + metallic clanking + deep cinematic impact
// Duration: ~0.8 seconds
export function playJailLockSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const _t = ctx.currentTime;

  // ── Deep bass impact (the "slam") ──
  playTone(ctx, 55, 0.4, 'sine', 0.25, 0);       // Sub bass thud
  playTone(ctx, 80, 0.3, 'sine', 0.18, 0.02);     // Bass body
  playTone(ctx, 120, 0.2, 'triangle', 0.12, 0.04); // Mid punch

  // ── Steel door impact noise ──
  playNoiseBurst(ctx, 0.15, 0.2, 0, 800, 'highpass');
  playNoiseBurst(ctx, 0.1, 0.15, 0.03, 1200, 'highpass');

  // ── Metallic clanking (multiple hits) ──
  playTone(ctx, 800, 0.08, 'square', 0.06, 0.08);
  playTone(ctx, 1200, 0.06, 'square', 0.04, 0.12);
  playTone(ctx, 600, 0.1, 'sawtooth', 0.05, 0.15);
  playTone(ctx, 1000, 0.07, 'square', 0.04, 0.2);
  playTone(ctx, 700, 0.08, 'sawtooth', 0.03, 0.25);

  // ── Rattle decay ──
  playNoiseBurst(ctx, 0.3, 0.06, 0.1, 3000, 'bandpass');
  playNoiseBurst(ctx, 0.2, 0.04, 0.2, 2500, 'bandpass');

  // ── Low resonance tail ──
  playTone(ctx, 45, 0.6, 'sine', 0.1, 0.05);
  playTone(ctx, 90, 0.4, 'sine', 0.06, 0.1);
}

// ─── 2. JAIL UNLOCK / FREEDOM SOUND ─────────────────────────────
// Metal latch release + bars sliding + chain rattle + positive feel
// Duration: ~0.6 seconds
export function playJailUnlockSound() {
  const ctx = getCtx();
  if (!ctx) return;

  // ── Latch release click ──
  playTone(ctx, 2000, 0.03, 'square', 0.08, 0);
  playTone(ctx, 3000, 0.02, 'square', 0.05, 0.02);
  playNoiseBurst(ctx, 0.05, 0.1, 0, 4000, 'highpass');

  // ── Bars sliding down (descending metallic scrape) ──
  playTone(ctx, 600, 0.25, 'sawtooth', 0.04, 0.05);
  // Descending pitch
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.35);
  oscGain.gain.setValueAtTime(0.05, ctx.currentTime + 0.05);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(ctx.currentTime + 0.05);
  osc.stop(ctx.currentTime + 0.35);

  // ── Chain rattle ──
  playNoiseBurst(ctx, 0.15, 0.06, 0.1, 5000, 'bandpass');
  playNoiseBurst(ctx, 0.1, 0.04, 0.18, 4500, 'bandpass');
  playNoiseBurst(ctx, 0.08, 0.03, 0.25, 5500, 'bandpass');

  // ── Positive "freedom" chime ──
  playTone(ctx, 523, 0.2, 'sine', 0.08, 0.2);  // C5
  playTone(ctx, 659, 0.2, 'sine', 0.06, 0.25); // E5
  playTone(ctx, 784, 0.25, 'sine', 0.05, 0.3); // G5
}

// ─── 3. LEAD CHANGE SOUND ───────────────────────────────────────
// Alarm-style notification + crowd reaction burst + fast whoosh
// Duration: ~0.7 seconds
export function playLeadChangeSound() {
  const ctx = getCtx();
  if (!ctx) return;

  // ── Alarm-style two-tone alert ──
  playTone(ctx, 880, 0.15, 'square', 0.1, 0);
  playTone(ctx, 1100, 0.15, 'square', 0.1, 0.15);
  playTone(ctx, 880, 0.15, 'square', 0.08, 0.3);
  playTone(ctx, 1100, 0.2, 'square', 0.08, 0.45);

  // ── Fast whoosh (noise sweep) ──
  const noiseDuration = 0.3;
  const noise = createNoise(ctx, noiseDuration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(500, ctx.currentTime + 0.1);
  filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.1 + noiseDuration);
  filter.Q.setValueAtTime(2, ctx.currentTime + 0.1);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1 + noiseDuration);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(ctx.currentTime + 0.1);
  noise.stop(ctx.currentTime + 0.1 + noiseDuration);

  // ── Crowd burst (filtered noise) ──
  playNoiseBurst(ctx, 0.4, 0.1, 0.2, 800, 'lowpass');
  playNoiseBurst(ctx, 0.3, 0.06, 0.35, 1200, 'lowpass');

  // ── Impact boom ──
  playTone(ctx, 60, 0.3, 'sine', 0.15, 0.3);
  playTone(ctx, 100, 0.2, 'triangle', 0.08, 0.35);
}

// ─── 4. SCORE SWING (large score difference) ────────────────────
// Deep bass impact for when the gap widens significantly
export function playScoreSwingSound(severity: 'small' | 'medium' | 'large' = 'medium') {
  const ctx = getCtx();
  if (!ctx) return;

  const volumes = { small: 0.08, medium: 0.12, large: 0.18 };
  const v = volumes[severity];

  playTone(ctx, 50, 0.3, 'sine', v, 0);
  playTone(ctx, 75, 0.25, 'sine', v * 0.7, 0.05);
  playTone(ctx, 100, 0.2, 'triangle', v * 0.5, 0.1);

  if (severity === 'large') {
    playNoiseBurst(ctx, 0.15, v * 0.8, 0, 600, 'lowpass');
    playTone(ctx, 40, 0.4, 'sine', v * 0.6, 0.05);
  }
}

// ─── 5. BATTLE AMBIENT BACKGROUND ────────────────────────────────
// High-energy stadium atmosphere — managed as a looping system

class BattleAmbientEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private intervalIds: ReturnType<typeof setInterval>[] = [];
  private oscillators: OscillatorNode[] = [];

  start(volume = 0.04) {
    this.ctx = getCtx();
    if (!this.ctx || this.isPlaying) return;
    this.isPlaying = true;

    // Master gain for all ambient sounds
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // ── Crowd murmur loop (low-passed noise bursts) ──
    const crowdLoop = () => {
      if (!this.ctx || !this.masterGain) return;
      const dur = 1.5 + Math.random() * 1.5;
      const noise = createNoise(this.ctx, dur);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400 + Math.random() * 300, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const v = 0.03 + Math.random() * 0.03;
      gain.gain.setValueAtTime(v, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start();
      noise.stop(this.ctx.currentTime + dur);
    };

    // Initial crowd
    crowdLoop();

    // Repeat crowd murmur
    const crowdInterval = setInterval(crowdLoop, 2000 + Math.random() * 1500);
    this.intervalIds.push(crowdInterval);

    // ── Occasional crowd cheer ──
    const cheerLoop = () => {
      if (!this.ctx || !this.masterGain) return;
      const dur = 0.8 + Math.random() * 0.6;
      const noise = createNoise(this.ctx, dur);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600 + Math.random() * 400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start();
      noise.stop(this.ctx.currentTime + dur);
    };

    const cheerInterval = setInterval(() => {
      if (Math.random() > 0.4) cheerLoop();
    }, 3000 + Math.random() * 2000);
    this.intervalIds.push(cheerInterval);

    // ── Tension riser (periodic low drone) ──
    const droneLoop = () => {
      if (!this.ctx || !this.masterGain) return;
      const dur = 2 + Math.random() * 2;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
      this.oscillators.push(osc);
    };

    const droneInterval = setInterval(droneLoop, 5000 + Math.random() * 3000);
    this.intervalIds.push(droneInterval);
  }

  stop() {
    this.isPlaying = false;
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    this.oscillators.forEach(osc => {
      try { osc.stop(); } catch (__) {}
    });
    this.oscillators = [];
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        try { this.masterGain?.disconnect(); } catch (__) {}
        this.masterGain = null;
      }, 600);
    }
  }

  setVolume(v: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

// Singleton ambient engine
let _ambientEngine: BattleAmbientEngine | null = null;

export function startBattleAmbient(volume = 0.04) {
  if (!_ambientEngine) _ambientEngine = new BattleAmbientEngine();
  _ambientEngine.start(volume);
}

export function stopBattleAmbient() {
  _ambientEngine?.stop();
}

export function setBattleAmbientVolume(v: number) {
  _ambientEngine?.setVolume(v);
}

export function isBattleAmbientPlaying() {
  return _ambientEngine?.getIsPlaying() ?? false;
}

// ─── 6. CLOSE / TENSION RISER ───────────────────────────────────
// Rising tension when scores are close
export function playTensionRiser() {
  const ctx = getCtx();
  if (!ctx) return;

  const dur = 1.5;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.04, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + dur * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

// ─── 7. VICTORY STINGER ─────────────────────────────────────────
// Short victory fan when lead changes decisively
export function playVictoryStinger() {
  const ctx = getCtx();
  if (!ctx) return;

  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    playTone(ctx, freq, 0.25, 'triangle', 0.1, i * 0.1);
    playTone(ctx, freq * 1.5, 0.2, 'sine', 0.04, i * 0.1); // fifth harmony
  });

  // Impact
  playTone(ctx, 60, 0.2, 'sine', 0.12, 0.35);
  playNoiseBurst(ctx, 0.15, 0.08, 0.35, 500, 'lowpass');
}

// ─── 8. COMBO / MULTIPLE JAIL (rapid lead changes) ──────────────
// Playful "back and forth" sound
export function playJailComboSound() {
  const ctx = getCtx();
  if (!ctx) return;

  // Quick ascending-descending pattern
  playTone(ctx, 400, 0.08, 'square', 0.06, 0);
  playTone(ctx, 600, 0.08, 'square', 0.06, 0.08);
  playTone(ctx, 800, 0.08, 'square', 0.06, 0.16);
  playTone(ctx, 600, 0.08, 'square', 0.05, 0.24);
  playTone(ctx, 400, 0.1, 'square', 0.04, 0.32);

  // Comedic slide whistle effect
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

// ─── Exported API ────────────────────────────────────────────────
export const JailTimeSounds = {
  /** Heavy steel door slam — bars lock into place */
  jailLock: playJailLockSound,
  /** Metal latch release — bars descend, freedom! */
  jailUnlock: playJailUnlockSound,
  /** Alarm + whoosh — lead has changed */
  leadChange: playLeadChangeSound,
  /** Deep bass impact — score gap widening */
  scoreSwing: playScoreSwingSound,
  /** Start looping stadium ambient */
  startAmbient: startBattleAmbient,
  /** Stop ambient */
  stopAmbient: stopBattleAmbient,
  /** Set ambient volume (0-1) */
  setAmbientVolume: setBattleAmbientVolume,
  /** Is ambient currently playing */
  isAmbientPlaying: isBattleAmbientPlaying,
  /** Rising tension — close scores */
  tensionRiser: playTensionRiser,
  /** Victory fanfare — decisive lead change */
  victoryStinger: playVictoryStinger,
  /** Combo sound — rapid back-and-forth jail */
  jailCombo: playJailComboSound,
};
