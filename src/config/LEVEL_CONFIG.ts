/**
 * LEVEL SYSTEM CONFIGURATION
 * ============================
 * This file defines all level progression rules for Mai Troll
 * Edit this file to change how levels, XP, and progression work
 * 
 * After making changes, the system will automatically update everywhere
 */

// ============================================================
// 1. TIER LEVELS - Main Progression (Levels 1-100+)
// ============================================================
// Each tier defines a level range with title and perks
// XP ranges are cumulative

export interface TierConfig {
  level: number           // Starting level for this tier
  minXP: number          // Minimum total XP needed to reach this level
  maxXP: number          // Maximum XP in this tier (exclusive)
  title: string          // Level title/name
  perks: string[]        // Unlocked perks at this level
}

export const TIER_LEVELS: TierConfig[] = [
  // Tier 1: Citizen Tier (1-10)
  { level: 1,  minXP: 0,       maxXP: 4999,     title: "Dusty Baby Troll",      perks: ["Basic chat access", "default badge"] },
  { level: 5,  minXP: 5000,    maxXP: 9999,     title: "Meme Spark Starter",    perks: ["Free coin spins", "emoji reactions"] },
  { level: 10, minXP: 10000,   maxXP: 19999,    title: "Chaos Hatchling",       perks: ["Animated profile frame", "small entrance effects"] },
  
  // Tier 2: Influencer Tier (11-25)
  { level: 20, minXP: 20000,   maxXP: 29999,    title: "Glitched Gremlin",      perks: ["Gift sending", "basic streamer eligibility"] },
  { level: 25, minXP: 30000,   maxXP: 39999,    title: "Digital Menace",        perks: ["Profile themes", "custom titles", "streamer boosting"] },
  
  // Tier 3: Creator Tier (26-50)
  { level: 30, minXP: 40000,   maxXP: 49999,    title: "Neon Mayhem Freak",     perks: ["VIP applause animation", "advanced entrance effects"] },
  { level: 40, minXP: 50000,   maxXP: 59999,    title: "Coin-Devouring Goblin", perks: ["Live streaming upgrades", "coin multiplier", "small revenue share"] },
  { level: 50, minXP: 60000,   maxXP: 69999,    title: "Carnival Hexcaster",    perks: ["Special animated entrance", "priority support", "creator tools"] },
  
  // Tier 4: Elite Tier (51-75)
  { level: 60, minXP: 70000,   maxXP: 79999,    title: "Royal Crowned Mischief", perks: ["Diamond profile frame", "premium gifts", "priority in stream lists"] },
  { level: 70, minXP: 80000,   maxXP: 89999,    title: "Obsidian Overlord",     perks: ["Advanced monetization", "custom effects", "exclusive badges"] },
  
  // Tier 5: Legendary Tier (76-100)
  { level: 80, minXP: 90000,   maxXP: 99999,    title: "Troll Sovereign",       perks: ["Master streamer status", "revenue sharing", "exclusive perks"] },
  { level: 90, minXP: 100000,  maxXP: 109999,   title: "Chaos Deity",           perks: ["Legendary badge", "ultra-rare effects", "founder status"] },
  { level: 100, minXP: 110000, maxXP: 110999,   title: "Mai Troll IMMORTAL",   perks: ["God-mode effects", "legacy status", "eternal rewards"] },

  // Tier 6: Mythic Tier (101-2000+)
  { level: 101, minXP: 111000, maxXP: 249999,   title: "Ascended Troll",        perks: ["Mythic aura", "custom command"] },
  { level: 250, minXP: 250000, maxXP: 499999,   title: "Veteran Warrior",       perks: ["Veteran badge", "gold name"] },
  { level: 500, minXP: 500000, maxXP: 749999,   title: "Elite Commander",       perks: ["Commander badge", "platinum name"] },
  { level: 750, minXP: 750000, maxXP: 999999,   title: "Epic Warlord",          perks: ["Warlord badge", "diamond name"] },
  { level: 1000, minXP: 1000000, maxXP: 1499999, title: "Legendary Champion",    perks: ["Champion badge", "rainbow name"] },
  { level: 1500, minXP: 1500000, maxXP: 1999999, title: "Divine Master",         perks: ["Master badge", "glowing name"] },
  { level: 2000, minXP: 2000000, maxXP: 999999999, title: "Mythic Legend",       perks: ["Mythic badge", "animated name"] },
  
  // Admin only
  { level: 9999, minXP: 9999999999, maxXP: 99999999999, title: "SYSTEM OVERLORD", perks: ["All perks", "admin controls", "developer access"] },
];

// ============================================================
// 2. BUYER LEVEL SYSTEM - For Users Who Purchase Coins
// ============================================================
// These levels are based on $ spent, not regular XP
// Formula: 100 XP per $1 spent

export interface BuyerLevelConfig {
  level: number
  minXP: number  // Total buyer XP needed
  title: string
}

export const BUYER_LEVELS: BuyerLevelConfig[] = [
  { level: 1,  minXP: 0,        title: "Troll Patron" },
  { level: 2,  minXP: 2000,     title: "Mischief Rookie" },
  { level: 3,  minXP: 5000,     title: "Chaos Supporter" },
  { level: 4,  minXP: 10000,    title: "Troll Champion" },
  { level: 5,  minXP: 30000,    title: "Elite Troll Backer" },
  { level: 6,  minXP: 70000,    title: "Titan of Mai Troll" },
  { level: 7,  minXP: 150000,   title: "Mythic Benefactor" },
  { level: 8,  minXP: 300000,   title: "Divine OverTroll" },
  { level: 9,  minXP: 1500000,  title: "Ancient Elder Troll" },
  { level: 10, minXP: 3000000,  title: "IMMORTAL TROLL KING" },
];

// ============================================================
// 3. STREAM LEVEL SYSTEM - For Broadcasters/Streamers
// ============================================================
// Based on $ received from gifts during streams
// Formula: 50 XP per $1 received in gifts

export interface StreamLevelConfig {
  level: number
  minXP: number  // Total stream XP needed
  title: string
}

export const STREAM_LEVELS: StreamLevelConfig[] = [
  { level: 1,  minXP: 0,       title: "Rookie Trollcaster" },
  { level: 2,  minXP: 500,     title: "Banter Beginner" },
  { level: 3,  minXP: 2000,    title: "Chaos Host" },
  { level: 4,  minXP: 7500,    title: "Mayhem Broadcaster" },
  { level: 5,  minXP: 15000,   title: "Troll Arena Performer" },
  { level: 6,  minXP: 30000,   title: "Elite Chaos Caster" },
  { level: 7,  minXP: 60000,   title: "Troll Master Broadcaster" },
  { level: 8,  minXP: 120000,  title: "Mischief Legend" },
  { level: 9,  minXP: 300000,  title: "Troll Star Icon" },
  { level: 10, minXP: 900000,  title: "Mai Troll MEGASTAR" },
];

// ============================================================
// 4. XP EARNING RATES
// ============================================================
// How much XP users earn from different activities

export const XP_RATES = {
  // Daily Activities
  DAILY_LOGIN: 25,
  WATCH_STREAM_10_MIN: 5,
  CHAT_MESSAGE: 1,           // Max 50/day = 50 XP/day
  
  // Gifting/Spending
  SEND_GIFT_BASE: 10,         // Plus coin multiplier
  GIFT_XP_MULTIPLIER: 0.25,   // 25% of gift coins as XP
  
  // Streaming
  STREAM_10_MIN: 20,
  NEW_FOLLOWER: 50,
  
  // Events
  WIN_EVENT: 200,
  
  // Purchasing
  BUYER_XP_PER_DOLLAR: 100,  // $1 = 100 buyer XP
  STREAM_XP_PER_DOLLAR: 50,  // $1 gift = 50 stream XP
  
  // Caps
  DAILY_CHAT_XP_CAP: 50,      // 50 messages = 50 XP max per day
  DAILY_WATCH_XP_CAP: 120,    // ~4 hours of watching max per day
};

// ============================================================
// 5. LEVEL PROGRESSION FORMULA
// ============================================================
// XP required for each individual level

/**
 * Calculate XP needed to go from current level to next level
 * Formula: exponential progression (1.1x multiplier)
 * Level 1->2: 100 XP, Level 2->3: 110 XP, Level 3->4: 121 XP, etc.
 */
export function calculateXPForLevel(level: number): number {
  if (level >= 50) return 10000; // Cap at 10k XP per level
  return Math.floor(100 * Math.pow(1.1, level - 1));
}

/**
 * Calculate total cumulative XP needed to reach a level
 */
export function calculateTotalXPForLevel(targetLevel: number): number {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += calculateXPForLevel(i);
  }
  return total;
}

// ============================================================
// 6. PRESTIGE SYSTEM (Optional)
// ============================================================
// Allows users to reset and start over for bonus rewards

export interface PrestigeConfig {
  maxPrestiges: number
  coinBonusPerPrestige: number
  xpBonusPerPrestige: number
}

export const PRESTIGE_CONFIG: PrestigeConfig = {
  maxPrestiges: 5,           // Can prestige up to 5 times
  coinBonusPerPrestige: 1000, // 1000 coins per prestige
  xpBonusPerPrestige: 500,   // 500 XP boost per prestige
};

// ============================================================
// 7. LEVEL-UP REWARDS
// ============================================================
// Rewards given when leveling up

export interface LevelUpReward {
  coins: number
  perkTokens?: number
  specialReward?: string
}

export function getLevelUpReward(level: number): LevelUpReward {
  if (level <= 10) {
    return { coins: 100 };
  } else if (level <= 25) {
    return { coins: 200 };
  } else if (level <= 50) {
    return { coins: 500 };
  } else if (level <= 75) {
    return { coins: 1000, perkTokens: 1 };
  } else if (level <= 100) {
    return { coins: 2000, perkTokens: 2, specialReward: "Legendary Badge" };
  } else {
    return { coins: 5000, perkTokens: 5, specialReward: "Admin Privileges" };
  }
}

// ============================================================
// 8. QUICK REFERENCE FOR LEVEL 32
// ============================================================
// These are pre-calculated values for easy reference

export const LEVEL_32_REFERENCE = {
  level: 32,
  xp: 3200,              // Current XP in level 32
  totalXp: 49600,        // Total XP accumulated
  nextLevelXp: 3300,     // XP needed for level 33
  title: "Digital Menace",
  perks: ["Profile themes", "custom titles", "streamer boosting"],
};

// ============================================================
// 9. ADMIN LEVEL FEATURES
// ============================================================

export const ADMIN_LEVEL_FEATURES = {
  maxLevel: 2500,
  canBypassLevelRequirements: true,
  canAccessAllPerks: true,
  canEditLevels: true,
  showAdminBadge: true,
};

// ============================================================
// EXPORT UTILITIES
// ============================================================

/**
 * Get tier info for a given XP amount
 */
export function getTierFromXP(xp: number): TierConfig {
  for (let i = TIER_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= TIER_LEVELS[i].minXP) {
      return TIER_LEVELS[i];
    }
  }
  return TIER_LEVELS[0];
}

/**
 * Get buyer level from buyer XP
 */
export function getBuyerLevelFromXP(xp: number): BuyerLevelConfig {
  for (let i = BUYER_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= BUYER_LEVELS[i].minXP) {
      return BUYER_LEVELS[i];
    }
  }
  return BUYER_LEVELS[0];
}

/**
 * Get stream level from stream XP
 */
export function getStreamLevelFromXP(xp: number): StreamLevelConfig {
  for (let i = STREAM_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= STREAM_LEVELS[i].minXP) {
      return STREAM_LEVELS[i];
    }
  }
  return STREAM_LEVELS[0];
}

/**
 * Generate a full level table for reference
 */
export function generateLevelTable(): Array<{ level: number; totalXp: number; xpPerLevel: number; title: string }> {
  return Array.from({ length: 100 }, (_, i) => {
    const level = i + 1;
    const xpPerLevel = calculateXPForLevel(level);
    const totalXp = calculateTotalXPForLevel(level);
    const tier = getTierFromXP(totalXp);
    
    return {
      level,
      totalXp,
      xpPerLevel,
      title: tier.title,
    };
  });
}
