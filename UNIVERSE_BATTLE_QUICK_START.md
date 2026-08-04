# Mai Troll Universe Battle - Quick Start Testing Guide

## TEST ACCOUNTS
- **Admin**: `8dff9f37-21b5-4b8e-adc2-b9286874be1a`
- **Officer**: `13113269-7c07-48b9-b70e-dc69fb988840`

---

## 5-MINUTE BATTLE FLOW TEST

### Step 1: Setup (1 minute)
```
1. Log in Admin account in Browser A
2. Navigate to broadcast setup → Select "⚔️ Universal Battle"
3. Go live with "Battle Test - Admin" stream
4. Log in Officer account in Browser B
5. Navigate to broadcast setup → Select "⚔️ Universal Battle"
6. Go live with "Battle Test - Officer" stream
```

### Step 2: Challenge & Accept (1 minute)
```
7. In Browser B (Officer), find Admin's stream in LIVE tab
8. Click stream → "Challenge" button → Select 5v5 format
9. In Browser A (Admin), see challenge notification
10. Click "Accept" on challenge
11. Observe: Grid transforms to battle layout with "VS" indicator
```

### Step 3: Join Teams (1 minute)
```
12. Create 2 viewer accounts (browser tabs C and D)
13. Log in as Viewer A in Browser C → Find same broadcast stream
14. Click "Join Seat" → Join Admin's team (green side, left)
15. Log in as Viewer B in Browser D → Find same broadcast stream
16. Click "Join Seat" → Join Officer's team (red side, right)
```

### Step 4: Battle & Gifting (1 minute)
```
17. Watch 5-second countdown (5 → 4 → 3 → 2 → 1)
18. Battle starts: Timer shows 3:00, score 0-0
19. Viewer A sends gift (50 coins) to Admin
20. Observe: Score updates to 50-0 instantly on all 4 browsers
21. Viewer B sends gift (75 coins) to Officer
22. Observe: Score updates to 50-75 on all 4 browsers
```

### Step 5: Battle End (1 minute)
```
23. Wait for timer: 3:00 → 2:00 → 1:00 → 0:15
24. At 0:10: Timer turns RED, "SUDDEN DEATH" appears
25. At 0:00: Battle ends, Officer team (higher score) wins
26. Results overlay: "Officer Team Wins! 👑"
27. Crowns awarded: Officer + Viewer B each get +2 crowns
28. Rematch option appears
```

---

## CRITICAL TEST POINTS

### ✅ MUST VERIFY
1. **Timer Sync**: All 4 browsers show same timer (within 1 second)
   - If drift >2s = FAIL, check network
   
2. **Gift Score**: 50 + 75 = score shows correctly
   - If scores don't add = FAIL, check send_gift function
   
3. **Crown Award**: Database shows both winners with +2 crowns
   ```sql
   SELECT id, battle_crowns FROM user_profiles 
   WHERE id IN ('[officer_id]', '[viewer_b_id]');
   ```
   - Should see +2 from previous value
   
4. **Real-Time**: Score updates within 500ms of gift send
   - If lag >2s = FAIL, check Supabase realtime
   
5. **Layout**: 2×2 grid with 2 boxes each side
   - 5v5 = 2×5 grid (5 boxes per side)

---

## DATABASE VALIDATION QUERIES

Run after each test to verify data integrity:

```sql
-- Check battle was created and ended correctly
SELECT id, status, score_challenger, score_opponent, winner_stream_id
FROM battles 
WHERE created_at > NOW() - INTERVAL 1 minute
ORDER BY created_at DESC;

-- Check crowns were awarded
SELECT id, battle_crowns FROM user_profiles 
WHERE id IN ('[admin_id]', '[officer_id]', '[viewer_a_id]', '[viewer_b_id]')
ORDER BY battle_crowns DESC;

-- Check battle timestamps make sense
SELECT started_at, ended_at, 
  EXTRACT(EPOCH FROM (ended_at - started_at)) as duration_seconds
FROM battles WHERE id = '[last_battle_id]';
-- Should show ~180 seconds
```

---

## COMMON ISSUES & FIXES

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Timer out of sync** | Timers differ by >2s on different browsers | Check Supabase realtime channel status, verify `started_at` set in DB |
| **Score not updating** | Gift sent but score stays 0 | Check `send_gift_to_stream` RPC, verify battle status is 'active' |
| **Crowns not awarded** | Battle ends but no crown increase | Check `update_battle_crowns_and_streak` RPC, verify winner determined correctly |
| **Grid doesn't transform** | Still see normal broadcast, no battle grid | Check `is_battle` flag not set on streams, verify challenge accepted |
| **Video doesn't show** | Black boxes in grid | Check LiveKit token generation, verify Agora credentials, test audio/video separately |
| **Rematch doesn't work** | Click "REMATCH" but nothing happens | Check both teams need to click, watch 10s window timer |
| **Forfeit doesn't end** | Click "Forfeit" dialog appears but no effect | Check `leave_battle` RPC executed, verify opponent returned as winner |

---

## QUICK DECISION TREE

```
Start Battle ✓?
├─ No → Debug battle creation RPC
│
Go 3min without error ✓?
├─ No → Check timer_sync broadcasts, network logs
│
Score updates real-time ✓?
├─ No → Check gift_scored broadcasts, batch score updates
│
Crown count increases ✓?
├─ No → Check update_battle_crowns RPC, winner determination
│
Rematch works ✓?
├─ No → Check rematchAccepted state, both teams required
│
Forfeit ends battle ✓?
├─ No → Check leave_battle RPC, check winner awarded crowns
│
All tests pass ✓?
└─ SYSTEM READY FOR PRODUCTION
```

---

## PERFORMANCE BASELINE

For 5v5 battle, acceptable metrics:

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Timer Sync Drift | ±500ms | >1s | >2s |
| Gift Latency | <300ms | <500ms | >1s |
| Score Update | <200ms | <500ms | >1s |
| Memory/Client | <300MB | <500MB | >700MB |
| CPU/Client | <20% | <30% | >50% |
| Chat Latency | <500ms | <1s | >2s |

---

## TEST COMPLETION CHECKLIST

- [ ] Battle creation with 2 broadcasters
- [ ] Grid layout matches format (2v2 for 2 viewers per side)
- [ ] Timer counts down from 5s pre-battle
- [ ] Timer shows 3:00 and counts to 0:00
- [ ] All browsers show timer within ±1s
- [ ] Gift scoring works (score increases immediately)
- [ ] Both teams can receive gifts independently
- [ ] Score bar updates proportionally
- [ ] Timer turns red at 0:10
- [ ] "SUDDEN DEATH" banner appears
- [ ] Battle ends at 0:00
- [ ] Winner correctly determined (higher score)
- [ ] Results overlay shows winner
- [ ] Database shows crowns increased for winning team
- [ ] Rematch button visible
- [ ] Rematch starts new battle with fresh scores
- [ ] Forfeit button works and ends battle
- [ ] Forfeit awards crowns to other team

---

## NEXT STEPS AFTER TEST

✅ **If All Tests Pass**:
- Mark battle system as "READY FOR QA"
- Run comprehensive test suite (see UNIVERSE_BATTLE_TESTING_GUIDE.md)
- Load test with 50+ concurrent battles
- Perform 24-hour stress test

⚠️ **If Some Tests Fail**:
- Note which specific test failed (reference checklist)
- Check corresponding code file (see UNIVERSE_BATTLE_ARCHITECTURE.md)
- Review error logs in browser console and Supabase logs
- Reference applicable "Common Issues" section above

❌ **If Critical Path Fails** (battle won't start):
- Verify both streams live: `SELECT * FROM streams WHERE is_live = true`
- Check challenge was accepted: `SELECT * FROM battles WHERE status = 'active'`
- Verify battle_id is set: `SELECT battle_id FROM streams WHERE battle_id IS NOT NULL`
- Check for RPC errors in Supabase logs

---

## DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `UNIVERSE_BATTLE_ARCHITECTURE.md` | Complete system design & implementation |
| `UNIVERSE_BATTLE_TESTING_GUIDE.md` | 14 comprehensive test phases |
| `UNIVERSE_BATTLE_QUICK_START.md` | This file - 5-minute smoke test |

---

## SUPPORT CONTACTS

For specific issues:
1. **Battle Creation**: Check `src/hooks/useFiveVFiveBattle.ts` → `findMatch()`
2. **Timer Sync**: Check `src/components/broadcast/BattleView.tsx` → timer interval
3. **Gift Scoring**: Check migrations → `send_gift_to_stream()` RPC
4. **Crown Awards**: Check migrations → `update_battle_crowns_and_streak()` RPC
5. **Real-Time Sync**: Check Supabase channels configuration

---

**READY TO TEST?** Start with Step 1 above! 🚀
