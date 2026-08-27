export interface MaiBagTier {
  level: number
  multiplier: number
  name: string
  visualType: string
  capacityMultiplier: number
  glowClass: string
  particleIntensity: number
  bgClass: string
  textClass: string
  borderClass: string
  accentClass: string
}

export const MAI_BAG_TIERS: MaiBagTier[] = [
  {
    level: 1,
    multiplier: 1,
    name: 'Clear',
    visualType: 'clear',
    capacityMultiplier: 1,
    glowClass: 'shadow-[0_0_18px_rgba(34,211,238,0.25)]',
    particleIntensity: 1,
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-200',
    borderClass: 'border-cyan-400/40',
    accentClass: 'bg-cyan-400',
  },
  {
    level: 2,
    multiplier: 2,
    name: 'Red',
    visualType: 'red',
    capacityMultiplier: 1.5,
    glowClass: 'shadow-[0_0_22px_rgba(248,113,113,0.35)]',
    particleIntensity: 2,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-200',
    borderClass: 'border-red-400/50',
    accentClass: 'bg-red-400',
  },
  {
    level: 3,
    multiplier: 4,
    name: 'Orange',
    visualType: 'orange',
    capacityMultiplier: 2,
    glowClass: 'shadow-[0_0_24px_rgba(251,146,60,0.35)]',
    particleIntensity: 2,
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-200',
    borderClass: 'border-orange-400/50',
    accentClass: 'bg-orange-400',
  },
  {
    level: 4,
    multiplier: 8,
    name: 'Yellow',
    visualType: 'yellow',
    capacityMultiplier: 2.5,
    glowClass: 'shadow-[0_0_26px_rgba(250,204,21,0.35)]',
    particleIntensity: 3,
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-200',
    borderClass: 'border-yellow-400/50',
    accentClass: 'bg-yellow-400',
  },
  {
    level: 5,
    multiplier: 16,
    name: 'Green',
    visualType: 'green',
    capacityMultiplier: 3,
    glowClass: 'shadow-[0_0_28px_rgba(52,211,153,0.35)]',
    particleIntensity: 3,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-200',
    borderClass: 'border-emerald-400/50',
    accentClass: 'bg-emerald-400',
  },
  {
    level: 6,
    multiplier: 32,
    name: 'Blue',
    visualType: 'blue',
    capacityMultiplier: 4,
    glowClass: 'shadow-[0_0_30px_rgba(56,189,248,0.40)]',
    particleIntensity: 4,
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-200',
    borderClass: 'border-sky-400/50',
    accentClass: 'bg-sky-400',
  },
  {
    level: 7,
    multiplier: 64,
    name: 'Purple',
    visualType: 'purple',
    capacityMultiplier: 5,
    glowClass: 'shadow-[0_0_34px_rgba(192,132,252,0.45)]',
    particleIntensity: 5,
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-200',
    borderClass: 'border-purple-400/60',
    accentClass: 'bg-purple-400',
  },
  {
    level: 8,
    multiplier: 128,
    name: 'Rainbow',
    visualType: 'rainbow',
    capacityMultiplier: 6,
    glowClass: 'shadow-[0_0_38px_rgba(244,114,182,0.50)]',
    particleIntensity: 6,
    bgClass: 'bg-gradient-to-br from-fuchsia-500/10 via-cyan-500/10 to-amber-500/10',
    textClass: 'text-fuchsia-200',
    borderClass: 'border-fuchsia-400/60',
    accentClass: 'bg-gradient-to-r from-fuchsia-400 via-cyan-400 to-amber-400',
  },
  {
    level: 9,
    multiplier: 256,
    name: 'Silver',
    visualType: 'silver',
    capacityMultiplier: 8,
    glowClass: 'shadow-[0_0_42px_rgba(203,213,225,0.50)]',
    particleIntensity: 7,
    bgClass: 'bg-slate-300/10',
    textClass: 'text-slate-200',
    borderClass: 'border-slate-300/60',
    accentClass: 'bg-slate-200',
  },
  {
    level: 10,
    multiplier: 512,
    name: 'Gold',
    visualType: 'gold',
    capacityMultiplier: 10,
    glowClass: 'shadow-[0_0_46px_rgba(251,191,36,0.55)]',
    particleIntensity: 8,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-200',
    borderClass: 'border-amber-300/70',
    accentClass: 'bg-amber-400',
  },
  {
    level: 11,
    multiplier: 1024,
    name: 'Maroon',
    visualType: 'maroon',
    capacityMultiplier: 12,
    glowClass: 'shadow-[0_0_50px_rgba(225,29,72,0.60)]',
    particleIntensity: 9,
    bgClass: 'bg-rose-900/10',
    textClass: 'text-rose-200',
    borderClass: 'border-rose-900/70',
    accentClass: 'bg-rose-600',
  },
  {
    level: 12,
    multiplier: 2048,
    name: 'Diamond',
    visualType: 'diamond',
    capacityMultiplier: 15,
    glowClass: 'shadow-[0_0_56px_rgba(34,211,238,0.65)]',
    particleIntensity: 10,
    bgClass: 'bg-cyan-200/10',
    textClass: 'text-cyan-100',
    borderClass: 'border-cyan-200/70',
    accentClass: 'bg-gradient-to-r from-cyan-200 via-white to-cyan-200',
  },
]

export const BASE_CAPACITY = 10000

export function getTierByLevel(level: number): MaiBagTier {
  const tier = MAI_BAG_TIERS.find((t) => t.level === level)
  if (tier) return tier
  const maxTier = MAI_BAG_TIERS[MAI_BAG_TIERS.length - 1]
  if (level > maxTier.level) {
    return {
      ...maxTier,
      level,
      name: `${maxTier.name} ${level - maxTier.level + 1}`,
      capacityMultiplier: maxTier.capacityMultiplier + (level - maxTier.level) * 2,
    }
  }
  return MAI_BAG_TIERS[0]
}

export function getTierByMultiplier(multiplier: number): MaiBagTier {
  const sorted = [...MAI_BAG_TIERS].sort((a, b) => a.multiplier - b.multiplier)
  let match = sorted[0]
  for (const tier of sorted) {
    if (multiplier >= tier.multiplier) match = tier
    else break
  }
  return match
}

export function formatMultiplier(multiplier: number): string {
  if (multiplier >= 1_000_000) return `${(multiplier / 1_000_000).toFixed(1)}M`
  if (multiplier >= 1_000) return `${(multiplier / 1_000).toFixed(multiplier % 1000 === 0 ? 0 : 1)}K`
  return String(multiplier)
}

export function getFillPercent(currentValue: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0
  return Math.min(100, Math.max(0, (currentValue / capacity) * 100))
}
