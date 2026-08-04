# 🌌 Universe Mode Implementation Guide

## Overview

Universe Mode is a new battle system layer that adds **Troll Battle** (4v4 team-based) and **Multi Battle** (1v1/2v2/3v3/4v4 formats) to Mai Troll. This system is fully backward compatible with existing battles and uses a hybrid architecture: **LiveKit for interactive participants** and **Mux for viewers**.

---

## Architecture

### System Layers

```
┌─────────────────────────────────────┐
│     BROADCAST PAGE                  │
│  ┌───────────────────────────────┐  │
│  │  SetupPage (Universe Category) │  │
│  │  ├─ Multi Battle (1v1-4v4)    │  │
│  │  └─ Troll Battle (4v4 Fixed)  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│    UNIVERSE MODE COMPONENTS         │
│  ┌───────────────────────────────┐  │
│  │  UniverseModeSetup            │  │
│  │  ├─ Multi Battle Tab          │  │
│  │  └─ Troll Battle Tab          │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  TrollBattleRoom              │  │
│  │  ├─ BattleScoreBar (Timer)    │  │
│  │  ├─ TrollBattleParticipant    │  │
│  │  │   Grid (8 Participants)    │  │
│  │  ├─ BattleResultsOverlay      │  │
│  │  └─ Control Panel             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│    BATTLE LOGIC & STATE             │
│  ┌───────────────────────────────┐  │
│  │  useTrollBattle Hook          │  │
│  │  ├─ State Management          │  │
│  │  ├─ Timer Logic               │  │
│  │  ├─ Scoring System            │  │
│  │  ├─ Rewards (Crowns, Bonus)   │  │
│  │  └─ Rematch Handling          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│    REAL-TIME SYNCHRONIZATION        │
│  ┌───────────────────────────────┐  │
│  │  Supabase Channels            │  │
│  │  ├─ Score Updates (1s)        │  │
│  │  ├─ Rematch Requests          │  │
│  │  ├─ Battle End Events         │  │
│  │  └─ Participant Join/Leave    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│    STREAMING LAYERS                 │
│  ┌───────────────────────────────┐  │
│  │  LiveKit (Participants)       │  │
│  │  ├─ 8 Active Participants     │  │
│  │  ├─ Audio Required            │  │
│  │  ├─ Video (if enabled)        │  │
│  │  └─ Low Latency (200-500ms)   │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Mux (Viewers)                │  │
│  │  ├─ HLS Playback              │  │
│  │  ├─ 1000+ Concurrent Viewers  │  │
│  │  ├─ ~3s Latency               │  │
│  │  └─ High Scale                │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Components

### 1. UniverseModeSetup.tsx
**Location:** `src/components/broadcast/UniverseModeSetup.tsx`

Manages UI for selecting between Multi Battle and Troll Battle modes.

**Props:**
- `onBattleStart: (mode: 'multi' | 'troll', format?: '1v1' | '2v2' | '3v3' | '4v4') => void`
- `disabled?: boolean`

**Tabs:**
- **Multi Battle**: Dropdown to select 1v1, 2v2, 3v3, or 4v4 format
- **Troll Battle**: Fixed 4v4 format with team rewards

---

### 2. TrollBattleRoom.tsx
**Location:** `src/components/broadcast/TrollBattleRoom.tsx`

Main battle UI container. Orchestrates:
- Video display (Mux for viewers, LiveKit participant grid overlay)
- Score tracking
- Timer display
- Results overlay
- Control panel (forfeit, toggle grid, mute)

**Props:**
- `battleId: string`
- `isHost: boolean`
- `participants: BattleParticipant[]`
- `remoteParticipants: Map<string, RemoteParticipant>`
- `teamAScore: number`
- `teamBScore: number`
- `timerSeconds: number`
- `phase: 'pre_battle' | 'active' | 'ended'`
- `winningTeam: 'A' | 'B' | 'draw' | null`
- Callbacks: `onForfeit`, `onRematch`, `onClose`

---

### 3. BattleScoreBar.tsx
**Location:** `src/components/broadcast/BattleScoreBar.tsx`

Top bar showing:
- Team A vs Team B scores
- 3-minute countdown timer
- Progress bar
- Sudden Death warning (last 10 seconds)

**Color Coding:**
- Green: 30+ seconds remaining
- Yellow: 10-30 seconds
- Red: < 10 seconds (Sudden Death active)

---

### 4. TrollBattleParticipantGrid.tsx
**Location:** `src/components/broadcast/TrollBattleParticipantGrid.tsx`

8-participant grid (4v4):
- Team A (left): 4 seats with amber border
- Team B (right): 4 seats with purple border
- Each tile shows: video/avatar, username, coins earned, audio status, crown badge

---

### 5. BattleResultsOverlay.tsx
**Location:** `src/components/broadcast/BattleResultsOverlay.tsx`

Results screen displayed for 10 seconds after battle ends:
- Winner announcement with animation
- Team scores comparison
- +2 crown badge for winners
- +2% bonus coins info
- Rematch button
- Auto-close countdown

---

## Hooks

### useTrollBattle.ts
**Location:** `src/hooks/useTrollBattle.ts`

Core battle state management hook.

**State:**
```typescript
{
  phase: 'idle' | 'pre_battle' | 'active' | 'ended',
  battleId: string | null,
  active: boolean,
  participants: BattleParticipant[],
  teamAScore: number,
  teamBScore: number,
  timerSeconds: number,
  winner: 'A' | 'B' | 'draw' | null,
  rematchAccepted: { A: boolean; B: boolean },
  rematchCountdown: number
}
```

**Methods:**
- `startBattle(participants)`: Initialize battle, start 5s pre-countdown
- `addScore(team, amount)`: Add points to team (triggered by gifts)
- `updateParticipantCoins(userId, amount)`: Update individual participant coins
- `endBattle()`: Calculate winner, award rewards, show results
- `requestRematch()`: Request rematch (auto-starts if both teams accept)
- `forfeitBattle()`: Forfeit current battle (opposite team wins)
- `broadcastBattleState(event, payload)`: Send real-time updates via Supabase

**Flow:**
1. `startBattle()` → Phase: pre_battle (5s countdown)
2. Timer expires → Phase: active (180s battle timer)
3. Real-time updates broadcast every 1s via Supabase channel
4. Timer reaches 0 → `endBattle()` called → Phase: ended
5. Winner determined, rewards awarded
6. Results overlay shown for 10s
7. Users can request rematch or close

---

## Database Schema

### Streams Table (New/Updated Columns)

```sql
-- Universe Mode flags
universe_mode BOOLEAN DEFAULT false
battle_mode TEXT ('universal' | 'troll' | 'multi')  -- Type of battle
battle_format TEXT ('1v1' | '2v2' | '3v3' | '4v4')   -- Team size
battle_status TEXT ('waiting' | 'ready' | 'active' | 'ended')

-- Mux Integration
mux_playback_id TEXT  -- For viewer HLS stream
mux_rtmp_url TEXT  -- Ingest URL (server-side only)
mux_stream_key TEXT  -- Stream key (server-side only)

-- LiveKit Integration
livekit_room_name TEXT  -- Room name for egress
egress_id TEXT  -- Mux egress ID (for stopping stream)

-- Timing
battle_start_time TIMESTAMPTZ
battle_end_time TIMESTAMPTZ
```

### Battle Participants Table

```sql
CREATE TABLE battle_participants (
  id UUID PRIMARY KEY
  stream_id UUID REFERENCES streams(id)
  user_id UUID REFERENCES user_profiles(id)
  livekit_identity TEXT  -- For LiveKit room
  team TEXT ('A' | 'B')
  seat_index INTEGER (1-4 per team)
  coins_earned INTEGER DEFAULT 0
  joined_at TIMESTAMPTZ
  left_at TIMESTAMPTZ NULL
  is_active BOOLEAN DEFAULT true
)
```

### Rewards

**Crowns:** `user_profiles.battle_crowns` (incremented by +2 for winners)

**Bonus Coins:** Insert into `coin_transactions` with:
- `type: 'battle_bonus'`
- `amount: floor(coins_earned * 0.02)`

---

## Real-Time Events (Supabase Channels)

**Channel Name:** `battle:${battleId}`

### Broadcast Events

| Event | Payload | Frequency |
|-------|---------|-----------|
| `score_update` | `{ teamAScore, teamBScore, timerSeconds }` | Every 1s during active |
| `rematch_requested` | `{ team: 'A' \| 'B' }` | On user click |
| `battle_ended` | `{ winner, teamAScore, teamBScore }` | Once at end |
| `participant_joined` | `{ userId, team, seatIndex }` | On join |
| `participant_left` | `{ userId }` | On disconnect |

---

## Integration Points

### In SetupPage.tsx

**Import:**
```typescript
import { UniverseModeSetup } from '../../components/broadcast/UniverseModeSetup';
```

**State:**
```typescript
const [universeBattleMode, setUniverseBattleMode] = useState<'multi' | 'troll'>('multi');
const [selectedMultiBattleFormat, setSelectedMultiBattleFormat] = useState<'1v1' | '2v2' | '3v3' | '4v4'>('1v1');
```

**Render Case:**
```typescript
case 'battle':
  return (
    <UniverseModeSetup
      onBattleStart={(mode, format) => {
        setUniverseBattleMode(mode);
        if (format) setSelectedMultiBattleFormat(format);
      }}
      disabled={false}
    />
  );
```

**Stream Creation:**
```typescript
...(category === 'battle' && {
  battle_format: universeBattleMode === 'multi' ? selectedMultiBattleFormat : '4v4',
  battle_mode: universeBattleMode === 'multi' ? 'universal' : 'troll',
  universe_mode: true,
  battle_status: 'waiting'
}),
```

### In BroadcastPage.tsx (To Add)

When participant joins or gifts are sent:

```typescript
// When gift received during battle
if (stream.universe_mode && stream.battle_mode === 'troll' && stream.is_battle) {
  const coinsValue = gift.coin_value || 10;
  const recipientTeam = getParticipantTeam(recipientId); // Determine team
  
  // Add score to team
  useTrollBattle.addScore(recipientTeam, coinsValue);
  
  // Update participant coins
  useTrollBattle.updateParticipantCoins(recipientId, coinsValue);
}
```

---

## Backward Compatibility

✅ **Fully backward compatible** - Does NOT affect:
- Existing 1v1 battles (use `battles` table)
- Existing 5v5 battles (use `battle_sessions` table)
- Existing stream mechanics
- Existing LiveKit connections
- Existing Mux integrations

**Key:** Universe Mode is purely additive via `universe_mode` flag and new `battle_mode` values.

---

## Rewards Anti-Abuse

Rewards trigger only if ALL conditions met:
- ✓ Battle completed (not forfeited early)
- ✓ Total team coins ≥ 1000 OR ≥ 3 unique gifters
- ✓ User on winning team

**Awards to Each Winner:**
- +2 crowns
- +2% of personal coins earned (bonus)
- Bonus coins added to `coin_transactions` with `type: 'battle_bonus'`

---

## Testing Checklist

### Phase 1: UI
- [ ] SetupPage shows "Universe Battle" category
- [ ] Clicking Universe Battle shows Multi/Troll tabs
- [ ] Multi Battle tab: 1v1, 2v2, 3v3, 4v4 format buttons work
- [ ] Troll Battle tab: Shows fixed 4v4 format description
- [ ] Start battle button creates stream with correct flags

### Phase 2: Battle Mechanics
- [ ] 5-second pre-battle countdown displays
- [ ] Countdown → battle starts automatically
- [ ] Timer counts down from 3:00
- [ ] Timer color changes (green → yellow → red)
- [ ] Sudden death message appears at 10 seconds

### Phase 3: Scoring
- [ ] Gifts increase team score correctly
- [ ] Score updates broadcast to all participants in real-time
- [ ] Both teams see same scores (±0.5s sync)

### Phase 4: Results
- [ ] Battle ends at 0:00
- [ ] Winner determined correctly
- [ ] Results overlay shows for 10s
- [ ] Crown badges displayed for winners
- [ ] Rematch button visible

### Phase 5: Rewards
- [ ] Winners earn +2 crowns (check `user_profiles.battle_crowns`)
- [ ] Bonus coins inserted to `coin_transactions`
- [ ] Bonus percentage calculated correctly (2%)
- [ ] Coins appear in user balance

### Phase 6: Rematch
- [ ] Rematch button clickable
- [ ] Both teams must click (shows "Waiting for Team B...")
- [ ] New battle auto-starts when both accept
- [ ] Scores reset to 0-0

### Phase 7: Streaming
- [ ] LiveKit room created with 8 participants
- [ ] Mux playback available for viewers
- [ ] Video/audio displayed for each participant
- [ ] Avatar fallback when camera off

---

## Future Enhancements

1. **5v5 Support** - Extend to 5 participants per team
2. **Ranked Battles** - Rank system with SR (Skill Rating)
3. **Tournaments** - Multi-battle tournaments with bracket system
4. **Abilities** - Team freeze, reverse, double XP power-ups
5. **Spectator Mode** - Allow non-participants to watch
6. **Detailed Stats** - KDA tracking per participant
7. **Leaderboards** - Global win streak, crown count rankings
8. **Replays** - VOD recording of battles

---

## Troubleshooting

### Timer Not Counting Down
- Check: Is `timerRef.current` being cleared properly?
- Check: Are intervals stacking (multiple timers running)?
- Solution: Call `clearInterval()` before starting new timer

### Scores Out of Sync
- Check: Are broadcast events firing every 1s?
- Check: Are all participants subscribed to channel?
- Solution: Add logging to `broadcastBattleState`

### Rewards Not Applied
- Check: Did battle reach ended phase?
- Check: Is winner determined correctly?
- Check: Does anti-abuse logic prevent reward?
- Solution: Log to console before `awardBattleRewards`

### LiveKit Participants Missing
- Check: Are all 8 participants in same room?
- Check: Are participant identities set correctly?
- Solution: Verify `livekit_identity` matches participant identity in room

---

## Performance Notes

- **Latency:** LiveKit participants see score updates within ±1s
- **Scalability:** Mux supports 1000+ concurrent viewers
- **Battery:** Mobile video streaming uses ~1MB per minute
- **Bandwidth:** HLS player adapts to network (240p-1080p)

