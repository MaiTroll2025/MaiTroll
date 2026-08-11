# Mux Integration Fix - Broadcast Start & Stop

## Problem Identified

When a broadcast was started, **Mux was never being contacted**. The database showed:
- `mux_stream_key`: NULL
- `mux_playback_id`: NULL  
- `mux_rtmp_url`: NULL

The Mux dashboard showed **no connection attempts at all**.

### Root Cause

The frontend (`SetupPage.tsx`) was creating a stream in the database but **never calling the backend** `/api/broadcasts/start-streaming` endpoint that initializes Mux.

## Solution Implemented

### 1. **SetupPage.tsx** - Added Mux Initialization Call

**Location:** `src/pages/broadcast/SetupPage.tsx` (~line 1460)

After stream is created in database, now calls:
```javascript
POST /api/broadcasts/start-streaming
Body: { streamId: string, roomName: string }
```

**What happens:**
- Backend calls `muxService.createMuxLiveStream()`
- Mux creates a live stream and returns:
  - `muxLiveStreamId` → stored as `mux_stream_key`
  - `muxPlaybackId` → stored as `mux_playback_id`
  - `muxIngestUrl` → stored as `mux_rtmp_url`
  - `rtmpTarget` → sent to LiveKit for egress
- Stream record is updated with Mux credentials

**Error Handling:**
- Non-blocking: If Mux initialization fails, stream still starts (LiveKit works without Mux)
- Logs warnings but continues
- Users can still broadcast without Mux

### 2. **BroadcastPage.tsx** - Added Mux Cleanup Call

**Location:** `src/pages/broadcast/BroadcastPage.tsx` (~line 2520)

When broadcast ends, now calls:
```javascript
POST /api/broadcasts/stop-streaming
Body: { streamId: string }
```

**What happens:**
- Backend calls `liveKitEgressService.stopEgress()` to stop egress recording
- Backend calls `muxService.disableMuxLiveStream()` to disable the Mux live stream
- Marks stream as completed in database

**Error Handling:**
- Non-blocking: Stream end continues even if cleanup fails
- Old egress/streams will eventually timeout

## Backend Requirements

The backend (Node.js server) must be running with:

### Environment Variables (Already Configured)
```
MUX_TOKEN_ID=a796ed09-0368-498e-ad3f-9523ad69a0d5
MUX_TOKEN_SECRET=CfqzUp0nKTr1Ut3W9h8VNBKAiwAmRAI+HZC1dy9cGkZma+8mAl18BSjc/h2KV2kCIp1Ez4QA/HX
SUPABASE_URL=https://gejtbllazzighxwxudyu.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
```

### Services Required
- ✅ `server/services/muxService.ts` - Creates/disables Mux streams
- ✅ `server/services/liveKitEgressService.ts` - Manages LiveKit egress
- ✅ `server/api/broadcasts.js` - HTTP endpoints

## Database Schema

All required columns already exist (migration applied):
- `mux_stream_key` TEXT
- `mux_playback_id` TEXT
- `mux_rtmp_url` TEXT
- `egress_id` TEXT
- `is_live` BOOLEAN
- `start_time` TIMESTAMPTZ
- `end_time` TIMESTAMPTZ

## Testing Checklist

### 1. Start a Broadcast
- [ ] Go to `/broadcast/setup`
- [ ] Select category, enter title, click "Start Broadcast"
- [ ] **Check database:** `mux_stream_key`, `mux_playback_id`, `mux_rtmp_url` should be populated
- [ ] **Check Mux dashboard:** Should see active live stream
- [ ] **Check browser console:** Should see logs:
  ```
  [SetupPage] Stream created, initializing Mux with backend...
  [SetupPage] Mux stream initialized successfully: { ... }
  ```

### 2. End the Broadcast
- [ ] Click "End Broadcast" or leave stream
- [ ] **Check browser console:** Should see logs:
  ```
  [BroadcastPage] Stopping Mux stream and egress...
  [BroadcastPage] Mux stream stopped successfully
  ```
- [ ] **Check Mux dashboard:** Stream should be marked as completed
- [ ] **Check database:** `stream_mux_outputs` should show `mux_status: 'completed'`

### 3. Troubleshooting

If backend call fails:

**Issue:** Backend returns 400/500 error
```
[SetupPage] Mux initialization failed: 400 { error: "..." }
```
- Check if backend is running: `npm run dev` or `npm run build && npm start`
- Verify Mux credentials are valid
- Check server logs for details

**Issue:** Backend URL not found
```
[SetupPage] Failed to call Mux initialization endpoint: TypeError: fetch failed
```
- Ensure `VITE_BACKEND_URL` is set in `.env`, or
- Backend running on `http://localhost:3001` (default fallback)

**Issue:** Mux credentials in database are NULL
- Check if backend was actually called (look for console logs)
- Verify `muxService.ts` can access `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`
- Check Mux API response (add more logging if needed)

## Files Modified

1. ✅ [SetupPage.tsx](src/pages/broadcast/SetupPage.tsx#L1460) - Added start-streaming call
2. ✅ [BroadcastPage.tsx](src/pages/broadcast/BroadcastPage.tsx#L2520) - Added stop-streaming call

## Next Steps

1. **Restart backend** if not running:
   ```bash
   npm run dev  # or
   npm start
   ```

2. **Test broadcast flow** using checklist above

3. **Monitor Mux dashboard** for active streams when testing

4. **Verify database** shows populated Mux fields

## Architecture Overview

```
Frontend (Browser)                Backend (Node.js)           External Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. User starts broadcast
   SetupPage.tsx
      ↓
   Creates stream in Supabase (status: 'live')
      ↓
   Calls POST /api/broadcasts/start-streaming ──→ broadcasts.js
                                                     ↓
                                                   muxService.ts
                                                     ↓
                                                   Call Mux API ──→ Mux.com
                                                     ↑
                                                   Returns credentials
                                                     ↓
                                                   Update streams table
                                                     ↓
                                                   start_room_egress ──→ LiveKit


2. User ends broadcast
   BroadcastPage.tsx
      ↓
   Updates stream (status: 'ended')
      ↓
   Calls POST /api/broadcasts/stop-streaming ──→ broadcasts.js
                                                 ↓
                                                 muxService.disableMuxLiveStream()
                                                 liveKitEgressService.stopEgress()
                                                 ↓
                                                 Cleanup complete
```

## Notes

- Mux credentials are now **generated on-demand** when broadcast starts
- Egress recording runs during broadcast to RTMP
- Playback available via `mux_playback_id` after stream ends
- All Mux/egress API calls are non-blocking to prevent broadcast interruption
