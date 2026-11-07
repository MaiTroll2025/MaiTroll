import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@^2.0.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getAudienceUid(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(index);
    hash |= 0;
  }
  return 1_000_000_000 + (Math.abs(hash) % 3_000_000_000);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleCorsPreflight(req);
  if (req.method !== "POST") return withCors({ error: "Method not allowed" }, 405, req);

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return withCors({ error: "Missing authorization token" }, 401, req);

    const { data: { user }, error: authError } = await supabase.auth.getUser(match[1]);
    if (authError || !user) return withCors({ error: "Unauthorized" }, 401, req);

    const body = await req.json();
    if (typeof body.eventId !== "string" || typeof body.channel !== "string") {
      return withCors({ error: "An event and channel are required" }, 400, req);
    }

    const { data: event, error: eventError } = await supabase
      .from("mai_calendar_events")
      .select("id, status, visibility, is_official, agora_channel, official_host_id, max_guest_slots")
      .eq("id", body.eventId)
      .maybeSingle();

    if (eventError) {
      console.error("[official-event-token] Event lookup failed:", eventError);
      return withCors({ error: "Unable to verify official event" }, 500, req);
    }
    const isHost = event?.official_host_id === user.id;
    const canJoinBeforeStart = event?.status === "upcoming" &&
      isHost &&
      body.role === "publisher";
    if (
      !event ||
      event.is_official !== true ||
      event.visibility !== "public" ||
      (event.status !== "live" && !canJoinBeforeStart) ||
      !event.agora_channel ||
      event.agora_channel !== body.channel
    ) {
      return withCors({ error: "Official event is not live or channel is invalid" }, 403, req);
    }

    let uid: number;
    let role = RtcRole.SUBSCRIBER;
    if (isHost) {
      uid = 1;
      role = RtcRole.PUBLISHER;
    } else {
      const { data: participant, error: participantError } = await supabase
        .from("mai_official_event_participants")
        .select("status, assigned_slot")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (participantError) {
        console.error("[official-event-token] Participant lookup failed:", participantError);
        return withCors({ error: "Unable to verify event participant" }, 500, req);
      }

      const slot = participant?.status === "approved" &&
        Number.isInteger(participant.assigned_slot) &&
        participant.assigned_slot >= 1 &&
        participant.assigned_slot <= event.max_guest_slots
        ? participant.assigned_slot
        : null;

      if (body.role === "publisher" && slot === null) {
        return withCors({ error: "An approved guest slot is required to publish" }, 403, req);
      }

      if (slot !== null) {
        uid = slot + 1;
        role = RtcRole.PUBLISHER;
      } else {
        uid = getAudienceUid(user.id);
      }
    }

    const appId = Deno.env.get("VITE_AGORA_APP_ID") || Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("VITE_AGORA_APP_CERTIFICATE") || Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!appId || !appCertificate) {
      console.error("[official-event-token] Agora credentials are not configured");
      return withCors({ error: "Agora token service misconfigured" }, 500, req);
    }

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      event.agora_channel,
      uid,
      role,
      3600,
    );

    return withCors({
      token,
      appId,
      channelName: event.agora_channel,
      uid,
      eventId: event.id,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    }, 200, req);
  } catch (error) {
    console.error("[official-event-token] Request failed:", error);
    return withCors({ error: "Failed to generate official event token" }, 500, req);
  }
});
