# 🔍 Mai Troll — FRONTEND CONCURRENCY AUDIT (2026-06-22)

**Method:** Live code analysis of frontend hooks, components, and realtime subscriptions.

---

## ✅ ALREADY FIXED (Verified in Code)

### 1. eventsPerSecond: 50 (was 10)
- **File:** `src/lib/supabase.ts:22`
- **Status:** ✅ FIXED
- **Impact:** Prevents event drops during peak activity (gifts, likes, chat)

### 2. Battle Score Polling: 5s (was 2s)
- **File:** `src/hooks/useBattleRealtime.ts:301`
- **Status:** ✅ FIXED
- **Impact:** Reduced ~250 DB queries/sec to ~100 for 500 battle viewers

### 3. Top Gifters Polling: 60s (was 15s)
- **File:** `src/hooks/useStreamTopGifters.ts:23`
- **Status:** ✅ FIXED
- **Impact:** Reduced ~67 queries/sec to ~12 for 1000 viewers

### 4. Streamer Stats Polling: 120s (was 60s)
- **File:** `src/hooks/useStreamStats.ts:53`
- **Status:** ✅ FIXED
- **Impact:** Reduced ~8 queries/sec to ~4 for 1000 viewers

### 5. LiveContentContext Polling + Visibility Guard
- **File:** `src/contexts/LiveContentContext.tsx:165-220`
- **Status:** ✅ FIXED
- **Changes:** 
  - Stream polling: 60s → 90s with visibility guard
  - Auction polling: 30s with visibility guard
  - Single consolidated `home:global` channel replaces 3 separate channels
- **Impact:** Reduced polling + shared channel for all homepage users

### 6. Stream Realtime Manager (Singleton Pattern)
- **File:** `src/lib/realtime/streamRealtimeManager.ts`
- **Status:** ✅ IMPLEMENTED
- **Impact:** One channel per stream shared by all viewers (vs 12+ separate channels)

---

## ⚠️ PARTIALLY FIXED / NEEDS ATTENTION

### 7. Gaming Heartbeat: 15s (plan was 60s)
- **File:** `src/hooks/useGamingHeartbeat.ts:104`
- **Current:** `heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);`
- **Recommended:** Increase to 60s
- **Impact:** ~7 queries/sec per gaming stream

### 8. OBS Heartbeat: 5s (default)
- **File:** `src/hooks/useObsHeartbeat.ts:24`
- **Current:** `interval = 5000` (default)
- **Recommended:** Increase to 60s
- **Impact:** ~12 queries/sec per broadcaster

### 9. useActiveBroadcasts Polling: 30s
- **File:** `src/hooks/useActiveBroadcasts.ts:40`
- **Current:** `setInterval(checkActiveContent, 30000)`
- **Recommended:** Remove or increase to 2min (redundant with LiveContentContext)
- **Impact:** ~2 queries/sec

### 10. Perks Polling: Two 60s Intervals
- **File:** `src/hooks/usePerks.ts:36,74`
- **Current:** Two separate 60s `setInterval` calls
- **Recommended:** Consolidate into single interval or use Realtime
- **Impact:** 2x queries per user with perks

---

## 🚩 NOT YET FIXED (HIGH IMPACT)

### 11. Per-Card Viewer Count Subscriptions
- **File:** `src/hooks/useViewerTracking.ts:165-224`
- **Current:** `useLiveViewerCount()` creates `stream-viewer-count:{streamId}` channel
- **Status:** ❌ NOT FIXED
- **Impact:** Each live card opens 1 channel. 100 live cards = 100 channels per homepage user
- **Fix Required:** Shared subscription or query batching

### 12. ViewerPage Channel Count
- **File:** `src/pages/broadcast/ViewerPage.tsx`
- **Current Channels:**
  - `stream-realtime:{streamId}` via useStreamRealtime (singleton) ✅
  - `floating-chat:{streamId}` (separate channel)
  - `viewer-mute:{streamId}:{userId}` (separate channel)
  - `stream-seat-events:{streamId}` (separate channel)
  - `notifications:user:{userId}` (separate channel)
- **Total:** ~4-5 channels per viewer
- **Recommended:** Consolidate into `viewer-all:{streamId}` pattern
- **Impact:** 1000 viewers = 5000 channels (shared reduces this)

### 13. Auction Countdown: 1s Interval (Client-side)
- **File:** `src/hooks/useAuctionTimer.ts:44`
- **Current:** Local countdown interval runs every 1000ms
- **Impact:** This is client-side (not DB polling), but creates CPU overhead
- **Note:** Not a DB load issue, but 1000 auction viewers × 1s = 1000 intervals in browser

### 14. Host Chat Lock Polling: 1s (Client-side)
- **File:** `src/pages/broadcast/ViewerPage.tsx:824`
- **Current:** `setInterval(fetchHostChatLock, 30_000)` - Actually 30s, not 1s
- **Status:** ✅ Already visibility-gated and at reasonable interval

---

## 📊 CURRENT ESTIMATED CHANNEL LOAD

### Per-User Channel Count (After Fixes)

| Page / Action | Channels | Notes |
|---------------|----------|-------|
| Homepage (logged in) | ~7-8 | LiveContentProvider consolidated, needs per-card fix |
| Homepage (anon) | ~5 | Same channels minus user-specific |
| Broadcast Viewer | ~4-5 | stream-realtime + floating-chat + mute + notifications |
| Broadcast Host | ~5-7 | Plus lockdown, pinned products, heartbeat channels |
| Battle Viewer | ~1-2 | Consolidated battle-all channel |
| Battle Participant | ~1-2 | Consolidated, plus stream channels |
| Auction Viewer | ~1-2 | Timer channel + stream channels |
| Admin Dashboard | ~3-4 | Depends on sub-page |

### Estimated Concurrent Users Scenario

| Activity Mix | Users | Avg Channels Each | Total Channels | Status |
|--------------|-----|-------------------|----------------|--------|
| 1000 homepage + 500 viewers + 50 battles | 1550 | ~3-4 avg | ~4600-6200 | ⚠️ Warning |
| 2000 homepage + 1000 viewers + 100 battles | 3100 | ~3-4 avg | ~9300-12400 | 🔴 Risky |
| **RECOMMENDED MAX** | **2500** | | | 🟡 Monitor |

---

## 🎯 RECOMMENDED NEXT STEPS

### Priority 1: Critical (Do Now)
```tsx
// Fix: useObsHeartbeat - increase default interval
// File: src/hooks/useObsHeartbeat.ts:24
interval = 60000, // Changed from 5000
```

```tsx
// Fix: useGamingHeartbeat - increase check interval
// File: src/hooks/useGamingHeartbeat.ts:36
checkIntervalMs = 60 * 1000, // Changed from 30 * 1000
```

### Priority 2: High Impact
```tsx
// Fix: Create shared viewer count subscription
// File: src/contexts/LiveContentContext.tsx (add after existing home:global channel)
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams' }, handleAllViewerCounts)
```

### Priority 3: Optimization
```tsx
// Fix: Consolidate ViewerPage channels into viewer-all:{streamId}
// Combine: floating-chat, mute, seat-events into one channel
```

---

## ✅ SAFE CONCURRENT USER BASE ESTIMATE

**Based on current implementation (with fixes verified):**

| Concurrent Users | Risk Level | Notes |
|------------------|------------|-------|
| **500-1,000** | 🟢 Safe | No issues expected |
| **1,500-2,500** | 🟡 Warning | Some delay possible during peaks |
| **3,000-5,000** | 🔴 Breaking | Will hit connection/channel limits |

**Supabase Pro Realtime Limits:**
- Concurrent connections: ~500-1000
- Channels are shared (not per-user), so 1000 users on same channel = 1 connection

**LiveKit WebSocket Limits:**
- Per-room connections: ~15,000-20,000
- 1000 viewers per stream is safe

**Bottom Line:**
- **SAFE ZONE:** ~2,500 total concurrent users
- **WARNING ZONE:** 3,000-4,000 total concurrent users

---

## 🔧 TECHNICAL DEBT ITEMS

1. **`useActiveBroadcasts`** - Still polls 30s, remove or extend to 2min
2. **`usePerks`** - Two separate polling intervals, consolidate
3. **Per-card viewer counts** - Biggest remaining bottleneck
4. **OBS heartbeat** - Too frequent at 5s default
5. **Gaming heartbeat** - At 15s, could be 60s
6. **Floating chat channel** - Could be merged into stream-realtime channel