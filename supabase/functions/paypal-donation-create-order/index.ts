import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  checkDonationRateLimit,
  createDonationAdminClient,
  DonationHttpError,
  donationResponse,
  getDonorUserId,
  isPayPalApprovalUrl,
  parseDonationAmount,
  paypalRequest,
} from "../_shared/paypalDonations.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PayPalOrder {
  id: string;
  links?: Array<{ rel?: string; href?: string }>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request.headers.get("origin")) });
  }
  if (request.method !== "POST") {
    return donationResponse(request, { error: "Method not allowed." }, 405);
  }

  try {
    const client = createDonationAdminClient();
    await checkDonationRateLimit(client, request, "create");
    const donorUserId = await getDonorUserId(request);
    const body = await request.json();
    const amount = parseDonationAmount(body?.amount);
    const requestOrigin = request.headers.get("origin");
    let siteOrigin = "https://www.maitroll.com";
    let donorName: string | null = null;
    if (body?.donorName !== undefined && body.donorName !== null) {
      if (typeof body.donorName !== "string") {
        throw new DonationHttpError("Enter a valid public display name.");
      }
      donorName = body.donorName.trim();
      const hasControlCharacters = Array.from(donorName).some((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && (codePoint < 32 || (codePoint >= 127 && codePoint <= 159));
      });
      if (Array.from(donorName).length > 80 || hasControlCharacters) {
        throw new DonationHttpError("Enter a public display name of 80 characters or fewer without control characters.");
      }
      if (!donorName) donorName = null;
    }
    if (requestOrigin) {
      try {
        const originUrl = new URL(requestOrigin);
        const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(originUrl.hostname);
        const isMaiTrollDomain = ["maitroll.com", "www.maitroll.com"].includes(originUrl.hostname);
        const isPreviewDomain = originUrl.hostname.endsWith(".pages.dev");
        if (
          (originUrl.protocol === "https:" && (isMaiTrollDomain || isPreviewDomain))
          || (originUrl.protocol === "http:" && isLocalDevelopment)
        ) {
          siteOrigin = originUrl.origin;
        }
      } catch {
        throw new DonationHttpError("Invalid checkout origin.", 400);
      }
    }
    const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: amount.toFixed(2) },
          description: "Voluntary contribution to MaiTroll platform development",
          custom_id: "maitroll-platform-donation",
        }],
        application_context: {
          brand_name: "MaiTroll",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: `${siteOrigin}/donate?payment=return`,
          cancel_url: `${siteOrigin}/donate?payment=cancelled`,
        },
      }),
    });

    const approvalUrl = order.links?.find((link) => link.rel === "approve")?.href;
    if (!order.id || !isPayPalApprovalUrl(approvalUrl)) {
      throw new DonationHttpError("PayPal did not provide a valid checkout link.", 502);
    }

    const { error } = await client.from("platform_donations").insert({
      user_id: donorUserId,
      amount_usd: amount,
      currency: "USD",
      paypal_order_id: order.id,
      payment_status: "pending",
      donor_name: donorName,
    });
    if (error) {
      console.error("[paypal-donation] Could not save pending order:", error.message);
      throw new DonationHttpError("Could not start the donation. Please try again.", 500);
    }

    return donationResponse(request, { orderId: order.id, approvalUrl });
  } catch (error) {
    if (error instanceof DonationHttpError) {
      return donationResponse(request, { error: error.message }, error.status);
    }
    console.error("[paypal-donation] Order creation failed:", error);
    return donationResponse(request, { error: "Could not start the donation. Please try again." }, 500);
  }
});
