import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_battle_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { stream_id, action } = body

    if (!stream_id || !action) {
      return withCors(
        { success: false, error: "stream_id and action are required" },
        400,
        req,
      )
    }

    // Verify stream belongs to this celeb and is a celeb_stream
    const { data: stream, error: streamError } = await supabase
      .from("streams")
      .select("id, stream_type, user_id, is_live")
      .eq("id", stream_id)
      .eq("stream_type", "celeb_stream")
      .eq("user_id", userId)
      .maybeSingle()

    if (streamError || !stream) {
      return withCors(
        { success: false, error: "Not a Celeb stream or not owned by you" },
        403,
        req,
      )
    }

    if (action === "join") {
      if (!stream.is_live) {
        return withCors({ success: false, error: "Stream is not live" }, 400, req)
      }

      // Matchmaking: find another open celeb stream in the queue
      const now = new Date()
      const expiry = new Date(now.getTime() + 120000) // 2 min expiry

      // Upsert queue entry
      const { data: queueEntry, error: queueError } = await supabase
        .from("celeb_battle_queue")
        .upsert({
          stream_id: stream_id,
          is_open: true,
          match_expires_at: expiry.toISOString(),
          status: "open",
          matched_stream_id: null,
          matched_at: null,
        })
        .select()
        .maybeSingle()

      if (queueError) {
        console.error(`[CelebBattle ${requestId}] Queue error:`, queueError)
        return withCors({ success: false, error: "Failed to join battle queue" }, 500, req)
      }

      // Try to find a match — another open queue entry that is not this one
      const { data: match, error: matchError } = await supabase
        .from("celeb_battle_queue")
        .select("stream_id")
        .eq("status", "open")
        .eq("is_open", true)
        .neq("stream_id", stream_id)
        .gt("match_expires_at", now.toISOString())
        .order("queued_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      let matchedWith: string | null = null

      if (match) {
        matchedWith = match.stream_id
        const matchedAt = new Date().toISOString()

        // Close both queue entries
        await supabase
          .from("celeb_battle_queue")
          .update({ status: "matched", matched_stream_id: match.stream_id, matched_at: matchedAt, is_open: false })
          .eq("stream_id", stream_id)

        await supabase
          .from("celeb_battle_queue")
          .update({ status: "matched", matched_stream_id: stream_id, matched_at: matchedAt, is_open: false })
          .eq("stream_id", match.stream_id)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "battle_queue_join",
        entity_type: "celeb_battle_queue",
        entity_id: stream_id,
        details: { matched_with: matchedWith },
      })

      return withCors(
        {
          success: true,
          queue_status: matchedWith ? "matched" : "queued",
          matched_stream_id: matchedWith,
        },
        200,
        req,
      )
    } else if (action === "leave") {
      const { error: leaveError } = await supabase
        .from("celeb_battle_queue")
        .update({ status: "cancelled", is_open: false, matched_stream_id: null, matched_at: null })
        .eq("stream_id", stream_id)

      if (leaveError) {
        return withCors({ success: false, error: "Failed to leave queue" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "battle_queue_leave",
        entity_type: "celeb_battle_queue",
        entity_id: stream_id,
      })

      return withCors({ success: true, queue_status: "cancelled" }, 200, req)
    } else if (action === "status") {
      const { data: statusData, error: statusError } = await supabase
        .from("celeb_battle_queue")
        .select("status, matched_stream_id, matched_at")
        .eq("stream_id", stream_id)
        .maybeSingle()

      if (statusError) {
        return withCors({ success: false, error: "Failed to get queue status" }, 500, req)
      }

      return withCors(
        {
          success: true,
          queue_status: statusData?.status || "not_queued",
          matched_stream_id: statusData?.matched_stream_id || null,
        },
        200,
        req,
      )
    } else {
      return withCors({ success: false, error: "Invalid action. Use join, leave, or status" }, 400, req)
    }
  } catch (error) {
    console.error(`[CelebBattle ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Battle queue error" },
      500,
      req,
    )
  }
})
