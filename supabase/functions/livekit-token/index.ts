import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  AccessToken,
  type VideoGrant,
} from "npm:livekit-server-sdk@2.17.0";

/**
 * LiveKit token generator
 *
 * Security:
 * - Tokens are generated with LiveKit's official server SDK.
 * - The authenticated Supabase user determines participant identity.
 * - Client-supplied user IDs are not trusted.
 * - Host/publisher access is checked server-side.
 *
 * Camera quality is capped at 720p (1280x720 @ 30fps, 2Mbps) for all participants.
 * No viewer, participant, or broadcast-duration caps are enforced.
 */

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
    .replace(/[^a-zA-Z0-9_:@.-]/g, "_")
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

  if (
    role === "host" ||
    mode === "broadcaster"
  ) {
    return "host";
  }

  if (
    role === "publisher" ||
    mode === "publisher"
  ) {
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
  return category !== "ghost" || true;
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
    console.warn("[livekit-token] Authentication failed", {
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
    console.warn("[livekit-token] Profile lookup failed", {
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
    console.warn("[livekit-token] Stream lookup failed", {
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
    console.warn("[livekit-token] Stage-pass lookup failed", {
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
    console.warn("[livekit-token] Sing Off token validation failed", {
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
  identity: string;
  participantName: string;
  category: ParticipantCategory;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const canPublish = categoryCanPublish(options.category);
  const canSubscribe = categoryCanSubscribe(options.category);
  const hidden = options.category === "ghost";

  const token = new AccessToken(options.apiKey, options.apiSecret, {
    identity: options.identity,
    name: options.participantName,
    metadata: JSON.stringify(options.metadata),
    ttl: TOKEN_TTL_SECONDS,
  });

  const grant: VideoGrant = {
    roomJoin: true,
    room: options.roomName,
    canPublish,
    canSubscribe,
    canPublishData: canPublish,
    hidden,

    /*
     * Restrict publishers to camera and microphone.
     * This prevents LiveKit screen-share tracks from being authorized.
     */
    canPublishSources: canPublish
      ? ([1, 2] as VideoGrant["canPublishSources"])
      : undefined,
  };

  token.addGrant(grant);

  return await token.toJwt();
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
    const liveKitUrl = cleanString(Deno.env.get("LIVEKIT_URL"));
    const liveKitApiKey = cleanString(Deno.env.get("LIVEKIT_API_KEY"));
    const liveKitApiSecret = cleanString(
      Deno.env.get("LIVEKIT_API_SECRET"),
    );

    const supabaseUrl = cleanString(Deno.env.get("SUPABASE_URL"));
    const supabaseAnonKey = cleanString(
      Deno.env.get("SUPABASE_ANON_KEY"),
    );
    const supabaseServiceRoleKey = cleanString(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const missingEnvironmentVariables: string[] = [];

    if (!liveKitUrl) missingEnvironmentVariables.push("LIVEKIT_URL");
    if (!liveKitApiKey) {
      missingEnvironmentVariables.push("LIVEKIT_API_KEY");
    }
    if (!liveKitApiSecret) {
      missingEnvironmentVariables.push("LIVEKIT_API_SECRET");
    }
    if (!supabaseUrl) missingEnvironmentVariables.push("SUPABASE_URL");
    if (!supabaseAnonKey) {
      missingEnvironmentVariables.push("SUPABASE_ANON_KEY");
    }
    if (!supabaseServiceRoleKey) {
      missingEnvironmentVariables.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (missingEnvironmentVariables.length > 0) {
      console.error("[livekit-token] Missing server configuration", {
        missingEnvironmentVariables,
      });

      return withCors(
        {
          success: false,
          error: "LiveKit token service is not configured.",
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

    const rawRoomName = cleanString(
      body.room || body.roomName || body.channel,
    );
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

    const authenticated = await getAuthenticatedUser(
      req,
      supabaseUrl,
      supabaseAnonKey,
    );

    const userId = authenticated.userId;

    /*
     * Never trust body.userId/body.identity as the authoritative user ID.
     */
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

    const adminDb = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const profile = await getProfile(adminDb, userId);

    if (isRestrictedProfile(profile)) {
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

    const mode = normalizeMode(body.mode);
    const role = normalizeRole(body.role);

    let category = getRequestedCategory(body, mode, role);
    let isBattleRoom = false;
    let battleBroadcaster = false;
    let battleStatus = "";

    const userIsAdmin = isAdmin(profile);

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
        .in("id", [
          battle.challenger_stream_id,
          battle.opponent_stream_id,
        ]);

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
      const userOwnsOpponent =
        opponentOwnerId && opponentOwnerId === userId;
      battleBroadcaster = userOwnsChallenger || userOwnsOpponent;

      console.log("[livekit-token][battle]", {
        battleId,
        roomName,
        userId,
        challengerStreamId: battle.challenger_stream_id,
        opponentStreamId: battle.opponent_stream_id,
        challengerOwnerId,
        opponentOwnerId,
        resolvedParticipantType: battleBroadcaster
          ? "broadcaster"
          : "viewer",
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

    const stream = isBattleRoom ? null : await getStream(adminDb, roomName);
    const streamOwnerId = isBattleRoom ? "" : getStreamOwnerId(stream);
    const userOwnsStream = isBattleRoom
      ? false
      : Boolean(streamOwnerId && streamOwnerId === userId);

    /*
     * Ghost viewing is restricted to administrators.
     */
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

    /*
     * Mai Sing Off rooms (mai-singoff-*) are not broadcast streams. Authorization
     * is enforced server-side via the authoritative session/participant tables.
     */
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

    /*
     * Only the owner or an admin may receive a host token.
     * Battle broadcasters are authorized server-side via the battle lookup above.
     */
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

    /*
     * A requested seat token requires an active stage pass.
     */
    if (
      category === "seat" &&
      !userOwnsStream &&
      !userIsAdmin &&
      !(isBattleRoom && battleBroadcaster)
    ) {
      const hasStagePass = await userHasStagePass(
        adminDb,
        roomName,
        userId,
      );

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

    /*
     * Preserve compatibility with old clients that request audience mode
     * after receiving an approved stage pass.
     */
    if (
      category === "viewer" &&
      !userOwnsStream &&
      !userIsAdmin &&
      !isBattleRoom
    ) {
      const hasStagePass = await userHasStagePass(
        adminDb,
        roomName,
        userId,
      );

      if (hasStagePass) {
        category = "seat";
      }
    }

    if (isBattleRoom) {
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

    const isLive = isBattleRoom ? true : streamIsLive(stream);

    const participantName =
      cleanString(body.displayName || body.name || body.participantName) ||
      cleanString(profile?.display_name) ||
      cleanString(profile?.username) ||
      "Participant";

    const metadata = {
      userId,
      role: category,
      mode,
      hidden: category === "ghost",
      qualityCap: "720p",
    };

    const token = await createToken({
      apiKey: liveKitApiKey,
      apiSecret: liveKitApiSecret,
      roomName,
      identity,
      participantName,
      category,
      metadata,
    });

    if (!token || token.split(".").length !== 3) {
      console.error("[livekit-token] SDK returned malformed token", {
        roomName,
        identity,
        tokenLength: token?.length || 0,
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

    console.log("[livekit-token] Token generated", {
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

        url: liveKitUrl,
        serverUrl: liveKitUrl,
        livekitUrl: liveKitUrl,

        roomName,
        room: roomName,

        participantIdentity: identity,
        participantName,

        isPublisher: categoryCanPublish(category),
        canPublish: categoryCanPublish(category),
        canSubscribe: categoryCanSubscribe(category),

        isGhost: category === "ghost",
        participantType: category,
        mode,
        qualityCap: "720p",
        expiresIn: TOKEN_TTL_SECONDS,

        cameraLimits: {
          maxWidth: 1280,
          maxHeight: 720,
          maxFrameRate: 30,
          maxBitrate: 2_000_000,
          screenShareAllowed: false,
        },
      },
      200,
      req,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[livekit-token] Unhandled error", {
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
          : "livekit_token_error",
        stage: "livekit-token",
      },
      authenticationError ? 401 : 500,
      req,
    );
  }
});
