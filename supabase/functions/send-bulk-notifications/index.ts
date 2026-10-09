import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;
const NOTIFICATION_BATCH_SIZE = 25;

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[send-bulk-notifications] Required Supabase environment variables are missing");
    return jsonResponse({ error: "Bulk notifications are not configured on the server." }, 500, origin);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication is required." }, 401, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Your session is invalid or expired." }, 401, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminProfile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("role, is_admin, is_lead_officer")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("[send-bulk-notifications] Admin authorization lookup failed:", profileError.message);
    return jsonResponse({ error: "Unable to verify administrator permissions." }, 500, origin);
  }
  const authorized = adminProfile && (
    adminProfile.is_admin === true ||
    adminProfile.is_lead_officer === true ||
    ["admin", "superadmin", "ceo", "lead_troll_officer"].includes(String(adminProfile.role || "").toLowerCase())
  );
  if (!authorized) {
    return jsonResponse({ error: "Administrator permission is required to send bulk notifications." }, 403, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, origin);
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400, origin);
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const metadata = body.metadata === undefined ? {} : body.metadata;
  const sendToAll = body.sendToAll;
  const targetUserIds = body.targetUserIds === undefined ? [] : body.targetUserIds;
  if (!/^[a-z][a-z0-9_]{0,59}$/.test(type)) {
    return jsonResponse({ error: "A valid notification type is required." }, 400, origin);
  }
  if (!title || title.length > 120 || !message || message.length > 4000) {
    return jsonResponse({ error: "Title (1-120 characters) and message (1-4000 characters) are required." }, 400, origin);
  }
  if (!isRecord(metadata) || JSON.stringify(metadata).length > 8000) {
    return jsonResponse({ error: "Metadata must be a JSON object no larger than 8 KB." }, 400, origin);
  }
  if (!Array.isArray(targetUserIds) || targetUserIds.length > 500 ||
      targetUserIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return jsonResponse({ error: "Selected recipients must be an array of no more than 500 valid user IDs." }, 400, origin);
  }
  if (typeof sendToAll !== "boolean" ||
      (sendToAll && targetUserIds.length > 0) ||
      (!sendToAll && targetUserIds.length === 0)) {
    return jsonResponse({ error: "Choose all users or provide at least one selected recipient, but not both." }, 400, origin);
  }

  const selectedIds = [...new Set(targetUserIds as string[])];
  let notificationCount = 0;
  let failedCount = 0;
  const failures: Array<{ userId: string; error: string }> = [];
  const notificationMetadata = {
    ...metadata,
    source: "admin_bulk_notification",
    sent_by: authData.user.id,
  };

  const sendBatch = async (userIds: string[]) => {
    for (let index = 0; index < userIds.length; index += NOTIFICATION_BATCH_SIZE) {
      const batch = userIds.slice(index, index + NOTIFICATION_BATCH_SIZE);
      const results = await Promise.all(batch.map(async (userId) => {
        const { data, error } = await adminClient.rpc("create_notification", {
          p_user_id: userId,
          p_type: type,
          p_title: title,
          p_message: message,
          p_metadata: notificationMetadata,
        });
        if (error) return { userId, error: error.message };
        if (!data) return { userId, error: "Notification insert returned no record ID." };
        return null;
      }));
      for (const result of results) {
        if (result) {
          failedCount += 1;
          if (failures.length < 25) failures.push(result);
        } else {
          notificationCount += 1;
        }
      }
    }
  };

  try {
    if (!sendToAll) {
      const { data: recipients, error } = await adminClient
        .from("user_profiles")
        .select("id")
        .in("id", selectedIds);
      if (error) throw new Error(`Failed to validate selected recipients: ${error.message}`);
      const foundIds = new Set((recipients || []).map((recipient) => recipient.id));
      const missingIds = selectedIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        return jsonResponse({
          error: "One or more selected recipients no longer exist. Search again and retry.",
          missingRecipientCount: missingIds.length,
        }, 400, origin);
      }
      await sendBatch(selectedIds);
    } else {
      let offset = 0;
      while (true) {
        const { data: recipients, error } = await adminClient
          .from("user_profiles")
          .select("id")
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(`Failed to load notification recipients: ${error.message}`);
        const userIds = (recipients || []).map((recipient) => recipient.id);
        if (userIds.length === 0) break;
        await sendBatch(userIds);
        if (userIds.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    if (notificationCount + failedCount === 0) {
      return jsonResponse({ error: sendToAll ? "No eligible user profiles were found." : "No notifications were created for the selected recipients." }, 400, origin);
    }
    const success = failedCount === 0;
    return jsonResponse({
      success,
      notificationCount,
      failedCount,
      failures,
      message: success
        ? `Notification created for ${notificationCount} user${notificationCount === 1 ? "" : "s"}.`
        : `Created ${notificationCount} notifications; ${failedCount} failed. Review the failed recipient details and retry.`,
    }, success ? 200 : 207, origin);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Notification delivery failed.";
    console.error("[send-bulk-notifications] Delivery failed:", errorMessage);
    return jsonResponse({ error: errorMessage }, 500, origin);
  }
});
