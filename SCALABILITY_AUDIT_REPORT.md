# Mai Troll Scalability Audit Report

**Date:** 2026-06-18
**Scope:** Full codebase audit for 10,000+ user readiness
**Framework:** React 18 + TypeScript + Vite
**Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
**Media:** LiveKit (broadcasting), Agora (legacy)

---

## Executive Summary

The Mai Troll codebase has **33 setInterval polling loops** across 13 files and **28 Supabase realtime channel subscriptions** across 28 files. While all channels are properly cleaned up and all intervals have clearInterval in their cleanup, there are significant opportunities to reduce database load, browser requests, and realtime overhead.

**Key Findings:**
- **~47 redundant polling intervals** can be replaced with realtime subscriptions or caching
- **~15 intervals** can have their frequency reduced
- **No centralized RealtimeManager** exists (channels are created ad-hoc)
- **React Query staleTime is 30s** (should be 5 min per spec)
- **Multiple edge functions** have unguarded JSON parsing and N+1 query patterns
- **No channel deduplication** (same channel name can be created multiple times)

---

## Phase 0 – Baseline Metrics

### Existing Benchmark Infrastructure
- `src/hooks/usePerformanceBenchmark.ts` (606 lines) - comprehensive browser-side benchmark
- `src/components/admin/LoadLab.tsx` (313 lines) - UI stress test tool
- `scripts/load-test-1000-users.mjs` - 1000-user load test
- `scripts/phase2-load-test.mjs` - Phase 2 load test with DB writes + realtime
- `scripts/stress-test.mjs` - LiveKit room stress test
- Console API: `window.__Mai Troll_BENCHMARK__.snapshot()`, `.report()`, `.reset()`

### Baseline Measurement Commands
```bash
# Browser benchmark (in DevTools Console):
window.__Mai Troll_BENCHMARK__.reset();
# ... run test scenario ...
window.__Mai Troll_BENCHMARK__.report();

# Load test:
node scripts/phase2-load-test.mjs
```

---

## Phase 1 – Polling Audit (33 setInterval calls)

### Category A: Replace with Realtime (High Impact)

| # | File | Line | Interval | Current Behavior | Recommended Replacement | Est. DB Savings |
|---|------|------|----------|-----------------|------------------------|-----------------|
| 1 | BroadcastPage.tsx | 2417 | 3000ms | Polls `streams` table for status, viewers, gifts, battle state, etc. | Already has `useStreamRealtime` at line 2638. This poll is **fully redundant** — realtime handler at line 2639 covers the same data. Remove entirely. | ~1200 req/hr per broadcast viewer |
| 2 | Notifications.tsx | 904 | 30000ms | Re-fetches all notifications from DB | Add realtime subscription on `notifications` table for user's notifications | ~120 req/hr per user |
| 3 | Header.tsx | 221 | 30000ms | Fetches unread notification count | Add realtime subscription on `notifications` table (INSERT/UPDATE with user_id filter) | ~120 req/hr per user |
| 4 | BottomNavigation.tsx | 471 | 30000ms | Fetches unread notification count | Already has realtime channel at line 420 for messages. Add notification realtime too. | ~120 req/hr per user |
| 5 | FollowersLiveRow.tsx | 90 | 30000ms | Fetches live streams from followed users | Add realtime subscription on `streams` table (status='live') | ~120 req/hr per user on home |
| 6 | LiveStreamsModule.tsx | 52 | 60000ms | React Query `refetchInterval: 60000` for live streams | Add realtime subscription on `streams` table; invalidate query on change | ~60 req/hr per user on home |
| 7 | SecretaryConsole.tsx | 129 | 30000ms | Fetches executive intake + critical alert counts | Add realtime subscriptions on both tables | ~120 req/hr per secretary |
| 8 | ChatBubble.tsx | 426 | 5000ms | Polls `read_at` timestamps for messages | Add realtime subscription on `conversation_messages` (UPDATE event) | ~720 req/hr per open chat |

**Subtotal: ~2,880+ DB requests/hour eliminated per active user**

### Category B: Reduce Frequency (Medium Impact)

| # | File | Line | Current | Recommended | Savings |
|---|------|------|---------|-------------|---------|
| 9 | BroadcastPage.tsx | 1065 | 1000ms seat tick | 2000ms (seat timeout is 8s, 1s tick is overkill) | 50% reduction |
| 10 | BroadcastPage.tsx | 2378 | 30000ms watch time | 60000ms (watch time doesn't need 30s precision) | 50% reduction |
| 11 | BroadcastPage.tsx | 2837 | 30000ms heartbeat | 60000ms (Supabase channels auto-heartbeat) | 50% reduction, or remove entirely |
| 12 | BroadcastPage.tsx | 4455 | 30000ms adjacent streams | 120000ms (stream list changes slowly) | 75% reduction |
| 13 | BroadcastGrid.tsx | 305 | 2000ms video play check | 5000ms (video doesn't stop that fast) | 60% reduction |
| 14 | BroadcastGrid.tsx | 604 | 1000ms persistent gifts | 5000ms (gifts don't change that fast) | 80% reduction |
| 15 | UserInventory.tsx | 372 | 10000ms expired items | 60000ms (expired items don't need 10s checks) | 83% reduction |
| 16 | GlobalPresenceTracker.tsx | 147 | 30000ms presence sync | 60000ms (presence doesn't need 30s precision) | 50% reduction |
| 17 | BattleView.tsx | 3530 | 15000ms/30000ms battle poll | 30000ms/60000ms (realtime handles active battle) | 50% reduction |
| 18 | useBattleRealtime.ts | 273 | 2000ms score poll | 5000ms (realtime broadcast handles most updates) | 60% reduction |

### Category C: Keep As-Is (Low Impact / Required)

| # | File | Line | Interval | Reason |
|---|------|------|----------|--------|
| 19 | BroadcastPage.tsx | 1845 | 30000ms | Auto-end stream check — business logic, not data sync |
| 20 | BattleView.tsx | 2550 | 500ms | Mobile track retry — short-lived, max 6 attempts |
| 21 | BattleView.tsx | 3853 | 1000ms | Battle timer countdown — UI timer, not DB poll |
| 22 | RTCAdminMonitor.tsx | 1213 | 1000ms | Local timer for UI display |

### Category D: Admin-Only (Low User Impact)

| # | File | Line | Interval | Note |
|---|------|------|----------|------|
| 23-33 | RTCAdminMonitor.tsx | various | 10-30s | 9 polling intervals — only affects admin users |

---

## Phase 2 – Realtime Architecture Audit

### Current State
- **28 realtime channel subscriptions** across the codebase
- All channels are properly cleaned up (removeChannel in useEffect return)
- Basic channel tracking exists in `src/lib/supabase.ts` (lines 27-82) — monkey-patches `channel()` and `removeChannel()` to count created/removed/active
- **No channel deduplication** — same channel name can be created by multiple components
- **No centralized registry** — channels are created ad-hoc in each component
- **No auto-reconnect logic** — if a channel disconnects, it stays disconnected
- **No connection monitoring** — no visibility into connection health

### Issues Found

1. **Duplicate channel names across components**: `stream:${streamId}` is used in both `useGiftSystem.ts` (line 43) and `BattleView.tsx` (line 3154) for different purposes
2. **No channel reuse**: `stream-presence:${streamId}` in BroadcastPage.tsx could be shared with other components viewing the same stream
3. **Short-lived channels without guaranteed cleanup**: `stream-seat-events:${streamId}` at BroadcastPage.tsx:4633 uses `setTimeout` for cleanup instead of `try/finally`
4. **No connection state tracking**: If Supabase connection drops, components don't know to resubscribe

### Recommended RealtimeManager API
```
RealtimeManager.subscribe(channelName, config) → subscription
RealtimeManager.unsubscribe(channelName)
RealtimeManager.getStats() → { created, removed, active, leaked }
RealtimeManager.getActiveChannels() → string[]
RealtimeManager.cleanup() → void (remove all)
```

---

## Phase 3 – Cleanup Guarantee Audit

### Current State: All 28 channels have cleanup code

### Issues Found

1. **BroadcastPage.tsx:4633** — `stream-seat-events` channel uses `setTimeout` for cleanup instead of `try/finally`. If the component unmounts before the timeout fires, the channel leaks.
2. **BattleView.tsx:3154** — `stream:${streamId}` broadcast channel uses `setTimeout` for cleanup (line 3173)
3. **BattleView.tsx:3439** — `battle_arena:${battleId}` broadcast channel uses `setTimeout` for cleanup (line 3448)
4. **BottomNavigation.tsx:450** — Channel cleanup uses `.then()` on a promise, which may not fire if the component unmounts before the promise resolves

### Recommended Pattern
```typescript
try {
  // use channel
} finally {
  await supabase.removeChannel(channel);
}
```

---

## Phase 4 – Background Job Audit

### Edge Functions with Issues

#### JSON Parsing Failures (No try/catch)
| File | Lines | Issue |
|------|-------|-------|
| paypal-payout/index.ts | 11, 89, 129 | `await req.json()` unguarded |
| verify-square-payment/index.ts | 25, 58, 75, 121, 141, 165, 206 | 7 unguarded `.json()` calls |
| verify-paypal-payment/index.ts | 79, 111, 122, 135, 146, 187, 195 | 7 unguarded `.json()` calls |
| payments/index.ts | 224, 264, 427 | 3 unguarded `.json()` calls |
| process-payout-batch/index.ts | 50, 104, 143 | 3 unguarded `.json()` calls |
| **40+ other functions** | various | All have unguarded `await req.json()` |

#### N+1 Query Patterns
| File | Lines | Issue |
|------|-------|-------|
| stock-gamification/index.ts | 75-83 | Fetches ALL portfolios into memory, calculates value in JS |
| stock-gamification/index.ts | 98-113 | Individual upserts in a loop (up to 100 users) |
| stock-gamification/index.ts | 55-69 | Individual updates per stock in crash system |
| credit-daily-maintenance/index.ts | 54-66 | Pagination fetches ALL credit_events into memory |
| ai-detect-ghost-inactivity/index.ts | 36-56 | Individual select+update per inactive officer |
| stream-health-monitor/index.ts | 326-353 | Fetches ALL streams, filters stale in JS |

#### Missing Validation
| File | Lines | Issue |
|------|-------|-------|
| stream-health-monitor/index.ts | 174 | Silently swallows JSON parse errors |
| payments/index.ts | 344-348 | Logs ALL env var names in production (info disclosure) |
| payments/index.ts | 304 | Logs full request headers including Authorization tokens |
| stock-gamification/index.ts | 159-161 | `setTimeout` for hype deactivation — unreliable in edge functions |
| verify-square-payment/index.ts | 203-219 | Race condition: read-then-write for coin balance (not atomic) |

---

## Phase 5 – Caching Audit

### Current State
- **@tanstack/react-query v5** is used with these defaults (main.tsx:533-550):
  - `staleTime: 30s` (should be 5 min per spec)
  - `gcTime: 30 min`
  - `refetchOnMount: false`
  - `refetchOnReconnect: true`
  - `refetchOnWindowFocus: false`
  - `retry: 1`

### Issues Found

1. **staleTime too low**: 30s means queries refetch every 30 seconds when components remount. Should be 5 minutes (300s) per spec.
2. **No cache invalidation strategy**: Realtime updates don't invalidate React Query cache — they update local state directly, meaning the cache can be stale.
3. **No optimistic updates**: Most mutations don't use optimistic updates, causing UI lag.
4. **Missing cache targets**: Profiles, league snapshots, user statistics, store inventory, gift catalog, notification counts, settings, and static platform metadata are not consistently cached.

### Recommended Configuration
```typescript
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 15 * 60 * 1000,    // 15 minutes
```

---

## Phase 6 – Database Performance

### Tables Requiring EXPLAIN ANALYZE
- `streams` — heavily queried by BroadcastPage polling (every 3s), live stream listings
- `profiles` (user_profiles) — queried by Header, Profile, presence tracking
- `families` — family activity tracking
- `auctions` — auction room queries
- `notifications` — polled by Header, BottomNavigation, Notifications page
- `messages` (conversation_messages) — polled by ChatBubble, BottomNavigation

### Known Issues
- No indexes verified for the polling query patterns
- RLS policies not audited for performance
- `streams` table is polled every 3 seconds by every broadcast viewer/viewer — this is the single highest DB load

---

## Phase 7 – LiveKit & Game Share

### Current State
- LiveKit rooms are created per-stream via `livekit-gaming` edge function
- Room lifecycle: start → goLive → heartbeat → endStream
- Webhook handler (`livekit-webhooks`) protects battle streams from premature ending
- No room leak detection exists

### Concerns
- No tracking of active rooms vs. expected rooms
- No participant leak detection
- Game Share (screen share) sessions are not tracked separately
- 30-minute stability not verified

---

## Phase 8 – Re-Benchmark Plan

### Before/After Metrics to Capture
1. Browser requests/minute (via PerformanceObserver)
2. DB requests/hour (via Supabase dashboard)
3. Active Supabase connections (via Supabase dashboard)
4. Realtime channels created/removed/active/leaked
5. Memory usage growth rate
6. CPU/RAM on server
7. Stream query calls per viewer per hour
8. League cron error count
9. 40-minute stream benchmark results
10. 30-minute Game Share benchmark results

---

## Implementation Priority

### P0 — Critical (Do First)
1. Remove BroadcastPage 3s stream poll (fully redundant with realtime) — saves ~1200 req/hr per viewer
2. Build RealtimeManager with channel registry + dedup + auto-cleanup
3. Increase React Query staleTime from 30s to 5 min
4. Replace notification polling with realtime (Header, BottomNavigation, Notifications page)

### P1 — High (Do Second)
5. Replace FollowersLiveRow and LiveStreamsModule polling with realtime
6. Reduce frequency of remaining non-replaceable intervals
7. Add try/finally cleanup to all short-lived channels
8. Fix edge function JSON parsing (add try/catch to all `await req.json()`)

### P2 — Medium (Do Third)
9. Fix N+1 queries in edge functions
10. Add optimistic updates to mutations
11. Add cache invalidation for realtime updates
12. Run EXPLAIN ANALYZE on key tables

### P3 — Low (Do When Possible)
13. Reduce admin polling frequency
14. Add LiveKit room/participant leak detection
15. Fix edge function security issues (env var logging, auth token logging)
