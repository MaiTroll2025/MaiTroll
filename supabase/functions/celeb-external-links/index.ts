import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_links_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { action, platform, url, link_id, display_order } = body

    // Verify user is an approved celeb
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("celeb_role")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 404, req)
    }

    if (profile.celeb_role !== "approved") {
      return withCors({ success: false, error: "Only approved celebrities can manage links" }, 403, req)
    }

    // Validate URL server-side
    if (action === "add" || action === "update") {
      if (!platform || !url) {
        return withCors({ success: false, error: "platform and url are required" }, 400, req)
      }

      let cleanUrl: string
      try {
        const parsed = new URL(url)
        cleanUrl = parsed.toString()
      } catch {
        return withCors({ success: false, error: "Invalid URL" }, 400, req)
      }

      if (action === "add") {
        const { data: inserted, error: insertError } = await supabase
          .from("celeb_external_links")
          .insert({
            user_id: userId,
            platform,
            url: cleanUrl,
            is_verified: false,
            display_order: display_order || 0,
          })
          .select()
          .maybeSingle()

        if (insertError) {
          return withCors({ success: false, error: "Failed to add link" }, 500, req)
        }

        await supabase.from("celeb_audit_logs").insert({
          user_id: userId,
          action: "link_added",
          entity_type: "celeb_external_links",
          entity_id: inserted.id,
          details: { platform },
        })

        return withCors({ success: true, link: inserted }, 200, req)
      } else {
        const { data: updated, error: updateError } = await supabase
          .from("celeb_external_links")
          .update({ url: cleanUrl, display_order: display_order ?? 0 })
          .eq("id", link_id)
          .eq("user_id", userId)
          .select()
          .maybeSingle()

        if (updateError || !updated) {
          return withCors({ success: false, error: "Failed to update link or link not found" }, 404, req)
        }

        return withCors({ success: true, link: updated }, 200, req)
      }
    } else if (action === "delete") {
      if (!link_id) {
        return withCors({ success: false, error: "link_id is required" }, 400, req)
      }

      const { error: deleteError } = await supabase
        .from("celeb_external_links")
        .delete()
        .eq("id", link_id)
        .eq("user_id", userId)

      if (deleteError) {
        return withCors({ success: false, error: "Failed to delete link" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "link_deleted",
        entity_type: "celeb_external_links",
        entity_id: link_id,
      })

      return withCors({ success: true }, 200, req)
    } else if (action === "list") {
      const { data: links, error: listError } = await supabase
        .from("celeb_external_links")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true })

      if (listError) {
        return withCors({ success: false, error: "Failed to list links" }, 500, req)
      }

      return withCors({ success: true, links }, 200, req)
    } else {
      return withCors({ success: false, error: "Invalid action" }, 400, req)
    }
  } catch (error) {
    console.error(`[CelebLinks ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Link management failed" },
      500,
      req,
    )
  }
})
