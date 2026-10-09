// printify-create-order Edge Function
// Creates a Printify fulfillment order after successful PayPal payment.
// Uses PRINTIFY_API_KEY and PRINTIFY_SHOP_ID secrets.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight, unauthorizedResponse } from "../_shared/cors.ts"

const PRINTIFY_API_BASE = "https://api.printify.com"
const REQUEST_TIMEOUT_MS = 30000

interface PrintifyOrderItem {
  product_id: string
  variant_id: string
  quantity: number
}

interface PrintifyOrderPayload {
  external_id: string
  items: PrintifyOrderItem[]
  shipping_method: number
  shipping_address: {
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
  metadata?: Record<string, string>
}

interface PrintifyOrderResponse {
  id: string
  status?: string
  created_at?: string
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

Deno.serve(async (req) => {
  const requestId = `printify_create_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[PrintifyCreateOrder ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  // Auth check
  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`[PrintifyCreateOrder ${requestId}] Missing authorization header`)
    return unauthorizedResponse("Authorization required", req.headers.get("origin"))
  }

  const apiKey = getApiKey()
  const shopId = getShopId()

  if (!apiKey) {
    console.error(`[PrintifyCreateOrder ${requestId}] PRINTIFY_API_KEY not configured`)
    return withCors({ success: false, error: "Printify not configured" }, 500, req)
  }

  if (!shopId) {
    console.error(`[PrintifyCreateOrder ${requestId}] PRINTIFY_SHOP_ID not configured`)
    return withCors({ success: false, error: "Printify shop not configured" }, 500, req)
  }

  try {
    const body = await req.json()
    const { order_id, external_id, items, shipping_address, shipping_method } = body

    if (!order_id || !items || !Array.isArray(items) || items.length === 0) {
      return withCors({ success: false, error: "Missing order_id or items" }, 400, req)
    }

    if (!shipping_address) {
      return withCors({ success: false, error: "Missing shipping address" }, 400, req)
    }

    // Validate items
    for (const item of items) {
      if (!item.product_id || !item.variant_id || !item.quantity || item.quantity < 1) {
        return withCors({ success: false, error: "Invalid item: product_id, variant_id, and quantity required" }, 400, req)
      }
    }

    const payload: PrintifyOrderPayload = {
      external_id: external_id || `MAITROLL-${order_id}`,
      items: items.map((item: any) => ({
        product_id: String(item.product_id),
        variant_id: String(item.variant_id),
        quantity: parseInt(String(item.quantity), 10),
      })),
      shipping_method: parseInt(String(shipping_method || "1"), 10),
      shipping_address: {
        first_name: String(shipping_address.first_name || ""),
        last_name: String(shipping_address.last_name || ""),
        email: String(shipping_address.email || ""),
        phone: shipping_address.phone ? String(shipping_address.phone) : undefined,
        address_line1: String(shipping_address.address_line1 || ""),
        address_line2: shipping_address.address_line2 ? String(shipping_address.address_line2) : undefined,
        city: String(shipping_address.city || ""),
        state: String(shipping_address.state || ""),
        postal_code: String(shipping_address.postal_code || ""),
        country: String(shipping_address.country || "US"),
      },
      metadata: {
        maitroll_order_id: String(order_id),
        source: "MAiTROLL_MERCH",
      },
    }

    console.log(`[PrintifyCreateOrder ${requestId}] Creating Printify order for MAiTROLL order ${order_id}`)

    const res = await fetchWithTimeout(
      `${PRINTIFY_API_BASE}/v1/shops/${shopId}/orders.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": `MAiTroll-Merch/1.0`,
        },
        body: JSON.stringify(payload),
      },
      REQUEST_TIMEOUT_MS
    )

    if (res.status === 401) {
      console.error(`[PrintifyCreateOrder ${requestId}] Printify API authentication failed`)
      return withCors({ success: false, error: "Printify authentication failed" }, 500, req)
    }

    if (res.status === 403) {
      console.error(`[PrintifyCreateOrder ${requestId}] Printify API access denied`)
      return withCors({ success: false, error: "Printify access denied" }, 503, req)
    }

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[PrintifyCreateOrder ${requestId}] Printify API error: ${res.status}`, errorText.substring(0, 500))
      return withCors({
        success: false,
        error: "Printify order creation failed",
        status: res.status,
        details: errorText.substring(0, 500),
      }, 502, req)
    }

    const orderData: PrintifyOrderResponse = await res.json()

    console.log(`[PrintifyCreateOrder ${requestId}] Success: Printify order ${orderData.id} created`)

    return withCors({
      success: true,
      printify_order_id: orderData.id,
      printify_status: orderData.status,
      external_id: payload.external_id,
      request_id: requestId,
    }, 200, req)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[PrintifyCreateOrder ${requestId}] Error:`, err)

    if (message.includes("abort")) {
      return withCors({ success: false, error: "Printify request timed out" }, 504, req)
    }

    return withCors({ success: false, error: "Failed to create Printify order" }, 500, req)
  }
})