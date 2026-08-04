# Mai Troll Hot-Path And Launch Fixes

Date: 2026-04-30

This file summarizes the changes made in the latest launch-readiness pass, including mobile/layout fixes, cashout/court enforcement, realtime hot-path reductions, and TCPS fixes.

## Backend Migrations

- `supabase/migrations/20280430000011_new_user_cashout_promo_enforcement.sql`
  - Enforces the new-user first cashout promo.
  - Applies only to users created on or after 2026-05-01 21:00 UTC.
  - Adds the 0%cashout fee to Visa redemptions.
  - Revokes anonymous function execution for cashout RPCs.

- `supabase/migrations/20280430000012_court_dockets_auth_hard_delete_and_extend.sql`
  - Makes Court Dockets authenticated-only.
  - Adds hard-delete RPC support for court cases/dockets.
  - Adds safer court-date extension handling.
  - Grants access to authenticated users and staff roles where appropriate.

- `supabase/migrations/20280430000013_paypal_payout_coin_fee.sql`
  - Adds the 0%coin fee to PayPal payout handling.
  - Keeps payout/cashout logic server-side.
  - Revokes anonymous execution.

- `supabase/migrations/20280430000014_hot_path_realtime_and_side_effects.sql`
  - Adds/normalizes `global_events` columns used by the unified ticker.
  - Enables RLS on `global_events`.
  - Allows authenticated users to insert lightweight city events.
  - Allows public read access for ticker display.
  - Adds an index on `(priority DESC, created_at DESC)`.

## Realtime And Hot-Path Performance

- Added `src/lib/realtime/streamRealtimeManager.ts`
  - Central stream realtime manager scaffold.
  - Tracks one `stream-realtime:{streamId}` channel per stream.
  - Supports stream, message, gift, participant, and battle events.
  - Adds dev-only debug state via `window.__Mai Troll_STREAM_REALTIME__`.

- Added `src/hooks/useStreamRealtime.ts`
  - React hook wrapper around the stream realtime manager.
  - Routes table events to specific handlers.

- Added `src/lib/events/queueSideEffects.ts`
  - Queues non-critical writes without blocking user actions.
  - Uses `requestIdleCallback` when available.
  - Logs side-effect failures only in development.

- Added `src/lib/events/createCityActivityEvent.ts`
  - Helper for writing unified ticker events into `global_events`.

- Updated `src/hooks/useGlobalActivity.ts`
  - Removed direct ticker subscriptions to hot tables.
  - Now fetches latest 20 `global_events` on mount.
  - Subscribes only to INSERT events on `global_events`.
  - Dedupes by id and caps client memory at 50 events.

- Updated `src/components/header/GlobalTicker.tsx`
  - Manual ticker posts now write to `global_events`.
  - Removed old ticker broadcast/table fan-out behavior.

- Updated `src/hooks/useAdminFinanceRealtime.ts`
  - Removed broad realtime listeners on finance/cashout/profile tables.
  - Uses polling/invalidation instead.

- Updated `src/pages/Notifications.tsx`
  - Removed realtime notification and jail-notification listeners.
  - Uses 30-second polling.

- Updated `src/pages/Trollifications.tsx`
  - Removed page-level realtime notification listener.
  - Keeps periodic polling.
  - Preserves latest-notification voice announcement behavior from polling data.

- Updated `src/components/Header.tsx`
  - Removed header notification realtime listener.
  - Uses 30-second polling for unread notification count.
  - Keeps the mobile profile avatar/button behavior.

- Updated `src/components/BottomNavigation.tsx`
  - Removed bottom-nav notification realtime listener.
  - Uses 30-second polling for unread count.
  - Fixed `useBroadcastLockdown` property usage.
  - Keeps Court Dockets visible for authenticated users.

- Updated `src/components/header/TestNotificationBanner.tsx`
  - Removed notification realtime listener.
  - Polls for newest notification every 30 seconds.

- Updated `src/components/broadcast/BroadcastChat.tsx`
  - Disabled the backup `stream_messages` database realtime fallback.
  - Chat still uses optimistic UI and stream broadcast delivery.

- Updated `src/pages/broadcast/BroadcastPage.tsx`
  - Disabled the backup `stream_gifts` database realtime fallback.
  - Gift animation broadcast path remains.

- Updated `src/pages/broadcast/ViewerPage.tsx`
  - Disabled the backup `stream_gifts` database realtime fallback.
  - Gift animation broadcast path remains.

- Updated `src/hooks/useGiftSystem.ts`
  - Keeps the critical gift RPC path intact.
  - Queues notification, global ticker event, XP, profile refresh, and mission progress side effects.
  - Prevents non-critical side-effect failures from failing a successful gift transaction.

- Updated `src/hooks/useUserPresence.ts`
  - Throttles unchanged presence heartbeats to at least 30 seconds.

- Updated `src/pages/admin/components/AdminInterviewDashboard.tsx`
  - Removed realtime subscriptions on `notifications` and `applications`.
  - Uses 60-second polling.

- Updated `src/lib/events.ts`
  - Added `tcps_message_sent` to allowed event types.

## TCPS Fixes

- Updated `src/pages/tcps/components/ChatWindow.tsx`
  - Restored audio call button in the main TCPS chat header.
  - Restored video call button in the main TCPS chat header.
  - Reuses existing call flow:
    - creates a `call_rooms` row,
    - inserts a `call` notification,
    - navigates to `/call/:roomId/:type/:userId`.
  - Loads available audio/video minutes from `call_minutes`.

- Updated `src/pages/tcps/components/InboxSidebar.tsx`
  - Fixes conversations showing as `Unknown`.
  - Uses `display_name`, `username`, or a safe user-id fallback.
  - Fetches missing profile info when the optimized conversation RPC returns incomplete names.
  - Fixes `UserNameWithAge` prop usage.

## Mobile, Layout, Court, And Cashout Fixes From Prior Pass

- `src/components/admin/RTCAdminMonitor.tsx`
  - Improved mobile layout and analytics panel scrolling.

- `src/components/Header.tsx`
  - Replaced the mobile top-right grey bubble/menu with a clickable profile avatar/icon.

- `src/components/RequireRole.tsx`
  - Empty role lists now mean any authenticated profile can access that route.

- `src/pages/admin/adminRoutes.tsx`
  - Court Dockets route opened to authenticated users.

- `src/components/BottomNavigation.tsx`
  - Court Dockets visible for authenticated users.

- `src/components/Sidebar.tsx`
  - Court Dockets visible for authenticated users.

- `src/pages/admin/CourtDocketsManager.tsx`
  - Staff-only add/extend/delete controls.
  - Hard-delete support through RPC.
  - Filters deleted records.
  - Uses exact local date extension handling.

- `src/pages/TrollCourt.tsx`
  - Deletes cases through hard-delete RPC.
  - Uses local date formatting for court dates.

- `src/components/CourtDocketDashboard.tsx`
  - Deletes docket entries through hard-delete RPC.

- `src/pages/PayoutRequest.tsx`
  - Shows and enforces 0%payout fee in the frontend.

## Intentionally Left As Separate Feature Tracks

These were not faked into partial UI during this pass:

- Full government/election simulation.
- Jail, inmate, attorney, and interview Agora flows.
- ID verification workflow UI and admin/secretary review console.
- Marketplace seller fulfillment flow.
- Rent due blocking and tenant/landlord notification system.
- Leaderboard rebuild.
- Face-tracked premium gift animation engine.

## Verification

- Ran `npm run check`.
- Full repo check still fails due to existing broad TypeScript errors outside this pass.
- Ran a filtered TypeScript check against the files touched in this pass.
- The filtered pass showed no new TypeScript errors from the hot-path/TCPS changes.

## Realtime Notes

- TCPS incoming call notifications intentionally remain realtime because call invites need immediate delivery.
- Broad notification pages, header badges, admin finance, and admin interview feeds were moved off realtime.
- The global ticker should now subscribe only to `global_events`.

## Additional Workflow Fixes Added After This Summary

- `supabase/migrations/20280430000015_rent_marketplace_and_notification_workflows.sql`
  - Enforces rent due dates in `pay_rent`.
  - Adds `pay_house_rent` so legacy house rent no longer mutates balances directly from the frontend.
  - Adds `queue_rent_due_notifications()` for tenant and landlord rent reminders.
  - Hardens `fulfill_marketplace_order` so only the seller can fulfill their own order.
  - Sends buyer notification when a marketplace order ships.
  - Adds indexes for lease/rental due checks, notification polling, and marketplace order lookups.

- `src/pages/LivingPage.tsx`
  - Blocks tenant Pay Rent buttons until rent is due.
  - Shows the next due date in disabled Pay Rent buttons.
  - Uses the new `pay_house_rent` RPC for legacy house rentals.

- `src/pages/Notifications.tsx`
  - Adds notification routing for followed-user live streams, inmate/arrest notifications, buyer order updates, and seller fulfillment alerts.

- `src/pages/MyOrders.tsx`
  - Supports deep-linking to a specific order with `?order=...`.

- `src/pages/SellerOrders.tsx`
  - Supports deep-linking to a specific order with `?order=...`.
  - Uses the secure `fulfill_marketplace_order` RPC instead of direct row updates.

- `src/pages/PayoutRequest.tsx`
  - Friday payout requests now require approved ID verification in the frontend.
  - Blocks users after 3 rejected cashout verification attempts for the current week.

- `src/pages/admin/AdminVerificationReview.tsx`
  - Allows secretary role access in addition to admins.
  - Uses polling instead of realtime.
  - Adds review guidance for Friday cashout ID checks.

- `supabase/migrations/20280430000011_new_user_cashout_promo_enforcement.sql`
  - Adds Friday ID verification enforcement to Visa redemption RPC.

- `supabase/migrations/20280430000013_paypal_payout_coin_fee.sql`
  - Adds Friday ID verification enforcement to PayPal payout RPC.

- `supabase/migrations/20280430000016_rolling_gift_leaderboard.sql`
  - Adds a read-only rolling gift leaderboard RPC.
  - Supports 30-minute, hour, day, week, and month windows.
  - Supports sent-gift and received-gift rankings.
  - Adds indexes for rolling gift reads.

- `src/pages/Leaderboard.tsx`
  - Rebuilds the leaderboard UI around live gift transaction windows instead of stale all-time broadcaster totals.
  - Uses responsive controls and mobile-safe list rows.

## Still Pending Large Tracks

- Full government/election/law/protest/voting simulation.
- Candidate election stream category and 5-minute candidate battle flow.
- Agora-only interview room conversion.
- Inmate public message/bond/Agora visit flows beyond existing inmate page basics.
- Incarcerated-user small call popup with mute/camera/hang-up controls.
- Attorney per-case chat with inmates, no-fee attorney messaging, drop-case flow, background-check popup, and court history expansion.
- My Family broadcast coin-goal auto-progress and unique daily goal regeneration.
- TCNN staff/admin LiveKit plus viewer Mux validation.
- Creator switch perks audit.
- Friday payday push notification to eligible users.
- Troll Court LiveKit publisher/Mux viewer split, court ticker, and popup.
- Full face-tracked premium gift animation engine.
