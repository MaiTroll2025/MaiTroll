# MaiTroll RTC, Phone, Realtime, and Infrastructure Cost Audit

**Audit date:** 2026-09-07  
**Scope:** phone broadcast/viewer pages, all stream/viewer paths, Hytro games, LiveKit, Agora, Supabase Realtime/database/functions, chats, gifts, and the explicit no-egress requirement.

## Executive Answer

The application has three different realtime layers:

1. **LiveKit:** primary broadcast video/audio, phone broadcast/viewer, battles, calls, court/church/stage rooms, and other live rooms.
2. **Agora:** Hytro game viewers and several legacy/specialized rooms; Agora also supports OBS/RTMP ingress paths.
3. **Supabase Realtime:** chat, gifts, likes, presence, stream state, seats, notifications, battles, and application data synchronization.

A normal live viewer is generally:

- **1 LiveKit participant connection** for ordinary broadcasts, or **1 Agora RTC participant** for Hytro.
- **Several Supabase Realtime channels** for chat, presence, gifts, stream state, and UI state.
- **No LiveKit egress job** in the active frontend path. I found no active `StartRoomCompositeEgress`, `StartTrackCompositeEgress`, HLS egress, or recording-export lifecycle in the scanned TypeScript.

The repository cannot tell us the number of actual production users, peak concurrent users, RTC minutes, Realtime messages, or current invoice totals. Those must come from LiveKit Cloud, Agora Console, Supabase Usage/Billing, and application telemetry. This document gives the code-derived unit model and formulas to turn those dashboard numbers into an exact monthly cost.

## Current Plan Cost Baseline

Pricing below is based on the provider pricing pages checked on the audit date. Provider pricing can change; use the billing dashboards as the final authority.

| Service | Assumed plan | Fixed monthly cost | Included usage relevant here | Overage used in estimates |
|---|---:|---:|---|---:|
| Supabase | Pro | **$25/mo** | 500 peak Realtime connections, 5M Realtime messages, 2M Edge Function invocations, 100k MAU, 250GB project egress, 100GB file storage | Realtime connections $10/1,000 over; messages $2.50/M over; Edge Functions $2/M over; MAU $0.00325/MAU over |
| LiveKit Cloud | Ship | **$50/mo** | 1,000 concurrent connections, 150,000 WebRTC participant minutes, 250GB downstream transfer | $0.0005 per WebRTC participant-minute over; $0.12/GB downstream over |
| Agora RTC | Free | **$0/mo** | 10,000 combined RTC minutes/month | $0.59/1,000 RTC minutes over, based on published starting price |

### Fixed monthly floor

With one Supabase Pro project and one LiveKit Ship project, before overages:

```text
$25 Supabase Pro + $50 LiveKit Ship + $0 Agora Free = $75/month
```

This excludes domain, Vercel, PayPal fees, email/SMS, storage beyond included limits, taxes, and any provider add-ons.

## What Counts as a Minute

### LiveKit

LiveKit bills a **participant minute**: one participant connected for one minute. It is not one minute per audio/video track.

Examples:

- 1 host + 100 viewers for 60 minutes = 6,060 participant-minutes.
- 1 host + 100 viewers for 60 minutes with no egress = still 6,060 participant-minutes.
- A viewer subscribing to host camera, screen, and audio is still one LiveKit participant connection.
- A seat guest who publishes camera/mic remains one participant; publishing more tracks does not multiply participant minutes.

Formula:

```text
LiveKit participant-minutes = sum of connected participant minutes across all rooms
LiveKit overage = max(0, participant-minutes - 150,000) * 0.0005
LiveKit monthly estimate = 50 + LiveKit overage + downstream-transfer-overage
```

### Agora

Agora's published RTC unit is also participant usage measured in minutes. Hytro's multiple subscribed tracks do not automatically mean four billable users; the viewer is one RTC participant, while track count affects bandwidth and device load.

Formula:

```text
Agora overage = max(0, Agora RTC minutes - 10,000) / 1,000 * 0.59
Agora monthly estimate = Agora overage
```

Confirm the exact media profile and any RTMP/media-gateway charges in Agora Console. OBS ingress is not the same thing as egress, but gateway/transcoding products can have separate billing.

### Supabase

Supabase does not bill this application by RTC minute. Supabase cost is driven mainly by:

- Peak simultaneous Realtime connections.
- Realtime messages.
- Edge Function invocations.
- Database compute and storage.
- Project/file egress.
- Auth monthly active users.

## Code-Derived Connection Audit

### Phone pages

| Phone path | RTC provider | RTC connections per active page | Supabase/realtime behavior | Notes |
|---|---|---:|---|---|
| `src/phone/pages/PhoneBroadcastPage.tsx` | LiveKit | 1 publisher | Explicit stream channel plus shared hooks for stream, chat, presence, seats, gifts, and broadcast state | Phone broadcaster publishes audio/video through the shared LiveKit path |
| `src/phone/pages/PhoneViewerPage.tsx` | LiveKit | 1 audience connection; seat promotion reuses/upgrades it | Explicit stream channel, floating chat, gift/stream/presence/seat channels plus shared hooks | Normal viewer does not publish local tracks; cleanup calls leave/disconnect paths |
| `src/phone/pages/PhoneHytroGameViewer.tsx` | Agora | 1 subscriber | Floating chat channel and stream/game state reads | Hytro viewer subscribes to screen video, camera video, microphone audio, and game audio tracks |
| `src/phone/pages/PhoneHomepage.tsx` | None on discovery page | 0 | Fetches/discovers live items; navigates to viewers | Does not itself join RTC rooms |
| `src/phone/pages/PhoneChat.tsx` | None | 0 | Supabase/Utromail thread subscriptions and message queries | Messaging cost is database/Realtime usage, not RTC |
| `src/phone/pages/PhoneGoLive.tsx` | LiveKit | 1 publisher after room connect | Setup and stream state queries | Creates the phone live room and publishes media |

### Main web/desktop stream paths

| Path | Provider | Connection model |
|---|---|---|
| `src/pages/broadcast/BroadcastPage.tsx` | LiveKit | 1 publisher; seats use the same room model |
| `src/pages/broadcast/ViewerPage.tsx` | LiveKit | 1 audience connection; seat promotion reuses the room |
| `src/pages/StreamSwipePage.tsx` + `src/components/broadcast/StreamSwipeCard.tsx` | LiveKit | Normally 1 active viewer room; rapid swipe can briefly overlap async join/leave |
| `src/components/broadcast/BattleSwipeCard.tsx` | LiveKit | Same direct viewer-room pattern during active card |
| `src/pages/broadcast/LiveKitGameViewer.tsx` | LiveKit | Separate LiveKit game viewer implementation when `livekit_room_name` is present |
| `src/pages/gaming/HytroGamingViewer.tsx` | Agora | 1 Agora subscriber through `useAgoraGamingViewer` |
| `src/pages/church/ChurchLivePage.tsx`, `PastorDashboard.tsx` | LiveKit | Live room participants |
| `src/pages/Call.tsx` | LiveKit | Call room participants |
| `src/pages/JailVisitRoom.tsx` | LiveKit | Visit room participants |
| `src/pages/TrollCourtSession.tsx` | LiveKit | Court session participants |
| `src/pages/tcnn/TCNNBroadcasterPage.tsx`, `TCNNViewerPage.tsx` | LiveKit | Broadcaster/viewer room participants |
| `src/pages/auction/LiveAuctionRoom.tsx`, `AuctioneerDashboard.tsx` | Agora | Specialized auction RTC path |
| `src/pages/CourtRoom.tsx`, `CourtViewerPage.tsx` | Agora | Specialized court RTC path |
| `src/pages/PodcastRoom.tsx` | Agora | Audio room |
| `src/components/TeamMeetingRoom/*` | Agora | Meeting RTC |
| `src/hooks/useStaffWalkieTalkie.ts` | Agora | Joins only when walkie-talkie is actively used; provider is mounted globally but does not join automatically |

## Per-User RTC Cost Scenarios

These examples use the current plan allowances and exclude downstream transfer overage. They are estimates, not invoice values.

### LiveKit Ship examples

| Connected participants | Session length | Participant-minutes | Included? | Estimated LiveKit charge |
|---:|---:|---:|---|---:|
| 1 host + 10 viewers | 60 min | 660 | Yes | $50 monthly base only |
| 1 host + 100 viewers | 60 min | 6,060 | Yes | $50 monthly base only |
| 1 host + 500 viewers | 60 min | 30,060 | Yes | $50 monthly base only |
| 1 host + 1,000 viewers | 60 min | 60,060 | Yes, under 150k monthly if alone | $50 monthly base only |
| 1 host + 1,000 viewers, 3 hours | 180 min | 180,180 | 30,180 over | $50 + **$15.09** participant overage |
| 1,000 concurrent participants for 24 hours | 1,440 min | 1,440,000 | 1,290,000 over | $50 + **$645** participant overage |

Per connected participant-minute after the included allotment, the LiveKit overage assumption is **$0.0005**, or **$0.50 per 1,000 participant-minutes**.

### Agora Hytro examples

| Hytro connected participants | Session length | Agora RTC minutes | Included? | Estimated Agora charge |
|---:|---:|---:|---|---:|
| 1 viewer | 60 min | 60 | Yes | $0 |
| 100 viewers | 60 min | 6,000 | Yes | $0 |
| 200 viewers | 60 min | 12,000 | 2,000 over | **$1.18** |
| 1,000 viewers | 60 min | 60,000 | 50,000 over | **$29.50** |
| 1,000 viewers for 8 hours | 480 min | 480,000 | 470,000 over | **$277.30** |

The Agora estimate assumes standard Agora RTC billing and excludes any separately billed media gateway, recording, transcoding, or CDN product.

## Realtime and Application-Usage Model

### Ordinary LiveKit viewer

The older concurrency audit counted approximately **10-12 Supabase Realtime channels** for a full broadcast viewer, plus one LiveKit connection. The exact number varies by feature flags and whether battles, family activity, seats, gifts, notifications, or floating chat are mounted.

Common channels/hooks include:

- stream metadata/status changes
- broadcast event channel
- stream chat broadcast and presence
- viewer presence
- audience presence
- seats/seat events
- gift system channels
- chat moderation/lock state
- family activity
- floating chat on phone
- user profile/credit/nav channels from the global app shell

Important distinction: Supabase channel count is not the same as a separate physical TCP connection. Supabase multiplexes channels over client WebSocket connections, but every subscribed channel still contributes connection/subscription/message pressure.

### Broadcaster

A full broadcaster can use approximately **14-16 Supabase Realtime channels**, one LiveKit publisher connection, and more timers/heartbeats. Gaming or battle mode adds more Realtime broadcasts and may add an Agora path depending on the route.

### Chat

`src/hooks/useStreamChat.ts`:

- Loads recent messages from `stream_messages`.
- Uses Supabase broadcast for chat delivery.
- Uses presence for join/leave behavior.
- Limits local retained messages to 200.
- Uses short client timers for cleanup and moderation state.
- Sends message writes through the chat gate/RPC path.

Cost drivers are message count, payload size, database writes, and channel fanout. Chat does not add RTC minutes.

### Gifts

Gift flows use database/RPC writes plus Supabase broadcast/realtime events and client-side animation/overlay work. The media animation itself is frontend work; it does not create LiveKit or Agora minutes.

Cost drivers are:

- Gift transaction writes.
- Gift event fanout to viewers.
- Gift leaderboard/top-gifter reads and polling.
- Storage/CDN only when gift assets are fetched from Supabase storage/CDN.

A gift sent once in a room with 500 subscribed clients can create roughly one write plus fanout to those clients; it is not 500 separate gift transactions, but it can create significant Realtime message volume depending on implementation and payload size.

## Capacity Limits Based on Selected Plans

### Hard plan ceilings before overage

| Resource | Included plan capacity | Practical interpretation |
|---|---:|---|
| LiveKit concurrent connections | 1,000 on Ship | Do not plan above ~700-800 sustained connections without load testing and headroom |
| LiveKit participant minutes | 150,000/month on Ship | About 5,000 connected participants for 30 minutes/day across a 30-day month, or 104 average concurrent participants for the whole month |
| Supabase Realtime peak connections | 500 on Pro | This is the first likely bottleneck for a full-featured app shell with many channels; channels and app tabs must be measured |
| Supabase Realtime messages | 5M/month on Pro | Chat/gift/broadcast fanout can consume this faster than page views suggest |
| Supabase Edge Function invocations | 2M/month on Pro | Token endpoints, payment endpoints, notification sends, health checks, and other invokes count here |
| Supabase MAU | 100,000/month on Pro | Auth users beyond this add usage charges |
| Agora RTC minutes | 10,000/month free | Hytro and legacy Agora rooms share this allowance |

### Conservative operating targets

These are engineering targets, not provider guarantees:

- **LiveKit:** keep sustained peak at **700-800 connections** on Ship until a measured load test proves more is safe.
- **Supabase Realtime:** keep peak at **350-400 active connections** until the app shell and full viewer page are measured together.
- **Agora Free:** keep Hytro plus other Agora RTC usage under **8,000 minutes/month** to leave room for testing and legacy rooms.
- **No egress:** do not enable recording/export/room-composite/HLS egress. Remember that viewer downstream transfer is still normal RTC delivery and may be billed separately by LiveKit.

## Exact Monthly Cost Formula

Define:

```text
LK_MIN = LiveKit participant-minutes in the billing month
LK_GB = LiveKit downstream GB in the billing month
AG_MIN = Agora RTC participant-minutes in the billing month
SB_RT_CONN = Supabase peak concurrent Realtime connections
SB_RT_MSG = Supabase Realtime messages in the billing month
SB_EDGE = Supabase Edge Function invocations in the billing month
SB_MAU = Supabase monthly active users
SB_EGRESS_GB = Supabase project egress GB
```

Then, for the selected plans:

```text
LiveKit = 50
        + max(0, LK_MIN - 150000) * 0.0005
        + max(0, LK_GB - 250) * 0.12

Agora = max(0, AG_MIN - 10000) / 1000 * 0.59

Supabase = 25
          + max(0, SB_RT_CONN - 500) / 1000 * 10
          + max(0, SB_RT_MSG - 5000000) / 1000000 * 2.50
          + max(0, SB_EDGE - 2000000) / 1000000 * 2
          + max(0, SB_MAU - 100000) * 0.00325
          + max(0, SB_EGRESS_GB - 250) * 0.09
          + database/storage/other overages

Total infrastructure estimate = LiveKit + Agora + Supabase
```

With no overages and one project on each selected plan:

```text
Total = $75/month
```

## Production Numbers Still Required

These numbers are **not present in source code** and must be collected before calling the estimate an actual bill:

1. Unique authenticated users and MAU.
2. Peak simultaneous web/PWA/native users.
3. Peak LiveKit concurrent connections.
4. LiveKit participant-minutes and downstream GB.
5. Peak Agora concurrent users and RTC minutes.
6. Supabase Realtime peak connections and messages.
7. Supabase Edge Function invocations.
8. Supabase database size, compute usage, storage, and project egress.
9. Number of active rooms and average viewers per room.
10. Number of chat messages and gifts per minute at peak.
11. Number of app tabs/devices per user; duplicate tabs multiply RTC and Realtime usage.

## Queries and Dashboard Checks

### Supabase database activity

Run these in Supabase SQL Editor for application-side counts where the schema supports them:

```sql
-- Registered user count and profile count
select count(*) as auth_users from auth.users;
select count(*) as profiles from public.user_profiles;

-- Active/live rooms now
select count(*) as active_live_streams
from public.streams
where is_live = true or status = 'live';

-- Recent chat volume
select date_trunc('hour', created_at) as hour, count(*) as messages
from public.stream_messages
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- Recent gifts
select date_trunc('hour', created_at) as hour, count(*) as gift_rows
from public.gift_transactions
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;
```

Table names can differ for historical gift implementations; verify against the live schema before running the gift query.

### Provider dashboards

- **Supabase:** Organization Usage and Billing pages; check Realtime peak connections/messages, Edge Function invocations, database compute/storage, egress, and MAU.
- **LiveKit Cloud:** project usage/metrics; export participant minutes, concurrent connections, downstream transfer, and room/session counts.
- **Agora Console:** RTC usage; separate Hytro, auction, court, podcast, meeting, walkie, and any gateway/media services if channel labels are available.
- **App telemetry:** count active users by route and provider so a user opening phone viewer plus a desktop tab is counted as two RTC sessions.

## Findings and Risks

### 1. Supabase Realtime is likely to bottleneck before database storage

The full viewer page can subscribe to many channels. At 500 Pro peak connections, the app should not assume thousands of full-featured viewer pages are supported without reducing channel count, consolidating channels, or moving high-volume events to a more appropriate fanout path.

### 2. LiveKit Ship supports 1,000 concurrent connections, not unlimited users

The $50 plan can support many registered users over time, but the relevant real-time ceiling is concurrent connected participants and participant-minutes. A large audience can exhaust the included 150k minutes quickly even without egress.

### 3. Hytro is the Agora cost island

Hytro currently uses Agora through `useAgoraGamingViewer`, including the phone page. It is not billed through LiveKit. Keep a separate Agora-minute dashboard or label so Hytro does not silently consume the free allowance intended for testing or legacy rooms.

### 4. No egress is currently visible, but downstream transfer is not zero

No active egress job was found. That avoids recording/export/transcoding egress charges. However, live viewers still receive media from LiveKit, so LiveKit downstream transfer remains a relevant cost and capacity metric.

### 5. Duplicate tabs and swipe transitions need measurement

The shared LiveKit hook has join guards and cleanup, but direct swipe cards and rapid navigation can briefly overlap asynchronous join/leave work. A user with phone + desktop + another tab can consume multiple simultaneous RTC connections.

## Recommended Next Instrumentation

Add a server-side daily usage snapshot table or scheduled job that records:

```text
metric_date
provider
room_type
active_rooms_peak
concurrent_participants_peak
participant_minutes
realtime_connections_peak
realtime_messages
edge_function_invocations
chat_messages
gift_events
unique_users
```

Group by `provider` (`livekit`, `agora`, `supabase`) and `room_type` (`broadcast`, `hytro`, `battle`, `auction`, `court`, `podcast`, `call`, `walkie`, `jail_visit`). Without this, the application can estimate architecture capacity but cannot report actual costs per feature or per user.

## Bottom Line

For the selected plans, the known fixed floor is approximately **$75/month**. The practical starting envelope is approximately **1,000 LiveKit concurrent connections**, **500 Supabase Realtime connections**, and **10,000 Agora RTC minutes/month**, subject to the provider’s current account limits and application behavior.

The most important cost metric is not registered users; it is **connected participant-minutes**:

- LiveKit broadcast viewer: 1 LiveKit participant-minute per connected minute.
- Hytro viewer: 1 Agora RTC participant-minute per connected minute.
- Chat/gifts: Supabase message/write/fanout usage, not RTC minutes.
- No active egress path found; normal downstream delivery still counts toward LiveKit transfer.
