import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedUser(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<{ userId: string }> {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Missing authentication token");
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Invalid or expired authentication token");
  }

  return { userId: data.user.id };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }
  if (req.method !== "GET" && req.method !== "DELETE") {
    return withCors(
      { success: false, error: "Method not allowed", code: "method_not_allowed" },
      405,
      req,
    );
  }

  try {
    const supabaseUrl = cleanString(Deno.env.get("SUPABASE_URL"));
    const supabaseAnonKey = cleanString(Deno.env.get("SUPABASE_ANON_KEY"));
    const supabaseServiceRoleKey = cleanString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return withCors(
        { success: false, error: "Server configuration missing", code: "server_configuration_missing" },
        500,
        req,
      );
    }

    const { userId } = await getAuthenticatedUser(req, supabaseUrl, supabaseAnonKey);

    const adminDb = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const deviceId = url.searchParams.get("device_id") || "";
      if (!deviceId) {
        return withCors(
          { success: false, error: "device_id is required", code: "missing_device_id" },
          400,
          req,
        );
      }

      const { error } = await adminDb
        .from("maicam_devices")
        .delete()
        .eq("id", deviceId)
        .eq("user_id", userId);

      if (error) {
        return withCors(
          { success: false, error: "Failed to remove device", code: "remove_failed" },
          500,
          req,
        );
      }

      await adminDb
        .from("maicam_sessions")
        .update({ status: "revoked", disconnected_at: new Date().toISOString() })
        .or(`phone_device_id.eq.${deviceId},desktop_device_id.eq.${deviceId}`)
        .eq("status", "connected");

      return withCors({ success: true, removed: "device" }, 200, req);
    }

    // GET - list user's maicam devices and active sessions
    const { data: devices, error: devErr } = await adminDb
      .from("maicam_devices")
      .select("id, device_name, device_type, browser_name, last_connected_at, revoked_at, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (devErr) {
      return withCors(
        { success: false, error: "Failed to load devices", code: "load_failed" },
        500,
        req,
      );
    }

    const { data: sessions, error: sessErr } = await adminDb
      .from("maicam_sessions")
      .select("id, phone_device_id, desktop_device_id, livekit_room_name, status, connected_at, disconnected_at, last_heartbeat_at, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (sessErr) {
      return withCors(
        { success: false, error: "Failed to load sessions", code: "load_failed" },
        500,
        req,
      );
    }

    return withCors(
      {
        success: true,
        devices: devices || [],
        sessions: sessions || [],
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const authError =
      message === "Missing authentication token" ||
      message === "Invalid or expired authentication token";

    return withCors(
      {
        success: false,
        error: message,
        code: authError ? "authentication_required" : "devices_error",
      },
      authError ? 401 : 500,
      req,
    );
  }
});
