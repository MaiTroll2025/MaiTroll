import { Howl } from 'howler';

const SOUNDS = {
  jump: '/sounds/click.mp3',
  doubleJump: '/sounds/rocket.mp3',
  coin: '/sounds/troll.mp3',
  levelComplete: '/sounds/confetti.mp3',
  die: '/sounds/click.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

const instances: Record<SoundName, Howl | null> = {
  jump: null,
  doubleJump: null,
  coin: null,
  levelComplete: null,
  die: null,
};

let enabled = true;

function get(name: SoundName): Howl {
  if (!instances[name]) {
    instances[name] = new Howl({ src: [SOUNDS[name]], volume: 0.6, preload: true });
  }
  return instances[name] as Howl;
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function isSoundEnabled() {
  return enabled;
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    get(name).play();
  } catch {
    // fail silent: audio context may be suspended until user gesture
  }
}

export function playJump() {
  playSound('jump');
}

export function playDoubleJump() {
  playSound('doubleJump');
}

export function playCoin() {
  playSound('coin');
}

export function playLevelComplete() {
  playSound('levelComplete');
}

export function playDie() {
  playSound('die');
}
