# Mai Troll Universe Battle System - Complete Testing Guide

## Test Accounts
- **Admin Account**: `8dff9f37-21b5-4b8e-adc2-b9286874be1a`
- **Officer Account**: `13113269-7c07-48b9-b70e-dc69fb988840`

**Setup**: Create at least 2 broadcaster profiles and 5-10 viewer profiles for comprehensive testing.

---

## TEST PHASE 1: BATTLE CREATION & INITIALIZATION

### Test 1.1: Live Stream Setup
**Objective**: Verify both broadcasters can go live and establish active streams

**Steps**:
1. Log in as Admin account
2. Navigate to broadcast setup page
3. Select "⚔️ Universal Battle" category
4. Create live stream with title "Battle Test - Admin"
5. Repeat for Officer account with title "Battle Test - Officer"

**Verification**:
- [ ] Both streams show as "Live" on home page
- [ ] Streams appear in "LIVE" tab with correct titles
- [ ] Both broadcaster boxes visible in BroadcastGrid
- [ ] Agora token successfully generated (no black screens)
- [ ] Audio/video working on both sides (test with dummy audio)

**Expected Result**: Both streams active and synchronized via Agora

---

### Test 1.2: Challenge Initiation
**Objective**: Verify battle challenge can be issued and received

**Steps**:
1. While Admin is broadcasting, Officer navigates to home
2. Officer finds Admin's stream in LIVE tab
3. Officer clicks stream and opens challenge modal
4. Officer clicks "Challenge" button with 5v5 format selected
5. Admin should receive incoming challenge notification

**Verification**:
- [ ] Challenge notification appears on Admin's broadcast page
- [ ] Challenge modal shows Officer's info and selected format (5v5)
- [ ] Challenge timestamp is current
- [ ] Battle acceptance button enabled and clickable
- [ ] Challenge persists in BattleControls UI

**Expected Result**: Challenge successfully transmitted and visible

---

### Test 1.3: Battle Acceptance
**Objective**: Verify battle transforms broadcast into battle grid

**Steps**:
1. Admin clicks "Accept" on challenge modal
2. Observe broadcast transformation
3. Watch both streams update to battle mode

**Verification**:
- [ ] Broadcast grid transforms to battle layout (2v2 grid visible)
- [ ] "VS" indicator appears between teams
- [ ] Battle state in database updated: `battles.status = 'active'`
- [ ] Both streams marked: `is_battle = true`, `battle_id` set
- [ ] Troll engines overlay hidden (no TrollEngine UI)
- [ ] Timer shows "5" seconds (pre-battle countdown)

**Database Check**:
```sql
SELECT id, status, challenger_stream_id, opponent_stream_id 
FROM battles 
WHERE status = 'active' 
ORDER BY created_at DESC LIMIT 1;
```

**Expected Result**: Battle record created and both broadcasters in 5v5 grid layout

---

## TEST PHASE 2: PARTICIPANT JOINING & TEAM FORMATION

### Test 2.1: Viewers Join Battle Box
**Objective**: Verify viewers can join broadcaster's team seats

**Steps**:
1. Log in 2-3 viewer accounts in separate browser tabs
2. Each viewer navigates to same broadcast stream
3. Viewers click "Join Seat" button on their desired box
4. Observe seat allocation and team assignment

**Verification**:
- [ ] Viewer appears in correct seat (index 1, 2, 3...)
- [ ] Seat shows viewer name and avatar
- [ ] Seat marked as "active" in stream_seat_sessions table
- [ ] Video box populated with viewer's LiveKit participant
- [ ] Team assignment (A vs B) correct based on which stream

**LiveKit Verification**:
- [ ] Each viewer has unique LiveKit identity
- [ ] Participant count in LiveKit room matches UI box count
- [ ] Audio from viewer's mic appears in room

**Expected Result**: Viewers successfully occupy team seats with correct team assignment

---

### Test 2.2: Team Size Validation (5v5 format)
**Objective**: Verify 5v5 requires exactly 5 per team

**Steps**:
1. Admin's team: Admin (host) + Viewer A, B, C, D (4 guests = 5 total)
2. Officer's team: Officer (host) + Viewer E, F, G, H (4 guests = 5 total)
3. Attempt to add 6th viewer to Admin's team

**Verification**:
- [ ] Each team shows "5/5 SEATS FILLED"
- [ ] 6th viewer gets "Team is full" message
- [ ] Grid layout: 2 rows × 5 columns visible
- [ ] All 10 boxes populated with participants
- [ ] Team names displayed (Team A / Team B)

**Expected Result**: Team capacity enforced, max 5 per team for 5v5

---

## TEST PHASE 3: TIMER SYNCHRONIZATION

### Test 3.1: Pre-Battle Countdown (5 seconds)
**Objective**: Verify timer counts down from 5 to battle start

**Steps**:
1. After all participants seated, observe timer in arena center
2. Watch countdown: 5 → 4 → 3 → 2 → 1
3. Note exact time when battle transitions to "ACTIVE"
4. Have 3+ clients open (admin, officer, viewer) - record times

**Verification**:
- [ ] Timer visible in center of arena between teams
- [ ] Counts down: 5, 4, 3, 2, 1 (exactly 5 seconds)
- [ ] All participants see same countdown number (within 1s tolerance)
- [ ] At 0, timer transitions to 3:00 (180 seconds)
- [ ] Phase changes: "pre_battle" → "active"
- [ ] Log entry shows `[Battle] Phase: active, Started at: [timestamp]`

**Timing Tolerance**: Max ±1 second drift between clients

**Database Check**:
```sql
SELECT id, status, started_at FROM battles 
WHERE id = '[battle_id]';
-- started_at should be within 1s of current time
```

**Expected Result**: Synchronized countdown, all clients see same timer

---

### Test 3.2: Active Battle Timer (180 seconds)
**Objective**: Verify timer counts down correctly during active battle

**Steps**:
1. Battle in active phase
2. Record time when timer shows 3:00
3. Wait 30 seconds
4. Verify timer shows 2:30 (±1 second)
5. Check at T=150s, 120s, 90s, 60s, 30s

**Verification**:
- [ ] Timer decrements by 1 every second (within system tolerance)
- [ ] No jumps forward/backward (except on sync from host)
- [ ] All 3+ clients show same time within ±1s
- [ ] Timer updates: 3:00 → 2:59 → 2:58... (continuous)
- [ ] Log shows `timer_sync` broadcasts from host every second
- [ ] Challenger's timestamp matches opponent's (from DB: started_at)

**Host Broadcast Check**:
- Open DevTools → Network → Realtime subscriptions
- Should see `timer_sync` events every ~1000ms to channel `battle_timer:[battleId]`

**Expected Result**: Accurate countdown with synchronized timing across all participants

---

### Test 3.3: Sudden Death Transition (10 seconds)
**Objective**: Verify battle transitions to sudden death in final 10 seconds

**Steps**:
1. Fast-forward through battle (skip to near end in testing, or wait)
2. When timer reaches 0:15, observe carefully
3. Watch transition at 0:10

**Verification**:
- [ ] At 0:10, timer color changes RED
- [ ] Banner appears: "⚡ SUDDEN DEATH ⚡"
- [ ] Timer continues: 0:10 → 0:09 → ... → 0:00
- [ ] All clients show SUDDEN DEATH at same moment (±1s)
- [ ] Scores freeze in SUDDEN DEATH (gifts don't add to score)
- [ ] At 0:00, battle auto-ends

**Visual Indicators**:
- [ ] Red color for timer display
- [ ] Pulsing/flashing effect (motion.animate)
- [ ] "SUDDEN DEATH" text prominent

**Expected Result**: Sudden death phase triggered at exactly 10 seconds remaining

---

## TEST PHASE 4: GIFT SCORING SYSTEM

### Test 4.1: Gift Selection & Interface
**Objective**: Verify gift panel displays available gifts

**Steps**:
1. Battle active (timer 2:00+)
2. Open BattleGiftPanel on right side
3. Scroll through available gifts
4. Check gift costs and descriptions

**Verification**:
- [ ] Gift panel shows 10-15 available gifts
- [ ] Each gift displays: name, icon/emoji, cost (coins)
- [ ] Gifts sorted by cost (ascending)
- [ ] User balance displayed at top
- [ ] "Send" button visible for each gift
- [ ] Free gifts available (test with 0 balance later)

**Expected Result**: Gift interface fully functional and accessible

---

### Test 4.2: Single Gift Scoring
**Objective**: Verify gift increases team score correctly

**Steps**:
1. Battle active, Team A score = 0
2. Viewer in Team A sends 1 gift (e.g., $50 cost)
3. Observe score update
4. Record: Gift sent at T=2:00, score change

**Verification**:
- [ ] Score bar updates immediately: 0 → 50
- [ ] Gift animation appears (floating text, particle effect)
- [ ] Viewer's coin balance decreases: 50 coins deducted
- [ ] Score number updated in UI (top center)
- [ ] Gift recorded in stream_gifts table
- [ ] Battle's score_challenger (or score_opponent) incremented

**Database Verification**:
```sql
SELECT id, score_challenger, score_opponent 
FROM battles WHERE id = '[battle_id]';
-- Should show 50 in appropriate score column
```

**Expected Result**: Gift immediately reflected in team score

---

### Test 4.3: Rapid Gift Sequence
**Objective**: Verify multiple gifts accumulate correctly

**Steps**:
1. Team A score = 0
2. Send 3 gifts rapid-fire: $50, $100, $50
3. Observe cumulative scoring
4. Total should be $200

**Verification**:
- [ ] Gifts arrive in order: $50 → $100 → $50
- [ ] Score updates correctly: 0 → 50 → 150 → 200
- [ ] No gifts lost or double-counted
- [ ] All animations display
- [ ] Timing: Each gift registers within 500ms

**Performance Check**:
- [ ] No lag or freezing during rapid gifts
- [ ] Score bar smooth animation (no jittering)
- [ ] No console errors or warnings

**Expected Result**: Multiple gifts process sequentially and accumulate correctly

---

### Test 4.4: Cross-Team Gift Scoring
**Objective**: Verify Team B also receives gifts and scores

**Steps**:
1. Team A score = 200 (from previous test)
2. Viewer in Team B sends 1 gift ($75)
3. Observe Team B score update

**Verification**:
- [ ] Team A remains 200
- [ ] Team B score becomes 75
- [ ] Score bar adjusts to show 200:75 ratio
- [ ] Correct team's side updates visually
- [ ] Database shows both scores: `score_challenger=200, score_opponent=75`

**Expected Result**: Both teams can receive gifts independently

---

### Test 4.5: Large Gift Value
**Objective**: Verify large gifts process without error

**Steps**:
1. Ensure viewer has 10,000+ coins
2. Send highest-cost gift available (usually 5,000+ coins)
3. Observe score update

**Verification**:
- [ ] Gift processes without error
- [ ] Score updates correctly to large number
- [ ] Coin balance deducted accurately
- [ ] No truncation or overflow in UI
- [ ] Database stores full value

**Expected Result**: Large gift values handled correctly

---

## TEST PHASE 5: CROWN DISTRIBUTION

### Test 5.1: Battle Win & Crown Award
**Objective**: Verify winning team receives crowns

**Steps**:
1. Battle at T=0:10 (sudden death about to start)
2. Team A score = 500, Team B score = 300
3. Allow timer to expire (end at 0:00)
4. Observe results screen

**Verification**:
- [ ] Results overlay appears
- [ ] Team A declared winner (higher score)
- [ ] Crown icon displayed for Team A
- [ ] Team A participants show crown badges
- [ ] Database updated: each Team A member `battle_crowns += 2`

**Crown Check for Each Winner**:
```sql
SELECT id, battle_crowns, battle_crown_streak FROM user_profiles 
WHERE id IN ('[admin_id]', '[viewer_a_id]', '[viewer_b_id]', ...);
-- Each Team A member should have +2 crowns from previous value
```

**Expected Result**: Winning team members all awarded 2 crowns each

---

### Test 5.2: Streak System
**Objective**: Verify consecutive wins create streak

**Steps**:
1. Win first battle (Team A wins, all get +2 crowns, streak=1)
2. Request rematch
3. Win second battle in a row (Team A wins again)
4. Request rematch
5. Win third battle in a row (Team A wins again, streak=3)

**Verification**:
- [ ] After 1st win: `battle_crown_streak = 1` (no badge)
- [ ] After 2nd win: `battle_crown_streak = 2` (no badge)
- [ ] After 3rd win: `battle_crown_streak = 3` (STREAK BADGE appears)
- [ ] UI shows flame icon 🔥 for "3+ win streak"
- [ ] Streak visual indicator (glow, color change) on profile

**Expected Result**: 3-win streak tracked and visually indicated

---

### Test 5.3: Streak Reset on Loss
**Objective**: Verify losing breaks streak

**Steps**:
1. Team A has active 3+ win streak
2. Arrange new battle where Team B wins (lower team score)
3. Observe Team A's streak after loss

**Verification**:
- [ ] Team A `battle_crown_streak = 0`
- [ ] Flame icon removed from profile
- [ ] Team B gains streaks (if applicable)
- [ ] Database shows reset: `UPDATE user_profiles SET battle_crown_streak = 0`

**Expected Result**: Losing breaks active streak immediately

---

## TEST PHASE 6: REMATCH FUNCTIONALITY

### Test 6.1: Rematch Button Visibility
**Objective**: Verify rematch option shown after battle ends

**Steps**:
1. Battle concludes (timer hits 0)
2. Results overlay appears
3. Look for rematch button

**Verification**:
- [ ] "REMATCH" button visible in results overlay
- [ ] Button clickable and responsive
- [ ] Text: "REMATCH" with flame icon 🔥
- [ ] Button for each team (Team A → Team B can each request)

**Expected Result**: Rematch button clearly visible after battle ends

---

### Test 6.2: Rematch Countdown (10 seconds)
**Objective**: Verify 10-second window for rematch acceptance

**Steps**:
1. Battle ends
2. Neither team clicks rematch button
3. Watch timer countdown: 10 → 9 → 8... → 1 → 0
4. At 0, auto-return to broadcast

**Verification**:
- [ ] "Returning in 10s" text visible
- [ ] Countdown timer shown in results overlay
- [ ] Decrements by 1 every second
- [ ] At 0, results overlay closes
- [ ] Users returned to broadcast view (not battle)
- [ ] Viewer UI shows back to broadcast grid

**Expected Result**: 10-second rematch window auto-expires, users returned

---

### Test 6.3: Rematch Acceptance (Both Teams)
**Objective**: Verify rematch starts when both teams accept

**Steps**:
1. Battle ends, results overlay shown
2. Admin clicks "REMATCH" button
3. Officer clicks "REMATCH" button
4. Observe battle restart

**Verification**:
- [ ] First click registers: "Waiting for other team..." or similar message
- [ ] Second click triggers: "Rematch starting! Fight!"
- [ ] Broadcast reverts to 5-second countdown
- [ ] New battle with fresh scores: 0 vs 0
- [ ] New `battle_sessions` record created with new `battleId`
- [ ] Arena ready: 5 → 4 → 3 → 2 → 1 → active

**Database Check**:
```sql
SELECT COUNT(*) FROM battle_sessions 
WHERE stream_id_a = '[stream_a_id]' AND created_at > NOW() - INTERVAL 1 minute;
-- Should have 2+ battles from repeated rematches
```

**Expected Result**: Rematch triggers instant battle restart with new ID

---

### Test 6.4: Rematch Decline (One Team)
**Objective**: Verify rematch denies if only one team accepts

**Steps**:
1. Battle ends
2. Admin clicks "REMATCH"
3. Wait 5 seconds (Officer doesn't click)
4. Observe result

**Verification**:
- [ ] Admin sees: "Waiting for other team..." message
- [ ] After 10s countdown expires, rematch NOT started
- [ ] Battle ends, users returned to broadcast
- [ ] Battle state clears: `is_battle = false`, `battle_id = null`
- [ ] Normal broadcast resumes with battle UI hidden

**Expected Result**: Only 1 team accepting doesn't trigger rematch

---

## TEST PHASE 7: FORFEIT MECHANICS

### Test 7.1: Forfeit Button During Battle
**Objective**: Verify forfeit button accessible during active battle

**Steps**:
1. Battle active (T = 1:30)
2. Observe left side of battle UI (broadcaster controls)
3. Look for "Forfeit" button

**Verification**:
- [ ] "Forfeit" button visible
- [ ] Button red/warning color (red-600)
- [ ] Text: "Forfeit"
- [ ] Button clickable and responsive
- [ ] Only visible to broadcasters (not viewers in boxes)

**Expected Result**: Forfeit button accessible during active battle

---

### Test 7.2: Forfeit Confirmation Dialog
**Objective**: Verify confirmation before forfeit

**Steps**:
1. Battle active
2. Click "Forfeit" button
3. Observe confirmation dialog

**Verification**:
- [ ] Confirmation modal appears
- [ ] Message: "Are you sure you want to forfeit? The other team will win and receive crowns."
- [ ] Two buttons: "Confirm" / "Cancel"
- [ ] Clicking "Cancel" closes dialog, battle continues
- [ ] Battle timer continues (not paused during dialog)

**Expected Result**: Confirmation dialog prevents accidental forfeits

---

### Test 7.3: Forfeit Execution & Winner Award
**Objective**: Verify forfeit ends battle and awards crowns to other team

**Steps**:
1. Battle active
2. Admin clicks "Forfeit"
3. Confirms forfeit in dialog
4. Observe results

**Verification**:
- [ ] Battle immediately ends (timer stops)
- [ ] Status updated: `battles.status = 'ended'`
- [ ] Results overlay shown
- [ ] Other team (Officer) displayed as winner
- [ ] Winner text: "[Team Name] Wins! (Victory by Forfeit)" or similar
- [ ] Crowns awarded to Officer's team: Each member gets +2 crowns
- [ ] Database: `battles.winner_stream_id = [opponent_stream_id]`, `forfeit = true`

**Crown Verification**:
```sql
SELECT id, battle_crowns FROM user_profiles 
WHERE id = '[officer_id]';
-- Should show +2 from before forfeit
```

**Expected Result**: Forfeit ends battle immediately, other team wins with crown awards

---

### Test 7.4: Forfeiting Broadcaster Returns to Own Stream
**Objective**: Verify forfeiting broadcaster goes back to their stream, not opponent's

**Steps**:
1. Admin (broadcaster) forfeits
2. Observe Admin's screen

**Verification**:
- [ ] Admin returned to their own broadcast view (BroadcastGrid)
- [ ] Admin's stream still live and visible
- [ ] Officer's stream visible too (both still broadcasting)
- [ ] Battle UI cleared
- [ ] Troll Engine overlay re-enabled
- [ ] Admin can still broadcast, chat, send gifts (non-battle features)

**Expected Result**: Forfeiting broadcaster returns to own stream broadcast, not opponent's

---

## TEST PHASE 8: DIFFERENT BATTLE FORMATS

### Test 8.1: 1v1 Battle
**Objective**: Verify 1v1 format with just broadcasters (no guest viewers)

**Steps**:
1. Start new broadcast (no viewers join seats)
2. Challenge accepted
3. Observe format

**Verification**:
- [ ] Grid layout: 2 columns × 1 row (1 broadcaster each side)
- [ ] Timer shows "1v1 BATTLE"
- [ ] Both broadcasters visible, no guest boxes
- [ ] Victory/loss counted for 1 person each side

**Expected Result**: 1v1 format works with just 2 broadcasters

---

### Test 8.2: 2v2 Battle
**Objective**: Verify 2v2 format

**Steps**:
1. Broadcast started
2. 1 viewer joins Admin's stream (2 total: host + 1 guest)
3. 1 viewer joins Officer's stream (2 total: host + 1 guest)
4. Challenge battle

**Verification**:
- [ ] Grid layout: 2 columns × 2 rows (4 boxes total)
- [ ] Timer shows "2v2 BATTLE"
- [ ] Each broadcaster + 1 guest visible
- [ ] Scores split between 2 per team

**Expected Result**: 2v2 format grid displays correctly

---

### Test 8.3: 3v3 Battle
**Objective**: Verify 3v3 format

**Steps**:
1. 2 viewers join Admin's stream (3 total: host + 2 guests)
2. 2 viewers join Officer's stream (3 total: host + 2 guests)
3. Challenge battle

**Verification**:
- [ ] Grid layout: 3 columns × 2 rows (6 boxes total)
- [ ] Each side shows exactly 3 boxes
- [ ] Timer shows "3v3 BATTLE"

**Expected Result**: 3v3 grid layout correct

---

### Test 8.4: 4v4 Battle
**Objective**: Verify 4v4 format

**Steps**:
1. 3 viewers join Admin's stream (4 total)
2. 3 viewers join Officer's stream (4 total)
3. Challenge battle

**Verification**:
- [ ] Grid layout: 4 columns × 2 rows (8 boxes)
- [ ] Timer shows "4v4 BATTLE"

**Expected Result**: 4v4 grid layout correct

---

### Test 8.5: 5v5 Battle
**Objective**: Verify 5v5 format (maximum)

**Steps**:
1. 4 viewers join Admin's stream (5 total)
2. 4 viewers join Officer's stream (5 total)
3. Challenge battle

**Verification**:
- [ ] Grid layout: 5 columns × 2 rows (10 boxes)
- [ ] Timer shows "5v5 BATTLE"
- [ ] All 10 boxes populated and visible
- [ ] 6th viewer attempting to join gets "Team Full" message

**Expected Result**: 5v5 maximum enforced and displayed correctly

---

## TEST PHASE 9: REAL-TIME SYNCHRONIZATION

### Test 9.1: Multi-Client Score Sync
**Objective**: Verify score updates synchronized across multiple clients

**Setup**: Open 3 separate browser instances
- Browser 1: Admin (broadcaster)
- Browser 2: Officer (broadcaster)
- Browser 3: Viewer

**Steps**:
1. Battle active
2. Admin sends gift (Browser 1)
3. Observe score update on all 3 browsers

**Verification**:
- [ ] Score updates on all 3 clients within 500ms
- [ ] Score number identical on all browsers
- [ ] Gift animation appears on all 3 screens
- [ ] No score discrepancies or mismatches

**Expected Result**: Score changes broadcast to all participants in real-time

---

### Test 9.2: Chat Message Real-Time
**Objective**: Verify chat messages appear on all clients

**Steps**:
1. Battle active (Team A messaging)
2. Send chat message from Admin: "Test message"
3. Check if Officer and Viewer see message

**Verification**:
- [ ] Message appears in all 3 browser chat windows within 1 second
- [ ] Timestamp is identical
- [ ] Message sender correctly identified
- [ ] Messages in correct order

**Expected Result**: Chat messages broadcast to all battle participants

---

### Test 9.3: Participant Join Real-Time
**Objective**: Verify new participant joining shows immediately

**Steps**:
1. Battle active with 3v3
2. New viewer joins 4th seat on Admin's team
3. Check all clients

**Verification**:
- [ ] New participant visible in 4th box on all 3 browsers
- [ ] Name and avatar appear immediately
- [ ] Video box populates with new participant's video
- [ ] No delay or lag

**Expected Result**: New participants show immediately on all clients

---

### Test 9.4: Score Freeze During Sudden Death
**Objective**: Verify scores locked during sudden death phase

**Steps**:
1. Battle reaches 0:10 (sudden death starts)
2. Send gift while in sudden death (T=0:08)
3. Check if score updates

**Verification**:
- [ ] Gift sent successfully
- [ ] Coin deducted from sender
- [ ] **Score DOES NOT increase** during sudden death
- [ ] Message: "Sudden death: scores frozen" (or similar)
- [ ] Timer continues: 0:08 → 0:07...

**Expected Result**: Gifts don't contribute to score during sudden death

---

## TEST PHASE 10: ERROR HANDLING & EDGE CASES

### Test 10.1: Network Disconnect Recovery
**Objective**: Verify battle continues if participant loses connection

**Steps**:
1. Battle active
2. Disconnect Officer's internet (pull network cable or WiFi)
3. Wait 5 seconds
4. Reconnect Officer

**Verification**:
- [ ] Admin and Viewers continue battle (don't auto-forfeit)
- [ ] Officer appears disconnected (grayed out box, "reconnecting..." indicator)
- [ ] Battle timer continues
- [ ] When Officer reconnects, their video feeds back in
- [ ] Battle resumes normally
- [ ] No scores lost

**Expected Result**: Battle tolerates brief disconnects without forfeiting

---

### Test 10.2: Empty Team Handling
**Objective**: Verify battle handles if all team members disconnect

**Steps**:
1. Battle active, 1v1 (just 2 broadcasters)
2. Admin disconnects and doesn't reconnect within 30s

**Verification**:
- Officer's battle should auto-end with Officer as winner
- OR: Battle continues with Admin's boxes grayed out
- Verify expected behavior in logs

**Note**: Actual behavior to be confirmed from codebase

**Expected Result**: System handles full team disconnection gracefully

---

### Test 10.3: Insufficient Coins for Gift
**Objective**: Verify gift fails if user lacks coins

**Steps**:
1. Battle active
2. User has only 50 coins
3. Attempt to send 100-coin gift

**Verification**:
- [ ] Gift button disabled or error shown: "Insufficient coins"
- [ ] Gift NOT sent
- [ ] Coin balance unchanged (no deduction)
- [ ] Score unchanged
- [ ] No database transaction

**Expected Result**: Gift rejected with clear error message

---

### Test 10.4: Battle While Another Battle Active
**Objective**: Verify user can't start 2 battles simultaneously

**Steps**:
1. Admin in active battle with Officer
2. Challenger A approaches Admin's stream
3. Challenger A sends challenge

**Verification**:
- [ ] Challenge rejected: "Admin is in a battle"
- OR: Challenge queued but can't accept until current battle ends
- [ ] Admin's battle continues uninterrupted

**Expected Result**: Can't participate in multiple battles concurrently

---

### Test 10.5: Rapid Battle End & Rematch
**Objective**: Verify battle state clears properly between battles

**Steps**:
1. Battle 1 ends, rematch requested
2. Battle 2 starts immediately
3. Battle 2 ends quickly

**Verification**:
- [ ] Each battle has unique `battleId`
- [ ] Scores reset to 0 for each battle
- [ ] Participants list accurate for each battle
- [ ] No score carryover between battles
- [ ] Database shows distinct battle records

**Expected Result**: Rapid battles handled cleanly with no data mixing

---

## TEST PHASE 11: VISUAL & UI VERIFICATION

### Test 11.1: Timer Display Accuracy
**Objective**: Verify timer format and precision

**Steps**:
1. Battle active
2. Record timer display at several points

**Verification**:
- [ ] Format: "MM:SS" (e.g., "3:00", "0:30")
- [ ] Single digits: "0:03" (with leading zero)
- [ ] Timer centered in arena
- [ ] Font size readable (18-24px)
- [ ] Color: white during active, red during sudden death

**Expected Result**: Timer displays correctly formatted and visible

---

### Test 11.2: Score Display Accuracy
**Objective**: Verify score numbers correct and prominent

**Steps**:
1. Battle with various scores (100, 500, 1000, etc.)
2. Check score display

**Verification**:
- [ ] Team A score on left, Team B on right
- [ ] Numbers display with commas if over 1000 (e.g., "1,200")
- [ ] Proportional score bar updates with numbers
- [ ] Font: bold, large (20-28px)
- [ ] Colors: Team A = purple/blue, Team B = emerald/green

**Expected Result**: Scores clearly displayed and updated

---

### Test 11.3: Crown Badge Display
**Objective**: Verify crown icons appear for winners

**Steps**:
1. Battle ends
2. Team A wins
3. Observe results overlay and broadcast

**Verification**:
- [ ] Crown icon (👑) appears next to Team A name
- [ ] Crown icon visible in results overlay
- [ ] Team A boxes highlighted or styled differently
- [ ] Winner banner: "Team A Wins!" with crown graphic

**Expected Result**: Winner badges and crowns visually clear

---

### Test 11.4: Sudden Death Visual Feedback
**Objective**: Verify SUDDEN DEATH is visually distinct

**Steps**:
1. Battle reaches 0:10
2. Observe visual changes

**Verification**:
- [ ] Timer color: changes to RED
- [ ] Banner appears: "⚡ SUDDEN DEATH ⚡" (text or graphic)
- [ ] Background glow or effect (pulse, animation)
- [ ] Audio cue (if sound enabled): warning sound
- [ ] Text animation: pulsing or flashing

**Expected Result**: Sudden death visually prominent and unmistakable

---

## TEST PHASE 12: PERFORMANCE & LOAD

### Test 12.1: 5v5 Battle Performance
**Objective**: Verify smooth performance with 10 participants

**Setup**: 5v5 battle with 10 total participants (2 broadcasters + 8 viewers)

**Metrics**:
- [ ] Frame rate: 30+ fps (smooth video)
- [ ] Score update latency: <500ms
- [ ] Gift animation smooth (no stutter)
- [ ] Chat message latency: <1s
- [ ] Memory usage: <500MB per client
- [ ] CPU usage: <30%

**Testing**:
1. Open DevTools → Performance tab
2. Record performance during:
   - Timer running
   - Multiple gifts sent
   - Chat active
3. Export profile and check metrics

**Expected Result**: Battle runs smoothly with 10 participants

---

### Test 12.2: High Frequency Gifting
**Objective**: Verify system handles rapid gifts

**Setup**: Battle active, high-speed gift spam

**Steps**:
1. Send 20 gifts in 5 seconds (4 per second)
2. Monitor for errors, missed gifts, or score issues

**Verification**:
- [ ] All 20 gifts processed and scored
- [ ] Final score correct (sum of all 20)
- [ ] No gifts dropped or duplicated
- [ ] No console errors
- [ ] No lag or freezing

**Expected Result**: System handles rapid gifting without data loss

---

## TEST PHASE 13: DATABASE INTEGRITY

### Test 13.1: Battle Record Creation
**Objective**: Verify all battle data saved correctly

**Query**:
```sql
SELECT 
  id,
  challenger_stream_id,
  opponent_stream_id,
  status,
  score_challenger,
  score_opponent,
  winner_stream_id,
  created_at,
  started_at,
  ended_at
FROM battles
WHERE id = '[test_battle_id]';
```

**Verification**:
- [ ] All fields populated
- [ ] Status progression: 'pending' → 'active' → 'ended'
- [ ] Timestamps logical (created < started < ended)
- [ ] Winner correctly set to winning stream

---

### Test 13.2: Participant Tracking
**Objective**: Verify all participants recorded

**Query**:
```sql
SELECT COUNT(*) FROM battle_participants 
WHERE battle_id = '[test_battle_id]';
-- Should equal 10 for 5v5
```

**Verification**:
- [ ] Participant count matches expected (10 for 5v5)
- [ ] All participant roles: host, stage, or guest
- [ ] All participant teams: 'challenger' or 'opponent'

---

### Test 13.3: Stream State Cleanup
**Objective**: Verify stream battle flags cleared after battle

**Query**:
```sql
SELECT is_battle, battle_id FROM streams 
WHERE id IN ('[stream_a_id]', '[stream_b_id]');
-- Should be: is_battle=false, battle_id=NULL
```

**Verification**:
- [ ] After battle ends: `is_battle = false`
- [ ] After battle ends: `battle_id = NULL`
- [ ] Both streams cleared (not just loser)

---

## TEST PHASE 14: FINAL INTEGRATION TEST

### Test 14.1: Complete End-to-End Flow
**Objective**: One full battle from start to finish

**Scenario**:
1. Admin and Officer start live streams
2. Officer challenges Admin to 5v5 battle
3. 4 viewers join each team (8 total participants)
4. Battle countdown: 5 seconds
5. Battle active: 180 seconds
   - Multiple gifts sent by viewers
   - Chat messages exchanged
   - Team A accumulates 1000 points
   - Team B accumulates 800 points
6. At T=0:15, sudden death begins
7. At T=0:00, battle ends
8. Results shown: Team A wins, crowns awarded
9. Both teams click rematch
10. New battle starts

**Verification Checklist**:
- [ ] All phases complete without errors
- [ ] Scores accumulate correctly (1000 vs 800)
- [ ] Sudden death triggered at 10s
- [ ] Winner correctly determined
- [ ] Crowns awarded to Team A members
- [ ] Rematch starts cleanly
- [ ] No visual glitches or UI errors
- [ ] All participants remain connected
- [ ] Database records all data accurately

**Expected Result**: Complete battle flow works seamlessly

---

## REPORTING TEMPLATE

For each test, document:

```
**Test**: [Test Name]
**Date**: [Date] **Time**: [Time]
**Testers**: [Names]
**Status**: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

**Expected**:
- [Expected behavior]

**Actual**:
- [What actually happened]

**Issues Found**:
- [Any bugs or anomalies]

**Notes**:
- [Additional observations]

**Logs**:
- Console errors: [list]
- Database anomalies: [list]
- Performance metrics: [metrics]
```

---

## CRITICAL SUCCESS CRITERIA

Battle system is **PRODUCTION READY** when:
1. ✅ All battle formats (1v1 through 5v5) tested and passing
2. ✅ Timer synchronization within ±1s across all clients
3. ✅ Gift scoring real-time and accurate
4. ✅ Crown awards correct and database consistent
5. ✅ Rematch system working (both teams required)
6. ✅ Forfeit mechanic immediate and proper
7. ✅ All edge cases handled gracefully
8. ✅ No data loss or database inconsistencies
9. ✅ Performance stable with 10 participants
10. ✅ Zero critical bugs in 3+ full battle cycles

---

## QUICK COMMAND REFERENCE

**Reset Battle System** (for testing):
```sql
-- Clear all active battles
UPDATE streams SET is_battle = false, battle_id = NULL;
DELETE FROM battles WHERE status != 'ended';
DELETE FROM battle_participants;
DELETE FROM battle_sessions;

-- Verify cleanup
SELECT COUNT(*) FROM battles WHERE status = 'active';
-- Should return 0
```

**Quick Leaderboard Check**:
```sql
SELECT username, battle_crowns, battle_crown_streak, total_battle_wins
FROM user_profiles
ORDER BY battle_crowns DESC
LIMIT 10;
```

**Debug Battle State**:
```sql
SELECT 
  b.id,
  b.status,
  b.started_at,
  b.ended_at,
  b.score_challenger,
  b.score_opponent,
  COUNT(DISTINCT bp.user_id) as participant_count
FROM battles b
LEFT JOIN battle_participants bp ON b.id = bp.battle_id
WHERE b.created_at > NOW() - INTERVAL 1 hour
GROUP BY b.id
ORDER BY b.created_at DESC;
```
