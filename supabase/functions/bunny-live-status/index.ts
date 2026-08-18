import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const bunnyApiBase = (Deno.env.get("BUNNY_STREAM_API_URL") ?? Deno.env.get("BUNNY_API_URL") ?? "https://video.bunnycdn.com").replace(/\/$/, "");
const bunnyApiKey = Deno.env.get("BUNNY_STREAM_API_KEY") ?? Deno.env.get("BUNNY_API_KEY") ?? "";
const bunnyLibraryId = Deno.env.get("BUNNY_STREAM_LIBRARY_ID") ?? Deno.env.get("BUNNY_LIBRARY_ID") ?? "";

const adminDb = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Error("Missing authentication token");
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw new Error("Invalid or expired authentication token");
  }

  return user;
}

async function getBunnyStatus(bunnyStreamId: string) {
  if (!bunnyApiKey || !bunnyLibraryId || !bunnyStreamId) {
    return { ok: true, enabled: false, status: "disabled" };
  }

  const endpoints = [
    `${bunnyApiBase}/library/${bunnyLibraryId}/live/streams/${encodeURIComponent(bunnyStreamId)}`,
    `${bunnyApiBase}/library/${bunnyLibraryId}/videos/${encodeURIComponent(bunnyStreamId)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "AccessKey": bunnyApiKey,
        },
      });

      if (response.status === 404) continue;
      const raw = await response.json().catch(() => null);
      if (response.ok) {
        return { ok: true, enabled: true, status: raw?.status || raw?.state || "unknown", raw };
      }

      return { ok: false, enabled: true, error: `Bunny status request failed (${response.status}): ${JSON.stringify(raw)}` };
    } catch (error) {
      console.warn("[bunny-live-status] Endpoint failed", endpoint, error);
    }
  }

  return { ok: true, enabled: true, status: "unknown" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed", code: "method_not_allowed" }, 405, req);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const streamId = String(body?.streamId || body?.id || "").trim();
    if (!streamId) {
      return withCors({ success: false, error: "Missing streamId", code: "missing_stream_id" }, 400, req);
    }

    const user = await getAuthenticatedUser(req);
    const { data: stream, error: streamError } = await adminDb
      .from("streams")
      .select("id, user_id, broadcaster_id, owner_id, bunny_stream_id")
      .eq("id", streamId)
      .maybeSingle();

    if (streamError || !stream) {
      return withCors({ success: false, error: "Stream not found", code: "stream_not_found" }, 404, req);
    }

    const isOwner = [stream.user_id, stream.broadcaster_id, stream.owner_id].includes(user.id);
    const { data: profile } = await adminDb.from("user_profiles").select("role, is_admin").eq("id", user.id).maybeSingle();
    const isAdmin = Boolean(profile?.is_admin || profile?.role === "admin");

    if (!isOwner && !isAdmin) {
      return withCors({ success: false, error: "You are not authorized to check delivery for this stream", code: "forbidden" }, 403, req);
    }

    const status = await getBunnyStatus(stream.bunny_stream_id || "");
    await adminDb
      .from("streams")
      .update({
        bunny_status: status.status || "unknown",
        delivery_status: status.ok && status.enabled ? status.status || "unknown" : "disabled",
      })
      .eq("id", streamId);

    return withCors({ success: true, streamId, status }, 200, req);
  } catch (error: any) {
    console.error("[bunny-live-status] Unhandled error", error);
    return withCors({ success: false, error: error?.message || "Unknown delivery status error", code: "delivery_status_failed" }, 500, req);
  }
});
