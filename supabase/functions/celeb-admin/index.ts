import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_admin_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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

    // --- Verify admin ---
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 403, req)
    }

    const isAdmin = profile.role === "admin" || profile.is_admin === true
    if (!isAdmin) {
      return withCors({ success: false, error: "Forbidden: admin only" }, 403, req)
    }

    const body = await req.json()
    const {
      action,
      application_id,
      application_status,
      review_action,
      admin_note,
      cashout_id,
      admin_action,
    } = body

    if (!action) {
      return withCors({ success: false, error: "action is required" }, 400, req)
    }

    // ---------------------------------------------------------------------------
    // Application management
    // ---------------------------------------------------------------------------
    if (action === "list_applications") {
      let query = supabase
        .from("celeb_applications")
        .select("id, user_id, full_name, status, submitted_at, reviewed_at, reviewer_id")
        .order("created_at", { ascending: false })

      if (application_status) {
        query = query.eq("status", application_status)
      }

      const { data: apps, error: listError } = await query

      if (listError) {
        console.error(`[CelebAdmin ${requestId}] list_applications error:`, listError)
        return withCors({ success: false, error: "Failed to list applications" }, 500, req)
      }

      return withCors({ success: true, applications: apps }, 200, req)
    }

    if (action === "get_application") {
      if (!application_id) {
        return withCors({ success: false, error: "application_id is required" }, 400, req)
      }

      const { data: app, error: appError } = await supabase
        .from("celeb_applications")
        .select("*")
        .eq("id", application_id)
        .maybeSingle()

      if (appError || !app) {
        return withCors({ success: false, error: "Application not found" }, 404, req)
      }

      // Fetch public profile info (never expose identity documents here)
      const { data: appUserProfile } = await supabase
        .from("user_profiles")
        .select("username, full_name, avatar_url, role")
        .eq("id", app.user_id)
        .maybeSingle()

      return withCors(
        {
          success: true,
          application: app,
          applicant: appUserProfile,
          documents: app.application_status === "approved"
            ? null
            : null,
        },
        200,
        req,
      )
    }

    if (action === "review_application") {
      if (!application_id || !review_action) {
        return withCors(
          { success: false, error: "application_id and review_action are required" },
          400,
          req,
        )
      }

      if (!["approve", "deny", "request_info"].includes(review_action)) {
        return withCors(
          { success: false, error: "Invalid review_action. Must be approve, deny, or request_info" },
          400,
          req,
        )
      }

      const { data: app, error: appError } = await supabase
        .from("celeb_applications")
        .select("id, user_id, status, full_name")
        .eq("id", application_id)
        .maybeSingle()

      if (appError || !app) {
        return withCors({ success: false, error: "Application not found" }, 404, req)
      }

      let newStatus: string
      if (review_action === "approve") {
        newStatus = "approved"
      } else if (review_action === "deny") {
        newStatus = "denied"
      } else {
        newStatus = "in_review"
      }

      const { error: updateError } = await supabase
        .from("celeb_applications")
        .update({
          status: newStatus,
          reviewer_id: userId,
          admin_note,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", application_id)

      if (updateError) {
        console.error(`[CelebAdmin ${requestId}] Update error:`, updateError)
        return withCors({ success: false, error: "Failed to update application" }, 500, req)
      }

      if (review_action === "approve") {
        const { error: roleError } = await supabase
          .from("user_profiles")
          .update({ celeb_role: "approved" })
          .eq("id", app.user_id)

        if (roleError) {
          console.error(`[CelebAdmin ${requestId}] Role update error:`, roleError)
          return withCors({ success: false, error: "Failed to set celeb role" }, 500, req)
        }

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
          console.warn(`[CelebAdmin ${requestId}] Celeb profile creation warning:`, profileInsertError)
        }
      } else if (review_action === "deny") {
        await supabase
          .from("user_profiles")
          .update({ celeb_role: null })
          .eq("id", app.user_id)
      }

      // Notify the applicant (application_id + status only — no documents)
      await supabase.rpc("create_notification", {
        p_user_id: app.user_id,
        p_type: "celeb_application",
        p_title:
          review_action === "approve"
            ? "Celeb Application Approved"
            : review_action === "deny"
              ? "Celeb Application Denied"
              : "Celeb Application Needs Review",
        p_message:
          review_action === "approve"
            ? "Your Celeb application has been approved. You can now create Celeb Streams."
            : review_action === "deny"
              ? `Your Celeb application has been denied. ${admin_note || ""}`
              : "Your Celeb application needs more information. Please check and resubmit.",
        p_metadata: { application_id, review_status: newStatus },
      })

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: `application_${review_action}`,
        entity_type: "celeb_applications",
        entity_id: application_id,
        details: { application_user_id: app.user_id, note_provided: !!admin_note },
      })

      console.log(`[CelebAdmin ${requestId}] Application ${review_action} by admin ${user.id}`)

      return withCors({ success: true, application_id, status: newStatus }, 200, req)
    }

    // ---------------------------------------------------------------------------
    // Cashout management
    // ---------------------------------------------------------------------------
    if (action === "list_cashouts") {
      const { data: allRequests, error: allError } = await supabase
        .from("celeb_cashout_requests")
        .select("*, celeb_cashout_tiers(name, min_earned_usd, fee_percent)")
        .order("requested_at", { ascending: false })

      if (allError) {
        console.error(`[CelebAdmin ${requestId}] list_cashouts error:`, allError)
        return withCors({ success: false, error: "Failed to list cashout requests" }, 500, req)
      }

      return withCors({ success: true, requests: allRequests }, 200, req)
    }

    if (action === "review_cashout") {
      if (!cashout_id || !admin_action) {
        return withCors(
          { success: false, error: "cashout_id and admin_action are required" },
          400,
          req,
        )
      }

      if (!["approve", "reject", "pay"].includes(admin_action)) {
        return withCors({ success: false, error: "Invalid admin_action. Must be approve, reject, or pay" }, 400, req)
      }

      let newStatus: string
      if (admin_action === "approve") newStatus = "processing"
      else if (admin_action === "pay") newStatus = "paid"
      else newStatus = "rejected"

      const { data: updated, error: updateError } = await supabase
        .from("celeb_cashout_requests")
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          admin_id: userId,
          admin_note,
        })
        .eq("id", cashout_id)
        .select()
        .maybeSingle()

      if (updateError || !updated) {
        return withCors({ success: false, error: "Cashout request not found or update failed" }, 404, req)
      }

      await supabase.rpc("create_notification", {
        p_user_id: updated.celeb_user_id,
        p_type: "cashout_status",
        p_title:
          newStatus === "paid"
            ? "Cashout Processed"
            : newStatus === "processing"
              ? "Cashout Approved"
              : "Cashout Rejected",
        p_message:
          newStatus === "paid"
            ? "Your cashout request has been paid."
            : newStatus === "processing"
              ? "Your cashout request has been approved for processing."
              : "Your cashout request has been rejected.",
        p_metadata: { cashout_id, status: newStatus },
      })

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: `cashout_${admin_action}`,
        entity_type: "celeb_cashout_requests",
        entity_id: cashout_id,
        details: { new_status: newStatus, note_provided: !!admin_note },
      })

      return withCors({ success: true, status: newStatus }, 200, req)
    }

    // ---------------------------------------------------------------------------
    // Audit log viewer
    // ---------------------------------------------------------------------------
    if (action === "audit_logs") {
      const { user_id: auditUserId, entity_type, limit } = body
      const take = Number(limit) || 50

      let auditQuery = supabase
        .from("celeb_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(take)

      if (auditUserId) {
        auditQuery = auditQuery.eq("user_id", auditUserId)
      }
      if (entity_type) {
        auditQuery = auditQuery.eq("entity_type", entity_type)
      }

      const { data: logs, error: auditError } = await auditQuery

      if (auditError) {
        console.error(`[CelebAdmin ${requestId}] audit_logs error:`, auditError)
        return withCors({ success: false, error: "Failed to fetch audit logs" }, 500, req)
      }

      return withCors({ success: true, logs }, 200, req)
    }

    return withCors(
      {
        success: false,
        error:
          "Invalid action. Use list_applications, get_application, review_application, list_cashouts, review_cashout, or audit_logs",
      },
      400,
      req,
    )
  } catch (error) {
    console.error(`[CelebAdmin ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Admin operation failed" },
      500,
      req,
    )
  }
})
