import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_stream_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { title, category, pricing_type, pricing_value } = body

    // Verify user is an approved celeb
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("celeb_role, role, is_admin")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 404, req)
    }

    const isApprovedCeleb = profile.celeb_role === "approved"
    const isStaff = profile.role === "admin" || profile.is_admin === true

    if (!isApprovedCeleb && !isStaff) {
      return withCors(
        { success: false, error: "Only approved celebrities can create Celeb Streams" },
        403,
        req,
      )
    }

    // Validate pricing server-side — never trust frontend
    let isPaid = false
    let priceCoins = 0
    if (pricing_type === "paid" && Number(pricing_value) > 0) {
      isPaid = true
      priceCoins = Math.max(1, Math.min(1000, Math.floor(Number(pricing_value))))
    }

    const streamId = crypto.randomUUID()

    const insertData: Record<string, unknown> = {
      id: streamId,
      user_id: userId,
      broadcaster_id: userId,
      streamer_id: userId,
      owner_id: userId,
      title: title || `${profile.username || "Celeb"}'s Live`,
      category,
      stream_type: "celeb_stream",
      camera_ready: true,
      status: "starting",
      is_live: false,
      started_at: null,
      box_count: 1,
      seat_count: 0,
      layout_mode: "spotlight",
      livekit_room_name: streamId,
      agora_channel: streamId,
      broadcast_disclaimer_accepted: true,
      broadcast_disclaimer_accepted_at: new Date().toISOString(),
      broadcast_disclaimer_user_id: userId,
      is_paid: isPaid,
      pricing_type: isPaid ? "paid" : "free",
      pricing_value: priceCoins,
    }

    const { data, error } = await supabase
      .from("streams")
      .insert(insertData)
      .select()
      .maybeSingle()

    if (error) {
      console.error(`[CelebStream ${requestId}] Insert error:`, error)
      return withCors({ success: false, error: "Failed to create Celeb stream" }, 500, req)
    }

    // Audit log
    await supabase.from("celeb_audit_logs").insert({
      user_id: userId,
      action: "stream_created",
      entity_type: "streams",
      entity_id: streamId,
      details: { title, is_paid, price_coins: priceCoins },
    })

    console.log(`[CelebStream ${requestId}] Stream ${streamId} created by celeb ${userId}`)

    return withCors(
      {
        success: true,
        stream_id: streamId,
        stream_type: "celeb_stream",
        is_paid: isPaid,
        pricing_value: priceCoins,
      },
      200,
      req,
    )
  } catch (error) {
    console.error(`[CelebStream ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Stream creation failed" },
      500,
      req,
    )
  }
})
