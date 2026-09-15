// merch-checkout Edge Function
// Validates cart server-side, fetches Printify products, calculates totals, creates MAiTROLL order and PayPal order.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { withCors, handleCorsPreflight, unauthorizedResponse } from "../_shared/cors.ts"

const PAYPAL_API_URL = "https://api.paypal.com"
const PAYPAL_SANDBOX_URL = "https://api.sandbox.paypal.com"
const PRINTIFY_API_BASE = "https://api.printify.com"
const REQUEST_TIMEOUT_MS = 30000

interface CartItem {
  printify_product_id: string
  printify_variant_id: string
  quantity: number
}

interface PrintifyVariant {
  id: string
  title: string
  price: number
  is_available: boolean
  sku?: string
  options?: Record<string, unknown>
}

interface PrintifyProduct {
  id: string
  title: string
  description?: string
  images?: Array<{ src: string; width?: number; height?: number; is_primary?: boolean }>
  variants?: PrintifyVariant[]
  status?: string
  blueprint_id?: number
  provider?: string
}

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
  const requestId = `merch_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[MerchCheckout ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  const authHeader = req.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log(`[MerchCheckout ${requestId}] Missing authorization header`)
    return unauthorizedResponse("Authorization required", req.headers.get("origin"))
  }

  const apiKey = getApiKey()
  const shopId = getShopId()

  if (!apiKey || !shopId) {
    console.error(`[MerchCheckout ${requestId}] Printify not configured`)
    return withCors({ success: false, error: "Printify not configured" }, 500, req)
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      console.log(`[MerchCheckout ${requestId}] Invalid auth token`)
      return unauthorizedResponse("Invalid authentication", req.headers.get("origin"))
    }

    const userId = user.id
    console.log(`[MerchCheckout ${requestId}] Authenticated user: ${userId}`)

    const body = await req.json()
    const { items, shipping_address, address_id } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return withCors({ success: false, error: "Cart is empty" }, 400, req)
    }

    for (const item of items as CartItem[]) {
      if (
        !item.printify_product_id ||
        !item.printify_variant_id ||
        !item.quantity ||
        item.quantity < 1
      ) {
        return withCors({
          success: false,
          error: "Invalid cart item: product_id, variant_id, and quantity required",
        }, 400, req)
      }

      if (item.quantity > 99) {
        return withCors({ success: false, error: "Invalid quantity" }, 400, req)
      }
    }

    let shippingAddress: ShippingAddress

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    if (address_id) {
      const { data: savedAddress, error: addrError } = await supabaseService
        .from("user_addresses")
        .select("*")
        .eq("id", address_id)
        .eq("user_id", userId)
        .maybeSingle()

      if (addrError || !savedAddress) {
        return withCors({ success: false, error: "Saved address not found" }, 400, req)
      }

      shippingAddress = {
        first_name: savedAddress.first_name,
        last_name: savedAddress.last_name,
        email: savedAddress.email,
        phone: savedAddress.phone,
        address_line1: savedAddress.address_line1,
        address_line2: savedAddress.address_line2,
        city: savedAddress.city,
        state: savedAddress.state,
        postal_code: savedAddress.postal_code,
        country: savedAddress.country,
      }
    } else if (shipping_address) {
      shippingAddress = shipping_address as ShippingAddress
    } else {
      return withCors({ success: false, error: "Shipping address required" }, 400, req)
    }

    let subtotal = 0
    const validatedItems: Array<{
      printify_product_id: string
      printify_variant_id: string
      quantity: number
      unit_price: number
      total_price: number
      variant_title: string
      size?: string
      color?: string
      sku?: string
      product_image?: string
      product_title: string
    }> = []

    for (const item of items as CartItem[]) {
      const endpoint =
        `${PRINTIFY_API_BASE}/v1/shops/${shopId}/products/${item.printify_product_id}.json`

      const res = await fetchWithTimeout(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "MAiTROLL-Merch/1.0",
        },
      }, REQUEST_TIMEOUT_MS)

      if (res.status === 404) {
        return withCors({
          success: false,
          error: `Product ${item.printify_product_id} not found`,
        }, 404, req)
      }

      if (res.status === 401) {
        return withCors({
          success: false,
          error: "Printify authentication failed",
        }, 500, req)
      }

      if (!res.ok) {
        return withCors({
          success: false,
          error: "Failed to fetch product details",
        }, 502, req)
      }

      const product: PrintifyProduct = await res.json()

      const variant = product.variants?.find(
        (v) => String(v.id) === String(item.printify_variant_id)
      )

      if (!variant) {
        return withCors({
          success: false,
          error: `Variant ${item.printify_variant_id} not found for product ${item.printify_product_id}`,
        }, 404, req)
      }

      if (!variant.is_available) {
        return withCors({
          success: false,
          error: `Variant ${variant.title} is not available`,
        }, 400, req)
      }

      // Printify price is in cents, convert to dollars.
      const unitPrice = (variant.price || 0) / 100
      const totalPrice = unitPrice * item.quantity

      subtotal += totalPrice

      validatedItems.push({
        printify_product_id: item.printify_product_id,
        printify_variant_id: item.printify_variant_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        variant_title: variant.title,
        size: variant.options?.size as string | undefined,
        color: variant.options?.color as string | undefined,
        sku: variant.sku,
        product_image: product.images?.find((image) => image.is_primary)?.src
          || product.images?.[0]?.src,
        product_title: product.title,
      })
    }

    // Temporary flat-rate shipping. Replace with actual Printify shipping calculation
    // before production if exact shipping rates are required.
    let shippingAmount = 0
    for (const item of validatedItems) {
      shippingAmount += 4.99 * item.quantity
    }

    const taxAmount = 0
    const totalAmount = subtotal + shippingAmount + taxAmount

    console.log(
      `[MerchCheckout ${requestId}] Subtotal: $${subtotal.toFixed(2)}, ` +
      `Shipping: $${shippingAmount.toFixed(2)}, Total: $${totalAmount.toFixed(2)}`
    )

    const orderNumber =
      `MT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    const { data: order, error: orderError } = await supabaseService
      .from("mai_merch_orders")
      .insert({
        user_id: userId,
        order_number: orderNumber,
        subtotal,
        shipping_amount: shippingAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        currency: "USD",
        status: "payment_pending",
        payment_status: "pending",
        fulfillment_status: "pending",
        shipping_address: shippingAddress,
        customer_email: shippingAddress.email,
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error(`[MerchCheckout ${requestId}] Failed to create order:`, orderError)
      return withCors({ success: false, error: "Failed to create order" }, 500, req)
    }

    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      printify_product_id: item.printify_product_id,
      printify_variant_id: item.printify_variant_id,
      variant_name: item.variant_title,
      size: item.size,
      color: item.color,
      sku: item.sku,
      product_image: item.product_image,
    }))

    const { error: itemsError } = await supabaseService
      .from("mai_merch_order_items")
      .insert(orderItems)

    if (itemsError) {
      console.error(`[MerchCheckout ${requestId}] Failed to create order items:`, itemsError)
      await supabaseService.from("mai_merch_orders").delete().eq("id", order.id)
      return withCors({ success: false, error: "Failed to create order items" }, 500, req)
    }

    const paypalClientId = getPayPalClientId()
    const paypalSecret = getPayPalSecret()
    const paypalMode = getPayPalMode()
    const baseUrl = paypalMode === "sandbox" ? PAYPAL_SANDBOX_URL : PAYPAL_API_URL

    if (!paypalClientId || !paypalSecret) {
      console.error(`[MerchCheckout ${requestId}] PayPal not configured`)
      return withCors({ success: false, error: "Payment system not configured" }, 500, req)
    }

    const auth = btoa(`${paypalClientId}:${paypalSecret}`)

    const tokenRes = await fetchWithTimeout(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }, REQUEST_TIMEOUT_MS)

    if (!tokenRes.ok) {
      console.error(`[MerchCheckout ${requestId}] PayPal authentication failed`)
      return withCors({ success: false, error: "Failed to authenticate with PayPal" }, 500, req)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return withCors({ success: false, error: "PayPal authentication returned no token" }, 500, req)
    }

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: totalAmount.toFixed(2),
          breakdown: {
            item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
            shipping: { currency_code: "USD", value: shippingAmount.toFixed(2) },
            tax_total: { currency_code: "USD", value: taxAmount.toFixed(2) },
          },
        },
        description: `MAiTROLL Merch Order ${orderNumber}`,
        custom_id: JSON.stringify({
          maitroll_order_id: order.id,
          order_number: orderNumber,
          user_id: userId,
        }),
        shipping: {
          name: {
            full_name: `${shippingAddress.first_name} ${shippingAddress.last_name}`,
          },
          address: {
            address_line_1: shippingAddress.address_line1,
            address_line_2: shippingAddress.address_line2,
            admin_area_2: shippingAddress.city,
            admin_area_1: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country_code: shippingAddress.country,
          },
        },
      }],
      application_context: {
        // Set these to your actual MAiTROLL frontend URL.
        return_url:
          `${Deno.env.get("MAITROLL_APP_URL") || "https://maitroll.com"}/coinstore?success=true&order=${orderNumber}`,
        cancel_url:
          `${Deno.env.get("MAITROLL_APP_URL") || "https://maitroll.com"}/coinstore?canceled=true&order=${orderNumber}`,
        user_action: "PAY_NOW",
        brand_name: "MAiTROLL",
        locale: "en-US",
        shipping_preference: "SET_PROVIDED_ADDRESS",
      },
    }

    const paypalOrderRes = await fetchWithTimeout(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    }, REQUEST_TIMEOUT_MS)

    if (!paypalOrderRes.ok) {
      const errorText = await paypalOrderRes.text()
      console.error(
        `[MerchCheckout ${requestId}] PayPal order creation failed:`,
        errorText.substring(0, 1000)
      )
      return withCors({ success: false, error: "Failed to create PayPal order" }, 500, req)
    }

    const paypalOrder = await paypalOrderRes.json()
    const paypalOrderId = paypalOrder.id
    const approvalUrl = paypalOrder.links?.find(
      (link: { rel?: string; href?: string }) => link.rel === "approve"
    )?.href

    if (!paypalOrderId) {
      return withCors({ success: false, error: "PayPal returned no order ID" }, 500, req)
    }

    await supabaseService
      .from("mai_merch_orders")
      .update({ paypal_order_id: paypalOrderId })
      .eq("id", order.id)

    console.log(
      `[MerchCheckout ${requestId}] Success: PayPal order ${paypalOrderId} ` +
      `created for MAiTROLL order ${orderNumber}`
    )

    return withCors({
      success: true,
      order_id: order.id,
      order_number: orderNumber,
      paypal_order_id: paypalOrderId,
      approval_url: approvalUrl,
      subtotal,
      shipping: shippingAmount,
      tax: taxAmount,
      total: totalAmount,
      currency: "USD",
      request_id: requestId,
    }, 200, req)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[MerchCheckout ${requestId}] Error:`, err)

    if (message.toLowerCase().includes("abort")) {
      return withCors({ success: false, error: "Request timed out" }, 504, req)
    }

    return withCors({ success: false, error: "Checkout failed" }, 500, req)
  }
})
