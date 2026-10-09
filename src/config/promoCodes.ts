export interface PromoCodeConfig {
  code: string;
  description: string;
  type: 'pet_health' | 'tokens' | 'coins' | 'perk' | 'custom';
  value: number | string;
  durationHours?: number;
  maxUses?: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export const PROMO_CODES: PromoCodeConfig[] = [
  {
    code: 'ceopet1',
    description: 'Unlimited Pet Health - Keeps pet at 100% health for 1 day',
    type: 'pet_health',
    value: 100,
    durationHours: 24,
    maxUses: -1,
    isActive: true,
    metadata: {
      effect: 'maintain_max_health',
      healthTypes: ['care_status', 'hunger_status', 'walk_status', 'attention_status'],
    },
  },
];

export function getPromoCode(code: string): PromoCodeConfig | undefined {
  return PROMO_CODES.find((pc) => pc.code.toLowerCase() === code.toLowerCase() && pc.isActive);
}

export function getAllPromoCodes(): PromoCodeConfig[] {
  return PROMO_CODES.filter((pc) => pc.isActive);
}

export function isPromoCodeValid(code: string): boolean {
  const promo = getPromoCode(code);
  if (!promo) return false;
  if (promo.maxUses !== undefined && promo.maxUses > 0 && promo.maxUses <= 0) return false;
  return true;
}