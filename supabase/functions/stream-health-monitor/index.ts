import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const AGORA_CUSTOMER_ID = Deno.env.get("AGORA_CUSTOMER_ID") ?? "";
const AGORA_CUSTOMER_SECRET = Deno.env.get("AGORA_CUSTOMER_SECRET") ?? "";
const AGORA_BASE_URL = Deno.env.get("AGORA_BASE_URL") ?? "https://api.agora.io";
const AGORA_REGION = (Deno.env.get("AGORA_REGION") ?? "na").toLowerCase();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function basicAuth(): string {
  return `Basic ${btoa(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`)}`;
}

async function getStreamKeyStatus(streamKey: string): Promise<{
  exists: boolean;
  expired: boolean;
  expiresAt: number | null;
}> {
  const url = `${AGORA_BASE_URL}/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": basicAuth(),
      "X-Request-ID": crypto.randomUUID(),
    },
  });

  if (res.status === 404) {
    return { exists: false, expired: true, expiresAt: null };
  }

  if (res.status >= 400) {
    console.error("[stream-health-monitor] getStreamKeyStatus failed:", res.status);
    return { exists: false, expired: true, expiresAt: null };
  }

  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!data) {
    return { exists: false, expired: true, expiresAt: null };
  }

  const createdAt = data.createdAt as number | undefined;
  const expiresAfter = data.expiresAfter as number | undefined;

  if (expiresAfter === 0) {
    return { exists: true, expired: false, expiresAt: null };
  }

  if (createdAt && expiresAfter) {
    const expiresAt = createdAt + expiresAfter;
    const now = Math.floor(Date.now() / 1000);
    return { exists: true, expired: now > expiresAt, expiresAt };
  }

  return { exists: true, expired: false, expiresAt: null };
}

async function getRtlsStreamStatus(channel: string, _streamKey: string): Promise<{
  isActive: boolean;
  bitrateKbps: number | null;
  fps: number | null;
  resolution: string | null;
  raw: Record<string, unknown> | null;
}> {
  // Query Agora RTLS ingress status for the channel
  const url = `${AGORA_BASE_URL}/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/channels/${encodeURIComponent(channel)}/status`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": basicAuth(),
        "X-Request-ID": crypto.randomUUID(),
      },
    });

    if (res.status === 404) {
      // Channel not found — no active ingress
      return { isActive: false, bitrateKbps: null, fps: null, resolution: null, raw: null };
    }

    if (res.status >= 400) {
      console.warn("[stream-health-monitor] getRtlsStreamStatus failed:", res.status);
      return { isActive: false, bitrateKbps: null, fps: null, resolution: null, raw: null };
    }

    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!data) {
      return { isActive: false, bitrateKbps: null, fps: null, resolution: null, raw: null };
    }

    // Check if the stream is actively publishing
    const status = String(data?.status || data?.state || data?.streamStatus || "").toLowerCase();
    const isActive = status === "active" || status === "publishing" || status === "streaming" || status === "connected" || status === "live";

    // Extract bitrate from various possible response shapes
    const bitrateRaw = data?.bitrate ?? data?.bitrateKbps ?? data?.currentBitrate ?? data?.ingestBitrate
      ?? data?.stats?.bitrate ?? data?.stats?.bitrateKbps ?? data?.metrics?.bitrate;
    const bitrateKbps = bitrateRaw != null ? Number(bitrateRaw) : null;

    // Extract FPS
    const fpsRaw = data?.fps ?? data?.currentFps ?? data?.stats?.fps ?? data?.metrics?.fps;
    const fps = fpsRaw != null ? Number(fpsRaw) : null;

    // Extract resolution
    const width = data?.width ?? data?.videoWidth ?? data?.stats?.width;
    const height = data?.height ?? data?.videoHeight ?? data?.stats?.height;
    const resolution = width && height ? `${width}x${height}` : null;

    return { isActive: isActive || false, bitrateKbps: bitrateKbps ?? null, fps: fps ?? null, resolution, raw: data };
  } catch (err) {
    console.error("[stream-health-monitor] getRtlsStreamStatus exception:", err);
    return { isActive: false, bitrateKbps: null, fps: null, resolution: null, raw: null };
  }
}

async function createNewStreamKey(channel: string, ttlSeconds: number): Promise<string | null> {
  const url = `${AGORA_BASE_URL}/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys`;

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
        expiresAfter: ttlSeconds,
      },
    }),
  });

  if (res.status >= 400) {
    const errBody = await res.json().catch(() => null);
    console.error("[stream-health-monitor] createNewStreamKey failed:", res.status, JSON.stringify(errBody));
    return null;
  }

  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  return (data?.streamKey as string | undefined) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action;
    const supabase = getSupabaseClient();

    if (action === "checkStream") {
      const streamId: string = body?.streamId;
      const streamKey: string = body?.streamKey;
      const channel: string = body?.channel ?? (streamId ? `gaming_${streamId}` : "");

      if (!streamKey) {
        return new Response(
          JSON.stringify({ ok: false, status: "no_key", message: "No stream key configured" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const keyStatus = await getStreamKeyStatus(streamKey);

      if (!keyStatus.exists || keyStatus.expired) {
        return new Response(
          JSON.stringify({
            ok: false,
            status: "key_invalid",
            message: keyStatus.expired ? "Stream key expired" : "Stream key not found",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: stream } = await supabase
        .from("streams")
        .select("id, status, is_live, updated_at")
        .eq("id", streamId)
        .maybeSingle();

      const isLive = stream?.is_live === true;

      // Check actual Agora RTLS ingress status — this is the ground truth for whether
      // OBS is actively pushing video into the Agora channel.
      const rtlsStatus = await getRtlsStreamStatus(channel, streamKey);

      // OBS is considered connected ONLY if:
      // 1. The stream is explicitly live (is_live=true), OR
      // 2. The Agora RTLS ingress reports the channel as actively streaming
      const obsConnected = isLive || rtlsStatus.isActive;

      // If the stream was previously marked connected/live but RTLS shows inactive, reset
      if (!rtlsStatus.isActive && !isLive && (stream?.status === "connected" || stream?.status === "live")) {
        await supabase
          .from("streams")
          .update({
            status: "waiting",
            is_live: false,
          })
          .eq("id", streamId);

        return new Response(
          JSON.stringify({
            ok: false,
            status: "disconnected",
            message: "OBS stream signal lost — Agora channel is not receiving data",
            keyStatus: "valid",
            obsConnected: false,
            rtlsActive: rtlsStatus.isActive,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: obsConnected || isLive,
          status: isLive ? "live" : obsConnected ? "connected" : "waiting",
          keyStatus: "valid",
          keyExpiresAt: keyStatus.expiresAt,
          obsConnected,
          rtlsActive: rtlsStatus.isActive,
          rtlsBitrateKbps: rtlsStatus.bitrateKbps,
          rtlsFps: rtlsStatus.fps,
          rtlsResolution: rtlsStatus.resolution,
          streamStatus: stream?.status ?? "unknown",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "heartbeat") {
      const streamId: string = body?.streamId;

      if (!streamId) {
        return new Response(
          JSON.stringify({ error: "Missing streamId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("streams")
        .update({
          updated_at: now,
        })
        .eq("id", streamId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "cleanupStream") {
      const streamId: string = body?.streamId;
      const streamKey: string = body?.streamKey;

      if (!streamId && !streamKey) {
        return new Response(
          JSON.stringify({ error: "Missing streamId or streamKey" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (streamKey) {
        const deleteUrl = `${AGORA_BASE_URL}/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`;
        await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            "Authorization": basicAuth(),
            "X-Request-ID": crypto.randomUUID(),
          },
        });
      }

      if (streamId) {
        await supabase
          .from("streams")
          .update({
            status: "ended",
            is_live: false,
            stream_key: null,
            ended_at: new Date().toISOString(),
          })
          .eq("id", streamId);
      }

      return new Response(
        JSON.stringify({ ok: true, message: "Stream cleaned up" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "getActiveStreams") {
      const { data: streams, error } = await supabase
        .from("streams")
        .select("id, stream_key, agora_channel, status, is_live, updated_at, user_id, title, category")
        .in("status", ["connected", "live", "starting"])
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const staleThreshold = new Date(Date.now() - 60000).toISOString();
      const activeStreams = (streams ?? []).filter((s) =>
        new Date(s.updated_at).getTime() > new Date(staleThreshold).getTime()
      );
      const staleStreams = (streams ?? []).filter((s) =>
        new Date(s.updated_at).getTime() <= new Date(staleThreshold).getTime()
      );

      return new Response(
        JSON.stringify({
          ok: true,
          active: activeStreams.length,
          stale: staleStreams.length,
          streams: activeStreams,
          staleStreamIds: staleStreams.map((s) => s.id),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "renewStreamKey") {
      const streamId: string = body?.streamId;
      const channel: string = body?.channel;
      const _oldStreamKey: string = body?.oldStreamKey;
      const ttlSeconds: number = body?.ttlSeconds ?? 86400;

      if (!channel) {
        return new Response(
          JSON.stringify({ error: "Missing channel" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const newKey = await createNewStreamKey(channel, ttlSeconds);
      if (!newKey) {
        return new Response(
          JSON.stringify({ error: "Failed to create new stream key" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (streamId) {
        await supabase
          .from("streams")
          .update({ stream_key: newKey })
          .eq("id", streamId);
      }

      return new Response(
        JSON.stringify({ ok: true, streamKey: newKey }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[stream-health-monitor] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
