# Mai Troll Broadcast & Battle System Audit Report

**Date:** 2026-06-22  
**Scope:** Random Battles, BroadcastPage, ViewerPage, Device Compatibility  
**Target:** 1,500 concurrent users at launch

---

## 🔴 CRITICAL ISSUES (Fix Before Launch)

### 1. Missing `broadcaster_id` Foreign Key on `streams` Table
- **File:** `supabase/migrations/20290609000000_add_gaming_stream_columns.sql`
- **Issue:** The `broadcaster_id` column on `streams` references `auth.users(id)` but should reference `public.user_profiles(id)`. The migration may not have been applied yet.
- **Impact:** `stream.broadcaster_id` is `undefined` → `handleTrollWallSystemPost` crashes with "broadcasterId is not defined" when ending streams. Stop-streaming API returns 500.
- **Fix:** Migration already corrected to `REFERENCES public.user_profiles(id)`. **Must be applied.**
- **Also:** Added defensive guards in `server/api/broadcasts.js` for both `stopStreaming` and `handleTrollWallSystemPost`.

### 2. `getThreadMessages` FK Join Fails → All Senders Show "Unknown"
- **File:** `src/services/utromailService.ts`
- **Issue:** Used `user_profiles!utromail_messages_sender_id_fkey(...)` join which fails if FK constraint doesn't exist in DB.
- **Impact:** Every message in Utromail shows sender as "Unknown" / `?`.
- **Fix:** Removed FK join, replaced with manual batch profile fetch (same pattern as `getThreads`).

### 3. `stream_audience_presence` Missing FK → Schema Cache Error
- **File:** `supabase/migrations/20260621000005_fix_stream_audience_presence_relationship.sql`
- **Issue:** `stream_audience_presence.user_id` has no FK to `user_profiles.id`.
- **Impact:** Realtime subscription throws "Could not find a relationship between 'stream_audience_presence' and 'user_id'".
- **Fix:** Migration created. **Must be applied.**

### 4. ChatBubble Sends Messages Without Recipient → "Unknown" in Inbox
- **File:** `src/components/ChatBubble.tsx`
- **Issue:** `handleSend` called `sendMessage()` without `recipientId`/`recipientMail`, creating system/broadcast threads instead of 1-on-1 threads.
- **Impact:** Recipient sees conversation but other participant shows "Unknown".
- **Fix:** Now passes `recipientId` and `recipientMail` from `activeThread.other_user_id` / `otherParticipant.user_id`.

### 5. Broadcast Stream Not Marked Ended When Backend Succeeds
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Issue:** DB update to `is_live: false, status: 'ended'` was inside `if (!backendStopped)` block. If backend API succeeded, DB was never updated.
- **Impact:** Stream appears "live" in database after broadcaster ends it.
- **Fix:** DB update now always runs regardless of backend API result.

### 6. `useBroadcastStreaming.stopBroadcast` Never Updates DB
- **File:** `src/hooks/useBroadcastStreaming.ts`
- **Issue:** Only called backend API and updated local React state. Never directly updated `streams` table.
- **Impact:** If backend doesn't update stream record, stream stays live in DB.
- **Fix:** Added direct `streams` table update after backend API call.

---

## 🟡 HIGH PRIORITY (Performance at Scale)

### 7. BroadcastPage Has 18+ `setInterval`/`setTimeout` Calls
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Issues found:**
  - Seat tick interval: every 1s (`setSeatTick`) — causes full re-render every second
  - Watch time interval: every 30s
  - Host chat lock poll: every 30s
  - Chat lock countdown: every 1s
  - Stream check interval (line 2084)
  - Watch time emit: every 30s
  - Heartbeat ping: every 30s
  - Swipe timer: every 30s
  - Mute expiry timer
  - Multiple `setTimeout` for navigation/delays
- **Impact:** Each broadcaster creates ~8+ intervals. With 100 concurrent broadcasters, that's 800+ intervals running. The 1s seat tick causes unnecessary re-renders.
- **Recommendation:** 
  - Replace 1s seat tick with event-driven updates
  - Consolidate intervals where possible
  - Use visibility API to pause intervals in background tabs

### 8. ViewerPage Has 11+ `setInterval`/`setTimeout` Calls
- **File:** `src/pages/broadcast/ViewerPage.tsx`
- **Issues found:**
  - Watch time recording: every 60s
  - Host chat lock poll: every 30s
  - Chat lock countdown: every 1s
  - Heartbeat: every 30s
  - Gift animation cleanup: 12s timeout per gift
  - Multiple stage join timeouts
- **Impact:** Each viewer creates ~5+ intervals. With 1,500 concurrent viewers, that's 7,500+ intervals.
- **Recommendation:** Reduce heartbeat frequency to 60s for viewers. Use visibility API.

### 9. `useStreamAudiencePresence` — Ghost Mode Fetch on Every Audience Change
- **File:** `src/hooks/useStreamAudiencePresence.ts`
- **Issue:** The ghost mode `useEffect` depends on `audience` (the full array). Every audience change triggers a re-fetch of ALL user profiles for ghost mode status.
- **Impact:** With 1,500 viewers, every join/leave triggers a batch profile query for all 1,500 users.
- **Recommendation:** 
  - Debounce the ghost mode fetch
  - Only fetch profiles for new users, not the entire list
  - Cache ghost mode status

### 10. `useBattleRealtime` — Score Polling Still Active
- **File:** `src/hooks/useBattleRealtime.ts`
- **Issue:** Has a `scorePollRef` interval that polls scores even though score updates now come via broadcast.
- **Impact:** During battles, every viewer polls scores on an interval.
- **Recommendation:** Remove the score polling interval entirely. The broadcast `score_update` event already handles this.

### 11. Duplicate Messages in Utromail Chat
- **File:** `src/pages/utromail/UtromailPage.tsx`
- **Issue:** Optimistic message + realtime subscription + refetch caused triple message insertion.
- **Impact:** Messages appear duplicated in chat.
- **Fix:** Removed optimistic message approach. Now uses realtime-only with `sentMessageIdsRef` to track sent messages and prevent duplicates.

### 12. Read Receipt Updates Trigger Realtime on `utromail_messages`
- **File:** `src/pages/utromail/UtromailPage.tsx`
- **Issue:** Was updating `utromail_messages.is_read` directly, triggering realtime UPDATE events that other components' handlers couldn't process (missing `recipient_id` in payload).
- **Impact:** "record 'new' has no field 'recipient_id'" error.
- **Fix:** Now only writes to `utromail_read_status` table (no realtime listeners). Read status fetched on message load.

---

## 🟠 MEDIUM PRIORITY (Device Compatibility)

### 13. `useIsMobile` Doesn't Detect iPad Properly
- **File:** `src/hooks/useIsMobile.ts`
- **Issue:** Uses `width < 768` and `navigator.maxTouchPoints > 0`. iPad Pro in landscape has width > 768 but is still a touch device. iPad Mini in portrait may be < 768 but needs mobile layout.
- **Impact:** iPad users may get desktop layout with touch controls that don't work well, or mobile layout with oversized touch targets.
- **Recommendation:** Add explicit iPad detection:
  ```ts
  const isIPad = /iPad/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ```

### 14. MobileViewerPage Is a Mock/Stub
- **File:** `src/appMobile/pages/MobileViewerPage.tsx`
- **Issue:** Contains hardcoded `sampleChat` and `sampleGifts` data. Not connected to real Supabase/LiveKit.
- **Impact:** Mobile viewers see fake data. No actual streaming functionality.
- **Recommendation:** This needs to be a real implementation before launch if mobile web is supported.

### 15. Missing MobileBroadcastPage / MobileLiveNowPage
- **File:** `src/appMobile/mobileRoutes.tsx`
- **Issue:** Routes reference `MobileBroadcastPage`, `MobileLiveNowPage`, `MobileHomepage`, etc. but these files don't exist on disk.
- **Impact:** Mobile broadcast/live routes will crash.
- **Recommendation:** Either create these files or remove the routes.

### 16. Touch Event Handling on BroadcastPage
- **Issue:** BroadcastPage uses `framer-motion` drag for floating chat. On touch devices, this may conflict with scroll gestures.
- **Impact:** iPad/phone users may struggle to scroll the chat or interact with draggable elements.
- **Recommendation:** Add touch-specific event handlers. Use `touch-action: CSS` to prevent scroll conflicts.

### 17. LiveKit Video Rendering on iOS Safari
- **Issue:** iOS Safari has specific requirements for video playback (playsinline, muted autoplay). The `LiveKitVideoPlayer` component may not handle this.
- **Impact:** Video may not play on iPhones/iPads, or may play with audio muted.
- **Recommendation:** Ensure all `<video>` elements have `playsinline` attribute. Test on real iOS devices.

---

## 🔵 LOW PRIORITY (Code Quality / Minor Bugs)

### 18. `BroadcastPage` Is ~6,400 Lines
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Issue:** Single file is enormous. Contains battle logic, chat, gifts, seats, recording, LiveKit, etc.
- **Impact:** Hard to maintain, easy to introduce bugs, slow to hot-reload in dev.
- **Recommendation:** Split into smaller components. Extract battle logic, chat, and gift system into separate files.

### 19. `ViewerPage` Is ~3,400 Lines
- **File:** `src/pages/broadcast/ViewerPage.tsx`
- **Issue:** Same as BroadcastPage — too large for a single file.
- **Recommendation:** Extract sub-components.

### 20. BattleView Has Excessive Console Logging
- **File:** `src/components/broadcast/BattleView.tsx`
- **Issue:** Has `logBroadcastLifecycle`, `logRealtime`, `logParticipants`, `logRTC` helpers that log on every lifecycle event.
- **Impact:** In production with 1,500 viewers, this creates massive console noise and minor performance overhead.
- **Recommendation:** Wrap in `if (import.meta.env.DEV)` or remove entirely.

### 21. `useRandomBattleQueueController` Has Multiple Overlapping Timers
- **File:** `src/hooks/useRandomBattleQueueController.ts`
- **Issue:** Uses `delayTimerRef`, `pollTimerRef`, `activationTimerRef`, `autoQueueTimerRef` — all separate timers that can overlap.
- **Impact:** Race conditions where multiple timers fire simultaneously.
- **Recommendation:** Consolidate into a single state machine with one timer.

### 22. No Error Boundary Around Battle Components
- **Issue:** If `useBattleRealtime` or `BattleView` throws, it crashes the entire broadcast/viewer page.
- **Impact:** One battle bug takes down the whole stream for all viewers.
- **Recommendation:** Wrap battle components in `ErrorBoundary`.

### 23. `useBattleState` Polls Battle Data
- **File:** `src/hooks/useBattleState.ts`
- **Issue:** Uses `setInterval` to poll battle status instead of relying on realtime.
- **Impact:** Unnecessary DB queries during battles.
- **Recommendation:** Replace with `useBattleRealtime` subscription.

---

## 📊 SCALING RECOMMENDATIONS FOR 1,500 USERS

### Realtime Channel Budget
| Component | Channels per User | 1,500 Users |
|-----------|------------------|-------------|
| User channel | 1 | 1,500 |
| Page channel | 1 | 1,500 |
| Stream audience | 1 per stream | ~500 per stream |
| Battle (if viewing) | 1 | ~300 per battle |
| **Total baseline** | **2-3** | **~4,500-7,500** |

### Key Optimizations Needed:
1. **Reduce heartbeat intervals** from 30s to 60s for viewers
2. **Pause realtime subscriptions** on background tabs (visibility API)
3. **Batch profile fetches** instead of per-message lookups
4. **Remove duplicate polling** where realtime already exists
5. **Use `head: true`** for count queries instead of fetching full rows
6. **Implement connection pooling** for Supabase realtime (shared channels where possible)

### Database Write Hotspots:
1. **`stream_audience_presence`** — every join/leave/write. Batch where possible.
2. **`user_presence`** — heartbeat every 30s per user. Reduce to 60s.
3. **`stream_analytics_daily`** — update on every viewer event. Batch to 1-5 min.
4. **`utromail_read_status`** — write on every message read. Batch reads.

---

## ✅ ALREADY FIXED (This Session)

1. ✅ All `tcps` references removed from codebase, replaced with `utromail`
2. ✅ `DistrictTour.tsx` deleted
3. ✅ JailPage TCPS references renamed to Utromail
4. ✅ `stream_audience_presence` FK join removed (manual profile fetch)
5. ✅ `getThreadMessages` FK join removed (manual profile fetch)
6. ✅ Utromail message duplication fixed (removed optimistic messages)
7. ✅ Read receipts implemented (single/double check)
8. ✅ Typing indicator implemented
9. ✅ Auto-open conversation on new message
10. ✅ `broadcaster_id` FK reference corrected to `public.user_profiles(id)`
11. ✅ Backend defensive guards for missing `broadcaster_id`
12. ✅ ChatBubble recipient info passed correctly
13. ✅ Stream always marked ended on broadcast stop
14. ✅ `useBroadcastStreaming` updates DB directly

---

## 🚀 PRE-LAUNCH CHECKLIST

- [ ] Apply migration `20290609000000_add_gaming_stream_columns.sql`
- [ ] Apply migration `20260621000005_fix_stream_audience_presence_relationship.sql`
- [ ] Add FK constraint: `utromail_messages.sender_id → user_profiles.id`
- [ ] Test broadcast end-to-end (start → stream → end → verify DB)
- [ ] Test random battle flow (queue → match → battle → end)
- [ ] Test on iPhone Safari (video playback, touch controls)
- [ ] Test on iPad (layout, touch, video)
- [ ] Test on Android Chrome (video, touch)
- [ ] Load test with 100+ concurrent viewers
- [ ] Verify realtime channel count stays under 7,500
- [ ] Remove or gate all `console.log` statements for production
- [ ] Implement visibility API for background tab optimization
- [ ] Add ErrorBoundary around battle components
- [ ] Fix MobileViewerPage or remove the route
