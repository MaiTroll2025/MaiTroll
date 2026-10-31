export type Gender = 'male' | 'female';
export type Difficulty = 'easy' | 'normal' | 'brutal' | 'nightmare';
export type HazardKind = 'spikes' | 'boulder' | 'bat';
export type PowerKind = 'shield' | 'magnet' | 'slow';
export type PickupKind = 'coin' | 'letter' | 'power';
export type RunnerMode = 'run' | 'air' | 'climb';
export type RunOutcome = 'dead' | 'won' | 'escaped';
export type GameStatus = 'banner' | 'playing' | RunOutcome;

export interface DifficultyConfig {
  label: string;
  description: string;
  entryFee: number;
  baseSpeed: number;
  gapScale: number;
  spacingScale: number;
  batWeight: number;
  coinValue: number;
  powerUpChance: number;
}

export interface LevelTheme {
  name: string;
  skyTop: string;
  skyBottom: string;
  glow: string;
  farRidge: string;
  nearRidge: string;
  treeFar: string;
  treeNear: string;
  stoneLight: string;
  stoneDark: string;
  mortar: string;
  lip: string;
  accent: string;
  fog: string;
}

export interface Surface {
  x1: number;
  x2: number;
  y: number;
}

export interface Ladder {
  x: number;
  top: number;
  bottom: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  phase: number;
  spent: boolean;
}

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  taken: boolean;
  letterIndex?: number;
  power?: PowerKind;
}

export interface LevelData {
  index: number;
  length: number;
  ground: Surface[];
  platforms: Surface[];
  ladders: Ladder[];
  hazards: Hazard[];
  pickups: Pickup[];
  theme: LevelTheme;
}

export interface Runner {
  worldX: number;
  feetY: number;
  vy: number;
  mode: RunnerMode;
  surface: Surface | null;
  ladder: Ladder | null;
  coyote: number;
  jumpBuffer: number;
  airJumpReady: boolean;
  airTime: number;
  crouching: boolean;
}

export interface PowerState {
  shield: number;
  magnet: number;
  slow: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  difficulty: Difficulty;
  gender: Gender;
  seed: number;
  levelIndex: number;
  level: LevelData;
  runner: Runner;
  power: PowerState;
  status: GameStatus;
  statusTimer: number;
  time: number;
  distanceBase: number;
  letters: boolean[];
  levelsCleared: number;
  coins: number;
  bonusScore: number;
  particles: Particle[];
}

export interface InputState {
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
}

export interface HudSnapshot {
  levelNumber: number;
  levelCount: number;
  themeName: string;
  score: number;
  coins: number;
  letters: boolean[];
  progress: number;
  status: GameStatus;
  power: PowerState;
}

export interface RunSummary {
  outcome: RunOutcome;
  score: number;
  levelsCleared: number;
  lettersCollected: number;
  coins: number;
}
