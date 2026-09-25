import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function deleteLiveKitRoom(roomName: string): Promise<boolean> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    console.warn("[broadcast-expiration-cron] LiveKit credentials not configured, skipping room deletion");
    return false;
  }

  try {
    const auth = btoa(`${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}`);
    const url = `${LIVEKIT_URL}/twirp/livekit.RoomService/DeleteRoom`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room: roomName }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[broadcast-expiration-cron] Failed to delete LiveKit room ${roomName}:`, errText);
      return false;
    }

    console.log(`[broadcast-expiration-cron] Deleted LiveKit room: ${roomName}`);
    return true;
  } catch (err) {
    console.error(`[broadcast-expiration-cron] Error deleting LiveKit room ${roomName}:`, err);
    return false;
  }
}

async function getLiveKitRoomName(streamId: string): Promise<string> {
  return `stream_${streamId}`;
}

serve(async (req: Request): Promise<Response> => {
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
    const action: string = body?.action ?? "run";

    const supabase = getSupabaseClient();

    if (action === "run") {
      const now = new Date().toISOString();

      const { data: expiredStreams, error: fetchError } = await supabase
        .from("streams")
        .select("id, user_id, broadcast_type, battle_id, is_battle, battle_status, livekit_room_name")
        .not("broadcast_expires_at", "is", null)
        .is("ended_at", null)
        .eq("status", "live")
        .eq("is_live", true)
        .lte("broadcast_expires_at", now);

      if (fetchError) throw fetchError;

      if (!expiredStreams || expiredStreams.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, message: "No expired broadcasts found", ended: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let endedCount = 0;
      const results: Array<{ streamId: string; success: boolean; error?: string }> = [];

      for (const stream of expiredStreams) {
        const isBattleActive = stream.is_battle && stream.battle_status && ["starting", "active"].includes(stream.battle_status);

        if (isBattleActive) {
          console.log(`[broadcast-expiration-cron] Stream ${stream.id} has active battle (${stream.battle_status}), skipping automatic end`);
          results.push({ streamId: stream.id, success: false, error: "Active battle - will end after battle completes" });
          continue;
        }

        try {
          const roomName = stream.livekit_room_name || await getLiveKitRoomName(stream.id);

          await deleteLiveKitRoom(roomName);

          const { error: updateError } = await supabase
            .from("streams")
            .update({
              status: "ended",
              is_live: false,
              ended_at: now,
              ended_reason: "automatic_50_minute_reset",
              rtc_connected: false,
              camera_enabled: false,
              microphone_enabled: false,
            })
            .eq("id", stream.id);

          if (updateError) throw updateError;

          await supabase.from("podcast_rtc_logs").insert({
            podcast_id: stream.id,
            user_id: stream.user_id,
            username: (await supabase.from("user_profiles").select("username").eq("id", stream.user_id).maybeSingle()).data?.username ?? "",
            role: (await supabase.from("user_profiles").select("role").eq("id", stream.user_id).maybeSingle()).data?.role ?? "",
            level: (await supabase.from("user_profiles").select("level").eq("id", stream.user_id).maybeSingle()).data?.level ?? 1,
            event_type: "broadcast_ended",
            message: `Broadcast automatically ended at 50-minute limit`,
            metadata: {
              broadcast_type: stream.broadcast_type,
              ended_reason: "automatic_50_minute_reset",
              battle_active: stream.is_battle,
              livekit_room: roomName,
            },
          });

          await supabase.channel("rtc-admin-monitor").send({
            type: "broadcast",
            event: "broadcast_ended",
            payload: {
              stream_id: stream.id,
              broadcaster_id: stream.user_id,
              ended_at: now,
              reason: "automatic_50_minute_reset",
              broadcast_type: stream.broadcast_type,
            },
          });

          endedCount++;
          results.push({ streamId: stream.id, success: true });
          console.log(`[broadcast-expiration-cron] Ended broadcast ${stream.id} (type: ${stream.broadcast_type})`);
        } catch (err) {
          console.error(`[broadcast-expiration-cron] Failed to end broadcast ${stream.id}:`, err);
          results.push({ streamId: stream.id, success: false, error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({ ok: true, ended: endedCount, results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "check") {
      const { data: streams, error } = await supabase
        .from("streams")
        .select("id, user_id, broadcast_type, broadcast_expires_at, status, is_live, is_battle, battle_status")
        .not("broadcast_expires_at", "is", null)
        .is("ended_at", null)
        .eq("status", "live")
        .eq("is_live", true)
        .order("broadcast_expires_at", { ascending: true })
        .limit(20);

      if (error) throw error;

      const now = new Date().getTime();
      const expiring = (streams ?? []).map((s) => ({
        streamId: s.id,
        broadcastType: s.broadcast_type,
        expiresAt: s.broadcast_expires_at,
        timeRemainingMs: new Date(s.broadcast_expires_at).getTime() - now,
        isBattleActive: s.is_battle && s.battle_status && ["starting", "active"].includes(s.battle_status),
      }));

      return new Response(
        JSON.stringify({ ok: true, expiring, count: expiring.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "end_stream") {
      const streamId: string = body?.streamId;
      const reason: string = body?.reason ?? "admin_end";

      if (!streamId) {
        return new Response(
          JSON.stringify({ error: "Missing streamId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: stream, error: fetchError } = await supabase
        .from("streams")
        .select("id, user_id, broadcast_type, livekit_room_name")
        .eq("id", streamId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!stream) {
        return new Response(
          JSON.stringify({ error: "Stream not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const roomName = stream.livekit_room_name || await getLiveKitRoomName(stream.id);
      await deleteLiveKitRoom(roomName);

      const { error: updateError } = await supabase
        .from("streams")
        .update({
          status: "ended",
          is_live: false,
          ended_at: new Date().toISOString(),
          ended_reason: reason,
          rtc_connected: false,
          camera_enabled: false,
          microphone_enabled: false,
        })
        .eq("id", streamId);

      if (updateError) throw updateError;

      await supabase.channel("rtc-admin-monitor").send({
        type: "broadcast",
        event: "broadcast_ended",
        payload: {
          stream_id: streamId,
          broadcaster_id: stream.user_id,
          ended_at: new Date().toISOString(),
          reason,
          broadcast_type: stream.broadcast_type,
        },
      });

      return new Response(
        JSON.stringify({ ok: true, message: "Stream ended" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[broadcast-expiration-cron] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});