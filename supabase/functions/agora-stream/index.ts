import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ====================== CONFIG & VALIDATION ======================
const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const AGORA_CUSTOMER_ID = Deno.env.get("AGORA_CUSTOMER_ID") ?? "";
const AGORA_CUSTOMER_SECRET = Deno.env.get("AGORA_CUSTOMER_SECRET") ?? "";
const AGORA_REGION = (Deno.env.get("AGORA_REGION") ?? "na").toLowerCase();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ====================== ENV DEBUG ======================
const _envDebug = {
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
  hasAgoraAppId: !!AGORA_APP_ID,
  hasAgoraCustomerId: !!AGORA_CUSTOMER_ID,
  hasAgoraCustomerSecret: !!AGORA_CUSTOMER_SECRET,
  agoraRegion: AGORA_REGION,
};
console.log("[agora-stream] ENV:", JSON.stringify(_envDebug));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
  throw new Error("Missing required Agora environment variables");
}

// ====================== HELPERS ======================
function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function basicAuth(): string {
  return `Basic ${btoa(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`)}`;
}

/**
 * Agora RTLS (Real-Time Live Streaming) Ingest API.
 *
 * This is the CORRECT Agora API for OBS → Agora RTMP ingest.
 *
 * API docs: https://docs.agora.io/en/video-calling/develop/rtls-ingest
 *
 * Workflow:
 *   1. POST /{region}/v1/projects/{app_id}/rtls/ingress/streamkeys → creates stream key
 *   2. OBS pushes to: rtmp://rtls-ingress-prod-{region}.agoramdn.com/live
 *   3. Stream key is the Agora-generated key from step 1
 *   4. Viewers join the Agora channel via Web SDK (live mode, audience role)
 *
 * Prerequisites:
 *   - Enable "Media Gateway" in Agora Console → Project → Features
 *   - Agora Customer ID + Customer Secret (from Agora Console → REST API)
 */
const AGORA_API_BASE = `https://api.agora.io/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}`;
const RTLS_INGRESS_URL = `rtmp://rtls-ingress-prod-${AGORA_REGION}.agoramdn.com/live`;

function generateChannelName(streamId: string): string {
  return `gaming_${streamId}`;
}

/** Create an Agora RTLS stream key via the REST API */
async function createRtlsStreamKey(channel: string): Promise<{ streamKey: string; createdAt: number }> {
  const url = `${AGORA_API_BASE}/rtls/ingress/streamkeys`;
  console.log(`[agora-stream] createRtlsStreamKey: channel=${channel}, url=${url.replace(AGORA_APP_ID, "***")}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": basicAuth(),
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
    },
    body: JSON.stringify({
      settings: {
        channel,
        uid: "0",
        expiresAfter: 86400, // 24 hours
      },
    }),
  });

  const body = await res.json().catch(() => null);
  console.log(`[agora-stream] createRtlsStreamKey: status=${res.status}, body=${JSON.stringify(body)?.slice(0, 500)}`);

  if (res.status >= 400) {
    throw new Error(`Agora RTLS API error ${res.status}: ${body?.message || "Unknown error"}`);
  }

  const streamKey = body?.data?.streamKey as string | undefined;
  const createdAt = body?.data?.createdAt as number | undefined;

  if (!streamKey) {
    throw new Error(`Agora returned no streamKey. Response: ${JSON.stringify(body)}`);
  }

  return { streamKey, createdAt: createdAt || Math.floor(Date.now() / 1000) };
}

/** Delete an Agora RTLS stream key */
async function _deleteRtlsStreamKey(streamKey: string): Promise<void> {
  const url = `${AGORA_API_BASE}/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`;
  console.log(`[agora-stream] deleteRtlsStreamKey: key=${streamKey.slice(0, 8)}...`);
  await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": basicAuth(),
      "X-Request-ID": crypto.randomUUID(),
    },
  });
}

/** Check RTLS ingest status */
async function checkRtlsIngestStatus(channel: string) {
  const url = `${AGORA_API_BASE}/rtls/ingress/status`;
  console.log(`[agora-stream] checkRtlsIngestStatus: channel=${channel}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": basicAuth(),
        "X-Request-ID": crypto.randomUUID(),
      },
    });

    if (res.status === 404 || res.status >= 400) {
      console.log(`[agora-stream] checkRtlsIngestStatus: status=${res.status} (no active ingest)`);
      return { isActive: false, bitrateKbps: null, fps: null, width: null, height: null };
    }

    const data = await res.json().catch(() => null) as any;
    console.log(`[agora-stream] checkRtlsIngestStatus: data keys=${data ? Object.keys(data).join(",") : "null"}`);

    // Check if our channel is in the active ingests
    const ingests = Array.isArray(data?.data?.ingests) ? data?.data?.ingests : [];
    const ingest = ingests.find((i: any) =>
      String(i?.channel || i?.channelName || "") === channel
    );

    if (!ingest) {
      console.log(`[agora-stream] checkRtlsIngestStatus: no ingest found for channel=${channel}`);
      return { isActive: false, bitrateKbps: null, fps: null, width: null, height: null };
    }

    const status = String(ingest?.status || ingest?.state || "").toLowerCase();
    const isActive = ["active", "publishing", "streaming", "connected"].includes(status);
    console.log(`[agora-stream] checkRtlsIngestStatus: status=${status}, isActive=${isActive}`);

    return {
      isActive,
      bitrateKbps: ingest?.bitrate != null ? Number(ingest.bitrate) : null,
      fps: ingest?.fps != null ? Number(ingest.fps) : null,
      width: ingest?.width != null ? Number(ingest.width) : null,
      height: ingest?.height != null ? Number(ingest.height) : null,
    };
  } catch (err) {
    console.error("[agora-stream] checkRtlsIngestStatus error:", err);
    return { isActive: false, bitrateKbps: null, fps: null, width: null, height: null };
  }
}

// ====================== ACTION HANDLERS ======================
async function handleStartStream(body: any, supabase: any) {
  const { streamId, userId } = body;
  if (!streamId || !userId) {
    throw new Error("Missing streamId or userId");
  }

  // Check existing active session
  console.log(`[agora-stream] handleStartStream: checking existing session for streamId=${streamId}`);
  const { data: existing, error: existingError } = await supabase
    .from("agora_stream_sessions")
    .select("id, agora_channel, stream_key, rtmp_url, status")
    .eq("stream_id", streamId)
    .in("status", ["starting", "waiting", "signal_detected", "ready", "live"])
    .maybeSingle();

  if (existingError) {
    console.error(`[agora-stream] handleStartStream: existing session query error:`, existingError);
  }

  if (existing) {
    console.log(`[agora-stream] handleStartStream: found existing session id=${existing.id}, status=${existing.status}`);
    return {
      ok: true,
      existing: true,
      session: {
        id: existing.id,
        agoraChannel: existing.agora_channel,
        streamKey: existing.stream_key,
        status: existing.status,
        rtmpUrl: existing.rtmp_url || null,
      },
    };
  }

  const agoraChannel = generateChannelName(streamId);
  const hostUid = Math.floor(Math.random() * 1_000_000);

  // Create the RTMP ingest stream key via Agora RTLS REST API
  // OBS will push to: rtmp://rtls-ingress-prod-{region}.agoramdn.com/live
  // with the stream key returned by this API call
  console.log(`[agora-stream] handleStartStream: creating Agora RTLS stream key for channel=${agoraChannel}`);
  const { streamKey, createdAt: _createdAt } = await createRtlsStreamKey(agoraChannel);
  const rtmpUrl = RTLS_INGRESS_URL;
  console.log(`[agora-stream] handleStartStream: Agora stream key created, rtmpUrl=${rtmpUrl}`);

  const { data: session, error: insertError } = await supabase
    .from("agora_stream_sessions")
    .insert({
      streamer_id: userId,
      stream_id: streamId,
      agora_channel: agoraChannel,
      stream_key: streamKey,
      rtmp_url: rtmpUrl,
      host_uid: hostUid,
      status: "waiting",
    })
    .select("id, agora_channel, stream_key, rtmp_url, host_uid, status, created_at")
    .single();

  if (insertError) {
    console.error(`[agora-stream] handleStartStream: insert error:`, insertError);
    throw insertError;
  }
  console.log(`[agora-stream] handleStartStream: session created id=${session.id}`);

  // Update main streams table
  const { error: updateError } = await supabase
    .from("streams")
    .update({ agora_channel: agoraChannel, stream_key: streamKey, status: "waiting" })
    .eq("id", streamId);

  if (updateError) {
    console.error(`[agora-stream] handleStartStream: streams update error:`, updateError);
  } else {
    console.log(`[agora-stream] handleStartStream: streams table updated for streamId=${streamId}`);
  }

  return {
    ok: true,
    existing: false,
    session: {
      id: session.id,
      agoraChannel: session.agora_channel,
      streamKey: session.stream_key,
      hostUid: session.host_uid,
      status: session.status,
      rtmpUrl: session.rtmp_url,
      createdAt: session.created_at,
    },
  };
}

async function handleCheckStatus(body: any, supabase: any) {
  const { sessionId, channel } = body;
  if (!sessionId && !channel) throw new Error("Missing sessionId or channel");

  let sessionQuery = supabase
    .from("agora_stream_sessions")
    .select("id, agora_channel, stream_key, status, viewer_count, stream_id");

  if (sessionId) {
    sessionQuery = sessionQuery.eq("id", sessionId);
  } else {
    sessionQuery = sessionQuery.eq("agora_channel", channel);
  }

  const { data: session } = await sessionQuery.maybeSingle();

  if (!session) throw new Error("Session not found");

  const ingest = await checkRtlsIngestStatus(session.agora_channel);

  let newStatus = session.status;

  if (ingest.isActive) {
    if (["waiting", "starting"].includes(session.status)) newStatus = "signal_detected";
    else if (session.status === "signal_detected") newStatus = "ready";
  } else {
    if (session.status === "live") newStatus = "ended";
    else if (["signal_detected", "ready"].includes(session.status)) newStatus = "waiting";
  }

  if (newStatus !== session.status) {
    await supabase
      .from("agora_stream_sessions")
      .update({ status: newStatus })
      .eq("id", session.id);

    if (session.stream_id) {
      const updateData: any = { status: newStatus };
      if (newStatus === "ended") {
        updateData.is_live = false;
        updateData.ended_at = new Date().toISOString();
      }
      await supabase.from("streams").update(updateData).eq("id", session.stream_id);
    }
  }

  return {
    ok: true,
    session: {
      id: session.id,
      agoraChannel: session.agora_channel,
      status: newStatus,
      previousStatus: session.status,
      viewerCount: session.viewer_count,
    },
    ingest: {
      isActive: ingest.isActive,
      bitrateKbps: ingest.bitrateKbps,
      fps: ingest.fps,
      resolution: ingest.width && ingest.height ? `${ingest.width}x${ingest.height}` : null,
    },
  };
}

async function handleGoLive(body: any, supabase: any) {
  const { sessionId } = body;
  if (!sessionId) throw new Error("Missing sessionId");

  const now = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("agora_stream_sessions")
    .update({ status: "live", started_at: now })
    .eq("id", sessionId)
    .in("status", ["waiting", "signal_detected", "ready"])
    .select("id, stream_id, agora_channel")
    .single();

  if (error || !session) throw new Error("Session not found or not in go-live-able state");

  if (session.stream_id) {
    await supabase
      .from("streams")
      .update({ status: "live", is_live: true, started_at: now })
      .eq("id", session.stream_id);
  }

  return {
    ok: true,
    session: {
      id: session.id,
      agoraChannel: session.agora_channel,
      status: "live",
      startedAt: now,
    },
  };
}

async function handleEndStream(body: any, supabase: any) {
  const { sessionId } = body;
  if (!sessionId) throw new Error("Missing sessionId");

  const { data: session } = await supabase
    .from("agora_stream_sessions")
    .select("id, stream_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) throw new Error("Session not found");

  const now = new Date().toISOString();

  await supabase
    .from("agora_stream_sessions")
    .update({ status: "ended", ended_at: now })
    .eq("id", sessionId);

  if (session.stream_id) {
    await supabase
      .from("streams")
      .update({ status: "ended", is_live: false, ended_at: now })
      .eq("id", session.stream_id);
  }

  return {
    ok: true,
    session: { id: session.id, status: "ended", endedAt: now },
  };
}

async function handleHeartbeat(body: any, supabase: any) {
  const { sessionId } = body;
  if (!sessionId) throw new Error("Missing sessionId");

  const { error } = await supabase
    .from("agora_stream_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw error;

  return { ok: true };
}

async function handleGetSession(body: any, supabase: any) {
  const { streamId, sessionId } = body;
  if (!streamId && !sessionId) throw new Error("Missing streamId or sessionId");

  let query = supabase
    .from("agora_stream_sessions")
    .select(`
      id, streamer_id, stream_id, agora_channel, stream_key, rtmp_url,
      host_uid, status, viewer_count, peak_viewers,
      started_at, ended_at, created_at, updated_at
    `);

  if (sessionId) {
    query = query.eq("id", sessionId);
  } else {
    query = query.eq("stream_id", streamId).order("created_at", { ascending: false });
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  // Fallback: compute RTMP URL if column is missing or null (legacy sessions)
  if (data && !data.rtmp_url && data.agora_channel) {
    data.rtmp_url = `rtmp://push-${AGORA_REGION}.agora.io/live/${data.agora_channel}`;
  }

  return { ok: true, session: data };
}

// ====================== MAIN HANDLER ======================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log("[agora-stream] AUTH FAILED:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agora-stream] REQUEST: action=${action}, streamId=${body?.streamId}, sessionId=${body?.sessionId}, userId=${body?.userId}, channel=${body?.channel}, authUserId=${user.id}`);

    let result;

    switch (action) {
      case "startStream":
        result = await handleStartStream(body, supabase);
        break;
      case "checkStatus":
        result = await handleCheckStatus(body, supabase);
        break;
      case "goLive":
        result = await handleGoLive(body, supabase);
        break;
      case "endStream":
        result = await handleEndStream(body, supabase);
        break;
      case "heartbeat":
        result = await handleHeartbeat(body, supabase);
        break;
      case "getSession":
        result = await handleGetSession(body, supabase);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[agora-stream] UNCAUGHT ERROR:", err);
    console.error("[agora-stack] stack:", err?.stack);
    const status = err.message?.includes("not found") || err.message?.includes("Missing") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error", stack: err?.stack }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});