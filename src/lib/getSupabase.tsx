import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") ?? "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

console.log("[livekit-gaming] ENV:", JSON.stringify({
  hasSupabaseUrl: !!SUPABASE_URL,
  hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
  hasLivekitUrl: !!LIVEKIT_URL,
  hasLivekitApiKey: !!LIVEKIT_API_KEY,
  hasLivekitApiSecret: !!LIVEKIT_API_SECRET,
}));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function liveKitHeaders(): Record<string, string> {
  const key = LIVEKIT_API_KEY;
  const secret = LIVEKIT_API_SECRET;
  const encoded = btoa(`${key}:${secret}`);
  return {
    "Authorization": `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

function livekitHttpUrl(): string {
  return LIVEKIT_URL.replace(/^wss?:\/\//, "https://");
}

async function createLiveKitIngest(roomName: string): Promise<{ rtmpUrl: string; streamKey: string }> {
  const url = `${livekitHttpUrl()}/api/ingress/rtmp`;
  console.log(`[livekit-gaming] createLiveKitIngest: room=${roomName}`);

  const res = await fetch(url, {
    method: "POST",
    headers: liveKitHeaders(),
    body: JSON.stringify({
      room_name: roomName,
      ingress_type: "rtmp",
    }),
  });

  const body = await res.json().catch(() => null);
  console.log(`[livekit-gaming] createLiveKitIngest: status=${res.status}, body=${JSON.stringify(body)?.slice(0, 500)}`);

  if (res.status >= 400) {
    throw new Error(`LiveKit Ingress error ${res.status}: ${body?.message || "Unknown error"}`);
  }

  const rtmpUrl = body?.ingress?.address || body?.rtmp?.address || body?.address || null;

  // LiveKit generates a stream key per ingress
  const streamKey = body?.ingress?.stream_key || body?.rtmp?.stream_key || body?.stream_key || null;

  if (!rtmpUrl) {
    throw new Error(`LiveKit returned no RTMP URL. Response: ${JSON.stringify(body)}`);
  }

  return { rtmpUrl, streamKey: streamKey || roomName };
}

async function listActiveRooms(): Promise<string[]> {
  const url = `${livekitHttpUrl()}/twirp/livekit.RoomService/ListRooms`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: liveKitHeaders(),
      body: JSON.stringify({}),
    });
    if (res.status >= 400) return [];
    const data = await res.json().catch(() => null);
    return (data?.rooms || []).filter((r: any) => r.num_participants > 0).map((r: any) => r.name);
  } catch {
    return [];
  }
}

// ─── startStream ────────────────────────────────────────────────────────────
async function handleStartStream(body: any, supabase: any) {
  const { streamId, userId, regenerate } = body;
  if (!streamId || !userId) {
    throw new Error("Missing streamId or userId");
  }

  const roomName = streamId;

  // Check for existing active stream for this user in gaming category
  const { data: existingStream } = await supabase
    .from("streams")
    .select("id, livekit_room_name, stream_key, status")
    .eq("id", streamId)
    .in("status", ["starting", "waiting", "signal_detected", "ready", "live"])
    .maybeSingle();

  if (existingStream && !regenerate) {
    console.log(`[livekit-gaming] Found existing stream id=${existingStream.id}`);
    return {
      ok: true,
      existing: true,
      session: {
        id: existingStream.id,
        roomName: existingStream.livekit_room_name,
        streamKey: existingStream.stream_key,
        status: existingStream.status,
        rtmpUrl: null,
      },
    };
  }

  // If regenerating, clear old credentials
  if (regenerate) {
    await supabase
      .from("streams")
      .update({ stream_key: null, status: "starting", is_live: false })
      .eq("id", streamId);
  }

  // Create LiveKit RTMP ingest
  console.log(`[livekit-gaming] Creating LiveKit ingest for room=${roomName}`);
  const { rtmpUrl, streamKey } = await createLiveKitIngest(roomName);
  console.log(`[livekit-gaming] Ingest created: rtmpUrl=${rtmpUrl}`);

  // Update the streams table — same columns as Mai Troll SetupPage uses
  // livekit_room_name stores the room name, stream_key stores the ingest key
  const { error: updateError } = await supabase
    .from("streams")
    .update({
      stream_key: streamKey,
      status: "waiting",
      is_live: false,
      livekit_room_name: roomName,
      category: "gaming",
    })
    .eq("id", streamId);

  if (updateError) {
    console.error(`[livekit-gaming] streams update error:`, updateError);
    throw updateError;
  }

  return {
    ok: true,
    existing: false,
    session: {
      id: streamId,
      roomName: roomName,
      streamKey: streamKey,
      status: "waiting",
      rtmpUrl: rtmpUrl,
    },
  };
}

// ─── checkStatus ────────────────────────────────────────────────────────────
async function handleCheckStatus(body: any, supabase: any) {
  const { sessionId, channel, streamId } = body;
  if (!sessionId && !channel && !streamId) {
    throw new Error("Missing sessionId, channel, or streamId");
  }

  // Look up the stream
  let stream;
  if (streamId) {
    const { data } = await supabase
      .from("streams")
      .select("id, livekit_room_name, stream_key, status, is_live, category")
      .eq("id", streamId)
      .maybeSingle();
    stream = data;
  } else if (channel) {
    const { data } = await supabase
      .from("streams")
      .select("id, livekit_room_name, stream_key, status, is_live, category")
      .eq("livekit_room_name", channel)
      .eq("category", "gaming")
      .maybeSingle();
    stream = data;
  }

  if (!stream) throw new Error("Stream not found");

  // Check if the LiveKit room is active (has participants = OBS is pushing)
  const activeRooms = await listActiveRooms();
  const roomName = stream.livekit_room_name || stream.id;
  const roomActive = activeRooms.includes(roomName);

  let newStatus = stream.status as string;

  if (roomActive) {
    if (["waiting", "starting"].includes(newStatus)) newStatus = "signal_detected";
    else if (newStatus === "signal_detected") newStatus = "ready";
  } else {
    if (newStatus === "live") newStatus = "ended";
    else if (["signal_detected", "ready"].includes(newStatus)) newStatus = "waiting";
  }

  if (newStatus !== stream.status) {
    const updateData: Record<string, any> = { status: newStatus };
    if (newStatus === "ended") {
      updateData.is_live = false;
      updateData.ended_at = new Date().toISOString();
    }
    await supabase
      .from("streams")
      .update(updateData)
      .eq("id", stream.id);
  }

  return {
    ok: true,
    session: {
      id: stream.id,
      roomName: stream.livekit_room_name,
      status: newStatus,
      previousStatus: stream.status,
    },
    ingest: {
      isActive: roomActive,
      bitrateKbps: null,
      fps: null,
      resolution: null,
    },
  };
}

// ─── goLive ─────────────────────────────────────────────────────────────────
async function handleGoLive(body: any, supabase: any) {
  const { sessionId, streamId } = body;
  const targetId = sessionId || streamId;
  if (!targetId) throw new Error("Missing sessionId or streamId");

  const now = new Date().toISOString();

  const { data: stream, error } = await supabase
    .from("streams")
    .update({ status: "live", is_live: true, started_at: now })
    .eq("id", targetId)
    .in("status", ["waiting", "signal_detected", "ready"])
    .select("id, livekit_room_name")
    .single();

  if (error || !stream) throw new Error("Stream not found or not in go-live-able state");

  return {
    ok: true,
    session: {
      id: stream.id,
      roomName: stream.livekit_room_name,
      status: "live",
      startedAt: now,
    },
  };
}

// ─── endStream ──────────────────────────────────────────────────────────────
async function handleEndStream(body: any, supabase: any) {
  const { sessionId, streamId } = body;
  const targetId = sessionId || streamId;
  if (!targetId) throw new Error("Missing sessionId or streamId");

  const { data: stream } = await supabase
    .from("streams")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();

  if (!stream) throw new Error("Stream not found");

  const now = new Date().toISOString();

  await supabase
    .from("streams")
    .update({ status: "ended", is_live: false, ended_at: now })
    .eq("id", targetId);

  return {
    ok: true,
    session: { id: targetId, status: "ended", endedAt: now },
  };
}

// ─── heartbeat ──────────────────────────────────────────────────────────────
async function handleHeartbeat(body: any, supabase: any) {
  const { sessionId, streamId } = body;
  const targetId = sessionId || streamId;
  if (!targetId) throw new Error("Missing sessionId or streamId");

  const { error } = await supabase
    .from("streams")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", targetId);

  if (error) throw error;

  return { ok: true };
}

// ─── getSession ─────────────────────────────────────────────────────────────
async function handleGetSession(body: any, supabase: any) {
  const { streamId, sessionId } = body;
  if (!streamId && !sessionId) throw new Error("Missing streamId or sessionId");

  let query = supabase
    .from("streams")
    .select("id, livekit_room_name, stream_key, status, is_live, category, started_at, ended_at, created_at, updated_at")
    .eq("category", "gaming");

  if (streamId) {
    query = query.eq("id", streamId).order("created_at", { ascending: false });
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  return { ok: true, session: data };
}

// ─── Main ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    console.log(`[livekit-gaming] REQUEST: action=${action}, streamId=${body?.streamId}, sessionId=${body?.sessionId}, userId=${body?.userId}`);
    const supabase = getSupabase();

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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[livekit-gaming] UNCAUGHT ERROR:", err);
    const status = err.message?.includes("not found") || err.message?.includes("Missing") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
