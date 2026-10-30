// BattleArena sound + announcer engine (preview, Web Audio + speechSynthesis)
export type SoundType =
  | 'powerup_awarded' | 'powerup_activated' | 'turtle' | 'speed' | 'overcharge'
  | 'shield_block' | 'crit' | 'surge' | 'chaos' | 'ultimate' | 'crown' | 'tax'
  | 'expire' | 'cooldown' | 'battle_start' | 'countdown' | 'gift' | 'score_up'
  | 'score_down' | 'hit' | 'meter' | 'ultimate_ready' | 'timer_warn' | 'battle_end'
  | 'victory' | 'defeat' | 'tie' | 'crown_reward';

export type AnnounceLine =
  | 'countdown' | 'battle_start' | 'battle_underway' | 'sudden_death' | 'final_countdown'
  | 'critical' | 'ultimate_available' | 'battle_end' | 'victory' | 'defeat' | 'tie'
  | 'powerup_awarded' | 'turtle' | 'speed' | 'overcharge' | 'shield' | 'crit' | 'surge'
  | 'chaos' | 'ultimate' | 'crown_booster' | 'tax' | 'crown_reward';

const ANNOUNCE_TEXT: Record<AnnounceLine, string> = {
  countdown: 'Three... Two... One...',
  battle_start: 'BATTLE COMMENCES NOW!',
  battle_underway: 'Let the battle begin!',
  sudden_death: 'SUDDEN DEATH!',
  final_countdown: 'Ten seconds remaining!',
  critical: 'This battle is reaching its breaking point!',
  ultimate_available: 'ULTIMATE POWER UNLEASHED!',
  battle_end: 'The battle is over!',
  victory: 'WE HAVE A WINNER!',
  defeat: 'The battle has been lost!',
  tie: "IT'S A DRAW!",
  powerup_awarded: 'A POWER-UP HAS ARRIVED!',
  turtle: 'TURTLE MODE ACTIVATED!',
  speed: 'TROLL SPEED ACTIVATED!',
  overcharge: 'OVERCHARGE!',
  shield: 'ENERGY SHIELD ENGAGED!',
  crit: 'CRITICAL STRIKE!',
  surge: 'POWER SURGE!',
  chaos: 'CHAOS HAS BEEN UNLEASHED!',
  ultimate: 'UNLEASH THE ULTIMATE!',
  crown_booster: 'CROWN POWER ACTIVATED!',
  tax: 'POINTS HAVE BEEN TAKEN!',
  crown_reward: 'THE CROWN GOES TO THE WINNER!',
};

class BattleSoundEngine {
  private ctx: AudioContext | null = null;
  private master = 1;
  private effects = 1;
  private notify = 1;
  private muted = false;
  private announcerOn = true;
  private announcerVol = 1;
  private queue: AnnounceLine[] = [];
  private speaking = false;
  private lastAnnounce = 0;
  private cooldown = 800;

  init() {
    if (this.ctx) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch { this.ctx = null; }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMasterVolume(v: number) { this.master = Math.max(0, Math.min(1, v)); }
  setEffectsVolume(v: number) { this.effects = Math.max(0, Math.min(1, v)); }
  setNotificationVolume(v: number) { this.notify = Math.max(0, Math.min(1, v)); }
  setMuted(v: boolean) { this.muted = v; if (v) this.stopAll(); }
  setAnnouncerOn(v: boolean) { this.announcerOn = v; }
  setAnnouncerVolume(v: number) { this.announcerVol = Math.max(0, Math.min(1, v)); }

  private gain(mult = 1) {
    if (!this.ctx || this.muted) return null;
    const g = this.ctx.createGain();
    g.gain.value = this.master * mult;
    g.connect(this.ctx.destination);
    return g;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, ramp = true) {
    if (!this.ctx || this.muted) return;
    this.resume();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol * this.master * this.effects;
    if (ramp) { g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur); }
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  play(type: SoundType) {
    if (this.muted) return;
    this.init(); this.resume();
    switch (type) {
      case 'powerup_awarded': this.tone(660, 0.2, 'triangle', 0.18); setTimeout(() => this.tone(880, 0.25, 'triangle', 0.16), 120); break;
      case 'powerup_activated': this.tone(520, 0.15, 'square', 0.14); setTimeout(() => this.tone(780, 0.2, 'square', 0.14), 100); break;
      case 'turtle': this.tone(220, 0.35, 'sine', 0.16); break;
      case 'speed': this.tone(880, 0.12, 'sawtooth', 0.12); setTimeout(() => this.tone(1100, 0.12, 'sawtooth', 0.12), 80); break;
      case 'overcharge': this.tone(330, 0.15, 'sawtooth', 0.14); setTimeout(() => this.tone(660, 0.2, 'sawtooth', 0.16), 120); break;
      case 'shield_block': this.tone(440, 0.18, 'triangle', 0.16); break;
      case 'crit': this.tone(990, 0.12, 'square', 0.18); break;
      case 'surge': this.tone(440, 0.1, 'sine', 0.14); setTimeout(() => this.tone(660, 0.1, 'sine', 0.14), 90); setTimeout(() => this.tone(880, 0.15, 'sine', 0.16), 180); break;
      case 'chaos': this.tone(180, 0.25, 'sawtooth', 0.12); break;
      case 'ultimate': this.tone(220, 0.2, 'sawtooth', 0.18); setTimeout(() => this.tone(440, 0.2, 'sawtooth', 0.18), 150); setTimeout(() => this.tone(880, 0.35, 'sawtooth', 0.2), 300); break;
      case 'crown': this.tone(784, 0.2, 'triangle', 0.16); break;
      case 'tax': this.tone(140, 0.3, 'square', 0.16); break;
      case 'expire': this.tone(300, 0.15, 'sine', 0.1); break;
      case 'cooldown': this.tone(500, 0.1, 'sine', 0.1); break;
      case 'battle_start': this.tone(440, 0.2, 'triangle', 0.18); setTimeout(() => this.tone(660, 0.2, 'triangle', 0.18), 180); setTimeout(() => this.tone(880, 0.3, 'triangle', 0.2), 360); break;
      case 'countdown': this.tone(660, 0.12, 'square', 0.14); break;
      case 'gift': this.tone(700, 0.1, 'triangle', 0.12); break;
      case 'score_up': this.tone(600, 0.1, 'sine', 0.12); break;
      case 'score_down': this.tone(200, 0.15, 'square', 0.12); break;
      case 'hit': this.tone(160, 0.08, 'square', 0.14); break;
      case 'meter': this.tone(500, 0.08, 'sine', 0.1); break;
      case 'ultimate_ready': this.tone(880, 0.25, 'triangle', 0.18); break;
      case 'timer_warn': this.tone(440, 0.12, 'square', 0.14); break;
      case 'battle_end': this.tone(330, 0.3, 'triangle', 0.16); break;
      case 'victory': this.tone(523, 0.15, 'triangle', 0.18); setTimeout(() => this.tone(659, 0.15, 'triangle', 0.18), 150); setTimeout(() => this.tone(784, 0.3, 'triangle', 0.2), 300); break;
      case 'defeat': this.tone(392, 0.2, 'sawtooth', 0.14); setTimeout(() => this.tone(330, 0.25, 'sawtooth', 0.14), 200); break;
      case 'tie': this.tone(440, 0.2, 'sine', 0.14); setTimeout(() => this.tone(440, 0.2, 'sine', 0.14), 250); break;
      case 'crown_reward': this.tone(988, 0.3, 'triangle', 0.18); break;
    }
  }

  announce(line: AnnounceLine, priority = false) {
    if (!this.announcerOn || this.muted) return;
    const now = Date.now();
    if (!priority && now - this.lastAnnounce < this.cooldown) return;
    this.lastAnnounce = now;
    this.queue.push(line);
    if (priority) {
      // move to front
      this.queue = [line, ...this.queue.filter((l) => l !== line)];
    }
    this.processQueue();
  }

  private processQueue() {
    if (this.speaking || this.queue.length === 0) return;
    const line = this.queue.shift()!;
    const text = ANNOUNCE_TEXT[line];
    this.speaking = true;
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const deep = voices.find((v) => /male|david|daniel|google uk english male/i.test(v.name)) || voices[0];
        if (deep) u.voice = deep;
        u.rate = 0.9;
        u.pitch = 0.8;
        u.volume = this.master * this.announcerVol * this.notify;
        u.onend = () => { this.speaking = false; this.processQueue(); };
        u.onerror = () => { this.speaking = false; this.processQueue(); };
        window.speechSynthesis.speak(u);
      } else {
        this.speaking = false;
        this.processQueue();
      }
    } catch {
      this.speaking = false;
      this.processQueue();
    }
  }

  stopAll() {
    if (this.ctx) {
      try { this.ctx.suspend(); } catch {}
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
  }

  dispose() {
    this.stopAll();
    if (this.ctx) { try { this.ctx.close(); } catch {} this.ctx = null; }
  }

  testAnnouncer() { this.announce('battle_start', true); }
}

export const battleSound = new BattleSoundEngine();

export function initBattleAudio() { battleSound.init(); battleSound.resume(); }
