# Scalability Refactor — Implementation Plan

## P0 — Critical (Biggest Impact)

### P0-1: Remove BroadcastPage 3s stream poll
**File:** `src/pages/broadcast/BroadcastPage.tsx` lines 2414-2539
**Change:** Delete the entire `useEffect` that polls `streams` every 3s. It's fully redundant — `useStreamRealtime` at line 2638 already handles all the same fields via `handleStreamRealtimeUpdate`.
**Impact:** Saves ~1,200 DB requests/hour per broadcast viewer. With 1,000 viewers = 1.2M req/hr eliminated.

### P0-2: Remove ViewerPage 30s stream poll
**File:** `src/pages/broadcast/ViewerPage.tsx` lines 1870-1874
**Change:** Delete the `setInterval` calling `refreshStream()` every 30s. The `useStreamRealtime` at line 1882 already handles stream status, battle state, and ended-stream navigation via `onStream`/`onGift`/`onParticipant`. The `refreshStream` function (lines 1588-1660) does the same SELECT that realtime already covers.
**Impact:** Saves ~120 DB requests/hour per viewer.

### P0-3: Increase React Query staleTime from 30s → 5 min
**File:** `src/main.tsx` lines 533-550
**Change:** `staleTime: 30 * 1000` → `staleTime: 5 * 60 * 1000`
**Impact:** Reduces HTTP requests to Supabase by ~90% for cached queries. Components remounting (tab switches, navigation) won't refetch if data is <5 min old.

### P0-4: Replace notification polling with realtime (3 files)

**File 1:** `src/components/Header.tsx` lines 219-226
- Delete the `setInterval(fetchNotifications, 30000)` 
- Add a realtime subscription on `notifications` table (INSERT + UPDATE, filter: `user_id=eq.${user.id}`)
- On change, re-fetch the unread count

**File 2:** `src/components/BottomNavigation.tsx` lines 459-474
- Delete the `setInterval(fetchNotificationCount, 30000)`
- Add a realtime subscription on `notifications` table (same pattern as Header)
- On change, re-fetch the unread count

**File 3:** `src/pages/Notifications.tsx` lines 901-909
- Delete the `setInterval(loadNotifications, 30000)`
- Add a realtime subscription on `notifications` + `jail_notifications` tables
- On change, re-fetch the full notification list

**Impact:** Saves ~360 DB requests/hour per user across all 3 components.

### P0-5: Replace FollowersLiveRow polling with realtime
**File:** `src/components/home/FollowersLiveRow.tsx` lines 88-92
**Change:** Delete the `setInterval(fetchFollowersLive, 30000)`. Add a realtime subscription on `streams` table (filter: `status=eq.live`). On INSERT/UPDATE, re-fetch the followers-live query.
**Impact:** Saves ~120 DB requests/hour per user on home page.

### P0-6: Replace LiveStreamsModule polling with realtime
**File:** `src/components/home/LiveStreamsModule.tsx` line 52
**Change:** Remove `refetchInterval: 60000` from the `useLiveStreams` call. Add a realtime subscription on `streams` table (filter: `status=eq.live`). On change, call `queryClient.invalidateQueries({ queryKey: queryKeys.liveStreams })`.
**Impact:** Saves ~60 DB requests/hour per user on home page.

---

## P1 — High (Do After P0)

### P1-1: Build centralized RealtimeManager
**New file:** `src/lib/realtime/RealtimeManager.ts`
**Purpose:** Single registry for all Supabase realtime channels with:
- Channel deduplication (same name → same channel)
- Reference counting (N subscribers, cleanup when count=0)
- Auto-reconnect on connection drop
- Debug stats: `{ created, removed, active, leaked }`
- `cleanup()` method for app-wide teardown

**Migrate these channels to RealtimeManager:**
1. `stream-presence:${streamId}` — BroadcastPage.tsx:2667
2. `floating-chat:${streamId}` — BroadcastPage.tsx:2860
3. `moderator-mute:${streamId}:${userId}` — BroadcastPage.tsx:3711
4. `troll-usage:${streamId}:${userId}` — BroadcastPage.tsx:3904
5. `host-updates:${userId}` — BroadcastPage.tsx:2391
6. `app-arrests:${userId}` — App.tsx:988
7. `bug-alerts-realtime` — useBugAlertStore
8. `nav-unread-count:${userId}` — BottomNavigation.tsx:421
9. `mobile-message-bubble:${userId}` — BottomNavigation.tsx:489
10. `tcps:${conversationId}` — ChatBubble.tsx:290
11. `profile-updates-${profileId}` — Profile.tsx:547
12. `profile-live-${profileId}` — Profile.tsx:604
13. `trollifieds_${activeTab}` — Trollifieds.tsx:491
14. `payout_requests_${profileId}` — CashoutRequestPage.tsx:231
15. `wallet_payout_requests_${userId}` — Wallet.tsx:137
16. `state-leaderboard-realtime` — stateBattleService.ts:124
17. `state-battles-${stateCode}` — stateBattleService.ts:136
18. `tromail-inbox:${userId}` — RTCAdminMonitor.tsx:1005
19. `shareathon_events_changes` — ShareAThonContext.tsx:235
20. `shareathon_control_changes` — ShareAThonControl.tsx:43

### P1-2: Reduce polling frequency for non-replaceable intervals

| File | Line | Current | New | Change |
|------|------|---------|-----|--------|
| BroadcastPage.tsx | 1065 | 1000ms seat tick | 2000ms | 50% reduction |
| BroadcastPage.tsx | 2378 | 30s watch time | 60s | 50% reduction |
| BroadcastPage.tsx | 2837 | 30s heartbeat | 60s | 50% reduction (or remove — Supabase auto-heartbeats) |
| BroadcastPage.tsx | 4455 | 30s adjacent streams | 120s | 75% reduction |
| BroadcastGrid.tsx | 305 | 2s video check | 5s | 60% reduction |
| BroadcastGrid.tsx | 604 | 1s persistent gifts | 5s | 80% reduction |
| UserInventory.tsx | 372 | 10s expired items | 60s | 83% reduction |
| GlobalPresenceTracker.tsx | 147 | 30s presence sync | 60s | 50% reduction |
| BattleView.tsx | 3530 | 15s/30s battle poll | 30s/60s | 50% reduction |
| useBattleRealtime.ts | 273 | 2s score poll | 5s | 60% reduction |

### P1-3: Guaranteed cleanup for short-lived channels

**Files to fix:**
1. `BroadcastPage.tsx:4633` — `stream-seat-events` channel: replace `setTimeout` cleanup with `try/finally`
2. `BattleView.tsx:3154` — `stream:${streamId}` broadcast: replace `setTimeout` cleanup with `try/finally`
3. `BattleView.tsx:3439` — `battle_arena:${battleId}` broadcast: replace `setTimeout` cleanup with `try/finally`
4. `BottomNavigation.tsx:450` — Channel cleanup via `.then()`: move to synchronous cleanup in useEffect return

### P1-4: Fix edge function JSON parsing
**Files:** 40+ edge functions with unguarded `await req.json()`
**Pattern:** Wrap every `await req.json()` in try/catch:
```typescript
let body: any = {}
try {
  body = await req.json()
} catch {
  return new Response('Invalid JSON', { status: 400 })
}
```
**Priority files** (highest traffic):
- `supabase/functions/payments/index.ts`
- `supabase/functions/paypal-payout/index.ts`
- `supabase/functions/verify-square-payment/index.ts`
- `supabase/functions/verify-paypal-payment/index.ts`
- `supabase/functions/process-payout-batch/index.ts`

---

## P2 — Medium (Do After P1)

### P2-1: Fix N+1 queries in edge functions
- `stock-gamification/index.ts` lines 55-113: Replace individual updates with bulk operations
- `credit-daily-maintenance/index.ts` lines 54-66: Replace client-side pagination with server-side RPC
- `ai-detect-ghost-inactivity/index.ts` lines 36-56: Replace individual select+update with bulk update
- `stream-health-monitor/index.ts` lines 326-353: Move stale filter to DB query

### P2-2: Add optimistic updates to mutations
**Files:** Key mutation hooks that would benefit:
- `useGiftSystem.ts` — gift sending
- `useOptimizedChat.ts` — message sending
- `useStreamSeats.ts` — seat actions

### P2-3: Add cache invalidation for realtime updates
**Pattern:** When realtime events arrive, invalidate the relevant React Query cache instead of (or in addition to) updating local state directly.
**Files:** All components using both `useStreamRealtime` and `useQuery`:
- `BroadcastPage.tsx`
- `ViewerPage.tsx`
- `LiveStreamsModule.tsx`
- `FollowersLiveRow.tsx`

### P2-4: Fix edge function security issues
- `payments/index.ts` lines 344-348: Remove env var logging in production
- `payments/index.ts` line 304: Remove Authorization header logging
- `stock-gamification/index.ts` lines 159-161: Replace `setTimeout` hype deactivation with cron job
- `verify-square-payment/index.ts` lines 203-219: Use atomic increment for coin balance

---

## P3 — Low Priority

### P3-1: Reduce admin polling frequency
**File:** `src/components/admin/RTCAdminMonitor.tsx`
- 9 polling intervals at 10-30s → increase to 30-60s
- Only affects admin users, low overall impact

### P3-2: Enable Supabase connection pooler
**File:** `supabase/config.toml` line 37
- Change `enabled = false` to `enabled = true`
- This alone could 3-5x connection capacity
- Requires Supabase Pro plan

### P3-3: Add LiveKit room/participant leak detection
**New file:** `src/lib/liveKitMonitor.ts`
- Track active rooms and participants
- Expose `window.__Mai Troll_LIVEKIT__.getStats()` for debugging
- Alert on room/participant count growth after stream ends

---

## Execution Order

1. **P0-1** — Remove BroadcastPage 3s poll (single biggest win)
2. **P0-2** — Remove ViewerPage 30s poll
3. **P0-3** — Increase React Query staleTime
4. **P0-4** — Replace notification polling (3 files)
5. **P0-5** — Replace FollowersLiveRow polling
6. **P0-6** — Replace LiveStreamsModule polling
7. **P1-1** — Build RealtimeManager + migrate channels
8. **P1-2** — Reduce remaining polling frequency
9. **P1-3** — Fix short-lived channel cleanup
10. **P1-4** — Fix edge function JSON parsing
11. **P2-1** — Fix N+1 queries in edge functions
12. **P2-2** — Add optimistic updates
13. **P2-3** — Add cache invalidation for realtime
14. **P2-4** — Fix edge function security
15. **P3-1** — Reduce admin polling
16. **P3-2** — Enable connection pooler
17. **P3-3** — Add LiveKit monitoring

---

## Expected Impact

| Metric | Before | After P0 | After All |
|--------|--------|----------|-----------|
| DB req/hr per broadcast viewer | ~1,500 | ~180 | ~120 |
| DB req/hr per idle user | ~300 | ~60 | ~30 |
| Realtime channels per user | 3-8 | 3-5 | 2-4 |
| React Query refetches | Every 30s | Every 5 min | Every 5 min |
| Edge function crash risk | High (unguarded JSON) | Low | Low |
| Est. concurrent user capacity | ~300-500 | ~800-1,200 | ~1,500-2,500 |
