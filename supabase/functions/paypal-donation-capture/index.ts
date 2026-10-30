import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  checkDonationRateLimit,
  createDonationAdminClient,
  DonationHttpError,
  donationResponse,
  paypalRequest,
} from "../_shared/paypalDonations.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: Array<{
      id?: string;
      status?: string;
      amount?: { value?: string; currency_code?: string };
    }> };
  }>;
}

function exactUsdAmount(value: unknown, expected: number): boolean {
  return typeof value === "string" && /^\d+\.\d{2}$/.test(value) && Number(value) === expected;
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
    await checkDonationRateLimit(client, request, "capture");
    const body = await request.json();
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(orderId)) {
      throw new DonationHttpError("Invalid PayPal order reference.");
    }

    const { data: donation, error: findError } = await client
      .from("platform_donations")
      .select("id, amount_usd, currency, paypal_capture_id, payment_status")
      .eq("paypal_order_id", orderId)
      .maybeSingle();
    if (findError) throw new DonationHttpError("Could not verify the donation order.", 500);
    if (!donation) throw new DonationHttpError("Donation order was not found.", 404);
    if (donation.payment_status === "completed" && donation.paypal_capture_id) {
      return donationResponse(request, {
        success: true,
        amount: Number(donation.amount_usd).toFixed(2),
        currency: donation.currency,
        transactionId: donation.paypal_capture_id,
        alreadyProcessed: true,
      });
    }
    if (donation.payment_status !== "pending") {
      throw new DonationHttpError("This donation order is no longer available.", 409);
    }

    let order = await paypalRequest<PayPalCaptureResponse>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    const purchaseUnits = order.purchase_units || [];
    if (order.id !== orderId || purchaseUnits.length !== 1) {
      throw new DonationHttpError("PayPal order details did not match this donation.", 400);
    }
    const unit = purchaseUnits[0];
    if (unit.amount?.currency_code !== "USD" || !exactUsdAmount(unit.amount.value, Number(donation.amount_usd))) {
      throw new DonationHttpError("PayPal order amount could not be verified.", 400);
    }

    if (order.status === "APPROVED") {
      order = await paypalRequest<PayPalCaptureResponse>(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: {
            "PayPal-Request-Id": `don-${Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(orderId))),
              (byte) => byte.toString(16).padStart(2, "0"),
            ).join("").slice(0, 34)}`,
          },
          body: "{}",
        },
      );
    }

    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id) {
      throw new DonationHttpError("PayPal has not confirmed a completed payment.", 409);
    }
    if (capture.amount?.currency_code !== "USD" || !exactUsdAmount(capture.amount.value, Number(donation.amount_usd))) {
      throw new DonationHttpError("Captured amount could not be verified.", 400);
    }

    const { data: updated, error: updateError } = await client
      .from("platform_donations")
      .update({
        paypal_capture_id: capture.id,
        payment_status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", donation.id)
      .eq("payment_status", "pending")
      .select("paypal_capture_id")
      .maybeSingle();

    if (updateError) {
      console.error("[paypal-donation] Could not record verified capture:", updateError.message);
      throw new DonationHttpError("Payment succeeded, but its confirmation is still processing. Contact support if this persists.", 500);
    }
    if (!updated) {
      const { data: finalRecord, error: finalError } = await client
        .from("platform_donations")
        .select("paypal_capture_id, payment_status")
        .eq("id", donation.id)
        .maybeSingle();
      if (finalError || finalRecord?.payment_status !== "completed" || finalRecord.paypal_capture_id !== capture.id) {
        throw new DonationHttpError("Payment succeeded, but its confirmation is still processing. Contact support if this persists.", 500);
      }
    }

    return donationResponse(request, {
      success: true,
      amount: Number(donation.amount_usd).toFixed(2),
      currency: "USD",
      transactionId: capture.id,
    });
  } catch (error) {
    if (error instanceof DonationHttpError) {
      return donationResponse(request, { error: error.message }, error.status);
    }
    console.error("[paypal-donation] Capture failed:", error);
    return donationResponse(request, { error: "PayPal could not confirm this donation. Please contact support if you were charged." }, 500);
  }
});
