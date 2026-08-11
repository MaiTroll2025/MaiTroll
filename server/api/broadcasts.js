const { createClient } = require('@supabase/supabase-js');
const {
  EgressClient,
  RoomServiceClient,
} = require('livekit-server-sdk');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('[broadcasts.js] 🔴 CRITICAL: SUPABASE_URL not set in environment');
}
if (!supabaseServiceKey) {
  console.error('[broadcasts.js] 🔴 CRITICAL: SUPABASE_SERVICE_ROLE_KEY not set in environment');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function cleanEnvValue(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^[\'"]|[\'"]$/g, '');
}

function normalizeLiveKitHost(value) {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return '';
  return cleaned.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

function getLiveKitConfig() {
  return {
    url: normalizeLiveKitHost(process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL),
    apiKey: cleanEnvValue(process.env.LIVEKIT_API_KEY),
    apiSecret: cleanEnvValue(process.env.LIVEKIT_API_SECRET),
    frontendUrl: normalizeLiveKitHost(process.env.VITE_LIVEKIT_URL),
  };
}

function getLiveKitAuthHint(error) {
  const message = error?.message || '';
  if (/invalid token/i.test(message)) {
    return 'LiveKit rejected the server API token. Make sure the backend LIVEKIT_API_KEY and LIVEKIT_API_SECRET belong to the same LiveKit project as LIVEKIT_URL and match the secrets used by the livekit-token edge function.';
  }
  return undefined;
}

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This module handles all broadcast streaming lifecycle operations.
 * Changing this file directly impacts every broadcast on the platform.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

/**
 * POST /api/broadcasts/start-streaming
 * Called when broadcaster clicks "Go Live"
 *
 * Body: {
 *   streamId: string,
 *   roomName: string,
 *   broadcasterId: string,
 *   title: string
 * }
 *
 * Starts LiveKit egress, updates DB.
 * Returns: { success, streamId, livekitRoomName, livekitEgressId }
 * NEVER returns secrets.
 */
async function startStreaming(req, res) {
  const safeJson = (status, data) => {
    try {
      return res.status(status).json(data);
    } catch (e) {
      console.error('[startStreaming] 💥 Failed to send JSON response:', e);
      return res.status(status).send(String(data));
    }
  };

  const envChecks = {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
    LIVEKIT_URL: !!process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: !!process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: !!process.env.LIVEKIT_API_SECRET,
  };

  const missingEnvVars = Object.entries(envChecks)
    .filter(([_key, value]) => !value)
    .map(([key]) => key);

  if (missingEnvVars.length > 0) {
    console.error('[startStreaming] 🔴 CRITICAL: Missing environment variables:', missingEnvVars);
    return safeJson(500, {
      success: false,
      error: 'Server configuration error: Missing required environment variables',
      details: `Missing: ${missingEnvVars.join(', ')}`,
      step: 'env_validation',
    });
  }

  const streamId = req.body?.streamId;
  const roomName = req.body?.roomName;
  const broadcasterId = req.body?.broadcasterId;
  const title = req.body?.title;

  try {
    console.log('[startStreaming] 🔍 Environment check:', envChecks);

    if (!supabase) {
      console.error('[startStreaming] ❌ Supabase client not initialized — missing env vars');
      return safeJson(500, {
        error: "Server configuration error: Supabase not initialized",
        details: "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
      });
    }

    if (!streamId || !roomName || !broadcasterId) {
      return safeJson(400, {
        error: "streamId, roomName, and broadcasterId are required",
        received: { streamId, roomName, broadcasterId, title }
      });
    }

    console.log(`[startStreaming] START: streamId=${streamId}, roomName=${roomName}, broadcasterId=${broadcasterId}`);

    // ── STEP 0: Check broadcaster license status ─────────────────────────────
    console.log(`[startStreaming] STEP 0: Checking broadcaster license...`);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("license_status, drivers_license_status, insurance_required")
        .eq("id", broadcasterId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error("Broadcaster profile not found");

      const hasActiveLicense = profile.license_status === 'active' || profile.drivers_license_status === 'active';

      if (!hasActiveLicense) {
        console.error(`[startStreaming] ❌ STEP 0 FAILED - License not active: license_status=${profile.license_status}, drivers_license_status=${profile.drivers_license_status}`);
        return safeJson(403, {
          error: "Head to neighborhood in sidebar to complete onboarding and take your drivers test",
          license_status: profile.license_status,
          drivers_license_status: profile.drivers_license_status,
          details: ""
        });
      }

      console.log(`[startStreaming] ✅ STEP 0 SUCCESS - License active`);
    } catch (error) {
      console.error(`[startStreaming] ❌ STEP 0 FAILED - License check:`, error.message);
      return safeJson(500, {
        success: false,
        step: "license_check",
        error: "Failed to verify broadcaster license",
        details: error.message
      });
    }

    // ── STEP 0b: Enforce broadcaster capacity limit (beta: 25 max) ───────────
    console.log(`[startStreaming] STEP 0b: Checking broadcaster capacity...`);
    try {
      const { count: activeBroadcasterCount, error: countError } = await supabase
        .from("streams")
        .select("*", { count: 'exact', head: true })
        .eq("is_live", true)
        .eq("status", "live");

      if (countError) {
        console.warn(`[startStreaming] ⚠️  Broadcaster count check failed:`, countError.message);
      } else if ((activeBroadcasterCount || 0) >= 25) {
        console.error(`[startStreaming] ❌ STEP 0b FAILED - Broadcaster limit reached: ${activeBroadcasterCount}/25`);
        return safeJson(429, {
          success: false,
          step: "broadcaster_capacity",
          error: "All broadcasting slots are currently in use. Please try again later.",
          code: 'broadcaster_limit_reached',
          activeBroadcasters: activeBroadcasterCount,
          maxBroadcasters: 25,
        });
      }
      console.log(`[startStreaming] ✅ STEP 0b SUCCESS - Broadcasters: ${activeBroadcasterCount || 0}/25`);
    } catch (error) {
      console.error(`[startStreaming] ❌ STEP 0b FAILED - Broadcaster capacity check:`, error.message);
    }

    // ── STEP 1: Verify stream exists (created by frontend) ────────────────────
    console.log(`[startStreaming] STEP 1: Verifying stream exists...`);
    let existingStream;
    try {
      const { data: streamData, error: fetchError } = await supabase
        .from("streams")
        .select("id, broadcaster_id, title, status, livekit_room_name, livekit_room, room_name")
        .eq("id", streamId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!streamData) throw new Error("Stream not found");

      existingStream = streamData;
      console.log(`[startStreaming] ✅ STEP 1 SUCCESS - Stream verified: ${existingStream.id}`);
    } catch (error) {
      console.error(`[startStreaming] ❌ STEP 1 FAILED - Stream verification:`, error.message);
      return safeJson(500, {
        success: false,
        step: "stream_verify",
        error: "Failed to verify stream",
        details: error.message,
        streamId
      });
    }

    const egressRoomName =
      existingStream.livekit_room_name ||
      existingStream.livekit_room ||
      existingStream.room_name ||
      roomName;

    if (!egressRoomName) {
      return safeJson(500, {
        success: false,
        step: "room_validation",
        error: "No valid LiveKit room name found",
        streamId,
      });
    }

    // ── STEP 2: LiveKit egress preflight ─────────────────────────────────────
    const liveKitConfig = getLiveKitConfig();
    const livekitUrl = liveKitConfig.url;
    const livekitApiKey = liveKitConfig.apiKey;
    const livekitApiSecret = liveKitConfig.apiSecret;

    console.log('[LiveKit] Server credential preflight:', {
      LIVEKIT_URL: livekitUrl ? '[set]' : '[missing]',
      LIVEKIT_URL_host: livekitUrl ? new URL(livekitUrl).host : null,
      VITE_LIVEKIT_URL: liveKitConfig.frontendUrl ? '[set]' : '[missing]',
      VITE_LIVEKIT_URL_host: liveKitConfig.frontendUrl ? new URL(liveKitConfig.frontendUrl).host : null,
      LIVEKIT_API_KEY_set: !!livekitApiKey,
      LIVEKIT_API_SECRET_set: !!livekitApiSecret,
      egressRoomName,
    });

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return safeJson(500, {
        success: false,
        step: "livekit_config",
        error: "LiveKit server credentials are not configured",
        details: "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET for the API server",
        streamId,
      });
    }

    if (liveKitConfig.frontendUrl && new URL(liveKitConfig.frontendUrl).host !== new URL(livekitUrl).host) {
      return safeJson(500, {
        success: false,
        step: "livekit_config",
        error: "LiveKit frontend/backend URL mismatch",
        details: "VITE_LIVEKIT_URL and LIVEKIT_URL point to different LiveKit projects",
        streamId,
      });
    }

    try {
      const roomClient = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
      await roomClient.listRooms([egressRoomName]);
      console.log('[LiveKit] Server credential preflight passed');
    } catch (preflightError) {
      console.error('[LiveKit] Server credential preflight failed:', {
        message: preflightError.message,
        code: preflightError.code,
        status: preflightError.status,
      });

      return safeJson(500, {
        success: false,
        step: "livekit_config",
        error: "LiveKit server credentials failed authentication",
        details: preflightError.message || String(preflightError),
        hint: getLiveKitAuthHint(preflightError),
        streamId,
      });
    }

    // ── STEP 3: Start LiveKit egress ───────────────────────────────────────
    console.log(`[startStreaming] STEP 2: Starting LiveKit egress...`);

    let livekitEgressId = null;
    const maxRetries = 3;
    let lastEgressError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[LiveKit Egress] 📤 Attempt ${attempt}/${maxRetries}: Calling startRoomCompositeEgress...`);

      try {
        const egressClient = new EgressClient(
          livekitUrl,
          livekitApiKey,
          livekitApiSecret
        );

        const egressInfo = await egressClient.startRoomCompositeEgress(
          egressRoomName,
          { stream: { protocol: 0 /* RTMP */, urls: [] } },
          {
            layout: 'grid',
            audioOnly: false,
            videoOnly: false,
          }
        );

        livekitEgressId = egressInfo.egressId || null;

        if (!livekitEgressId) {
          throw new Error('Egress started but no egressId returned');
        }

        console.log('[LiveKit Egress] ✅ Started successfully:', livekitEgressId);
        break;
      } catch (egressError) {
        lastEgressError = egressError;
        console.error(`[LiveKit Egress] ❌ Attempt ${attempt}/${maxRetries} failed:`, egressError?.message || egressError);

        if (egressError?.message?.includes('room not found') && attempt < maxRetries) {
          console.log('[LiveKit Egress] ⏳ Room not ready, retrying...');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        break;
      }
    }

    if (!livekitEgressId) {
      const egressError = lastEgressError;
      console.error(`[startStreaming] ❌ STEP 2 FAILED - LiveKit egress:`, egressError.message);

      return safeJson(500, {
        success: false,
        step: "livekit_egress",
        error: "Failed to start LiveKit egress",
        details: egressError.message,
        hint: getLiveKitAuthHint(egressError),
        streamId,
        stack: egressError.stack
      });
    }

    console.log(`[startStreaming] ✅ STEP 2 SUCCESS - Egress started: ${livekitEgressId}`);

    // ── STEP 4: Update database ─────────────────────────────────────────────
    console.log(`[startStreaming] STEP 3: Updating database...`);

    const updateData = {
      livekit_room_name: egressRoomName,
      agora_channel: egressRoomName,
      broadcaster_id: broadcasterId,
      start_time: new Date().toISOString(),
      title: title || existingStream.title,
      egress_id: livekitEgressId,
      status: 'live',
      is_live: true,
    };

    try {
      const { error: streamError } = await supabase
        .from("streams")
        .update(updateData)
        .eq("id", streamId);

      if (streamError) throw streamError;

      console.log(`[startStreaming] ✅ STEP 3 SUCCESS - Database updated`);
    } catch (dbError) {
      console.error(`[startStreaming] ❌ STEP 3 FAILED - Database update:`, dbError.message);
      await supabase.from("streams")
        .update({ status: "failed", is_live: false })
        .eq("id", streamId)
        .catch(err => console.error("[startStreaming] Failed to rollback:", err));

      return safeJson(500, {
        success: false,
        step: "supabase_update",
        error: "Failed to update stream",
        details: dbError.message,
        streamId,
        stack: dbError.stack
      });
    }

    console.log('[startStreaming] ✅ ALL STEPS SUCCESSFUL');

    return safeJson(200, {
      success: true,
      streamId,
      livekitRoomName: egressRoomName,
      livekitEgressId: livekitEgressId,
      status: "live",
    });

  } catch (error) {
    console.error('[startStreaming] ❌ Unexpected error:', error);
    console.error('[startStreaming] ⚠️  Context:', {
      streamId,
      roomName,
      broadcasterId,
      title,
    });

    if (streamId) {
      await supabase.from("streams")
        .update({ status: "failed", is_live: false })
        .eq("id", streamId)
        .catch(err => console.error("[startStreaming] Failed to mark stream as failed:", err));
    }

    return safeJson(500, {
      error: "Internal server error during stream initialization",
      details: error instanceof Error ? error.message : String(error),
      streamId
    });
  }
}

/**
 * POST /api/broadcasts/stop-streaming
 * Stops egress, updates DB.
 */
async function stopStreaming(req, res) {
  const streamId = req.body?.streamId;
  if (!streamId) {
    return res.status(400).json({ error: "streamId is required" });
  }

  try {
    console.log(`[stopStreaming] Stopping stream: ${streamId}`);

    const { data: stream, error: fetchError } = await supabase
      .from("streams")
      .select("id, egress_id, livekit_room_name, broadcaster_id, title")
      .eq("id", streamId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[stopStreaming] Error fetching stream:`, fetchError);
      return res.status(500).json({ error: "Failed to fetch stream", details: fetchError.message });
    }

    if (!stream) {
      return res.status(404).json({ error: "Stream not found", streamId });
    }

    // Stop LiveKit egress and get recording metadata
    let recordingFileSize = 0
    let recordingDuration = 0
    if (stream.egress_id) {
      try {
        console.log(`[stopStreaming] Stopping LiveKit egress: ${stream.egress_id}`);
        const liveKitConfig = getLiveKitConfig();
        const egressClient = new EgressClient(
          liveKitConfig.url,
          liveKitConfig.apiKey,
          liveKitConfig.apiSecret
        );

        try {
          const egressInfo = await egressClient.getEgress(stream.egress_id)
          recordingFileSize = egressInfo.fileResults?.[0]?.size || 0
          recordingDuration = Math.floor((egressInfo.fileResults?.[0]?.duration || 0) / 1e9)
          console.log(`[stopStreaming] Egress info — size: ${recordingFileSize}, duration: ${recordingDuration}s`);
        } catch (infoErr) {
          console.warn(`[stopStreaming] Could not fetch egress info:`, infoErr.message);
        }

        await egressClient.stopEgress(stream.egress_id);
        console.log(`[stopStreaming] LiveKit egress stopped`);
      } catch (egressError) {
        console.warn(`[stopStreaming] Failed to stop egress:`, egressError.message);
      }
    }

    // Update streams table
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("streams")
      .update({
        status: 'ended',
        is_live: false,
        ended_at: now,
        updated_at: now,
      })
      .eq("id", streamId);

    if (updateError) {
      console.warn('[stopStreaming] streams cleanup failed:', updateError.message);
      return res.status(200).json({
        success: true,
        message: "Stream stopped (DB cleanup warning logged)",
        streamId,
        warning: "Stream status update failed but egress was stopped successfully"
      });
    }

    // Create broadcast_replays entry and update saved_streams with storage info
    if (stream.egress_id) {
      try {
        const { data: streamInfo } = await supabase
          .from('streams')
          .select('title, broadcaster_id, category')
          .eq('id', streamId)
          .maybeSingle()

        if (streamInfo?.broadcaster_id) {
          const replayUrl = `recordings/${streamId}/${stream.egress_id}.mp4`

          await supabase
            .from('saved_streams')
            .upsert({
              user_id: streamInfo.broadcaster_id,
              stream_id: streamId,
              source: 'auto_egress_recording',
              storage_category: 'broadcast_recording',
              file_size_bytes: recordingFileSize,
              recording_duration: recordingDuration,
            }, { onConflict: 'user_id,stream_id' })

          await supabase
            .from('broadcast_replays')
            .upsert({
              stream_id: streamId,
              user_id: streamInfo.broadcaster_id,
              title: streamInfo.title || 'Live Stream',
              replay_url: replayUrl,
              duration_seconds: recordingDuration,
              file_size_bytes: recordingFileSize,
            }, { onConflict: 'stream_id' })

          console.log(`[stopStreaming] broadcast_replays entry created for stream ${streamId}`);
        }
      } catch (replayErr) {
        console.warn('[stopStreaming] Failed to create broadcast_replays entry:', replayErr.message);
      }
    }

    console.log(`[stopStreaming] Stream stopped: ${streamId}`);

    return res.status(200).json({ success: true, message: "Stream stopped", streamId });

  } catch (error) {
    console.error(`[stopStreaming] Unexpected error:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message, streamId });
  }
}

/**
 * GET /api/broadcasts/:streamId/status
 * Returns current stream/egress status for a stream
 */
async function getBroadcastStatus(req, res) {
  const streamId = req.params?.streamId || req.query?.streamId;
  if (!streamId) {
    return res.status(400).json({ error: "streamId is required" });
  }

  try {
    const { data: stream, error: fetchError } = await supabase
      .from("streams")
      .select("id, broadcaster_id, title, status, is_live, livekit_room_name, egress_id")
      .eq("id", streamId)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ error: "Failed to fetch stream", details: fetchError.message });
    }

    if (!stream) {
      return res.status(404).json({ error: "Stream not found", streamId });
    }

    return res.status(200).json({
      streamId,
      status: stream.status,
      isLive: stream.is_live,
      broadcasterId: stream.broadcaster_id,
      livekitRoomName: stream.livekit_room_name,
      egressId: stream.egress_id,
    });

  } catch (error) {
    console.error(`[getBroadcastStatus] Unexpected error:`, error);
    return res.status(500).json({ error: "Internal server error", details: error.message, streamId });
  }
}

module.exports = { startStreaming, stopStreaming, getBroadcastStatus };