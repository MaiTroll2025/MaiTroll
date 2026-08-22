import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const LICENSE_RESTORATION_COST = 300
const PAY_WARRANT_COST = 500

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
      return withCors(
        { success: false, error: "You must be signed in." },
        401,
        req,
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim()

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return withCors(
        { success: false, error: "Your session is invalid or expired." },
        401,
        req,
      )
    }

    const userId = user.id
    const body = await req.json().catch(() => ({}))
    const method: string = (body.method ?? "coins").toString()

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Fetch current profile to check balance and license status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("troll_coins, license_status, drivers_license_status, is_broadcaster")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors(
        { success: false, error: "Profile not found." },
        404,
        req,
      )
    }

    const isSuspended =
      profile.license_status === "suspended" ||
      profile.drivers_license_status === "suspended"

    if (!isSuspended) {
      return withCors(
        { success: false, error: "Your license is not currently suspended." },
        400,
        req,
      )
    }

    const cost = method === "pay_warrant" ? PAY_WARRANT_COST : LICENSE_RESTORATION_COST

    const coinBalance = Number(profile.troll_coins ?? 0)
    if (coinBalance < cost) {
      return withCors(
        {
          success: false,
          error: `Insufficient troll coins. You need ${cost} troll coins but only have ${coinBalance}.`,
          code: "INSUFFICIENT_COINS",
          required: cost,
          available: coinBalance,
        },
        400,
        req,
      )
    }

    // Deduct coins via the secure spend function
    const { data: spendResult, error: spendError } = await supabaseAdmin.rpc(
      "troll_bank_spend_coins_secure",
      {
        p_user_id: userId,
        p_amount: cost,
        p_bucket: "paid",
        p_source: method === "pay_warrant" ? "license_warrant_payment" : "license_restoration",
        p_ref_id: `license_restore_${method}_${Date.now()}`,
        p_metadata: { restore_method: method, coin_cost: cost },
      },
    )

    if (spendError || (spendResult as any)?.success === false) {
      console.error("[restore-license] Coin spend failed:", spendError?.message ?? spendResult)
      return withCors(
        {
          success: false,
          error: spendError?.message ?? (spendResult as any)?.error ?? "Failed to deduct coins.",
        },
        500,
        req,
      )
    }

    // Restore the license and broadcaster status
    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        is_broadcaster: true,
        license_status: "active",
        drivers_license_status: "active",
        license_restored_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("[restore-license] Profile update failed:", updateError.message)
      return withCors(
        { success: false, error: "Failed to restore license." },
        500,
        req,
      )
    }

    // Notify user
    if (typeof supabaseAdmin.rpc === "function") {
      await supabaseAdmin.rpc("troll_bank_credit_coins", {
        p_user_id: userId,
        p_amount: 0,
        p_bucket: "system",
        p_source: "license_restored",
        p_ref_id: `license_restore_${Date.now()}`,
        p_metadata: { restore_method: method, coin_cost: cost },
      }).catch(() => {})
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "license_restored",
      title: "License Restored",
      message:
        method === "pay_warrant"
          ? `Your license has been restored by paying the warrant (${cost} troll coins).`
          : `Your license has been restored (cost: ${cost} troll coins).`,
      read: false,
    }).catch(() => {})

    return withCors(
      {
        success: true,
        code: "LICENSE_RESTORED",
        message:
          method === "pay_warrant"
            ? `License restored! Bond paid (${cost} troll coins).`
            : `License restored! ${cost} troll coins deducted from your balance.`,
        data: {
          method,
          coins_deducted: cost,
          new_broadcaster: true,
        },
      },
      200,
      req,
    )
  } catch (err: any) {
    console.error("[restore-license] Unhandled error:", err)
    return withCors(
      { success: false, error: "Internal server error" },
      500,
      req,
    )
  }
})
