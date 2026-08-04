import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_cashout_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { action, tier_id, earned_usd, provider_type, provider_username, cashout_id, admin_note, admin_action } = body

    if (action === "tiers") {
      // Public: list active cashout tiers
      const { data: tiers, error: tiersError } = await supabase
        .from("celeb_cashout_tiers")
        .select("*")
        .eq("is_active", true)
        .order("min_earned_usd", { ascending: true })

      if (tiersError) {
        return withCors({ success: false, error: "Failed to load tiers" }, 500, req)
      }

      return withCors({ success: true, tiers }, 200, req)
    }

    if (action === "list") {
      // Celeb views their own cashout requests
      const { data: requests, error: listError } = await supabase
        .from("celeb_cashout_requests")
        .select("*, celeb_cashout_tiers(name, min_earned_usd, fee_percent)")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })

      if (listError) {
        return withCors({ success: false, error: "Failed to list cashout requests" }, 500, req)
      }

      return withCors({ success: true, requests }, 200, req)
    }

    if (action === "request") {
      // Validate via server-side RPC to prevent frontend price tampering
      const result = await supabase.rpc("create_celeb_cashout_request", {
        p_user_id: userId,
        p_tier_id: tier_id,
        p_earned_usd: earned_usd,
        p_provider_type: provider_type,
        p_provider_username: provider_username,
      })

      if (result.error) {
        console.error(`[CelebCashout ${requestId}] RPC error:`, result.error)
        return withCors(
          { success: false, error: result.error.message || "Cashout request failed" },
          400,
          req,
        )
      }

      return withCors({ success: true, result: result.data }, 200, req)
    }

    if (action === "admin_list") {
      // Admin-only: list all cashout requests
      const { data: adminProfile, error: adminCheckError } = await supabase
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", userId)
        .maybeSingle()

      if (adminCheckError || !adminProfile) {
        return withCors({ success: false, error: "Profile not found" }, 404, req)
      }

      const isAdmin = adminProfile.role === "admin" || adminProfile.is_admin === true
      if (!isAdmin) {
        return withCors({ success: false, error: "Admin only" }, 403, req)
      }

      const { data: allRequests, error: allError } = await supabase
        .from("celeb_cashout_requests")
        .select("*, celeb_cashout_tiers(name, min_earned_usd, fee_percent)")
        .order("requested_at", { ascending: false })

      if (allError) {
        return withCors({ success: false, error: "Failed to list requests" }, 500, req)
      }

      return withCors({ success: true, requests: allRequests }, 200, req)
    }

    if (action === "admin_review") {
      const { data: adminProfile, error: adminCheckError } = await supabase
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", userId)
        .maybeSingle()

      if (adminCheckError || !adminProfile) {
        return withCors({ success: false, error: "Profile not found" }, 404, req)
      }

      const isAdmin = adminProfile.role === "admin" || adminProfile.is_admin === true
      if (!isAdmin) {
        return withCors({ success: false, error: "Admin only" }, 403, req)
      }

      if (!cashout_id || !admin_action) {
        return withCors({ success: false, error: "cashout_id and admin_action are required" }, 400, req)
      }

      if (!["approve", "reject", "pay"].includes(admin_action)) {
        return withCors({ success: false, error: "Invalid admin_action" }, 400, req)
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

      // Notify celeb
      await supabase.rpc("create_notification", {
        p_user_id: updated.celeb_user_id,
        p_type: "cashout_status",
        p_title: `Cashout ${newStatus === "paid" ? "Processed" : newStatus === "processing" ? "Approved" : "Rejected"}`,
        p_message: `Your cashout request has been ${newStatus === "paid" ? "paid" : newStatus === "processing" ? "approved for processing" : "rejected"}.`,
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

    return withCors({ success: false, error: "Invalid action" }, 400, req)
  } catch (error) {
    console.error(`[CelebCashout ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Cashout operation failed" },
      500,
      req,
    )
  }
})
