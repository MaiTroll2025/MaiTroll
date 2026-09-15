// merch-payment-complete Edge Function
// Captures PayPal payment, creates Printify fulfillment order, updates MAiTROLL order.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { withCors, handleCorsPreflight, unauthorizedResponse } from "../_shared/cors.ts"

const PAYPAL_API_URL = "https://api.paypal.com"
const PAYPAL_SANDBOX_URL = "https://api.sandbox.paypal.com"
const PRINTIFY_API_BASE = "https://api.printify.com"
const REQUEST_TIMEOUT_MS = 30000

interface ShippingAddress {
  first_name: string
  last_name: string
  email: string
  phone?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

interface OrderItem {
  printify_product_id: string
  printify_variant_id: string
  quantity: number
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

function getShopId(): string | null {
  return Deno.env.get("PRINTIFY_SHOP_ID") || null
}

function getApiKey(): string | null {
  return Deno.env.get("PRINTIFY_API_KEY") || null
}

function getPayPalClientId(): string | null {
  return Deno.env.get("PAYPAL_CLIENT_ID") || null
}

function getPayPalSecret(): string | null {
  return Deno.env.get("PAYPAL_CLIENT_SECRET") || null
}

function getPayPalMode(): string {
  return (Deno.env.get("PAYPAL_MODE") || Deno.env.get("PAYPAL_ENV") || "live").toLowerCase()
}

Deno.serve(async (req) => {
  const requestId = `merch_payment_complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[MerchPaymentComplete ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`[MerchPaymentComplete ${requestId}] Missing authorization header`)
    return unauthorizedResponse("Authorization required", req.headers.get("origin"))
  }

  try {
    const body = await req.json()
    const { paypal_order_id, maitroll_order_id } = body

    if (!paypal_order_id || !maitroll_order_id) {
      return withCors({ success: false, error: "paypal_order_id and maitroll_order_id are required" }, 400, req)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Find the MAiTROLL order
    const { data: order, error: orderError } = await supabase
      .from("mai_merch_orders")
      .select("*")
      .eq("id", maitroll_order_id)
      .maybeSingle()

    if (orderError || !order) {
      console.error(`[MerchPaymentComplete ${requestId}] Order not found:`, orderError)
      return withCors({ success: false, error: "Order not found" }, 404, req)
    }

    // Check if already processed (idempotency)
    if (order.payment_status === "paid" && order.paypal_capture_id) {
      console.log(`[MerchPaymentComplete ${requestId}] Order already processed`)
      return withCors({
        success: true,
        already_processed: true,
        order_id: order.id,
        printify_order_id: order.printify_order_id,
      }, 200, req)
    }

    if (order.paypal_order_id !== paypal_order_id) {
      console.error(`[MerchPaymentComplete ${requestId}] PayPal order ID mismatch`)
      return withCors({ success: false, error: "PayPal order ID mismatch" }, 400, req)
    }

    // Verify and capture PayPal payment
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID")
    const paypalSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")
    const paypalMode = (Deno.env.get("PAYPAL_MODE") || Deno.env.get("PAYPAL_ENV") || "live").toLowerCase()
    const baseUrl = paypalMode === "sandbox" ? "https://api.sandbox.paypal.com" : "https://api.paypal.com"

    if (!paypalClientId || !paypalSecret) {
      return withCors({ success: false, error: "PayPal not configured" }, 500, req)
    }

    const auth = btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_CLIENT_SECRET")}`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    if (!tokenRes.ok) {
      return withCors({ success: false, error: "Failed to authenticate with PayPal" }, 500, req)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Get order details from PayPal
    const orderDetailsRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypal_order_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!orderDetailsRes.ok) {
      return withCors({ success: false, error: "Failed to get PayPal order details" }, 500, req)
    }

    const orderDetails = await orderDetailsRes.json()

    if (orderDetails.status !== "APPROVED") {
      return withCors({ success: false, error: "PayPal order not approved" }, 400, req)
    }

    // Capture the payment
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!captureRes.ok) {
      const errorText = await captureRes.text()
      console.error(`[MerchPaymentComplete ${requestId}] Capture failed:`, errorText)
      return withCors({ success: false, error: "Failed to capture PayPal payment" }, 500, req)
    }

    const captureData = await captureRes.json()

    if (captureData.status !== "COMPLETED") {
      return withCors({ success: false, error: "PayPal capture not completed" }, 400, req)
    }

    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0]
    const captureId = capture?.id
    const capturedAmount = parseFloat(capture?.amount?.value || "0")

    if (!captureId) {
      return withCors({ success: false, error: "PayPal capture ID missing" }, 500, req)
    }

    // Verify amount matches
    if (Math.abs(capturedAmount - order.total_amount) > 0.02) {
      console.error(`[MerchPaymentComplete ${requestId}] Amount mismatch: expected ${order.total_amount}, got ${capturedAmount}`)
      await supabase
        .from("mai_merch_orders")
        .update({ payment_status: "amount_mismatch", printify_error: `Amount mismatch: expected ${order.total_amount}, got ${capturedAmount}` })
        .eq("id", maitroll_order_id)
      return withCors({ success: false, error: "Payment amount mismatch" }, 400, req)
    }

    // Update order with payment info
    const { error: paymentUpdateError } = await supabase
      .from("mai_merch_orders")
      .update({
        payment_status: "paid",
        paypal_capture_id: captureId,
        status: "printify_submission_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", maitroll_order_id)

    if (paymentUpdateError) {
      console.error(`[MerchPaymentComplete ${requestId}] Payment update error:`, paymentUpdateError)
    }

    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from("mai_merch_order_items")
      .select("*")
      .eq("order_id", maitroll_order_id)

    if (itemsError || !items || items.length === 0) {
      console.error(`[MerchPaymentComplete ${requestId}] Order items not found:`, itemsError)
      return withCors({ success: false, error: "Order items not found" }, 500, req)
    }

    // Create Printify order
    const shopId = Deno.env.get("PRINTIFY_SHOP_ID")
    const apiKey = Deno.env.get("PRINTIFY_API_KEY")

    if (!apiKey || !shopId) {
      await supabase
        .from("mai_merch_orders")
        .update({ status: "printify_submission_failed", printify_error: "Printify not configured" })
        .eq("id", maitroll_order_id)
      return withCors({ success: false, error: "Printify not configured" }, 500, req)
    }

    const printifyItems = items.map((item: any) => ({
      product_id: item.printify_product_id,
      variant_id: item.printify_variant_id,
      quantity: item.quantity,
    }))

    const payload = {
      external_id: order.order_number || `MAITROLL-${maitroll_order_id}`,
      items: printifyItems,
      shipping_method: 1,
      shipping_address: order.shipping_address,
      metadata: {
        maitroll_order_id: maitroll_order_id,
        source: "MAiTROLL_MERCH",
      },
    }

    const apiKeyVal = Deno.env.get("PRINTIFY_API_KEY")!
    const shopIdVal = Deno.env.get("PRINTIFY_SHOP_ID")!

    const printifyRes = await fetch(`https://api.printify.com/v1/shops/${shopIdVal}/orders.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKeyVal}`,
        "Content-Type": "application/json",
        "User-Agent": "MAiTroll-Merch/1.0",
      },
      body: JSON.stringify(payload),
    })

    if (!printifyRes.ok) {
      const errorText = await printifyRes.text()
      console.error(`[MerchPaymentComplete ${requestId}] Printify order creation failed:`, errorText)

      await supabase
        .from("mai_merch_orders")
        .update({
          status: "printify_submission_failed",
          printify_error: `Printify order creation failed: ${errorText.substring(0, 500)}`,
        })
        .eq("id", maitroll_order_id)

      return withCors({ success: false, error: "Failed to create Printify order" }, 500, req)
    }

    const printifyOrder = await printifyRes.json()
    const printifyOrderId = printifyOrder.id

    // Update order with Printify order ID
    await supabase
      .from("mai_merch_orders")
      .update({
        printify_order_id: printifyOrderId,
        status: "submitted_to_printify",
        fulfillment_status: "submitted_to_printify",
        updated_at: new Date().toISOString(),
      })
      .eq("id", maitroll_order_id)

    console.log(`[MerchPaymentComplete ${requestId}] Success: Printify order ${printifyOrderId} created for MAiTROLL order ${order.order_number}`)

    return withCors({
      success: true,
      order_id: maitroll_order_id,
      order_number: order.order_number,
      paypal_capture_id: captureId,
      printify_order_id: printifyOrderId,
      status: "submitted_to_printify",
      request_id: requestId,
    }, 200, req)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[MerchPaymentComplete ${requestId}] Error:`, err)

    if (message.toLowerCase().includes("abort")) {
      return withCors({ success: false, error: "Request timed out" }, 504, req)
    }

    return withCors({ success: false, error: "Payment completion failed" }, 500, req)
  }
})