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

async function stopBunnyStream(bunnyStreamId: string) {
  if (!bunnyStreamId || !bunnyApiKey || !bunnyLibraryId) {
    return { ok: true, skipped: true, reason: "Bunny delivery not configured" };
  }

  const attempts = [
    {
      method: "DELETE",
      url: `${bunnyApiBase}/library/${bunnyLibraryId}/live/streams/${encodeURIComponent(bunnyStreamId)}`,
    },
    {
      method: "DELETE",
      url: `${bunnyApiBase}/library/${bunnyLibraryId}/videos/${encodeURIComponent(bunnyStreamId)}`,
    },
    {
      method: "POST",
      url: `${bunnyApiBase}/library/${bunnyLibraryId}/live/streams/${encodeURIComponent(bunnyStreamId)}/stop`,
    },
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers: {
          "Content-Type": "application/json",
          "AccessKey": bunnyApiKey,
        },
      });

      if (response.status === 404 || response.status === 410) {
        return { ok: true, skipped: true, reason: "Already absent on Bunny" };
      }

      const raw = await response.text();
      if (response.ok) {
        return { ok: true, skipped: false, status: response.status, raw };
      }

      lastError = new Error(`Bunny stop request failed (${response.status}): ${raw}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { ok: true, skipped: true, reason: "No stop endpoint available" };
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
      return withCors({ success: false, error: "You are not authorized to stop delivery for this stream", code: "forbidden" }, 403, req);
    }

    if (stream.bunny_stream_id) {
      await stopBunnyStream(stream.bunny_stream_id).catch((error) => {
        console.warn("[bunny-live-stop] Bunny stop attempt failed", error);
      });
    }

    await adminDb
      .from("streams")
      .update({
        bunny_status: "stopped",
        delivery_status: "stopped",
        delivery_stopped_at: new Date().toISOString(),
        delivery_provider: "bunny",
      })
      .eq("id", streamId);

    return withCors({ success: true, streamId, stopped: true }, 200, req);
  } catch (error: any) {
    console.error("[bunny-live-stop] Unhandled error", error);
    return withCors({ success: false, error: error?.message || "Unknown delivery stop error", code: "delivery_stop_failed" }, 500, req);
  }
});
