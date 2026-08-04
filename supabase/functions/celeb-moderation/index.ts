import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_moderate_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { stream_id, target_user_id, action, reason, duration_seconds } = body

    if (!stream_id || !action || !target_user_id) {
      return withCors(
        { success: false, error: "stream_id, target_user_id, and action are required" },
        400,
        req,
      )
    }

    if (!["mute", "ban", "kick", "timeout", "pin_message"].includes(action)) {
      return withCors(
        { success: false, error: "Invalid action. Must be mute, ban, kick, timeout, or pin_message" },
        400,
        req,
      )
    }

    // Verify user is the broadcaster of this celeb stream
    const { data: stream, error: streamError } = await supabase
      .from("streams")
      .select("id, stream_type, user_id, is_live")
      .eq("id", stream_id)
      .eq("stream_type", "celeb_stream")
      .eq("user_id", userId)
      .maybeSingle()

    if (streamError || !stream) {
      return withCors(
        { success: false, error: "Not authorized — you must own this Celeb stream" },
        403,
        req,
      )
    }

    if (!stream.is_live) {
      return withCors({ success: false, error: "Stream is not live" }, 400, req)
    }

    // Record moderation action
    const { data: modRecord, error: modError } = await supabase
      .from("celeb_stream_moderation")
      .insert({
        stream_id,
        user_id: target_user_id,
        action,
        reason,
        duration_seconds: action === "timeout" ? (duration_seconds || 300) : null,
        created_by: userId,
      })
      .select()
      .maybeSingle()

    if (modError) {
      console.error(`[CelebMod ${requestId}] Insert error:`, modError)
      return withCors({ success: false, error: "Failed to record moderation action" }, 500, req)
    }

    // Send realtime notification to the target user (application ID + status only, no docs)
    const actionMessages: Record<string, string> = {
      mute: "You have been muted by the broadcaster.",
      ban: "You have been banned from this Celeb Stream.",
      kick: "You have been removed from this Celeb Stream.",
      timeout: "You have been timed out by the broadcaster.",
      pin_message: "Your message has been pinned.",
    }

    await supabase.rpc("create_notification", {
      p_user_id: target_user_id,
      p_type: "moderation",
      p_title: `Celeb Stream: ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      p_message: actionMessages[action],
      p_metadata: { stream_id, action, reason, moderator: userId },
    })

    if (action === "mute" || action === "ban" || action === "kick" || action === "timeout") {
      if (action === "ban") {
        await supabase.from("broadcast_seat_bans").insert({
          room: stream.livekit_room_name || stream_id,
          user_id: target_user_id,
          created_by: userId,
          reason: reason || `${action} by broadcaster`,
          banned_until: null,
        })
      } else if (action === "mute" || action === "timeout") {
        const duration = (duration_seconds || 300) || 300
        await supabase
          .from("user_profiles")
          .update({
            muted_until: new Date(Date.now() + duration * 1000).toISOString(),
          })
          .eq("id", target_user_id)
      }

      console.log(`[CelebMod ${requestId}] Applied ${action} to user ${target_user_id} in stream ${stream_id}`)
    }

    // Audit log
    await supabase.from("celeb_audit_logs").insert({
      user_id: userId,
      action: `mod_${action}`,
      entity_type: "celeb_stream_moderation",
      entity_id: modRecord?.id || null,
      details: { target_user_id, stream_id, duration_seconds },
    })

    return withCors({ success: true, moderation_id: modRecord?.id }, 200, req)
  } catch (error) {
    console.error(`[CelebMod ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Moderation action failed" },
      500,
      req,
    )
  }
})
