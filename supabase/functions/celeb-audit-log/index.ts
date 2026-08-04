import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return withCors({ success: false, error: "Missing Authorization" }, 401, req)
    }

    const { createClient } = await import("jsr:@supabase/supabase-js@2")
    const anonSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    )

    const {
      data: { user },
      error: authError,
    } = await anonSupabase.auth.getUser()

    if (authError || !user) {
      return withCors({ success: false, error: "Unauthorized" }, 401, req)
    }

    const userId = user.id
    const body = await req.json()
    const { action, limit } = body

    if (action === "self") {
      const { data: logs, error: logsError } = await supabase
        .from("celeb_audit_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit || 100)

      if (logsError) {
        return withCors({ success: false, error: "Failed to load audit logs" }, 500, req)
      }

      return withCors({ success: true, logs }, 200, req)
    }

    // Admin: view any user's audit logs
    const { data: adminProfile, error: adminError } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", userId)
      .maybeSingle()

    if (adminError || !adminProfile) {
      return withCors({ success: false, error: "Profile not found" }, 404, req)
    }

    const isAdmin = adminProfile.role === "admin" || adminProfile.is_admin === true
    if (!isAdmin) {
      return withCors({ success: false, error: "Admin only" }, 403, req)
    }

    const { target_user_id } = body
    if (!target_user_id) {
      return withCors({ success: false, error: "target_user_id is required for admin view" }, 400, req)
    }

    const { data: adminLogs, error: adminLogsError } = await supabase
      .from("celeb_audit_logs")
      .select("*")
      .eq("user_id", target_user_id)
      .order("created_at", { ascending: false })
      .limit(limit || 200)

    if (adminLogsError) {
      return withCors({ success: false, error: "Failed to load audit logs" }, 500, req)
    }

    return withCors({ success: true, logs: adminLogs }, 200, req)
  } catch (error) {
    console.error(`[CelebAudit ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Audit log operation failed" },
      500,
      req,
    )
  }
})
