import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_chat_settings_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { stream_id, action, enabled, price_coins, whitelist } = body

    if (!stream_id) {
      return withCors({ success: false, error: "stream_id is required" }, 400, req)
    }

    // Verify user owns this stream and it's a celeb_stream
    const { data: stream, error: streamError } = await supabase
      .from("streams")
      .select("id, stream_type, user_id")
      .eq("id", stream_id)
      .eq("user_id", userId)
      .maybeSingle()

    if (streamError || !stream) {
      return withCors({ success: false, error: "Not authorized for this stream" }, 403, req)
    }

    if (stream.stream_type !== "celeb_stream") {
      return withCors({ success: false, error: "Paid chat settings only apply to Celeb Streams" }, 400, req)
    }

    if (action === "get") {
      const { data: settings, error: fetchError } = await supabase
        .from("celeb_paid_chat_settings")
        .select("*")
        .eq("stream_id", stream_id)
        .maybeSingle()

      if (fetchError && fetchError.code !== "PGRST116") {
        return withCors({ success: false, error: "Failed to load settings" }, 500, req)
      }

      return withCors(
        { success: true, settings: settings || { enabled: false, price_coins: 0, whitelist: [] } },
        200,
        req,
      )
    }

    if (action === "update") {
      // Validate price server-side — never trust frontend
      const price = enabled ? Math.max(0, Math.min(10000, Math.floor(Number(price_coins) || 0))) : 0

      const { data: updated, error: updateError } = await supabase
        .from("celeb_paid_chat_settings")
        .upsert({
          stream_id,
          enabled: Boolean(enabled),
          price_coins: price,
          whitelist: Array.isArray(whitelist) ? whitelist : [],
        })
        .select()
        .maybeSingle()

      if (updateError) {
        return withCors({ success: false, error: "Failed to update settings" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "paid_chat_settings_updated",
        entity_type: "celeb_paid_chat_settings",
        entity_id: stream_id,
        details: { enabled, price_coins: price },
      })

      return withCors({ success: true, settings: updated }, 200, req)
    }

    return withCors({ success: false, error: "Invalid action. Use get or update" }, 400, req)
  } catch (error) {
    console.error(`[CelebChatSettings ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Settings operation failed" },
      500,
      req,
    )
  }
})
