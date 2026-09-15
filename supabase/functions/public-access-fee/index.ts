import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"

declare const Deno: { 
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: { get: (key: string) => string | undefined }
}

Deno.serve(async (req: Request) => {
  const requestId = `public_fee_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  console.log(`[PublicAccessFee ${requestId}] Request received: ${req.method} ${req.url}`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { prepare: false }
    }
  )

  try {
    const url = new URL(req.url)
    const pathname = url.pathname.includes('/public-access-fee/') ? url.pathname.split('/public-access-fee/')[1] : ''

    // GET /status - Check fee status for user
    if (req.method === "GET" && pathname === "status") {
      const userId = url.searchParams.get("user_id")
      
      if (!userId) {
        return withCors(
          { success: false, error: "Missing user_id parameter" },
          400,
          req
        )
      }

      // Get user profile to check role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, is_org_student, public_fee_paid, public_fee_expires_at, public_fee_payment_reference")
        .eq("id", userId)
        .maybeSingle()

      if (!profile) {
        return withCors(
          { success: false, error: "User profile not found" },
          404,
          req
        )
      }

      // Students, instructors, staff, admins, and org students are exempt
      const exemptRoles = ["student", "instructor", "staff", "admin"]
      if (exemptRoles.includes(profile.role) || profile.is_org_student) {
        return withCors({
          success: true,
          fee_required: false,
          fee_paid: true,
          access_status: "not_required"
        }, 200, req)
      }

      // Check if fee is paid and not expired
      const now = new Date()
      const expiresAt = profile.public_fee_expires_at ? new Date(profile.public_fee_expires_at) : null
      const isFeePaid = profile.public_fee_paid === true
      const isExpired = expiresAt && expiresAt < now

      if (isFeePaid && !isExpired) {
        return withCors({
          success: true,
          fee_required: true,
          fee_paid: true,
          access_status: "active",
          expires_at: profile.public_fee_expires_at,
          payment_reference: profile.public_fee_paid_at
        }, 200, req)
      }

      // Fee required but not paid or expired
      return withCors({
        success: true,
        fee_required: true,
        fee_paid: false,
        access_status: "payment_required"
      }, 200, req)
    }

    // POST /paypal-create-order - Create PayPal order for fee payment
    if (req.method === "POST" && pathname === "paypal-create-order") {
      const body = await req.json()
      const { user_id, amount = 1.00, currency = "USD", description } = body

      if (!user_id) {
        return withCors(
          { success: false, error: "Missing user_id" },
          400,
          req
        )
      }

      // Verify user exists and is a regular user
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, is_org_student")
        .eq("id", user_id)
        .maybeSingle()

      if (!profile) {
        return withCors(
          { success: false, error: "User not found" },
          404,
          req
        )
      }

      const exemptRoles = ["student", "instructor", "staff", "admin"]
      if (exemptRoles.includes(profile.role) || profile.is_org_student) {
        return withCors(
          { success: false, error: "User is exempt from administration fee" },
          403,
          req
        )
      }

      const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID")
      const paypalSecret = Deno.env.get("PAYPAL_SECRET")
      const paypalBaseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com"

      if (!paypalClientId || !paypalSecret) {
        return withCors(
          { success: false, error: "PayPal not configured" },
          500,
          req
        )
      }

      // Get PayPal access token
      const auth = btoa(`${paypalClientId}:${paypalSecret}`)
      const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error("[PublicAccessFee] PayPal token error:", error)
        return withCors(
          { success: false, error: "Failed to get PayPal token" },
          500,
          req
        )
      }

      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token

      // Create PayPal order
      const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            description: description || "MAiTROLL Annual Public Administration Fee",
            custom_id: user_id,
          }],
          application_context: {
            return_url: `${Deno.env.get("SITE_URL") || "https://maitroll.com"}/public-access-fee-complete`,
            cancel_url: `${Deno.env.get("SITE_URL") || "https://maitroll.com"}/auth`,
            brand_name: "MAiTROLL",
            landing_page: "NO_PREFERENCE",
            user_action: "PAY_NOW",
          },
        }),
      })

      if (!orderResponse.ok) {
        const error = await orderResponse.text()
        console.error("[PublicAccessFee] PayPal order error:", error)
        return withCors(
          { success: false, error: "Failed to create PayPal order" },
          500,
          req
        )
      }

      const orderData = await orderResponse.json()
      const approvalUrl = orderData.links?.find((l: any) => l.rel === "approve")?.href

      return withCors({
        success: true,
        order_id: orderData.id,
        approval_url: approvalUrl,
      }, 200, req)
    }

    // POST /paypal-capture - Capture PayPal payment and update user
    if (req.method === "POST" && pathname === "paypal-capture") {
      const body = await req.json()
      const { order_id, user_id } = body

      if (!order_id || !user_id) {
        return withCors(
          { success: false, error: "Missing order_id or user_id" },
          400,
          req
        )
      }

      const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID")
      const paypalSecret = Deno.env.get("PAYPAL_SECRET")
      const paypalBaseUrl = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com"

      if (!paypalClientId || !paypalSecret) {
        return withCors(
          { success: false, error: "PayPal not configured" },
          500,
          req
        )
      }

      // Get PayPal access token
      const auth = btoa(`${paypalClientId}:${paypalSecret}`)
      const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      })

      if (!tokenResponse.ok) {
        return withCors(
          { success: false, error: "Failed to get PayPal token" },
          500,
          req
        )
      }

      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token

      // Capture the order
      const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${order_id}/capture`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!captureResponse.ok) {
        const error = await captureResponse.text()
        console.error("[PublicAccessFee] PayPal capture error:", error)
        return withCors(
          { success: false, error: "Failed to capture PayPal payment" },
          500,
          req
        )
      }

      const captureData = await captureResponse.json()
      
      // Check if capture was successful
      const captureStatus = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.status
      if (captureStatus !== "COMPLETED") {
        return withCors(
          { success: false, error: "Payment not completed" },
          400,
          req
        )
      }

      // Update user profile with fee payment
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      const paidAt = new Date().toISOString()

      // Insert fee record
      const { error: feeRecordError } = await supabase
        .from("public_access_fees")
        .insert({
          user_id: user_id,
          amount: 1.00,
          currency: "USD",
          payment_provider: "paypal",
          payment_reference: captureData.id,
          payment_order_id: order_id,
          paid_at: paidAt,
          expires_at: expiresAt.toISOString(),
          status: "paid",
        })

      if (feeRecordError) {
        console.error("[PublicAccessFee] Fee record error:", feeRecordError)
        return withCors(
          { success: false, error: "Payment captured but failed to create fee record" },
          500,
          req
        )
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          public_fee_required: true,
          public_fee_paid: true,
          public_fee_paid_at: paidAt,
          public_fee_expires_at: expiresAt.toISOString(),
          access_status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id)

      if (updateError) {
        console.error("[PublicAccessFee] Profile update error:", updateError)
        return withCors(
          { success: false, error: "Payment captured but failed to update profile" },
          500,
          req
        )
      }

      return withCors({
        success: true,
        message: "Administration fee paid successfully",
        expires_at: expiresAt.toISOString(),
      }, 200, req)
    }

    return withCors(
      { success: false, error: "Not found" },
      404,
      req
    )

  } catch (error: any) {
    console.error(`[PublicAccessFee ${requestId}] Error:`, error)
    return withCors(
      { success: false, error: error.message || "Internal server error" },
      500,
      req
    )
  }
})