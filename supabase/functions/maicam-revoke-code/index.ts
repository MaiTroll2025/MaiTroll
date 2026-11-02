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
  if (req.method !== "POST") {
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

    const body = (await req.json()) as {
      code_id?: string;
      pairing_code_id?: string;
      device_id?: string;
      session_id?: string;
    };

    const codeId = cleanString(body.code_id ?? body.pairing_code_id);
    const deviceId = cleanString(body.device_id);
    const sessionId = cleanString(body.session_id);
    const now = new Date().toISOString();

    if (codeId) {
      const { error } = await adminDb
        .from("maicam_pairing_codes")
        .update({ revoked_at: now })
        .eq("id", codeId)
        .eq("user_id", userId)
        .is("consumed_at", null)
        .is("revoked_at", null);
      if (error) {
        return withCors(
          { success: false, error: "Failed to revoke pairing code", code: "revoke_failed" },
          500,
          req,
        );
      }
      return withCors({ success: true, revoked: "pairing_code" }, 200, req);
    }

    if (deviceId) {
      const { error } = await adminDb
        .from("maicam_devices")
        .delete()
        .eq("id", deviceId)
        .eq("user_id", userId);
      if (error) {
        return withCors(
          { success: false, error: "Failed to revoke device", code: "revoke_failed" },
          500,
          req,
        );
      }
      // Invalidate any active sessions tied to this device
      await adminDb
        .from("maicam_sessions")
        .update({ status: "revoked", disconnected_at: now })
        .or(`phone_device_id.eq.${deviceId},desktop_device_id.eq.${deviceId}`)
        .eq("status", "connected");
      return withCors({ success: true, revoked: "device" }, 200, req);
    }

    if (sessionId) {
      const { error } = await adminDb
        .from("maicam_sessions")
        .update({ status: "revoked", disconnected_at: now })
        .eq("id", sessionId)
        .eq("user_id", userId)
        .eq("status", "connected");
      if (error) {
        return withCors(
          { success: false, error: "Failed to revoke session", code: "revoke_failed" },
          500,
          req,
        );
      }
      return withCors({ success: true, revoked: "session" }, 200, req);
    }

    return withCors(
      { success: false, error: "Nothing to revoke", code: "nothing_to_revoke" },
      400,
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
        code: authError ? "authentication_required" : "revoke_error",
      },
      authError ? 401 : 500,
      req,
    );
  }
});
