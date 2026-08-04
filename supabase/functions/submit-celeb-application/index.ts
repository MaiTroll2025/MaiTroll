import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_app_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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

    const anonSupabase = new (await import("jsr:@supabase/supabase-js@2")).createClient(
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

    const {
      full_name,
      phone_number,
      email,
      social_media = {},
    } = body

    if (!full_name || !phone_number) {
      return withCors(
        { success: false, error: "full_name and phone_number are required" },
        400,
        req,
      )
    }

    // Create / replace the application. Users can only have one pending/in_review application.
    const { data: existing, error: checkError } = await supabase
      .from("celeb_applications")
      .select("id, status")
      .eq("user_id", userId)
      .is("status", "in", ["pending", "in_review"])
      .maybeSingle()

    if (checkError) {
      console.error(`[CelebApp ${requestId}] Check error:`, checkError)
      return withCors({ success: false, error: "Failed to check existing application" }, 500, req)
    }

    let appId = existing?.id

    if (appId) {
      // Update existing application with new info
      const { error: updateError } = await supabase
        .from("celeb_applications")
        .update({
          full_name,
          phone_number,
          email,
          social_media,
          status: existing.status === "denied" ? "pending" : existing.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appId)

      if (updateError) {
        console.error(`[CelebApp ${requestId}] Update error:`, updateError)
        return withCors({ success: false, error: "Failed to update application" }, 500, req)
      }
    } else {
      // Check for any prior denied application to reset to pending
      const { data: anyExisting } = await supabase
        .from("celeb_applications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()

      if (anyExisting) {
        const { error: resubmitError } = await supabase
          .from("celeb_applications")
          .update({
            full_name,
            phone_number,
            email,
            social_media,
            status: "pending",
            reviewer_id: null,
            admin_note: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", anyExisting.id)

        if (resubmitError) {
          console.error(`[CelebApp ${requestId}] Resubmit error:`, resubmitError)
          return withCors({ success: false, error: "Failed to resubmit application" }, 500, req)
        }
        appId = anyExisting.id
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("celeb_applications")
          .insert({
            user_id: userId,
            full_name,
            phone_number,
            email,
            social_media,
            status: "pending",
          })
          .select("id")
          .maybeSingle()

        if (insertError) {
          console.error(`[CelebApp ${requestId}] Insert error:`, insertError)
          return withCors({ success: false, error: "Failed to submit application" }, 500, req)
        }
        appId = inserted?.id
      }
    }

    // Audit log
    await supabase.from("celeb_audit_logs").insert({
      user_id: userId,
      action: existing?.id ? "application_updated" : "application_submitted",
      entity_type: "celeb_applications",
      entity_id: appId,
      details: { email, has_social_media: Object.keys(social_media).length > 0 },
    })

    // Notify user via create_notification
    await supabase.rpc("create_notification", {
      p_user_id: userId,
      p_type: "celeb_application",
      p_title: "Celeb Application Received",
      p_message: "Your Celeb application has been submitted and is pending review.",
      p_metadata: { application_id: appId },
    })

    console.log(`[CelebApp ${requestId}] Application submitted for user ${userId}`)

    return withCors({ success: true, application_id: appId, status: "pending" }, 200, req)
  } catch (error) {
    console.error(`[CelebApp ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Application submission failed" },
      500,
      req,
    )
  }
})
