# Mai Troll Pre-Launch Scaling Optimization Plan

## Goal

Prepare the frontend for approximately 2,500 concurrent users without changing product behavior.

## Non-Goals

- Do not remove features.
- Do not rewrite UI.
- Do not change database schema unless absolutely required.
- Do not alter user-facing behavior beyond reducing unnecessary realtime, polling, and database write frequency.

## Current Findings

- App is currently working.
- Supabase Realtime usage is low enough to optimize before launch.
- Database writes are the largest scaling risk.
- Current realtime design should move toward one main channel per page instead of many feature-specific channels.

## Target Realtime Channel Model

### User channel

Channel name:

```txt
user:{userId}
```

Responsibilities:

- presence
- route
- notifications
- wallet
- profile updates
- moderation / jail events

Expected per normal user:

- user channel
- current page channel

### Home page channel

Channel name:

```txt
home:global
```

Responsibilities:

- live streams
- viewer counts
- auctions
- wall / feed updates
- global events

### Stream page channel

Channel name:

```txt
stream:{streamId}
```

Responsibilities:

- chat
- gifts
- seats
- battles
- polls
- audience presence
- stream updates

### Court page channel

Channel name:

```txt
court:{courtId}
```

Responsibilities:

- court chat
- participants
- votes
- events

### Pod page channel

Channel name:

```txt
pod:{podId}
```

Responsibilities:

- pod members
- messages
- presence

## Expected Channel Counts

Normal user baseline:

- 1 user channel
- 1 current page channel
- Total: 2 channels

Home page target:

- 2-3 channels maximum

Broadcast page target:

- 2-3 channels maximum

Background tabs:

- minimal realtime activity
- minimal polling
- slower or paused heartbeat behavior

Launch target:

```txt
2,500 users × 2-3 channels = 5,000-7,500 realtime subscriptions
```

Avoid current risk:

```txt
2,500 users × 10-12 feature channels = 25,000-30,000 realtime subscriptions
```

## Phase 1: Inventory and Baseline

### Find realtime usage

Search for:

- `supabase.channel(`
- `supabase.removeChannel(`
- `channel.on(`
- `channel.subscribe(`
- `RealtimeManager`
- presence subscriptions
- broadcast subscriptions
- page-specific subscriptions

Deliverables:

- list every direct Supabase channel usage
- identify channels created inside components
- identify channels that can be replaced by page-level providers
- confirm every new channel uses `RealtimeManager`

### Find polling usage

Search for:

- `setInterval(`
- `setTimeout(`
- `refetchInterval`
- query polling
- stream stats polling
- battle score polling
- top gifters polling
- presence route polling

Deliverables:

- list every polling loop
- identify owner component or hook
- mark each loop as required, slowable, visibility-gated, or removable

### Find database write hotspots

Search for:

- `insert(`
- `update(`
- `upsert(`
- `stream_analytics_daily`
- `user_presence`
- `user_presence_routes`
- `city_ads`
- `app_bug_reports`

Deliverables:

- list high-frequency writes
- identify writes triggered by viewer events, route updates, ad views, bug reports, or repeated errors
- identify safe batching or deduplication points

## Phase 2: Realtime Manager Enforcement

### Rule

All new and migrated channels must use the existing `RealtimeManager`.

Components must not call:

```ts
supabase.channel()
```

directly.

### Implementation approach

1. Review existing `RealtimeManager`.
2. Add or confirm helper methods for:
   - user channel
   - home channel
   - stream channel
   - court channel
   - pod channel
3. Add shared providers/hooks for page-level subscriptions.
4. Replace direct component channel creation with provider-based subscriptions.
5. Preserve existing UI behavior and event payloads where possible.
6. Ensure old feature-specific channels are removed after page-level channels carry the same data.

### Validation

- Home page opens with no more than 2-3 active channels.
- Broadcast page opens with no more than 2-3 active channels.
- Navigating pages removes the previous page channel.
- No page creates duplicate channels on rerender.
- No component directly calls `supabase.channel(`.

## Phase 3: Database Write Reduction

### `stream_analytics_daily`

Current risk:

- Extremely high update volume.
- Viewer events are likely causing frequent database writes.

Target:

- Do not update the database on every viewer event.
- Keep live counters in memory and/or realtime.
- Batch persisted analytics every 1-5 minutes.

Implementation checklist:

- identify current viewer event write path
- move live counter updates to client memory and/or realtime broadcast
- add batching layer for persisted analytics
- flush on page visibility change, page unload, and interval
- avoid duplicate analytics rows or conflicting updates

### `user_presence`

Current risk:

- Fast heartbeat creates unnecessary writes.

Target:

Active tab:

- heartbeat every 60 seconds

Background tab:

- pause heartbeat when possible
- if pause is not safe, heartbeat every 5 minutes

Implementation checklist:

- add visibility-aware heartbeat control
- remove duplicate heartbeat loops
- keep presence state accurate without high-frequency writes

### `user_presence_routes`

Current risk:

- Same route is repeatedly rewritten.

Target:

- update database only when route actually changes.

Implementation checklist:

- store last written route
- skip writes when route equals previous route
- ensure initial route still writes
- ensure navigation changes still write

### `city_ads`

Current risk:

- Row updates on every ad view or click.

Target:

- batch impressions and clicks.

Implementation checklist:

- collect impressions/clicks in memory
- batch writes on interval and before unload
- avoid writing per individual view when possible

### `app_bug_reports`

Current risk:

- repeated errors may cause update loops.

Target:

- insert once per deduplicated error.
- stop repeated update loops.

Implementation checklist:

- create client-side dedup key from error type, message, route, and short time window
- insert once per dedup key
- avoid updating the same report repeatedly
- preserve visible error reporting behavior

## Phase 4: Polling Cleanup

### Add visibility guard

For polling loops that should not run in background tabs, add:

```ts
if (document.visibilityState !== 'visible') return;
```

### Required interval changes

Battle score:

```txt
2s -> 10s
```

Top gifters:

```txt
15s -> 60s
```

Stream stats:

```txt
2min -> 5min
```

### Implementation checklist

- list all `setInterval`, `setTimeout`, and `refetchInterval`
- classify each loop
- add visibility guards where safe
- slow required loops according to target
- remove duplicate loops
- ensure cleanup on unmount and route change

## Phase 5: Supabase Realtime Configuration

Update Supabase realtime config:

```txt
eventsPerSecond: 10
```

to:

```txt
eventsPerSecond: 50
```

Checklist:

- locate Supabase config file or environment setup
- update value
- verify config is used in local and production paths
- document any environment-specific override

## Phase 6: Monitoring and Admin Stats

Expose admin-visible stats:

- active channels
- created channels
- removed channels
- active polling loops
- current page subscriptions

### Channel warning thresholds

Green:

```txt
0-3 channels
```

Yellow:

```txt
4-6 channels
```

Red:

```txt
7+ channels
```

### Implementation checklist

- extend `RealtimeManager` counters
- extend polling loop registry
- add current page subscription tracking
- expose stats through existing admin/debug UI if available
- avoid exposing private user data

## Phase 7: Validation Plan

### Manual checks

- Open Home page and confirm 2-3 channels.
- Open Broadcast page and confirm 2-3 channels.
- Open Stream page and confirm expected stream channel.
- Open Court page and confirm expected court channel.
- Open Pod page and confirm expected pod channel.
- Navigate between pages and confirm old page channels are removed.
- Open app in background tab and confirm polling/heartbeat frequency drops.
- Confirm no UI features disappear.

### Performance checks

- monitor realtime subscription count
- monitor events per second
- monitor database write volume
- compare before/after writes for:
  - `stream_analytics_daily`
  - `user_presence`
  - `user_presence_routes`
  - `city_ads`
  - `app_bug_reports`

### Success criteria

- Home page: 2-3 channels.
- Broadcast page: 2-3 channels.
- Background tabs: minimal polling.
- No feature loss.
- Normal user: user channel plus current page channel.
- 2,500 concurrent users target roughly 5,000-7,500 realtime subscriptions instead of 25,000-30,000.

## Implementation Order

1. Inventory realtime channels, polling loops, and write hotspots.
2. Enforce `RealtimeManager` channel creation and page-level channels.
3. Reduce database write frequency and add batching/deduplication.
4. Slow and visibility-gate polling.
5. Update Supabase realtime config.
6. Add monitoring stats and warning thresholds.
7. Validate channel counts, polling behavior, and database write reduction.
