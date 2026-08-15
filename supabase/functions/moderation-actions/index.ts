// ============================================================================
// moderation-actions — secure Edge Function for Mod Actions
// ============================================================================
// Authorizes ONLY these roles for Mod Actions:
//   ceo, admin, lead_troll_officer, troll_officer, secretary,
//   broadcaster, broadofficer, ceo_assistant, noah_assistant
//
// The function NEVER trusts a frontend role value. It authenticates the
// caller via the bearer token, loads the actor's current DB profile, and
// enforces the role server-side. All privileged operations are delegated to
// secure SECURITY DEFINER RPCs so the DB enforces authorization too.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") || "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") || "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") || "";

// ---------------------------------------------------------------------------
// Authorized Mod Actions roles (exact list — do not add roles here).
// ---------------------------------------------------------------------------
const MOD_ACTIONS_ROLES = new Set([
  "ceo",
  "admin",
  "lead_troll_officer",
  "troll_officer",
  "secretary",
  "broadcaster",
  "broadofficer",
  "ceo_assistant",
  "noah_assistant",
]);

const VALID_ACTIONS = new Set([
  "mute",
  "unmute",
  "disable_chat",
  "kick",
  "arrest",
  "suspend_license",
  "grant_license",
  "remove_officer",
  "set_to_user",
  "end_stream",
  "submit_report",
  "list_reports",
  "take_action",
  "reject_report",
]);

const VALID_SEVERITIES = new Set(["minor", "moderate", "serious", "severe"]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// LiveKit helpers (server-side only; never exposed to the browser).
// ---------------------------------------------------------------------------
async function createLiveKitToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  exp: number;
}): Promise<string> {
  const { apiKey, apiSecret, roomName, participantName, exp } = params;
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const header = { alg: "HS256", typ: "JWT" };
  const liveKitUrl = LIVEKIT_URL || "wss://troll-city-llc-4ixv208d.livekit.cloud";

  const payload: any = {
    iss: apiKey,
    sub: participantName,
    aud: liveKitUrl,
    exp,
    nbf: now,
    iat: now,
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const message = `${headerB64}.${payloadB64}`;

  const keyData = encoder.encode(apiSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const sigBytes = new Uint8Array(signature);
  let sigB64 = "";
  for (let i = 0; i < sigBytes.length; i++) {
    sigB64 += String.fromCharCode(sigBytes[i]);
  }
  const signatureB64 = btoa(sigB64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${message}.${signatureB64}`;
}

async function kickLiveKitParticipant(roomName: string, identity: string, reason?: string): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return false;
  try {
    const adminToken = await createLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: "moderation-bot",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await fetch(
      `${LIVEKIT_URL}/room/${encodeURIComponent(roomName)}/participant/${encodeURIComponent(identity)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason || "Kicked from broadcast" }),
      }
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function muteLiveKitTrack(roomName: string, identity: string, muted: boolean): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return false;
  try {
    const adminToken = await createLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: "moderation-bot",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await fetch(
      `${LIVEKIT_URL}/room/${encodeURIComponent(roomName)}/participant/${encodeURIComponent(identity)}/track/audio`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ muted }),
      }
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function ok(code: string, message: string, data: Record<string, unknown> = {}): Record<string, unknown> {
  return { success: true, code, message, data };
}

function fail(code: string, message: string): Record<string, unknown> {
  return { success: false, code, message, data: null };
}

function truncateReason(reason: string | undefined, max = 2000): string | null {
  if (reason == null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  if (req.method !== "POST") {
    return withCors(fail("METHOD_NOT_ALLOWED", "Method not allowed."), 405, req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[moderation-actions] Server misconfigured");
      return withCors(fail("SERVER_MISCONFIGURED", "Server configuration error."), 500, req);
    }

    // 1. Require bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return withCors(fail("UNAUTHENTICATED", "Missing or invalid Authorization header."), 401, req);
    }

    // 2. Validate the authenticated user via the JWT
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user?.id) {
      return withCors(fail("UNAUTHENTICATED", "Invalid or expired session."), 401, req);
    }

    // 3. Service-role client for secure DB operations (only after auth succeeds)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 4. Load actor's current DB profile and enforce role server-side
    let actorProfile = null as any
    let profileError = null as any

    const profileColumns =
      "id, username, full_name, role, troll_role, is_admin, is_ceo, is_lead_officer, is_troll_officer, is_secretary, is_broadcaster, is_ceo_assistant, is_noah_assistant"

    let fetchedProfile = null as any
    let fetchedError = null as any

    const byId = await supabaseAdmin
      .from("user_profiles")
      .select(profileColumns)
      .eq("id", user.id)
      .maybeSingle()

    if (byId.data) {
      fetchedProfile = byId.data
    } else if (user.email) {
      const byEmail = await supabaseAdmin
        .from("user_profiles")
        .select(profileColumns)
        .eq("email", user.email)
        .maybeSingle()

      fetchedProfile = byEmail.data
      fetchedError = byEmail.error
    }

    if (fetchedError) {
      profileError = fetchedError
    } else if (!fetchedProfile) {
      const baseUsername =
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        `user${user.id.slice(0, 8)}`

      const { data: newProfile, error: createError } = await supabaseAdmin
        .from("user_profiles")
        .insert({
          id: user.id,
          username: baseUsername,
          full_name: user.user_metadata?.full_name || baseUsername,
          email: user.email,
          role: "user",
          tier: "Bronze",
          troll_coins: 0,
          total_earned_coins: 0,
          total_spent_coins: 0,
        })
        .select(profileColumns)
        .single()

      if (createError || !newProfile) {
        return withCors(
          fail("PROFILE_NOT_FOUND", "Profile not found and could not be created."),
          403,
          req
        )
      }

      actorProfile = newProfile
    } else {
      actorProfile = fetchedProfile
    }

    if (profileError || !actorProfile) {
      return withCors(fail("PROFILE_NOT_FOUND", "Profile not found."), 403, req);
    }

    const actorRole = String(actorProfile.role || "").toLowerCase();
    const actorTrollRole = String(actorProfile.troll_role || "").toLowerCase();
    const hasModRole =
      MOD_ACTIONS_ROLES.has(actorRole) ||
      MOD_ACTIONS_ROLES.has(actorTrollRole) ||
      actorProfile.is_admin === true ||
      actorProfile.is_ceo === true ||
      actorProfile.is_lead_officer === true ||
      actorProfile.is_troll_officer === true ||
      actorProfile.is_secretary === true ||
      actorProfile.is_broadcaster === true ||
      actorProfile.is_broadofficer === true ||
      actorProfile.is_ceo_assistant === true ||
      actorProfile.is_noah_assistant === true;

    if (!hasModRole) {
      return withCors(
        {
          success: false,
          code: "NOT_AUTHORIZED",
          message: "You do not have permission to use Mod Actions.",
          data: null,
        },
        403,
        req
      );
    }

    // 5. Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return withCors(fail("INVALID_JSON", "Invalid JSON body."), 400, req);
    }

    const action = String(body?.action || "");
    const actionType = String(body?.action_type || "");
    
    if (!VALID_ACTIONS.has(action) && action !== "take_action") {
      return withCors(fail("INVALID_ACTION", `Unknown action: ${action}`), 400, req);
    }

    const streamId: string | null = body?.stream_id || null;
    const targetUserId: string | null = body?.target_user_id || null;
    const durationMinutes = Number(body?.duration_minutes ?? 5);
    const durationHours = Number(body?.duration_hours ?? 24);
    const reason = truncateReason(body?.reason);
    const severity = String(body?.severity || "moderate").toLowerCase();

    // Validate UUIDs where required
    if (streamId && !isUuid(streamId)) {
      return withCors(fail("INVALID_STREAM_ID", "Invalid stream id."), 400, req);
    }

    // Report actions
    if (action === "submit_report") {
      const { reporter_id, target_user_id, stream_id, description } = body;
      if (!reporter_id || !reason) {
        return withCors(fail("INVALID_INPUT", "reporter_id and reason are required."), 400, req);
      }
      if (reporter_id !== user.id) {
        return withCors(fail("UNAUTHORIZED", "reporter_id must match authenticated user."), 403, req);
      }
      const { data, error } = await supabaseAdmin
        .from("moderation_reports")
        .insert({
          reporter_id,
          target_user_id: target_user_id || null,
          stream_id: stream_id || null,
          report_reason: reason,
          report_details: description || null,
          status: "pending",
        })
        .select()
        .single();
      if (error) {
        return withCors(fail("DB_ERROR", error.message), 500, req);
      }
      return withCors(ok("REPORT_SUBMITTED", "Report submitted.", { report: data }), 200, req);
    }

    if (action === "list_reports") {
      const { status_filter } = body;
      let query = supabaseAdmin
        .from("moderation_reports")
        .select(`
          id,
          reporter_id,
          reported_user_id,
          stream_id,
          report_reason,
          report_details,
          status,
          resolved_by,
          resolved_at,
          created_at,
          reporter:user_profiles!reporter_id(username),
          reported:user_profiles!reported_user_id(username),
          stream:streams(id, title)
        `)
        .order("created_at", { ascending: false });

      if (actorProfile.role !== "admin" && !actorProfile.is_admin) {
        query = query.in("status", ["pending", "reviewing"]);
      }

      if (status_filter) {
        query = query.eq("status", status_filter);
      }

      const { data, error } = await query;
      if (error) {
        return withCors(fail("DB_ERROR", error.message), 500, req);
      }

      const reports = (data || []).map((r: any) => ({
        report_id: r.id,
        id: r.id,
        reporter_id: r.reporter_id,
        reporter_username: r.reporter?.username || null,
        reported_user_id: r.reported_user_id,
        reported_username: r.reported?.username || null,
        target_user_id: r.reported_user_id,
        target_username: r.reported?.username || null,
        report_reason: r.report_reason,
        reason: r.report_reason,
        report_details: r.report_details,
        description: r.report_details,
        stream_id: r.stream_id,
        stream_title: r.stream?.title || null,
        status: r.status,
        resolved_by: r.resolved_by,
        resolved_at: r.resolved_at,
        created_at: r.created_at,
      }));

      return withCors(ok("REPORTS_LISTED", "Reports retrieved.", { reports }), 200, req);
    }

    if (action === "reject_report") {
      const { report_id } = body;
      if (!report_id) {
        return withCors(fail("INVALID_INPUT", "report_id is required."), 400, req);
      }
      const { error } = await supabaseAdmin
        .from("moderation_reports")
        .update({
          status: "rejected",
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", report_id);
      if (error) {
        return withCors(fail("DB_ERROR", error.message), 500, req);
      }
      return withCors(ok("REPORT_REJECTED", "Report rejected."), 200, req);
    }

    if (action === "take_action") {
      if (!actionType) {
        return withCors(fail("INVALID_INPUT", "action_type is required for take_action."), 400, req);
      }

      // Handle report-related take_action actions
      if (["warn", "suspend_stream", "arrest"].includes(actionType)) {
        const { report_id, action_details, expires_at, ban_duration_hours } = body;
        
        if (!reason || !String(reason).trim()) {
          return withCors(fail("INVALID_INPUT", "reason is required."), 400, req);
        }

        let banExpiresAt = expires_at || null;
        if (actionType === "arrest" && ban_duration_hours && !expires_at) {
          const expiryDate = new Date();
          expiryDate.setHours(expiryDate.getHours() + Number(ban_duration_hours));
          banExpiresAt = expiryDate.toISOString();
        }

        const { data: actionData, error: actionError } = await supabaseAdmin
          .from("moderation_actions")
          .insert({
            action_type: actionType,
            action: actionType,
            target_user_id: targetUserId || null,
            reason: String(reason).trim(),
            details: action_details || null,
            officer_id: user.id,
            actor_id: user.id,
            ban_expires_at: banExpiresAt,
            ban_duration_hours: ban_duration_hours || null,
            honesty_message_shown: true,
            report_id: report_id || null,
            status: "active",
          })
          .select()
          .single();

        if (actionError) {
          return withCors(fail("DB_ERROR", actionError.message), 500, req);
        }

        if (report_id) {
          await supabaseAdmin
            .from("moderation_reports")
            .update({
              status: "resolved",
              resolved_by: user.id,
              resolved_at: new Date().toISOString(),
            })
            .eq("id", report_id);
        }

        if (actionType === "suspend_stream" && streamId) {
          await supabaseAdmin
            .from("streams")
            .update({ is_live: false })
            .eq("id", streamId);
        }

        if (actionType === "arrest" && targetUserId) {
          const { error: arrestError } = await supabaseAdmin.rpc("modo_arrest", {
            p_stream_id: streamId || null,
            p_target_user_id: targetUserId,
            p_reason: String(reason).trim(),
            p_severity: "moderate",
          });
          if (arrestError) {
            return withCors(fail("RPC_ERROR", arrestError.message), 500, req);
          }
        }

        return withCors(ok("ACTION_COMPLETED", "Action completed.", { action: actionData }), 200, req);
      }

      // Handle direct broadcast mod actions via action_type
      if (["mute", "unmute", "disable_chat", "kick", "arrest", "suspend_license", "grant_license", "remove_officer", "set_to_user", "end_stream"].includes(actionType)) {
        // Map to the direct action handler below by temporarily setting action
        // We'll fall through to the switch by setting a variable
        // Since we can't easily fall through in the current structure,
        // we'll execute the RPC directly here
        let result: Record<string, unknown> = { success: false, message: "Unknown action" };
        
        switch (actionType) {
          case "mute": {
            if (!targetUserId || !streamId) {
              return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Mute requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("moderator_mute_user", {
              p_stream_id: streamId,
              p_target_user_id: targetUserId,
              p_duration_minutes: durationMinutes,
              p_reason: reason || `Muted for ${durationMinutes} minutes`,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to mute user."), 400, req);
            }
            result = data || { success: false, message: "Failed to mute user." };
            if (result.success) {
              const { data: target } = await supabaseAdmin
                .from("user_profiles")
                .select("username")
                .eq("id", targetUserId)
                .maybeSingle();
              const roomName = await resolveRoomName(supabaseAdmin, streamId);
              if (roomName && target?.username) {
                void muteLiveKitTrack(roomName, target.username, true).catch(() => {});
              }
            }
            break;
          }
          case "unmute": {
            if (!targetUserId || !streamId) {
              return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Unmute requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("moderator_unmute_user", {
              p_stream_id: streamId,
              p_target_user_id: targetUserId,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to unmute user."), 400, req);
            }
            result = data || { success: false, message: "Failed to unmute user." };
            if (result.success) {
              const { data: target } = await supabaseAdmin
                .from("user_profiles")
                .select("username")
                .eq("id", targetUserId)
                .maybeSingle();
              const roomName = await resolveRoomName(supabaseAdmin, streamId);
              if (roomName && target?.username) {
                void muteLiveKitTrack(roomName, target.username, false).catch(() => {});
              }
            }
            break;
          }
          case "disable_chat": {
            if (!targetUserId || !streamId) {
              return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "disable_chat requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("moderator_disable_chat", {
              p_stream_id: streamId,
              p_target_user_id: targetUserId,
              p_duration_minutes: durationMinutes,
              p_reason: reason || `Chat disabled for ${durationMinutes} minutes`,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to disable chat."), 400, req);
            }
            result = data || { success: false, message: "Failed to disable chat." };
            break;
          }
          case "kick": {
            if (!targetUserId || !streamId) {
              return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Kick requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("moderator_kick_user", {
              p_stream_id: streamId,
              p_target_user_id: targetUserId,
              p_reason: reason || "Kicked by moderator",
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to kick user."), 400, req);
            }
            result = data || { success: false, message: "Failed to kick user." };
            if (result.success) {
              const { data: target } = await supabaseAdmin
                .from("user_profiles")
                .select("username")
                .eq("id", targetUserId)
                .maybeSingle();
              const roomName = await resolveRoomName(supabaseAdmin, streamId);
              if (roomName && target?.username) {
                void kickLiveKitParticipant(roomName, target.username, reason || "Kicked from broadcast").catch(() => {});
              }
            }
            break;
          }
          case "arrest": {
            if (!targetUserId) {
              return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Arrest requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("modo_arrest", {
              p_stream_id: streamId || null,
              p_target_user_id: targetUserId,
              p_reason: reason || "Arrested by moderator",
              p_severity: severity,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to arrest user."), 400, req);
            }
            result = data || { success: false, message: "Failed to arrest user." };
            break;
          }
          case "suspend_license": {
            if (!targetUserId) {
              return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "License suspension requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("modo_suspend_license", {
              p_target_user_id: targetUserId,
              p_reason: reason || "License suspended",
              p_duration_hours: durationHours,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to suspend license."), 400, req);
            }
            result = data || { success: false, message: "Failed to suspend license." };
            break;
          }
          case "grant_license": {
            if (!targetUserId) {
              return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "License grant requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("modo_grant_license", {
              p_target_user_id: targetUserId,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to grant license."), 400, req);
            }
            result = data || { success: false, message: "Failed to grant license." };
            break;
          }
          case "remove_officer": {
            if (!targetUserId || !streamId) {
              return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Remove officer requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("remove_stream_broadofficer", {
              p_stream_id: streamId,
              p_officer_id: targetUserId,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to remove officer."), 400, req);
            }
            result = data || { success: false, message: "Failed to remove officer." };
            break;
          }
          case "set_to_user": {
            if (!targetUserId) {
              return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
            }
            if (!isUuid(targetUserId)) {
              return withCors(fail("INVALID_TARGET", "Set-to-user requires a UUID target."), 400, req);
            }
            const { data, error } = await supabaseAdmin.rpc("reset_user_permissions", {
              p_target_user_id: targetUserId,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to set user role."), 400, req);
            }
            result = data || { success: false, message: "Failed to set user role." };
            break;
          }
          case "end_stream": {
            const { data, error } = await supabaseAdmin.rpc("modo_end_stream", {
              p_stream_id: streamId || null,
              p_target_broadcaster_id: targetUserId || null,
              p_reason: reason || "Ended by moderator",
              p_restrict_duration_minutes: durationMinutes,
            });
            if (error) {
              return withCors(fail("RPC_ERROR", "Failed to end stream."), 400, req);
            }
            result = data || { success: false, message: "Failed to end stream." };
            break;
          }
          default:
            return withCors(fail("INVALID_ACTION", `Unknown action_type: ${actionType}`), 400, req);
        }

        if (result && result.success === true) {
          return withCors(
            {
              success: true,
              code: String(result.code || "ACTION_COMPLETED"),
              message: String(result.message || "Action completed successfully."),
              data: result.data || {},
            },
            200,
            req
          );
        }

        const failMessage = String(result?.message || "Action failed.");
        return withCors(fail(String(result?.code || "ACTION_FAILED"), failMessage), 400, req);
      }

      return withCors(fail("INVALID_ACTION", `Unknown action_type: ${actionType}`), 400, req);
    }

    // Direct actions (legacy format: action: 'mute', etc.)
    let result: Record<string, unknown>;

    // Guest kick: non-UUID target handled without casting to UUID.
    if (action === "kick" && targetUserId && !isUuid(targetUserId)) {
      if (!streamId) {
        return withCors(fail("INVALID_INPUT", "Guest kick requires an active stream."), 400, req);
      }
      const { error: seatError } = await supabaseAdmin
        .from("stream_seat_sessions")
        .update({
          status: "kicked",
          kick_reason: reason || "Kicked by moderator",
          left_at: new Date().toISOString(),
        })
        .eq("stream_id", streamId)
        .eq("guest_id", targetUserId)
        .eq("status", "active")
        .select("id")
        .maybeSingle();

      if (seatError) {
        console.error("[moderation-actions] Guest kick error:", seatError.message);
        return withCors(fail("GUEST_KICK_FAILED", "Failed to kick guest."), 400, req);
      }

      await supabaseAdmin.from("broadcast_mod_actions").insert({
        action_type: "kick",
        action_name: "Kick",
        actor_id: user.id,
        actor_role: actorRole || actorTrollRole,
        actor_display_name: actorProfile.username || actorProfile.full_name || "Unknown",
        target_user_id: null,
        target_display_name: String(targetUserId),
        broadcast_id: streamId,
        stream_id: streamId,
        reason: reason || "Kicked by moderator",
        new_status: "kicked",
        success: true,
        metadata: { guest: true, guest_identity: targetUserId },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return withCors(ok("ACTION_COMPLETED", "Guest kicked successfully.", { guest: true }), 200, req);
    }

    switch (action) {
      case "mute": {
        if (!targetUserId || !streamId) {
          return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Mute requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("moderator_mute_user", {
          p_stream_id: streamId,
          p_target_user_id: targetUserId,
          p_duration_minutes: durationMinutes,
          p_reason: reason || `Muted for ${durationMinutes} minutes`,
        });
        if (error) {
          console.error("[moderation-actions] mute RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to mute user."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to mute user.");
        if (result.success) {
          const { data: target } = await supabaseAdmin
            .from("user_profiles")
            .select("username")
            .eq("id", targetUserId)
            .maybeSingle();
          const roomName = await resolveRoomName(supabaseAdmin, streamId);
          if (roomName && target?.username) {
            void muteLiveKitTrack(roomName, target.username, true).catch(() => {});
          }
        }
        break;
      }

      case "unmute": {
        if (!targetUserId || !streamId) {
          return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Unmute requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("moderator_unmute_user", {
          p_stream_id: streamId,
          p_target_user_id: targetUserId,
        });
        if (error) {
          console.error("[moderation-actions] unmute RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to unmute user."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to unmute user.");
        if (result.success) {
          const { data: target } = await supabaseAdmin
            .from("user_profiles")
            .select("username")
            .eq("id", targetUserId)
            .maybeSingle();
          const roomName = await resolveRoomName(supabaseAdmin, streamId);
          if (roomName && target?.username) {
            void muteLiveKitTrack(roomName, target.username, false).catch(() => {});
          }
        }
        break;
      }

      case "disable_chat": {
        if (!targetUserId || !streamId) {
          return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "disable_chat requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("moderator_disable_chat", {
          p_stream_id: streamId,
          p_target_user_id: targetUserId,
          p_duration_minutes: durationMinutes,
          p_reason: reason || `Chat disabled for ${durationMinutes} minutes`,
        });
        if (error) {
          console.error("[moderation-actions] disable_chat RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to disable chat."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to disable chat.");
        break;
      }

      case "kick": {
        if (!targetUserId || !streamId) {
          return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Kick requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("moderator_kick_user", {
          p_stream_id: streamId,
          p_target_user_id: targetUserId,
          p_reason: reason || "Kicked by moderator",
        });
        if (error) {
          console.error("[moderation-actions] kick RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to kick user."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to kick user.");
        if (result.success) {
          const { data: target } = await supabaseAdmin
            .from("user_profiles")
            .select("username")
            .eq("id", targetUserId)
            .maybeSingle();
          const roomName = await resolveRoomName(supabaseAdmin, streamId);
          if (roomName && target?.username) {
            void kickLiveKitParticipant(roomName, target.username, reason || "Kicked from broadcast").catch(() => {});
          }
        }
        break;
      }

      case "arrest": {
        if (!targetUserId) {
          return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Arrest requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("modo_arrest", {
          p_stream_id: streamId || null,
          p_target_user_id: targetUserId,
          reason,
          p_severity: severity,
        });
        if (error) {
          console.error("[moderation-actions] arrest RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to arrest user."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to arrest user.");
        break;
      }

      case "suspend_license": {
        if (!targetUserId) {
          return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "License suspension requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("modo_suspend_license", {
          p_target_user_id: targetUserId,
          reason,
          p_duration_hours: durationHours,
        });
        if (error) {
          console.error("[moderation-actions] suspend_license RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to suspend license."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to suspend license.");
        break;
      }

      case "grant_license": {
        if (!targetUserId) {
          return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "License grant requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("modo_grant_license", {
          p_target_user_id: targetUserId,
        });
        if (error) {
          console.error("[moderation-actions] grant_license RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to grant license."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to grant license.");
        break;
      }

      case "remove_officer": {
        if (!targetUserId || !streamId) {
          return withCors(fail("INVALID_INPUT", "target_user_id and stream_id are required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Remove officer requires a UUID target."), 400, req);
        }
        const { data, error } = await supabaseAdmin.rpc("remove_stream_broadofficer", {
          p_stream_id: streamId,
          p_officer_id: targetUserId,
        });
        if (error) {
          console.error("[moderation-actions] remove_officer RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to remove officer."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to remove officer.");
        break;
      }

      case "set_to_user": {
        if (!targetUserId) {
          return withCors(fail("INVALID_INPUT", "target_user_id is required."), 400, req);
        }
        if (!isUuid(targetUserId)) {
          return withCors(fail("INVALID_TARGET", "Set-to-user requires a UUID target."), 400, req);
        }
        // Actor is derived from auth.uid() server-side; no actor param accepted.
        const { data, error } = await supabaseAdmin.rpc("reset_user_permissions", {
          p_target_user_id: targetUserId,
        });
        if (error) {
          console.error("[moderation-actions] set_to_user RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to set user role."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to set user role.");
        break;
      }

      case "end_stream": {
        const { data, error } = await supabaseAdmin.rpc("modo_end_stream", {
          p_stream_id: streamId || null,
          p_target_broadcaster_id: targetUserId || null,
          p_reason: reason || "Ended by moderator",
          p_restrict_duration_minutes: durationMinutes,
        });
        if (error) {
          console.error("[moderation-actions] end_stream RPC error:", error.message);
          return withCors(fail("RPC_ERROR", "Failed to end stream."), 400, req);
        }
        result = data || fail("RPC_ERROR", "Failed to end stream.");
        break;
      }

      default:
        return withCors(fail("INVALID_ACTION", `Unknown action: ${action}`), 400, req);
    }

    // 7. Normalize the RPC JSONB result into the consistent envelope.
    if (result && result.success === true) {
      return withCors(
        {
          success: true,
          code: String(result.code || "ACTION_COMPLETED"),
          message: String(result.message || "Action completed successfully."),
          data: result.data || {},
        },
        200,
        req
      );
    }

    const failMessage = String(result?.message || "Action failed.");
    return withCors(fail(String(result?.code || "ACTION_FAILED"), failMessage), 400, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[moderation-actions] Error:", message);
    return withCors(fail("INTERNAL_ERROR", "An unexpected error occurred."), 500, req);
  }
});

// Resolve the LiveKit room name for a stream (server-side only).
async function resolveRoomName(supabaseAdmin: any, streamId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("streams")
    .select("stream_channel, room_name, id")
    .eq("id", streamId)
    .maybeSingle();
  if (!data) return null;
  return data.stream_channel || data.room_name || data.id || null;
}