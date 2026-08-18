import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

async function getStreamRow(streamId: string) {
  const { data, error } = await adminDb
    .from("streams")
    .select("id, user_id, broadcaster_id, owner_id, title, status")
    .eq("id", streamId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
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
    const roomName = String(body?.roomName || body?.room || "").trim();

    if (!streamId) {
      return withCors({ success: false, error: "Missing streamId", code: "missing_stream_id" }, 400, req);
    }

    const user = await getAuthenticatedUser(req);
    const stream = await getStreamRow(streamId);

    if (!stream) {
      return withCors({ success: false, error: "Stream not found", code: "stream_not_found" }, 404, req);
    }

    const isOwner = [stream.user_id, stream.broadcaster_id, stream.owner_id].includes(user.id);
    const isAdmin = (await adminDb.from("user_profiles").select("role, is_admin").eq("id", user.id).maybeSingle()).data && ((await adminDb.from("user_profiles").select("role, is_admin").eq("id", user.id).maybeSingle()).data?.role === "admin" || (await adminDb.from("user_profiles").select("role, is_admin").eq("id", user.id).maybeSingle()).data?.is_admin);

    if (!isOwner && !isAdmin) {
      return withCors({ success: false, error: "You are not authorized to start delivery for this stream", code: "forbidden" }, 403, req);
    }

    return withCors({
      success: true,
      enabled: false,
      streamId: stream.id,
      roomName,
      message: "Bunny delivery is currently disabled; LiveKit remains in control of live broadcasts",
    }, 200, req);
  } catch (error: any) {
    console.error("[bunny-live-start] Unhandled error", error);
    return withCors({ success: false, error: error?.message || "Unknown delivery startup error", code: "delivery_start_failed" }, 500, req);
  }
});
