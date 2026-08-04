# Mai Troll Full-Stack Frontend & Database Audit Report

**Date:** 2026-07-10  
**Scope:** Broadcast, Viewer, Gifting, Random Battle, BattleView, Treelz  
**Platforms:** Web + Mobile  
**Constraint:** Read-only audit — no code changes applied.

---

## 1. EXECUTIVE SUMMARY

| Category | HIGH | MEDIUM | LOW | INFO |
|----------|------|--------|-----|------|
| Frontend Bugs | 14 | 19 | 15 | 4 |
| Supabase RLS / FK | 4 | 9 | 7 | 3 |
| Edge Function Auth | 4 | 0 | 0 | 0 |
| **TOTAL** | **22** | **28** | **22** | **7** |

**Top risks:**
1. `BroadcastChat.tsx` has a build-breaking duplicate `MAX_MESSAGES` declaration and an out-of-scope `parseGiftMessage` reference that crashes chat rendering.
2. `PaidChatViewerModal.tsx` calls Postgres `jsonb_build_object()` as if it were JavaScript — every paid-chat send throws `ReferenceError` before the RPC runs.
3. `GamingGiftPanel.tsx` passes `sendGift` arguments positionally instead of as an options object, so gifts silently route to the wrong recipient.
4. Four Supabase Edge Functions (`agora-stream`, `agora-token`, `agora-walkie-token`, `store-user-geolocation`) accept unauthenticated requests with service-role keys, allowing any caller to start streams, mint tokens, or forge location data.
5. `streams.broadcaster_id` has no foreign-key constraint, and `battles.challenger_stream_id` / `opponent_stream_id` / `streams.battle_id` lack `ON DELETE` actions — orphaned records are guaranteed on cascade deletes.

---

## 2. FRONTEND BUGS — BUILD BREAKING / CRITICAL RUNTIME

### 2.1 BroadcastChat.tsx — Duplicate MAX_MESSAGES (Build Blocker)
- **File:** `src/components/broadcast/BroadcastChat.tsx`
- **Lines:** 351 & 510
- **Severity:** HIGH
- **Issue:** `const MAX_MESSAGES = 500` is declared twice in the same component scope, then `= 200` on the second declaration. This is an illegal redeclaration (SyntaxError / TS2451). The history cap logic is also contradictory (one slice uses 500, realtime uses 200).

### 2.2 BroadcastChat.tsx — parseGiftMessage Out of Scope
- **File:** `src/components/broadcast/BroadcastChat.tsx`
- **Lines:** 196, 495
- **Severity:** HIGH
- **Issue:** `parseGiftMessage` is declared inside `BroadcastChat` (line 495) but called from `ChatMessageItem` (line 196), which is a module-level component. When a gift message without `gift_type` renders, this throws `ReferenceError: parseGiftMessage is not defined`, crashing the chat row.

### 2.3 PaidChatViewerModal.tsx — jsonb_build_object Called as JS
- **File:** `src/components/broadcast/PaidChatViewerModal.tsx`
- **Lines:** 97, 128
- **Severity:** HIGH
- **Issue:** `jsonb_build_object(...)` is invoked as a JavaScript function. That is a Postgres function, not JS — this throws `ReferenceError: jsonb_build_object is not defined`, so **every paid-chat send fails** before the RPC even runs. Replace with a plain JS object literal `{ stream_id: streamId, type: 'per_user' }`.

### 2.4 useGiftSystem.ts — Rules-of-Hooks Violation
- **File:** `src/lib/hooks/useGiftSystem.ts`
- **Lines:** 91–100
- **Severity:** HIGH
- **Issue:** `GiftSystemProvider` does an early `return` when `!streamId` (line 91–94) **before** calling `useAuthStore()`, `useState`, `useRef`, `useCallback`, `useMemo`. If `streamId` ever transitions `null` ↔ value, React throws "Rendered more/fewer hooks than during the previous render," crashing the whole broadcast subtree.

### 2.5 GamingGiftPanel.tsx — Wrong sendGift Call Signature
- **File:** `src/components/broadcast/GamingGiftPanel.tsx`
- **Line:** 44
- **Severity:** HIGH
- **Issue:** Calls `sendGift(giftItem, recipientId, streamId)` (positional), but the API is `sendGift(gift, options: GiftSendOptions)`. `recipientId` (a string) is passed where the options object is expected, so `options.receiverId`/`options.streamId` are `undefined` → the gift silently goes to the provider's `defaultReceiverId`/`streamId` fallback, not the intended recipient.

### 2.6 BroadcastChat.tsx — Unhandled Rejections in sendMessage
- **File:** `src/components/broadcast/BroadcastChat.tsx`
- **Lines:** 1286–1326
- **Severity:** MEDIUM (promoted to HIGH for production reliability)
- **Issue:** The paid-chat pre-checks (`stream_settings`, `stream_gifts`, `stream_messages` queries) run *before* the `try` block (line 1367). A network failure here throws an unhandled promise rejection, the message is silently dropped, and the user gets no feedback.

### 2.7 GamingSetupPage / update.tsx — Stale Closure in handleGoLive
- **File:** `src/lib/update.tsx`
- **Lines:** 405–442
- **Severity:** HIGH
- **Issue:** `handleGoLive` reads `agoraSessionId` (line 418) but it's **not in the `useCallback` deps** (442). Stale closure can invoke `goLive` with a stale/`null` `sessionId`, breaking go-live after credential regen.

### 2.8 HytroGamingViewer.tsx — Password Protection Not Enforced on Media
- **File:** `src/pages/gaming/HytroGamingViewer.tsx`
- **Lines:** 375–507
- **Severity:** HIGH
- **Issue:** The Agora join effect (489–507) runs based only on `channelName`/`isHost` and is independent of `hasAccess`. A protected stream's video/audio begins playing while the password modal is shown → content-access bypass. Gate the join on `hasAccess`.

---

## 3. FRONTEND BUGS — STATE / TIMING / MEMORY

### 3.1 useBattleQueue.ts — setState Inside Another setState Updater
- **File:** `src/hooks/useBattleQueue.ts`
- **Lines:** 20–42
- **Severity:** HIGH
- **Issue:** The `setTimeout` calls `setQueue(currentQueue => { ... setLeftUser(...); setRightUser(...) ... })`. Calling sibling state setters inside another component's state-updater function is a React anti-pattern. In React 18 StrictMode the updater runs twice, and the side-effect `setLeftUser`/`setRightUser` are invoked from within a reducer-style updater — this can drop or duplicate slot assignments.

### 3.2 useBattleManagement.ts — Leaked Supabase Broadcast Channels
- **File:** `src/hooks/useBattleManagement.ts`
- **Lines:** 170–175, 217–226
- **Severity:** HIGH
- **Issue:** `supabase.channel(`stream:${streamId}`)` is created and `send()`-broadcast, but `removeChannel` is never called. Every box add / guest-leave that auto-adjusts boxes leaks a channel. Under repeated guest churn this accumulates open channels (memory + Realtime quotas).

### 3.3 BattleView.tsx — Heavy DB Query Waterfall on Every Track Event
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 1051–1610 (effect), dep at 1610
- **Severity:** HIGH
- **Issue:** `setBattleParticipants` re-runs on every change to `remoteUsers`. `remoteUsers` gets a brand-new array reference on every LiveKit connect/disconnect/track subscribe event. Inside `fetchParticipantData` there is a sequential `await supabase.from('battle_participants')...` call **per remote user** plus an all-participants fetch and a per-identity fallback query. There is no cancellation token, so an unmount mid-fetch calls `setBattleParticipants` on an unmounted component, and rapid track churn spams Postgres RLS, causing "Failed to fetch battle_participant" errors.

### 3.4 useGamingBattle.ts — Uncleared setTimeout After Unmount
- **File:** `src/hooks/useGamingBattle.ts`
- **Lines:** 98–114
- **Severity:** HIGH
- **Issue:** After picking an opponent, `setTimeout(..., 3000)` starts the battle. This timer is stored nowhere and never cleared. If the component unmounts during the 3s window, the callback still runs `setState`, leaking a state update (and the "active" battle starts for a dead component).

### 3.5 useFiveVFiveBattle.ts — Stale phase Allows Double Matchmaking
- **File:** `src/hooks/useFiveVFiveBattle.ts`
- **Lines:** 130–138, dep at 368
- **Severity:** HIGH
- **Issue:** `if (state.phase !== 'idle')` uses the closure value. A fast double-click fires two `findMatch` calls before re-render; both see `'idle'` and both proceed to create a battle (client-generated `battleId`) and set both streams' `is_battle=true`, overwriting each other → duplicated/abandoned battles.

### 3.6 useRandomBattleQueueController.ts — Activation Guard Defeated by Cleanup
- **File:** `src/hooks/useRandomBattleQueueController.ts`
- **Lines:** 231–237 (guard), 296–300 (cleanup)
- **Severity:** HIGH
- **Issue:** The activation effect sets `activatedBattleIdRef.current = stream.battle_id` (237) to prevent double activation, but the cleanup unconditionally resets it to `null` on every re-run (299). Because `stream?.battle_start_time` is in the dep array (300), any update to `battle_start_time` re-runs the effect, nulling the guard and scheduling a fresh `activate_random_battle` countdown. This can cause repeated activation RPCs / countdown resets, leaving battles stuck in `starting`/`pending`.

### 3.7 useBattleState.ts — Stale battleId Closure in Stream Handler
- **File:** `src/hooks/useBattleState.ts`
- **Lines:** 358–369, effect deps at 426
- **Severity:** HIGH
- **Issue:** The `streams` postgres_changes handler compares `payload.new?.battle_id !== battleState.battleId`, but `battleState.battleId` is captured at effect-creation time. The effect only re-subscribes when `streamId`/`localUserId` change, **not** when `battleState.battleId` changes. If the `battle_id` updates on the stream row, the handler may not detect the change (stale id), so `setBattleState({ battleId })` is skipped.

### 3.8 useStreamChat.ts — Duplicate Realtime Channel Subscription
- **File:** `src/hooks/useStreamChat.ts`
- **Lines:** 232–233
- **Severity:** MEDIUM
- **Issue:** Subscribes to channel `stream-chat:${streamId}` — the **same channel name** `BroadcastChat.tsx` uses (line 1002). If both are mounted for one stream, you get duplicate subscriptions → duplicated messages / doubled presence events.

### 3.9 useStreamChat.ts — fetchMessages Jitter Without Mounted/Abort Guard
- **File:** `src/hooks/useStreamChat.ts`
- **Lines:** 196–230
- **Severity:** MEDIUM
- **Issue:** `fetchMessages` awaits a random 0–400ms jitter then `setMessages` with no mounted/abort guard → setState-after-unmount warnings and wasted work on fast navigation.

### 3.10 useGamingBattle.ts — No Server Persistence of Battle Results
- **File:** `src/hooks/useGamingBattle.ts`
- **Lines:** 98–113 / 135–152
- **Severity:** HIGH
- **Issue:** `battleId` is `gaming_battle_${Date.now()}` — a client-only string never written to any DB table. `endBattle` only flips `streams.is_battle=false`; no winner, scores, or crowns are recorded server-side. Results are purely local/visual and lost on refresh.

### 3.11 useBattleRealtime.ts — Silent Failure Swallowing + Type Drift
- **File:** `src/hooks/useBattleRealtime.ts`
- **Lines:** 242–262 / 273–301
- **Severity:** MEDIUM
- **Issue:** Both `fetchInitial` and `scorePoll` use `try {} catch {}` (empty) so DB/Realtime failures are completely invisible. The `frozenTeams` field is read/written via `(prev as any).frozenTeams` but is **not** declared in the `BattleRealtimeState` interface, so it's never reset to a known shape and can drift.

### 3.12 BattleView.tsx — Timer Effect Tore Down/Recreated on Every Gift
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 4146–4181, dep at 4181
- **Severity:** MEDIUM
- **Issue:** Every gift updates the score, which re-runs this effect, `clearInterval` + recreating the 1s timer. This can skip a tick and is wasteful. `arenaReadyAtMs` in the deps is also pointless.

### 3.13 useBattleManagement.ts — JSON.parse of Metadata Without Per-Parse Try/Catch
- **File:** `src/hooks/useBattleManagement.ts`
- **Lines:** 47–54
- **Severity:** MEDIUM
- **Issue:** `JSON.parse(p.metadata)` is wrapped only by the outer try that swallows the error (line 58: `console.error` only). A single malformed `metadata` JSON aborts the entire guest list fetch and silently leaves `state.guests` unset.

### 3.14 BattleView.tsx — Full LiveKit Room Reconnect When Role Resolves
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 2857–3337, deps at 3337
- **Severity:** MEDIUM
- **Issue:** When `participantInfo` loads, `resolvedBattleRole` flips from `'viewer'` to `'host'`, re-running the whole connection effect (disconnect old Room, new Room(), re-token, re-publish). This causes a visible camera drop/black flash mid-battle.

### 3.15 BattleView.tsx — Native confirm() Dialogs During Battle
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 3933, 4029
- **Severity:** MEDIUM
- **Issue:** Blocking `window.confirm()` is poor UX on mobile (and can be blocked in some WebViews), and both functions navigate away inside the success path without always disconnecting the LiveKit `battleRoomRef`.

### 3.16 BattleView.tsx — Mobile Layout Overflow
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 1827–1830 / 1927–1930 / 1999–2003
- **Severity:** MEDIUM
- **Issue:** Each side uses `height: calc((100% - 4.5rem) / 2)` while the center bar is `h-16` (4rem) plus a header. The 4.5rem subtraction doesn't include the top header/`safe-area-inset`, so on short mobile viewports the two arena halves plus center bar can overflow and clip the bottom side.

### 3.17 useFiveVFiveBattle.ts — forfeitBattle Only Clears Own Stream
- **File:** `src/hooks/useFiveVFiveBattle.ts`
- **Lines:** 594–599
- **Severity:** MEDIUM
- **Issue:** On forfeit, only the forfeiting user's `streams` row is reset to `is_battle=false`. If the opponent's client crashed/closed, their stream stays `is_battle=true` → opponent stuck in a battle with no participants.

### 3.18 PaidChatViewerModal.tsx — Non-Atomic Payment Flow
- **File:** `src/components/broadcast/PaidChatViewerModal.tsx`
- **Lines:** 91–153
- **Severity:** MEDIUM
- **Issue:** Coins are deducted via `try_pay_coins` and `paid_chat_access`/`paid_chat_payments` rows inserted, then the message insert (145) can fail — user is charged but the message never sends, with no refund.

### 3.19 ChallengeRequestModal.tsx — Possible Null Deref + Realtime Race
- **File:** `src/components/broadcast/ChallengeRequestModal.tsx`
- **Lines:** 101–138
- **Severity:** MEDIUM
- **Issue:** `insert().maybeSingle()` can return `data === null`; line 129 accesses `data.id` unguarded. Also the code `subscribe()`s a fresh channel, `send()`s, then immediately `removeChannel()` (120–141) — the broadcast may be torn down before delivery, and `subscribe()` isn't awaited to `SUBSCRIBED` state.

### 3.20 useBattleQueue.ts — setState-in-Updater Side Effects
- **File:** `src/hooks/useBattleQueue.ts`
- **Lines:** 20–42
- **Severity:** HIGH
- **Issue:** Calling sibling state setters inside another component's state-updater function. In React 18 StrictMode the updater runs twice, and the side-effect `setLeftUser`/`setRightUser` are invoked from within a reducer-style updater — this can drop or duplicate slot assignments and trigger "cannot update a component while rendering a different component" warnings.

---

## 4. FRONTEND BUGS — MOBILE-SPECIFIC

### 4.1 BroadcastPage.tsx — Remote Seat Video Autoplay Blocked on Mobile
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Line:** 315
- **Severity:** MEDIUM
- **Issue:** `RemoteSeatSurface` renders `<video muted={false}>` and relies on `.play().catch(()=>{})`. On mobile, autoplay-with-audio is blocked, so seat video can fail to start silently with no retry/unmute UI.

### 4.2 HytroGamingViewer.tsx — Remote Audio Tracks Blocked on Mobile
- **File:** `src/pages/gaming/HytroGamingViewer.tsx`
- **Lines:** 1264–1287
- **Severity:** MEDIUM
- **Issue:** Remote audio tracks auto-`play()` on mobile without a user-gesture-gated unmute path; iOS/Android will block audio and there's no recovery UI.

### 4.3 BattleView.tsx — Mobile Layout Overflow
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 1827–1830 / 1927–1930 / 1999–2003
- **Severity:** MEDIUM
- **Issue:** Each side uses `height: calc((100% - 4.5rem) / 2)` while the center bar is `h-16` (4rem) plus a header. The 4.5rem subtraction doesn't include the top header/`safe-area-inset`, so on short mobile viewports the two arena halves plus center bar can overflow and clip the bottom side.

### 4.4 BattleView.tsx — Duplicate/Mirror Transform Risk on Mobile
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 171, 556, 651
- **Severity:** LOW
- **Issue:** `LiveKitVideoPlayer` applies `scaleX(-1)` on `containerRef` (line 171) while `BattleVideoRenderer` (line 556) applies the same on its own container; with nested wrappers (line 651 `pointer-events-none` wrapper) the mirror can be applied twice depending on which renderer is used for a given tile.

### 4.5 BattleView.tsx — BattleAudioTrackPlayer Body-Appended Audio Elements
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 299–338
- **Severity:** LOW
- **Issue:** Audio elements are appended to `document.body` and removed only on unmount. Under React StrictMode double-mount (dev), two audio elements can briefly exist for the same track, causing duplicate audio.

---

## 5. FRONTEND BUGS — EDGE FUNCTION / "FAILED TO SEND" ISSUES

### 5.1 Broadcasting — livekit-token Edge Function Calls
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Lines:** 3377–3384, 3453–3460
- **Severity:** MEDIUM
- **Issue:** Both publisher and viewer token fetches log "Fetching LiveKit token from Supabase Edge Function..." but neither has a network-level retry. A transient 502/504 from the edge function results in a hard failure with no fallback or retry toast.

### 5.2 GamingSetupPage / update.tsx — agora-stream Edge Function Calls
- **File:** `src/lib/update.tsx`
- **Lines:** 159, 242, 360–361, 416–417, 435, 460
- **Severity:** MEDIUM
- **Issue:** Six separate `supabase.functions.invoke('agora-stream', ...)` calls with no centralized retry or idempotency key. If the edge function returns a non-2xx, the error is often swallowed or only logged, leaving the UI in an inconsistent state (e.g., stream marked live in DB but Agora session never created).

### 5.3 useLiveKitRoom.ts — Token Fetch Without Retry
- **File:** `src/hooks/useLiveKitRoom.ts`
- **Lines:** 84–129
- **Severity:** MEDIUM
- **Issue:** `supabase.functions.invoke('livekit-token', ...)` is called once. If it fails, the hook throws and the whole LiveKit room fails to initialize. No retry, no fallback token cache, and no graceful degradation to a "reconnecting" UI state.

### 5.4 useAgoraRoom.ts — Token Fetch Without Retry
- **File:** `src/hooks/useAgoraRoom.ts`
- **Line:** 136
- **Severity:** MEDIUM
- **Issue:** Same pattern as `useLiveKitRoom.ts` — single-shot edge function call for `agora-token` with no retry. Mobile networks are unreliable; a single dropped packet during token fetch breaks the entire Agora join.

### 5.5 BattleView.tsx — livekit-token Calls Without Retry
- **File:** `src/components/broadcast/BattleView.tsx`
- **Lines:** 2970, 3100
- **Severity:** MEDIUM
- **Issue:** Two separate `supabase.functions.invoke('livekit-token', ...)` calls (viewer + host) with no retry. During a battle, a token fetch failure drops the participant from the arena with no auto-reconnect logic visible in the caller.

---

## 6. FRONTEND BUGS — MEMORY LEAKS / CLEANUP

### 6.1 BroadcastPage.tsx — Multiple Unclosed Intervals
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Lines:** 1357, 1527, 1541, 2160, 2820, 3165
- **Severity:** MEDIUM
- **Issue:** At least six `setInterval` calls for chat lock, countdown, health checks, watch time, heartbeat, and adjacent stream checks. While some have cleanup, the pattern is inconsistent and a missed cleanup on a conditional unmount path would leak intervals.

### 6.2 ViewerPage.tsx — Multiple Unclosed Intervals
- **File:** `src/pages/broadcast/ViewerPage.tsx`
- **Lines:** 825, 839, 2107, 2495
- **Severity:** MEDIUM
- **Issue:** Four `setInterval` calls for chat lock, countdown, watch time, and heartbeat. Same risk as BroadcastPage — inconsistent cleanup paths.

### 6.3 GamingSetupPage / update.tsx — Duplicate Duration Timers
- **File:** `src/lib/update.tsx`
- **Lines:** 98–118 & 319–334
- **Severity:** LOW
- **Issue:** Two separate `setInterval`-based duration timers do the same job → redundant re-renders every second.

### 6.4 TreelzVideoPlayer.tsx — Two <video> Elements Loading Same URL
- **File:** `src/components/treelz/TreelzVideoPlayer.tsx`
- **Lines:** 248–269
- **Severity:** MEDIUM
- **Issue:** Two `<video>` elements load the same `post.video_url` (blurred backdrop + main). Doubles bandwidth/decoding — significant on mobile data.

### 6.5 TreelzVideoPlayer.tsx — View Tracking Re-Runs on Parent Re-Render
- **File:** `src/components/treelz/TreelzVideoPlayer.tsx`
- **Lines:** 154–163
- **Severity:** MEDIUM
- **Issue:** View-tracking effect depends on `onView`; if the parent doesn't memoize `onView`, the effect re-runs and can double-record views / reset `viewStartRef`.

---

## 7. SUPABASE DATABASE SECURITY AUDIT

### 7.1 CRITICAL — Edge Functions Missing JWT Verification

| # | File | Lines | Function | Issue |
|---|------|-------|----------|-------|
| 1 | `supabase/functions/agora-stream/index.ts` | 437–496 | `serve()` | Uses `SERVICE_ROLE_KEY` directly without verifying user JWT. Any unauthenticated caller can start/end streams, modify any stream record, and retrieve session data including RTMP stream keys. |
| 2 | `supabase/functions/agora-token/index.ts` | 45–112 | `serve()` | Generates Agora RTC tokens for any requested channel without verifying the requester's identity or ownership of the stream. Allows token generation for arbitrary channels. |
| 3 | `supabase/functions/agora-walkie-token/index.ts` | 109–228 | `serve()` | Role check is performed client-side (`ALLOWED_ROLES` set) with no database verification of the user's actual role. Any client can spoof a role and obtain a walkie-talkie token. |
| 4 | `supabase/functions/store-user-geolocation/index.ts` | 72–160 | `serve()` | Accepts `user_id` directly from request body with no JWT verification. Uses `SERVICE_ROLE_KEY` to insert geolocation data and log to `admin_audit_logs`. Any attacker can forge location data and audit trails for any user. |

### 7.2 HIGH — Missing Foreign Key Constraints

| # | File | Lines | Table / Column | Issue |
|---|------|-------|----------------|-------|
| 5 | `supabase/migrations/20250202130000_battles.sql` | 4–5 | `battles.challenger_stream_id`, `battles.opponent_stream_id` | Reference `streams(id)` with no `ON DELETE` clause. If a stream is deleted, the battle record becomes an orphan with dangling foreign keys. |
| 6 | `supabase/migrations/20250202130000_battles.sql` | 17 | `streams.battle_id` | References `battles(id)` with no `ON DELETE` clause. If a battle is deleted, all linked streams retain a dangling `battle_id` reference. |
| 7 | `supabase/migrations_backup/20230101000000_baseline.sql` | 3538 | `streams.broadcaster_id` | `broadcaster_id UUID NOT NULL` exists with no `REFERENCES` constraint. Migration `20290609000000_add_gaming_stream_columns.sql` (line 21) attempts to add the FK only if the column is missing, but since it already exists in baseline, the FK is never added. This allows invalid broadcaster IDs. |
| 8 | `supabase/migrations_backup/20270120008000_troll_battles_setup.sql` | 5 | `battle_queue.user_id` | Primary key references `user_profiles(id)` with no `ON DELETE` action. If a user is deleted, their queue entry becomes orphaned. |

### 7.3 HIGH — Missing / Inconsistent RLS

| # | File | Lines | Table | Issue |
|---|------|-------|-------|-------|
| 9 | `supabase/migrations_backup/20230101000000_baseline.sql` | 25167–25176 | `stream_viewers` | Table created without `FORCE ROW LEVEL SECURITY` or `ENABLE ROW LEVEL SECURITY`. RLS was only added later in `20270122140000_fix_linter_issues.sql` (line 248). A fresh database from baseline has no row-level protection on viewer tracking data. |
| 10 | `supabase/migrations_backup/20230101000000_baseline.sql` | 36679, 37307 | `streams` | Baseline creates `"Anyone can view live streams"` and `"Public can view streams"` policies with `USING (true)`, exposing all stream data (including private/non-live streams) to anonymous users. |
| 11 | `supabase/migrations_backup/20270125160000_create_broadcasts_view.sql` | 37 | `broadcasts` view | `GRANT SELECT ON public.broadcasts TO anon` combined with `security_invoker = true` exposes stream metadata to unauthenticated users. The view selects `broadcaster_id`, `title`, `category`, `viewer_count`, etc. |
| 12 | `supabase/migrations_backup/20230101000000_baseline.sql` | 36631, 36725 | `streams` | Conflicting RLS policies: `"Allow users to view their own streams"`, `"Auth read all streams"` (`USING (true)` for authenticated), and `"users select own streams"`. The overly broad authenticated-read-all policy undermines ownership-based restrictions. |
| 13 | `supabase/migrations_backup/20230101000000_baseline.sql` | 41927–43040 | Multiple tables | Inconsistent RLS enforcement style: some tables use `FORCE ROW LEVEL SECURITY` (e.g., `troll_battles`, `gifts`, `profiles`, `users`) while others use only `ENABLE ROW LEVEL SECURITY` (e.g., `battles`, `state_battles`). `FORCE` is safer as it applies to the table owner as well. |

### 7.4 MEDIUM — Race Conditions / Data Integrity

| # | File | Lines | Issue |
|---|------|-------|-------|
| 14 | `supabase/migrations/20250202110000_paid_features.sql` | 75–131 | `send_gift` RPC race condition: balance check (`SELECT troll_coins`) and deduction (`UPDATE`) are not wrapped in a `SELECT ... FOR UPDATE` lock. Two concurrent requests can pass the balance check before either deducts, allowing double-spending. |
| 15 | `supabase/migrations_backup/20230101000000_baseline.sql` | 22110–22134 | `gifts` table schema drift / data loss risk: baseline defines `gifts` as a transaction log. Migration `20260220000000_comprehensive_gifts_system.sql` (line 52) executes `DELETE FROM public.gifts` to transform it into a catalog, destroying all historical gift transaction data. |
| 16 | `supabase/migrations/20260226000001_create_global_gift_system.sql` | 21–29 | `gift_transactions` naming collision: creates a new `gift_transactions` table (no schema prefix) while baseline already has `public.gift_transactions`. The new table lacks the `public.` prefix and may conflict depending on `search_path`. |

### 7.5 MEDIUM — Overly Permissive Policies

| # | File | Lines | Issue |
|---|------|-------|-------|
| 17 | `supabase/migrations_backup/20230101000000_baseline.sql` | 36679, 37307 | `streams` table has `"Anyone can view live streams"` with `USING (true)` — exposes private/non-live streams to anonymous users. |
| 18 | `supabase/migrations_backup/20270125160000_create_broadcasts_view.sql` | 37 | `broadcasts` view grants `SELECT` to `anon` — exposes stream metadata (broadcaster_id, title, category, viewer_count) to unauthenticated users. |

### 7.6 LOW — Missing Indexes

| # | Suggested Index | Table | Reason |
|---|----------------|-------|--------|
| 19 | `(is_live, started_at)` | `streams` | Optimizes broadcast feed queries (`WHERE is_live = true ORDER BY started_at DESC`). |
| 20 | `(stream_id, joined_at)` | `stream_viewers` | Optimizes viewer timeline queries. |
| 21 | `(stream_id, created_at)` | `gifts` | Optimizes gift feed queries per stream. |

---

## 8. ADDITIONAL TIMING / RACE CONDITION FINDINGS

### 8.1 BroadcastPage.tsx — Mount/Unmount Debug Effect Closure Capture
- **File:** `src/pages/broadcast/BroadcastPage.tsx`
- **Lines:** 606–616
- **Severity:** LOW
- **Issue:** Mount/unmount debug effect (`[]` deps) references `isStreamAdmin` (declared later at 619) and `streamId` — closure captures initial values; fragile but works because it runs post-render.

### 8.2 BroadcastPage.tsx — Disappearing Message Effect Stale Deps
- **File:** `src/components/broadcast/BroadcastChat.tsx`
- **Lines:** 588–608
- **Severity:** LOW
- **Issue:** Disappearing-message effect deps are `[messages.length, hasDisappearingChat]`; it reads `messages[messages.length-1]` which can be stale, and omits `disappearingMessages`/`messages` from deps.

### 8.3 BattleView.tsx — Optimistic Score Drift
- **File:** `src/hooks/useBattleSubscriber.ts`
- **Lines:** 236–252 / 892–907
- **Severity:** LOW
- **Issue:** Score is incremented purely from broadcast `gift_scored`/`gift_sent` events with no authoritative DB reconciliation (the 1v1 path relies on `postgres_changes` only). Network partition/reordering between two simultaneous gifts can cause per-client score divergence.

### 8.4 useGiftSystem.ts — Post-Send Errors Swallowed
- **File:** `src/lib/hooks/useGiftSystem.ts`
- **Lines:** 176–193
- **Severity:** LOW
- **Issue:** Post-send "fire-and-forget" block swallows every error (`catch { /* ignore */ }`) — XP/family-activity failures are invisible.

### 8.5 TreelzVideoPlayer.tsx — Double-Tap Toggles Like Instead of Setting
- **File:** `src/components/treelz/TreelzVideoPlayer.tsx`
- **Lines:** 203–213
- **Severity:** LOW
- **Issue:** `handleDoubleTap` always shows the heart and calls `toggleTreelzTroll` (which *toggles*, so a double-tap can *un*-like); no state sync with `TreelzActions`' local `trolled`.

---

## 9. MISSING ERROR BOUNDARIES / RESILIENCE

| # | File | Issue |
|---|------|-------|
| 22 | `BattleView.tsx`, `BattleArena.tsx`, overlays | No React error boundary wrapper. A thrown error in LiveKit track handling or a bad `battle?.X` access would crash the whole broadcast view. |
| 23 | `BroadcastChat.tsx` | Chat rows lack per-message error boundaries. A single render throw (e.g., `parseGiftMessage` out of scope) blanks the chat. |
| 24 | `GiftBoxModal.tsx`, `GiftTray.tsx` | Gift modals lack error boundaries. A malformed gift payload can crash the modal and block gifting entirely. |

---

## 10. FILES REQUIRING ATTENTION (NO CODE CHANGES)

### Broadcast / Viewer
- `src/pages/broadcast/BroadcastPage.tsx`
- `src/pages/broadcast/ViewerPage.tsx`
- `src/components/broadcast/BroadcastChat.tsx`
- `src/components/broadcast/BattleView.tsx`
- `src/components/broadcast/LiveKitViewerPlayer.tsx`
- `src/components/broadcast/GiftTray.tsx`
- `src/components/broadcast/GiftBoxModal.tsx`
- `src/components/broadcast/GamingGiftPanel.tsx`
- `src/components/broadcast/PaidChatViewerModal.tsx`
- `src/components/broadcast/ChallengeRequestModal.tsx`
- `src/components/broadcast/GamingChat.tsx`
- `src/components/treelz/TreelzVideoPlayer.tsx`
- `src/components/treelz/TreelzVideoPlayer.tsx`

### Hooks / State
- `src/lib/hooks/useGiftSystem.ts`
- `src/hooks/useStreamChat.ts`
- `src/hooks/useLiveKitRoom.ts`
- `src/hooks/useAgoraRoom.ts`
- `src/hooks/useBattleQueue.ts`
- `src/hooks/useBattleManagement.ts`
- `src/hooks/useFiveVFiveBattle.ts`
- `src/hooks/useRandomBattleQueueController.ts`
- `src/hooks/useBattleState.ts`
- `src/hooks/useBattleRealtime.ts`
- `src/hooks/useBattleSubscriber.ts`
- `src/hooks/useGamingBattle.ts`

### Pages
- `src/pages/gaming/HytroGamingViewer.tsx`
- `src/lib/update.tsx` (GamingSetupPage)
- `src/pages/broadcast/SetupPage.tsx`

### Services / Utils
- `src/services/treelzService.ts`
- `src/lib/updateMeta.tsx`
- `src/lib/tromail.ts`
- `src/lib/notifications.ts`
- `src/lib/sendNotification.ts`
- `src/lib/promoCardDelivery.ts`

### Supabase Edge Functions (Auth / Security)
- `supabase/functions/agora-stream/index.ts`
- `supabase/functions/agora-token/index.ts`
- `supabase/functions/agora-walkie-token/index.ts`
- `supabase/functions/store-user-geolocation/index.ts`

### Database Migrations
- `supabase/migrations/20250202130000_battles.sql`
- `supabase/migrations/20250202110000_paid_features.sql`
- `supabase/migrations/20260226000001_create_global_gift_system.sql`
- `supabase/migrations_backup/20230101000000_baseline.sql`
- `supabase/migrations_backup/20270120008000_troll_battles_setup.sql`
- `supabase/migrations_backup/20270125160000_create_broadcasts_view.sql`

---

## 11. RECOMMENDATIONS (PRIORITY ORDER)

1. **Fix build blockers first:** Resolve duplicate `MAX_MESSAGES` in `BroadcastChat.tsx` and move `parseGiftMessage` to module scope or pass it as a prop to `ChatMessageItem`.
2. **Fix guaranteed runtime failures:** Correct `jsonb_build_object` → JS object literal in `PaidChatViewerModal.tsx` and fix `sendGift` positional args in `GamingGiftPanel.tsx`.
3. **Fix Rules-of-Hooks violation:** Restructure `useGiftSystem.ts` so the early return happens after all hooks are called (split into inner component or conditional fragment).
4. **Secure Edge Functions:** Add JWT verification to `agora-stream`, `agora-token`, `agora-walkie-token`, and `store-user-geolocation` edge functions before next deploy.
5. **Add missing FK + ON DELETE:** Add `REFERENCES ... ON DELETE CASCADE/SET NULL` to `battles.challenger_stream_id`, `battles.opponent_stream_id`, `streams.battle_id`, and add the missing `streams.broadcaster_id` FK.
6. **Fix stale closures:** Add missing deps to `useCallback`/`useEffect` in `update.tsx` (`agoraSessionId`), `useBattleState.ts` (`battleId`), and `useRandomBattleQueueController.ts` (activation guard).
7. **Fix double-match race:** Add a `matchingRef` guard in `useFiveVFiveBattle.ts` `findMatch`.
8. **Fix leaked channels:** Reuse a persistent Supabase channel ref in `useBattleManagement.ts` instead of creating one per RPC.
9. **Fix DB query storm:** Debounce `fetchParticipantData` in `BattleView.tsx`, add `AbortController`, and avoid per-user sequential queries.
10. **Add error boundaries:** Wrap `BattleView`, `BroadcastChat`, and gift modals in React error boundaries to prevent single render throws from blanking entire screens.
11. **Add retry logic:** Wrap all `supabase.functions.invoke` calls in a retry helper with exponential backoff for transient 502/504/network errors.
12. **Gate protected content:** In `HytroGamingViewer.tsx`, gate Agora `join` on `hasAccess` so protected streams don't leak media.
13. **Clean up intervals:** Audit all `setInterval`/`setTimeout` in `BroadcastPage.tsx` and `ViewerPage.tsx` for consistent cleanup in `useEffect` returns.
14. **Add composite indexes:** Add `(is_live, started_at)` on `streams` and `(stream_id, joined_at)` on `stream_viewers`.
15. **Review RLS policies:** Replace `USING (true)` public-read policies on `streams` and `broadcasts` view with ownership-based checks; enable `FORCE ROW LEVEL SECURITY` on `battles` and `state_battles`.

---

*End of report. No code changes were made. All findings are based on static analysis of the codebase.*
