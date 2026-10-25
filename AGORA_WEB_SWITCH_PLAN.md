# Agora Switch Plan — Web BroadcastPage + ViewerPage (+ SetupPage)

**Status:** Plan only — no code changes made yet.
**Scope:** Web only. Phone pages, other web pages, and all other LiveKit usage remain untouched.

---

## Goal

Replace LiveKit with Agora on exactly three web files:

1. `src/pages/broadcast/SetupPage.tsx` — request Agora token, connect Agora room, publish local tracks (camera + mic), store tracks in `PreflightStore` for reuse by BroadcastPage.
2. `src/pages/broadcast/BroadcastPage.tsx` — broadcaster reuses SetupPage's Agora room/tracks OR connects its own Agora room as publisher; audience joins as subscribers.
3. `src/pages/broadcast/ViewerPage.tsx` — audience subscriber connects to Agora room, renders remote video/audio.

After completion: **LiveKit must not be imported or used in these three web files.** LiveKit remains in use for phone pages and every other web page.

---

## Quality / Cost constraints (user-specified)

- **Resolution:** 720p only (1280x720). No 1080p/Full HD, no 2K.
- **Bitrate:** Mid-tier encoder config (~1500 kbps video, standard speech audio). Avoid high-bitrate tiers to keep Agora minutes/bandwidth cost low.
- **Rationale:** 720p + mid bitrate keeps cost closer to the lower Agora HD tier and reduces lag on weaker connections.

---

## Files to change

### 1. `src/hooks/useAgoraRoom.ts` (extend — already exists)

Current hook (~405 lines) supports join/leave/toggle camera-mic/publisher role. It needs a **LiveKit-compatible interface** so BroadcastPage and ViewerPage can swap in with minimal page-level rewiring:

Add/expose:
- `join(channelName, userId, role)` — connect to Agora channel, fetch token from `agora-token` Supabase edge function (body: `{ channel, userId, tokenType: 'rtc', role }`), convert `userId` to numeric UID (hash), create client `{ mode: 'rtc', codec: 'vp8' }`, enable 720p/mid-bitrate track constraints.
- `leave()` — unpublish, stop/close tracks, leave channel, reset state.
- `publishLocalTracks(audioTrack, videoTrack)` — publish local camera/mic tracks with 720p/mid-bitrate encoder config.
- `remoteUsers` — list of remote users with published tracks.
- `onUserJoined` / `onUserLeft` / `onUserPublished` / `onUserUnpublished` callbacks.
- `isConnected`, `isPublishing`, `error`, `isJoining`.
- Reconnection logic on `connection-state-change` (disconnected → reconnect with retry, mirroring LiveKit's reconnect behavior).
- `toggleCamera()` / `toggleMicrophone()`.
- Cleanup on unmount.

Keep lazy-loading of `agora-rtc-sdk-ng` (~2MB) so it's not bundled for non-video users.

### 2. New/updated token helper

- `src/lib/agoraToken.ts` (new) — mirror `src/lib/livekitToken.ts`:
  - `requestAgoraToken(channelName, userId, role)` → invokes `supabase.functions.invoke('agora-token', { body: { channel, userId, tokenType: 'rtc', role } })`.
  - Normalize response to `{ token, channelName, uid }`.
  - Confirm the `agora-token` edge function exists in `supabase/functions/`; if not, create it (same pattern as `livekit-token`).

### 3. `src/pages/broadcast/SetupPage.tsx`

- Remove `livekit-client` imports (`LocalAudioTrack`, `LocalVideoTrack`, `Room`, `Track`), `requestLiveKitToken`, `VITE_LIVEKIT_URL` usage.
- Import `useAgoraRoom` and `requestAgoraToken`.
- Replace `BroadcastStartStage` strings referencing LiveKit with Agora equivalents.
- Replace `livekitRoomRef` → `agoraRoomRef` (or reuse the hook's internal ref).
- Replace `livekitTracks` state → `agoraTracks` (local audio/video `ILocalAudioTrack` / `ILocalVideoTrack`).
- `acquireMediaStream()`: wrap native `MediaStreamTrack` into Agora tracks via `AgoraRTC.createCameraVideoTrack` / `AgoraRTC.createMicrophoneAudioTrack` with 720p + `bitrate: 1500`, `AEC/ANS/AGC` enabled.
- Token stage: call `requestAgoraToken(roomName, user.id, 'publisher')` instead of `requestLiveKitToken`.
- Connect stage: call hook's `join(channelName, userId, 'publisher')` instead of `room.connect(livekitUrl, token)`.
- Publish stage: call hook's `publishLocalTracks()` instead of `room.localParticipant.publishTrack()`.
- Store tracks in `PreflightStore` under Agora keys (e.g. `setAgoraTracks`) so BroadcastPage can adopt them. Keep the same store-shape contract BroadcastPage expects, just Agora-typed.
- Remove all `VITE_LIVEKIT_URL` checks (`hasLiveKitUrl`).
- Keep the `bunny-live-start` invocation (that's separate from RTC).

### 4. `src/pages/broadcast/BroadcastPage.tsx`

- Remove `livekit-client` imports (`Room`, `RoomEvent`, `LocalVideoTrack`, `LocalAudioTrack`, `RemoteParticipant`, `RemoteVideoTrack`, `RemoteAudioTrack`, `RemoteTrackPublication`, `VideoPresets`, `Track`, `createLocalTracks`) and `getLiveKitRoomName`.
- Import `useAgoraRoom` and `requestAgoraToken`.
- Replace `normalizeLiveKitIdentity` with Agora UID normalization (numeric hash → string).
- Replace `useLiveKitRoom` (if used) with `useAgoraRoom`.
- Replace `getLiveKitUrl()` / `VITE_LIVEKIT_URL` with `VITE_AGORA_APP_ID` check + `requestAgoraToken`.
- Replace `room.connect(livekitUrl, token)` with `join(channelName, userId, role)`.
- Replace `attachLiveKitHandlers`/`detachLiveKitHandlers` (RoomEvent.ParticipantConnected/Disconnected/TrackPublished/Subscribed/Unsubscribed) with Agora client events (`user-joined`, `user-left`, `user-published`, `user-unpublished`, `connection-state-change`).
- Replace `disconnectLiveKitRoom()` with `leaveChannel()`.
- Replace `RemoteParticipant`/`RemoteVideoTrack`/`RemoteAudioTrack` handling in the audience/video-rendering logic with Agora `IAgoraRTCRemoteUser` and remote tracks; use `AgoraRTC.createBufferSourceAudioTrack`/`createCustomVideoTrack` or subscribe via `client.subscribe(user, mediaType)` and `track.attach(videoEl)` / `track.play(element)`.
- Replace `userIdToLiveKitIdentity` map with `userIdToAgoraUid` map.
- Tab-visibility reconnect: use Agora reconnect instead of LiveKit reconnect.
- Preflight adoption: read Agora tracks from `PreflightStore` (set by SetupPage) instead of LiveKit tracks.
- Two paths:
  - **Broadcaster (host):** publisher role, joins as publisher, publishes camera+mic at 720p/mid-bitrate.
  - **Audience (viewer on broadcast page):** subscriber role, joins as subscriber, renders remote tracks.

### 5. `src/pages/broadcast/ViewerPage.tsx`

- Remove `livekit-client` imports and `useLiveKitRoom`; import `useAgoraRoom` + `requestAgoraToken`.
- Replace `getTrackId`/`getMediaStreamTrack`/`getVideoTrackFromParticipant`/`getAudioTrackFromParticipant` (LiveKit `RemoteTrackPublication`-centric) with Agora remote-user track equivalents.
- Replace `room.on(RoomEvent.TrackSubscribed/Unsubscribed, bump)` track-tick logic with Agora `user-published`/`user-unpublished` tick.
- Replace `useLiveKitRoom({...})` call with `useAgoraRoom({ channelName, userId, role: 'subscriber', ... })`.
- Replace `room.connect`/`publishLocalTracks`/track attach/detach with Agora equivalents (`track.attach(videoEl)` / `track.stop()`).
- Replace `getLiveKitRoomName` with Agora channel name derivation (`stream.agora_channel || stream.id`).

### 6. `src/lib/liveUtils.ts` (optional additive)

- Add `getAgoraChannelName(stream, streamId)` returning `stream.agora_channel || stream.id || streamId`.
- Leave `getLiveKitRoomName`/`getRTCProvider` as-is (other pages still use them). Do NOT flip `getRTCProvider` to return 'agora' globally — only these three pages switch.

---

## PreflightStore contract (keep stable)

SetupPage writes tracks; BroadcastPage reads them. Keep the same shape but Agora-typed:

```
PreflightStore.setAgoraTracks([localAudioTrack, localVideoTrack])
PreflightStore.getAgoraTracks() -> [ILocalAudioTrack | null, ILocalVideoTrack | null]
PreflightStore.setAgoraConnected(boolean)
PreflightStore.getAgoraConnected()
```

BroadcastPage adopts them instead of creating its own room when a SetupPage session exists (same "adopt transferred room" pattern as today, just Agora).

---

## Environment variables to verify

- `VITE_AGORA_APP_ID` — must be set (used by `useAgoraRoom`).
- `VITE_LIVEKIT_URL` — no longer needed by these three pages, but leave it defined (other pages still use it).
- Confirm `agora-token` Supabase edge function is deployed and accepts `{ channel, userId, tokenType, role }` and returns `{ token }`.

---

## What does NOT change (out of scope)

- Phone pages (`PhoneBroadcastPage.tsx`, `PhoneViewerPage.tsx`, `PhoneGoLive.tsx`) — stay on LiveKit.
- All other web pages using LiveKit — stay on LiveKit.
- `useLiveKitRoom.ts`, `livekitToken.ts`, `livekitUrl.ts` — remain for other consumers.
- `bunny-live-start`, chat, gifts, seats, moderation, captions, overlays — keep working via Supabase/realtime; only the RTC transport changes.
- Database `rtc_provider` / `livekit_room_name` columns — no schema change required for this scope (read `agora_channel` if present, fall back to stream id).

---

## Acceptance criteria (when done)

1. `livekit-client` is not imported in `SetupPage.tsx`, `BroadcastPage.tsx`, `ViewerPage.tsx`.
2. `requestLiveKitToken`, `getLiveKitUrl`, `VITE_LIVEKIT_URL`, `useLiveKitRoom` are not referenced in these three files.
3. SetupPage requests an Agora token via `requestAgoraToken` → `agora-token` edge function, connects, publishes 720p/mid-bitrate tracks, stores them in `PreflightStore`.
4. BroadcastPage connects as publisher (host) or subscriber (audience) via `useAgoraRoom`, reuses SetupPage's Agora tracks when available.
5. ViewerPage connects as subscriber via `useAgoraRoom`, renders remote video/audio at 720p.
6. Room disconnect/cleanup uses `leaveChannel()` on unmount/stream end.
7. Tab-visibility/reconnect uses Agora reconnect.
8. `npm run lint` and `tsc --noEmit` pass (typecheck) for the three changed files.
9. LiveKit still functions on phone and all other web pages (no regressions there).

---

## Estimated effort

~5–8 days for one experienced frontend engineer (down from the full 2–3 week all-platform estimate because scope is cut to web BroadcastPage + ViewerPage + SetupPage only, and existing `useAgoraRoom`/`agora-token` logic is reused).

---

## Next step (after plan approval)

Edit `src/hooks/useAgoraRoom.ts` to add the LiveKit-compatible surface, create `src/lib/agoraToken.ts`, then edit SetupPage → BroadcastPage → ViewerPage in order, one file at a time, verifying each before moving to the next. No changes made yet — awaiting your go-ahead.
