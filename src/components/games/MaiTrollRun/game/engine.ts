import {
  CLIMB_SCROLL_FACTOR,
  CLIMB_SPEED,
  COYOTE_TIME,
  CROUCH_HEIGHT,
  DIFFICULTIES,
  DOUBLE_JUMP_VELOCITY,
  DOUBLE_TAP_WINDOW,
  GRAVITY,
  GROUND_Y,
  HIGH_JUMP_VELOCITY,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  LADDER_GRAB_RANGE,
  LADDER_JUMP_VELOCITY,
  LEVEL_BANNER_SECONDS,
  LEVEL_COUNT,
  MAITROLL_LETTERS,
  POWER_COLORS,
  POWER_DURATIONS,
  RUNNER_HEIGHT,
  RUNNER_WIDTH,
  SLOW_FACTOR,
  WORLD_HEIGHT,
  levelSpeed,
} from '@/components/games/MaiTrollRun/game/config';
import { generateLevel } from '@/components/games/MaiTrollRun/game/levelGenerator';
import type {
  Box,
  Difficulty,
  Gender,
  GameState,
  Hazard,
  HudSnapshot,
  InputState,
  Ladder,
  LevelData,
  Particle,
  Pickup,
  PowerKind,
  PowerState,
  Runner,
  RunOutcome,
  RunSummary,
  Surface,
} from '@/components/games/MaiTrollRun/game/types';

export function createGameState(difficulty: Difficulty, gender: Gender, seed: number): GameState {
  const level = generateLevel(0, difficulty, seed);
  return {
    difficulty,
    gender,
    seed,
    level,
    levelIndex: 0,
    runner: createRunner(level),
    power: { shield: 0, magnet: 0, slow: 0 },
    status: 'banner',
    statusTimer: LEVEL_BANNER_SECONDS,
    time: 0,
    distanceBase: 0,
    letters: MAITROLL_LETTERS.map(() => false),
    levelsCleared: 0,
    coins: 0,
    bonusScore: 0,
    particles: [],
  };
}

export function isRunOver(status: GameState['status']): status is RunOutcome {
  return status === 'dead' || status === 'won' || status === 'escaped';
}

export function stepGame(s: GameState, dt: number, input: InputState): void {
  s.time += dt;
  stepParticles(s.particles, dt);

  if (s.status === 'banner') {
    s.statusTimer -= dt;
    if (s.statusTimer <= 0) s.status = 'playing';
    return;
  }
  if (s.status !== 'playing') return;

  tickPowers(s.power, dt);
  const runner = s.runner;
  runner.jumpBuffer = input.jumpPressed ? JUMP_BUFFER_TIME : Math.max(0, runner.jumpBuffer - dt);

  const speed = levelSpeed(s.difficulty, s.levelIndex) * (s.power.slow > 0 ? SLOW_FACTOR : 1);
  runner.worldX += (runner.mode === 'climb' ? speed * CLIMB_SCROLL_FACTOR : speed) * dt;

  if (runner.mode === 'run') stepRunning(s, input);
  else if (runner.mode === 'air') stepAir(s, dt);
  else stepClimb(s, input, dt);

  if (s.status !== 'playing') return;
  checkHazards(s);
  if (s.status !== 'playing') return;
  collectPickups(s, dt);
  if (runner.worldX >= s.level.length) completeLevel(s);
}

export function endRun(s: GameState): void {
  if (s.status !== 'playing' && s.status !== 'banner') return;
  s.status = 'dead';
  burst(s, s.runner.worldX, s.runner.feetY - 40, '#b91c1c', 30);
}

export function getDistance(s: GameState): number {
  return s.distanceBase + s.runner.worldX;
}

export function getScore(s: GameState): number {
  return Math.floor(getDistance(s) / 10) + s.bonusScore;
}

export function summarizeRun(s: GameState): RunSummary {
  return {
    outcome: s.status === 'won' ? 'won' : s.status === 'escaped' ? 'escaped' : 'dead',
    score: getScore(s),
    levelsCleared: s.levelsCleared,
    lettersCollected: s.letters.filter(Boolean).length,
    coins: s.coins,
  };
}

export function snapshotGame(s: GameState): HudSnapshot {
  return {
    levelNumber: s.levelIndex + 1,
    levelCount: LEVEL_COUNT,
    themeName: s.level.theme.name,
    score: getScore(s),
    coins: s.coins,
    letters: [...s.letters],
    progress: Math.min(1, Math.max(0, s.runner.worldX / s.level.length)),
    status: s.status,
    power: { ...s.power },
  };
}

export function hazardBox(hazard: Hazard, time: number): Box {
  const bob = hazard.kind === 'bat' ? Math.sin(time * 2.6 + hazard.phase) * 28 : 0;
  return { x: hazard.x, y: hazard.y + bob, w: hazard.w, h: hazard.h };
}

function createRunner(level: LevelData): Runner {
  return {
    worldX: 0,
    feetY: GROUND_Y,
    vy: 0,
    mode: 'run',
    surface: level.ground[0],
    ladder: null,
    coyote: COYOTE_TIME,
    jumpBuffer: 0,
    airJumpReady: true,
    airTime: 0,
    crouching: false,
  };
}

function stepRunning(s: GameState, input: InputState): void {
  const runner = s.runner;
  const surface = runner.surface;
  if (!surface || runner.worldX < surface.x1 || runner.worldX > surface.x2) {
    runner.mode = 'air';
    runner.surface = null;
    runner.vy = 0;
    return;
  }

  runner.feetY = surface.y;
  runner.coyote = COYOTE_TIME;
  runner.airJumpReady = true;
  runner.airTime = 0;

  const ladderEnd = input.up ? 'bottom' : input.down ? 'top' : null;
  if (ladderEnd) {
    const ladder = findGrabbableLadder(s.level.ladders, runner, ladderEnd);
    if (ladder) {
      startClimb(runner, ladder);
      return;
    }
  }

  runner.crouching = input.down;
  if (runner.jumpBuffer > 0) jump(runner, JUMP_VELOCITY);
}

function stepAir(s: GameState, dt: number): void {
  const runner = s.runner;
  const previousFeet = runner.feetY;
  runner.vy += GRAVITY * dt;
  runner.airTime += dt;
  runner.feetY += runner.vy * dt;
  runner.coyote = Math.max(0, runner.coyote - dt);

  if (runner.jumpBuffer > 0) {
    if (runner.coyote > 0) {
      jump(runner, JUMP_VELOCITY);
    } else if (runner.airJumpReady) {
      runner.airJumpReady = false;
      const doubleTap = runner.airTime <= DOUBLE_TAP_WINDOW;
      jump(runner, doubleTap ? HIGH_JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY);
    }
  }

  if (runner.vy >= 0) {
    const landing = findLanding(s.level, runner.worldX, previousFeet, runner.feetY);
    if (landing) {
      runner.mode = 'run';
      runner.surface = landing;
      runner.feetY = landing.y;
      runner.vy = 0;
      runner.coyote = COYOTE_TIME;
      return;
    }
  }

  if (runner.feetY > WORLD_HEIGHT + 80) endRun(s);
}

function stepClimb(s: GameState, input: InputState, dt: number): void {
  const runner = s.runner;
  const ladder = runner.ladder;
  if (!ladder) {
    runner.mode = 'air';
    return;
  }

  if (runner.jumpBuffer > 0) {
    runner.ladder = null;
    jump(runner, LADDER_JUMP_VELOCITY);
    return;
  }

  if (input.up) runner.feetY -= CLIMB_SPEED * dt;
  if (input.down) runner.feetY += CLIMB_SPEED * dt;
  runner.feetY = Math.min(ladder.bottom, Math.max(ladder.top, runner.feetY));

  if (input.up && runner.feetY <= ladder.top) {
    const platform = s.level.platforms.find(
      (p) => p.y === ladder.top && runner.worldX >= p.x1 && runner.worldX <= p.x2,
    );
    leaveLadder(runner, platform ?? null);
  } else if (input.down && runner.feetY >= ladder.bottom) {
    const ground = s.level.ground.find(
      (g) => g.y === ladder.bottom && runner.worldX >= g.x1 && runner.worldX <= g.x2,
    );
    leaveLadder(runner, ground ?? null);
  }
}

function findGrabbableLadder(ladders: Ladder[], runner: Runner, end: 'top' | 'bottom'): Ladder | null {
  return (
    ladders.find(
      (ladder) =>
        Math.abs(ladder.x - runner.worldX) <= LADDER_GRAB_RANGE &&
        Math.abs(runner.feetY - ladder[end]) < 1,
    ) ?? null
  );
}

function startClimb(runner: Runner, ladder: Ladder): void {
  runner.mode = 'climb';
  runner.crouching = false;
  runner.ladder = ladder;
  runner.surface = null;
  runner.vy = 0;
  runner.jumpBuffer = 0;
}

function leaveLadder(runner: Runner, surface: Surface | null): void {
  runner.ladder = null;
  runner.vy = 0;
  if (surface) {
    runner.mode = 'run';
    runner.surface = surface;
    runner.feetY = surface.y;
  } else {
    runner.mode = 'air';
    runner.surface = null;
  }
}

function jump(runner: Runner, velocity: number): void {
  runner.mode = 'air';
  runner.surface = null;
  runner.vy = -velocity;
  runner.crouching = false;
  runner.airTime = 0;
  runner.jumpBuffer = 0;
  runner.coyote = 0;
}

function findLanding(level: LevelData, x: number, previousY: number, nextY: number): Surface | null {
  let best: Surface | null = null;
  for (const surface of [...level.ground, ...level.platforms]) {
    const crossing = previousY <= surface.y + 0.5 && nextY >= surface.y;
    const inside = x >= surface.x1 && x <= surface.x2;
    if (crossing && inside && (!best || surface.y < best.y)) best = surface;
  }
  return best;
}

function checkHazards(s: GameState): void {
  const runner = s.runner;
  const height = runner.crouching ? CROUCH_HEIGHT : RUNNER_HEIGHT;
  const body: Box = {
    x: runner.worldX - RUNNER_WIDTH / 2,
    y: runner.feetY - height,
    w: RUNNER_WIDTH,
    h: height,
  };
  for (const hazard of s.level.hazards) {
    if (hazard.spent || Math.abs(hazard.x - runner.worldX) > 140) continue;
    if (!intersects(body, hazardBox(hazard, s.time), 5)) continue;
    if (s.power.shield > 0) {
      s.power.shield = 0;
      hazard.spent = true;
      burst(s, hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, POWER_COLORS.shield, 18);
    } else {
      endRun(s);
      return;
    }
  }
}

function intersects(a: Box, b: Box, inset: number): boolean {
  return (
    a.x < b.x + b.w - inset &&
    a.x + a.w > b.x + inset &&
    a.y < b.y + b.h - inset &&
    a.y + a.h > b.y + inset
  );
}

function collectPickups(s: GameState, dt: number): void {
  const runner = s.runner;
  const bodyY = runner.feetY - RUNNER_HEIGHT / 2;
  for (const pickup of s.level.pickups) {
    if (pickup.taken) continue;
    if (s.power.magnet > 0 && pickup.kind === 'coin' && Math.abs(pickup.x - runner.worldX) < 220) {
      const pull = Math.min(1, dt * 6);
      pickup.x += (runner.worldX - pickup.x) * pull;
      pickup.y += (bodyY - pickup.y) * pull;
    }
    if (Math.abs(pickup.x - runner.worldX) < 30 && Math.abs(pickup.y - bodyY) < 50) {
      pickup.taken = true;
      applyPickup(s, pickup);
    }
  }
}

function applyPickup(s: GameState, pickup: Pickup): void {
  if (pickup.kind === 'coin') {
    s.coins += DIFFICULTIES[s.difficulty].coinValue;
    s.bonusScore += 10;
    burst(s, pickup.x, pickup.y, '#fbbf24', 8);
    return;
  }
  if (pickup.kind === 'letter' && pickup.letterIndex !== undefined) {
    s.letters[pickup.letterIndex] = true;
    s.bonusScore += 500;
    burst(s, pickup.x, pickup.y, '#fde68a', 26);
    return;
  }
  if (pickup.kind === 'power' && pickup.power) {
    applyPower(s.power, pickup.power);
    s.bonusScore += 50;
    burst(s, pickup.x, pickup.y, POWER_COLORS[pickup.power], 20);
  }
}

function applyPower(power: PowerState, kind: PowerKind): void {
  switch (kind) {
    case 'shield':
      power.shield = POWER_DURATIONS.shield;
      break;
    case 'magnet':
      power.magnet = POWER_DURATIONS.magnet;
      break;
    case 'slow':
      power.slow = POWER_DURATIONS.slow;
      break;
  }
}

function tickPowers(power: PowerState, dt: number): void {
  power.shield = Math.max(0, power.shield - dt);
  power.magnet = Math.max(0, power.magnet - dt);
  power.slow = Math.max(0, power.slow - dt);
}

function completeLevel(s: GameState): void {
  s.levelsCleared += 1;
  s.bonusScore += 1000;
  if (s.levelIndex === LEVEL_COUNT - 1) {
    s.status = s.letters.every(Boolean) ? 'won' : 'escaped';
    return;
  }
  s.distanceBase += s.level.length;
  s.levelIndex += 1;
  s.level = generateLevel(s.levelIndex, s.difficulty, s.seed);
  s.runner = createRunner(s.level);
  s.status = 'banner';
  s.statusTimer = LEVEL_BANNER_SECONDS;
}

function burst(s: GameState, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 260;
    const life = 0.5 + Math.random() * 0.5;
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120,
      life,
      maxLife: life,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function stepParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 900 * dt;
  }
}
