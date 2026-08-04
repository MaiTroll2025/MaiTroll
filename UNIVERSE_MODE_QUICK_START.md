# 🚀 UNIVERSE MODE - QUICK START GUIDE

## What Is This?

A new battle system for Mai Troll that adds:
- **Multi Battle**: 1v1, 2v2, 3v3, 4v4 team battles
- **Troll Battle**: Fixed 4v4 competitive battles with crowns/bonuses

---

## Files You Need to Know

### 🎨 UI Components (Use These)
```
src/components/broadcast/
├── UniverseModeSetup.tsx         ← Tabs for Multi/Troll selection
├── TrollBattleRoom.tsx           ← Main battle screen
├── BattleScoreBar.tsx            ← Timer + scores display
├── TrollBattleParticipantGrid.tsx ← 8 participants (4v4)
└── BattleResultsOverlay.tsx      ← Results screen + rematch
```

### ⚙️ Logic Hook (Use This)
```
src/hooks/
└── useTrollBattle.ts            ← Battle state + scoring
```

### 📋 Modified Files
```
src/pages/broadcast/
└── SetupPage.tsx                ← Already integrated (Universe category)
```

### 💾 Database
```
supabase/migrations/
└── 20270427000000_universe_mode_troll_battle.sql
```

---

## How to Integrate (5 Steps)

### Step 1: Setup Database ✅ DONE
Migration file is ready → Apply in Supabase SQL editor

### Step 2: Update BroadcastPage (30 min)

**Add imports:**
```typescript
import { useTrollBattle } from '@/hooks/useTrollBattle';
import TrollBattleRoom from '@/components/broadcast/TrollBattleRoom';
```

**Add state:**
```typescript
const [battleActive, setBattleActive] = useState(false);
const battle = useTrollBattle({ streamId: stream?.id || '', userId: user?.id || '', isHost });
```

**Check battle mode on stream start:**
```typescript
if (stream.battle_mode === 'troll' && stream.status === 'live') {
  // Collect 8 seated participants
  const participants = [...]; // 4 per team
  battle.startBattle(participants);
  setBattleActive(true);
}
```

**Add score on gift:**
```typescript
if (battleActive && gift.received) {
  const team = getTeamForUser(gift.recipientId);
  battle.addScore(team, gift.coinValue);
  battle.updateParticipantCoins(gift.recipientId, gift.coinValue);
}
```

**Render battle UI:**
```typescript
{battleActive && (
  <TrollBattleRoom
    battleId={battle.state.battleId || ''}
    isHost={isHost}
    participants={battle.state.participants}
    remoteParticipants={remoteParticipants}
    teamAScore={battle.state.teamAScore}
    teamBScore={battle.state.teamBScore}
    timerSeconds={battle.state.timerSeconds}
    phase={battle.state.phase}
    isActive={battle.state.active}
    winningTeam={battle.state.winner}
    muxPlaybackId={muxPlaybackId}
    onForfeit={() => { battle.forfeitBattle(); setBattleActive(false); }}
    onRematch={() => battle.requestRematch()}
    onClose={() => setBattleActive(false)}
    rematchAccepted={battle.state.rematchAccepted}
  />
)}
```

### Step 3: Create Mux Stream (15 min)
When battle starts, create Mux stream for viewers:
```typescript
const response = await supabase.functions.invoke('create-mux-stream', {
  body: { streamId: stream.id, liveKitRoom: stream.livekit_room_name }
});
setMuxPlaybackId(response.data.mux_playback_id);
```

### Step 4: Test Battle Flow (30 min)
1. SetupPage → Universe Battle → Troll Battle → Start Stream
2. Add 8 viewers to seats (4 per team)
3. Send gifts → scores should update
4. Timer counts down → battle should end
5. Results shown → rematch option visible

### Step 5: Verify Rewards (15 min)
1. Battle completes
2. Check `user_profiles.battle_crowns` (should +2 for winners)
3. Check `coin_transactions` (should have battle_bonus type)
4. Verify amount = floor(earned_coins * 0.02)

---

## Hook Methods Cheat Sheet

```typescript
const battle = useTrollBattle({ streamId, userId, isHost });

// Start battle with 8 participants
await battle.startBattle(participants);

// Add score to team during battle
battle.addScore('A', 100);  // +100 to Team A
battle.addScore('B', 50);   // +50 to Team B

// Update individual participant coins
battle.updateParticipantCoins(userId, totalCoins);

// End battle (auto-called when timer hits 0)
await battle.endBattle();

// Request rematch (both teams must click)
battle.requestRematch();

// Forfeit (immediate end, other team wins)
await battle.forfeitBattle();

// Broadcast event to all participants
battle.broadcastBattleState('custom_event', { data });
```

---

## State Structure

```typescript
battle.state = {
  phase: 'pre_battle' | 'active' | 'ended',
  battleId: 'battle-123...',
  active: true,
  participants: [{
    userId, username, avatarUrl,
    team: 'A' | 'B', seatIndex: 1-4,
    coinsEarned, isActive,
    liveKitIdentity
  }, ...],
  teamAScore: 500,
  teamBScore: 400,
  timerSeconds: 150,  // 2:30
  winner: 'A' | 'B' | 'draw' | null,
  rematchAccepted: { A: false, B: true },
  rematchCountdown: 10
}
```

---

## Real-Time Sync (Automatic)

Supabase channels handle sync automatically:
- **Every 1s**: Score updates broadcast
- **On user click**: Rematch requests broadcast
- **On battle end**: Winner announcement broadcast
- **On join/leave**: Participant status broadcast

No extra code needed!

---

## Common Tasks

### How do I award rewards?
✅ Auto-awarded when battle ends (via `awardBattleRewards()`)

### What if someone forfeits?
✅ Call `battle.forfeitBattle()` - other team wins immediately

### How do I handle participant leaving?
✅ Call `battle.updateParticipantCoins()` with their coins, mark `isActive: false`

### How do I prevent cheating?
✅ Anti-abuse: Rewards only if >= 1000 coins OR >= 3 unique gifters

### What about mobile?
✅ Fully responsive - works on phones, tablets, desktop

### Can I extend to 5v5?
✅ Yes - just modify participant count & grid layout

---

## Troubleshooting

**Q: Scores not syncing?**  
A: Check that Supabase channels are subscribed:
```typescript
const channel = supabase.channel(`battle:${battleId}`);
channel.on('broadcast', ...).subscribe();
```

**Q: Timer not counting?**  
A: Check that `timerRef` isn't cleared prematurely:
```typescript
// Bad: if (timerRef.current) clearInterval(timerRef.current); // ← Don't do this
// Good: Only clear when intentionally stopping
```

**Q: Rewards not applied?**  
A: Check that:
1. Battle reached 'ended' phase
2. Winner was determined correctly
3. Anti-abuse checks passed (>= 1000 coins)
4. RPC function `award_battle_crowns()` exists

**Q: LiveKit participants missing?**  
A: Verify:
1. All 8 have `livekit_identity` set
2. All joined same room
3. Room name is consistent

---

## Performance Targets

- **Latency**: ±1 second for score sync (Supabase)
- **Scalability**: 8 participants + 1000+ viewers
- **Battery**: ~1MB/min for video streaming
- **Network**: Auto-adapts HLS quality (240p-1080p)

---

## Next Docs to Read

For detailed info:
- 📘 **Full Guide**: `UNIVERSE_MODE_IMPLEMENTATION_GUIDE.md`
- 📄 **Code Example**: `UNIVERSE_MODE_BROADCAST_INTEGRATION.example.ts`
- ✅ **Summary**: `UNIVERSE_MODE_COMPLETION_SUMMARY.md`

---

## That's It! 🎉

You now have a complete Troll Battle system ready to integrate.

**Total integration time: 2-3 hours**  
**Total testing time: 1-2 hours**

Questions? Check the full guide or look at component prop definitions!

