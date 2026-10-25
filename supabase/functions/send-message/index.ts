import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";;
import { Redis } from "@upstash/redis";
import { corsHeaders } from "../_shared/cors.ts";

const SIGNING_SECRETS: Record<string, string> = {
  "k1": Deno.env.get("SIGNING_SECRET_K1") || "fallback-secret-k1-change-me",
  "k2": Deno.env.get("SIGNING_SECRET_K2") || "fallback-secret-k2-change-me",
};
const CURRENT_KID = "k1";

// const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes
const SAMPLE_RATE_DEFAULT = 20; // 20%
const HOT_STREAM_THRESHOLD = 5000;
const STAFF_ROLES = new Set([
  "admin",
  "superadmin",
  "owner",
  "ceo",
  "ceo_assistant",
  "noah_assistant",
  "staff",
  "lead_troll_officer",
  "troll_officer",
  "secretary",
  "prosecutor",
  "attorney",
  "agency_hr_manager",
  "agency_hr",
  "hr_admin",
  "marketing_agent",
  "empire_partner",
]);

function isStaffProfile(profile: Record<string, unknown>) {
  const role = String(profile.role || "").toLowerCase();
  const trollRole = String(profile.troll_role || "").toLowerCase();
  return profile.is_staff === true ||
    profile.is_admin === true ||
    profile.is_superadmin === true ||
    profile.is_troll_officer === true ||
    profile.is_lead_officer === true ||
    profile.is_secretary === true ||
    profile.is_prosecutor === true ||
    profile.is_attorney === true ||
    STAFF_ROLES.has(role) ||
    STAFF_ROLES.has(trollRole);
}

function isBroadcastChatLockActive(lock: {
  broadcast_chat_disabled?: boolean | null;
  broadcast_chat_disabled_until?: string | null;
  broadcast_chat_disabled_stream_id?: string | null;
}, streamId: string) {
  if (!lock?.broadcast_chat_disabled) return false;
  if (lock.broadcast_chat_disabled_stream_id && lock.broadcast_chat_disabled_stream_id !== streamId) return false;

  if (lock.broadcast_chat_disabled_until) {
    const expiresAt = Date.parse(lock.broadcast_chat_disabled_until);
    if (!Number.isNaN(expiresAt)) return expiresAt > Date.now();
  }

  return true;
}

// --- Transport Abstraction ---

interface TransportAdapter {
  publish(channel: string, event: string, payload: any): Promise<void>;
}

class SupabaseTransportAdapter implements TransportAdapter {
  constructor(
    private supabaseUrl: string,
    private apiKey: string,
  ) {}

  async publish(channel: string, event: string, payload: any) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const endpoint = new URL(
        `/realtime/v1/api/broadcast/${encodeURIComponent(channel)}/events/${encodeURIComponent(event)}`,
        this.supabaseUrl,
      );
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Realtime REST broadcast failed (${response.status}): ${details}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

class RedisStreamAdapter implements TransportAdapter {
  constructor(private redis: Redis) {}
  async publish(channel: string, _event: string, payload: any) {
    // A1) Publish to tc_events_v1 for persistence
    await this.redis.xadd("tc_events_v1", "*", {
      txn_id: payload.txn_id,
      stream_id: payload.stream_id,
      t: payload.t,
      ts: payload.ts.toString(),
      s: payload.s,
      v: payload.v.toString(),
      kid: payload.kid,
      payload: JSON.stringify(payload),
    });
    
    // Also publish to ephemeral stream for real-time workers if needed
    await this.redis.xadd(`stream:${channel}`, "*", {
      envelope: JSON.stringify(payload),
    });
  }
}

/**
 * AblyTransportAdapter (Stub)
 * Demonstrates the "Transport Swap Hook" logic.
 * In a real implementation, this would use the Ably REST SDK.
 */
// class AblyTransportAdapter implements TransportAdapter {
//   async publish(channel: string, event: string, payload: any) {
//     console.log(`[TRANSPORT_SWAP_STUB] Ably publishing to channel "${channel}" event "${event}"`);
//     console.log(`[TRANSPORT_SWAP_STUB] Envelope integrity check: txn_id=${payload.txn_id} sig=${payload.sig.substring(0, 8)}...`);
//     // Mock network latency
//     await new Promise(resolve => setTimeout(resolve, 10));
//   }
// }

// Initialize Redis if credentials are provided
let redis: Redis | null = null;
try {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (redisUrl && redisToken) {
    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }
} catch (e) {
  console.error("Failed to initialize Redis:", e);
}

interface MessagePayload {
  type: "chat" | "gift" | "mod" | "sys" | "battle" | "count";
  stream_id: string;
  txn_id: string;
  data: any;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- Utilities ---

function canonicalizeJson(obj: any): string {
  if (typeof obj !== "object" || obj === null) return JSON.stringify(obj);
  const keys = Object.keys(obj).sort();
  const sortedObj: any = {};
  for (const key of keys) {
    sortedObj[key] = canonicalizeJson(obj[key]);
  }
  return JSON.stringify(sortedObj);
}

async function getPayloadHash(data: any): Promise<string> {
  const canonical = canonicalizeJson(data);
  const msgUint8 = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signMessage(message: string, kid: string): Promise<string> {
  const secret = SIGNING_SECRETS[kid];
  if (!secret) throw new Error(`Unknown KID: ${kid}`);
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: "Invalid request body", code: "INVALID_BODY" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { type, stream_id, txn_id, data } = body as MessagePayload;
    const requiredFields = ["type", "stream_id", "txn_id", "data"];
    const missingFields = requiredFields.filter((field) => !(field in body));
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ error: `Missing required fields: ${missingFields.join(", ")}` }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supportedTypes = ["chat", "gift", "mod", "sys", "battle", "count"];
    if (!supportedTypes.includes(type)) {
      return new Response(JSON.stringify({ error: "Unsupported message type", code: "INVALID_TYPE" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return new Response(JSON.stringify({ error: "Invalid message data", code: "INVALID_DATA" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (type === "chat") {
      if (typeof data.content !== "string" || !data.content.trim()) {
        return new Response(JSON.stringify({ error: "Message content is required", code: "INVALID_CONTENT" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      if (data.content.trim().length > 280) {
        return new Response(JSON.stringify({ error: "Messages are limited to 280 characters", code: "CONTENT_TOO_LONG" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      data.content = data.content.trim();
    }

    if (!UUID_REGEX.test(String(stream_id || "").trim())) {
      return new Response(JSON.stringify({ error: "Invalid stream_id", code: "INVALID_STREAM_ID" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!UUID_REGEX.test(String(txn_id || "").trim())) {
      return new Response(JSON.stringify({ error: "Invalid txn_id", code: "INVALID_TXN_ID" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 3. Canonical moderation checks (fail-closed)
    // 3a. Check if user is currently jailed
    const { data: jailData, error: jailError } = await supabase
      .rpc('is_user_jailed', { p_user_id: user.id });

    if (jailError) {
      console.error("[ERROR] Failed to verify jail status:", jailError);
      return new Response(JSON.stringify({ error: "Could not verify chat eligibility", code: "RESTRICTION_CHECK_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (jailData && Array.isArray(jailData) && jailData.length > 0 && jailData[0].is_jailed) {
      const jailInfo = jailData[0];
      return new Response(JSON.stringify({
        error: "You are currently in jail.",
        code: "USER_JAILED",
        data: {
          jail_id: jailInfo.jail_id,
          discipline_level: jailInfo.discipline_level,
          scheduled_release_at: jailInfo.scheduled_release_at,
          bond_amount: jailInfo.bond_amount,
          bond_allowed: jailInfo.bond_allowed,
        }
      }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 3b. Check chat restrictions (jail, blocks, mutes)
    const { data: restrictionData, error: restrictionError } = await supabase
      .rpc('check_user_chat_restriction', { p_user_id: user.id, p_stream_id: stream_id });

    if (restrictionError || !restrictionData) {
      console.error("[ERROR] Failed to verify chat restrictions:", restrictionError);
      return new Response(JSON.stringify({ error: "Could not verify chat eligibility", code: "RESTRICTION_CHECK_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (restrictionData.restricted) {
      const reasons = restrictionData.reasons || [];
      const reason = reasons.includes('jailed') ? 'You are currently in jail.' :
                     reasons.includes('chat_blocked') ? 'Your chat has been disabled by moderation.' :
                     reasons.includes('muted') ? 'You are muted in this stream.' :
                     'Your chat access is restricted.';
      return new Response(JSON.stringify({
        error: reason,
        code: "USER_JAILED",
        data: restrictionData
      }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 3. Replay Protection (Fail-Closed)
    if (redis) {
      try {
        const replayKey = `txn:${txn_id}`;
        const isReplay = await redis.set(replayKey, "1", { nx: true, ex: 900 }); // 15 min TTL
        if (!isReplay) {
          console.warn(`[SECURITY] Replay detected: txn_id=${txn_id} user_id=${user.id}`);
          return new Response(JSON.stringify({ error: "Replay detected", code: "REPLAY_ERROR" }), {
            status: 403,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }
      } catch (redisErr) {
        console.error(`[CRITICAL] Redis unavailable for replay protection: ${redisErr}`);
        return new Response(JSON.stringify({ error: "Service temporarily unavailable", code: "REDIS_UNAVAILABLE" }), {
          status: 503,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 3.5 Clock Skew Validation
    const now = Date.now();
    const ts = now; // We use server time for the envelope
    // If client provided a 'ts', we would validate: if (Math.abs(now - body.ts) > MAX_CLOCK_SKEW_MS) ...

    // 4. Validate Stream and User Status (Muted/Banned) + Get Profile
    const [
      { data: stream, error: streamError },
      { data: profile, error: profileError },
      { data: mute, error: muteError },
      { data: ban, error: banError },
      viewerCount
    ] = await Promise.all([
      supabase.from("streams").select("id, is_live, status, subscriber_only_chat, user_id").eq("id", stream_id).single(),
      supabase.from("user_profiles").select("*").eq("id", user.id).single(),
      supabase.from("stream_mutes").select("id").eq("stream_id", stream_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("stream_bans").select("id, expires_at").eq("stream_id", stream_id).eq("user_id", user.id).maybeSingle(),
      redis ? redis.get(`viewercount:${stream_id}`) : Promise.resolve(0)
    ]);

    if (streamError || !stream) {
      console.error(`[AUTH] Stream lookup failed: ${stream_id}`, streamError);
      return new Response(JSON.stringify({ error: "Stream not found or inactive", code: "STREAM_NOT_FOUND" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (type === "chat" && (stream.is_live !== true || stream.status !== "live")) {
      return new Response(JSON.stringify({ error: "Stream is not live", code: "STREAM_NOT_LIVE" }), {
        status: 409,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (profileError) {
      console.error(`[ERROR] User profile lookup failed for ${user.id}:`, profileError);
      return new Response(JSON.stringify({ error: "Could not verify user authorization", code: "PROFILE_LOOKUP_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (type === "chat" && (muteError || banError)) {
      console.error("[ERROR] Failed to verify stream mute/ban status:", { muteError, banError });
      return new Response(JSON.stringify({ error: "Could not verify chat eligibility", code: "RESTRICTION_CHECK_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // If profile doesn't exist, create one (handles orphaned users from trigger issues)
    let userProfile = profile;
    if (!profile) {
      console.log(`[AUTH] User profile not found, creating: ${user.id}`);
      
      // Create profile with ID-based username (guaranteed unique)
      const { data: newProfile, error: createError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          username: `user${user.id.slice(0, 8)}`,
          avatar_url: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          bio: 'New troll in the city!',
          role: user.email === 'Mai Troll2025@gmail.com' ? 'admin' : 'user',
          tier: 'Bronze',
          paid_coins: 0,
          troll_coins: 100,
          total_earned_coins: 100,
          total_spent_coins: 0,
          email: user.email,
          terms_accepted: false,
        })
        .select()
        .single();

      if (createError || !newProfile) {
        console.error(`[ERROR] Failed to create profile for ${user.id}:`, createError);
        return new Response(JSON.stringify({ error: "Failed to create user profile", code: "PROFILE_CREATE_FAILED" }), {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      userProfile = newProfile;
      console.log(`[SUCCESS] Created profile for orphaned user: ${user.id}`);
    }

    const streamOwnerId = stream.user_id;
    const isPrivilegedSender =
      user.id === streamOwnerId ||
      isStaffProfile(userProfile);

    if (type === "chat" && !isPrivilegedSender) {
      const membershipCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const [
        { data: audiencePresence, error: audiencePresenceError },
        { data: streamViewer, error: streamViewerError },
      ] = await Promise.all([
        supabase
          .from("stream_audience_presence")
          .select("id")
          .eq("stream_id", stream_id)
          .eq("user_id", user.id)
          .eq("is_active", true)
          .gte("last_seen_at", membershipCutoff)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("stream_viewers")
          .select("stream_id")
          .eq("stream_id", stream_id)
          .eq("user_id", user.id)
          .gte("last_seen", membershipCutoff)
          .limit(1)
          .maybeSingle(),
      ]);

      if (!audiencePresence && !streamViewer && (audiencePresenceError || streamViewerError)) {
        console.error("[ERROR] Failed to verify stream membership:", {
          audiencePresenceError,
          streamViewerError,
        });
        return new Response(JSON.stringify({ error: "Could not verify stream membership", code: "MEMBERSHIP_CHECK_FAILED" }), {
          status: 503,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      if (!audiencePresence && !streamViewer) {
        return new Response(JSON.stringify({ error: "Join the stream before sending chat", code: "STREAM_MEMBERSHIP_REQUIRED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "chat" && stream.subscriber_only_chat && !isPrivilegedSender) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("subscriber_id", user.id)
        .eq("broadcaster_id", streamOwnerId)
        .eq("is_active", true)
        .maybeSingle();

      if (subscriptionError) {
        console.error("[ERROR] Failed to verify subscriber-only chat access:", subscriptionError);
        return new Response(JSON.stringify({ error: "Could not verify subscription", code: "SUBSCRIPTION_CHECK_FAILED" }), {
          status: 503,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      if (!subscription) {
        return new Response(JSON.stringify({ error: "Subscriber-only chat — subscribe to the broadcaster to chat in this stream.", code: "SUBSCRIBER_REQUIRED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "chat" && !isPrivilegedSender) {
      const { data: moderationResult, error: moderationError } = await supabase
        .rpc("moderate_user_content", {
          p_user_id: user.id,
          p_content: data.content,
          p_source: "send_message",
          p_context: { stream_id },
        });

      if (moderationError || !moderationResult) {
        console.error("[ERROR] Failed to verify chat content:", moderationError);
        return new Response(JSON.stringify({ error: "Could not verify this message", code: "CONTENT_CHECK_FAILED" }), {
          status: 503,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      if (!moderationResult.allowed) {
        return new Response(JSON.stringify({
          error: moderationResult.message || "That message violates Mai Troll's chat rules and was not sent.",
          code: moderationResult.code || "PROHIBITED_LANGUAGE",
          data: moderationResult,
        }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    if (mute) {
      console.log(`[AUTH] User muted: ${user.id} in stream ${stream_id}`);
      return new Response(JSON.stringify({ error: "You are muted in this stream", code: "MUTED" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (ban) {
      const isExpired = ban.expires_at && new Date(ban.expires_at) < new Date();
      if (!isExpired) {
        console.log(`[AUTH] User banned: ${user.id} in stream ${stream_id}`);
        return new Response(JSON.stringify({ error: "You are banned from this stream", code: "BANNED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 5a. Check if user's chat is disabled (chat_blocks table)
    const { data: chatBlock, error: chatBlockError } = await supabase
      .from("chat_blocks")
      .select("id, expires_at")
      .eq("stream_id", stream_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (chatBlockError) {
      console.error("[ERROR] Failed to verify chat block:", chatBlockError);
      return new Response(JSON.stringify({ error: "Could not verify chat eligibility", code: "RESTRICTION_CHECK_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (chatBlock) {
      const isExpired = chatBlock.expires_at && new Date(chatBlock.expires_at) < new Date();
      if (!isExpired) {
        console.log(`[AUTH] User chat disabled: ${user.id} in stream ${stream_id}`);
        return new Response(JSON.stringify({ error: "Your chat has been disabled by moderation", code: "CHAT_DISABLED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 5b. Check broadcast_mod_actions for active chat disable
    const { data: activeChatDisable, error: activeChatDisableError } = await supabase
      .from("broadcast_mod_actions")
      .select("id, expires_at")
      .eq("target_user_id", user.id)
      .eq("action_type", "disable_chat")
      .eq("status", "active")
      .maybeSingle();

    if (activeChatDisableError) {
      console.error("[ERROR] Failed to verify moderation action:", activeChatDisableError);
      return new Response(JSON.stringify({ error: "Could not verify chat eligibility", code: "RESTRICTION_CHECK_FAILED" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (activeChatDisable) {
      const isExpired = activeChatDisable.expires_at && new Date(activeChatDisable.expires_at) < new Date();
      if (!isExpired) {
        console.log(`[AUTH] User chat disabled via mod action: ${user.id} in stream ${stream_id}`);
        return new Response(JSON.stringify({ error: "Your chat has been disabled by moderation", code: "CHAT_DISABLED" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Rate Limiting (best effort — a limiter outage must not block chat)
    const isMod = isPrivilegedSender;
    const currentViewerCount = Number(viewerCount) || 0;

    // B1) Deterministic Sampling
    if (type === "chat" && !isMod && currentViewerCount >= HOT_STREAM_THRESHOLD) {
      // Deterministic hash based on user_id + stream_id
      const hashInput = `${user.id}${stream_id}`;
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(hashInput));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashVal = hashArray[0] % 100; // Simple modulo for sampling
      
      if (hashVal >= SAMPLE_RATE_DEFAULT) {
        console.log(`[SAMPLING] Message dropped for user ${user.id} (High Traffic Mode)`);
        return new Response(JSON.stringify({ 
          error: "High traffic mode active", 
          code: "SAMPLING_ACTIVE",
          sample_rate: SAMPLE_RATE_DEFAULT 
        }), {
          status: 429,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    }

    if (redis) {
      // One retry, because a dropped connection to the rate limiter must not
      // take the whole chat down.
      let limited = false;
      for (let attempt = 0; attempt < 2 && !limited; attempt++) {
        try {
          const limits = [
            { key: `ratelimit:${user.id}:${type}`, max: 5 },
            { key: `ratelimit:stream:${stream_id}:${type}`, max: 2500 },
          ];
          for (const limit of limits) {
            const count = await redis.incr(limit.key);
            if (count === 1) await redis.expire(limit.key, 10);
            if (count > limit.max) {
              console.warn(`[AUTH] Rate limit exceeded: user_id=${user.id} stream_id=${stream_id} type=${type}`);
              limited = true;
              break;
            }
          }
        } catch (err) {
          if (attempt === 0) {
            console.warn(`[AUTH] Rate limit check failed, retrying: ${err}`);
            continue;
          }
          // The rate limiter is a guard, not a dependency: a rate limiter that
          // is down must never block every message of the platform.
          console.error(`[CRITICAL] Rate limit check failed, allowing message: ${err}`);
        }
      }
      if (limited) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMITED" }), {
          status: 429,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
    } else {
      // Upstash Redis is optional infrastructure. Without it there is no
      // distributed rate limit, but the guards above (chat blocks, moderation
      // actions, high traffic sampling) still apply and the message is
      // delivered instead of failing the whole chat.

    }

    // 6. Enrich Data (Denormalize server-side for security)
    const enrichedData: Record<string, any> = {
      ...data,
      user_name: userProfile.username,
      user_avatar: userProfile.avatar_url,
      user_role: userProfile.role,
      user_troll_role: userProfile.troll_role,
      user_created_at: userProfile.created_at,
      user_rgb_expires_at: userProfile.rgb_username_expires_at,
      user_glowing_username_color: userProfile.glowing_username_color,
    };


    // 8. Publish via Adapters
    const adapters: TransportAdapter[] = [
      new SupabaseTransportAdapter(supabaseUrl, supabaseServiceKey),
      // new AblyTransportAdapter(), // <--- ONE-LINE SWAP: Uncomment to enable Ably transport
    ];
    if (redis) adapters.push(new RedisStreamAdapter(redis));

    const publishChannels = [`stream-chat:${stream_id}`];

    // B2) Hot Stream Protection (Sys Event for High Traffic)
    if (currentViewerCount >= HOT_STREAM_THRESHOLD && redis) {
      const lastNotifyKey = `notified_high_traffic:${stream_id}`;
      const alreadyNotified = await redis.get(lastNotifyKey);
      if (!alreadyNotified) {
        const sysEvent = {
          v: 1,
          t: "sys",
          stream_id: stream_id,
          ts: Date.now(),
          d: { mode: "high_traffic", sample_rate: SAMPLE_RATE_DEFAULT }
        };
        await Promise.all(
          publishChannels.flatMap((channelName) =>
            adapters.map((a) => a.publish(channelName, "message", sysEvent))
          )
        );
        await redis.set(lastNotifyKey, "1", { ex: 300 }); // Notify every 5 mins
      }
    }

    if (type === "chat") {
      if (streamOwnerId) {
        const { data: hostModerationLock, error: hostModerationLockError } = await supabase
          .from("user_profiles")
          .select("broadcast_chat_disabled, broadcast_chat_disabled_until, broadcast_chat_disabled_stream_id")
          .eq("id", streamOwnerId)
          .maybeSingle();

        if (hostModerationLockError || !hostModerationLock) {
          console.error("[ERROR] Failed to verify broadcaster chat lock:", hostModerationLockError);
          return new Response(JSON.stringify({ error: "Could not verify broadcaster chat settings", code: "CHAT_LOCK_CHECK_FAILED" }), {
            status: 503,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }

        if (isBroadcastChatLockActive(hostModerationLock, stream_id)) {
          return new Response(JSON.stringify({ error: "Chat is disabled for this broadcaster", code: "CHAT_DISABLED" }), {
            status: 403,
            headers: { ...headers, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 9. Insert message into database FIRST so RLS policies (e.g. chat-blocked)
    // win over realtime delivery. Broadcast only AFTER the insert succeeds.
    const insertPayload: any = {
        stream_id: stream.id,
        user_id: user.id,
        content: data.content,
        type: type,
        username: userProfile.username,
    };

    if (data.is_highlighted) {
        insertPayload.is_highlighted = true;
        insertPayload.highlight_color = data.highlight_color || null;
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("stream_messages")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError || !insertedMessage) {
      // RLS rejection (42501) or other insert failure — do NOT broadcast.
      // Failing closed here prevents everyone from seeing a message the
      // database refused to persist.
      console.error("[ERROR] Failed to insert message into database:", insertError);
      const isRlsRejection = insertError.code === "42501";
      return new Response(
        JSON.stringify({
          error: isRlsRejection
            ? "Your chat is currently disabled."
            : "Message could not be sent.",
          code: isRlsRejection ? "CHAT_DISABLED" : "INSERT_FAILED",
        }),
        {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[SUCCESS] Message inserted into stream_messages table:", txn_id);

    enrichedData.message_id = insertedMessage.id;
    const payloadHash = await getPayloadHash(enrichedData);
    const canonicalString = `v=1|t=${type}|stream_id=${stream_id}|sender_id=${user.id}|txn_id=${txn_id}|ts=${ts}|payload_hash=${payloadHash}`;
    const sig = await signMessage(canonicalString, CURRENT_KID);
    const envelope = {
      v: 1,
      kid: CURRENT_KID,
      t: type,
      stream_id: stream_id,
      s: user.id,
      ts: ts,
      txn_id: txn_id,
      message_id: insertedMessage.id,
      d: enrichedData,
      sig: sig,
    };

    // 8. Publish to Realtime AFTER the database has accepted the message.
    const chatPublishResults = await Promise.allSettled(
      publishChannels.flatMap((channelName) =>
        adapters.map((a) => a.publish(channelName, "chat", envelope))
      )
    );
    chatPublishResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("[ERROR] Chat persisted but realtime publish failed:", result.reason);
      }
    });

    // 8b. Mai Voice — queue a personalized speech clip for this chat message.
    // Speech is a bonus feature: any failure here must never break the chat
    // send, so the whole block is best-effort.
    if (type === "chat" && typeof data.content === "string" && data.content.trim()) {
      try {
        const ttsResponse = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/mai-voice`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "enqueue-tts",
            userId: user.id,
            roomKind: "stream",
            roomId: stream_id,
            sourceMessageId: insertedMessage.id,
            text: data.content,
            presentation: data.presentation === "flying_chat" ? "flying_chat" : "chat",
          }),
        });
        if (!ttsResponse.ok) {
          console.warn(
            "[Mai Voice] TTS enqueue skipped:",
            ttsResponse.status,
            (await ttsResponse.text()).slice(0, 200),
          );
        }
      } catch (ttsError: any) {
        console.warn("[Mai Voice] TTS enqueue failed:", ttsError?.message);
      }
    }

    // Also publish gift events to the main stream channel for gift animations
    if (type === "gift") {
      const streamChannel = `stream:${stream_id}`;
      const giftPublishResults = await Promise.allSettled(
        adapters.map((a) => a.publish(streamChannel, "gift_sent", envelope))
      );
      giftPublishResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("[ERROR] Gift persisted but realtime publish failed:", result.reason);
        }
      });
      console.log(`[GIFT] Also published to stream channel: ${streamChannel}`);
    }

    // Send push notification via Web Push (VAPID) using our push-notifications Edge Function
    try {
      // Get stream title and broadcaster info for push notifications
      const { data: streamData, error: _streamDataError } = await supabase
        .from("streams")
        .select("title, user_id, broadcaster_id")
        .eq("id", stream_id)
        .single();
      
      const streamTitle = streamData?.title || `Stream ${stream_id}`;
      const broadcasterId = streamData?.user_id || streamData?.broadcaster_id;
      
      // Get sender name
      const senderName = userProfile.username || user.email?.split('@')[0] || 'Anonymous';
      
      // Get follower IDs for the broadcaster (if we have a broadcaster ID)
      let followerIds: string[] = [];
      if (broadcasterId) {
        const { data: followersData, error: followersError } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("following_id", broadcasterId);
        
        if (!followersError && followersData) {
          followerIds = followersData.map((f: any) => f.follower_id);
        }
      }
      
      console.log('[Push] Sending Web Push for private message to followerIds:', followerIds);
      const pushResult = await supabase.functions.invoke('push-notifications', {
        body: {
          user_ids: followerIds,
          notification: {
            title: streamTitle,
            body: `${senderName}: ${data.content?.substring(0, 100) || 'sent a message'}`,
            type: 'new_private_message',
            icon: '/icons/icon-192.png',
            url: `/utromail?stream=${stream_id}`,
            data: {
              stream_id: stream_id,
              message_id: txn_id,
              sender_id: user.id,
              sender_name: senderName
            }
          },
          options: { ttl: 86400, urgency: 'high' }
        }
      });
      console.log('[Push] Result:', JSON.stringify(pushResult, null, 2));
    } catch (pushError: any) {
      console.error('[Push] Failed:', pushError);
      // Don't fail the message send if push fails
    }

    console.log(`[SUCCESS] Message signed and published: txn_id=${txn_id} type=${type} user_id=${user.id}`);

    // Return signed envelope to sender
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
