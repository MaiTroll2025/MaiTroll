// verify-paypal-payment Edge Function
// Verifies and captures PayPal payments; credits coins via coin_transactions + purchase_ledger

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { fulfillPaypalCoinStorePurchase } from "../_shared/paypalStoreFulfillment.ts"

const PAYPAL_API_URL = "https://api.paypal.com"
const PAYPAL_SANDBOX_URL = "https://api.sandbox.paypal.com"

function parsePurchaseCustomId(
  cidRaw: string,
  fallbackPaidUsd: number,
): { userId?: string; packageId?: string; coinsHint?: number; purchaseType: string } {
  if (!cidRaw) return { purchaseType: "coins" };
  try {
    const j = JSON.parse(cidRaw) as Record<string, unknown>;
    const userId =
      typeof j.userId === "string"
        ? j.userId
        : typeof j.user_id === "string"
        ? j.user_id
        : undefined;
    const packageId =
      typeof j.packageId === "string"
        ? j.packageId
        : typeof j.package_id === "string"
        ? j.package_id
        : undefined;
    const rawCoins =
      typeof j.coins === "number"
        ? j.coins
        : typeof j.coins === "string"
        ? parseInt(j.coins, 10)
        : 0;
    const purchaseType =
      typeof j.purchaseType === "string"
        ? j.purchaseType
        : typeof j.purchase_type === "string"
        ? j.purchase_type
        : "coins";

    const coinsHint = Number.isFinite(rawCoins) && rawCoins > 0
      ? rawCoins
      : fallbackPaidUsd > 0
      ? Math.max(1, Math.round(fallbackPaidUsd * 100))
      : 0;

    return { userId, packageId, coinsHint: coinsHint || undefined, purchaseType };
  } catch {
    const parts = cidRaw.split("_");
    const userFromSplit = parts[0];
    const pkgFromSplit = parts[1];
    return {
      userId: /^[0-9a-f-]{36}$/i.test(userFromSplit) ? userFromSplit : undefined,
      packageId: pkgFromSplit && pkgFromSplit !== "coins" ? pkgFromSplit : undefined,
      coinsHint: fallbackPaidUsd > 0 ? Math.max(1, Math.round(fallbackPaidUsd * 100)) : 0,
      purchaseType: parts[4] || "coins",
    };
  }
}

Deno.serve(async (req) => {
  const requestId =
    `paypal_verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[VerifyPayPalPayment ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const body = await req.json()
    const { paypalOrderId, expectedAmount, userId: userIdBody } = body

    if (!paypalOrderId) {
      return withCors({ success: false, error: "PayPal order ID is required" }, 400, req)
    }

    // Rate limit: max 10 payment verifications per minute per user
    const rateLimitUserId = userIdBody || paypalOrderId;
    const rateLimitKey = `paypal_verify_rate:${rateLimitUserId}:${Math.floor(Date.now() / 60000)}`;
    const rateLimitCount = (globalThis as any).__paypalVerifyRateLimit?.[rateLimitKey] || 0;
    if (rateLimitCount >= 10) {
      return withCors({ success: false, error: "Too many payment verifications. Please wait a moment." }, 429, req)
    }
    if (!(globalThis as any).__paypalVerifyRateLimit) (globalThis as any).__paypalVerifyRateLimit = {};
    (globalThis as any).__paypalVerifyRateLimit[rateLimitKey] = rateLimitCount + 1;

    const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")
    const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")
    const paypalMode = Deno.env.get("PAYPAL_MODE")

    const baseUrl =
      paypalMode === "sandbox" ? PAYPAL_SANDBOX_URL : PAYPAL_API_URL

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error(
        `[VerifyPayPalPayment ${requestId}] PayPal credentials not configured`,
      )
      return withCors({ success: false, error: "Payment system not configured" }, 500, req)
    }

    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    if (!tokenRes.ok) {
      const error = await tokenRes.json()
      console.error(
        `[VerifyPayPalPayment ${requestId}] Token request failed:`,
        error,
      )
      return withCors({
        success: false,
        error: "Failed to authenticate with PayPal",
      }, 500, req)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token as string

    const orderDetailsRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${paypalOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    if (!orderDetailsRes.ok) {
      const error = await orderDetailsRes.json()
      console.error(
        `[VerifyPayPalPayment ${requestId}] Failed to get order details:`,
        error,
      )
      return withCors({
        success: false,
        error: "Failed to verify payment",
      }, 500, req)
    }

    const orderDetails = await orderDetailsRes.json()

    if (orderDetails.status !== "APPROVED") {
      console.log(
        `[VerifyPayPalPayment ${requestId}] Payment not approved: ${orderDetails.status}`,
      )
      return withCors({
        verified: false,
        status: orderDetails.status,
        error: "Payment not approved yet",
      }, 200, req)
    }

    const paidAmount = parseFloat(
      orderDetails.purchase_units?.[0]?.amount?.value || "0",
    )
    if (expectedAmount != null &&
      Math.abs(paidAmount - Number(expectedAmount)) > 0.02) {
      console.error(
        `[VerifyPayPalPayment ${requestId}] Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`,
      )
      return withCors({
        success: false,
        error: "Payment amount mismatch",
      }, 400, req)
    }

    const purchaseUnit = orderDetails.purchase_units?.[0]

    const captureRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    )

    if (!captureRes.ok) {
      const error = await captureRes.json()
      console.error(`[VerifyPayPalPayment ${requestId}] Capture failed:`, error)
      return withCors({
        success: false,
        error: "Failed to capture payment",
      }, 500, req)
    }

    const captureData = await captureRes.json()

    const captured =
      captureData?.purchase_units?.[0]?.payments?.captures?.[0]

    const paidFromCapture =
      parseFloat(String(captured?.amount?.value || paidAmount)) || paidAmount
    const cidRaw = String(purchaseUnit?.custom_id ?? "")
    const parsed = parsePurchaseCustomId(cidRaw, paidFromCapture)

    const packageId = parsed.packageId
    const purchaseType = parsed.purchaseType ?? "coins"

    let coinsEstimated =
      parsed.coinsHint ??
      Math.max(1, Math.round(paidFromCapture * 100))

    const captureId =
      typeof captured?.id === "string" ? captured?.id ?? null : null

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    const fromBody =
      typeof userIdBody === "string" ? userIdBody.trim() : ""
    const parsedUserRaw = parsed.userId?.trim() ?? ""

    const userIdCombined = parsedUserRaw || fromBody
    if (
      parsedUserRaw &&
      fromBody &&
      parsedUserRaw !== fromBody
    ) {
      return withCors({
        success: false,
        error: "User mismatch vs PayPal order",
      }, 403, req)
    }

    const userId = userIdCombined

    if (!supabaseUrl || !supabaseServiceKey || !userId) {
      console.error(
        `[VerifyPayPalPayment ${requestId}] Missing Supabase or user`,
        !!userId,
      )
      return withCors({
        success: false,
        error: userId ? "Ledger not configured" : "Purchase context missing user id",
      }, 400, req)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const fulfill = await fulfillPaypalCoinStorePurchase(supabaseAdmin, {
      userId,
      orderId: paypalOrderId,
      captureId,
      verifiedAmount: paidFromCapture,
      verifiedCurrency:
        captured?.amount?.currency_code ||
        purchaseUnit?.amount?.currency_code ||
        "USD",
      packageId,
      status: typeof captureData?.status === "string"
        ? captureData.status
        : "COMPLETED",
      purchaseType,
    })

    if (!fulfill.success) {
      return withCors({
        verified: false,
        error: fulfill.error,
      }, 400, req)
    }

    coinsEstimated = fulfill.coinsAdded;

    console.log(
      `[VerifyPayPalPayment ${requestId}] Success: Payment captured ${captureData.id}`,
    )

    return withCors({
      verified: true,
      paypalOrderId,
      captureId: captureData.id,
      amount: paidFromCapture,
      coins: coinsEstimated,
      userId,
      packageId,
      purchaseType,
    }, 200, req)
  } catch (err) {
    console.error(`[VerifyPayPalPayment ${requestId}] Error:`, err)
    return withCors({
      success: false,
      error: "Payment verification error",
    }, 500, req)
  }
})
