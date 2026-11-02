# MaiCam Connect — Implementation Plan

**Goal:** One MaiTroll account. One phone. One PC. One secure WebRTC connection. Phone camera/mic usable in Web Broadcast, HytroGame, and Podcast. No separate app, no separate auth, no changes to existing features.

---

## 0. Architecture decision (validate first)

**RTC transport: LiveKit reuse (recommended) over separate WebRTC.**

Rationale:
- LiveKit is already the production RTC provider for broadcasting (`livekit-token` edge function, `livekit-client` SDK).
- `SetupPage` already wraps `getUserMedia` tracks into `LocalAudioTrack`/`LocalVideoTrack` and publishes them to a LiveKit room.
- Reusing LiveKit avoids "mixing incompatible RTC architectures" and preserves existing Agora/LiveKit sessions.
- Signaling/auth is already handled server-side in the `livekit-token` edge function (JWT with `canPublishSources: [camera, microphone]`).
- TURN/STUN/NAT traversal is handled by LiveKit cloud (already configured via `VITE_LIVEKIT_URL`).

**Design:** The phone joins a dedicated LiveKit room as a *publisher* (camera + microphone). The PC joins the same room as a *subscriber* (or the PC's MaiCam receiver renders the remote track). MaiCam then exposes the received `MediaStream` to Web Broadcast / HytroGame / Podcast as a camera source, by feeding the remote track into the existing `streamStore.cameraTrack` path (or an equivalent track source) so the existing publishing pipeline is unchanged.

**Fallback:** If LiveKit cannot be used for the phone↔PC link, `simple-peer` (already installed) is the secondary P2P WebRTC option, signaled over Supabase Realtime. Do not implement both simultaneously.

---

## 1. Database migrations (new tables only, additive)

Create timestamped `.sql` migration files at repo root (matching existing convention, e.g. `2026XXXXXXXXXX_add_maicam_tables.sql`):

```sql
-- maicam_devices
create table if not exists maicam_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  device_type text not null check (device_type in ('phone','desktop','tablet')),
  browser_name text,
  last_connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- maicam_pairing_codes
create table if not exists maicam_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,           -- bcrypt/argon2 hash of the short code
  originating_device_id uuid references maicam_devices(id),
  intended_role text not null check (intended_role in ('phone','desktop')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

-- maicam_sessions
create table if not exists maicam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_device_id uuid references maicam_devices(id),
  desktop_device_id uuid references maicam_devices(id),
  livekit_room_name text,            -- room used for the media connection
  status text not null default 'pending' check (status in ('pending','connected','disconnected','expired','revoked')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- maicam_preferences
create table if not exists maicam_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_camera text default '720p',
  preferred_fps integer default 30,
  preferred_mic boolean default true,
  mirror_preview boolean default false,
  battery_friendly boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS (enable on all)
alter table maicam_devices enable row level security;
alter table maicam_pairing_codes enable row level security;
alter table maicam_sessions enable row level security;
alter table maicam_preferences enable row level security;

-- Policies: users can only see/modify their own rows
create policy maicam_devices_own on maicam_devices for all using (auth.uid() = user_id);
create policy maicam_pairing_codes_own on maicam_pairing_codes for all using (auth.uid() = user_id);
create policy maicam_sessions_own on maicam_sessions for all using (auth.uid() = user_id);
create policy maicam_preferences_own on maicam_preferences for all using (auth.uid() = user_id);
```

Add indexes on `user_id`, `code_hash` (unique-ish), `expires_at`, `status`, `livekit_room_name`. Add a cleanup RPC or scheduled job for expired codes/abandoned sessions (out of scope for MVP; note as TODO).

Environment variables needed (add to `env.example`, never commit real secrets):
- `VITE_MAICAM_LIVEKIT_ROLE` (optional) — no new secrets required if reusing LiveKit.

---

## 2. Edge functions (supabase/functions/maicam/*)

Add these under `supabase/functions/maicam/` following the `livekit-token` pattern (CORS via `_shared/cors.ts`, verify JWT via anon key, service-role client for DB writes):

1. `generate-code` — POST. Auth required. Creates a single-use pairing code (e.g. 6-char alphanumeric), hashes it (bcrypt via edge function or store a server-generated secret), sets `expires_at = now + 5 min`, stores `intended_role`, returns the plaintext code **once** to the caller. Atomic insert + return.
2. `consume-code` — POST. Auth required. Accepts `code`. Atomic claim: update `consumed_at` where `code_hash` matches, `expires_at > now`, `consumed_at is null`, `revoked_at is null`, `user_id = auth.uid()`. Return the target device id / session id. Use `UPDATE ... RETURNING` with a `WHERE consumed_at IS NULL` for atomicity.
3. `revoke-code` / `revoke-session` — POST. Auth required. Marks code/session revoked.
4. `devices` — GET/DELETE. List user's maicam_devices; delete (revoke) one.

Rate limiting: implement a simple in-function counter or rely on Supabase rate limits; note failed-attempt restrictions in the plan.

Signaling: use Supabase Realtime channel `maicam:session:<sessionId>` for pairing status + WebRTC signaling (SDP/ICE candidates). Restrict channel access via RLS/presence or validate join server-side. **Never put video/audio in Realtime.**

---

## 3. Shared MaiCam connection manager (src/lib/maicam/)

Adapt to existing naming (zustand + service modules):

- `src/lib/maicam/MaiCamProvider.tsx` — React provider mounted at app level (in `App.tsx` or `AppLayout`) so connection state survives navigation. Holds: connection state enum, `MediaStream | null` (received phone stream), local phone sender track, pairing session id, quality settings, device list.
- `src/lib/maicam/MaiCamConnectionManager.ts` — orchestrates pairing, LiveKit connect/disconnect, reconnect logic, track cleanup.
- `src/lib/maicam/MaiCamSender.ts` — phone side: `getUserMedia`, create LiveKit local tracks, publish to room.
- `src/lib/maicam/MaiCamReceiver.ts` — PC side: subscribe to remote tracks, expose `MediaStream`.
- `src/lib/maicam/MaiCamDeviceSelector.ts` — front/rear camera, mic selection UI logic.
- `src/lib/maicam/MaiCamSessionService.ts` — Supabase CRUD for devices/sessions/codes.
- `src/lib/maicam/MaiCamSignalingService.ts` — Supabase Realtime signaling channel wrapper.
- `src/lib/maicam/useMaiCam.ts` — hook consuming the provider/state.

State persisted in the provider (in-memory + sessionStorage for lightweight reconnect), NOT inside page components.

---

## 4. Phone entry (Option 1 on mobile homepage)

**File:** `src/phone/pages/PhoneHomepage.tsx` — add two entry buttons near the top (not replacing existing social links):
- "MaiCam Connect" → `/phone/maicam` (or a maicam phone route)
- "Enter MaiTroll" → existing behavior

Add `localStorage` preference `maicam_entry_preference` ('maicam' | 'maitroll') remembered where appropriate. No redirect loops. Desktop visitors (App.tsx) keep the regular homepage — the phone homepage is only served via `PhoneApp` (mobile routes), so no change needed there.

Add phone routes:
- `/phone/maicam` — MaiCam mobile entry (auth gate → pairing → camera UI)
- `/phone/maicam/camera` — connected camera control UI

---

## 5. Mobile MaiCam interface (src/phone/pages/maicam/)

- `PhoneMaiCamEntry.tsx` — sign-in gate (reuse existing PhoneAuth flow), then pairing: enter PC-generated code OR generate phone code. Calls edge functions.
- `PhoneMaiCamCamera.tsx` — large camera preview (`video` element with `srcObject`), aspect-ratio preserved, no distortion. Controls: switch camera, mic toggle, video toggle, quality settings (480p/720p/1080p, 15/24/30/60 FPS, auto), mirror preview, connection status, latency, mic level meter, battery-friendly mode. Bottom actions: Disconnect, Return to MaiTroll. Header: MaiCam Connect logo, connection status, disconnect. Wake lock where supported. Warning about lock/backgrounding (esp. iOS). Portrait + landscape. Large touch-friendly buttons, MaiTroll neon colors (`#39FF14`, `#00BFFF`, `#BF00FF`).

---

## 6. Desktop More tab — MaiCam Connect

**File:** `src/components/nav/MorePagesPanel.tsx` — add a "MaiCam Connect" entry (category 'All Pages' or 'Tools & Help'), path `/maicam` (or open a modal). Icon: `Video` or `Smartphone` from lucide.

Add desktop route `/maicam` under `<RequireAuth />` in `App.tsx` → `MaiCamDesktopPage.tsx`.

Desktop page layout (left/center/right/bottom):
- Left: connected devices, pairing controls (Generate Pairing Code / Enter Pairing Code), connection status.
- Center: large live camera preview from phone.
- Right: camera settings, mic controls, resolution, connection quality, device info.
- Bottom: Connect / Disconnect / Reconnect / source controls.
- Device management section: device name, type, last connection, status, remove/disconnect/reconnect.

Responsive (desktop/laptop/tablet). No changes to sidebar/More/nav/modals.

---

## 7. Web Broadcast integration

**File:** `src/pages/broadcast/SetupPage.tsx` — add "MaiCam Connect — <device>" to the existing camera selection (next to Default Webcam / External USB Camera). When selected:
- Use `MaiCamProvider.getStream()` (the received phone MediaStream) as the video source.
- Preserve separate PC mic option.
- Feed MaiCam video track + selected audio track into the existing LiveKit publishing path (`publishSetupTracksToRoom` / `streamStore.cameraTrack`).
- Preserve all existing controls, permissions, Agora/LiveKit publishing, viewer playback, battles, gifts, chat, stats, recording.
- Switching back to PC webcam restores the previous `cameraTrack`.

Do not start a second broadcast merely because MaiCam connects.

---

## 8. HytroGame integration

**File:** `src/pages/gaming/HytroGaming.tsx` (and/or gaming setup) — add MaiCam as a selectable camera source where HytroGame supports live camera/mic input. If HytroGame has no external camera-source interface, add the smallest compatible one (a source picker + preview) without replacing the gameplay architecture. Preserve game sessions, multiplayer logic, lobbies, UI, coin balances, rewards, leaderboards. Avoid duplicate audio. Avoid reconnecting MaiCam across pages.

---

## 9. Podcast integration

**Files:** `src/pages/PodcastCentral.tsx`, `src/pages/PodcastRoom.tsx`, `src/hooks/usePodcastAgora.ts`.

Podcast currently uses Agora audio. Add MaiCam as an available video + mic source for the host:
- Host may select MaiCam camera; existing PC microphones remain available.
- Independent camera/mic selection (phone video + PC mic, phone video + phone mic).
- Mute either input. Avoid publishing two mic tracks (prevent duplicates/feedback).
- Preserve podcast recording, streaming, guests, audio mixing.
- Recording uses the selected media tracks.
- Phone disconnection: show camera unavailable, preserve recording session, restore tracks when possible; don't corrupt recording.
- MaiCam behaves as one selectable source, not an extra participant.

---

## 10. USB support (Phase B — document only, do not fake)

Wireless is Phase A and fully functional. For USB:
- Add a "Connection mode: Wireless / USB" selector where USB is shown as **not universally supported** by browsers.
- Where a phone exposes itself as a native USB webcam, the normal camera selector (`navigator.mediaDevices.enumerateDevices`) will already list it; document this.
- Do not present wired MaiCam transport as working without a native companion component. Mark as future optional feature.

---

## 11. Connection states & recovery

States: `Disconnected | GeneratingCode | WaitingForPairing | Pairing | AwaitingPermission | Connecting | Connected | Reconnecting | ConnectionFailed | PermissionDenied | SessionExpired`.

- Detect LiveKit disconnection (`room.state === 'disconnected'`), show Reconnecting, safe reconnect (same session/room), avoid duplicate sessions.
- Keep public broadcast state separate from MaiCam session state.
- On broadcast: if phone disconnects during broadcast, do not crash or end the broadcast — preserve published session, show "camera unavailable", restore tracks when possible, offer manual reconnect or fall back to another camera.
- On unrecoverable failure: show useful message, allow selecting another camera.

---

## 12. Device management

In desktop MaiCam page: list `maicam_devices` (name, type, last connection, status). Actions: Remove device (revoke), Disconnect, Reconnect. Revoking invalidates the active session. Browser permissions remain under OS/browser control — no persistent camera access granted solely by prior pairing.

---

## 13. Audio quality & feedback prevention

- Independent camera & mic selection.
- Support phone video + PC mic; phone video + phone mic.
- Mute either input.
- Never publish two mic tracks (coordinate via MaiCamProvider).
- Phone must NOT play PC mic audio through its speakers (PC side renders remote audio muted or to a non-speaker output; MaiCam receiver audio element muted by default on phone).
- Echo cancellation/noise suppression via getUserMedia constraints (`echoCancellation: true, noiseSuppression: true, autoGainControl: true`).

---

## 14. Tests

Add tests under `src/test/` (vitest + @testing-library/react) for security-critical behavior:
- Pairing code atomic single-use claim (two concurrent consumes → one succeeds).
- Expired code rejected.
- Consumed code rejected.
- Revoked session cannot reconnect.
- Cross-account pairing rejected (user A's code cannot be consumed by user B).
- RLS: user cannot read another user's `maicam_devices`/`maicam_sessions`.

Run `npm run lint` and `npm run build` to ensure no regressions. Existing tests must continue passing.

---

## 15. Implementation order (iterative)

1. **Migrations + edge functions** (pairing codes, sessions, devices). Verify with Supabase.
2. **MaiCamProvider + connection manager** (LiveKit-based sender/receiver, pairing flow, reconnect).
3. **Phone entry + mobile UI** (PhoneHomepage buttons, maicam routes, camera UI, permissions).
4. **Desktop More tab + `/maicam` page** (entry from More, pairing, preview, device management).
5. **Web Broadcast integration** (camera source picker in SetupPage, feed into existing LiveKit publish).
6. **HytroGame integration** (source picker + preview).
7. **Podcast integration** (source selection in PodcastRoom/Central).
8. **Tests + lint + build + regression check**.

---

## 16. Known limitations / incomplete items (require physical-device testing)

- iOS Safari WebRTC/LiveKit camera permission behavior and backgrounding — must be tested on a real iPhone.
- Android foreground service / browser backgrounding impact on media track — must be tested on real Android.
- Actual end-to-end latency and TURN fallback on cellular — measure, do not invent metrics.
- USB wired transport — explicitly NOT implemented as guaranteed; documented as Phase B / future.

---

## 17. What is NOT in scope (preserved)

- No changes to coin economy, gifting, battles, leaderboards, cashout.
- No replacement of LiveKit/Agora providers.
- No separate auth system.
- No removal of existing pages, RTC services, broadcasting workflows, or DB logic.
- No fake/mock camera feeds or simulated connection indicators.
- No video/audio persisted in database tables.
- No public URLs or logs containing pairing codes.
