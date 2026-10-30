import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  checkDonationRateLimit,
  createDonationAdminClient,
  DonationHttpError,
  donationResponse,
  paypalRequest,
} from "../_shared/paypalDonations.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PayPalOrder {
  id: string;
  status: string;
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
    await checkDonationRateLimit(client, request, "cancel");
    const body = await request.json();
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(orderId)) {
      throw new DonationHttpError("Invalid PayPal order reference.");
    }

    const { data: donation, error } = await client
      .from("platform_donations")
      .select("id, payment_status")
      .eq("paypal_order_id", orderId)
      .maybeSingle();
    if (error) throw new DonationHttpError("Could not verify this donation order.", 500);
    if (!donation) throw new DonationHttpError("Donation order was not found.", 404);
    if (donation.payment_status !== "pending") {
      return donationResponse(request, { canceled: donation.payment_status === "canceled" });
    }

    const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    if (order.id !== orderId) throw new DonationHttpError("PayPal order could not be verified.", 400);
    if (order.status === "VOIDED") {
      const { error: updateError } = await client
        .from("platform_donations")
        .update({ payment_status: "canceled" })
        .eq("id", donation.id)
        .eq("payment_status", "pending");
      if (updateError) throw new DonationHttpError("Could not update the canceled donation.", 500);
      return donationResponse(request, { canceled: true });
    }
    if (order.status === "CREATED") {
      return donationResponse(request, { canceled: true });
    }

    return donationResponse(request, { canceled: false });
  } catch (error) {
    if (error instanceof DonationHttpError) {
      return donationResponse(request, { error: error.message }, error.status);
    }
    console.error("[paypal-donation] Cancellation verification failed:", error);
    return donationResponse(request, { error: "Could not verify the canceled PayPal order." }, 500);
  }
});
