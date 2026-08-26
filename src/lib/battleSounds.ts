// Battle sound effects using Web Audio API — no external files needed
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) { /* ignore audio errors */ }
}

export const BattleSounds = {
  /** Short bright ping when a gift is sent */
  giftSent: () => {
    playTone(880, 0.15, 'sine', 0.12);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.08), 80);
  },

  /** Rising two-tone when score updates */
  scoreUpdate: () => {
    playTone(660, 0.12, 'triangle', 0.1);
    setTimeout(() => playTone(880, 0.15, 'triangle', 0.1), 100);
  },

  /** Dramatic low tone for sudden death */
  suddenDeath: () => {
    playTone(220, 0.4, 'sawtooth', 0.12);
    setTimeout(() => playTone(185, 0.5, 'sawtooth', 0.1), 300);
    setTimeout(() => playTone(165, 0.6, 'sawtooth', 0.08), 600);
  },

  /** Battle start fanfare */
  battleStart: () => {
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'triangle', 0.1), i * 120);
    });
  },

  /** Victory fanfare */
  battleEnd: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'triangle', 0.12), i * 150);
    });
  },

  /** Quick tick for timer urgency (last 10 seconds) */
  timerTick: () => {
    playTone(1200, 0.05, 'square', 0.06);
  },

  /** Subtle whoosh when gift overlay opens */
  trayOpen: () => {
    playTone(440, 0.08, 'sine', 0.04);
  },

  /** Error / insufficient coins */
  error: () => {
    playTone(200, 0.2, 'square', 0.08);
    setTimeout(() => playTone(160, 0.25, 'square', 0.06), 150);
  },
};
