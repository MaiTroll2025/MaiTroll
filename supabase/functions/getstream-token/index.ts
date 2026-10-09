import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { StreamClient } from "npm:@stream-io/node-sdk@0.6.0";

const TOKEN_TTL_SECONDS = 30 * 60;

type ParticipantCategory =
  | "host"
  | "publisher"
  | "seat"
  | "moderator"
  | "viewer"
  | "preview"
  | "ghost";

interface TokenRequest {
  room?: unknown;
  roomName?: unknown;
  channel?: unknown;
  mode?: unknown;
  role?: unknown;
  identity?: unknown;
  participantIdentity?: unknown;
  participantName?: unknown;
  userId?: unknown;
  user_name?: unknown;
  name?: unknown;
  displayName?: unknown;
  isHost?: unknown;
  ghost?: unknown;
}

interface ProfileRecord {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  role?: string | null;
  troll_role?: string | null;
  trollRole?: string | null;
  is_admin?: boolean | null;
  is_banned?: boolean | null;
  is_suspended?: boolean | null;
  account_state?: string | null;
  age_verified?: boolean | null;
  identity_verified?: boolean | null;
}

interface StreamRecord {
  id?: string;
  broadcaster_id?: string | null;
  user_id?: string | null;
  host_id?: string | null;
  creator_id?: string | null;
  status?: string | null;
  is_live?: boolean | null;
  started_at?: string | null;
  ended_at?: string | null;
  end_reason?: string | null;
  minutes_remaining?: number | string | null;
  total_minutes_allowed?: number | string | null;
  rtc_provider?: string | null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoomName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 128);
}

function normalizeIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@_. -]/g, "_")
    .slice(0, 128);
}

function normalizeMode(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function normalizeRole(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isRestrictedProfile(profile: ProfileRecord | null): boolean {
  if (!profile) return false;

  const accountState = cleanString(profile.account_state).toLowerCase();

  return (
    profile.is_banned === true ||
    profile.is_suspended === true ||
    ["banned", "suspended", "jailed", "blocked", "disabled"].includes(
      accountState,
    )
  );
}

function isAdmin(profile: ProfileRecord | null): boolean {
  if (!profile) return false;

  const role = cleanString(profile.role).toLowerCase();

  return (
    profile.is_admin === true ||
    ["admin", "super_admin", "platform_admin"].includes(role)
  );
}

function isTownMeetingOfficial(profile: ProfileRecord | null): boolean {
  if (!profile) return false;

  const roles = [profile.role, profile.troll_role, profile.trollRole].map(
    (role) =>
      cleanString(role)
        .toLowerCase()
        .replace(/[\s-]+/g, "_"),
  );

  return (
    profile.is_admin === true ||
    roles.some((role) =>
      [
        "admin",
        "superadmin",
        "super_admin",
        "ceo",
        "lead_troll",
        "troll_officer",
        "pastor",
        "president",
        "vice_president",
        "official",
      ].includes(role),
    )
  );
}

function getStreamOwnerId(stream: StreamRecord | null): string {
  if (!stream) return "";

  return cleanString(
    stream.broadcaster_id ||
      stream.user_id ||
      stream.host_id ||
      stream.creator_id,
  );
}

function streamHasEnded(stream: StreamRecord | null): boolean {
  if (!stream) return false;

  const status = cleanString(stream.status).toLowerCase();

  return (
    Boolean(stream.ended_at) ||
    ["ended", "failed", "cancelled", "canceled", "completed"].includes(status)
  );
}

function streamIsLive(stream: StreamRecord | null): boolean {
  if (!stream || streamHasEnded(stream)) return false;

  const status = cleanString(stream.status).toLowerCase();

  return stream.is_live === true || status === "live";
}

function getRequestedCategory(
  body: TokenRequest,
  mode: string,
  role: string,
): ParticipantCategory {
  if (role === "ghost" || isTruthy(body.ghost)) return "ghost";

  if (isTruthy(body.isHost)) {
    return "host";
  }

  if (role === "host" || mode === "broadcaster") {
    return "host";
  }

  if (role === "publisher" || mode === "publisher") {
    return "publisher";
  }

  if (
    role === "seat" ||
    role === "guest" ||
    mode === "seat" ||
    mode === "seat-publisher"
  ) {
    return "seat";
  }

  if (role === "moderator" || mode === "moderator") {
    return "moderator";
  }

  return "viewer";
}

function categoryCanPublish(category: ParticipantCategory): boolean {
  return category === "host" || category === "seat" || category === "publisher";
}

function categoryCanSubscribe(category: ParticipantCategory): boolean {
  return category !== "ghost";
}

async function getAuthenticatedUser(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<{
  userId: string;
  email: string | null;
  authorization: string;
}> {
  const authorization = req.headers.get("Authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Missing authentication token");
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    console.warn("[getstream-token] Authentication failed", {
      message: error?.message,
    });

    throw new Error("Invalid or expired authentication token");
  }

  return {
    userId: user.id,
    email: user.email || null,
    authorization,
  };
}

async function getProfile(
  adminDb: SupabaseClient,
  userId: string,
): Promise<ProfileRecord | null> {
  const { data, error } = await adminDb
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[getstream-token] Profile lookup failed", {
      userId,
      message: error.message,
    });

    return null;
  }

  return data as ProfileRecord | null;
}

async function getStream(
  adminDb: SupabaseClient,
  roomName: string,
): Promise<StreamRecord | null> {
  const { data, error } = await adminDb
    .from("streams")
    .select("*")
    .eq("id", roomName)
    .maybeSingle();

  if (error) {
    console.warn("[getstream-token] Stream lookup failed", {
      roomName,
      message: error.message,
    });

    return null;
  }

  return data as StreamRecord | null;
}

async function userHasStagePass(
  adminDb: SupabaseClient,
  roomName: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await adminDb
    .from("stream_stage_passes")
    .select("status")
    .eq("stream_id", roomName)
    .eq("user_id", userId)
    .in("status", ["approved", "live"])
    .maybeSingle();

  if (error) {
    console.warn("[getstream-token] Stage-pass lookup failed", {
      roomName,
      userId,
      message: error.message,
    });

    return false;
  }

  return Boolean(data);
}

async function singoffValidateTokenAccess(
  adminDb: SupabaseClient,
  roomName: string,
  userId: string,
  mode: string,
): Promise<boolean> {
  const { data, error } = await adminDb.rpc("singoff_validate_token_access", {
    p_room_name: roomName,
    p_user_id: userId,
    p_mode: mode,
  });

  if (error) {
    console.warn("[getstream-token] Sing Off token validation failed", {
      roomName,
      userId,
      message: error.message,
    });
    return false;
  }

  return Boolean(data);
}

async function createToken(options: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  userId: string;
  category: ParticipantCategory;
}): Promise<string> {
  const client = new StreamClient(options.apiKey, options.apiSecret);

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = client.createToken(options.userId, expiresAt);

  return token;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  if (req.method !== "POST") {
    return withCors(
      {
        success: false,
        error: "Method not allowed",
        code: "method_not_allowed",
      },
      405,
      req,
    );
  }

  try {
    const getstreamApiKey = cleanString(Deno.env.get("GETSTREAM_API_KEY"));
    const getstreamApiSecret = cleanString(
      Deno.env.get("GETSTREAM_API_SECRET"),
    );

    const supabaseUrl = cleanString(Deno.env.get("SUPABASE_URL"));
    const supabaseAnonKey = cleanString(Deno.env.get("SUPABASE_ANON_KEY"));
    const supabaseServiceRoleKey = cleanString(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const missingEnvironmentVariables: string[] = [];

    if (!getstreamApiKey) missingEnvironmentVariables.push("GETSTREAM_API_KEY");
    if (!getstreamApiSecret)
      missingEnvironmentVariables.push("GETSTREAM_API_SECRET");
    if (!supabaseUrl) missingEnvironmentVariables.push("SUPABASE_URL");
    if (!supabaseAnonKey) missingEnvironmentVariables.push("SUPABASE_ANON_KEY");
    if (!supabaseServiceRoleKey)
      missingEnvironmentVariables.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missingEnvironmentVariables.length > 0) {
      console.error("[getstream-token] Missing server configuration", {
        missingEnvironmentVariables,
      });

      return withCors(
        {
          success: false,
          error: "GetStream token service is not configured.",
          code: "server_configuration_missing",
          missingEnvironmentVariables,
        },
        500,
        req,
      );
    }

    let body: TokenRequest;

    try {
      body = (await req.json()) as TokenRequest;
    } catch {
      return withCors(
        {
          success: false,
          error: "Invalid JSON request body",
          code: "invalid_json",
        },
        400,
        req,
      );
    }

    const rawRoomName = cleanString(body.room || body.roomName || body.channel);
    const roomName = normalizeRoomName(rawRoomName);

    if (!roomName) {
      return withCors(
        {
          success: false,
          error: "Missing room name",
          code: "missing_room",
        },
        400,
        req,
      );
    }

    const mode = normalizeMode(body.mode);
    const role = normalizeRole(body.role);

    let authenticated;
    let userId: string;
    let isAnonymousViewer = false;

    try {
      authenticated = await getAuthenticatedUser(
        req,
        supabaseUrl,
        supabaseAnonKey,
      );

      userId = authenticated.userId;
    } catch (authError) {
      const viewerOnly =
        mode === "audience" ||
        mode === "viewer" ||
        role === "viewer" ||
        role === "audience" ||
        (mode !== "publisher" &&
          mode !== "broadcaster" &&
          mode !== "seat-publisher" &&
          mode !== "singoff-publisher" &&
          mode !== "singoff-viewer" &&
          role !== "publisher" &&
          role !== "host");

      if (!viewerOnly) {
        console.warn(
          "[getstream-token] Authentication failed for non-viewer request",
          {
            message:
              authError instanceof Error
                ? authError.message
                : String(authError),
          },
        );

        return withCors(
          {
            success: false,
            error: "Missing authentication token",
            code: "authentication_required",
          },
          401,
          req,
        );
      }

      const fallbackIdentity =
        cleanString(body.identity) ||
        cleanString(body.participantIdentity) ||
        cleanString(body.userId) ||
        cleanString(body.user_name) ||
        cleanString(body.name) ||
        cleanString(body.displayName) ||
        cleanString(body.participantName) ||
        `anon-viewer-${Date.now()}`;

      userId = fallbackIdentity;
      isAnonymousViewer = true;

      console.log("[getstream-token] Allowing anonymous viewer token", {
        roomName,
        identity: userId,
        mode,
        role,
      });
    }

    const identity = normalizeIdentity(userId);

    if (!identity) {
      return withCors(
        {
          success: false,
          error: "Unable to determine participant identity",
          code: "invalid_identity",
        },
        400,
        req,
      );
    }

    const adminDb = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const profile = isAnonymousViewer
      ? null
      : await getProfile(adminDb, userId);

    if (!isAnonymousViewer && isRestrictedProfile(profile)) {
      return withCors(
        {
          success: false,
          error: "Your account is not permitted to join broadcasts.",
          code: "account_restricted",
        },
        403,
        req,
      );
    }

    let category = getRequestedCategory(body, mode, role);
    let isBattleRoom = false;
    let isTownMeetingRoom = false;
    let battleBroadcaster = false;
    let battleStatus = "";

    const userIsAdmin = isAnonymousViewer ? false : isAdmin(profile);

    if (roomName.startsWith("town-meeting-")) {
      const meetingId = roomName.slice("town-meeting-".length);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(meetingId)) {
        return withCors(
          {
            success: false,
            error: "Invalid town meeting room name.",
            code: "invalid_town_meeting_room",
          },
          403,
          req,
        );
      }

      if (isAnonymousViewer || !isTownMeetingOfficial(profile)) {
        return withCors(
          {
            success: false,
            error: "Only Mai Troll officials may join this meeting.",
            code: "town_meeting_official_required",
          },
          403,
          req,
        );
      }

      const { data: meeting, error: meetingError } = await adminDb
        .from("town_meetings")
        .select("id, is_active, is_ended, ended_at")
        .eq("id", meetingId)
        .maybeSingle();

      if (
        meetingError ||
        !meeting ||
        meeting.is_active !== true ||
        meeting.is_ended === true ||
        Boolean(meeting.ended_at)
      ) {
        return withCors(
          {
            success: false,
            error: "This town meeting is not active.",
            code: "town_meeting_inactive",
          },
          403,
          req,
        );
      }

      const { data: assignedSeat, error: seatError } = await adminDb
        .from("town_meeting_seats")
        .select("id")
        .eq("meeting_id", meetingId)
        .eq("user_id", userId)
        .maybeSingle();

      if (seatError || !assignedSeat) {
        return withCors(
          {
            success: false,
            error: "Claim an open seat before joining the town meeting.",
            code: "town_meeting_seat_required",
          },
          403,
          req,
        );
      }

      isTownMeetingRoom = true;
      category = "seat";
    }

    if (roomName.startsWith("battle-")) {
      isBattleRoom = true;
      const battleId = roomName.slice("battle-".length);

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(battleId)) {
        return withCors(
          {
            success: false,
            error: "Invalid battle room name.",
            code: "invalid_battle_room",
          },
          403,
          req,
        );
      }

      const { data: battle, error: battleError } = await adminDb
        .from("battles")
        .select("id, challenger_stream_id, opponent_stream_id, status")
        .eq("id", battleId)
        .maybeSingle();

      if (battleError || !battle) {
        return withCors(
          {
            success: false,
            error: "Battle not found.",
            code: "battle_not_found",
          },
          403,
          req,
        );
      }

      battleStatus = cleanString(battle.status).toLowerCase();

      if (["ended", "cancelled", "canceled"].includes(battleStatus)) {
        return withCors(
          {
            success: false,
            error: "This battle has ended.",
            code: "battle_ended",
          },
          403,
          req,
        );
      }

      const { data: battleStreams, error: streamsError } = await adminDb
        .from("streams")
        .select("*")
        .in("id", [battle.challenger_stream_id, battle.opponent_stream_id]);

      if (streamsError || !battleStreams || battleStreams.length !== 2) {
        return withCors(
          {
            success: false,
            error: "Battle streams not found.",
            code: "battle_streams_not_found",
          },
          403,
          req,
        );
      }

      const challengerStream = battleStreams.find(
        (s) => s.id === battle.challenger_stream_id,
      );
      const opponentStream = battleStreams.find(
        (s) => s.id === battle.opponent_stream_id,
      );

      const challengerOwnerId = getStreamOwnerId(challengerStream);
      const opponentOwnerId = getStreamOwnerId(opponentStream);

      const userOwnsChallenger =
        challengerOwnerId && challengerOwnerId === userId;
      const userOwnsOpponent = opponentOwnerId && opponentOwnerId === userId;
      battleBroadcaster = userOwnsChallenger || userOwnsOpponent;

      console.log("[getstream-token][battle]", {
        battleId,
        roomName,
        userId,
        challengerStreamId: battle.challenger_stream_id,
        opponentStreamId: battle.opponent_stream_id,
        challengerOwnerId,
        opponentOwnerId,
        resolvedParticipantType: battleBroadcaster ? "broadcaster" : "viewer",
        canPublish: battleBroadcaster,
        canSubscribe: true,
      });

      if (battleBroadcaster) {
        category = "host";
      } else if (
        category === "host" ||
        category === "publisher" ||
        category === "seat"
      ) {
        return withCors(
          {
            success: false,
            error: "You are not authorized to publish in this battle.",
            code: "battle_publish_denied",
          },
          403,
          req,
        );
      } else {
        category = "viewer";
      }
    }

    const stream =
      isBattleRoom || isTownMeetingRoom
        ? null
        : await getStream(adminDb, roomName);
    const streamOwnerId = isBattleRoom ? "" : getStreamOwnerId(stream);
    const userOwnsStream = isBattleRoom
      ? false
      : Boolean(streamOwnerId && streamOwnerId === userId);

    if (category === "ghost" && !userIsAdmin) {
      return withCors(
        {
          success: false,
          error: "Ghost access is restricted to administrators.",
          code: "ghost_access_denied",
        },
        403,
        req,
      );
    }

    if (mode === "singoff-publisher" || mode === "singoff-viewer") {
      const accessOk = await singoffValidateTokenAccess(
        adminDb,
        roomName,
        userId,
        mode,
      );

      if (!accessOk) {
        return withCors(
          {
            success: false,
            error: "You are not authorized for this Mai Sing Off session.",
            code: "singoff_access_denied",
          },
          403,
          req,
        );
      }

      category = mode === "singoff-publisher" ? "publisher" : "viewer";
    }

    if (
      category === "host" &&
      !userOwnsStream &&
      !userIsAdmin &&
      !(isBattleRoom && battleBroadcaster)
    ) {
      return withCors(
        {
          success: false,
          error: "You are not authorized to host this broadcast.",
          code: "host_access_denied",
        },
        403,
        req,
      );
    }

    if (
      category === "seat" &&
      !isTownMeetingRoom &&
      !userOwnsStream &&
      !userIsAdmin &&
      !(isBattleRoom && battleBroadcaster)
    ) {
      const hasStagePass = await userHasStagePass(adminDb, roomName, userId);

      if (!hasStagePass) {
        return withCors(
          {
            success: false,
            error: "You do not have an approved guest seat.",
            code: "stage_pass_required",
          },
          403,
          req,
        );
      }
    }

    if (
      category === "viewer" &&
      !isTownMeetingRoom &&
      !userOwnsStream &&
      !userIsAdmin &&
      !isBattleRoom
    ) {
      const hasStagePass = await userHasStagePass(adminDb, roomName, userId);

      if (hasStagePass) {
        category = "seat";
      }
    }

    if (isTownMeetingRoom) {
      // Meeting activity and seat authorization were checked above.
    } else if (isBattleRoom) {
      if (["ended", "cancelled", "canceled"].includes(battleStatus)) {
        return withCors(
          {
            success: false,
            error: "This broadcast has ended.",
            code: "broadcast_ended",
          },
          403,
          req,
        );
      }
    } else {
      if (streamHasEnded(stream)) {
        return withCors(
          {
            success: false,
            error: "This broadcast has ended.",
            code: "broadcast_ended",
          },
          403,
          req,
        );
      }
    }

    const _isLive = isBattleRoom ? true : streamIsLive(stream);

    const participantName =
      cleanString(body.displayName || body.name || body.participantName) ||
      cleanString(profile?.display_name) ||
      cleanString(profile?.username) ||
      "Participant";

    const token = await createToken({
      apiKey: getstreamApiKey,
      apiSecret: getstreamApiSecret,
      roomName,
      userId: identity,
      category,
    });

    if (!token) {
      console.error("[getstream-token] SDK returned malformed token", {
        roomName,
        identity,
      });

      return withCors(
        {
          success: false,
          error: "Token generation failed.",
          code: "token_generation_failed",
        },
        500,
        req,
      );
    }

    console.log("[getstream-token] Token generated", {
      roomName,
      identity,
      participantName,
      category,
      mode,
      canPublish: categoryCanPublish(category),
      canSubscribe: categoryCanSubscribe(category),
      tokenLength: token.length,
    });

    return withCors(
      {
        success: true,
        token,
        accessToken: token,
        callId: roomName,
        userId: identity,
        expiresIn: TOKEN_TTL_SECONDS,
        participantType: category,
        mode,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("[getstream-token] Unhandled error", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const authenticationError =
      message === "Missing authentication token" ||
      message === "Invalid or expired authentication token";

    return withCors(
      {
        success: false,
        error: message,
        code: authenticationError
          ? "authentication_required"
          : "getstream_token_error",
        stage: "getstream-token",
      },
      authenticationError ? 401 : 500,
      req,
    );
  }
});
