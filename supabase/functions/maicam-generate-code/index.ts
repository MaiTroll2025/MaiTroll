import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CODE_TTL_SECONDS = 5 * 60; // 5 minutes
const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes ambiguous 0/O/1/I/L

function generateCode(): string {
  let code = "";
  const crypto = globalThis.crypto;
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = crypto.getRandomValues(new Uint32Array(1))[0] % CODE_CHARS.length;
    code += CODE_CHARS[idx];
  }
  return code;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface TokenRequest {
  code?: unknown;
  intended_role?: unknown;
  device_id?: unknown;
  device_name?: unknown;
  device_type?: unknown;
  browser_name?: unknown;
}

async function getAuthenticatedUser(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<{ userId: string; email: string | null }> {
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

  return { userId: data.user.id, email: data.user.email ?? null };
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): string {
  return cleanString(value).toLowerCase();
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

    const body: TokenRequest = (await req.json()) as TokenRequest;
    const intendedRole = normalizeRole(body.intended_role) || "phone";

    if (intendedRole !== "phone" && intendedRole !== "desktop") {
      return withCors(
        { success: false, error: "Invalid intended_role", code: "invalid_role" },
        400,
        req,
      );
    }

    // Optionally register/touch the originating device
    let originatingDeviceId: string | null = null;
    const rawDeviceId = cleanString(body.device_id);
    const rawDeviceName = cleanString(body.device_name) || "MaiCam Device";
    const rawDeviceType = cleanString(body.device_type) || intendedRole === "phone" ? "phone" : "desktop";
    const rawBrowserName = cleanString(body.browser_name) || null;

    if (rawDeviceId) {
      const { data: existing } = await adminDb
        .from("maicam_devices")
        .select("id")
        .eq("id", rawDeviceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        originatingDeviceId = rawDeviceId;
      }
    }

    if (!originatingDeviceId) {
      const { data: inserted, error: insErr } = await adminDb
        .from("maicam_devices")
        .insert({
          user_id: userId,
          device_name: rawDeviceName,
          device_type: rawDeviceType,
          browser_name: rawBrowserName,
        })
        .select("id")
        .single();
      if (insErr) {
        console.warn("[maicam-generate-code] device insert failed", insErr.message);
      } else {
        originatingDeviceId = inserted.id;
      }
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

    const { data: pairingCode, error: pcErr } = await adminDb
      .from("maicam_pairing_codes")
      .insert({
        user_id: userId,
        code_hash: codeHash,
        originating_device_id: originatingDeviceId ?? undefined,
        intended_role: intendedRole,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (pcErr || !pairingCode) {
      console.warn("[maicam-generate-code] insert failed", pcErr?.message);
      return withCors(
        { success: false, error: "Failed to generate pairing code", code: "generation_failed" },
        500,
        req,
      );
    }

    return withCors(
      {
        success: true,
        code,
        expires_at: pairingCode.expires_at,
        ttl_seconds: CODE_TTL_SECONDS,
        pairing_code_id: pairingCode.id,
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
        code: authError ? "authentication_required" : "generate_code_error",
      },
      authError ? 401 : 500,
      req,
    );
  }
});
