# Mai Troll Beta Audit Report

Generated from the current workspace after a non-destructive audit pass.

## Executive Summary

Mai Troll currently builds for production, but it is not yet clean enough for a confident full beta. The production Vite build passes, which means the app can ship a bundle. The TypeScript health check fails with many legacy type and integration errors across animations, broadcast battle/livekit code, notifications, TCNN, secretary/admin pages, and troll jobs.

Critical shell files were treated as protected surfaces during this pass:

- `src/App.tsx`
- `src/main.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/Header.tsx`
- `src/components/Sidebar.tsx`
- auth pages and providers
- homepage and landing routes

There is no active `src/components/Footer.tsx` in this codebase. The current app shell uses header, sidebar, bottom navigation, compliance prompt, purchase modal, global chat bubble, and route outlet content.

## Verification Run

- `npm run build`: passes.
- `npm run check:sounds`: passes for the current script coverage.
- `npm run check`: fails.

Build warnings that matter for beta:

- large chunks over the configured warning limit, especially admin, media, broadcast, and TeamMeetingRoom bundles
- circular chunk warning between `broadcast-components` and `admin-core`
- several modules are both statically and dynamically imported, which weakens lazy-loading benefits

## Fixes Applied In This Audit Pass

- Fixed malformed JSX in homepage preview layouts:
  - `src/components/home/previews/GlassBentoLayout.tsx`
  - `src/components/home/previews/ParallaxDepthLayout.tsx`
- Fixed TCPS fast-send regression left by the pending-message change:
  - removed stale `setSending(false)` call in `src/pages/tcps/components/MessageInput.tsx`
- Fixed animation helper export usage:
  - `src/components/animations/index.tsx` now imports `useAnimationStore` before using it
- Fixed broadcast chat staff moderation popup wiring:
  - `src/components/broadcast/BroadcastChat.tsx` now defines `openModActionsForUser`
- Added the new `tcps_message_sent` event to troll engine and weekly task event maps:
  - `src/troll/TrollProvider.tsx`
  - `src/lib/weeklyTasks.ts`

## Money Flow Audit

Payout request page:

- Frontend calculates available balance as `troll_coins - reserved_troll_coins`.
- Frontend calls `request_paypal_payout`.
- The new migration adds a database trigger to reserve payout coins at request time.

Remaining risk:

- The trigger currently reserves `requested_coins`, `coins_amount`, `coin_amount`, or `coins_used`. The active frontend RPC sends `p_coins` into `request_paypal_payout`, so the RPC itself must insert one of those columns for the trigger to catch it.
- Admin approval/rejection functions need a second pass to verify that rejected payouts release reserved coins and approved/paid payouts settle reserved coins.
- Platform finance overview must be tied to the same source of truth as payout reservation, not a separate frontend-only calculation.

Gifting:

- Stream gifting primarily uses `send_gift_in_stream` through `src/lib/hooks/useGiftSystem.ts`.
- Older gift helper `src/lib/gifts/sendGift.ts` uses `send_gift` and references `profile.coins`, while the main app uses `troll_coins`. This is likely stale or incompatible.
- Gift animations and gift sounds have multiple engines and overlays. This needs consolidation before beta.

## Broadcast And TCPS Audit

TCPS:

- Route is lazy-loaded at `/tcps`.
- Message send now allows rapid sends and replaces pending messages when saved messages return.
- Remaining TypeScript issue: `sendNotification(..., 'message', ...)` conflicts with the notification type union. It should likely be `new_private_message` or `tcps_mail_received`.

Broadcast:

- Production build includes broadcast pages.
- Broadcast chat now opens mod actions for staff from user names.
- TypeScript still reports many broadcast and battle errors, especially LiveKit API drift, missing gift modal state in `BattleView`, missing `SeatSession`, and old icon names.

OBS / streaming:

- OBS-specific runtime validation still needs browser/device testing. This pass did not validate camera/OBS capture behavior.

## Animation And Sound Audit

Current script:

- `npm run check:sounds` passes.

Additional direct scan finding:

- Newer entrance-effect config references many `/sounds/entrance/*.mp3` files that are not covered by the script and appear absent from `public/sounds/entrance`.
- Gift video mappings reference `/gift-videos/*.mp4` assets. These should be verified or replaced with graceful fallbacks before beta.

High-priority missing asset candidates to verify:

- `/sounds/entrance/soft_chime.mp3`
- `/sounds/entrance/dark_whoosh.mp3`
- `/sounds/entrance/heart_beat.mp3`
- `/sounds/entrance/bass_hit.mp3`
- `/sounds/entrance/fire_crackle.mp3`
- `/sounds/entrance/neon_hum.mp3`
- `/sounds/entrance/thunder_build.mp3`
- `/sounds/entrance/cash_register.mp3`
- `/sounds/entrance/dragon_roar.mp3`
- `/sounds/entrance/ceo_theme.mp3`
- `/sounds/entrance/void_hum.mp3`
- `/sounds/gifts/common.mp3`
- `/sounds/gifts/rare.mp3`
- `/sounds/gifts/epic.mp3`
- `/sounds/gifts/legendary.mp3`

## TypeScript Failure Categories

The full `npm run check` output is long. The main categories are:

- animation component typings with framer-motion and tsparticles
- broadcast battle/livekit API mismatch
- notification type union missing app-used event types
- TCNN article model mismatch between snake_case DB rows and camelCase TS types
- secretary/admin components missing imports or local state
- profile/user model missing fields used by new pages
- troll jobs pages using `job_title` and `department` fields not present on `UserProfile`
- remotion gift animation prop typing
- audio safety monitor missing browser speech recognition types

## Beta Blockers

1. Make `npm run check` pass or create a scoped beta check that all beta routes must satisfy.
2. Confirm payout lifecycle end to end: request, reserve, reject release, approve settle, paid status, finance dashboard update.
3. Consolidate gift send paths around one database RPC and one frontend hook.
4. Verify broadcast start, viewer join, guest seat, gifting, mod action, chat, and stream end flows in browser.
5. Replace or fallback missing entrance/gift media assets.
6. Fix notification type drift so user and staff notifications behave predictably.
7. Audit route coverage from `App.tsx` against sidebar/bottom navigation links.
8. Keep `NOT_USED.md` as an inventory only until each candidate is manually confirmed.

