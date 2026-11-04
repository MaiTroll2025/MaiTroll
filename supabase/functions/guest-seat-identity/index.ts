import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function requestRateKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const connecting = req.headers.get("cf-connecting-ip")?.trim();
  return `guest-seat:${connecting || forwarded || "unknown"}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  if (req.method !== "POST") {
    return withCors({ error: "Method not allowed" }, 405, req);
  }

  try {
    const { error: cleanupError } = await admin.rpc("cleanup_guest_seat_identities");
    if (cleanupError) {
      console.error("guest identity cleanup failed:", cleanupError);
    }

    const { data, error } = await admin.rpc("issue_guest_seat_identity", {
      p_rate_key: requestRateKey(req),
    });

    if (error) {
      console.error("guest identity issuance failed:", error);
      return withCors({ success: false, error: error.message }, 429, req);
    }

    return withCors(data, 200, req);
  } catch (error) {
    console.error("guest identity endpoint failed:", error);
    return withCors({ success: false, error: "Unable to issue guest identity" }, 500, req);
  }
});
