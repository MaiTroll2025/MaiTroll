# 📊 Mai Troll LEVEL SYSTEM - QUICK REFERENCE

## 🎯 Main Level Progression (1-101)

### Tier 1: Citizen Tier (Levels 1-10)
| Level | Min XP | Max XP | Title | Key Perks |
|-------|--------|--------|-------|-----------|
| 1 | 0 | 4,999 | Dusty Baby Troll | Basic chat access |
| 5 | 5,000 | 9,999 | Meme Spark Starter | Free coin spins |
| 10 | 10,000 | 19,999 | Chaos Hatchling | Animated profile |

### Tier 2: Influencer Tier (Levels 11-25)
| Level | Min XP | Max XP | Title | Key Perks |
|-------|--------|--------|-------|-----------|
| 20 | 20,000 | 29,999 | Glitched Gremlin | Gift sending |
| 25 | 30,000 | 39,999 | Digital Menace | Custom titles |

### Tier 3: Creator Tier (Levels 26-50)
| Level | Min XP | Max XP | Title | Key Perks |
|-------|--------|--------|-------|-----------|
| 30 | 40,000 | 49,999 | Neon Mayhem Freak | VIP animations |
| 40 | 50,000 | 59,999 | Coin-Devouring Goblin | Coin multiplier |
| 50 | 60,000 | 69,999 | Carnival Hexcaster | Creator tools |

### Tier 4: Elite Tier (Levels 51-75)
| Level | Min XP | Max XP | Title | Key Perks |
|-------|--------|--------|-------|-----------|
| 60 | 70,000 | 79,999 | Royal Crowned Mischief | Diamond frame |
| 70 | 80,000 | 89,999 | Obsidian Overlord | Monetization |

### Tier 5: Legendary Tier (Levels 76-100+)
| Level | Min XP | Max XP | Title | Key Perks |
|-------|--------|--------|-------|-----------|
| 80 | 90,000 | 99,999 | Troll Sovereign | Master streamer |
| 90 | 100,000 | 109,999 | Chaos Deity | Legendary badge |
| 100 | 110,000 | 110,999 | Mai Troll IMMORTAL | God-mode effects |
| 101 | 111,000+ | ∞ | SYSTEM OVERLORD | All perks (Admin) |

---

## 💰 XP Earning Rates

### How to Earn XP
| Activity | XP Earned | Daily Cap |
|----------|-----------|-----------|
| Chat Message | 1 XP | 50 XP (50 messages) |
| Watch Stream (10 min) | 5 XP | 120 XP (~4 hours) |
| Daily Login | 25 XP | 25 XP |
| Send Gift | 10 base + coins × 0.25 | ∞ |
| Stream 10 min | 20 XP | ∞ |
| New Follower | 50 XP | ∞ |
| Win Event | 200 XP | ∞ |

### Coin Spending → XP Conversion
| Activity | Conversion | Example |
|----------|-----------|---------|
| **Buyer XP** | 100 XP per $1 spent | $10 = 1,000 buyer XP |
| **Stream XP** | 50 XP per $1 gifted | $10 gift = 500 stream XP |

---

## 🏅 BUYER LEVEL SYSTEM (Based on $ Spent)

### Purchase Power Levels
| Level | $ Spent | Title |
|-------|---------|-------|
| 1 | $0+ | Troll Patron |
| 2 | $20+ | Mischief Rookie |
| 3 | $50+ | Chaos Supporter |
| 4 | $100+ | Troll Champion |
| 5 | $300+ | Elite Troll Backer |
| 6 | $700+ | Titan of Mai Troll |
| 7 | $1,500+ | Mythic Benefactor |
| 8 | $3,000+ | Divine OverTroll |
| 9 | $15,000+ | Ancient Elder Troll |
| 10 | $30,000+ | IMMORTAL TROLL KING |

---

## 🎬 STREAM LEVEL SYSTEM (Based on Gifts Received)

### Broadcaster Power Levels
| Level | $ Received | Title |
|-------|-----------|-------|
| 1 | $0+ | Rookie Trollcaster |
| 2 | $10+ | Banter Beginner |
| 3 | $40+ | Chaos Host |
| 4 | $150+ | Mayhem Broadcaster |
| 5 | $300+ | Troll Arena Performer |
| 6 | $600+ | Elite Chaos Caster |
| 7 | $1,200+ | Troll Master Broadcaster |
| 8 | $2,400+ | Mischief Legend |
| 9 | $6,000+ | Troll Star Icon |
| 10 | $18,000+ | Mai Troll MEGASTAR |

---

## 📈 Level Progression Formula

### XP Per Level (Exponential Growth)
Formula: `100 × (1.1 ^ (level - 1))`

| Level | XP Needed | Cumulative XP |
|-------|-----------|--------------|
| 1→2 | 100 | 100 |
| 2→3 | 110 | 210 |
| 3→4 | 121 | 331 |
| 4→5 | 133 | 464 |
| ... | ... | ... |
| 10→11 | 236 | 1,337 |
| 20→21 | 614 | 11,915 |
| **32→33** | **3,300** | **49,600** |
| 50→51 | 10,000+ | 65,000+ |

> **Level 32 Reference:** 49,600 total XP needed to reach, then 3,200 XP into level 32

---

## 🎁 Level-Up Rewards

### Coin Bonuses When Leveling
| Level Range | Coins | Perk Tokens | Special |
|-------------|-------|-------------|---------|
| 1-10 | 100 | - | - |
| 11-25 | 200 | - | - |
| 26-50 | 500 | - | - |
| 51-75 | 1,000 | 1 | - |
| 76-100 | 2,000 | 2 | Legendary Badge |
| 101+ | 5,000 | 5 | Admin Privileges |

---

## ⚙️ System Features

### Prestige System (Optional Reset)
- **Max Prestiges:** 5 times
- **Coin Bonus:** 1,000 per prestige
- **XP Boost:** 500 XP per prestige

### Admin Features
- **Max Level:** 101 (Admin only)
- **Bypass Restrictions:** Can access any perk
- **Edit Capabilities:** Can set any user's level

---

## 🔧 How to Edit

**File Location:** `src/config/LEVEL_CONFIG.ts`

### To Change Level Requirements:
```typescript
// Edit TIER_LEVELS array
{ level: 50, minXP: 60000, maxXP: 69999, title: "Carnival Hexcaster", ... }
//                ↑                        (change minXP here)
```

### To Change XP Rates:
```typescript
// Edit XP_RATES object
export const XP_RATES = {
  DAILY_LOGIN: 25,        // Change this number
  CHAT_MESSAGE: 1,        // Or this
  // etc...
}
```

### To Change Progression Formula:
```typescript
// Edit calculateXPForLevel function
export function calculateXPForLevel(level: number): number {
  if (level >= 50) return 10000;
  return Math.floor(100 * Math.pow(1.1, level - 1));
  //                            ↑ (change this multiplier)
}
```

---

## 📋 Level Table Generator

Run this in browser console to generate a full level table:

```javascript
const config = await import('/src/config/LEVEL_CONFIG.ts');
const table = config.generateLevelTable();
console.table(table);
```

This will show all 100 levels with their XP requirements and titles.

---

**Last Updated:** January 21, 2026
**System Version:** 2.0 (Unified Config)
