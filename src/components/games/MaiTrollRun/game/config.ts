import type { Difficulty, DifficultyConfig, LevelTheme, PowerKind } from '@/components/games/MaiTrollRun/game/types';

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const GROUND_Y = 430;
export const PLATFORM_HEIGHT = 150;
export const RUNNER_X = 240;
export const RUNNER_WIDTH = 34;
export const RUNNER_HEIGHT = 84;

export const GRAVITY = 2100;
export const JUMP_VELOCITY = 700;
export const DOUBLE_JUMP_VELOCITY = 640;
export const HIGH_JUMP_VELOCITY = 990;
export const DOUBLE_TAP_WINDOW = 0.3;
export const CROUCH_HEIGHT = 44;
export const LADDER_JUMP_VELOCITY = 560;
export const CLIMB_SPEED = 300;
export const CLIMB_SCROLL_FACTOR = 0.12;
export const LADDER_GRAB_RANGE = 30;
export const COYOTE_TIME = 0.07;
export const JUMP_BUFFER_TIME = 0.18;
export const SLOW_FACTOR = 0.65;

export const LEVEL_COUNT = 8;
export const LEVEL_BANNER_SECONDS = 2.4;
export const LEVEL_SPEED_STEP = 22;
export const MAITROLL_LETTERS = ['M', 'A', 'I', 'T', 'R', 'O', 'L', 'L'] as const;

export const POWER_KINDS: PowerKind[] = ['shield', 'magnet', 'slow'];
export const POWER_DURATIONS: Record<PowerKind, number> = {
  shield: 9,
  magnet: 8,
  slow: 6,
};
export const POWER_LABELS: Record<PowerKind, string> = {
  shield: 'Shield',
  magnet: 'Magnet',
  slow: 'Slow Time',
};
export const POWER_COLORS: Record<PowerKind, string> = {
  shield: '#38bdf8',
  magnet: '#2dd4bf',
  slow: '#fb923c',
};

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Easy',
    description: 'Slower trolls, but the gaps are tighter than you expect.',
    entryFee: 10,
    baseSpeed: 340,
    gapScale: 1,
    spacingScale: 0.92,
    batWeight: 0.9,
    coinValue: 1,
    powerUpChance: 0.22,
  },
  normal: {
    label: 'Normal',
    description: 'Faster hunters, more bats, double coin payout.',
    entryFee: 20,
    baseSpeed: 390,
    gapScale: 1.08,
    spacingScale: 0.86,
    batWeight: 1.2,
    coinValue: 2,
    powerUpChance: 0.18,
  },
  brutal: {
    label: 'Brutal',
    description: 'Tight timing and cramped jumps. Triple coin payout.',
    entryFee: 35,
    baseSpeed: 440,
    gapScale: 1.16,
    spacingScale: 0.8,
    batWeight: 1.5,
    coinValue: 3,
    powerUpChance: 0.15,
  },
  nightmare: {
    label: 'Nightmare',
    description: 'Relentless speed. Quadruple coins for the brave.',
    entryFee: 50,
    baseSpeed: 490,
    gapScale: 1.24,
    spacingScale: 0.74,
    batWeight: 1.8,
    coinValue: 4,
    powerUpChance: 0.12,
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'brutal', 'nightmare'];

export const LEVEL_THEMES: LevelTheme[] = [
  {
    name: 'Bog Dusk',
    skyTop: '#1f3430',
    skyBottom: '#c7875c',
    glow: '#f8d48a',
    farRidge: '#34483f',
    nearRidge: '#1b2722',
    treeFar: '#24352f',
    treeNear: '#101a15',
    stoneLight: '#7a7560',
    stoneDark: '#3b3a2e',
    mortar: '#1d1c14',
    lip: '#5f7a3a',
    accent: '#f2b64a',
    fog: '#d8c49a',
  },
  {
    name: 'Iron Cavern',
    skyTop: '#101318',
    skyBottom: '#4a4e57',
    glow: '#ff9a4d',
    farRidge: '#2d3138',
    nearRidge: '#1d2026',
    treeFar: '#262a31',
    treeNear: '#14161a',
    stoneLight: '#6b6f78',
    stoneDark: '#33363d',
    mortar: '#181a1f',
    lip: '#7c5a3a',
    accent: '#fb923c',
    fog: '#6b6f78',
  },
  {
    name: 'Frost Peaks',
    skyTop: '#23414f',
    skyBottom: '#a6c9cf',
    glow: '#eaf8ff',
    farRidge: '#5d7f8c',
    nearRidge: '#3a5664',
    treeFar: '#4a6b78',
    treeNear: '#24404b',
    stoneLight: '#c9d8dc',
    stoneDark: '#5f7680',
    mortar: '#3b4d55',
    lip: '#e5f1f5',
    accent: '#7dd3fc',
    fog: '#e6f2f5',
  },
  {
    name: 'Ember Ruins',
    skyTop: '#2a120e',
    skyBottom: '#b4532a',
    glow: '#ffb347',
    farRidge: '#5b2a1c',
    nearRidge: '#33150e',
    treeFar: '#3b1b12',
    treeNear: '#1f0c08',
    stoneLight: '#8a6a58',
    stoneDark: '#3f2a22',
    mortar: '#241510',
    lip: '#c2410c',
    accent: '#fb923c',
    fog: '#e0a070',
  },
  {
    name: 'Rotting Forest',
    skyTop: '#14231a',
    skyBottom: '#56733f',
    glow: '#d9f08a',
    farRidge: '#2b4a33',
    nearRidge: '#18281c',
    treeFar: '#1f3a28',
    treeNear: '#0d1a10',
    stoneLight: '#6e7a62',
    stoneDark: '#363e30',
    mortar: '#1c2218',
    lip: '#4d7c0f',
    accent: '#bef264',
    fog: '#aac98a',
  },
  {
    name: 'Storm Moor',
    skyTop: '#18222c',
    skyBottom: '#5d7c8f',
    glow: '#a5e8ff',
    farRidge: '#37505f',
    nearRidge: '#222f3a',
    treeFar: '#2c3f4c',
    treeNear: '#152029',
    stoneLight: '#7c8a93',
    stoneDark: '#3d4850',
    mortar: '#20282e',
    lip: '#4b6b5b',
    accent: '#67e8f9',
    fog: '#9fb8c4',
  },
  {
    name: 'Blood Moon Crag',
    skyTop: '#2a0c10',
    skyBottom: '#8f2d2d',
    glow: '#ff6b5b',
    farRidge: '#4a1a1e',
    nearRidge: '#2b0f13',
    treeFar: '#3a1418',
    treeNear: '#1d0a0d',
    stoneLight: '#7a5450',
    stoneDark: '#3a2423',
    mortar: '#231414',
    lip: '#7f1d1d',
    accent: '#f87171',
    fog: '#c0605a',
  },
  {
    name: 'Maitroll Throne',
    skyTop: '#1b1a12',
    skyBottom: '#84703a',
    glow: '#ffd45c',
    farRidge: '#4a4124',
    nearRidge: '#2b2716',
    treeFar: '#3a3419',
    treeNear: '#1c190d',
    stoneLight: '#9c8d62',
    stoneDark: '#4d4530',
    mortar: '#2a2616',
    lip: '#a16207',
    accent: '#fde047',
    fog: '#d6bf7a',
  },
];

export function levelSpeed(difficulty: Difficulty, levelIndex: number): number {
  return DIFFICULTIES[difficulty].baseSpeed + levelIndex * LEVEL_SPEED_STEP;
}
