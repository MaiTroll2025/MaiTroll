/**
 * T LEAGUE CONFIGURATION — REWORKED
 * ==================================
 * Mai Troll Broadcast League System
 *
 * League score = total_xp (from the user XP/level system)
 *   - The T league reads from the same xp system the bottom nav bar uses
 *   - Gift XP, chat XP, watch XP, and all other XP sources contribute
 *   - When users receive gifts in broadcast, XP is awarded and counts
 *     towards their T league tier
 *
 * Sub-tiers: Each main tier (T0-T10) has 4 sub-levels: a, b, c, d
 *   Progress within a tier is divided into 4 equal quarters
 *   T0a (start) → T0b (25%) → T0c (50%) → T0d (75%) → T1a (next tier)
 *
 * Weekly Goals: Reset weekly, provide achievable mini-missions
 *   to push users toward next sub-tier
 */

export interface TLeagueTier {
  tier: string           // T0, T1, ... T10
  minScore: number       // Minimum league score for this tier
  label: string          // Display name
  color: string          // Tailwind gradient classes
  badgeColor: string     // Badge background
  textColor: string      // Text color
  icon: string           // Emoji icon
  subTiers: string[]     // ['a', 'b', 'c', 'd']
}

export const T_LEAGUE_TIERS: TLeagueTier[] = [
  { tier: 'T0',  minScore: 0,          label: 'Unranked',          color: 'from-gray-600 to-gray-500',     badgeColor: 'bg-gray-700',    textColor: 'text-gray-300',   icon: '⚪', subTiers: ['a','b','c','d'] },
  { tier: 'T1',  minScore: 100,        label: 'Street Rookie',      color: 'from-green-700 to-green-500',   badgeColor: 'bg-green-700',   textColor: 'text-green-300',  icon: '🟢', subTiers: ['a','b','c','d'] },
  { tier: 'T2',  minScore: 500,        label: 'Block Runner',       color: 'from-teal-700 to-teal-500',     badgeColor: 'bg-teal-700',    textColor: 'text-teal-300',   icon: '🔵', subTiers: ['a','b','c','d'] },
  { tier: 'T3',  minScore: 2000,       label: 'Neon Hustler',       color: 'from-blue-700 to-blue-500',     badgeColor: 'bg-blue-700',    textColor: 'text-blue-300',   icon: '🔷', subTiers: ['a','b','c','d'] },
  { tier: 'T4',  minScore: 5000,       label: 'City Grinder',       color: 'from-indigo-700 to-indigo-500', badgeColor: 'bg-indigo-700',  textColor: 'text-indigo-300', icon: '💎', subTiers: ['a','b','c','d'] },
  { tier: 'T5',  minScore: 15000,      label: 'Broadcast Boss',     color: 'from-purple-700 to-purple-500', badgeColor: 'bg-purple-700',  textColor: 'text-purple-300', icon: '🟣', subTiers: ['a','b','c','d'] },
  { tier: 'T6',  minScore: 40000,      label: 'Stream Warlord',      color: 'from-violet-700 to-violet-500', badgeColor: 'bg-violet-700',  textColor: 'text-violet-300', icon: '👑', subTiers: ['a','b','c','d'] },
  { tier: 'T7',  minScore: 100000,     label: 'Hype Commander',     color: 'from-orange-700 to-orange-500', badgeColor: 'bg-orange-700',  textColor: 'text-orange-300', icon: '🔥', subTiers: ['a','b','c','d'] },
  { tier: 'T8',  minScore: 300000,     label: 'Troll Elite',        color: 'from-amber-700 to-amber-500',   badgeColor: 'bg-amber-700',   textColor: 'text-amber-300',  icon: '⭐', subTiers: ['a','b','c','d'] },
  { tier: 'T9',  minScore: 750000,     label: 'City Legend',        color: 'from-yellow-600 to-yellow-400', badgeColor: 'bg-yellow-600',  textColor: 'text-yellow-200', icon: '🌟', subTiers: ['a','b','c','d'] },
  { tier: 'T10', minScore: 2000000,    label: 'MaiTroll Immortal', color: 'from-red-600 to-yellow-500',    badgeColor: 'bg-red-700',     textColor: 'text-red-200',    icon: '🏆', subTiers: ['a','b','c','d'] },
];

/**
 * LEAGUE LEVELS (separate from T League)
 * ========================================
 * Based on total gift coins SENT (not received).
 * Tracks gifting activity as a progression path.
 * Level 0 → 10, each level requires cumulative gifts sent.
 */
export interface LeagueLevel {
  level: number
  label: string
  minGiftsSent: number   // cumulative gift coins sent to reach this tier
  color: string
  textColor: string
  icon: string
  perk: string
}

export const LEAGUE_LEVELS: LeagueLevel[] = [
  { level: 0,  label: 'Newcomer',         minGiftsSent: 0,       color: 'from-gray-700 to-gray-600',     textColor: 'text-gray-300',   icon: '🌱', perk: 'Basic gifts' },
  { level: 1,  label: 'Gifter',           minGiftsSent: 50,      color: 'from-green-800 to-green-600',   textColor: 'text-green-300',  icon: '🎁', perk: 'Send gifts in broadcasts' },
  { level: 2,  label: 'Supporter',        minGiftsSent: 200,     color: 'from-teal-800 to-teal-600',     textColor: 'text-teal-300',   icon: '💚', perk: '+5% gift XP bonus' },
  { level: 3,  label: 'Patron',           minGiftsSent: 500,     color: 'from-blue-800 to-blue-600',     textColor: 'text-blue-300',   icon: '💙', perk: 'Gift streak tracking' },
  { level: 4,  label: 'Benefactor',       minGiftsSent: 1500,    color: 'from-indigo-800 to-indigo-600', textColor: 'text-indigo-300', icon: '💜', perk: '+10% gift XP bonus' },
  { level: 5,  label: 'Philanthropist',   minGiftsSent: 5000,    color: 'from-purple-800 to-purple-600', textColor: 'text-purple-300', icon: '🟣', perk: 'Custom gift animation' },
  { level: 6,  label: 'Mega Gifter',      minGiftsSent: 15000,   color: 'from-violet-800 to-violet-600', textColor: 'text-violet-300', icon: '👑', perk: '+15% gift XP bonus' },
  { level: 7,  label: 'Troll Angel',      minGiftsSent: 40000,   color: 'from-orange-800 to-orange-600', textColor: 'text-orange-300', icon: '😇', perk: 'Angel gift effect' },
  { level: 8,  label: 'City Guardian',    minGiftsSent: 100000,  color: 'from-amber-800 to-amber-600',   textColor: 'text-amber-300',  icon: '🛡️', perk: '+20% gift XP bonus' },
  { level: 9,  label: 'Legendary Gifter', minGiftsSent: 300000,  color: 'from-yellow-700 to-yellow-500', textColor: 'text-yellow-200', icon: '🌟', perk: 'Legendary gift trail' },
  { level: 10, label: 'MaiTroll Legend', minGiftsSent: 1000000, color: 'from-red-700 to-yellow-500',    textColor: 'text-red-200',    icon: '🏆', perk: 'All perks + Crown' },
];

/**
 * WEEKLY GOALS TEMPLATES
 * =======================
 * Each sub-tier has weekly goals that reset.
 * Goals are designed to be achievable but require effort.
 */
export interface WeeklyGoal {
  id: string
  title: string
  description: string
  target: number
  reward: number            // league score bonus
  icon: string
}

export function getWeeklyGoalsForTier(mainTier: string, subTier: string): WeeklyGoal[] {
  const baseGoals: WeeklyGoal[] = [
    { id: 'gift_weekly',      title: 'Gift Spree',       description: 'Send gifts in any live broadcast', target: 50,  reward: 10,  icon: '🎁' },
    { id: 'live_weekly',      title: 'Go Live',          description: 'Broadcast for at least 15 minutes',  target: 15,  reward: 10,  icon: '📡' },
    { id: 'chat_weekly',      title: 'Chat Active',      description: 'Send 20 chat messages in broadcasts', target: 20,  reward: 5,   icon: '💬' },
    { id: 'viewer_weekly',    title: 'Watch & Support',  description: 'Watch 30 minutes of live broadcasts',  target: 30,  reward: 5,   icon: '👁️' },
  ];

  // Scale target by tier difficulty (higher tier = harder goals)
  const tierNum = parseInt(mainTier.replace('T', ''));
  const subIdx = ['a','b','c','d'].indexOf(subTier);
  const difficultyMult = 1 + (tierNum * 0.5) + (subIdx * 0.15);

  return baseGoals.map(g => ({
    ...g,
    target: Math.round(g.target * difficultyMult),
    reward: Math.round(g.reward * (1 + tierNum * 0.1)),
  }));
}

/**
 * Get the full display string for a sub-tier: "T3c"
 */
export function getFullTierLabel(tier: string, subTier: string): string {
  return `${tier}${subTier}`;
}

/**
 * Get tier + sub-tier from a league score.
 * Returns e.g. { tier: 'T3', sub: 'c', full: 'T3c' }
 */
export function getSubTierFromScore(score: number): { tier: TLeagueTier; sub: string; full: string; position: number } {
  let currentTier: TLeagueTier = T_LEAGUE_TIERS[0];
  for (let i = T_LEAGUE_TIERS.length - 1; i >= 0; i--) {
    if (score >= T_LEAGUE_TIERS[i].minScore) {
      currentTier = T_LEAGUE_TIERS[i];
      break;
    }
  }

  const nextTier = T_LEAGUE_TIERS.find(t => t.tier === currentTier.tier && false) ||
    T_LEAGUE_TIERS[T_LEAGUE_TIERS.indexOf(currentTier) + 1];

  const tierMin = currentTier.minScore;
  const tierMax = nextTier ? nextTier.minScore : tierMin * 2;
  const range = tierMax - tierMin;
  const progress = score - tierMin;
  const pct = range > 0 ? progress / range : 0;

  const subIndex = Math.min(3, Math.floor(pct * 4));
  const sub = currentTier.subTiers[subIndex];

  return {
    tier: currentTier,
    sub,
    full: `${currentTier.tier}${sub}`,
    position: tierNum(currentTier) * 4 + subIndex,
  };
}

function tierNum(t: TLeagueTier): number {
  return parseInt(t.tier.replace('T', ''));
}

/**
 * Get next sub-tier info
 */
export function getNextSubTier(currentTier: TLeagueTier, currentSub: string): { tier: TLeagueTier; sub: string; full: string } | null {
  const subIdx = currentTier.subTiers.indexOf(currentSub);
  if (subIdx < currentTier.subTiers.length - 1) {
    const nextSub = currentTier.subTiers[subIdx + 1];
    return { tier: currentTier, sub: nextSub, full: `${currentTier.tier}${nextSub}` };
  }
  const nextTierIdx = T_LEAGUE_TIERS.indexOf(currentTier) + 1;
  if (nextTierIdx < T_LEAGUE_TIERS.length) {
    const nextTier = T_LEAGUE_TIERS[nextTierIdx];
    return { tier: nextTier, sub: 'a', full: `${nextTier.tier}a` };
  }
  return null;
}

/**
 * Progress within current sub-tier (0-100%)
 */
export function getSubTierProgress(score: number): number {
  const current = getSubTierFromScore(score);
  const nextTier = T_LEAGUE_TIERS.find(t => t.tier === current.tier.tier && false) ||
    T_LEAGUE_TIERS[T_LEAGUE_TIERS.indexOf(current.tier) + 1];

  const tierMin = current.tier.minScore;
  const tierMax = nextTier ? nextTier.minScore : tierMin * 2;
  const range = tierMax - tierMin;
  const progress = score - tierMin;
  const pct = range > 0 ? progress / range : 0;

  const subIdx = current.tier.subTiers.indexOf(current.sub);
  const subStart = subIdx / 4;
  const subEnd = (subIdx + 1) / 4;
  const subProgress = (pct - subStart) / (subEnd - subStart);
  return Math.min(100, Math.max(0, subProgress * 100));
}

/**
 * Score needed for next sub-tier
 */
export function getScoreForNextSubTier(score: number): number | null {
  const current = getSubTierFromScore(score);
  const next = getNextSubTier(current.tier, current.sub);
  if (!next) return null;

  if (next.tier.tier === current.tier.tier) {
    // Same main tier, next sub
    const nextSubIdx = current.tier.subTiers.indexOf(next.sub);
    const nextTier = T_LEAGUE_TIERS[T_LEAGUE_TIERS.indexOf(current.tier) + 1];
    const tierMax = nextTier ? nextTier.minScore : current.tier.minScore * 2;
    const subBoundary = current.tier.minScore + ((tierMax - current.tier.minScore) * (nextSubIdx + 1)) / 4;
    return Math.ceil(subBoundary);
  } else {
    // Next main tier
    return next.tier.minScore;
  }
}

/**
 * League Level from total gifts sent
 */
export function getLeagueLevel(giftsSent: number): LeagueLevel {
  for (let i = LEAGUE_LEVELS.length - 1; i >= 0; i--) {
    if (giftsSent >= LEAGUE_LEVELS[i].minGiftsSent) {
      return LEAGUE_LEVELS[i];
    }
  }
  return LEAGUE_LEVELS[0];
}

/**
 * Next league level
 */
export function getNextLeagueLevel(giftsSent: number): LeagueLevel | null {
  const current = getLeagueLevel(giftsSent);
  const idx = LEAGUE_LEVELS.indexOf(current);
  if (idx < LEAGUE_LEVELS.length - 1) {
    return LEAGUE_LEVELS[idx + 1];
  }
  return null;
}

/**
 * Progress toward next league level (0-100%)
 */
export function getLeagueLevelProgress(giftsSent: number): number {
  const current = getLeagueLevel(giftsSent);
  const next = getNextLeagueLevel(giftsSent);
  if (!next) return 100;
  const range = next.minGiftsSent - current.minGiftsSent;
  const progress = giftsSent - current.minGiftsSent;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

/**
 * Calculate league score from total_xp
 * The T league is now XP-based — reads from the same xp system
 * the bottom nav bar uses. Gift XP, watch XP, chat XP, etc.
 * all contribute to the T league tier.
 */
export function calculateLeagueScore(totalXp: number): number {
  return totalXp;
}

/**
 * Get tier colors for sub-tier display
 */
export function getSubTierColor(tier: string, sub: string): string {
  const t = T_LEAGUE_TIERS.find(ti => ti.tier === tier);
  if (!t) return 'from-gray-600 to-gray-500';

  const subIdx = ['a','b','c','d'].indexOf(sub);
  if (subIdx <= 0) return t.color;

  // Lighter variants for higher sub-tiers
  const lightMap: Record<string, string[]> = {
    'T0': ['from-gray-600 to-gray-500','from-gray-500 to-gray-400','from-gray-400 to-gray-300','from-gray-300 to-gray-200'],
    'T1': ['from-green-700 to-green-500','from-green-600 to-green-400','from-green-500 to-green-300','from-green-400 to-emerald-300'],
    'T2': ['from-teal-700 to-teal-500','from-teal-600 to-teal-400','from-teal-500 to-teal-300','from-teal-400 to-cyan-300'],
    'T3': ['from-blue-700 to-blue-500','from-blue-600 to-blue-400','from-blue-500 to-blue-300','from-blue-400 to-sky-300'],
    'T4': ['from-indigo-700 to-indigo-500','from-indigo-600 to-indigo-400','from-indigo-500 to-indigo-300','from-indigo-400 to-violet-300'],
    'T5': ['from-purple-700 to-purple-500','from-purple-600 to-purple-400','from-purple-500 to-purple-300','from-purple-400 to-fuchsia-300'],
    'T6': ['from-violet-700 to-violet-500','from-violet-600 to-violet-400','from-violet-500 to-violet-300','from-violet-400 to-purple-300'],
    'T7': ['from-orange-700 to-orange-500','from-orange-600 to-orange-400','from-orange-500 to-orange-300','from-orange-400 to-amber-300'],
    'T8': ['from-amber-700 to-amber-500','from-amber-600 to-amber-400','from-amber-500 to-amber-300','from-amber-400 to-yellow-300'],
    'T9': ['from-yellow-600 to-yellow-400','from-yellow-500 to-yellow-300','from-yellow-400 to-amber-300','from-amber-400 to-orange-300'],
    'T10': ['from-red-600 to-yellow-500','from-red-500 to-amber-400','from-red-400 to-yellow-300','from-red-300 to-amber-300'],
  };

  return lightMap[tier]?.[subIdx] || t.color;
}
