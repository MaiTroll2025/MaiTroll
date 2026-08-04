# XP & Badge System - Complete Documentation

## Overview

The XP (Experience Points) and Badge system is a comprehensive gamification layer that rewards users for various activities across Mai Troll. Users earn XP through economy actions, engagement, streaming, and community participation, which unlocks level badges, achievement badges, and exclusive perks.

---

## XP Earning System

### Economy Actions

| Action | XP Earned | Notes |
|--------|-----------|-------|
| **Spend Paid Coins** | +1 XP per coin | General coin spending |
| **Live Gift Send** | +1.1 XP per coin | 10% bonus for live gifting |
| **Store Purchase** | +5 XP per $1 | Applies to all store items |

### Engagement Actions

| Action | XP Earned | Notes |
|--------|-----------|-------|
| **Watch Live Stream** | +2 XP per minute | Passive watching rewards |
| **Chat Message** | +5 XP | 30-second cooldown between awards |
| **Daily Login** | +25 XP | First login of the day |
| **7-Day Streak** | +150 XP | Bonus for maintaining streak |

### Streaming Actions

| Action | XP Earned | Notes |
|--------|-----------|-------|
| **Go Live** | +200 XP | For streams 10+ minutes |
| **Viewer per Minute** | +1 XP | Calculated as viewer-minutes |
| **Receive Gift** | Base XP + bonus % | Varies by gift amount |

### Troll Court Actions

| Action | XP Earned | Notes |
|--------|-----------|-------|
| **Jury Participation** | +100 XP | Serving on any case |
| **Ruling Accepted** | +250 XP | When your verdict is accepted |
| **Helpful Report** | +150 XP | Filing valid reports |

---

## Badge System

### Level Badges (Automatic)

Awarded automatically when reaching level thresholds:

| Level | Badge Name | Rarity |
|-------|-----------|--------|
| 10 | Level 10 | Common |
| 50 | Level 50 | Common |
| 100 | Level 100 | Rare |
| 250 | Level 250 | Rare |
| 500 | Level 500 | Epic |
| 750 | Level 750 | Epic |
| 1000 | Level 1000 | Legendary |
| 1500 | Level 1500 | Legendary |
| 2000 | Level 2000 | Mythic |

### Achievement Badges

#### Economy Badges

| Badge | Requirement | Rarity |
|-------|------------|--------|
| **First Spend** | Spend first paid coin | Common |
| **Whale** | Spend 100,000 paid coins | Legendary |
| **Tycoon** | Cash out 5 times | Epic |
| **Generous Starter** | Send first live gift | Common |
| **Gift Master** | Send 1,000 live gifts | Epic |

#### Streaming Badges

| Badge | Requirement | Rarity |
|-------|------------|--------|
| **Broadcaster** | Go live 10 times | Common |
| **Star** | Reach 1,000 total viewers | Rare |
| **Cult Following** | 50 concurrent viewers once | Epic |
| **Gift Magnet** | Receive 10,000 coins in one stream | Rare |

#### Community Badges

| Badge | Requirement | Rarity |
|-------|------------|--------|
| **Juror** | Serve on 10 juries | Common |
| **Judge** | 5 rulings accepted | Rare |
| **Enforcer** | File 10 helpful reports | Rare |
| **Chatty** | Send 500 chat messages | Common |

#### Social/Flex Badges

| Badge | Requirement | Rarity |
|-------|------------|--------|
| **Addict** | 30-day login streak | Rare |
| **OG** | Account older than 1 year | Legendary |
| **Evolved** | Earn 500 total badges | Mythic |
| **Untouchable** | 6 months with zero violations | Legendary |

### Hidden/Rare Badges

Secret badges with undisclosed requirements:

| Badge | Hint | Rarity |
|-------|------|--------|
| **Snake Eyes** | "Lucky numbers..." | Mythic |
| **Ghost** | "Invisible presence..." | Rare |
| **Menace** | "Rebellious spirit..." | Legendary |
| **Resurrected** | "Return from the void..." | Epic |
| **Night Owl** | "Creatures of the night..." | Rare |

---

## Level Perks System

### Perk Unlocks by Level

| Level | Perk | Description |
|-------|------|-------------|
| **25** | Custom Emoji | Unlock custom emoji reactions |
| **75** | Chat Glow | Your messages glow in chat |
| **150** | Chat Color | Custom chat message colors |
| **300** | Chat Animation | Animated message effects |
| **500** | Entrance Effect | Special entrance effect when joining streams |
| **750** | Custom Badge Slot | Extra badge display slot on profile |
| **1000** | Crown | Exclusive crown icon next to name |
| **1500** | Animated Avatar | Animated profile picture frame |
| **2000** | City Statue + Ultimate Flair | Virtual statue in Mai Troll + ultimate visual flair |

---

## Technical Implementation

### Database Tables

#### `xp_transactions`
Logs all XP-earning events:
```sql
- id (uuid)
- user_id (uuid, references auth.users)
- amount (int)
- reason (text)
- metadata (jsonb)
- created_at (timestamptz)
```

#### `badge_catalog`
Master list of all available badges:
```sql
- id (uuid)
- slug (text, unique)
- name (text)
- description (text)
- category (text)
- icon_url (text)
- rarity (text)
- sort_order (int)
- is_active (boolean)
```

#### `user_badges`
Tracks badges earned by users:
```sql
- id (uuid)
- user_id (uuid, references auth.users)
- badge_id (uuid, references badge_catalog)
- earned_at (timestamptz)
- metadata (jsonb)
- unique(user_id, badge_id)
```

#### `user_level_perks`
Tracks unlocked level perks:
```sql
- id (uuid)
- user_id (uuid, references auth.users)
- level (int)
- perk_type (text)
- unlocked_at (timestamptz)
- unique(user_id, perk_type)
```

### Core Functions

#### XP Award Functions (`src/lib/xp.ts`)

```typescript
// Economy
awardPaidCoinXP(userId, coinAmount, metadata)
awardLiveGiftXP(userId, coinAmount, metadata)
awardStorePurchaseXP(userId, dollarAmount, metadata)

// Engagement
awardWatchStreamXP(userId, minutesWatched, streamId)
awardChatMessageXP(userId, roomId)
awardDailyLoginXP(userId)
award7DayStreakXP(userId, streakCount)

// Streaming
awardGoLiveXP(userId, streamId)
awardViewerMinuteXP(userId, viewerMinutes, streamId)
awardGiftReceivedXP(userId, coinAmount, streamId, metadata)

// Court
awardJuryParticipationXP(userId, caseId)
awardRulingAcceptedXP(userId, caseId)
awardHelpfulReportXP(userId, reportId)
```

#### Badge Evaluation (`src/services/badgeEvaluationService.ts`)

```typescript
// Check specific badge categories
checkLevelBadges(userId, currentLevel)
checkEconomyBadges(userId)
checkStreamingBadges(userId)
checkCommunityBadges(userId)
checkSocialBadges(userId)
checkHiddenBadges(userId, context)

// Check and unlock perks
checkAndUnlockPerks(userId, currentLevel)

// Comprehensive evaluation (call after XP events)
evaluateBadgesForUser(userId, context)
```

#### XP Tracking Hook (`src/lib/hooks/useXPTracking.ts`)

```typescript
const {
  trackChatMessage,
  startWatchTracking,
  stopWatchTracking,
  updateWatchTime,
  track7DayStreak,
  evaluateBadges
} = useXPTracking()
```

---

## Integration Points

### 1. Gift System
**File:** `src/lib/hooks/useGiftSystem.ts`

The gift system already calls `processGiftXp()` which awards:
- Sender: +1.1 XP per coin (10% bonus)
- Receiver: +1 XP per coin

After awarding XP, call:
```typescript
await evaluateBadgesForUser(senderId)
await evaluateBadgesForUser(receiverId)
```

### 2. Chat Messages
**File:** Stream/chat components

When user sends a message:
```typescript
const { trackChatMessage } = useXPTracking()

// In message send handler
await trackChatMessage(roomId)
```

### 3. Watch Time
**File:** Stream viewer components

```typescript
const { startWatchTracking, stopWatchTracking, updateWatchTime } = useXPTracking()

// When joining stream
startWatchTracking(streamId)

// Periodically (every minute)
setInterval(() => updateWatchTime(streamId), 60000)

// When leaving stream
stopWatchTracking(streamId)
```

### 4. Daily Login
**File:** Auto-tracked via `useXPTracking` hook

The hook automatically awards daily login XP on mount (once per day).

### 5. Streaming
**File:** Stream creation/management

When broadcaster goes live:
```typescript
import { awardGoLiveXP, awardViewerMinuteXP } from '../lib/xp'

// When stream starts (after 10 min)
await awardGoLiveXP(userId, streamId)

// Periodically update viewer XP
const viewerMinutes = viewerCount * minutesElapsed
await awardViewerMinuteXP(userId, viewerMinutes, streamId)
```

### 6. Troll Court
**File:** Court case components

```typescript
import { 
  awardJuryParticipationXP,
  awardRulingAcceptedXP,
  awardHelpfulReportXP
} from '../lib/xp'

// When user joins jury
await awardJuryParticipationXP(userId, caseId)

// When ruling is accepted
await awardRulingAcceptedXP(userId, caseId)

// When report is marked helpful
await awardHelpfulReportXP(userId, reportId)
```

---

## Testing & Verification

### 1. Apply Migrations
```bash
# Apply all migrations in order
supabase db push
```

### 2. Test XP Awards
```typescript
// Test each XP function
import * as xp from './lib/xp'

await xp.awardPaidCoinXP(userId, 100)
await xp.awardChatMessageXP(userId, roomId)
await xp.awardGoLiveXP(userId, streamId)
```

### 3. Verify Badge Awards
```typescript
import { evaluateBadgesForUser } from './services/badgeEvaluationService'

// Manually trigger badge evaluation
await evaluateBadgesForUser(userId)

// Check user's badges
const { data } = await supabase
  .from('user_badges')
  .select('*, badge_catalog(*)')
  .eq('user_id', userId)
```

### 4. Check Perk Unlocks
```sql
-- Query unlocked perks
SELECT * FROM user_level_perks
WHERE user_id = 'USER_UUID'
ORDER BY level ASC;
```

---

## Future Enhancements

### Potential Additions

1. **Multiplier Events**
   - Double XP weekends
   - Special event bonuses
   - Family vs Family competitions

2. **Seasonal Badges**
   - Holiday-specific badges
   - Limited-time challenges
   - Rotating hidden badges

3. **Prestige System**
   - Reset level after 2000 with prestige rank
   - Prestige-exclusive badges and perks
   - Permanent multipliers

4. **Badge Trading**
   - Allow trading duplicate/common badges
   - Marketplace for rare badges
   - Gift badges to friends

5. **Leaderboards**
   - Top XP earners daily/weekly/monthly
   - Badge collection leaderboard
   - Fastest levelers

---

## Support & Maintenance

### Monitoring

- **XP Transactions**: Monitor `xp_transactions` table for anomalies
- **Badge Awards**: Check `user_badges` for suspicious patterns
- **Perk Unlocks**: Verify `user_level_perks` integrity

### Common Issues

**XP not awarding:**
- Check RPC function `grant_xp` exists
- Verify user profile has correct level
- Check xp_transactions logs

**Badges not showing:**
- Ensure badge exists in `badge_catalog`
- Check RLS policies on `user_badges`
- Verify badge evaluation is called after XP award

**Perks not unlocking:**
- Confirm user level meets threshold
- Check `user_level_perks` table policies
- Verify unlock logic in badge evaluation service

---

## Summary

The XP and Badge system provides comprehensive gamification across all user activities in Mai Troll. With multiple earning paths, tiered badge categories, and progressive perk unlocks, users have continuous incentives to engage with the platform.

**Key Files:**
- Migration: `supabase/migrations/20270121050000_comprehensive_badge_system.sql`
- XP Logic: `src/lib/xp.ts`
- Badge Evaluation: `src/services/badgeEvaluationService.ts`
- Tracking Hook: `src/lib/hooks/useXPTracking.ts`
- XP Service: `src/services/xpService.ts`

**Next Steps:**
1. Apply migration to create tables and seed badges
2. Wire XP tracking into existing user flows
3. Add badge display components to UI
4. Test XP accumulation and badge awards
5. Monitor and adjust XP rates based on usage data
