import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function sha256Hex(input: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

    const body = (await req.json()) as { code?: string };
    const rawCode = cleanString(body.code);
    if (!rawCode) {
      return withCors(
        { success: false, error: "Pairing code is required", code: "missing_code" },
        400,
        req,
      );
    }

    const codeHash = await sha256Hex(rawCode);
    const now = new Date().toISOString();

    // Atomic single-use claim: only one consumer can flip consumed_at from null.
    const { data: claimed, error: claimErr } = await adminDb
      .from("maicam_pairing_codes")
      .update({ consumed_at: now })
      .eq("code_hash", codeHash)
      .eq("user_id", userId)
      .is("consumed_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .select("id, user_id, intended_role, originating_device_id, expires_at, consumed_at")
      .single();

    if (claimErr || !claimed) {
      return withCors(
        {
          success: false,
          error: "Invalid, expired, consumed, or revoked pairing code",
          code: "code_invalid",
        },
        400,
        req,
      );
    }

    return withCors(
      {
        success: true,
        pairing_code_id: claimed.id,
        intended_role: claimed.intended_role,
        originating_device_id: claimed.originating_device_id,
        consumed_at: claimed.consumed_at,
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
        code: authError ? "authentication_required" : "consume_code_error",
      },
      authError ? 401 : 500,
      req,
    );
  }
});
