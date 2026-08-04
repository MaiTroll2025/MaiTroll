# Mux CDN Integration Guide for Mai Troll

## Overview
This implementation uses Mux HLS for watch-only viewers and LiveKit for participants/broadcasters. This reduces LiveKit costs by offloading viewer traffic to Mux CDN.

## Architecture Summary

```
Broadcaster (LiveKit)
    ↓
LiveKit RoomComposite Egress
    ↓
Mux RTMP Ingest
    ↓
Mux Live Stream
    ├→ HLS Playback (Viewers via MuxViewer component)
    └→ DVR Recording (optional)

Viewers (Mux HLS)
    ↓
    Can join LiveKit as participants on-demand
```

## Setup Steps

### 1. Environment Variables (.env.local)



### 2. Database Migration

Run the migration to create `stream_mux_outputs` table:
```bash
supabase migration push
```

Or manually execute in Supabase SQL editor:
```sql
-- See file: supabase/migrations/20250425000000_add_mux_cdn_support.sql
```

### 3. Backend Service Setup

Deploy to Render or similar:

#### Render Setup:
1. Create new Web Service
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm run start`
5. Add environment variables (same as .env.local, plus secrets)
6. Deploy

#### Backend Routes (add to your backend framework):

Express.js example:
```javascript
import broadcastApi from './server/api/broadcasts';

app.post('/api/broadcasts/start-streaming', broadcastApi.startStreaming);
app.post('/api/broadcasts/stop-streaming', broadcastApi.stopStreaming);
app.get('/api/broadcasts/:streamId/mux-status', broadcastApi.getMuxStatus);
```

### 4. Frontend Integration

#### Step 1: Add Mux Player Script to HTML

In `index.html` (head section):
```html
<script src="https://cdn.jsdelivr.net/npm/@mux/mux-player@latest"></script>
```

#### Step 2: Use MuxViewer Component

When user clicks to watch a broadcast:
```typescript
import MuxViewer from './components/MuxViewer';

function BroadcastPage({ streamId }) {
  const handleJoinParticipant = () => {
    // Switch user from viewer mode to participant mode
    // Connect to LiveKit room
    navigate(`/broadcast/${streamId}/participate`);
  };

  return (
    <div className="w-full h-full">
      <MuxViewer 
        streamId={streamId}
        onJoinParticipant={handleJoinParticipant}
        className="w-full h-full"
      />
    </div>
  );
}
```

#### Step 3: Broadcaster Flow

When broadcaster clicks "Go Live":
```typescript
async function startBroadcast() {
  try {
    // 1. Create LiveKit room
    const roomName = `broadcast_${streamId}`;
    
    // 2. Call backend to start Mux stream + egress
    const response = await fetch('/api/broadcasts/start-streaming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamId,
        roomName,
      }),
    });

    const data = await response.json();
    const { muxPlaybackId, egressId } = data;

    // 3. Connect broadcaster to LiveKit room
    await connectToLiveKit(roomName);

    // 4. Stream is now live!
    setStreamLive(true);
    setPlaybackId(muxPlaybackId);
  } catch (error) {
    console.error('Failed to start broadcast:', error);
  }
}
```

When broadcaster clicks "End Stream":
```typescript
async function endBroadcast() {
  try {
    // 1. Call backend to stop egress + disable Mux stream
    await fetch('/api/broadcasts/stop-streaming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId }),
    });

    // 2. Disconnect from LiveKit
    await disconnectFromLiveKit();

    // 3. Mark stream as ended
    setStreamLive(false);
  } catch (error) {
    console.error('Failed to end broadcast:', error);
  }
}
```

## Security Best Practices

### ✅ Correct (Server-side Only)
- `MUX_TOKEN_SECRET` - Used only in backend
- `LIVEKIT_API_SECRET` - Used only in backend
- RTMP URL construction - Done server-side

### ❌ Never Expose
- Never include `MUX_TOKEN_SECRET` in frontend code
- Never send `LIVEKIT_API_SECRET` to browser
- Never expose Mux `stream_key`

### ✅ Safe for Frontend
- `VITE_MUX_TOKEN_ID` - Used to verify tokens (if needed)
- `VITE_LIVEKIT_URL` - Public URL
- `muxPlaybackId` - Public playback identifier
- `VITE_SUPABASE_ANON_KEY` - Already public

## Webhook Handlers (Optional)

For production, handle webhooks from Mux and LiveKit:

```typescript
// POST /api/webhooks/mux
export async function handleMuxWebhook(req, res) {
  const event = req.body;
  
  if (event.type === 'video.live_stream.updated') {
    // Update stream status in Supabase
    const status = event.data.status;
    await supabase
      .from('stream_mux_outputs')
      .update({ mux_status: status })
      .eq('mux_live_stream_id', event.data.id);
  }
}

// POST /api/webhooks/livekit
export async function handleLiveKitWebhook(req, res) {
  const event = req.body;
  
  if (event.type === 'egress_finished') {
    // Update egress status in Supabase
    await supabase
      .from('stream_mux_outputs')
      .update({ egress_status: 'stopped' })
      .eq('egress_id', event.egressId);
  }
}
```

## Testing

### Local Testing

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Test with mock data:**
   ```javascript
   // In browser console
   const streamId = 'test-stream-id';
   fetch('/api/broadcasts/start-streaming', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       streamId,
       roomName: `test_${streamId}`,
     }),
   }).then(r => r.json()).then(console.log);
   ```

### Production Testing

1. **Verify environment variables are set**
2. **Test Mux stream creation** - Check Mux dashboard
3. **Test LiveKit egress** - Check LiveKit console
4. **Verify playback** - Open stream in browser

## Troubleshooting

### Stream showing "Stream is preparing..."
- Wait 10-15 seconds for Mux to process
- Check if `mux_playback_id` is in database
- Verify Mux credentials are correct

### Egress not starting
- Check LiveKit is running
- Verify room exists in LiveKit
- Check RTMP URL format is correct
- Review LiveKit logs for errors

### No audio/video in viewer
- Verify egress is actively encoding (check LiveKit console)
- Check Mux ingest is receiving data
- Try refreshing browser
- Check browser console for player errors

### High latency
- Mux HLS can be 30-60 seconds behind live
- This is expected - optimize for viewer experience, not millisecond sync
- Battles/interactions require switching to LiveKit participant mode

## Cost Optimization

### Before (all viewers on LiveKit)
- 1000 viewers × $0.005/min = $5/min

### After (viewers on Mux)
- 100 participants × $0.005/min = $0.50/min
- 900 viewers × ~$0.001/min (Mux) = $0.90/min
- **Total = $1.40/min** (72% reduction)

## Next Steps

1. ✅ Set up environment variables
2. ✅ Run database migration
3. ✅ Deploy backend service
4. ⬜ Integrate MuxViewer component into broadcast page
5. ⬜ Add start/stop streaming logic to broadcaster controls
6. ⬜ Test end-to-end flow
7. ⬜ Set up webhook handlers for production
8. ⬜ Monitor costs in Mux and LiveKit dashboards

## References

- [Mux API Docs](https://docs.mux.com/)
- [LiveKit Egress Docs](https://docs.livekit.io/egress/)
- [Mux Player Docs](https://docs.mux.com/mux-player)
