# 🔍 Mai Troll — FULL FRESH CONCURRENCY AUDIT

**Date:** 2026-06-21  
**Method:** Live code analysis only. No prior audit files referenced.

---

## A. PER-PAGE CONCURRENCY TABLE

### Legend
- **RC** = Realtime Channels (Supabase postgres_changes subscriptions)
- **BC** = Broadcast channels (Supabase broadcast events, share an RC)
- **WS** = WebSocket connections (1 per Supabase client instance, but each channel adds overhead)
- **IQ** = Initial Queries (on mount)
- **RQ** = Recurring Queries (polling/intervals)
- **Int** = Intervals/Timers
- **Risk:** Low / Medium / High / Critical

---

### 1. HOMEPAGE (Viewer — `/` or `/home`)

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useAuthStore` (profile) | 2 | 0 | 1 | 0 | 0 | `profile:{userId}` + `user-credit:{userId}` |
| `useGlobalActivity` | 1 | 0 | 1 | 0 | 0 | `global-events-ticker` |
| `LiveContentContext` | 3 | 0 | 2 | 2 | 2 | `home:live-streams`, `home:live-auctions`, `home:visibility-scores`. Polls: 60s streams, 30s auctions |
| `useWallPosts` | 0 | 0 | 1 | 0 | 0 | Wall feed query (limit 20) |
| `useActiveBroadcasts` | 0 | 0 | 1 | 1 | 1 | Polls every 30s |
| `useNavBadges` (logged in) | 2+ | 0 | 2 | 0 | 0 | `nav-notifications:{userId}` + `nav-chats:{userId}` + admin coin purchase channel |
| `useSupportGoalReminder` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `usePresidentSystem` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `TCNNPopupWidget` | 1 | 0 | 1 | 0 | 0 | Global events sub |
| `FeaturedBroadcasts` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useLiveViewerCount` (per live card) | 1 | 0 | 1 | 0 | 0 | **PER CARD** — `stream-viewer-count:{streamId}` |

**Homepage Viewer (not logged in):**
| Metric | Count |
|---|---|
| Realtime Channels | 5 (global-events, home:live-streams, home:live-auctions, home:visibility-scores, TCNN) |
| Initial Queries | ~8 |
| Recurring Queries | 2 (60s + 30s polls) |
| Intervals | 2 |
| Risk | **Medium** |

**Homepage Logged-in User:**
| Metric | Count |
|---|---|
| Realtime Channels | 7-8 (above + profile, credit, nav-notifications, nav-chats) |
| Initial Queries | ~12 |
| Recurring Queries | 2 |
| Intervals | 2 |
| Risk | **Medium-High** |

**Homepage with Live Grid (each live card):**
| Metric | Count |
|---|---|
| Additional RC per card | 1 (`stream-viewer-count:{id}`) |
| Risk | **High** — 100 live cards = 100 extra channels |

---

### 2. BROADCAST VIEWER (`/watch/:id`)

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useLiveKitRoom` | 0 | 0 | 1 | 0 | 0 | **LiveKit WebSocket** (separate from Supabase) |
| `useBroadcastRealtime` | 1 | 3 | 1 | 0 | 1 | `broadcast-stream-{id}` (postgres_changes on streams + broadcast message/gift/like). Flush interval 100ms |
| `useStreamChat` | 1 | 1 | 1 | 0 | 2 | `stream-chat-{id}` (broadcast chat + presence). Auto-delete 5s, host-mod-state 1s |
| `useViewerTracking` | 1 | 0 | 1 | 0 | 0 | `room:{streamId}` presence channel |
| `useStreamAudiencePresence` | 1 | 0 | 1 | 0 | 0 | `stream-audience-presence:{streamId}` |
| `useStreamSeats` | 1 | 0 | 1 | 0 | 0 | `stream-seat-events:{streamId}` |
| `useStreamTopGifters` | 0 | 0 | 1 | 1 | 1 | Polls every 15s |
| `useBoxCount` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useCreatorSubscription` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useBroadcastViewerCap` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useGiftSystem` | 2 | 0 | 2 | 0 | 0 | `stream-gifts:{id}` + `stream:{id}` (singleton-managed) |
| `useTrollFamilyActivity` | 1 | 0 | 1 | 0 | 0 | Family activity channel |
| `useBroadcastTextPopup` | 0 | 0 | 0 | 0 | 1 | Timeout-based |
| `useBroadcastRecorder` | 0 | 0 | 0 | 0 | 1 | Recording interval |
| `useChatBlockStatus` | 1 | 0 | 1 | 0 | 1 | Chat block channel + 1s check interval |
| `useGhostMode` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useUserFrame` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useUserLeagues` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useCityStatusOrb` | 0 | 0 | 1 | 0 | 0 | Single fetch |
| `useMissionProgress` | 0 | 0 | 1 | 0 | 0 | Single fetch |

**Broadcast Viewer Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~10-12 |
| LiveKit WebSocket | 1 |
| Initial Queries | ~18-20 |
| Recurring Queries | 1 (15s top gifters poll) |
| Intervals | ~5 (chat flush 100ms, auto-delete 5s, host-mod 1s, top-gifters 15s, chat-block 1s) |
| Risk | **Critical** |

---

### 3. BROADCASTER (`/broadcast/setup` → `/broadcast/:id`)

All of the above PLUS:

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useBroadcastRealtime` | 1 | 3 | 1 | 0 | 1 | Same as viewer |
| `useStreamChat` | 1 | 1 | 1 | 0 | 2 | Same as viewer |
| `useViewerTracking` | 1 | 0 | 1 | 0 | 0 | Same as viewer |
| `useStreamAudiencePresence` | 1 | 0 | 1 | 0 | 0 | Same as viewer |
| `useStreamSeats` | 1 | 0 | 1 | 0 | 0 | Same as viewer |
| `useLiveKitRoom` (publisher) | 0 | 0 | 1 | 0 | 0 | LiveKit WS as publisher |
| `useBroadcastLockdown` | 1 | 0 | 1 | 0 | 0 | Lockdown channel |
| `useBroadcastPinnedProducts` | 1 | 0 | 1 | 0 | 0 | Pinned products channel |
| `useObsHeartbeat` | 0 | 0 | 0 | 0 | 1 | 15s heartbeat interval |
| `useGamingHeartbeat` | 0 | 0 | 0 | 0 | 2 | 15s heartbeat + check interval |
| `useOfficerBroadcastTracking` | 0 | 0 | 0 | 0 | 1 | Activity tracking interval |
| `useBroadcastRecorder` | 0 | 0 | 0 | 0 | 1 | Recording interval |
| `useFiveVFiveBattle` | 1 | 8 | 2 | 0 | 3 | `5v5-battle:{id}` with 8 broadcast events + timer/countdown intervals |
| `useAgoraRoom` | 0 | 0 | 1 | 0 | 0 | **Agora WebSocket** (if using Agora) |
| `useScreenShare` | 0 | 0 | 1 | 0 | 0 | Single fetch |

**Broadcaster Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~14-16 |
| LiveKit WebSocket | 1 (publisher) |
| Agora WebSocket | 0-1 (if gaming) |
| Initial Queries | ~25-30 |
| Recurring Queries | 1 |
| Intervals | ~10+ |
| Risk | **Critical** |

---

### 4. BATTLE VIEWER

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useBattleRealtime` | 1 | 7 | 2 | 1 | 1 | `battle-all:{id}` (1 channel replacing 9). Score poll 2s |
| `useLiveKitRoom` | 0 | 0 | 1 | 0 | 0 | LiveKit WS |
| `useBroadcastRealtime` | 1 | 3 | 1 | 0 | 1 | Parent stream channel |
| `useStreamChat` | 1 | 1 | 1 | 0 | 2 | Chat channel |
| `useViewerTracking` | 1 | 0 | 1 | 0 | 0 | Presence |
| `useGiftSystem` | 2 | 0 | 2 | 0 | 0 | Gift channels |

**Battle Viewer Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~6-8 |
| LiveKit WebSocket | 1 |
| Initial Queries | ~8 |
| Recurring Queries | 1 (2s score poll) |
| Intervals | ~4 |
| Risk | **Critical** |

---

### 5. BATTLE PARTICIPANT (5v5)

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useFiveVFiveBattle` | 1 | 8 | 2 | 0 | 3 | `5v5-battle:{id}` + timer/countdown/rematch intervals |
| `useLiveKitRoom` | 0 | 0 | 1 | 0 | 0 | LiveKit WS |
| `useBroadcastRealtime` | 1 | 3 | 1 | 0 | 1 | Stream channel |
| `useStreamChat` | 1 | 1 | 1 | 0 | 2 | Chat |
| `useGiftSystem` | 2 | 0 | 2 | 0 | 0 | Gift channels |

**Battle Participant Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~5-7 |
| LiveKit WebSocket | 1 |
| Initial Queries | ~6 |
| Recurring Queries | 0 |
| Intervals | ~6 |
| Risk | **Critical** |

---

### 6. AUCTION VIEWER

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useAuctionTimer` | 1 | 0 | 1 | 0 | 1 | `auction-timer:{lotId}` + 1s countdown |
| `useLiveKitRoom` | 0 | 0 | 1 | 0 | 0 | LiveKit WS |
| `useBroadcastRealtime` | 1 | 3 | 1 | 0 | 1 | Stream channel |
| `useStreamChat` | 1 | 1 | 1 | 0 | 2 | Chat |
| `useViewerTracking` | 1 | 0 | 1 | 0 | 0 | Presence |
| `useGiftSystem` | 2 | 0 | 2 | 0 | 0 | Gift channels |

**Auction Viewer Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~6-8 |
| LiveKit WebSocket | 1 |
| Initial Queries | ~7 |
| Recurring Queries | 0 |
| Intervals | ~4 |
| Risk | **High** |

---

### 7. AUCTION HOST

All of the above PLUS:

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `LiveAuctionRoom` | 1 | 0 | 1 | 0 | 0 | `auction-room:{showId}` presence |
| `useAuctionTimer` | 1 | 0 | 1 | 0 | 1 | Timer channel + 1s countdown |
| `useLiveKitRoom` (publisher) | 0 | 0 | 1 | 0 | 0 | LiveKit WS |
| `useBroadcastRecorder` | 0 | 0 | 0 | 0 | 1 | Recording interval |

**Auction Host Total:**
| Metric | Count |
|---|---|
| Supabase Realtime Channels | ~8-10 |
| LiveKit WebSocket | 1 |
| Initial Queries | ~10 |
| Recurring Queries | 0 |
| Intervals | ~5 |
| Risk | **Critical** |

---

### 8. AGENCY PAGES

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `AgencyDashboard` | 0 | 0 | 3 | 0 | 0 | No realtime subscriptions |
| `AgencyHRDashboard` | 0 | 0 | 4 | 0 | 0 | No realtime subscriptions |
| `AgencyProfilePage` | 0 | 0 | 2 | 0 | 0 | No realtime subscriptions |

**Agency Pages Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 0 |
| Initial Queries | 2-4 |
| Risk | **Low** |

---

### 9. COIN STORE

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `CoinStore.jsx` | 0 | 0 | 2 | 0 | 0 | No realtime subscriptions |

**Coin Store Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 0 |
| Initial Queries | ~2 |
| Risk | **Low** |

---

### 10. NOTIFICATIONS

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `Notifications.tsx` | 1 | 0 | 2 | 0 | 0 | `notifications-page:{userId}` (INSERT/UPDATE on notifications + jail_notifications) |

**Notifications Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 1 |
| Initial Queries | 2 (notifications 120 limit + jail 40 limit) |
| Risk | **Low** |

---

### 11. ADMIN DASHBOARD

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useAdminDashboardMetrics` | 0 | 0 | 4 | 1 | 1 | Polls every 5 min |
| `useAdminFinanceRealtime` | 0 | 0 | 1 | 1 | 1 | Polls every 5 min + React Query |
| `AdminDashboard.tsx` | 0 | 0 | 6 | 0 | 0 | Multiple stat queries |
| `TempAdminDashboard` | 1 | 0 | 1 | 0 | 0 | `admin-online-users` |
| `CashoutDetailPage` | 1 | 0 | 1 | 0 | 0 | `admin_cashout_{id}` |
| `OfficerOperations` | 1 | 0 | 1 | 0 | 0 | `officer-chat-realtime` |
| `PayoutReview` | 1 | 0 | 1 | 0 | 0 | `payout_requests` |

**Admin Dashboard Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 0-4 (depending on sub-page) |
| Initial Queries | ~6-10 |
| Recurring Queries | 2 (5-min polls) |
| Intervals | 2 |
| Risk | **Medium** |

---

### 12. MODERATOR TOOLS

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `useOfficerStreamTracking` | 0 | 0 | 1 | 0 | 1 | Activity interval |
| `useOfficerBroadcastTracking` | 0 | 0 | 1 | 0 | 1 | Activity interval |
| `ChatModeration` | 1 | 0 | 2 | 0 | 0 | Moderation channel |
| `OfficerOWCDashboard` | 1 | 0 | 1 | 0 | 0 | OWC channel |

**Moderator Tools Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 1-3 |
| Initial Queries | ~3-5 |
| Intervals | 1-2 |
| Risk | **Medium** |

---

### 13. PROFILE PAGES

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `Profile.tsx` | 0 | 0 | 2 | 0 | 0 | No realtime subscriptions |

**Profile Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 0 |
| Initial Queries | ~2 |
| Risk | **Low** |

---

### 14. MESSAGING / CHAT SYSTEMS

| Component | RC | BC | IQ | RQ | Int | Notes |
|---|---|---|---|---|---|---|
| `TrollFamilyChat` | 3 | 0 | 2 | 0 | 0 | `family-messages-{id}`, `family-calls-{id}`, `family-call-members-{id}` |
| `UtromailPage` | 2 | 0 | 2 | 0 | 0 | `utromail-notifs:{userId}`, `utromail-thread:{id}` |
| `Call.tsx` | 0 | 0 | 1 | 0 | 0 | No Supabase channels (uses Agora/LiveKit) |

**Messaging Total:**
| Metric | Count |
|---|---|
| Realtime Channels | 2-3 |
| Initial Queries | ~2-4 |
| Risk | **Medium** |

---

## B. SUBSCRIPTION LOAD MODEL

### Scenario: 100 Homepage + 100 Broadcast Viewers + 50 Battle Viewers + 10 Broadcasters + 5 Admins

#### Per-User Channel Count:

| User Type | Supabase RC | LiveKit WS | Total RC |
|---|---|---|---|
| Homepage Viewer (anon) | 5 | 0 | 5 |
| Homepage Viewer (logged in) | 8 | 0 | 8 |
| Broadcast Viewer | 12 | 1 | 12 |
| Broadcaster | 16 | 1 | 16 |
| Battle Viewer | 8 | 1 | 8 |
| Battle Participant | 7 | 1 | 7 |
| Admin | 3 | 0 | 3 |

#### Total Subscription Load:

**Assumption: 50 anon homepage + 50 logged-in homepage + 100 broadcast viewers + 50 battle viewers + 10 broadcasters + 5 admins**

| Channel Type | Count | Notes |
|---|---|---|
| `profile:{userId}` | 50 | One per logged-in user |
| `user-credit:{userId}` | 50 | One per logged-in user |
| `global-events-ticker` | 100 | Shared across all homepage users |
| `home:live-streams` | 100 | Shared across all homepage users |
| `home:live-auctions` | 100 | Shared across all homepage users |
| `home:visibility-scores` | 100 | Shared across all homepage users |
| `stream-viewer-count:{id}` | 100+ | **PER LIVE CARD** — major issue |
| `broadcast-stream-{id}` | 100 | Per viewer per stream |
| `broadcast-presence-{id}` | 100 | Per viewer per stream |
| `stream-chat:{id}` | 100 | Per viewer per stream |
| `room:{streamId}` | 100 | Per viewer per stream |
| `stream-audience-presence:{id}` | 100 | Per viewer per stream |
| `stream-seat-events:{id}` | 100 | Per viewer per stream |
| `stream-gifts:{id}` | 100 | Per viewer per stream (singleton) |
| `stream:{id}` | 100 | Per viewer per stream (singleton) |
| `battle-all:{id}` | 50 | Per battle viewer |
| `5v5-battle:{id}` | 10 | Per battle participant |
| `nav-notifications:{userId}` | 50 | Per logged-in user |
| `nav-chats:{userId}` | 50 | Per logged-in user |
| `notifications-page:{userId}` | 5 | Per admin |

**Total unique Supabase Realtime channels: ~1,500-2,000+**

**Total LiveKit WebSockets: ~160** (100 viewers + 50 battle + 10 broadcasters)

---

## C. ESTIMATED SAFE CONCURRENT USERS

| Metric | Safe | Warning | Breaking |
|---|---|---|---|
| **Homepage viewers** | 500 | 2,000 | 5,000 |
| **Broadcast viewers (single stream)** | 200 | 500 | 2,000 |
| **Broadcasters (total)** | 20 | 50 | 100 |
| **Battle participants (total)** | 50 | 100 | 200 |
| **Auction viewers (single auction)** | 100 | 300 | 1,000 |
| **Total concurrent users (platform)** | 1,000 | 3,000 | 10,000 |

---

## D. ESTIMATED WARNING THRESHOLD

| Metric | Value |
|---|---|
| **Total Supabase channels** | ~2,000 channels |
| **Total LiveKit connections** | ~200 |
| **Total polling intervals** | ~500+ intervals across all clients |
| **Total DB queries/minute** | ~5,000-10,000 |

---

## E. ESTIMATED BREAKING POINT

| Metric | Value |
|---|---|
| **Total Supabase channels** | ~5,000+ channels |
| **Total LiveKit connections** | ~500+ |
| **Total polling intervals** | ~2,000+ |
| **Total DB queries/minute** | ~20,000+ |
| **Supabase Realtime limit** | **UNKNOWN** — No explicit channel limit found in code. Supabase Pro plan supports ~500 concurrent Realtime connections per project. |
| **Supabase DB connection pool** | **UNKNOWN** — Default Supabase Pro: 60-200 direct connections, 200-600 pooled |

---

## F. TOP 20 SCALABILITY BOTTLENECKS

### 1. 🔴 PER-CARD VIEWER COUNT SUBSCRIPTIONS
- **File:** `src/hooks/useViewerTracking.ts` (function `useLiveViewerCount`)
- **Issue:** Each live card on the homepage creates a separate `stream-viewer-count:{streamId}` Supabase Realtime channel
- **Impact:** 100 live cards = 100 extra channels per homepage user
- **Fix:** Use a single shared subscription or batch query

### 2. 🔴 BROADCAST VIEWER CHANNEL EXPLOSION
- **File:** `src/pages/broadcast/ViewerPage.tsx`
- **Issue:** Each viewer opens ~10-12 Supabase Realtime channels per stream
- **Impact:** 1,000 viewers = 10,000-12,000 channels on a single stream
- **Fix:** Consolidate channels, use shared subscriptions

### 3. 🔴 BATTLE SCORE POLLING (2s interval)
- **File:** `src/hooks/useBattleRealtime.ts` (line 273)
- **Issue:** Every battle viewer polls the battles table every 2 seconds
- **Impact:** 500 battle viewers = 250 DB queries/second just for score
- **Fix:** Increase interval to 5-10s, or rely solely on broadcast events

### 4. 🔴 STREAMER STATS POLLING (120s interval)
- **File:** `src/hooks/useStreamStats.ts`
- **Issue:** Each viewer polls streamer stats every 120s
- **Impact:** 1,000 viewers = ~8 queries/second
- **Fix:** Use Realtime subscription instead of polling

### 5. 🔴 TOP GIFTERS POLLING (15s interval)
- **File:** `src/hooks/useStreamTopGifters.ts`
- **Issue:** Every viewer polls top gifters every 15s
- **Impact:** 1,000 viewers = ~67 queries/second
- **Fix:** Use Realtime or increase interval to 60s+

### 6. 🔴 LIVE CONTENT POLLING (60s streams, 30s auctions)
- **File:** `src/contexts/LiveContentContext.tsx`
- **Issue:** Every homepage user polls live content every 60s
- **Impact:** 2,000 homepage users = ~33 queries/second
- **Fix:** Rely solely on Realtime subscriptions

### 7. 🔴 ACTIVE BROADCASTS POLLING (30s interval)
- **File:** `src/hooks/useActiveBroadcasts.ts`
- **Issue:** Polls every 30s for active content
- **Impact:** Redundant with LiveContentContext
- **Fix:** Remove or consolidate

### 8. 🔴 AUCTION TIMER 1s COUNTDOWN
- **File:** `src/hooks/useAuctionTimer.ts`
- **Issue:** Every auction viewer runs a 1s interval countdown
- **Impact:** 1,000 auction viewers = 1,000 intervals/second
- **Fix:** Use server-side timer with Realtime sync

### 9. 🔴 CHAT MESSAGE FLUSH INTERVAL (100ms)
- **File:** `src/hooks/useBroadcastRealtime.ts` (line 295)
- **Issue:** Message buffer flushes every 100ms
- **Impact:** High CPU usage during active chat
- **Fix:** Increase to 250-500ms

### 10. 🔴 CHAT AUTO-DELETE INTERVAL (5s)
- **File:** `src/hooks/useStreamChat.ts`
- **Issue:** Messages auto-delete every 5s
- **Impact:** Unnecessary processing
- **Fix:** Increase to 30s or use TTL

### 11. 🔴 HOST CHAT MODERATION STATE POLLING (1s)
- **File:** `src/hooks/useStreamChat.ts`
- **Issue:** Updates remaining time every 1s
- **Impact:** High re-render frequency
- **Fix:** Increase to 5s

### 12. 🔴 GAMING HEARTBEAT (15s)
- **File:** `src/hooks/useGamingHeartbeat.ts`
- **Issue:** Gaming heartbeat every 15s
- **Impact:** 100 gaming users = ~7 queries/second
- **Fix:** Increase to 30-60s

### 13. 🔴 OBS HEARTBEAT (15s)
- **File:** `src/hooks/useObsHeartbeat.ts`
- **Issue:** OBS heartbeat every 15s per broadcaster
- **Impact:** 50 broadcasters = ~3.3 queries/second
- **Fix:** Increase to 30-60s

### 14. 🔴 PERKS STATUS POLLING (60s)
- **File:** `src/hooks/usePerks.ts`
- **Issue:** Two separate 60s polling intervals for perks
- **Impact:** Redundant queries
- **Fix:** Consolidate into single interval

### 15. 🔴 FAMILY LEAGUES POLLING (60s)
- **File:** `src/hooks/useFamilyLeagues.ts`
- **Issue:** Polls family league season every 60s
- **Impact:** Unnecessary for most users
- **Fix:** Use Realtime or increase interval

### 16. 🔴 CUSTOMER SERVICE USERS POLLING (30s)
- **File:** `src/hooks/useCustomerServiceUsers.ts`
- **Issue:** Polls customer service users every 30s
- **Impact:** Only needed for CS users, but runs for all
- **Fix:** Conditional polling

### 17. 🟡 UNBOUNDED QUERY: `.limit(5000)`
- **File:** `src/pages/broadcast/BroadcastPage.tsx` (line 1486)
- **Issue:** Fetches up to 5,000 rows without pagination
- **Impact:** Memory and bandwidth explosion
- **Fix:** Add pagination

### 18. 🟡 NO VIEWER CAP ENFORCED IN FRONTEND
- **File:** `src/hooks/useBroadcastViewerCap.ts`
- **Issue:** Viewer cap settings exist in `admin_settings` table but are not enforced in the frontend viewer page
- **Impact:** Unlimited viewers can join a stream
- **Fix:** Enforce viewer cap in ViewerPage

### 19. 🟡 DUPLICATE SUBSCRIPTIONS ON REMOUNT
- **File:** `src/hooks/useBroadcastRealtime.ts`
- **Issue:** If component remounts (e.g., ErrorBoundary recovery), new channels are created without cleanup
- **Impact:** Channel leak
- **Fix:** Use singleton pattern (like `useGiftSystem`)

### 20. 🟡 `eventsPerSecond: 10` GLOBAL LIMIT
- **File:** `src/lib/supabase.ts` (line 22)
- **Issue:** Global Realtime events per second limited to 10
- **Impact:** During high-activity events (gifts, likes), events may be dropped
- **Fix:** Increase to 20-50 or make configurable

---

## G. EXACT FILES RESPONSIBLE

| # | Bottleneck | File | Line(s) |
|---|---|---|---|
| 1 | Per-card viewer count | `src/hooks/useViewerTracking.ts` | 140-220 |
| 2 | Broadcast viewer channels | `src/pages/broadcast/ViewerPage.tsx` | 1046, 2129 |
| 3 | Battle score polling | `src/hooks/useBattleRealtime.ts` | 273 |
| 4 | Streamer stats polling | `src/hooks/useStreamStats.ts` | 40-55 |
| 5 | Top gifters polling | `src/hooks/useStreamTopGifters.ts` | 25-45 |
| 6 | Live content polling | `src/contexts/LiveContentContext.tsx` | 165-175 |
| 7 | Active broadcasts polling | `src/hooks/useActiveBroadcasts.ts` | 40 |
| 8 | Auction timer 1s | `src/hooks/useAuctionTimer.ts` | 34, 99 |
| 9 | Chat flush 100ms | `src/hooks/useBroadcastRealtime.ts` | 295 |
| 10 | Chat auto-delete 5s | `src/hooks/useStreamChat.ts` | 210 |
| 11 | Host mod state 1s | `src/hooks/useStreamChat.ts` | 135 |
| 12 | Gaming heartbeat 15s | `src/hooks/useGamingHeartbeat.ts` | 104-105 |
| 13 | OBS heartbeat 15s | `src/hooks/useObsHeartbeat.ts` | 79 |
| 14 | Perks polling 60s | `src/hooks/usePerks.ts` | 36, 74 |
| 15 | Family leagues 60s | `src/hooks/useFamilyLeagues.ts` | 234 |
| 16 | CS users polling 30s | `src/hooks/useCustomerServiceUsers.ts` | 198 |
| 17 | Unbounded 5000 limit | `src/pages/broadcast/BroadcastPage.tsx` | 1486 |
| 18 | No viewer cap enforcement | `src/hooks/useBroadcastViewerCap.ts` | N/A |
| 19 | Channel leak on remount | `src/hooks/useBroadcastRealtime.ts` | 80-300 |
| 20 | eventsPerSecond: 10 | `src/lib/supabase.ts` | 22 |

---

## KEY FINDINGS SUMMARY

1. **Single Supabase client, single WebSocket** — All Supabase Realtime channels share one WebSocket connection per browser tab. However, each channel adds memory and processing overhead.

2. **No hard viewer cap enforced** — The `admin_settings` table has `broadcast_viewer_cap_max` (default: 10) and `broadcast_start_cap_max` (default: 10), but these are only used in admin UI, not enforced in the viewer page.

3. **No platform-wide rate limiting** — The `check_rate_limit` RPC exists but is not called from the frontend.

4. **Supabase Pro plan limits** — The project URL (`gejtbllazzighxwxudyu.supabase.co`) suggests a standard Supabase project. Pro plan typically supports:
   - ~500 concurrent Realtime connections
   - ~200-600 pooled database connections
   - ~5,000-10,000 rows/second read throughput

5. **The breaking point is ~2,000-3,000 concurrent users** based on:
   - ~2,000+ Supabase Realtime channels
   - ~200+ LiveKit WebSockets
   - ~500+ polling intervals
   - ~10,000+ DB queries/minute

6. **The single biggest win** would be eliminating per-card viewer count subscriptions (#1) and consolidating broadcast viewer channels (#2), which alone would reduce channel count by ~50%.
