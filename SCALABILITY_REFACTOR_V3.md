# Mai Troll Scalability Refactor v3 — Realtime & Architecture Focused

**Date:** 2026-06-14
**Status:** Planning
**Focus:** Architecture efficiency, not database optimization

---

## Benchmark Summary

Database health is good across the board. No major DB bottlenecks found.

| Area | Status | Notes |
|---|---|---|
| Database performance | ✅ Healthy | No optimization needed |
| RLS performance | ✅ Healthy | No optimization needed |
| League functions | ✅ Healthy | Fast execution, focus on reliability |
| Stream analytics | ✅ Healthy | No optimization needed |
| Gift processing | ✅ Healthy | 56ms avg, monitor growth |
| Realtime architecture | 🔴 Bottleneck | WAL parsing at 247 calls — too many published tables |
| Polling frequency | 🔴 Bottleneck | 3s/15s/30s/60s loops across many pages |
| Channel management | 🔴 Bottleneck | No centralized manager, leak risk |
| Channel cleanup | 🔴 Risk | Missing try/finally on temporary channels |
| Browser requests | 🔴 Bottleneck | No caching, redundant fetches |
| Caching | 🔴 Missing | No TanStack Query, no cache invalidation |

---

## Priority 0.5 — Realtime Publication Audit

**Target:** Reduce WAL parsing overhead, reduce realtime bandwidth

### Current State

The #1 query by call count in `pg_stat_statements` is Supabase Realtime's internal WAL (Write-Ahead Log) parser:

```
SELECT wal->>'type', wal->>'schema', wal->>'table' ...
```

**247 calls at 16ms avg = 3,970ms total.** This is the single busiest workload on the database.

This query runs for **every table in `supabase_realtime` publication**. Each published table generates WAL entries that must be parsed, filtered, and broadcast to connected clients.

### Audit Steps

1. **Count published tables:**
   ```sql
   SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. **List all published tables:**
   ```sql
   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
   ```

3. **Classify each table:**

   | Classification | Action | Examples |
   |---|---|---|
   **Active realtime** | Keep in publication | `streams`, `user_profiles`, `notifications` |
   **Occasional realtime** | Evaluate — can polling replace? | `auction_shows`, `shop_orders` |
   **No realtime needed** | Remove from publication | `coin_transactions`, `stream_seats`, `gift_transactions` |
   **Write-only** | Remove — no browser reads | `stream_analytics_events`, `audit_logs` |

### Tables Likely Safe to Remove

From the resource consumer report, these tables are in `supabase_realtime` but may not need active browser subscriptions:

| Table | Published | Likely Need | Action |
|---|---|---|---|
| `coin_transactions` | Yes | No — updated via RPC responses | **Remove** |
| `stream_seats` | Yes | Maybe — use seat-specific channel | **Evaluate** |
| `gift_transactions` | Yes | No — updated via RPC responses | **Remove** |
| `stream_analytics_events` | Yes | No — write-only, aggregated by cron | **Remove** |
| `stream_gifts` | Yes | Maybe — gift animations are realtime | **Keep** |
| `battle_events` | Yes | Yes — battle UI needs realtime | **Keep** |
| `safety_alerts` | Yes | Yes — safety notifications | **Keep** |
| `bug_alerts` | Yes | Maybe — admin-only, low frequency | **Evaluate** |
| `order_shipments` | Yes | Maybe — user-facing but low frequency | **Evaluate** |
| `tracking_events` | Yes | Maybe — polling may suffice | **Evaluate** |
| `marketplace_reviews` | Yes | No — read on demand | **Remove** |
| `pod_bans` | Yes | Maybe — admin-only | **Evaluate** |
| `family_chat_messages` | Yes | Yes — chat is realtime | **Keep** |
| `family_calls` | Yes | Yes — call status is realtime | **Keep** |
| `utromail_messages` | Yes | Yes — mail is realtime | **Keep** |
| `utromail_notifications` | Yes | Yes — notifications are realtime | **Keep** |
| `deed_transfers` | Yes | No — low frequency, read on demand | **Remove** |
| `pool_donations` | Yes | No — low frequency | **Remove** |
| `sidebar_updates` | Yes | Evaluate — may be replaced by realtime channel | **Evaluate** |
| `admin_pool` | Yes | No — admin-only, use admin channel | **Remove** |

### Removal Migration Template

```sql
-- Remove table from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.coin_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.gift_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.stream_analytics_events;
ALTER PUBLICATION supabase_realtime DROP TABLE public.marketplace_reviews;
ALTER PUBLICATION supabase_realtime DROP TABLE public.deed_transfers;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pool_donations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_pool;
```

### Expected Impact

| Metric | Before | After (est.) |
|---|---|---|
| WAL parsing calls | 247 | ~80-100 |
| WAL parsing time | 3,970ms | ~1,300-1,600ms |
| Realtime bandwidth | High | ↓ 50-60% |
| Active channels | Many | Fewer |

### Verification

After removing tables, re-run the benchmark:
```sql
SELECT calls, total_exec_time, LEFT(query, 150)
FROM pg_stat_statements
WHERE query ILIKE '%wal->>%'
ORDER BY calls DESC;
```

Target: WAL query calls reduced by 50%+.

---

## Priority 1 — Eliminate Polling

**Target:** ↓ 80%+ stream query calls, ↓ 50%+ browser requests/min

### Polling Audit

| Page/Component | File | Interval | Frequency/hr | Replace With |
|---|---|---|---|---|
| BroadcastPage stream poll | `BroadcastPage.tsx:2398` | 3s | 1,200/hr | Realtime subscription |
| BroadcastPage watch-time | `BroadcastPage.tsx:2359` | 30s | 120/hr | Keep (necessary) |
| BroadcastPage heartbeat | `BroadcastPage.tsx:2826` | 30s | 120/hr | Keep (presence) |
| BroadcastPage adjacent check | `BroadcastPage.tsx:4450` | 30s | 120/hr | Realtime subscription |
| ViewerPage stream refresh | `ViewerPage.tsx:1862` | 30s | 120/hr | Realtime subscription |
| ViewerPage watch-time | `ViewerPage.tsx:1759` | 60s | 60/hr | Keep (necessary) |
| ViewerPage heartbeat | `ViewerPage.tsx:2074` | 30s | 120/hr | Keep (presence) |
| HomeLiveGrid | `HomeLiveGrid.tsx:146` | 15s | 240/hr | Realtime subscription |
| LiveContentContext streams | `LiveContentContext.tsx:166` | 60s | 60/hr | Realtime subscription |
| LiveContentContext auctions | `LiveContentContext.tsx:167` | 30s | 120/hr | Realtime subscription |
| BroadcastNeonHeader | `BroadcastNeonHeader.tsx:123` | 15s | 240/hr | Realtime subscription |
| TrollWallFeed | `TrollWallFeed.tsx:138` | 30s | 120/hr | Realtime subscription |
| BottomNavigation | `BottomNavigation.tsx:459` | 30s | 120/hr | Realtime subscription |
| Header notifications | `Header.tsx:216` | 30s | 120/hr | Realtime subscription |
| GlobalPresenceTracker | `GlobalPresenceTracker.tsx:119` | 30s | 120/hr | Keep (presence) |
| PWAContext health | `PWAContext.tsx:390` | 5s | 720/hr | Keep (connection health) |
| CityControlCenter | `CityControlCenter.tsx:309` | 30s | 120/hr | Realtime subscription |
| ReportsPanel | `ReportsPanel.tsx:73-79` | 15-60s | 120-240/hr | Realtime subscription |
| StreamMonitor | `StreamMonitor.tsx:36` | 30s | 120/hr | Realtime subscription |
| AdminDashboard | `AdminDashboard.tsx:902` | 5 min | 12/hr | Keep (acceptable) |
| EconomyDashboard | `EconomyDashboard.tsx:160` | 5 min | 12/hr | Keep (acceptable) |

### Implementation Order

1. **BroadcastPage 3s poll** → Replace with realtime `streams` channel (biggest impact: 1,200 req/hr eliminated)
2. **ViewerPage 30s refresh** → Replace with realtime `streams` channel
3. **HomeLiveGrid 15s poll** → Replace with realtime `streams` channel
4. **LiveContentContext 30s/60s polls** → Replace with realtime channels
5. **BroadcastNeonHeader 15s poll** → Replace with realtime channel
6. **TrollWallFeed 30s poll** → Replace with realtime channel
7. **BottomNavigation 30s poll** → Replace with realtime channel
8. **Header 30s poll** → Replace with realtime channel
9. **Admin panels 15-30s polls** → Replace with realtime channels

### Replacement Pattern

**Before (polling):**
```ts
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await supabase.from('streams').select('*').eq('id', streamId);
    setStream(data);
  }, 3000);
  return () => clearInterval(interval);
}, [streamId]);
```

**After (realtime):**
```ts
useEffect(() => {
  const channel = RealtimeManager.subscribe(`stream:${streamId}`, {
    table: 'streams',
    filter: `id=eq.${streamId}`,
    onUpdate: (payload) => setStream(payload.new),
  });
  return () => RealtimeManager.unsubscribe(channel);
}, [streamId]);
```

---

## Priority 2 — Build RealtimeManager

**Target:** 0 leaked channels, centralized management

### Architecture

```
src/lib/RealtimeManager.ts
├── Channel Registry (Map<topic, ChannelEntry>)
├── Subscribe (dedup, create, track)
├── Unsubscribe (remove, cleanup)
├── Health Monitor (connection state, reconnect)
└── Leak Detection (created - removed - active)
```

### ChannelEntry Interface

```ts
interface ChannelEntry {
  channel: RealtimeChannel;
  topic: string;
  subscribers: Set<string>;  // component IDs
  createdAt: number;
  lastActivity: number;
  isTemporary: boolean;
}
```

### API

```ts
class RealtimeManager {
  static subscribe(config: SubscribeConfig): ChannelHandle;
  static unsubscribe(handle: ChannelHandle): void;
  static getStats(): RealtimeStats;
  static getActiveChannels(): ChannelInfo[];
  static cleanup(): void;  // remove all channels
}

interface RealtimeStats {
  created: number;
  removed: number;
  active: number;
  leaked: number;  // created - removed - active
}

interface ChannelInfo {
  topic: string;
  subscribers: number;
  age: number;
  isTemporary: boolean;
}
```

### Leak Detection

```ts
// Exposed in dev console
window.__Mai Troll_REALTIME_STATS__ = RealtimeManager.getStats();

// Auto-warn on leak
if (stats.leaked > 0) {
  console.warn(`⚠️ ${stats.leaked} leaked realtime channels detected`);
}
```

### Migration Plan

1. Create `src/lib/RealtimeManager.ts`
2. Replace all `supabase.channel()` calls (40+ files)
3. Replace all `supabase.removeChannel()` calls
4. Add `RealtimeManager.getStats()` to debug panel
5. Add leak warning to `usePerformanceBenchmark`

---

## Priority 3 — Channel Cleanup Enforcement

**Target:** No orphaned channels, no leaks

### Pattern

Every temporary channel must use try/finally:

```ts
const channel = supabase.channel(`temp:${id}`);
try {
  await channel.subscribe();
  // ... work ...
} finally {
  await supabase.removeChannel(channel);
}
```

### Files to Audit

From the resource consumer report, these use temporary channels:

| File | Channel | Risk |
|---|---|---|
| `BroadcastPage.tsx:4628` | `stream-seat-events:${streamId}` | **HIGH** — only removed after successful send |
| `useStreamSeats.ts:307` | seat channels | MEDIUM — send-only, removed after send |
| `useStreamSeats.ts:644` | seat channels | MEDIUM |
| `useStreamSeats.ts:735` | seat channels | MEDIUM |

### ESLint Rule

Add custom ESLint rule to enforce try/finally on `supabase.channel()`:

```js
// eslint-rules/realtime-cleanup.js
module.exports = {
  meta: { type: 'problem' },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.property?.name === 'channel') {
          // Check if wrapped in try/finally
          const hasFinally = node.parent?.parent?.parent?.type === 'TryStatement'
            && node.parent?.parent?.parent?.finalizer;
          if (!hasFinally) {
            context.report({
              node,
              message: 'supabase.channel() must be wrapped in try/finally with removeChannel',
            });
          }
        }
      },
    };
  },
};
```

---

## Priority 4 — Centralized Caching

**Target:** Lower DB requests, lower browser requests, faster page loads

### Install

```bash
npm install @tanstack/react-query
```

### Configuration

```ts
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      cacheTime: 15 * 60 * 1000,   // 15 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});
```

### Cache Invalidation Strategy

| Data Type | Cache Key | Stale Time | Invalidation Trigger |
|---|---|---|---|
| User profiles | `['profile', userId]` | 5 min | Profile update event |
| Notifications | `['notifications', userId]` | 2 min | New notification realtime |
| League data | `['league', seasonId]` | 5 min | League update realtime |
| User stats | `['stats', userId]` | 5 min | Stats update realtime |
| Store inventory | `['store', category]` | 15 min | Purchase/refresh |
| Gift catalog | `['gifts']` | 30 min | Admin update |
| Platform settings | `['settings']` | 60 min | Admin update |

### Pages to Migrate

1. **Profile pages** — `useQuery(['profile', id])` instead of direct fetch
2. **Notifications** — `useQuery(['notifications', userId])` + realtime invalidation
3. **League standings** — `useQuery(['league', seasonId])` + realtime invalidation
4. **Store/Shop** — `useQuery(['store', category])` with 15-min cache
5. **Gift catalog** — `useQuery(['gifts'])` with 30-min cache
6. **Admin dashboards** — `useQuery(['admin', metric])` with 5-min cache

### Realtime + Cache Integration

```ts
// When realtime event arrives, invalidate cache
RealtimeManager.subscribe('notifications', {
  onUpdate: () => {
    queryClient.invalidateQueries(['notifications']);
  },
});
```

---

## Priority 5 — League Stability

**Target:** League errors = 0

### Current State

League functions are fast. Focus on reliability, not performance.

### Tasks

1. **Add input validation** to `ensure_league_system_ready()`
2. **Add JSON parsing guards** — wrap all `wal->>` operations in `COALESCE`
3. **Add error logging** — log context on failure for debugging
4. **Add retry logic** — transient failures should retry before marking failed
5. **Add alerting** — notify admin on repeated failures

### Validation Pattern

```sql
-- Before (can throw on malformed JSON)
SELECT wal->>'type' FROM ...

-- After (safe)
SELECT COALESCE(wal->>'type', 'unknown') FROM ...
```

---

## Priority 6 — Gift Processing Monitoring

**Target:** Monitor growth, verify scalability

### Current State

`process_gift_ledger_batch()` — 56ms avg, acceptable.

### Tasks

1. **Add benchmark tracking** — log execution time per run
2. **Add volume alerts** — warn if batch size exceeds threshold
3. **Add growth tracking** — monitor calls/day trend
4. **Document scaling plan** — what to do when 56ms becomes 500ms

### Watch Thresholds

| Metric | Current | Warning | Critical |
|---|---|---|---|
| Avg execution time | 56ms | 200ms | 500ms |
| Daily runs | 1,440 | 5,000 | 10,000 |
| Batch size | ~50 gifts | 200 gifts | 500 gifts |

---

## Priority 7 — LiveKit & Game Share Scalability

**Target:** No room leaks, no participant leaks, stable resources

### Audit Checklist

- [ ] Rooms are properly disconnected on stream end
- [ ] Participants are removed on disconnect
- [ ] Screen share tracks are cleaned up
- [ ] Game Share sessions clean up on host disconnect
- [ ] Realtime events are unsubscribed on unmount

### Benchmark Protocol

1. Start 1 broadcaster + 1 Game Share
2. Run for 30 minutes
3. Record: rooms, participants, tracks, bitrate, memory, CPU
4. Verify: no resource growth after stream ends

---

## Final Success Criteria

| # | Criteria | Target | Measurement |
|---|---|---|---|
| 0 | WAL parsing calls | ↓ 50%+ | `pg_stat_statements` — `wal->>` query |
| 1 | Stream query calls | ↓ 80%+ | `pg_stat_statements` |
| 2 | Browser requests/minute | ↓ 50%+ | DevTools Network |
| 3 | Realtime channel leaks | 0 | `RealtimeManager.getStats()` |
| 4 | Channels return to baseline | Yes | `window.__Mai Troll_SUPABASE_REALTIME_DEBUG__` |
| 5 | Connection counts | ↓ | `pg_stat_activity` |
| 6 | League JSON errors | 0 | `cron.job_run_details` |
| 7 | 40-min stream resources | ≤ baseline | Supabase dashboard |
| 8 | 30-min Game Share | Stable | LiveKit dashboard |
| 9 | No regressions | Pass | All existing tests |

**Benchmark results determine success. No partial credit.**

---

## Implementation Order

| Phase | Priority | Effort | Impact |
|---|---|---|---|
| 0.5 | Realtime Publication Audit | Low | **Highest** — WAL parsing is the #1 workload |
| 1 | Eliminate 3s polling (BroadcastPage) | Medium | **Highest** — 1,200 req/hr |
| 2 | Build RealtimeManager | High | **High** — prevents all leaks |
| 3 | Channel cleanup enforcement | Medium | **High** — eliminates leak risk |
| 4 | Add TanStack Query caching | High | **High** — cuts all redundant fetches |
| 5 | Eliminate remaining polling | Medium | **Medium** — compounds with #1 |
| 6 | League reliability fixes | Low | **Medium** — prevents errors |
| 7 | Gift monitoring | Low | **Low** — future-proofing |
| 8 | LiveKit audit | Medium | **Medium** — Game Share readiness |

**Start with Phase 0.5.** The WAL parsing query at 247 calls is the single busiest workload on the database. Removing unnecessary tables from `supabase_realtime` publication is a low-effort, high-impact change that should be done before anything else. Run Section 7A to get the current publication table count, then audit which ones can be removed.
