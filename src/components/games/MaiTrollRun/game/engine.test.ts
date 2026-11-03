import { describe, expect, it } from 'vitest';
import { createGameState, fireWeapon } from './engine';
import { WEAPONS } from './weapons';

describe('MaiTroll Run checkpoints and weapons', () => {
  it('restores a checkpoint at the next uncleared level', () => {
    const checkpoint = {
      levelIndex: 3,
      letters: [true, false, true, false, false, false, false, false],
      coins: 7,
      bonusScore: 2000,
      distanceBase: 18000,
    };

    const state = createGameState('normal', 'female', 42, checkpoint);

    expect(state.levelIndex).toBe(3);
    expect(state.levelsCleared).toBe(3);
    expect(state.level.index).toBe(3);
    expect(state.letters).toEqual(checkpoint.letters);
    expect(state.coins).toBe(7);
    expect(state.distanceBase).toBe(18000);
  });

  it('clears nearby hazards with an equipped weapon and records a shot', () => {
    const state = createGameState('easy', 'male', 42);
    state.status = 'playing';
    state.level.hazards = [
      { kind: 'boulder', x: 400, y: 380, w: 44, h: 58, phase: 0, spent: false },
      { kind: 'spikes', x: 900, y: 380, w: 44, h: 58, phase: 0, spent: false },
    ];

    fireWeapon(state, WEAPONS[0]);

    expect(state.level.hazards[0].spent).toBe(true);
    expect(state.level.hazards[1].spent).toBe(false);
    expect(state.shots).toHaveLength(1);
  });
});
