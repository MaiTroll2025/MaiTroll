import { createClient } from "jsr:@supabase/supabase-js@2";

const responseHeaders = { "Content-Type": "application/json" };
const PAGE_SIZE = 500;

type StorageObject = {
  bucket_id: string;
  object_name: string;
};

function isMissingAuthUser(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  return candidate.status === 404
    || candidate.code === "user_not_found"
    || candidate.message?.toLowerCase().includes("user not found") === true;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const cleanupSecret = Deno.env.get("TEMP_REVIEW_CLEANUP_SECRET");
  if (!cleanupSecret) {
    console.error("[temporary-review-cleanup] Cleanup secret is not configured");
    return jsonResponse(503, { error: "Cleanup is not configured" });
  }

  if (request.headers.get("Authorization") !== `Bearer ${cleanupSecret}`) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[temporary-review-cleanup] Supabase service configuration is incomplete");
    return jsonResponse(503, { error: "Cleanup is not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: claimedAccounts, error: claimError } = await admin.rpc(
    "claim_expired_temporary_review_accounts",
    { p_limit: 25 },
  );
  if (claimError) {
    console.error("[temporary-review-cleanup] Failed to claim expired accounts", claimError);
    return jsonResponse(500, { error: "Could not claim expired accounts" });
  }

  let deleted = 0;
  let failed = 0;

  for (const account of claimedAccounts ?? []) {
    const userId = account.user_id as string;
    let failureCode:
      | "storage_cleanup_failed"
      | "owned_record_cleanup_failed"
      | "auth_delete_failed"
      | "profile_cleanup_failed" = "storage_cleanup_failed";

    try {
      failureCode = "auth_delete_failed";
      const { data: authResult, error: lookupError } = await admin.auth.admin.getUserById(userId);
      if (lookupError && !isMissingAuthUser(lookupError)) throw lookupError;
      if (authResult?.user) {
        const { error: banError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        });
        if (banError) throw banError;
      }

      failureCode = "storage_cleanup_failed";
      for (;;) {
        const { data: objects, error: listError } = await admin.rpc(
          "list_temporary_review_storage_objects",
          { p_user_id: userId, p_offset: 0, p_limit: PAGE_SIZE },
        );
        if (listError) throw listError;

        const storageObjects = (objects ?? []) as StorageObject[];
        if (storageObjects.length === 0) break;

        const objectsByBucket = new Map<string, string[]>();
        for (const object of storageObjects) {
          const bucketObjects = objectsByBucket.get(object.bucket_id) ?? [];
          bucketObjects.push(object.object_name);
          objectsByBucket.set(object.bucket_id, bucketObjects);
        }

        for (const [bucket, paths] of objectsByBucket) {
          const { error: removeError } = await admin.storage.from(bucket).remove(paths);
          if (removeError) throw removeError;
        }
      }

      failureCode = "owned_record_cleanup_failed";
      const { error: recordsError } = await admin.rpc(
        "cleanup_temporary_review_owned_records",
        { p_user_id: userId },
      );
      if (recordsError) throw recordsError;

      failureCode = "auth_delete_failed";
      if (authResult?.user) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
        if (deleteError) {
          const { error: verificationError } = await admin.auth.admin.getUserById(userId);
          if (!isMissingAuthUser(verificationError)) throw deleteError;
        }
      }

      failureCode = "profile_cleanup_failed";
      const { error: completionError } = await admin.rpc(
        "complete_temporary_review_account_deletion",
        { p_user_id: userId },
      );
      if (completionError) throw completionError;
      deleted += 1;
    } catch (error) {
      failed += 1;
      const { data: shouldAlert, error: auditError } = await admin.rpc(
        "record_temporary_review_deletion_failure",
        { p_user_id: userId, p_failure_code: failureCode },
      );

      console.error(
        `[temporary-review-cleanup] Deletion attempt failed (${failureCode})`,
        error,
      );

      if (auditError) {
        console.error("[temporary-review-cleanup] Could not record failure status", auditError);
        continue;
      }

      if (shouldAlert) {
        const { data: admins, error: adminsError } = await admin
          .from("user_profiles")
          .select("id")
          .or("role.eq.admin,is_admin.eq.true");

        if (adminsError) {
          console.error("[temporary-review-cleanup] Could not load administrator recipients", adminsError);
          continue;
        }

        const notifications = (admins ?? []).map((administrator: { id: string }) => ({
          user_id: administrator.id,
          type: "temporary_review_account_cleanup_failed",
          title: "Review account cleanup needs attention",
          content: "An expired temporary review account could not be fully removed. Automatic retries will continue.",
          link: "/admin/users",
        }));

        if (notifications.length > 0) {
          const { error: notificationError } = await admin.from("notifications").insert(notifications);
          if (notificationError) {
            console.error("[temporary-review-cleanup] Could not notify administrators", notificationError);
          }
        }
      }
    }
  }

  return jsonResponse(200, {
    ok: failed === 0,
    claimed: (claimedAccounts ?? []).length,
    deleted,
    failed,
  });
});
