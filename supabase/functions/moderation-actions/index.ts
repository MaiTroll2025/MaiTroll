// ============================================================================
// MaiTroll - moderation-actions
// Secure Supabase Edge Function
//
// AUTH MODEL
// ----------------------------------------------------------------------------
// 1. Supabase Auth validates the incoming Bearer token.
// 2. The authenticated user's ID comes ONLY from Supabase Auth.
// 3. The frontend cannot provide or override actor_id / role.
// 4. user_profiles is queried server-side for moderation permissions.
// 5. Service-role/secret credentials are used ONLY server-side.
// 6. LiveKit credentials are NEVER exposed to the client.
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { createSupabaseContext } from "npm:@supabase/server";

// ============================================================================
// ENVIRONMENT
// ============================================================================

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

const LIVEKIT_URL =
  Deno.env.get("LIVEKIT_URL") ?? "";

const LIVEKIT_API_KEY =
  Deno.env.get("LIVEKIT_API_KEY") ?? "";

const LIVEKIT_API_SECRET =
  Deno.env.get("LIVEKIT_API_SECRET") ?? "";

// ============================================================================
// MODERATION ROLES
// ============================================================================

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

// ============================================================================
// ACTIONS
// ============================================================================

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

const DIRECT_ACTIONS = new Set([
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
]);

const REPORT_ACTION_TYPES = new Set([
  "warn",
  "suspend_stream",
  "arrest",
]);

const VALID_SEVERITIES = new Set([
  "minor",
  "moderate",
  "serious",
  "severe",
]);

// ============================================================================
// CONSTANTS
// ============================================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_REASON_LENGTH = 2000;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_ACTION_DETAILS_LENGTH = 5000;

const DEFAULT_DURATION_MINUTES = 5;
const DEFAULT_DURATION_HOURS = 24;

// ============================================================================
// TYPES
// ============================================================================

type JsonObject = Record<string, unknown>;

type ActorProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  troll_role?: string | null;

  is_admin?: boolean | null;
  is_ceo?: boolean | null;
  is_lead_officer?: boolean | null;
  is_troll_officer?: boolean | null;
  is_secretary?: boolean | null;
  is_broadcaster?: boolean | null;
  is_broadofficer?: boolean | null;
  is_ceo_assistant?: boolean | null;
  is_noah_assistant?: boolean | null;
};

type RpcResult = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

// ============================================================================
// CLIENTS
// ============================================================================

function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

// ============================================================================
// USER AUTH CLIENT
//
// IMPORTANT:
// This client carries the caller's Authorization header.
// It is NOT the service-role client.
// ============================================================================

function createUserAuthClient(
  authorization: string,
) {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is missing.",
    );
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_ANON_KEY is missing.",
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    },
  );
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function jsonResponse(
  body: JsonObject,
  status = 200,
  req?: Request,
): Response {
  const origin =
    req?.headers.get("Origin") ?? "*";

  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin":
          origin,
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods":
          "POST, OPTIONS",
        "Access-Control-Max-Age":
          "86400",
        Vary: "Origin",
      },
    },
  );
}

function ok(
  code: string,
  message: string,
  data: JsonObject = {},
): JsonObject {
  return {
    success: true,
    code,
    message,
    data,
  };
}

function fail(
  code: string,
  message: string,
): JsonObject {
  return {
    success: false,
    code,
    message,
    data: null,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

function isUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    UUID_RE.test(value)
  );
}

function stringValue(
  value: unknown,
  fallback = "",
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function optionalString(
  value: unknown,
  maxLength: number,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const result =
    String(value).trim();

  if (!result) {
    return null;
  }

  return result.slice(0, maxLength);
}

function positiveNumber(
  value: unknown,
  fallback: number,
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}

function normalizeRpcResult(
  result: unknown,
): RpcResult {
  if (
    !result ||
    typeof result !== "object"
  ) {
    return {
      success: false,
      code: "ACTION_FAILED",
      message:
        "The moderation action failed.",
      data: null,
    };
  }

  return result as RpcResult;
}

// ============================================================================
// ROLE HELPERS
// ============================================================================

function getActorRole(
  profile: ActorProfile,
): string {
  const role =
    String(
      profile.role ?? "",
    ).toLowerCase();

  const trollRole =
    String(
      profile.troll_role ?? "",
    ).toLowerCase();

  if (
    MOD_ACTIONS_ROLES.has(role)
  ) {
    return role;
  }

  if (
    MOD_ACTIONS_ROLES.has(trollRole)
  ) {
    return trollRole;
  }

  if (profile.is_admin)
    return "admin";

  if (profile.is_ceo)
    return "ceo";

  if (profile.is_lead_officer)
    return "lead_troll_officer";

  if (profile.is_troll_officer)
    return "troll_officer";

  if (profile.is_secretary)
    return "secretary";

  if (profile.is_broadcaster)
    return "broadcaster";

  if (profile.is_broadofficer)
    return "broadofficer";

  if (profile.is_ceo_assistant)
    return "ceo_assistant";

  if (profile.is_noah_assistant)
    return "noah_assistant";

  return role || trollRole || "user";
}

function hasModerationPermission(
  profile: ActorProfile,
): boolean {
  const role =
    String(
      profile.role ?? "",
    ).toLowerCase();

  const trollRole =
    String(
      profile.troll_role ?? "",
    ).toLowerCase();

  return (
    MOD_ACTIONS_ROLES.has(role) ||
    MOD_ACTIONS_ROLES.has(trollRole) ||
    profile.is_admin === true ||
    profile.is_ceo === true ||
    profile.is_lead_officer === true ||
    profile.is_troll_officer === true ||
    profile.is_secretary === true ||
    profile.is_broadcaster === true ||
    profile.is_broadofficer === true ||
    profile.is_ceo_assistant === true ||
    profile.is_noah_assistant === true
  );
}

// ============================================================================
// AUTHENTICATE REQUEST
//
// IMPORTANT:
// We explicitly pass the caller's JWT to Supabase Auth.
// The returned user is the ONLY source of actor identity.
// ============================================================================

async function authenticateRequest(
  req: Request,
) {
  const authorization =
    req.headers.get(
      "Authorization",
    );

  if (
    !authorization ||
    !/^Bearer\s+\S+$/i.test(
      authorization,
    )
  ) {
    return {
      user: null,
      error: fail(
        "UNAUTHENTICATED",
        "You must be signed in.",
      ),
      status: 401,
    };
  }

  const token =
    authorization
      .replace(/^Bearer\s+/i, "")
      .trim();

  if (!token) {
    return {
      user: null,
      error: fail(
        "UNAUTHENTICATED",
        "You must be signed in.",
      ),
      status: 401,
    };
  }

  try {
    const supabaseAuth =
      createUserAuthClient(
        authorization,
      );

    const {
      data,
      error,
    } =
      await supabaseAuth.auth.getUser(
        token,
      );

    if (
      error ||
      !data?.user
    ) {
      console.error(
        "[moderation-actions] Supabase Auth rejected token:",
        error?.message,
      );

      return {
        user: null,
        error: fail(
          "UNAUTHENTICATED",
          "Your session is invalid or expired.",
        ),
        status: 401,
      };
    }

    return {
      user: data.user,
      error: null,
      status: 200,
    };
  } catch (error) {
    console.error(
      "[moderation-actions] Auth exception:",
      error,
    );

    return {
      user: null,
      error: fail(
        "UNAUTHENTICATED",
        "Unable to validate your session.",
      ),
      status: 401,
    };
  }
}

// ============================================================================
// LIVEKIT JWT
// ============================================================================

function base64UrlEncode(
  value: string,
): string {
  const bytes =
    new TextEncoder().encode(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(
      byte,
    );
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeBytes(
  bytes: Uint8Array,
): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(
      byte,
    );
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createLiveKitAdminToken(
  roomName: string,
): Promise<string> {
  if (
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
  ) {
    throw new Error(
      "LiveKit credentials are not configured.",
    );
  }

  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: LIVEKIT_API_KEY,
    sub:
      "maitroll-moderation-service",
    aud: "livekit",
    iat: now,
    nbf: now - 5,
    exp: now + 60,
    video: {
      room: roomName,
      roomAdmin: true,
      roomJoin: true,
    },
  };

  const encodedHeader =
    base64UrlEncode(
      JSON.stringify(header),
    );

  const encodedPayload =
    base64UrlEncode(
      JSON.stringify(payload),
    );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const cryptoKey =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(
        LIVEKIT_API_SECRET,
      ),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(
        unsignedToken,
      ),
    );

  return (
    `${unsignedToken}.` +
    base64UrlEncodeBytes(
      new Uint8Array(signature),
    )
  );
}

// ============================================================================
// LIVEKIT HTTP
// ============================================================================

function getLiveKitHttpUrl(): string {
  if (!LIVEKIT_URL) {
    throw new Error(
      "LIVEKIT_URL is not configured.",
    );
  }

  return LIVEKIT_URL
    .replace(
      /^wss:\/\//i,
      "https://",
    )
    .replace(
      /^ws:\/\//i,
      "http://",
    )
    .replace(/\/+$/, "");
}

async function liveKitRequest(
  method: string,
  endpoint: string,
  roomName: string,
  body: JsonObject,
) {
  const token =
    await createLiveKitAdminToken(
      roomName,
    );

  const response =
    await fetch(
      `${getLiveKitHttpUrl()}${endpoint}`,
      {
        method,
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(body),
      },
    );

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

// ============================================================================
// LIVEKIT PARTICIPANTS
// ============================================================================

async function getLiveKitParticipants(
  roomName: string,
): Promise<any[]> {
  try {
    const result =
      await liveKitRequest(
        "POST",
        "/twirp/livekit.RoomService/ListParticipants",
        roomName,
        {
          room: roomName,
        },
      );

    if (!result.ok) {
      return [];
    }

    if (
      result.data &&
      typeof result.data ===
        "object" &&
      Array.isArray(
        (result.data as any)
          .participants,
      )
    ) {
      return (
        result.data as any
      ).participants;
    }

    return [];
  } catch (error) {
    console.error(
      "[moderation-actions] LiveKit participant lookup failed:",
      error,
    );

    return [];
  }
}

async function findLiveKitParticipant(
  roomName: string,
  identity: string,
) {
  const participants =
    await getLiveKitParticipants(
      roomName,
    );

  return (
    participants.find(
      (participant: any) =>
        String(
          participant.identity ??
            "",
        ) === identity,
    ) ?? null
  );
}

async function kickLiveKitParticipant(
  roomName: string,
  identity: string,
): Promise<boolean> {
  if (
    !LIVEKIT_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
  ) {
    return false;
  }

  try {
    const result =
      await liveKitRequest(
        "POST",
        "/twirp/livekit.RoomService/RemoveParticipant",
        roomName,
        {
          room: roomName,
          identity,
        },
      );

    return (
      result.ok ||
      result.status === 404
    );
  } catch (error) {
    console.error(
      "[moderation-actions] LiveKit kick failed:",
      error,
    );

    return false;
  }
}

async function muteLiveKitAudio(
  roomName: string,
  identity: string,
  muted: boolean,
): Promise<boolean> {
  if (
    !LIVEKIT_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
  ) {
    return false;
  }

  try {
    const participant =
      await findLiveKitParticipant(
        roomName,
        identity,
      );

    if (!participant) {
      return false;
    }

    const tracks =
      Array.isArray(
        participant.tracks,
      )
        ? participant.tracks
        : [];

    const audioTrack =
      tracks.find(
        (track: any) => {
          const source =
            String(
              track.source ?? "",
            ).toLowerCase();

          const type =
            String(
              track.type ?? "",
            ).toLowerCase();

          return (
            source ===
              "microphone" ||
            source === "mic" ||
            type.includes("audio")
          );
        },
      );

    if (!audioTrack?.sid) {
      return false;
    }

    const result =
      await liveKitRequest(
        "POST",
        "/twirp/livekit.RoomService/MutePublishedTrack",
        roomName,
        {
          room: roomName,
          identity,
          trackSid:
            audioTrack.sid,
          muted,
        },
      );

    return result.ok;
  } catch (error) {
    console.error(
      "[moderation-actions] LiveKit mute failed:",
      error,
    );

    return false;
  }
}

// ============================================================================
// STREAM HELPERS
// ============================================================================

async function resolveRoomName(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  streamId: string,
): Promise<string | null> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("streams")
      .select(
        "id, stream_channel, room_name",
      )
      .eq("id", streamId)
      .maybeSingle();

  if (error || !data) {
    return null;
  }

  const roomName =
    data.stream_channel ||
    data.room_name ||
    data.id;

  return roomName
    ? String(roomName)
    : null;
}

async function getUsername(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
): Promise<string | null> {
  const { data } =
    await supabaseAdmin
      .from("user_profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

  return data?.username
    ? String(data.username)
    : null;
}

// ============================================================================
// SUBMIT REPORT
//
// Reports are NOT moderation actions.
// Any authenticated user may submit a report.
// ============================================================================

async function submitReport(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const reporterId =
    stringValue(
      body.reporter_id,
    );

  const targetUserId =
    optionalString(
      body.target_user_id,
      100,
    );

  const streamId =
    optionalString(
      body.stream_id,
      100,
    );

  const reason =
    optionalString(
      body.reason,
      MAX_REASON_LENGTH,
    );

  const description =
    optionalString(
      body.description,
      MAX_DESCRIPTION_LENGTH,
    );

  if (
    !reporterId ||
    !reason
  ) {
    return fail(
      "INVALID_INPUT",
      "reporter_id and reason are required.",
    );
  }

  // Frontend reporter_id MUST equal authenticated user.
  if (
    reporterId !== userId
  ) {
    return fail(
      "UNAUTHORIZED",
      "reporter_id must match the authenticated user.",
    );
  }

  if (
    targetUserId &&
    !isUuid(targetUserId)
  ) {
    return fail(
      "INVALID_TARGET",
      "target_user_id must be a valid UUID.",
    );
  }

  if (
    streamId &&
    !isUuid(streamId)
  ) {
    return fail(
      "INVALID_STREAM_ID",
      "stream_id must be a valid UUID.",
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("moderation_reports")
      .insert({
        reporter_id:
          reporterId,
        target_user_id:
          targetUserId,
        stream_id:
          streamId,
        report_reason:
          reason,
        report_details:
          description,
        status: "pending",
      })
      .select()
      .single();

  if (error) {
    console.error(
      "[moderation-actions] Report insert failed:",
      error.message,
    );

    return fail(
      "DB_ERROR",
      error.message,
    );
  }

  return ok(
    "REPORT_SUBMITTED",
    "Report submitted.",
    {
      report: data,
    },
  );
}

// ============================================================================
// LIST REPORTS
// ============================================================================

async function listReports(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  actorProfile: ActorProfile,
  body: JsonObject,
): Promise<JsonObject> {
  const statusFilter =
    optionalString(
      body.status_filter,
      50,
    );

  let query =
    supabaseAdmin
      .from("moderation_reports")
      .select(`
        id,
        reporter_id,
        target_user_id,
        stream_id,
        report_reason,
        report_details,
        status,
        resolved_by,
        resolved_at,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

  const actorRole =
    getActorRole(
      actorProfile,
    );

  const isAdmin =
    actorRole === "admin" ||
    actorRole === "ceo" ||
    actorProfile.is_admin === true ||
    actorProfile.is_ceo === true;

  if (!isAdmin) {
    query =
      query.in(
        "status",
        [
          "pending",
          "reviewing",
        ],
      );
  }

  if (statusFilter) {
    query =
      query.eq(
        "status",
        statusFilter,
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      "[moderation-actions] Report listing failed:",
      error.message,
    );

    return fail(
      "DB_ERROR",
      error.message,
    );
  }

  const reports =
    await Promise.all(
      (data ?? []).map(
        async (
          report: any,
        ) => {
          let reporterUsername:
            | string
            | null = null;

          let targetUsername:
            | string
            | null = null;

          let streamTitle:
            | string
            | null = null;

          if (
            report.reporter_id
          ) {
            reporterUsername =
              await getUsername(
                supabaseAdmin,
                report.reporter_id,
              );
          }

          if (
            report.target_user_id
          ) {
            targetUsername =
              await getUsername(
                supabaseAdmin,
                report.target_user_id,
              );
          }

          if (
            report.stream_id
          ) {
            const {
              data: stream,
            } =
              await supabaseAdmin
                .from("streams")
                .select(
                  "title",
                )
                .eq(
                  "id",
                  report.stream_id,
                )
                .maybeSingle();

            streamTitle =
              stream?.title
                ? String(
                    stream.title,
                  )
                : null;
          }

          return {
            report_id:
              report.id,

            id:
              report.id,

            reporter_id:
              report.reporter_id,

            reporter_username:
              reporterUsername,

            reported_user_id:
              report.target_user_id,

            reported_username:
              targetUsername,

            target_user_id:
              report.target_user_id,

            target_username:
              targetUsername,

            report_reason:
              report.report_reason,

            reason:
              report.report_reason,

            report_details:
              report.report_details,

            description:
              report.report_details,

            stream_id:
              report.stream_id,

            stream_title:
              streamTitle,

            status:
              report.status,

            resolved_by:
              report.resolved_by,

            resolved_at:
              report.resolved_at,

            created_at:
              report.created_at,
          };
        },
      ),
    );

  return ok(
    "REPORTS_LISTED",
    "Reports retrieved.",
    {
      reports,
    },
  );
}

// ============================================================================
// REJECT REPORT
// ============================================================================

async function rejectReport(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
  body: JsonObject,
): Promise<JsonObject> {
  const reportId =
    stringValue(
      body.report_id,
    );

  if (!reportId) {
    return fail(
      "INVALID_INPUT",
      "report_id is required.",
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("moderation_reports")
      .update({
        status:
          "rejected",
        resolved_by:
          userId,
        resolved_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        reportId,
      )
      .select(
        "id, status",
      )
      .maybeSingle();

  if (error) {
    console.error(
      "[moderation-actions] Report rejection failed:",
      error.message,
    );

    return fail(
      "DB_ERROR",
      error.message,
    );
  }

  if (!data) {
    return fail(
      "REPORT_NOT_FOUND",
      "The moderation report could not be found.",
    );
  }

  return ok(
    "REPORT_REJECTED",
    "Report rejected.",
    {
      report: data,
    },
  );
}

// ============================================================================
// RECORD MODERATION ACTION
// ============================================================================

async function recordModerationAction(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
  actorRole: string,
  body: JsonObject,
  actionType: string,
  streamId: string | null,
  targetUserId: string | null,
  reason: string | null,
  extra: JsonObject = {},
) {
  const actionPayload = {
    action_type:
      actionType,

    action:
      actionType,

    target_user_id:
      targetUserId,

    reason:
      reason,

    officer_id:
      userId,

    actor_id:
      userId,

    report_id:
      extra.report_id ?? null,

    details:
      extra.details ?? null,

    ban_expires_at:
      extra.ban_expires_at ?? null,

    ban_duration_hours:
      extra.ban_duration_hours ??
      null,

    honesty_message_shown:
      true,

    status:
      "active",

    actor_role:
      actorRole,
  };

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "moderation_actions",
      )
      .insert(
        actionPayload,
      )
      .select()
      .single();

  if (error) {
    console.error(
      "[moderation-actions] moderation_actions insert failed:",
      error.message,
    );

    return {
      data: null,
      error:
        error.message,
    };
  }

  return {
    data,
    error: null,
  };
}

// ============================================================================
// DIRECT MODERATION ACTIONS
// ============================================================================

async function executeDirectAction(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  action: string,
  body: JsonObject,
  userId: string,
): Promise<JsonObject> {
  const streamId =
    optionalString(
      body.stream_id,
      100,
    );

  const targetUserId =
    optionalString(
      body.target_user_id,
      100,
    );

  const reason =
    optionalString(
      body.reason,
      MAX_REASON_LENGTH,
    );

  const durationMinutes =
    positiveNumber(
      body.duration_minutes,
      DEFAULT_DURATION_MINUTES,
    );

  const durationHours =
    positiveNumber(
      body.duration_hours,
      DEFAULT_DURATION_HOURS,
    );

  const severity =
    stringValue(
      body.severity,
      "moderate",
    ).toLowerCase();

  if (
    streamId &&
    !isUuid(streamId)
  ) {
    return fail(
      "INVALID_STREAM_ID",
      "Invalid stream id.",
    );
  }

  // --------------------------------------------------------------------------
  // TARGET VALIDATION
  //
  // Guest identities are allowed ONLY for kick.
  // --------------------------------------------------------------------------

  if (
    action === "kick"
  ) {
    if (
      !targetUserId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id is required.",
      );
    }
  } else if (
    action !== "end_stream"
  ) {
    if (
      !targetUserId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id is required.",
      );
    }

    if (
      !isUuid(
        targetUserId,
      )
    ) {
      return fail(
        "INVALID_TARGET",
        `${action} requires a valid UUID target.`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // MUTE
  // --------------------------------------------------------------------------

  if (
    action === "mute"
  ) {
    if (
      !targetUserId ||
      !streamId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id and stream_id are required.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "moderator_mute_user",
        {
          p_stream_id:
            streamId,

          p_target_user_id:
            targetUserId,

          p_duration_minutes:
            durationMinutes,

          p_reason:
            reason ||
            `Muted for ${durationMinutes} minutes`,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] mute RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to mute user.",
      );
    }

    const result =
      normalizeRpcResult(
        data,
      );

    if (
      result.success === true
    ) {
      const username =
        await getUsername(
          supabaseAdmin,
          targetUserId,
        );

      const roomName =
        await resolveRoomName(
          supabaseAdmin,
          streamId,
        );

      if (
        roomName &&
        username
      ) {
        void muteLiveKitAudio(
          roomName,
          username,
          true,
        ).catch(
          () => {},
        );
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // UNMUTE
  // --------------------------------------------------------------------------

  if (
    action === "unmute"
  ) {
    if (
      !targetUserId ||
      !streamId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id and stream_id are required.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "moderator_unmute_user",
        {
          p_stream_id:
            streamId,

          p_target_user_id:
            targetUserId,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] unmute RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to unmute user.",
      );
    }

    const result =
      normalizeRpcResult(
        data,
      );

    if (
      result.success === true
    ) {
      const username =
        await getUsername(
          supabaseAdmin,
          targetUserId,
        );

      const roomName =
        await resolveRoomName(
          supabaseAdmin,
          streamId,
        );

      if (
        roomName &&
        username
      ) {
        void muteLiveKitAudio(
          roomName,
          username,
          false,
        ).catch(
          () => {},
        );
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // DISABLE CHAT
  // --------------------------------------------------------------------------

  if (
    action ===
    "disable_chat"
  ) {
    if (
      !targetUserId ||
      !streamId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id and stream_id are required.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "moderator_disable_chat",
        {
          p_stream_id:
            streamId,

          p_target_user_id:
            targetUserId,

          p_duration_minutes:
            durationMinutes,

          p_reason:
            reason ||
            `Chat disabled for ${durationMinutes} minutes`,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] disable_chat RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to disable chat.",
      );
    }

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // KICK
  // --------------------------------------------------------------------------

  if (
    action === "kick"
  ) {
    if (
      !targetUserId ||
      !streamId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id and stream_id are required.",
      );
    }

    // Registered user.
    if (
      isUuid(
        targetUserId,
      )
    ) {
      const {
        data,
        error,
      } =
        await supabaseAdmin.rpc(
          "moderator_kick_user",
          {
            p_stream_id:
              streamId,

            p_target_user_id:
              targetUserId,

            p_reason:
              reason ||
              "Kicked by moderator",
          },
        );

      if (error) {
        console.error(
          "[moderation-actions] kick RPC:",
          error.message,
        );

        return fail(
          "RPC_ERROR",
          "Failed to kick user.",
        );
      }

      const result =
        normalizeRpcResult(
          data,
        );

      if (
        result.success === true
      ) {
        const username =
          await getUsername(
            supabaseAdmin,
            targetUserId,
          );

        const roomName =
          await resolveRoomName(
            supabaseAdmin,
            streamId,
          );

        if (
          roomName &&
          username
        ) {
          void kickLiveKitParticipant(
            roomName,
            username,
          ).catch(
            () => {},
          );
        }
      }

      return result;
    }

    // Guest identity.
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "stream_seat_sessions",
        )
        .update({
          status:
            "kicked",

          kick_reason:
            reason ||
            "Kicked by moderator",

          left_at:
            new Date().toISOString(),
        })
        .eq(
          "stream_id",
          streamId,
        )
        .eq(
          "guest_id",
          targetUserId,
        )
        .eq(
          "status",
          "active",
        )
        .select("id")
        .maybeSingle();

    if (error) {
      console.error(
        "[moderation-actions] guest kick:",
        error.message,
      );

      return fail(
        "GUEST_KICK_FAILED",
        "Failed to kick guest.",
      );
    }

    if (!data) {
      return fail(
        "GUEST_NOT_FOUND",
        "The guest is no longer active in this stream.",
      );
    }

    const roomName =
      await resolveRoomName(
        supabaseAdmin,
        streamId,
      );

    if (
      roomName
    ) {
      void kickLiveKitParticipant(
        roomName,
        targetUserId,
      ).catch(
        () => {},
      );
    }

    return ok(
      "ACTION_COMPLETED",
      "Guest kicked successfully.",
      {
        guest: true,
        guest_identity:
          targetUserId,
      },
    );
  }

  // --------------------------------------------------------------------------
  // ARREST
  // --------------------------------------------------------------------------

  if (
    action === "arrest"
  ) {
    if (
      !targetUserId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id is required.",
      );
    }

    if (
      !VALID_SEVERITIES.has(
        severity,
      )
    ) {
      return fail(
        "INVALID_SEVERITY",
        "Invalid moderation severity.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "modo_arrest",
        {
          p_stream_id:
            streamId || null,

          p_target_user_id:
            targetUserId,

          p_reason:
            reason ||
            "Arrested by moderator",

          p_severity:
            severity,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] arrest RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to arrest user.",
      );
    }

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // SUSPEND LICENSE
  // --------------------------------------------------------------------------

  if (
    action ===
    "suspend_license"
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "modo_suspend_license",
        {
          p_target_user_id:
            targetUserId,

          p_reason:
            reason ||
            "License suspended",

          p_duration_hours:
            durationHours,
        },
      );

     if (error) {
      console.error(
        "[moderation-actions] suspend_license RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to suspend license.",
      );
    }

    // Suspend broadcast privileges for the target user.
    await supabaseAdmin
      .from("user_profiles")
      .update({
        is_broadcaster: false,
        license_status: "suspended",
        license_suspended_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", targetUserId);

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // GRANT LICENSE
  // --------------------------------------------------------------------------

  if (
    action ===
    "grant_license"
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "modo_grant_license",
        {
          p_target_user_id:
            targetUserId,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] grant_license RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to grant license.",
      );
    }

    // Restore broadcast privileges for the target user.
    await supabaseAdmin
      .from("user_profiles")
      .update({
        is_broadcaster: true,
        license_status: "active",
        license_restored_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", targetUserId);

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // REMOVE OFFICER
  // --------------------------------------------------------------------------

  if (
    action ===
    "remove_officer"
  ) {
    if (
      !targetUserId ||
      !streamId
    ) {
      return fail(
        "INVALID_INPUT",
        "target_user_id and stream_id are required.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "remove_stream_broadofficer",
        {
          p_stream_id:
            streamId,

          p_officer_id:
            targetUserId,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] remove_officer RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to remove officer.",
      );
    }

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // SET TO USER
  // --------------------------------------------------------------------------

  if (
    action ===
    "set_to_user"
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "reset_user_permissions",
        {
          p_target_user_id:
            targetUserId,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] set_to_user RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to set user role.",
      );
    }

    return normalizeRpcResult(
      data,
    );
  }

  // --------------------------------------------------------------------------
  // END STREAM
  // --------------------------------------------------------------------------

  if (
    action ===
    "end_stream"
  ) {
    if (
      !streamId &&
      !targetUserId
    ) {
      return fail(
        "INVALID_INPUT",
        "stream_id or target_user_id is required.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "modo_end_stream",
        {
          p_stream_id:
            streamId || null,

          p_target_broadcaster_id:
            targetUserId || null,

          p_reason:
            reason ||
            "Ended by moderator",

          p_restrict_duration_minutes:
            durationMinutes,
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] end_stream RPC:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to end stream.",
      );
    }

    return normalizeRpcResult(
      data,
    );
  }

  return fail(
    "INVALID_ACTION",
    `Unknown action: ${action}`,
  );
}

// ============================================================================
// TAKE ACTION
// ============================================================================

async function executeTakeAction(
  supabaseAdmin: ReturnType<
    typeof createAdminClient
  >,
  userId: string,
  actorRole: string,
  body: JsonObject,
): Promise<JsonObject> {
  const actionType =
    stringValue(
      body.action_type,
    ).toLowerCase();

  if (!actionType) {
    return fail(
      "INVALID_INPUT",
      "action_type is required for take_action.",
    );
  }

  if (
    DIRECT_ACTIONS.has(
      actionType,
    )
  ) {
    return executeDirectAction(
      supabaseAdmin,
      actionType,
      body,
      userId,
    );
  }

  if (
    !REPORT_ACTION_TYPES.has(
      actionType,
    )
  ) {
    return fail(
      "INVALID_ACTION",
      `Unknown action_type: ${actionType}`,
    );
  }

  const targetUserId =
    optionalString(
      body.target_user_id,
      100,
    );

  const streamId =
    optionalString(
      body.stream_id,
      100,
    );

  const reason =
    optionalString(
      body.reason,
      MAX_REASON_LENGTH,
    );

  const reportId =
    optionalString(
      body.report_id,
      100,
    );

  const actionDetails =
    optionalString(
      body.action_details,
      MAX_ACTION_DETAILS_LENGTH,
    );

  const banDurationHours =
    body.ban_duration_hours !==
    undefined
      ? positiveNumber(
          body.ban_duration_hours,
          DEFAULT_DURATION_HOURS,
        )
      : null;

  if (!reason) {
    return fail(
      "INVALID_INPUT",
      "reason is required.",
    );
  }

  if (
    targetUserId &&
    !isUuid(targetUserId)
  ) {
    return fail(
      "INVALID_TARGET",
      "target_user_id must be a valid UUID.",
    );
  }

  if (
    streamId &&
    !isUuid(streamId)
  ) {
    return fail(
      "INVALID_STREAM_ID",
      "stream_id must be a valid UUID.",
    );
  }

  let banExpiresAt =
    optionalString(
      body.expires_at,
      100,
    );

  if (
    actionType === "arrest" &&
    banDurationHours &&
    !banExpiresAt
  ) {
    const expiration =
      new Date();

    expiration.setHours(
      expiration.getHours() +
        banDurationHours,
    );

    banExpiresAt =
      expiration.toISOString();
  }

  const actionRecord =
    await recordModerationAction(
      supabaseAdmin,
      userId,
      actorRole,
      body,
      actionType,
      streamId,
      targetUserId,
      reason,
      {
        report_id:
          reportId,

        details:
          actionDetails,

        ban_expires_at:
          banExpiresAt,

        ban_duration_hours:
          banDurationHours,
      },
    );

  if (
    actionRecord.error
  ) {
    return fail(
      "DB_ERROR",
      actionRecord.error,
    );
  }

  // --------------------------------------------------------------------------
  // WARN
  // --------------------------------------------------------------------------

  if (
    actionType === "warn"
  ) {
    if (reportId) {
      await supabaseAdmin
        .from(
          "moderation_reports",
        )
        .update({
          status:
            "resolved",

          resolved_by:
            userId,

          resolved_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reportId,
        );
    }

    return ok(
      "ACTION_COMPLETED",
      "Warning issued.",
      {
        action:
          actionRecord.data,
      },
    );
  }

  // --------------------------------------------------------------------------
  // SUSPEND STREAM
  // --------------------------------------------------------------------------

  if (
    actionType ===
    "suspend_stream"
  ) {
    if (!streamId) {
      return fail(
        "INVALID_INPUT",
        "stream_id is required to suspend a stream.",
      );
    }

    const {
      error,
    } =
      await supabaseAdmin
        .from("streams")
        .update({
          is_live:
            false,
        })
        .eq(
          "id",
          streamId,
        );

    if (error) {
      console.error(
        "[moderation-actions] suspend_stream:",
        error.message,
      );

      return fail(
        "DB_ERROR",
        "Failed to suspend stream.",
      );
    }

    if (reportId) {
      await supabaseAdmin
        .from(
          "moderation_reports",
        )
        .update({
          status:
            "resolved",

          resolved_by:
            userId,

          resolved_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reportId,
        );
    }

    return ok(
      "ACTION_COMPLETED",
      "Stream suspended.",
      {
        action:
          actionRecord.data,
      },
    );
  }

  // --------------------------------------------------------------------------
  // ARREST
  // --------------------------------------------------------------------------

  if (
    actionType ===
    "arrest"
  ) {
    if (!targetUserId) {
      return fail(
        "INVALID_INPUT",
        "target_user_id is required for arrest.",
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "modo_arrest",
        {
          p_stream_id:
            streamId || null,

          p_target_user_id:
            targetUserId,

          p_reason:
            reason,

          p_severity:
            "moderate",
        },
      );

    if (error) {
      console.error(
        "[moderation-actions] take_action arrest:",
        error.message,
      );

      return fail(
        "RPC_ERROR",
        "Failed to arrest user.",
      );
    }

    if (reportId) {
      await supabaseAdmin
        .from(
          "moderation_reports",
        )
        .update({
          status:
            "resolved",

          resolved_by:
            userId,

          resolved_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reportId,
        );
    }

    return ok(
      "ACTION_COMPLETED",
      "Arrest completed.",
      {
        action:
          actionRecord.data,

        result:
          normalizeRpcResult(
            data,
          ),
      },
    );
  }

  return fail(
    "INVALID_ACTION",
    "Unsupported moderation action.",
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(
  async (
    req: Request,
  ): Promise<Response> => {
    // ------------------------------------------------------------------------
    // CORS
    // ------------------------------------------------------------------------

    if (
      req.method === "OPTIONS"
    ) {
      return jsonResponse(
        {
          success: true,
          code: "CORS_OK",
          message:
            "CORS preflight accepted.",
          data: null,
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------------
    // POST ONLY
    // ------------------------------------------------------------------------

    if (
      req.method !== "POST"
    ) {
      return jsonResponse(
        fail(
          "METHOD_NOT_ALLOWED",
          "Method not allowed.",
        ),
        405,
        req,
      );
    }

    try {
      // ----------------------------------------------------------------------
      // SERVER CONFIG
      // ----------------------------------------------------------------------

      if (
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY
      ) {
        console.error(
          "[moderation-actions] Missing Supabase server configuration.",
        );

        return jsonResponse(
          fail(
            "SERVER_MISCONFIGURED",
            "Server configuration error.",
          ),
          500,
          req,
        );
      }

      if (!SUPABASE_ANON_KEY) {
        console.error(
          "[moderation-actions] SUPABASE_ANON_KEY is missing.",
        );

        return jsonResponse(
          fail(
            "SERVER_MISCONFIGURED",
            "Authentication configuration error.",
          ),
          500,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // AUTHENTICATE USER
      // ----------------------------------------------------------------------

      // ======================================================================
      // AUTHENTICATION
      // ======================================================================
      //
      // IMPORTANT:
      // We intentionally use Supabase's server auth context here instead of
      // manually passing the user's ES256 JWT into the service-role client.
      //
      // The incoming Authorization header is:
      //
      //   Authorization: Bearer <SUPABASE_USER_ACCESS_TOKEN>
      //
      // createSupabaseContext() validates the request as a Supabase user request.
      // ======================================================================

      const {
        data: authContext,
        error: authContextError,
      } = await createSupabaseContext(req, {
        auth: "user",
      });

      if (authContextError || !authContext) {
        console.error(
          "[moderation-actions] Authentication failed:",
          authContextError?.message ??
            "No authentication context",
        );

        return jsonResponse(
          fail(
            "UNAUTHENTICATED",
            "You must be signed in.",
          ),
          authContextError?.status ?? 401,
          req,
        );
      }

      // This is the authenticated Supabase user.
      const userClaims = authContext.userClaims;

      const userId = userClaims?.sub ?? null;

      if (!userId) {
        console.error(
          "[moderation-actions] Authenticated request has no user id.",
        );

        return jsonResponse(
          fail(
            "UNAUTHENTICATED",
            "Your authentication session is invalid.",
          ),
          401,
          req,
        );
      }

      // ======================================================================
      // PRIVILEGED DATABASE CLIENT
      // ======================================================================
      //
      // IMPORTANT:
      // authContext.supabaseAdmin uses the server-side secret/service credentials.
      // It is NEVER exposed to the browser.
      //
      // We continue using this client for moderation RPCs and privileged database
      // operations.
      // ======================================================================

      const supabaseAdmin = createAdminClient();

      // ----------------------------------------------------------------------
      // LOAD PROFILE
      // ----------------------------------------------------------------------

      const {
        data: actorProfile,
        error:
          profileError,
      } =
        await supabaseAdmin
          .from(
            "user_profiles",
          )
          .select("*")
          .eq(
            "id",
            userId,
          )
          .maybeSingle();

      if (profileError) {
        console.error(
          "[moderation-actions] Profile lookup error:",
          profileError.message,
        );

        return jsonResponse(
          fail(
            "PROFILE_LOOKUP_ERROR",
            profileError.message,
          ),
          500,
          req,
        );
      }

      if (!actorProfile) {
        return jsonResponse(
          fail(
            "PROFILE_NOT_FOUND",
            "No MaiTroll profile exists for this account.",
          ),
          403,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // PARSE BODY
      // ----------------------------------------------------------------------

      let body: JsonObject;

      try {
        const parsed =
          await req.json();

        if (
          !parsed ||
          typeof parsed !==
            "object" ||
          Array.isArray(parsed)
        ) {
          return jsonResponse(
            fail(
              "INVALID_JSON",
              "Request body must be a JSON object.",
            ),
            400,
            req,
          );
        }

        body =
          parsed as JsonObject;
      } catch {
        return jsonResponse(
          fail(
            "INVALID_JSON",
            "Invalid JSON body.",
          ),
          400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // ACTION
      // ----------------------------------------------------------------------

      const action =
        stringValue(
          body.action,
        ).toLowerCase();

      if (
        !action ||
        !VALID_ACTIONS.has(
          action,
        )
      ) {
        return jsonResponse(
          fail(
            "INVALID_ACTION",
            `Unknown action: ${action || "none"}`,
          ),
          400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // SUBMIT REPORT
      //
      // Any authenticated user can submit a report.
      // ----------------------------------------------------------------------

      if (
        action ===
        "submit_report"
      ) {
        const result =
          await submitReport(
            supabaseAdmin,
            userId,
            body,
          );

        return jsonResponse(
          result,
          result.success
            ? 200
            : 400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // ALL REMAINING ACTIONS REQUIRE MODERATION PERMISSION
      // ----------------------------------------------------------------------

      if (
        !hasModerationPermission(
          actorProfile,
        )
      ) {
        return jsonResponse(
          fail(
            "NOT_AUTHORIZED",
            "You do not have permission to use Mod Actions.",
          ),
          403,
          req,
        );
      }

      const actorRole =
        getActorRole(
          actorProfile,
        );

      // ----------------------------------------------------------------------
      // LIST REPORTS
      // ----------------------------------------------------------------------

      if (
        action ===
        "list_reports"
      ) {
        const result =
          await listReports(
            supabaseAdmin,
            actorProfile,
            body,
          );

        return jsonResponse(
          result,
          result.success
            ? 200
            : 400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // REJECT REPORT
      // ----------------------------------------------------------------------

      if (
        action ===
        "reject_report"
      ) {
        const result =
          await rejectReport(
            supabaseAdmin,
            userId,
            body,
          );

        return jsonResponse(
          result,
          result.success
            ? 200
            : 400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // TAKE ACTION
      // ----------------------------------------------------------------------

      if (
        action ===
        "take_action"
      ) {
        const result =
          await executeTakeAction(
            supabaseAdmin,
            userId,
            actorRole,
            body,
          );

        return jsonResponse(
          result,
          result.success
            ? 200
            : 400,
          req,
        );
      }

      // ----------------------------------------------------------------------
      // DIRECT ACTION
      // ----------------------------------------------------------------------

      const result =
        await executeDirectAction(
          supabaseAdmin,
          action,
          body,
          userId,
        );

      return jsonResponse(
        result,
        result.success
          ? 200
          : 400,
        req,
      );
    } catch (error) {
      console.error(
        "[moderation-actions] UNHANDLED ERROR:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return jsonResponse(
        {
          success: false,
          code: "INTERNAL_ERROR",
          message,
          data: null,
        },
        500,
        req,
      );
    }
  },
);