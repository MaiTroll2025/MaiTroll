import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_chat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { stream_id, message, price_coins } = body

    if (!stream_id || !message) {
      return withCors(
        { success: false, error: "stream_id and message are required" },
        400,
        req,
      )
    }

    // Verify stream is a celeb_stream and the user is a viewer
    const { data: stream, error: streamError } = await supabase
      .from("streams")
      .select("id, stream_type, user_id")
      .eq("id", stream_id)
      .eq("stream_type", "celeb_stream")
      .maybeSingle()

    if (streamError || !stream) {
      return withCors({ success: false, error: "Celeb stream not found" }, 404, req)
    }

    // Verify user is a viewer of this stream
    const { data: viewer, error: viewerError } = await supabase
      .from("stream_viewers")
      .select("id")
      .eq("stream_id", stream_id)
      .eq("user_id", userId)
      .maybeSingle()

    if (viewerError || !viewer) {
      return withCors({ success: false, error: "You must be a viewer to send paid chat" }, 403, req)
    }

    // Validate price server-side
    const price = Math.max(1, Math.min(10000, Math.floor(Number(price_coins) || 0)))

    // Check paid chat settings for the stream
    const { data: settings, error: settingsError } = await supabase
      .from("celeb_paid_chat_settings")
      .select("enabled, price_coins, whitelist")
      .eq("stream_id", stream_id)
      .maybeSingle()

    if (settingsError) {
      console.error(`[CelebChat ${requestId}] Settings error:`, settingsError)
    }

    if (settings && settings.enabled) {
      // If whitelist is set and non-empty, only whitelisted users can chat for free,
      // but paid chat is always available for non-whitelisted users
      const isWhitelisted = settings.whitelist && settings.whitelist.includes(userId)

      if (!isWhitelisted) {
        // Charge the user (deduct coins via server-side transaction)
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("coin_balance")
          .eq("id", userId)
          .maybeSingle()

        if (profileError || !profile) {
          return withCors({ success: false, error: "Profile not found" }, 500, req)
        }

        if ((profile.coin_balance || 0) < price) {
          return withCors(
            { success: false, error: "Insufficient coins", required: price, available: profile.coin_balance },
            402,
            req,
          )
        }

        // Deduct coins
        const { error: deductError } = await supabase
          .from("user_profiles")
          .update({ coin_balance: (profile.coin_balance || 0) - price })
          .eq("id", userId)

        if (deductError) {
          console.error(`[CelebChat ${requestId}] Deduct error:`, deductError)
          return withCors({ success: false, error: "Failed to charge coins" }, 500, req)
        }

        // Record coin transaction
        await supabase.from("coin_transactions").insert({
          user_id: userId,
          stream_id: stream_id,
          type: "purchase",
          amount: -price,
          balance_after: (profile.coin_balance || 0) - price,
          description: "Paid chat message in Celeb Stream",
        })

        // Credit broadcaster
        await supabase.rpc("increment_stream_earnings", {
          p_stream_id: stream_id,
          p_coins: price,
        }).catch(() => null)
      }
    }

    // Insert the paid chat message
    const { data: msg, error: msgError } = await supabase
      .from("celeb_paid_chat_messages")
      .insert({
        stream_id,
        user_id: userId,
        message,
        price_coins: price,
      })
      .select()
      .maybeSingle()

    if (msgError) {
      console.error(`[CelebChat ${requestId}] Insert error:`, msgError)
      return withCors({ success: false, error: "Failed to send message" }, 500, req)
    }

    console.log(`[CelebChat ${requestId}] Paid chat message sent in stream ${stream_id}`)

    return withCors(
      {
        success: true,
        message_id: msg.id,
        price_charged: settings?.enabled && !settings.whitelist?.includes(userId) ? price : 0,
      },
      200,
      req,
    )
  } catch (error) {
    console.error(`[CelebChat ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Failed to send chat" },
      500,
      req,
    )
  }
})
