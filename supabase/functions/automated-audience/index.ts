import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type AudienceAccountSeed = {
  key: string;
  username: string;
  fullName: string;
  hue: number;
  style: "curious" | "upbeat" | "thoughtful" | "concise";
};

const AUDIENCE_ACCOUNTS: AudienceAccountSeed[] = [
  { key: "ava-marlow", username: "avamarlow", fullName: "Ava Marlow", hue: 12, style: "upbeat" },
  { key: "eli-arden", username: "eliarden", fullName: "Eli Arden", hue: 25, style: "curious" },
  { key: "nina-brooks", username: "ninabrooks", fullName: "Nina Brooks", hue: 38, style: "thoughtful" },
  { key: "leo-bennett", username: "leobennett", fullName: "Leo Bennett", hue: 51, style: "concise" },
  { key: "maya-cove", username: "mayacove", fullName: "Maya Cove", hue: 64, style: "curious" },
  { key: "owen-finch", username: "owenfinch", fullName: "Owen Finch", hue: 77, style: "thoughtful" },
  { key: "zoe-harper", username: "zoeharper", fullName: "Zoe Harper", hue: 90, style: "upbeat" },
  { key: "theo-wells", username: "theowells", fullName: "Theo Wells", hue: 103, style: "curious" },
  { key: "ivy-morgan", username: "ivymorgan", fullName: "Ivy Morgan", hue: 116, style: "thoughtful" },
  { key: "milo-reed", username: "miloreed", fullName: "Milo Reed", hue: 129, style: "concise" },
  { key: "ella-sloan", username: "ellasloan", fullName: "Ella Sloan", hue: 142, style: "upbeat" },
  { key: "jude-parker", username: "judeparker", fullName: "Jude Parker", hue: 155, style: "curious" },
  { key: "ruby-ellis", username: "rubyellis", fullName: "Ruby Ellis", hue: 168, style: "upbeat" },
  { key: "finn-dawson", username: "finndawson", fullName: "Finn Dawson", hue: 181, style: "concise" },
  { key: "lena-hart", username: "lenahart", fullName: "Lena Hart", hue: 194, style: "thoughtful" },
  { key: "kai-rivers", username: "kairivers", fullName: "Kai Rivers", hue: 207, style: "curious" },
  { key: "aria-west", username: "ariawest", fullName: "Aria West", hue: 220, style: "upbeat" },
  { key: "noah-lane", username: "noahlane", fullName: "Noah Lane", hue: 233, style: "concise" },
  { key: "cleo-vaughn", username: "cleovaughn", fullName: "Cleo Vaughn", hue: 246, style: "thoughtful" },
  { key: "ezra-hayes", username: "ezrahayes", fullName: "Ezra Hayes", hue: 259, style: "curious" },
  { key: "sage-turner", username: "sageturner", fullName: "Sage Turner", hue: 272, style: "thoughtful" },
  { key: "remy-clarke", username: "remyclarke", fullName: "Remy Clarke", hue: 285, style: "concise" },
  { key: "mia-porter", username: "miaporter", fullName: "Mia Porter", hue: 298, style: "upbeat" },
  { key: "asher-gray", username: "ashergray", fullName: "Asher Gray", hue: 311, style: "thoughtful" },
  { key: "lila-ross", username: "lilaross", fullName: "Lila Ross", hue: 324, style: "curious" },
  { key: "ellis-moon", username: "ellismoon", fullName: "Ellis Moon", hue: 337, style: "thoughtful" },
  { key: "talia-snow", username: "taliasnow", fullName: "Talia Snow", hue: 350, style: "upbeat" },
  { key: "jameson-lee", username: "jamesonlee", fullName: "Jameson Lee", hue: 18, style: "concise" },
  { key: "cleo-march", username: "cleomarch", fullName: "Cleo March", hue: 75, style: "curious" },
  { key: "rory-james", username: "roryjames", fullName: "Rory James", hue: 132, style: "thoughtful" },
];

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Content-Type": "application/json",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makeAvatar(seed: AudienceAccountSeed): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${seed.hue} 78% 58%)"/><stop offset="1" stop-color="hsl(${(seed.hue + 45) % 360} 74% 32%)"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><circle cx="64" cy="49" r="25" fill="#fff" fill-opacity=".88"/><path d="M20 119c4-25 20-39 44-39s40 14 44 39" fill="#fff" fill-opacity=".88"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Unable to look up provisioned account: ${error.message}`);

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function provisionAccounts(
  adminClient: ReturnType<typeof createClient>,
) {
  const { data: registered, error: registeredError } = await adminClient
    .from("automated_audience_accounts")
    .select("account_key");
  if (registeredError) throw new Error(`Unable to load audience accounts: ${registeredError.message}`);

  const registeredKeys = new Set((registered || []).map((row) => row.account_key));
  let provisioned = 0;

  for (const seed of AUDIENCE_ACCOUNTS) {
    if (registeredKeys.has(seed.key)) continue;

    const email = `${seed.key}@audience.maitroll.invalid`;
    const { data: existingProfile, error: profileLookupError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("username", seed.username)
      .maybeSingle();
    if (profileLookupError) {
      throw new Error(`Unable to verify username ${seed.username}: ${profileLookupError.message}`);
    }
    let authUser = existingProfile ? await findAuthUserByEmail(adminClient, email) : null;
    if (existingProfile && (!authUser || authUser.id !== existingProfile.id)) {
      throw new Error(`Username ${seed.username} is already used by an unregistered profile`);
    }

    if (!authUser) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: makePassword(),
        email_confirm: true,
        user_metadata: {
          username: seed.username,
          full_name: seed.fullName,
          platform_controlled: true,
        },
      });
      if (error) {
        authUser = await findAuthUserByEmail(adminClient, email);
        if (!authUser) {
          throw new Error(`Unable to create audience account ${seed.key}: ${error.message}`);
        }
      } else {
        authUser = data.user;
      }
      if (!authUser) {
        throw new Error(`Unable to create audience account ${seed.key}: no user returned`);
      }
    }

    const { error: upsertError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: authUser.id,
        username: seed.username,
        full_name: seed.fullName,
        avatar_url: makeAvatar(seed),
        bio: "MaiTroll platform-controlled account. Activity is labeled and audited.",
        role: "user",
        is_broadcaster: false,
      }, { onConflict: "id" });
    if (upsertError) {
      throw new Error(`Unable to save audience profile ${seed.key}: ${upsertError.message}`);
    }

    const { error: registerError } = await adminClient.rpc(
      "automated_audience_register_account",
      {
        p_user_id: authUser.id,
        p_account_key: seed.key,
        p_conversation_style: seed.style,
      },
    );
    if (registerError) {
      throw new Error(`Unable to allocate internal coins for ${seed.key}: ${registerError.message}`);
    }

    registeredKeys.add(seed.key);
    provisioned += 1;
  }

  if (registeredKeys.size !== AUDIENCE_ACCOUNTS.length) {
    throw new Error(`Expected ${AUDIENCE_ACCOUNTS.length} registered accounts, found ${registeredKeys.size}`);
  }

  return { total: registeredKeys.size, provisioned };
}

serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const designatedAdminId = Deno.env.get("MAITROLL_AUDIENCE_ADMIN_ID");
  if (!supabaseUrl || !serviceRoleKey || !designatedAdminId || !isUuid(designatedAdminId)) {
    console.error("[automated-audience] Missing or invalid server configuration");
    return jsonResponse(request, { success: false, error: "Audience service is not configured" }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(request, { success: false, error: "Authentication required" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) {
    return jsonResponse(request, { success: false, error: "Invalid authentication" }, 401);
  }
  if (user.id !== designatedAdminId) {
    return jsonResponse(request, { success: false, error: "Only the designated MaiTroll administrator can manage this service" }, 403);
  }
  const { data: adminProfile, error: adminProfileError } = await adminClient
    .from("user_profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (adminProfileError) {
    console.error("[automated-audience] Could not validate administrator role", adminProfileError);
    return jsonResponse(request, { success: false, error: "Unable to validate administrator permissions" }, 500);
  }
  if (
    !adminProfile ||
    (adminProfile.is_admin !== true && !["admin", "superadmin", "ceo"].includes(String(adminProfile.role || "")))
  ) {
    return jsonResponse(request, { success: false, error: "Designated account lacks the required administrator permission" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (error) {
    console.warn("[automated-audience] Invalid request JSON", error);
    return jsonResponse(request, { success: false, error: "Invalid JSON body" }, 400);
  }

  const action = body.action;
  try {
    if (action === "activate") {
      const streamId = body.streamId;
      if (!isUuid(streamId)) {
        return jsonResponse(request, { success: false, error: "A valid streamId is required" }, 400);
      }

      const { data: stream, error: streamError } = await adminClient
        .from("streams")
        .select("*")
        .eq("id", streamId)
        .maybeSingle();
      if (streamError) throw new Error(`Unable to validate broadcast: ${streamError.message}`);
      if (!stream) return jsonResponse(request, { success: false, error: "Broadcast not found" }, 404);

      const ownerId = stream.broadcaster_id || stream.user_id;
      if (ownerId !== user.id) {
        return jsonResponse(request, { success: false, error: "Broadcast does not belong to the designated administrator" }, 403);
      }
      if (stream.status !== "live" || stream.is_live !== true) {
        return jsonResponse(request, { success: false, error: "Broadcast must be active before audience activation" }, 409);
      }

      const { data: setting, error: settingError } = await adminClient
        .from("automated_audience_settings")
        .select("enabled")
        .eq("singleton", true)
        .single();
      if (settingError) throw new Error(`Unable to read audience settings: ${settingError.message}`);
      if (!setting.enabled) {
        return jsonResponse(request, { success: false, error: "Enable the audience service in the admin controls first" }, 409);
      }

      const accounts = await provisionAccounts(adminClient);
      const { data: sessionId, error: activationError } = await adminClient.rpc(
        "automated_audience_activate",
        { p_stream_id: streamId, p_admin_user_id: user.id },
      );
      if (activationError) throw new Error(`Unable to activate audience session: ${activationError.message}`);

      return jsonResponse(request, { success: true, sessionId, accounts });
    }

    if (action === "status") {
      const { data: settings, error: settingsError } = await adminClient
        .from("automated_audience_settings")
        .select("enabled, chat_min_interval_minutes, chat_max_interval_minutes, gift_cooldown_minutes, updated_at")
        .eq("singleton", true)
        .single();
      if (settingsError) throw new Error(`Unable to load audience settings: ${settingsError.message}`);

      const { data: accounts, error: accountsError } = await adminClient
        .from("automated_audience_accounts")
        .select("user_id, account_key, enabled, created_at, disabled_at, user_profiles(username, avatar_url), automated_audience_balances(balance)")
        .order("account_key");
      if (accountsError) throw new Error(`Unable to load audience accounts: ${accountsError.message}`);

      const { data: sessions, error: sessionsError } = await adminClient
        .from("automated_audience_sessions")
        .select("id, stream_id, status, started_at, ended_at, last_action_at, last_gift_at, action_sequence")
        .order("started_at", { ascending: false })
        .limit(20);
      if (sessionsError) throw new Error(`Unable to load audience sessions: ${sessionsError.message}`);

      const { data: events, error: eventsError } = await adminClient
        .from("automated_audience_events")
        .select("id, stream_id, account_id, event_type, content, gift_name, internal_cost, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (eventsError) throw new Error(`Unable to load audience events: ${eventsError.message}`);

      const { data: logs, error: logsError } = await adminClient
        .from("automated_audience_logs")
        .select("id, session_id, stream_id, actor_id, event_type, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (logsError) throw new Error(`Unable to load audience logs: ${logsError.message}`);

      const { data: liveStreams, error: streamsError } = await adminClient
        .from("streams")
        .select("id, title, status, is_live, user_id, broadcaster_id")
        .eq("status", "live")
        .eq("is_live", true);
      if (streamsError) throw new Error(`Unable to load live broadcasts: ${streamsError.message}`);

      return jsonResponse(request, {
        success: true,
        settings,
        accounts: accounts || [],
        sessions: sessions || [],
        events: events || [],
        logs: logs || [],
        liveStreams: (liveStreams || []).filter(
          (stream) => (stream.broadcaster_id || stream.user_id) === user.id,
        ),
      });
    }

    if (action === "configure") {
      const enabled = body.enabled;
      const minInterval = body.chatMinIntervalMinutes;
      const maxInterval = body.chatMaxIntervalMinutes;
      const giftCooldown = body.giftCooldownMinutes;
      if (
        typeof enabled !== "boolean"
        || typeof minInterval !== "number"
        || typeof maxInterval !== "number"
        || typeof giftCooldown !== "number"
        || !Number.isInteger(minInterval)
        || !Number.isInteger(maxInterval)
        || !Number.isInteger(giftCooldown)
      ) {
        return jsonResponse(request, { success: false, error: "Invalid audience settings" }, 400);
      }

      const { error } = await adminClient.rpc("automated_audience_set_settings", {
        p_admin_user_id: user.id,
        p_enabled: enabled,
        p_chat_min_interval_minutes: minInterval,
        p_chat_max_interval_minutes: maxInterval,
        p_gift_cooldown_minutes: giftCooldown,
      });
      if (error) return jsonResponse(request, { success: false, error: error.message }, 400);
      if (enabled) {
        const { data: activeSessions, error: sessionsError } = await adminClient
          .from("automated_audience_sessions")
          .select("stream_id")
          .eq("admin_user_id", user.id)
          .eq("status", "active");
        if (sessionsError) {
          throw new Error(`Unable to find live audience sessions to resume: ${sessionsError.message}`);
        }
        for (const session of activeSessions ?? []) {
          const { error: dispatchError } = await adminClient.rpc("automated_audience_dispatch_now", {
            p_stream_id: session.stream_id,
            p_force_chat: true,
          });
          if (dispatchError) {
            throw new Error(`Unable to dispatch the first audience chat: ${dispatchError.message}`);
          }
        }
      }
      return jsonResponse(request, { success: true });
    }

    if (action === "session") {
      const streamId = body.streamId;
      const status = body.status;
      if (!isUuid(streamId) || !["active", "paused", "stopped"].includes(String(status))) {
        return jsonResponse(request, { success: false, error: "Invalid session update" }, 400);
      }
      const { error } = await adminClient.rpc("automated_audience_set_session_status", {
        p_admin_user_id: user.id,
        p_stream_id: streamId,
        p_status: status,
      });
      if (error) return jsonResponse(request, { success: false, error: error.message }, 400);
      return jsonResponse(request, { success: true });
    }

    if (action === "account") {
      const accountId = body.accountId;
      const enabled = body.enabled;
      if (!isUuid(accountId) || typeof enabled !== "boolean") {
        return jsonResponse(request, { success: false, error: "Invalid account update" }, 400);
      }
      const { error } = await adminClient.rpc("automated_audience_set_account_enabled", {
        p_admin_user_id: user.id,
        p_account_id: accountId,
        p_enabled: enabled,
      });
      if (error) return jsonResponse(request, { success: false, error: error.message }, 400);
      return jsonResponse(request, { success: true });
    }

    return jsonResponse(request, { success: false, error: "Unknown audience action" }, 400);
  } catch (error) {
    console.error("[automated-audience] Request failed", error);
    return jsonResponse(request, {
      success: false,
      error: error instanceof Error ? error.message : "Audience operation failed",
    }, 500);
  }
});
