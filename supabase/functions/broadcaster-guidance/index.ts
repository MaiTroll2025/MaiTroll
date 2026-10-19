import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ClientType = "web_desktop" | "mobile_web" | "native";

type GuidanceInstruction = {
  topic: string;
  text: string;
};

type GuidanceDelivery = {
  id: string;
  position: number;
  account_id: string;
  topic: string;
  content: string;
  scheduled_at: string;
  status: "pending" | "delivered" | "rejected" | "cancelled";
  username: string;
  avatar_url: string;
};

const SCHEDULING = {
  messageCount: 3,
  firstDelaySeconds: [2, 4] as const,
  intervalSeconds: [8, 12] as const,
  resumeMinimumSpacingSeconds: 8,
};

const INSTRUCTIONS: Record<ClientType, GuidanceInstruction[]> = {
  web_desktop: [
    {
      topic: "sharing",
      text: "Want more people to find your live? Click Share in the bottom control bar to share your broadcast using the supported share options.",
    },
    {
      topic: "inviting_followers",
      text: "You can invite your followers to watch! Click Invite in the bottom control bar to invite them to your live.",
    },
    {
      topic: "stream_settings",
      text: "Want to explore your broadcast settings? Click More in the bottom control bar to see the options available for your stream.",
    },
    {
      topic: "microphone",
      text: "Use Mute or Unmute in the bottom control bar to turn your microphone off or on.",
    },
    {
      topic: "camera",
      text: "Use Camera or Turn Off in the bottom control bar to turn your camera on or off.",
    },
    {
      topic: "ending",
      text: "When you're ready to finish, choose End Stream in the bottom control bar to end your live.",
    },
  ],
  mobile_web: [
    {
      topic: "sharing",
      text: "Want to share your live? Tap Settings, then Share to open the supported sharing options.",
    },
    {
      topic: "inviting_followers",
      text: "You can invite your followers to watch! Tap Settings, then Invite to send them an invite to your live.",
    },
    {
      topic: "stream_settings",
      text: "Tap Settings to explore the controls and options available for your stream.",
    },
    {
      topic: "microphone",
      text: "Tap Mic or Muted in the bottom control bar to turn your microphone on or off.",
    },
    {
      topic: "camera",
      text: "Tap Cam or Off in the bottom control bar to turn your camera on or off.",
    },
    {
      topic: "guest_seats",
      text: "Tap Settings, then Seats to review the guest seat options available for this stream.",
    },
    {
      topic: "ending",
      text: "When you're ready to finish, tap End in the bottom control bar to end your broadcast.",
    },
  ],
  native: [
    {
      topic: "sharing",
      text: "Want to share your live? Tap Settings, then Share to open the supported sharing options.",
    },
    {
      topic: "inviting_followers",
      text: "You can invite your followers to watch! Tap Settings, then Invite to send them an invite to your live.",
    },
    {
      topic: "stream_settings",
      text: "Tap Settings to explore the controls and options available for your stream.",
    },
    {
      topic: "microphone",
      text: "Tap Mic or Muted in the bottom control bar to turn your microphone on or off.",
    },
    {
      topic: "camera",
      text: "Tap Cam or Off in the bottom control bar to turn your camera on or off.",
    },
    {
      topic: "guest_seats",
      text: "Tap Settings, then Seats to review the guest seat options available for this stream.",
    },
    {
      topic: "ending",
      text: "When you're ready to finish, tap End in the bottom control bar to end your broadcast.",
    },
  ],
};

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isClientType(value: unknown): value is ClientType {
  return value === "web_desktop" || value === "mobile_web" || value === "native";
}

function randomInteger(min: number, max: number): number {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return min + (bytes[0] % (max - min + 1));
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function profileFromAccount(account: Record<string, unknown>) {
  const relation = account.user_profiles;
  return Array.isArray(relation) ? relation[0] : relation;
}

async function loadDeliveries(
  adminClient: ReturnType<typeof createClient>,
  streamId: string,
): Promise<GuidanceDelivery[]> {
  const { data: deliveries, error: deliveriesError } = await adminClient
    .from("broadcaster_guidance_deliveries")
    .select("id, position, account_id, topic, content, scheduled_at, status")
    .eq("stream_id", streamId)
    .order("position", { ascending: true });
  if (deliveriesError) throw new Error(`Unable to load guidance schedule: ${deliveriesError.message}`);
  if (!deliveries?.length) return [];

  const accountIds = [...new Set(deliveries.map((delivery) => delivery.account_id))];
  const { data: accounts, error: accountsError } = await adminClient
    .from("automated_audience_accounts")
    .select("user_id, user_profiles(username, avatar_url)")
    .in("user_id", accountIds);
  if (accountsError) throw new Error(`Unable to load guidance identities: ${accountsError.message}`);

  const identityById = new Map<string, { username: string; avatar_url: string }>();
  for (const account of accounts || []) {
    const profile = profileFromAccount(account as Record<string, unknown>) as
      | { username?: string | null; avatar_url?: string | null }
      | null;
    if (profile?.username && profile.avatar_url) {
      identityById.set(account.user_id, {
        username: profile.username,
        avatar_url: profile.avatar_url,
      });
    }
  }

  return deliveries.map((delivery) => {
    const identity = identityById.get(delivery.account_id);
    if (!identity) {
      throw new Error(`Guidance account identity is missing for delivery ${delivery.id}`);
    }
    return { ...delivery, ...identity } as GuidanceDelivery;
  });
}

async function createSchedule(
  adminClient: ReturnType<typeof createClient>,
  streamId: string,
  broadcasterId: string,
  clientType: ClientType,
): Promise<{ created: boolean; messages: GuidanceDelivery[] }> {
  const { data: existingSequence, error: sequenceLookupError } = await adminClient
    .from("broadcaster_guidance_sequences")
    .select("stream_id")
    .eq("stream_id", streamId)
    .maybeSingle();
  if (sequenceLookupError) throw new Error(`Unable to check guidance idempotency: ${sequenceLookupError.message}`);
  if (existingSequence) {
    return { created: false, messages: await loadDeliveries(adminClient, streamId) };
  }

  const { data: accounts, error: accountsError } = await adminClient
    .from("automated_audience_accounts")
    .select("user_id, user_profiles(username, avatar_url)")
    .eq("enabled", true);
  if (accountsError) throw new Error(`Unable to load existing guidance accounts: ${accountsError.message}`);

  const eligibleAccounts = (accounts || []).filter((account) => {
    const profile = profileFromAccount(account as Record<string, unknown>) as
      | { username?: string | null; avatar_url?: string | null }
      | null;
    return Boolean(profile?.username && profile.avatar_url);
  });
  if (eligibleAccounts.length === 0) {
    throw new Error("No enabled, registered automated accounts are available for guidance");
  }

  const selectedAccounts = shuffled(eligibleAccounts).slice(0, SCHEDULING.messageCount);
  const selectedInstructions = shuffled(INSTRUCTIONS[clientType])
    .slice(0, selectedAccounts.length);
  let delaySeconds = randomInteger(...SCHEDULING.firstDelaySeconds);
  const plan = selectedAccounts.map((account, index) => {
    if (index > 0) delaySeconds += randomInteger(...SCHEDULING.intervalSeconds);
    const instruction = selectedInstructions[index];
    return {
      position: index + 1,
      account_id: account.user_id,
      topic: instruction.topic,
      content: instruction.text,
      delay_seconds: delaySeconds,
    };
  });

  const { data: startResult, error: startError } = await adminClient.rpc("start_broadcaster_guidance", {
    p_stream_id: streamId,
    p_broadcaster_id: broadcasterId,
    p_client_type: clientType,
    p_plan: plan,
  });
  if (startError) throw new Error(`Unable to start broadcaster guidance: ${startError.message}`);

  return {
    created: startResult?.created === true,
    messages: await loadDeliveries(adminClient, streamId),
  };
}

async function publishChatMessage(
  adminClient: ReturnType<typeof createClient>,
  streamId: string,
  message: Record<string, unknown>,
) {
  const channel = adminClient.channel(`stream-chat:${streamId}`);
  try {
    const result = await channel.send({
      type: "broadcast",
      event: "chat",
      payload: message,
    });
    if (result !== "ok") {
      throw new Error(`Realtime chat publication returned ${result}`);
    }
  } finally {
    await adminClient.removeChannel(channel);
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request.headers.get("origin")) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[broadcaster-guidance] Missing server configuration");
    return jsonResponse(request, { success: false, error: "Server configuration error" }, 500);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) {
    return jsonResponse(request, { success: false, error: "Authentication is required" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) {
    return jsonResponse(request, { success: false, error: "Invalid authentication" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { success: false, error: "Invalid JSON body" }, 400);
  }

  const action = body.action;
  const streamId = body.streamId;
  if (!isUuid(streamId)) {
    return jsonResponse(request, { success: false, error: "A valid streamId is required" }, 400);
  }

  try {
    const { data: stream, error: streamError } = await adminClient
      .from("streams")
      .select("*")
      .eq("id", streamId)
      .maybeSingle();
    if (streamError) throw new Error(`Unable to validate broadcast: ${streamError.message}`);
    if (!stream) return jsonResponse(request, { success: false, error: "Broadcast not found" }, 404);

    const broadcasterId = stream.broadcaster_id || stream.user_id;
    if (broadcasterId !== user.id) {
      return jsonResponse(request, { success: false, error: "Broadcast does not belong to this account" }, 403);
    }

    if (action === "start") {
      if (!isClientType(body.clientType)) {
        return jsonResponse(request, { success: false, error: "Unsupported broadcast client type" }, 400);
      }
      if (stream.status !== "live" || stream.is_live !== true) {
        return jsonResponse(request, { success: false, error: "Broadcast must be live before guidance starts" }, 409);
      }
      const startedAt = Date.parse(String(stream.started_at || ""));
      if (!Number.isFinite(startedAt) || Date.now() - startedAt > 120_000) {
        const { data: existing, error: existingError } = await adminClient
          .from("broadcaster_guidance_sequences")
          .select("stream_id")
          .eq("stream_id", streamId)
          .maybeSingle();
        if (existingError) {
          throw new Error(`Unable to check guidance idempotency: ${existingError.message}`);
        }
        if (!existing) {
          return jsonResponse(request, { success: true, started: false, messages: [] });
        }
      }

      const schedule = await createSchedule(adminClient, streamId, user.id, body.clientType);
      if (Deno.env.get("ENVIRONMENT") === "development") {
        console.debug("[broadcaster-guidance] Sequence ready", {
          streamId,
          clientType: body.clientType,
          created: schedule.created,
          messages: schedule.messages.map((message) => ({
            accountId: message.account_id,
            username: message.username,
            topic: message.topic,
            status: message.status,
          })),
        });
      }
      return jsonResponse(request, {
        success: true,
        started: schedule.created,
        minimumSpacingSeconds: SCHEDULING.resumeMinimumSpacingSeconds,
        messages: schedule.messages,
      });
    }

    if (action === "dispatch") {
      const messageId = body.messageId;
      if (!isUuid(messageId)) {
        return jsonResponse(request, { success: false, error: "A valid messageId is required" }, 400);
      }

      const { data: result, error: dispatchError } = await adminClient.rpc(
        "dispatch_broadcaster_guidance",
        {
          p_stream_id: streamId,
          p_message_id: messageId,
          p_broadcaster_id: user.id,
        },
      );
      if (dispatchError) throw new Error(`Guidance delivery failed: ${dispatchError.message}`);

      if (result?.status === "delivered" && result.message) {
        await publishChatMessage(adminClient, streamId, result.message);
      }
      if (Deno.env.get("ENVIRONMENT") === "development") {
        console.debug("[broadcaster-guidance] Delivery result", {
          streamId,
          messageId,
          status: result?.status,
        });
      }
      return jsonResponse(request, { success: true, ...result });
    }

    return jsonResponse(request, { success: false, error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("[broadcaster-guidance] Request failed", error);
    return jsonResponse(request, {
      success: false,
      error: error instanceof Error ? error.message : "Guidance request failed",
    }, 500);
  }
});
