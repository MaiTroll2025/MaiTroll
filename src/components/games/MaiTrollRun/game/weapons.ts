import type { GunKey } from './types';

export interface GameWeapon {
  key: GunKey;
  name: string;
  page: string;
  price: number;
  description: string;
  range: number;
  targets: number;
  cooldownMs: number;
  color: string;
}

export const WEAPONS: GameWeapon[] = [
  {
    key: 'maipiks_popper',
    name: 'MaiPiks Popper',
    page: 'MaiPiks',
    price: 500,
    description: 'A quick single-target shot.',
    range: 560,
    targets: 1,
    cooldownMs: 650,
    color: '#f9a8d4',
  },
  {
    key: 'troll_court_judge',
    name: 'Troll Court Gavel Gun',
    page: 'Troll Court',
    price: 2500,
    description: 'A longer shot that can clear two hazards.',
    range: 850,
    targets: 2,
    cooldownMs: 780,
    color: '#fcd34d',
  },
  {
    key: 'troll_city_blaster',
    name: 'Troll City Blaster',
    page: 'Troll City',
    price: 9000,
    description: 'A rapid shot with extended range.',
    range: 1150,
    targets: 2,
    cooldownMs: 420,
    color: '#67e8f9',
  },
  {
    key: 'maitroll_cannon',
    name: 'MaiTroll Throne Cannon',
    page: 'MaiTroll Run',
    price: 20000,
    description: 'The longest-range shot, clearing up to four hazards.',
    range: 1550,
    targets: 4,
    cooldownMs: 900,
    color: '#fde047',
  },
];

export function getWeapon(key: GunKey | null | undefined): GameWeapon | undefined {
  return WEAPONS.find((weapon) => weapon.key === key);
}
