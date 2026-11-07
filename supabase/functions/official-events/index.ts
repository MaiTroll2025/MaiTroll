import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type User = { id: string; is_anonymous?: boolean };
type Profile = {
  role: string | null;
  is_admin: boolean | null;
  is_secretary: boolean | null;
  is_ceo_assistant: boolean | null;
  is_noah_assistant: boolean | null;
  is_lead_officer: boolean | null;
  is_banned?: boolean | null;
};

function respond(body: unknown, status: number, req: Request) {
  return withCors(body, status, req);
}

async function authenticate(req: Request): Promise<User | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !serviceRoleKey) return null;
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, is_anonymous: data.user.is_anonymous };
}

async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("role, is_admin, is_secretary, is_ceo_assistant, is_noah_assistant, is_lead_officer, is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

function isAdmin(profile: Profile | null): boolean {
  return profile?.is_admin === true || profile?.role === "admin";
}

function isStaff(profile: Profile | null): boolean {
  return isAdmin(profile) ||
    profile?.role === "secretary" ||
    profile?.role === "ceo_assistant" ||
    profile?.role === "noah_assistant" ||
    profile?.is_secretary === true ||
    profile?.is_ceo_assistant === true ||
    profile?.is_noah_assistant === true ||
    profile?.is_lead_officer === true ||
    profile?.role === "lead_troll_officer";
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function getPublicEvent(idOrSlug: string) {
  let query = adminClient
    .from("mai_calendar_events")
    .select("id, slug, title, description, category, banner_url, starts_at, ends_at, timezone, location, status, visibility, is_official, agora_channel, official_host_id, live_started_at, live_ended_at, max_guest_slots")
    .eq("is_official", true);
  query = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)
    ? query.eq("id", idOrSlug)
    : query.eq("slug", idOrSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreflight(req);
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, req);
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ error: "Official event service is not configured" }, 500, req);
  }

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";
    const user = await authenticate(req);
    const profile = user ? await getProfile(user.id) : null;

    if (user && profile?.is_banned) return respond({ error: "This account cannot access official events" }, 403, req);

    if (action === "list") {
      const { data, error } = await adminClient
        .from("mai_calendar_events")
        .select("id, slug, title, description, category, banner_url, starts_at, ends_at, timezone, location, status, visibility, is_official, agora_channel, official_host_id, live_started_at, live_ended_at, max_guest_slots")
        .eq("is_official", true)
        .eq("visibility", "public")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return respond({ events: data ?? [] }, 200, req);
    }

    if (action === "create") {
      if (!user || !isAdmin(profile)) return respond({ error: "Admin access required" }, 403, req);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const startsAt = typeof body.starts_at === "string" ? new Date(body.starts_at) : null;
      const endsAt = typeof body.ends_at === "string" ? new Date(body.ends_at) : null;
      const timezone = typeof body.timezone === "string" ? body.timezone.trim().slice(0, 100) : "UTC";
      if (!title || title.length > 160 || !startsAt || !endsAt ||
        Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) ||
        endsAt <= startsAt) {
        return respond({ error: "Enter a title and a valid event start/end time" }, 400, req);
      }
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(startsAt);
      } catch {
        return respond({ error: "Enter a valid event time zone" }, 400, req);
      }

      const slug = `${slugify(title) || "official-event"}-${crypto.randomUUID().slice(0, 8)}`;
      const channel = `mai-event-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
      const { data, error } = await adminClient
        .from("mai_calendar_events")
        .insert({
          slug,
          title,
          description: typeof body.description === "string" ? body.description.trim().slice(0, 5000) : null,
          category: "official_event",
          banner_url: typeof body.banner_url === "string" ? body.banner_url : null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          timezone,
          location: typeof body.location === "string" ? body.location.trim().slice(0, 200) : "MaiTroll Live",
          status: "upcoming",
          visibility: "public",
          published_at: new Date().toISOString(),
          created_by: user.id,
          updated_by: user.id,
          is_official: true,
          agora_channel: channel,
          official_host_id: user.id,
          max_guest_slots: 8,
        })
        .select("*")
        .single();
      if (error) throw error;
      return respond({ event: data }, 201, req);
    }

    if (action === "detail") {
      const key = typeof body.event === "string" ? body.event : "";
      if (!key) return respond({ error: "Event is required" }, 400, req);
      const event = await getPublicEvent(key);
      if (!event || (event.visibility !== "public" && !isStaff(profile))) {
        return respond({ error: "Official event not found" }, 404, req);
      }

      const [participantsResult, messagesResult, balanceResult, selfResult] = await Promise.all([
        adminClient
          .from("mai_official_event_participants")
          .select("user_id, display_name, status, assigned_slot, created_at")
          .eq("event_id", event.id)
          .in("status", isStaff(profile) ? ["requested", "approved"] : ["approved"])
          .order("created_at", { ascending: true }),
        adminClient
          .from("mai_official_event_messages")
          .select("id, sender_id, display_name, content, created_at")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false })
          .limit(100),
        user ? adminClient.from("user_profiles").select("free_coin_balance").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        user ? adminClient.from("mai_official_event_participants").select("status, assigned_slot").eq("event_id", event.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      for (const result of [participantsResult, messagesResult, balanceResult, selfResult]) {
        if (result.error) throw result.error;
      }

      const participantIds = (participantsResult.data ?? []).map((participant) => participant.user_id);
      const { data: participantProfiles, error: participantProfilesError } = participantIds.length > 0
        ? await adminClient.from("user_profiles").select("id").in("id", participantIds)
        : { data: [], error: null };
      if (participantProfilesError) throw participantProfilesError;
      const participantsWithWallet = new Set((participantProfiles ?? []).map((participant) => participant.id));

      return respond({
        event,
        participants: (participantsResult.data ?? []).map((participant) => ({
          ...participant,
          can_receive_gifts: participantsWithWallet.has(participant.user_id),
        })),
        messages: (messagesResult.data ?? []).reverse(),
        myParticipant: selfResult.data ?? null,
        freeCoinBalance: Number(balanceResult.data?.free_coin_balance ?? 0),
      }, 200, req);
    }

    if (!user) return respond({ error: "Authentication required" }, 401, req);

    const eventKey = typeof body.event === "string" ? body.event : "";
    if (!eventKey) return respond({ error: "Event is required" }, 400, req);
    const event = await getPublicEvent(eventKey);
    if (!event || event.visibility !== "public") return respond({ error: "Official event not found" }, 404, req);

    if (action === "start" || action === "stop") {
      if (!isAdmin(profile)) return respond({ error: "Admin access required" }, 403, req);
      if (action === "start") {
        if (event.status === "live") return respond({ event }, 200, req);
        if (event.status !== "upcoming") return respond({ error: "Only upcoming events can be started" }, 409, req);
        const { data, error } = await adminClient
          .from("mai_calendar_events")
          .update({ status: "live", live_started_at: new Date().toISOString(), live_ended_at: null, updated_by: user.id })
          .eq("id", event.id)
          .eq("status", "upcoming")
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!data) return respond({ error: "Event state changed; refresh and try again" }, 409, req);
        return respond({ event: data }, 200, req);
      }
      if (event.status === "completed") return respond({ event }, 200, req);
      if (event.status !== "live") return respond({ error: "Only live events can be ended" }, 409, req);
      const { data, error } = await adminClient
        .from("mai_calendar_events")
        .update({ status: "completed", live_ended_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", event.id)
        .eq("status", "live")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: "Event state changed; refresh and try again" }, 409, req);
      return respond({ event: data }, 200, req);
    }

    if (action === "request") {
      if (!["upcoming", "live"].includes(event.status)) {
        return respond({ error: "This event is not accepting guest requests" }, 409, req);
      }
      const { data: existing, error: existingError } = await adminClient
        .from("mai_official_event_participants")
        .select("status, assigned_slot")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        if (existing.status === "rejected" || existing.status === "removed") {
          return respond({ error: "This guest request is no longer active" }, 409, req);
        }
        return respond({ participant: existing }, 200, req);
      }

      const rawName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      const displayName = (rawName || `Guest ${user.id.slice(0, 6)}`).slice(0, 80);
      const { error: insertError } = await adminClient
        .from("mai_official_event_participants")
        .upsert(
          { event_id: event.id, user_id: user.id, display_name: displayName },
          { onConflict: "event_id,user_id", ignoreDuplicates: true },
        );
      if (insertError) throw insertError;
      const { data, error } = await adminClient
        .from("mai_official_event_participants")
        .select("status, assigned_slot")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return respond({ participant: data }, 200, req);
    }

    if (action === "approve" || action === "reject" || action === "remove") {
      if (!isStaff(profile)) return respond({ error: "Staff access required" }, 403, req);
      const participantId = typeof body.user_id === "string" ? body.user_id : "";
      if (!participantId) return respond({ error: "Participant is required" }, 400, req);
      if (action === "approve") {
        const { data, error } = await adminClient.rpc("approve_mai_official_event_participant", {
          p_event_id: event.id,
          p_user_id: participantId,
        });
        if (error) throw error;
        return respond({ participant: data?.[0] ?? null }, 200, req);
      }
      const { data, error } = await adminClient
        .from("mai_official_event_participants")
        .update({
          status: action === "reject" ? "rejected" : "removed",
          assigned_slot: null,
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", event.id)
        .eq("user_id", participantId)
        .eq("status", action === "reject" ? "requested" : "approved")
        .select("user_id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: "Participant state changed; refresh and try again" }, 409, req);
      return respond({ participant: data }, 200, req);
    }

    if (action === "chat") {
      if (event.status !== "live") return respond({ error: "Chat is only available while the event is live" }, 409, req);
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content || content.length > 1000) return respond({ error: "Message must be 1–1000 characters" }, 400, req);
      const { data: senderProfile, error: senderError } = await adminClient
        .from("user_profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (senderError) throw senderError;
      const displayName = senderProfile?.username || `Guest ${user.id.slice(0, 6)}`;
      const { data, error } = await adminClient.rpc("post_mai_official_event_message", {
        p_event_id: event.id,
        p_sender_id: user.id,
        p_display_name: displayName,
        p_content: content,
      });
      if (error?.message.includes("Please wait")) {
        return respond({ error: "Please wait before sending another message" }, 429, req);
      }
      if (error) throw error;
      return respond({ message: data?.[0] ?? null }, 201, req);
    }

    if (action === "moderate_chat") {
      if (!isStaff(profile)) return respond({ error: "Staff access required" }, 403, req);
      const messageId = typeof body.message_id === "string" ? body.message_id : "";
      if (!messageId) return respond({ error: "Message is required" }, 400, req);
      const { data, error } = await adminClient
        .from("mai_official_event_messages")
        .delete()
        .eq("event_id", event.id)
        .eq("id", messageId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: "Message not found" }, 404, req);
      return respond({ success: true }, 200, req);
    }

    if (action === "gift") {
      const recipientId = typeof body.recipient_id === "string" ? body.recipient_id : "";
      const amount = Number(body.amount);
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      if (!recipientId || !Number.isInteger(amount) || !requestId) {
        return respond({ error: "Invalid gift request" }, 400, req);
      }
      const { data, error } = await adminClient.rpc("send_mai_official_event_gift", {
        p_event_id: event.id,
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_amount: amount,
        p_request_id: requestId,
      });
      if (error) throw error;
      return respond({ gift: data?.[0] ?? null }, 200, req);
    }

    return respond({ error: "Unsupported action" }, 400, req);
  } catch (error) {
    console.error("[official-events] Request failed:", error);
    return respond({ error: error instanceof Error ? error.message : "Official event request failed" }, 500, req);
  }
});
