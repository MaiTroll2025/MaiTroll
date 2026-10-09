// printify-webhook Edge Function
// Receives Printify webhook events and updates MAiTROLL order status.
// Webhook processing is idempotent.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface WebhookPayload {
  topic: string
  order_id?: string
  data?: {
    id?: string
    status?: string
    tracking_number?: string
    tracking_carrier?: string
    tracking_url?: string
    shipped_at?: string
    delivered_at?: string
    [key: string]: unknown
  }
  created_at?: string
}

Deno.serve(async (req) => {
  const requestId = `printify_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[PrintifyWebhook ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const payload: WebhookPayload = await req.json()
    const topic = payload.topic || ""
    const printifyOrderId = payload.order_id || payload.data?.id || ""

    console.log(`[PrintifyWebhook ${requestId}] Topic: ${topic}, Printify Order ID: ${printifyOrderId}`)

    if (!printifyOrderId) {
      return withCors({ success: false, error: "Missing order ID" }, 400, req)
    }

    // Find the MAiTROLL order by Printify order ID
    const { data: merchOrder, error: findError } = await supabase
      .from("mai_merch_orders")
      .select("*")
      .eq("printify_order_id", printifyOrderId)
      .maybeSingle()

    if (findError) {
      console.error(`[PrintifyWebhook ${requestId}] Database error:`, findError)
      return withCors({ success: false, error: "Database error" }, 500, req)
    }

    if (!merchOrder) {
      console.log(`[PrintifyWebhook ${requestId}] No MAiTROLL order found for Printify order ${printifyOrderId}`)
      return withCors({ success: true, message: "No matching MAiTROLL order" }, 200, req)
    }

    // Check if already processed (idempotency)
    const _currentStatus = merchOrder.fulfillment_status || ""
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Map Printify webhook topics to MAiTROLL order status
    switch (topic) {
      case "order:created":
      case "order:confirmed":
        updates.status = "submitted_to_printify"
        updates.fulfillment_status = "confirmed"
        break

      case "order:in_production":
        updates.status = "in_production"
        updates.fulfillment_status = "in_production"
        break

      case "order:shipped":
        updates.status = "shipped"
        updates.fulfillment_status = "shipped"
        updates.shipped_at = payload.data?.shipped_at || new Date().toISOString()
        if (payload.data?.tracking_number) {
          updates.tracking_number = String(payload.data.tracking_number)
        }
        if (payload.data?.tracking_carrier) {
          updates.tracking_carrier = String(payload.data.tracking_carrier)
        }
        if (payload.data?.tracking_url) {
          updates.tracking_url = String(payload.data.tracking_url)
        }
        break

      case "order:delivered":
        updates.status = "delivered"
        updates.fulfillment_status = "delivered"
        updates.delivered_at = payload.data?.delivered_at || new Date().toISOString()
        break

      case "order:cancelled":
        updates.status = "cancelled"
        updates.fulfillment_status = "cancelled"
        break

      case "order:failed":
        updates.status = "failed"
        updates.fulfillment_status = "failed"
        break

      case "order:updated":
        // Update tracking info if present
        if (payload.data?.tracking_number) {
          updates.tracking_number = String(payload.data.tracking_number)
        }
        if (payload.data?.tracking_carrier) {
          updates.tracking_carrier = String(payload.data.tracking_carrier)
        }
        if (payload.data?.tracking_url) {
          updates.tracking_url = String(payload.data.tracking_url)
        }
        if (payload.data?.shipped_at) {
          updates.shipped_at = payload.data.shipped_at
          updates.status = "shipped"
          updates.fulfillment_status = "shipped"
        }
        if (payload.data?.delivered_at) {
          updates.delivered_at = payload.data.delivered_at
          updates.status = "delivered"
          updates.fulfillment_status = "delivered"
        }
        break

      default:
        console.log(`[PrintifyWebhook ${requestId}] Unhandled topic: ${topic}`)
        return withCors({ success: true, message: `Unhandled topic: ${topic}` }, 200, req)
    }

    // Skip update if no meaningful change
    if (Object.keys(updates).length <= 1) { // Only updated_at
      console.log(`[PrintifyWebhook ${requestId}] No updates needed`)
      return withCors({ success: true, message: "No updates needed" }, 200, req)
    }

    const { error: updateError } = await supabase
      .from("mai_merch_orders")
      .update(updates)
      .eq("id", merchOrder.id)

    if (updateError) {
      console.error(`[PrintifyWebhook ${requestId}] Update error:`, updateError)
      return withCors({ success: false, error: "Failed to update order" }, 500, req)
    }

    console.log(`[PrintifyWebhook ${requestId}] Updated MAiTROLL order ${merchOrder.id} status to ${updates.status || "N/A"}`)

    return withCors({
      success: true,
      order_id: merchOrder.id,
      status: updates.status,
      fulfillment_status: updates.fulfillment_status,
      request_id: requestId,
    }, 200, req)

  } catch (err) {
    console.error(`[PrintifyWebhook ${requestId}] Error:`, err)
    return withCors({ success: false, error: "Webhook processing error" }, 500, req)
  }
})