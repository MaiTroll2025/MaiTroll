# Supabase Resource Consumer Report

Generated: 2026-06-14
Scope: browser stream/idle behavior, Supabase clients, realtime channels, polling loops, admin refreshes, background analytics jobs, and league maintenance jobs.

## Executive Summary

### What is firing

| Area | Stream behavior | Idle behavior | Frequency / count | Main cause |
|---|---|---|---:|---|
| Supabase client creation | 1 browser client per tab from `src/lib/supabase.ts:7` | 1 browser client per tab | 1 client/module load | Singleton client module |
| Duplicate browser client | Not firing | Not firing | 0 | `src/components/originalChannel.tsx:7` is not imported anywhere |
| Realtime channels | Broadcast/Viewer pages create multiple stream channels while mounted | Home/nav/global pages can still create realtime channels while idle | See channel table below | Manual `supabase.channel()` calls; cleanup is mostly present |
| Polling loops | BroadcastPage has a 3s stream poll; ViewerPage has 30s refresh + 30s heartbeat + 60s watch-time recording | Home/live-grid/nav/admin pages can poll while idle | 3s = 1,200/hr, 15s = 240/hr, 30s = 120/hr, 60s = 60/hr | Redundant safety polling + dashboard refreshes |
| Background analytics jobs | Run regardless of active stream | Run regardless of active stream | See cron table | `pg_cron` schedules in migrations |
| League maintenance jobs | Run regardless of active stream | Run regardless of active stream | League ensure: 288/day; leaderboard refresh: 720/day | `pg_cron` schedules in league migration |

### Runtime verification

In dev browser console, the app already exposes realtime channel counters:

```ts
window.__Mai Troll_SUPABASE_REALTIME_DEBUG__
```

Compare before and after opening/closing a stream:

```ts
const before = window.__Mai Troll_SUPABASE_REALTIME_DEBUG__;
setTimeout(() => console.log({
  created: before.created,
  removed: before.removed,
  active: before.active,
  activeChannels: before.activeChannels,
}), 5000);
```

If `active` keeps increasing after unmount, a realtime channel is leaking on that page.

---

## 1. Components Creating Multiple Supabase Clients

### Browser client findings

| File | Line | Behavior | Firing during stream? | Firing during idle? | Count | Cause |
|---|---:|---|---|---|---:|---|
| `src/lib/supabase.ts` | 7 | Main browser Supabase singleton | Yes | Yes | 1 per tab/module load | Normal singleton |
| `src/components/originalChannel.tsx` | 7 | Duplicate browser `createClient` | No | No | 0 | File is not imported anywhere |
| `src/lib/economy.ts` | 6 | Browser admin client using service-role key | No | No | 0 | File is not imported by app code |
| `src/lib/getSupabase.tsx` | 28-30 | Per-request Deno edge client | Server/edge only | Server/edge only | Per request | Edge helper, not browser |

### Conclusion

There is currently no active duplicate browser Supabase client in the app. A live stream should have one browser Supabase client per tab from `src/lib/supabase.ts:7`. The duplicate client in `src/components/originalChannel.tsx:7` is dead code unless imported later.

---

## 2. Realtime Channels Not Unsubscribing on Unmount

### Existing debug wrapper

`src/lib/supabase.ts:31-78` wraps `channel`, `removeChannel`, and `removeAllChannels` and tracks:

- created channel count
- removed channel count
- active channel count
- active channel identifiers

This is exposed in dev as `window.__Mai Troll_SUPABASE_REALTIME_DEBUG__` at `src/lib/supabase.ts:109-124`.

### Stream pages

| Page / hook | File | Channel(s) | Cleanup present? | Notes |
|---|---|---|---|---|
| `BroadcastPage` host profile | `src/pages/broadcast/BroadcastPage.tsx:2371` | `host-updates:${stream.user_id}` | Yes | `removeChannel` in effect return at `BroadcastPage.tsx:2390` |
| `BroadcastPage` presence + stream broadcasts | `src/pages/broadcast/BroadcastPage.tsx:2656` | `stream-presence:${streamId}` | Yes | `removeChannel` at `BroadcastPage.tsx:2836` |
| `BroadcastPage` floating chat | `src/pages/broadcast/BroadcastPage.tsx:2849` | `floating-chat:${streamId}` | Yes | `removeChannel` at `BroadcastPage.tsx:2885` |
| `BroadcastPage` mute state | `src/pages/broadcast/BroadcastPage.tsx:3702` | `moderator-mute:${stream.id}:${user.id}` | Yes | `removeChannel` at `BroadcastPage.tsx:3756` |
| `BroadcastPage` troll usage | `src/pages/broadcast/BroadcastPage.tsx:3895` | `troll-usage:${streamId}:${user.id}` | Yes | `removeChannel` at `BroadcastPage.tsx:3919` |
| `BroadcastPage` seat event send | `src/pages/broadcast/BroadcastPage.tsx:4628` | `stream-seat-events:${streamId}` | Partial | Channel is removed only after successful send at `BroadcastPage.tsx:4642`; failed sends can leak |
| `ViewerPage` seat kick listener | `src/pages/broadcast/ViewerPage.tsx:953` | `stream-seat-events:${streamId}` | Yes | `removeChannel` at `ViewerPage.tsx:995` |
| `ViewerPage` floating chat | `src/pages/broadcast/ViewerPage.tsx:1969` | `floating-chat:${streamId}` | Yes | `removeChannel` at `ViewerPage.tsx:1987` |
| `ViewerPage` mute state | `src/pages/broadcast/ViewerPage.tsx:2026` | `viewer-mute:${streamId}:${user.id}` | Yes | `removeChannel` at `ViewerPage.tsx:2064` |

### Other realtime consumers

| Page / hook | File | Channel(s) | Cleanup |
|---|---|---|---|
| `LiveContentContext` | `src/contexts/LiveContentContext.tsx:169`, `:191`, `:197` | `home:live-streams`, `home:live-auctions`, `home:visibility-scores` | Yes |
| `FeaturedBroadcasts` | `src/components/broadcast/FeaturedBroadcasts.tsx:60` | `featured_streams` | Yes |
| `BottomNavigation` | `src/components/BottomNavigation.tsx:409`, `:478` | nav unread/message channels | Yes |
| `useStreamSeats` | `src/hooks/useStreamSeats.ts:307`, `:644`, `:735` | seat channels | Mostly yes; send-only channel is removed after send |
| `useChatBlockStatus` | `src/hooks/useChatBlockStatus.ts:132` | chat block status | Yes |
| `useCoins` | `src/hooks/useCoins.ts:302`, `:318` | coin balance/profile balance | Yes |
| `useNavBadges` | `src/hooks/useNavBadges.ts:346`, `:371` | nav notifications/chats | Yes |
| `useGiftSystem` | `src/hooks/useGiftSystem.ts:40`, `:43`, `:409` | stream gifts/stream/battle | Yes |
| `useBattleRealtime` | `src/hooks/useBattleRealtime.ts:76`, `:328` | battle channels | Yes |
| `useTipBanner` | `src/hooks/useTipBanner.ts:72` | stream gifts | Yes |
| `useAuctionTimer` | `src/hooks/useAuctionTimer.ts:81` | auction timer | Yes |
| `useLeagueProgress` | `src/hooks/useLeagueProgress.ts:351` | `league-progress-${userId}-${streamId || 'global'}` | Yes |
| `useLeagueSnapshot` | `src/hooks/useLeagueSnapshot.ts:208` | `league-system-${streamId || 'global'}` | Yes |
| `Profile` | `src/pages/Profile.tsx:529`, `:586` | profile channels | Yes |
| `UtromailPage` | `src/pages/utromail/UtromailPage.tsx:226`, `:251` | utromail channels | Yes |
| `HytroGaming` | `src/pages/gaming/HytroGaming.tsx:477` | gaming streams | Yes |
| `ExploreFeed` | `src/pages/ExploreFeed.tsx:200` | explore streams | Yes |

### Realtime leak risk

Most major stream channels have cleanup. The highest-risk realtime leak is:

| Risk | File | Cause |
|---|---|---|
| Seat-event send channel | `src/pages/broadcast/BroadcastPage.tsx:4628` | `removeChannel(channel)` is only called after successful send. If `channel.send()` throws or rejects before `void supabase.removeChannel(channel)`, that temporary channel can remain active. |
| Legacy/uncertain components | `src/components/oldRow.tsx:1026`, `src/components/relevantChange.tsx:1085` | Duplicate `home:live-streams` pattern; cleanup should be audited if these files are still mounted. |
| Manual channel pattern | Many files | Cleanup depends on each component returning `supabase.removeChannel(channel)`. There is no centralized realtime subscription manager. |

---

## 3. Polling Loops

### Stream page polling

| Page | File | Poll | Frequency | Fires during stream? | Fires during idle? | Cleanup |
|---|---|---|---:|---|---|---|
| `BroadcastPage` stream state poll | `src/pages/broadcast/BroadcastPage.tsx:2398` | `streams` row select | Every 3s | Yes | No, unless stream page remains mounted | Clears on unmount and when stream status becomes `ended` at `BroadcastPage.tsx:2503` |
| `BroadcastPage` watch-time event | `src/pages/broadcast/BroadcastPage.tsx:2359` | emits `stream_watch_time` | Every 30s | Yes | No, unless stream page remains mounted | Clears on unmount |
| `BroadcastPage` stream-presence heartbeat | `src/pages/broadcast/BroadcastPage.tsx:2826` | sends ping on channel | Every 30s | Yes | No, unless stream page remains mounted | Clears on unmount |
| `BroadcastPage` adjacent stream check | `src/pages/broadcast/BroadcastPage.tsx:4450` | checks adjacent streams | Every 30s | Yes | No, unless stream page remains mounted | Needs audit if not returned near call site |
| `ViewerPage` stream refresh | `src/pages/broadcast/ViewerPage.tsx:1862` | refreshes stream row | Every 30s | Yes | No, unless viewer page remains mounted | Yes |
| `ViewerPage` watch-time recording | `src/pages/broadcast/ViewerPage.tsx:1759` | records watch time | Every 60s | Yes, only when live and viewer is not host | No | Yes |
| `ViewerPage` audience heartbeat | `src/pages/broadcast/ViewerPage.tsx:2074` | audience heartbeat | Every 30s | Yes | No, unless viewer page remains mounted | Yes |

### Idle/global page polling

| Page / component | File | Poll | Frequency |
|---|---|---|---:|
| `LiveContentContext` streams | `src/contexts/LiveContentContext.tsx:166` | live content | Every 60s |
| `LiveContentContext` auctions | `src/contexts/LiveContentContext.tsx:167` | live auctions | Every 30s |
| `HomeLiveGrid` | `src/components/home/HomeLiveGrid.tsx:146` | live streams | Every 15s |
| `BroadcastNeonHeader` | `src/components/broadcast/BroadcastNeonHeader.tsx:123` | header refresh | Every 15s |
| `TrollWallFeed` | `src/components/home/TrollWallFeed.tsx:138` | live gaming streams | Every 30s |
| `BottomNavigation` | `src/components/BottomNavigation.tsx:459` | notification count | Every 30s |
| `Header` | `src/components/Header.tsx:216` | notifications | Every 30s |
| `GlobalPresenceTracker` | `src/components/GlobalPresenceTracker.tsx:119` | presence sync | Every 30s |
| `PWAContext` health | `src/contexts/PWAContext.tsx:390` | connection health | Every 5s |

### Polling frequency reference

| Interval | Fires per minute | Fires per hour |
|---:|---:|---:|
| 3s | 20 | 1,200 |
| 5s | 12 | 720 |
| 10s | 6 | 360 |
| 15s | 4 | 240 |
| 30s | 2 | 120 |
| 60s | 1 | 60 |
| 5 min | 0.2 | 12 |

### Polling cause

The main redundant stream polling is `BroadcastPage` polling the full `streams` row every 3 seconds while realtime is already subscribed. This is a safety net, but it duplicates the realtime stream update path. ViewerPage also polls every 30 seconds alongside realtime.

---

## 4. Admin Dashboards With Frequent Refreshes

### Admin refreshes found

| Page / hook | File | Refresh target | Frequency | Notes |
|---|---|---|---:|---|
| `AdminDashboard` | `src/pages/admin/AdminDashboard.tsx:902` | task counts | Every 5 min | Money-table 30s refresh was removed |
| `useAdminDashboardMetrics` | `src/hooks/useAdminDashboardMetrics.ts:219` | dashboard metrics | Every 5 min | Reduced from 60s |
| `EconomyDashboard` | `src/pages/admin/EconomyDashboard.tsx:160` | economy data | Every 5 min | Reduced from 60s |
| `CityControlCenter` | `src/pages/admin/CityControlCenter.tsx:309` | all system data | Every 30s |
| `MobileAdminDashboard` | `src/pages/admin/MobileAdminDashboard.tsx:237`, `:567`, `:687`, `:772`, `:869` | multiple admin stats | Every 60s or more |
| `ReportsPanel` | `src/pages/admin/components/ReportsPanel.tsx:73`, `:76`, `:79` | reports/chat logs/bans | 30s / 15s / 60s |
| `StreamMonitor` | `src/pages/admin/components/StreamMonitor.tsx:36` | stream monitor data | Every 30s |
| `CashoutRequestsList` | `src/pages/admin/components/shared/CashoutRequestsList.tsx:59` | cashout requests | Every 30s |
| `LivePurchasableInventory` | `src/pages/admin/components/LivePurchasableInventory.tsx:121` | purchasable inventory | Every 60s |
| `AdminLiveOfficersTracker` | `src/pages/admin/AdminLiveOfficersTracker.tsx:69` | officer assignments | Every 30s |
| `AdminFinanceDashboard` | `src/pages/admin/AdminFinanceDashboard.tsx:42` | finance summary | Every 60s |

### Admin refresh cause

Admin dashboards intentionally refresh frequently. The most aggressive admin refreshers are the 15s/30s panels in `ReportsPanel`, `StreamMonitor`, and `CityControlCenter`. The main `AdminDashboard` and metrics hook are lighter at 5 minutes.

---

## 5. Background Analytics Jobs

### Stream analytics and visibility jobs

| Job / function | File | Schedule | Fires per hour | Fires per day | Stream/idle behavior | Cause |
|---|---|---|---:|---:|---|---|
| `aggregate-stream-analytics-5min` | `supabase/migrations/20280430000010_stream_analytics_rtc_monitor.sql:268` | `*/5 * * * *` | 12 | 288 | Runs regardless of active stream | Aggregates last 30 days of `stream_analytics_events` into `stream_analytics_daily` |
| `trg_track_stream_gift_analytics` | `supabase/migrations/20280430000010_stream_analytics_rtc_monitor.sql:296` | Per `stream_gifts` insert | Per gift | Per gift | Stream only | Trigger logs gift analytics event |
| `trg_track_stream_lifecycle_analytics` | `supabase/migrations/20280430000010_stream_analytics_rtc_monitor.sql:330` | Per `streams` lifecycle change | Per start/end | Per start/end | Stream only | Trigger logs stream start/end analytics |
| `logStreamAnalyticsEvent` browser RPC | `src/lib/streamAnalytics.ts:21`, `src/hooks/useViewerTracking.ts:123`, `:149` | Viewer join/leave | Per viewer join/leave | Per viewer join/leave | Stream/idle depending on mounted stream | Deduped client-side every 30s per stream/user/event |
| `cleanup_old_engagement_snapshots` | `supabase/migrations/20290619000000_visibility_engine_v2.sql:201`, `:2108` | Comment says hourly | 24 if scheduled | 24 if scheduled | Runs regardless of active stream | Comment only; migration does not show an actual `cron.schedule` for it |
| `recalculate_all_visibility` | `supabase/migrations/20290619000000_visibility_engine_v2.sql:1548`, `:2109` | Comment says every 1-5 min | 12-60 if scheduled | 288-1,440 if scheduled | Runs regardless of active stream | Comment only; migration does not show an actual `cron.schedule` for it |
| `reset_momentum_velocity_windows` | `supabase/migrations/20290619000000_visibility_engine_v2.sql:2068`, `:2110` | Comment says every 2 min | 30 if scheduled | 720 if scheduled | Runs regardless of active stream | Comment only; migration does not show an actual `cron.schedule` for it |

### All `pg_cron` schedules found

| Job | File | Schedule | Fires per hour | Fires per day | Notes |
|---|---|---|---:|---:|---|
| `process-offline-push-notifications-every-minute` | `supabase/migrations/20260515000001_cron_process_offline_notifications.sql:16` | `* * * * *` | 60 | 1,440 | Calls offline notifications edge function every minute |
| `process_expired_moderation` | `supabase/migrations/20260212000001_moderation_expiry_logic.sql:71` | `*/10 * * * *` | 6 | 144 | Processes expired moderation actions |
| `process_gifts` | `supabase/migrations/20260203000001_schedule_gift_batch.sql:21` | `*/1 * * * *` | 60 | 1,440 | Processes gift ledger batch once per minute |
| `aggregate-stream-analytics-5min` | `supabase/migrations/20280430000010_stream_analytics_rtc_monitor.sql:268` | `*/5 * * * *` | 12 | 288 | Stream analytics aggregation |
| `troll_city_ensure_league` | `supabase/migrations/20290516000000_league_system_expansion.sql:928` | `*/5 * * * *` | 12 | 288 | League maintenance |
| `troll_city_refresh_leaderboard` | `supabase/migrations/20290516000000_league_system_expansion.sql:929` | `*/2 * * * *` | 30 | 720 | League leaderboard refresh |
| `cashout-window-reminder` | `supabase/migrations/20260409000002_cashout_notifications_cron.sql:6` | `50 13 * * 5` | Weekly | Weekly | Friday cashout reminder |
| `cashout-escrow-reminder-thursday` | `supabase/migrations/20260409000002_cashout_notifications_cron.sql:29` | `0 10 * * 4` | Weekly | Weekly | Thursday cashout escrow reminder |
| `cashout-window-open` | `supabase/migrations/20260409000002_cashout_notifications_cron.sql:52` | `0 14 * * 5` | Weekly | Weekly | Friday cashout open notification |
| `credit-card-daily-accrual` | `supabase/migrations/20270601000000_realistic_credit_card_overhaul.sql:973` | `0 0 * * *` | Daily | Daily | Credit-card daily interest |
| `credit-card-limit-adjustment` | `supabase/migrations/20270601000000_realistic_credit_card_overhaul.sql:980` | `0 1 1 * *` | Monthly | Monthly | Credit-card limit adjustment |
| `cleanup_expired_purchases` | `supabase/migrations/20270121000001_inventory_expiry.sql:47` | `0 * * * *` | 24 | 24 | Expired purchase cleanup |
| `zip_crime_decay` | `supabase/migrations/20270330010000_zip_governance_system.sql:562` | `10 7 * * *` | Daily | Daily | Zip crime score decay |
| `officer_promotion_eval` | `supabase/migrations/20270330010000_zip_governance_system.sql:572` | `20 7 * * *` | Daily | Daily | Officer promotion evaluation |
| `trollmers_weekly_payout` | `supabase/migrations/20270330000000_trollmers_weekly_leaderboard.sql:389` | `5 7 * * 1` | Weekly | Weekly | Trollmers weekly payout |
| `trollmers_monthly_tournament_start` | `supabase/migrations/20270330000000_trollmers_weekly_leaderboard.sql:1182` | `5 7 1 * *` | Monthly | Monthly | Monthly tournament start |
| `credit-small-purchase-milestone` | `supabase/migrations/20270521000000_small_installment_purchases.sql:101` | `0 3 * * *` | Daily | Daily | Calls edge function daily |
| `delete_expired_troll_wall_system_posts` | `supabase/migrations/20270526010000_add_troll_wall_system_posts.sql:44` | `0 0 * * *` | Daily | Daily | Deletes expired system-generated Troll Wall posts |

### Featured broadcast ranking note

`supabase/migrations/20270809000000_create_featured_broadcast_system.sql:317` has a comment about hourly rankings, but no actual `cron.schedule` in that migration.

---

## 6. League Maintenance Jobs

### League maintenance found

| Job / function | File | Schedule | Fires per hour | Fires per day | Cause |
|---|---|---|---:|---:|---|
| `ensure_league_system_ready` | `supabase/migrations/20290516000000_league_system_expansion.sql:834`, `:928` | `*/5 * * * *` | 12 | 288 | Closes expired league events, finds/creates active event, refreshes leaderboard |
| `refresh_active_league_leaderboard` | `supabase/migrations/20290516000000_league_system_expansion.sql:891`, `:929` | `*/2 * * * *` | 30 | 720 | Refreshes active league leaderboard |
| `update_league_on_gift` | `supabase/migrations/20290531000000_broadcast_league_system.sql:75` | Per gift RPC | Per gift | Per gift | Updates broadcaster league stats when gifts are received |
| `update_league_on_stream_end` | `supabase/migrations/20290531000000_broadcast_league_system.sql:115` | Per stream end | Per stream end | Per stream end | Updates broadcaster live-minute league stats |
| `useLeagueProgress` | `src/hooks/useLeagueProgress.ts:351` | Realtime on mount | Per mount/change | Per mount/change | Subscribes to `broadcast_league_stats` and `weekly_league_goals` |
| `useLeagueSnapshot` | `src/hooks/useLeagueSnapshot.ts:208` | Realtime on mount | Per mount/change | Per mount/change | Subscribes to league event/leaderboard/mission/user_stats changes |
| `useLeagueMissions` | `src/hooks/useLeagueMissions.ts:39` | On mount | Per mount | Per mount | Calls `ensure_league_system_ready` if no event id is provided |

### League cause

The two scheduled league jobs are independent of active streams and idle state. They run every 5 minutes and every 2 minutes if `pg_cron` is enabled. League progress can also fire on any page that mounts `useLeagueProgress` or `useLeagueSnapshot`.

---

## 7. Supabase Realtime Publication Tables

These migrations add tables to `supabase_realtime`. This is the replication source for browser realtime channels.

| File | Tables added to `supabase_realtime` |
|---|---|
| `supabase/migrations/20260227000000_enable_tcps_realtime.sql:4` | `conversation_messages`, `conversations`, `conversation_members`, `auction_shows`, `auction_lots`, `auction_bids`, `auction_presence` |
| `supabase/migrations/20260226000001_create_global_gift_system.sql:32` | `gift_transactions` |
| `supabase/migrations/20260220000001_live_commerce_system.sql:546` | `broadcast_pinned_products`, `shop_orders`, `wallet_escrow` |
| `supabase/migrations/20260221000000_appeals_system.sql:534` | `transaction_appeals`, `appeal_actions` |
| `supabase/migrations/20260304000000_audio_safety_and_location_system.sql:623` | `safety_alerts` |
| `supabase/migrations/20260317000000_family_communication_hub.sql:186` | `family_chat_messages`, `family_calls`, `family_call_members` |
| `supabase/migrations/20260404000000_marketplace_order_enhancements.sql:719` | `order_shipments`, `tracking_events`, `marketplace_payout_holds` |
| `supabase/migrations/20270125190000_sync_deeds_and_properties.sql:54` | `deeds`, `properties`, `deed_transfers` |
| `supabase/migrations/20270125200000_public_pool_and_deeds.sql:135` | `pool_donations` |
| `supabase/migrations/20270125200100_fix_public_pool_function.sql:150` | `pool_donations` |
| `supabase/migrations/20270125203000_fix_admin_pool_access.sql:25` | `admin_pool` |
| `supabase/migrations/20270131000005_sidebar_updates.sql:48` | `sidebar_updates` |
| `supabase/migrations/20270203000000_seller_tiers_reviews_appeals.sql:587` | `marketplace_reviews` |
| `supabase/migrations/20270215100000_add_pod_moderation.sql:107` | `pod_bans`, `pod_chat_bans` |
| `supabase/migrations/20270304000000_battle_crown_streak_system.sql:388` | `battle_events` |
| `supabase/migrations/20270805000000_create_bug_alerts.sql:129` | `bug_alerts` |
| `supabase/migrations/20260612000000_auction_interactive_features.sql:778` | `auction_predictions`, `auction_prediction_rewards` |
| `supabase/migrations/20260612000001_fix_realtime_and_place_bid.sql:25` | `auction_watchlist`, `auction_prediction_settings` |
| `supabase/migrations/20290612000000_enable_utromail_realtime.sql:4` | `utromail_messages`, `utromail_notifications`, `utromail_threads` |

### Realtime replication cause

Realtime replication load is driven by the number of published tables and the number of active browser channels. The largest browser realtime consumers are stream pages, live home pages, nav badges, league progress, gift/battle hooks, and admin monitoring panels.

---

## 8. Highest-Impact Findings

1. `BroadcastPage` 3s polling is the heaviest browser stream poll: 1,200 requests/hour while the page is mounted.
2. League maintenance jobs are high-frequency and run regardless of stream/idle state: 1,008 scheduled league executions/day.
3. Stream analytics aggregation runs every 5 minutes: 288 executions/day.
4. `process_gifts` and offline notification cron jobs run every minute: 1,440 executions/day each.
5. Most realtime channels have cleanup, but temporary seat-event channels can leak on failed send paths.
6. No active duplicate browser Supabase client was found; the duplicate `originalChannel.tsx` is dead code.
