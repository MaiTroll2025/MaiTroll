import React from 'react';
import {
  ChaosPulsePowerUp, CriticalStrikePowerUp, CrownBoosterPowerUp, EnergyShieldPowerUp,
  OverchargePowerUp, PowerSurgePowerUp, TrollSpeedModePowerUp, TrollTaxPowerUp,
  TurtleModePowerUp, UltimateModePowerUp, GhostModePowerUp,
} from '../pages/dev/powerups/PowerUpIcons';

export type PowerUpId =
  | 'turtle' | 'speed' | 'overcharge' | 'shield' | 'crit' | 'surge'
  | 'chaos' | 'ultimate' | 'crown' | 'tax' | 'ghost';

export type Side = 'green' | 'purple';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  desc: string;
  icon: React.ComponentType<any>;
  duration: number; // seconds, 0 = instant/single-use
  singleUse: boolean;
  color: string;
}

export const POWER_UPS: Record<PowerUpId, PowerUpDef> = {
  turtle: { id: 'turtle', name: 'Turtle Mode', desc: 'Reduce incoming damage by 60%.', icon: TurtleModePowerUp, duration: 8, singleUse: false, color: '#63ff9b' },
  speed: { id: 'speed', name: 'Troll Speed', desc: 'Attack speed +50%.', icon: TrollSpeedModePowerUp, duration: 6, singleUse: false, color: '#63ff9b' },
  overcharge: { id: 'overcharge', name: 'Overcharge', desc: 'Attack power +25%.', icon: OverchargePowerUp, duration: 10, singleUse: false, color: '#c084fc' },
  shield: { id: 'shield', name: 'Energy Shield', desc: 'Block one incoming hit.', icon: EnergyShieldPowerUp, duration: 8, singleUse: true, color: '#63ff9b' },
  crit: { id: 'crit', name: 'Critical Strike', desc: 'Double next attack.', icon: CriticalStrikePowerUp, duration: 0, singleUse: true, color: '#c084fc' },
  surge: { id: 'surge', name: 'Power Surge', desc: '+20 power meter points.', icon: PowerSurgePowerUp, duration: 0, singleUse: true, color: '#63ff9b' },
  chaos: { id: 'chaos', name: 'Chaos Pulse', desc: 'Disrupt opponent visuals 3s.', icon: ChaosPulsePowerUp, duration: 3, singleUse: false, color: '#c084fc' },
  ultimate: { id: 'ultimate', name: 'Ultimate Mode', desc: 'Full-meter finisher.', icon: UltimateModePowerUp, duration: 0, singleUse: true, color: '#ffe38a' },
  crown: { id: 'crown', name: 'Crown Booster', desc: 'Bonus battle points 10s.', icon: CrownBoosterPowerUp, duration: 10, singleUse: false, color: '#ffe38a' },
  tax: { id: 'tax', name: 'Troll Tax', desc: 'Deduct opponent points.', icon: TrollTaxPowerUp, duration: 0, singleUse: true, color: '#ff617e' },
  ghost: { id: 'ghost', name: 'Ghost Mode', desc: 'Hide your team score for 10s.', icon: GhostModePowerUp, duration: 10, singleUse: true, color: '#63a4ff' },
};

export const POWER_UP_POOL: PowerUpId[] = Object.keys(POWER_UPS) as PowerUpId[];

export const SLOTS_PER_SIDE = 3;

export function randomPowerUp(): PowerUpId {
  return POWER_UP_POOL[Math.floor(Math.random() * POWER_UP_POOL.length)];
}

export const POWER_UP_CONFIG = {
  giftTriggerChance: 0.6,
  giftValueThreshold: 1,
  activationCost: 100,
  maxSlots: 3,
};
