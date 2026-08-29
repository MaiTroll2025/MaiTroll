// create-paypal-order Edge Function
// Creates a PayPal payment order for coin purchases using PayPal Checkout

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

const PAYPAL_API_URL = 'https://api.paypal.com'
const PAYPAL_SANDBOX_URL = 'https://api.sandbox.paypal.com'

Deno.serve(async (req) => {
  const requestId = `paypal_checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[CreatePayPalOrder ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const body = await req.json()
    const { userId, coins, amountUsd, packageId, packageName, purchaseType } = body

    if (!userId) {
      return withCors({ success: false, error: 'userId is required' }, 400, req)
    }
    if (!amountUsd || amountUsd <= 0) {
      return withCors({ success: false, error: 'Invalid amount' }, 400, req)
    }

    // Rate limit: max 5 purchase orders per minute per user
    const rateLimitKey = `paypal_order_rate:${userId}:${Math.floor(Date.now() / 60000)}`;
    const rateLimitCount = (globalThis as any).__paypalOrderRateLimit?.[rateLimitKey] || 0;
    if (rateLimitCount >= 5) {
      return withCors({ success: false, error: "Too many purchase attempts. Please wait a moment." }, 429, req)
    }
    if (!(globalThis as any).__paypalOrderRateLimit) (globalThis as any).__paypalOrderRateLimit = {};
    (globalThis as any).__paypalOrderRateLimit[rateLimitKey] = rateLimitCount + 1;

    // PayPal credentials from environment
    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')
    const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const PAYPAL_ENVIRONMENT = 'live'

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error(`[CreatePayPalOrder ${requestId}] PayPal credentials not configured`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500, req)
    }

    const baseUrl = PAYPAL_ENVIRONMENT === 'live' ? PAYPAL_API_URL : PAYPAL_SANDBOX_URL

    // Get PayPal access token
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
    console.log(`[CreatePayPalOrder ${requestId}] Getting access token from ${baseUrl}/v1/oauth2/token`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!tokenRes.ok) {
      const error = await tokenRes.json()
      console.error(`[CreatePayPalOrder ${requestId}] Token request failed:`, error)
      console.error(`[CreatePayPalOrder ${requestId}] Status:`, tokenRes.status)
      return withCors({
        success: false,
        error: 'Failed to authenticate with PayPal',
        details: error
      }, 500, req)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Create PayPal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amountUsd.toFixed(2),
          },
          description: packageName || `${coins} Troll Coins`,
          custom_id: JSON.stringify({
            userId,
            packageId: packageId ?? null,
            coins: typeof coins === "number"
              ? coins
              : Math.max(1, Math.round(Number(amountUsd) * 100)),
            purchaseType: purchaseType ?? "coins",
          }),
        },
      ],
      application_context: {
        return_url: `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/coinstore?success=true`,
        cancel_url: `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/coinstore?canceled=true`,
        user_action: 'PAY_NOW',
      },
    }

    console.log(`[CreatePayPalOrder ${requestId}] Creating order with payload:`, JSON.stringify(orderPayload, null, 2))

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })

    if (!orderRes.ok) {
      const error = await orderRes.json()
      console.error(`[CreatePayPalOrder ${requestId}] Order creation failed:`, error)
      console.error(`[CreatePayPalOrder ${requestId}] Status:`, orderRes.status)
      return withCors({
        success: false,
        error: 'Failed to create PayPal order',
        details: error
      }, 500, req)
    }

    const orderData = await orderRes.json()
    console.log(`[CreatePayPalOrder ${requestId}] Order created successfully:`, orderData)
    const orderId = orderData.id

    console.log(`[CreatePayPalOrder ${requestId}] Success: PayPal order ${orderId} created`)

    return withCors({
      success: true,
      orderId,
      paypalOrderId: orderId,
      amount: amountUsd,
      approvalUrl: orderData.links?.find((link: any) => link.rel === 'approve')?.href,
    }, 200, req)

  } catch (err) {
    console.error(`[CreatePayPalOrder ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Payment system error' }, 500, req)
  }
})