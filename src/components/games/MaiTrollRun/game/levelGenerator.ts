import {
  DIFFICULTIES,
  GROUND_Y,
  LEVEL_THEMES,
  PLATFORM_HEIGHT,
  POWER_KINDS,
} from '@/components/games/MaiTrollRun/game/config';
import type {
  Difficulty,
  Hazard,
  HazardKind,
  Ladder,
  LevelData,
  Pickup,
  Surface,
} from '@/components/games/MaiTrollRun/game/types';

type Chunk = 'spikes' | 'boulder' | 'pit' | 'pitSpikes' | 'bats' | 'platform' | 'coins';

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLevel(levelIndex: number, difficulty: Difficulty, runSeed: number): LevelData {
  const config = DIFFICULTIES[difficulty];
  const random = createRandom(runSeed + (levelIndex + 1) * 7919);
  const between = (min: number, max: number) => min + random() * (max - min);
  const ramp = 1 + levelIndex * 0.06;
  const length = 6400 + levelIndex * 650;
  const letterX = length * between(0.4, 0.5);

  const ground: Surface[] = [];
  const platforms: Surface[] = [];
  const ladders: Ladder[] = [];
  const hazards: Hazard[] = [];
  const pickups: Pickup[] = [];
  let segmentStart = 0;
  let letterPlaced = false;

  const addCoins = (startX: number, count: number, y: number, spacing: number) => {
    for (let i = 0; i < count; i++) {
      pickups.push({ kind: 'coin', x: startX + i * spacing, y, taken: false });
    }
  };

  const addHazard = (kind: HazardKind, x: number, y: number, w: number, h: number) => {
    hazards.push({ kind, x, y, w, h, phase: random() * Math.PI * 2, spent: false });
  };

  const spikes = (x: number): number => {
    const roll = random();
    const count = roll < 0.5 ? 1 : roll < 0.8 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      addHazard('spikes', x + i * 48, GROUND_Y - 34, 40, 34);
    }
    return x + count * 48;
  };

  const boulder = (x: number): number => {
    addHazard('boulder', x, GROUND_Y - 58, 44, 58);
    return x + 44;
  };

  const pit = (x: number): number => {
    const gap = (84 + random() * 36 + levelIndex * 4) * config.gapScale;
    ground.push({ x1: segmentStart, x2: x, y: GROUND_Y });
    segmentStart = x + gap;
    addCoins(x + gap * 0.3, 3, GROUND_Y - 120, 30);
    return x + gap;
  };

  const pitWithSpikes = (x: number): number => spikes(pit(x) + 90);

  const bats = (x: number): number => {
    const count = random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      addHazard('bat', x + i * 150, GROUND_Y - 88, 42, 26);
    }
    return x + count * 150;
  };

  const platform = (x: number, withLetter: boolean): number => {
    const ladderX = x + 40;
    const top = GROUND_Y - PLATFORM_HEIGHT;
    const span = between(220, 340);
    platforms.push({ x1: ladderX - 30, x2: ladderX + span, y: top });
    ladders.push({ x: ladderX, top, bottom: GROUND_Y });
    addCoins(ladderX + 60, Math.floor(span / 60), top - 34, 44);
    if (withLetter) {
      pickups.push({
        kind: 'letter',
        x: ladderX + span * 0.5,
        y: top - 46,
        letterIndex: levelIndex,
        taken: false,
      });
    }
    return ladderX + span + 40;
  };

  const coinRun = (x: number): number => {
    addCoins(x, 6, GROUND_Y - 44, 34);
    return x + 6 * 34;
  };

  const powerAt = (x: number) => {
    pickups.push({
      kind: 'power',
      x,
      y: GROUND_Y - (random() < 0.5 ? 52 : 108),
      power: POWER_KINDS[Math.floor(random() * POWER_KINDS.length)],
      taken: false,
    });
  };

  const weights: Array<[Chunk, number]> = [
    ['spikes', 3],
    ['boulder', 2],
    ['pit', 2.2 * ramp],
    ['pitSpikes', 1.2 * ramp],
    ['bats', 1.6 * config.batWeight],
    ['platform', 1.5],
    ['coins', 1.2],
  ];
  const totalWeight = weights.reduce((sum, [, weight]) => sum + weight, 0);

  const pickChunk = (): Chunk => {
    let roll = random() * totalWeight;
    for (const [chunk, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return chunk;
    }
    return 'coins';
  };

  const runChunk = (chunk: Chunk, x: number): number => {
    switch (chunk) {
      case 'spikes':
        return spikes(x);
      case 'boulder':
        return boulder(x);
      case 'pit':
        return pit(x);
      case 'pitSpikes':
        return pitWithSpikes(x);
      case 'bats':
        return bats(x);
      case 'platform':
        return platform(x, false);
      case 'coins':
        return coinRun(x);
    }
  };

  let x = 640;
  while (x < length - 900) {
    const chunkStart = x;
    if (!letterPlaced && x >= letterX) {
      letterPlaced = true;
      x = platform(x, true);
    } else {
      x = runChunk(pickChunk(), x);
    }
    if (random() < config.powerUpChance) powerAt(chunkStart + 20);
    x += between(210, 340) * config.spacingScale * (1 - levelIndex * 0.015);
  }

  ground.push({ x1: segmentStart, x2: length + 600, y: GROUND_Y });

  return {
    index: levelIndex,
    length,
    ground,
    platforms,
    ladders,
    hazards,
    pickups,
    theme: LEVEL_THEMES[levelIndex],
  };
}
