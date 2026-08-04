import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_review_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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

    // Verify admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 403, req)
    }

    const isAdmin = profile.role === "admin" || profile.is_admin === true
    if (!isAdmin) {
      return withCors({ success: false, error: "Forbidden: admin only" }, 403, req)
    }

    const body = await req.json()
    const { application_id, action, admin_note } = body

    if (!application_id || !action) {
      return withCors(
        { success: false, error: "application_id and action are required" },
        400,
        req,
      )
    }

    if (!["approve", "deny", "request_info"].includes(action)) {
      return withCors({ success: false, error: "Invalid action. Must be approve, deny, or request_info" }, 400, req)
    }

    // Fetch the application
    const { data: app, error: appError } = await supabase
      .from("celeb_applications")
      .select("id, user_id, status, full_name")
      .eq("id", application_id)
      .maybeSingle()

    if (appError || !app) {
      return withCors({ success: false, error: "Application not found" }, 404, req)
    }

    let newStatus: string
    if (action === "approve") {
      newStatus = "approved"
    } else if (action === "deny") {
      newStatus = "denied"
    } else {
      newStatus = "in_review"
    }

    // Update application
    const { error: updateError } = await supabase
      .from("celeb_applications")
      .update({
        status: newStatus,
        reviewer_id: user.id,
        admin_note,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", application_id)

    if (updateError) {
      console.error(`[CelebReview ${requestId}] Update error:`, updateError)
      return withCors({ success: false, error: "Failed to update application" }, 500, req)
    }

    // If approved, set celeb_role on user_profiles and create celeb_profiles row
    if (action === "approve") {
      const { error: roleError } = await supabase
        .from("user_profiles")
        .update({ celeb_role: "approved" })
        .eq("id", app.user_id)

      if (roleError) {
        console.error(`[CelebReview ${requestId}] Role update error:`, roleError)
        return withCors({ success: false, error: "Failed to set celeb role" }, 500, req)
      }

      // Create celeb profile
      const { error: profileInsertError } = await supabase
        .from("celeb_profiles")
        .insert({
          user_id: app.user_id,
          display_name: app.full_name || app.user_id,
          bio: null,
          category: null,
          verification_level: "basic",
          is_live_allowed: true,
        })

      if (profileInsertError) {
        console.warn(`[CelebReview ${requestId}] Celeb profile creation warning:`, profileInsertError)
      }
    } else if (action === "deny") {
      // Set celeb_role to NULL on denial
      const { error: roleError } = await supabase
        .from("user_profiles")
        .update({ celeb_role: null })
        .eq("id", app.user_id)

      if (roleError) {
        console.warn(`[CelebReview ${requestId}] Role clear warning:`, roleError)
      }
    }

    // Send notification to the celeb applicant (application_id + status only — no docs)
    await supabase.rpc("create_notification", {
      p_user_id: app.user_id,
      p_type: "celeb_application",
      p_title: action === "approve"
        ? "Celeb Application Approved"
        : action === "deny"
          ? "Celeb Application Denied"
          : "Celeb Application Needs Review",
      p_message: action === "approve"
        ? "Your Celeb application has been approved. You can now create Celeb Streams."
        : action === "deny"
          ? `Your Celeb application has been denied. ${admin_note || ""}`
          : "Your Celeb application needs more information. Please check and resubmit.",
      p_metadata: { application_id, review_status: newStatus },
    })

    // Audit log
    await supabase.from("celeb_audit_logs").insert({
      user_id: user.id,
      action: `application_${action}`,
      entity_type: "celeb_applications",
      entity_id: application_id,
      details: { application_user_id: app.user_id, note_provided: !!admin_note },
    })

    console.log(`[CelebReview ${requestId}] Application ${action} by admin ${user.id}`)

    return withCors(
      {
        success: true,
        application_id,
        status: newStatus,
      },
      200,
      req,
    )
  } catch (error) {
    console.error(`[CelebReview ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Review failed" },
      500,
      req,
    )
  }
})
