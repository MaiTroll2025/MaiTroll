# Daily Reward System Implementation - Mai Troll

## Overview

This system rewards users for participating in live broadcasts:

- **Broadcasters**: 25 coins when they start a broadcast (once per day)
- **Viewers**: 10 coins when they join a live broadcast (once per day)

Rewards come directly from the Public Pool, not newly minted coins.

## Files Created

### 1. Database Migration
- **File**: `create_daily_rewards_migration.sql`
- Creates the `daily_rewards` table to track daily reward claims
- Adds app_settings for reward configuration

### 2. Core System
- **File**: [`src/lib/dailyRewardSystem.ts`](src/lib/dailyRewardSystem.ts)
- Main logic for issuing daily rewards
- Public Pool balance management
- Account age verification
- Daily claim tracking
- Fail-safe pool protection

### 3. Broadcaster Reward Hook
- **File**: [`src/lib/useBroadcasterReward.ts`](src/lib/useBroadcasterReward.ts)
- Issues 25 coins when broadcaster starts a broadcast
- Reward issued after 60 seconds of broadcast (configurable)
- One reward per calendar day per user

### 4. Viewer Reward Hook
- **File**: [`src/lib/useViewerReward.ts`](src/lib/useViewerReward.ts)
- Issues 10 coins when viewer joins a live broadcast
- Reward issued after 30 seconds of stay (configurable)
- Requires account to be at least 24 hours old
- One reward per calendar day per user

### 5. Admin Controls
- **File**: [`src/lib/adminDailyRewards.ts`](src/lib/adminDailyRewards.ts)
- Enable/disable broadcaster rewards
- Enable/disable viewer rewards
- Adjust coin amounts
- Set minimum pool threshold
- View reward logs
- Add funds to public pool

### 6. Admin Panel UI
- **File**: [`src/components/admin/DailyRewardsAdminPanel.tsx`](src/components/admin/DailyRewardsAdminPanel.tsx)
- Visual interface for managing the system
- Dashboard with pool balance and statistics
- Settings panel with toggle controls
- Reward logs viewer

## Configuration Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `broadcaster_daily_reward_enabled` | true | Enable/disable broadcaster rewards |
| `broadcaster_daily_reward_amount` | 25 | Coins rewarded to broadcasters |
| `broadcaster_reward_min_duration_seconds` | 60 | Min broadcast duration before reward |
| `viewer_daily_reward_enabled` | true | Enable/disable viewer rewards |
| `viewer_daily_reward_amount` | 10 | Coins rewarded to viewers |
| `viewer_reward_min_stay_seconds` | 30 | Min viewer stay before reward |
| `viewer_reward_min_account_age_hours` | 24 | Min account age for viewers |
| `daily_reward_pool_threshold` | 10000 | Pool level to trigger fail-safe |
| `daily_reward_pool_reduction_pct` | 50 | % reduction when pool low |
| `daily_reward_fail_safe_mode` | reduce | 'disable' or 'reduce' when pool low |
| `public_pool_balance` | 1000000 | Current pool balance |

## Usage in Code

### Issuing Broadcaster Reward
```typescript
import { checkAndIssueBroadcasterReward } from '@/lib/useBroadcasterReward'

// Call when user starts a broadcast
await checkAndIssueBroadcasterReward(userId, broadcastId)
```

### Issuing Viewer Reward
```typescript
import { checkAndIssueViewerReward, cancelPendingViewerReward } from '@/lib/useViewerReward'

// Call when user joins a broadcast
await checkAndIssueViewerReward(viewerId, broadcastId)

// Call when user leaves (to cancel pending reward)
cancelPendingViewerReward(viewerId, broadcastId)
```

### Admin Dashboard
```typescript
import DailyRewardsAdminPanel from '@/components/admin/DailyRewardsAdminPanel'

// Add to your admin page
<DailyRewardsAdminPanel />
```

## Integration Points

### Broadcast Start (Agora)
When a user successfully starts a broadcast, call:
```typescript
await checkAndIssueBroadcasterReward(userId, streamId)
```

### Viewer Join (Live Page)
When a viewer joins a broadcast, call:
```typescript
await checkAndIssueViewerReward(userId, streamId)
```

### Viewer Leave
When a viewer leaves a broadcast, call:
```typescript
cancelPendingViewerReward(userId, streamId)
```

## Anti-Abuse Safeguards

1. **One reward per day**: Daily rewards table tracks claims
2. **Account age requirement**: Viewers must have accounts older than 24 hours
3. **Minimum stay duration**: Viewers must stay at least 30 seconds
4. **Minimum broadcast duration**: Broadcasters must broadcast at least 60 seconds
5. **Pool balance check**: Prevents rewards when pool is insufficient
6. **Fail-safe system**: Automatically reduces or disables rewards when pool is low

## Notifications

Users receive notifications when they receive rewards:

**Broadcaster**:
> 🎉 Creator Reward
> You earned 25 coins for going live today!
> Source: Mai Troll Public Pool

**Viewer**:
> 🎉 Daily Reward
> You earned 10 coins for joining a live!
> Source: Mai Troll Public Pool

## Database Schema

### daily_rewards Table
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- reward_type (VARCHAR: 'broadcaster_daily' | 'viewer_daily')
- date (DATE)
- broadcast_id (UUID, FK)
- amount (INTEGER)
- source (VARCHAR: 'public_pool')
- created_at (TIMESTAMPTZ)
```

### app_settings
All reward settings are stored in the `app_settings` table for easy configuration without code changes.

## Testing

Run the migration first:
```bash
psql -f create_daily_rewards_migration.sql
```

Then integrate the hooks into your broadcast flow.
