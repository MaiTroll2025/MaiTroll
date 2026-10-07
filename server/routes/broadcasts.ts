/**
 * API Routes for Broadcast Setup (TypeScript Reference)
 * Orchestrates LiveKit egress startup for broadcasts
 *
 * NOTE: The running server uses server/api/broadcasts.js (CommonJS).
 * This file serves as documentation and type reference.
 *
 * Actual Endpoints (as implemented in server/api/broadcasts.js):
 * POST /api/broadcasts/start-streaming - Initialize stream + start egress
 * POST /api/broadcasts/stop-streaming  - Stop egress
 * GET  /api/broadcasts/:streamId/status - Get current stream/egress status
 *
 * Deprecated aliases (still work but log warnings):
 * POST /api/broadcasts/start → maps to start-streaming
 * POST /api/broadcasts/stop  → maps to stop-streaming
 */

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This TypeScript file documents the broadcast API contract.
 * The actual implementation is in server/api/broadcasts.js.
 * Keep route definitions synchronized with both frontend and backend.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

import { createClient } from '@supabase/supabase-js';
import * as LiveKit from 'livekit-server-sdk';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
);

/**
 * POST /api/broadcasts/start
 * Called when a broadcaster clicks "Go Live"
 * 
 * Body: {
 *   streamId: string
 *   roomName: string
 *   broadcasterId: string
 *   title: string
 * }
 */
export async function startBroadcast(req, res) {
  const { streamId, roomName, broadcasterId, title } = req.body;

  if (!streamId || !roomName || !broadcasterId) {
    return res.status(400).json({ error: 'streamId, roomName, and broadcasterId required' });
  }

  try {
    console.log('[API] 🔍 Starting broadcast:', { streamId, roomName, broadcasterId, title: title?.substring(0,50) });

    // ── STEP 1: Start LiveKit Egress ─────────────────────────────────────────
    console.log('[LiveKit Egress] Starting egress for room:', roomName);

    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      throw new Error('LiveKit environment variables missing (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)');
    }

    // Optional: Pre-check room existence via RoomService
    try {
      const { RoomServiceClient } = LiveKit;
      const roomClient = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
      const roomList = await roomClient.listRooms({ names: [roomName] });
      if (roomList.rooms.length === 0) {
        console.log('[LiveKit] Room not found in listRooms — will retry during egress');
      } else {
        console.log('[LiveKit] ✅ Room confirmed exists:', roomName);
      }
    } catch (checkErr) {
      console.warn('[LiveKit] Room existence check failed (non-critical):', checkErr?.message || checkErr);
    }

    let egressId: string | null = null;
    const maxRetries = 5;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[LiveKit Egress] Attempt ${attempt}/${maxRetries}: starting egress...`);
        const egressClient = new LiveKit.EgressClient(livekitUrl, livekitApiKey, livekitApiSecret);

        const egressInfo = await egressClient.startRoomCompositeEgress(
          roomName,
          { layout: 'grid', audioOnly: false, videoOnly: false }
        );
        egressId = egressInfo.egressId;
        console.log(`[LiveKit Egress] ✅ Started on attempt ${attempt}:`, egressId);
        break;
      } catch (egressErr: any) {
        console.error(`[LiveKit Egress] ❌ Attempt ${attempt} failed:`, egressErr?.message || egressErr);

        if (egressErr?.status === 404 || (egressErr?.message?.includes('room') && egressErr?.message?.includes('not found'))) {
          if (attempt < maxRetries) {
            console.log(`[LiveKit Egress] ⏳ Room not ready yet, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error('[LiveKit Egress] ❌ All retries exhausted — room never appeared');
          }
        }
        throw new Error(`LiveKit egress failed: ${egressErr instanceof Error ? egressErr.message : String(egressErr)}`);
      }
    }

    if (!egressId) {
      throw new Error('LiveKit egress failed: no egress ID returned after retries');
    }

    // ── STEP 2: Update streams table with egress data, set live ───────────────
    console.log('[Supabase] Updating streams row...');
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        livekit_room_name: roomName,
        egress_id: egressId,
        broadcaster_id: broadcasterId,
        is_live: true,
        start_time: new Date().toISOString(),
        status: 'live',
        title: title || 'Live Stream',
      })
      .eq('id', streamId);

    if (updateError) {
      console.error('[Supabase] Update failed:', updateError);
      throw new Error(`Failed to update stream: ${updateError.message}`);
    }

    console.log('[API] ✅ Broadcast fully live:', { streamId, egressId });

    return res.status(200).json({
      success: true,
      streamId,
      egress_id: egressId,
      egressId,
      livekitEgressId: egressId,
      livekit_room_name: roomName,
      status: 'live',
    });

  } catch (error) {
    console.error('[API] Error starting broadcast:', error);
    try {
      if (streamId) {
        await supabase.from('streams').update({ status: 'failed', is_live: false }).eq('id', streamId);
      }
    } catch (e) {
      console.error('[API] Failed to mark stream as failed:', e);
    }
    return res.status(500).json({
      error: 'Failed to start broadcast',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/broadcasts/stop
 * Called when broadcaster ends the broadcast
 * 
 * Body: {
 *   streamId: string
 * }
 */
export async function stopBroadcast(req, res) {
  try {
    const { streamId } = req.body;

    if (!streamId) {
      return res.status(400).json({ error: 'streamId required' });
    }

    console.log(`[API] Stopping broadcast: ${streamId}`);

    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .select('egress_id')
      .eq('id', streamId)
      .maybeSingle();

    if (streamError) {
      throw new Error(`Failed to fetch stream: ${streamError.message}`);
    }

    // 1. Stop LiveKit egress
    if (stream?.egress_id) {
      try {
        const egressClient = new LiveKit.EgressClient(
          process.env.LIVEKIT_URL,
          process.env.LIVEKIT_API_KEY,
          process.env.LIVEKIT_API_SECRET
        );
        await egressClient.stopEgress(stream.egress_id);
        console.log(`[API] LiveKit egress stopped: ${stream.egress_id}`);
      } catch (error) {
        console.error('[API] Error stopping LiveKit egress:', error);
      }
    }

    // 2. Update streams table
    await supabase
      .from('streams')
      .update({
        is_live: false,
        end_time: new Date().toISOString(),
        status: 'ended',
      })
      .eq('id', streamId);

    console.log(`[API] Broadcast stopped successfully: ${streamId}`);

    return res.status(200).json({
      success: true,
      message: 'Broadcast stopped',
    });
  } catch (error) {
    console.error('[API] Error stopping broadcast:', error);
    return res.status(500).json({
      error: `Failed to stop broadcast: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * GET /api/broadcasts/:streamId/status
 * Get current stream status (called by frontend)
 * 
 * Returns only safe data (no secrets)
 */
export async function getBroadcastStatus(req, res) {
  try {
    const streamId = req.params?.streamId || req.query?.streamId;

    if (!streamId) {
      return res.status(400).json({ error: 'streamId required' });
    }

    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .select('id, broadcaster_id, title, status, is_live, start_time, end_time, livekit_room_name')
      .eq('id', streamId)
      .single();

    if (streamError || !stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    return res.status(200).json({
      id: stream.id,
      title: stream.title,
      status: stream.status,
      isLive: stream.is_live,
      broadcasterId: stream.broadcaster_id,
      roomName: stream.livekit_room_name,
      startTime: stream.start_time,
      endTime: stream.end_time,
    });
  } catch (error) {
    console.error('[API] Error getting broadcast status:', error);
    return res.status(500).json({
      error: 'Failed to get broadcast status',
    });
  }
}

export default {
  startBroadcast,
  stopBroadcast,
  getBroadcastStatus,
};