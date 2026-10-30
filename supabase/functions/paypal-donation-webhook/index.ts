import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createDonationAdminClient,
  DonationHttpError,
  paypalRequest,
} from "../_shared/paypalDonations.ts";

interface PayPalCapture {
  id: string;
  status: string;
  amount?: { value?: string; currency_code?: string };
  supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  links?: Array<{ rel?: string; href?: string }>;
}

interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: { captures?: PayPalCapture[] };
  }>;
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: PayPalCapture & { id?: string };
}

function webhookResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function amountMatches(value: unknown, expected: number): boolean {
  return typeof value === "string" && /^\d+\.\d{2}$/.test(value) && Number(value) === expected;
}

function getOrderIdFromCapture(capture: PayPalCapture): string | null {
  return capture.supplementary_data?.related_ids?.order_id || null;
}

function getCaptureIdFromRefund(refund: PayPalCapture): string | null {
  const relatedCaptureId = refund.supplementary_data?.related_ids?.capture_id;
  if (relatedCaptureId) return relatedCaptureId;
  const parentLink = refund.links?.find((link) => link.rel === "up")?.href;
  const match = parentLink?.match(/\/captures\/([^/?#]+)/);
  return match?.[1] || null;
}

async function verifyPayPalWebhook(request: Request, event: PayPalWebhookEvent): Promise<void> {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID")
    || Deno.env.get("PAYPAL_DONATION_WEBHOOK_ID");
  if (!webhookId) throw new DonationHttpError("PayPal donation webhook is not configured.", 503);

  const requiredHeaders = {
    transmissionId: request.headers.get("paypal-transmission-id"),
    transmissionTime: request.headers.get("paypal-transmission-time"),
    certUrl: request.headers.get("paypal-cert-url"),
    authAlgo: request.headers.get("paypal-auth-algo"),
    transmissionSig: request.headers.get("paypal-transmission-sig"),
  };
  if (Object.values(requiredHeaders).some((value) => !value)) {
    throw new DonationHttpError("PayPal webhook signature headers are incomplete.", 400);
  }

  const result = await paypalRequest<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: requiredHeaders.authAlgo,
        cert_url: requiredHeaders.certUrl,
        transmission_id: requiredHeaders.transmissionId,
        transmission_sig: requiredHeaders.transmissionSig,
        transmission_time: requiredHeaders.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      }),
    },
  );
  if (result.verification_status !== "SUCCESS") {
    throw new DonationHttpError("PayPal webhook signature is invalid.", 401);
  }
}

async function getVerifiedDonationOrder(orderId: string): Promise<PayPalOrder> {
  const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  if (
    order.id !== orderId
    || order.purchase_units?.length !== 1
    || order.purchase_units[0].custom_id !== "maitroll-platform-donation"
    || order.purchase_units[0].amount?.currency_code !== "USD"
  ) {
    throw new DonationHttpError("PayPal donation order could not be verified.", 400);
  }
  return order;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return webhookResponse({ error: "Method not allowed." }, 405);

  try {
    const rawEvent = await request.json() as PayPalWebhookEvent;
    if (!rawEvent?.id || !rawEvent.event_type || !rawEvent.resource) {
      throw new DonationHttpError("Invalid PayPal webhook event.", 400);
    }
    await verifyPayPalWebhook(request, rawEvent);

    const client = createDonationAdminClient();
    const { data: alreadyProcessed, error: eventLookupError } = await client
      .from("paypal_donation_webhook_events")
      .select("event_id")
      .eq("event_id", rawEvent.id)
      .maybeSingle();
    if (eventLookupError) throw new DonationHttpError("Could not verify webhook processing state.", 500);
    if (alreadyProcessed) return webhookResponse({ received: true, duplicate: true });

    const resource = rawEvent.resource;
    if (rawEvent.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const captureId = resource.id;
      const orderId = getOrderIdFromCapture(resource);
      if (captureId && orderId) {
        const order = await getVerifiedDonationOrder(orderId);
        const purchaseUnit = order.purchase_units![0];
        const amount = Number(purchaseUnit.amount?.value);
        const capture = purchaseUnit.payments?.captures?.find((item) => item.id === captureId);
        if (
          Number.isFinite(amount)
          && capture?.status === "COMPLETED"
          && resource.status === "COMPLETED"
          && resource.amount?.currency_code === "USD"
          && amountMatches(resource.amount.value, amount)
          && amountMatches(capture.amount?.value, amount)
          && capture.amount?.currency_code === "USD"
        ) {
          const { data: donation, error: lookupError } = await client
            .from("platform_donations")
            .select("id, amount_usd, payment_status")
            .eq("paypal_order_id", orderId)
            .maybeSingle();
          if (lookupError) throw new DonationHttpError("Could not locate donation record.", 500);
          if (donation && Number(donation.amount_usd) === amount) {
            const { error: updateError } = await client
              .from("platform_donations")
              .update({
                paypal_capture_id: captureId,
                payment_status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("id", donation.id)
              .in("payment_status", ["pending", "completed"]);
            if (updateError) throw new DonationHttpError("Could not record verified donation payment.", 500);
          }
        }
      }
    } else if (rawEvent.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId = getCaptureIdFromRefund(resource);
      if (captureId) {
        const { data: donation, error: lookupError } = await client
          .from("platform_donations")
          .select("id, amount_usd, currency")
          .eq("paypal_capture_id", captureId)
          .maybeSingle();
        if (lookupError) throw new DonationHttpError("Could not locate refunded donation.", 500);
        if (donation) {
          const capture = await paypalRequest<PayPalCapture>(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
          if (
            capture.id !== captureId
            || !["REFUNDED", "PARTIALLY_REFUNDED"].includes(capture.status)
            || capture.amount?.currency_code !== donation.currency
            || !amountMatches(capture.amount?.value, Number(donation.amount_usd))
          ) {
            throw new DonationHttpError("PayPal refund could not be verified.", 400);
          }
          if (capture.status === "REFUNDED") {
            const { error: updateError } = await client
              .from("platform_donations")
              .update({ payment_status: "refunded" })
              .eq("id", donation.id)
              .eq("payment_status", "completed");
            if (updateError) throw new DonationHttpError("Could not record verified refund.", 500);
          }
        }
      }
    } else if (rawEvent.event_type === "CHECKOUT.ORDER.VOIDED") {
      const orderId = resource.id;
      if (orderId) {
        const order = await getVerifiedDonationOrder(orderId);
        if (order.status === "VOIDED") {
          const { error: updateError } = await client
            .from("platform_donations")
            .update({ payment_status: "canceled" })
            .eq("paypal_order_id", orderId)
            .eq("payment_status", "pending");
          if (updateError) throw new DonationHttpError("Could not record canceled donation.", 500);
        }
      }
    } else if (rawEvent.event_type === "PAYMENT.CAPTURE.DENIED") {
      const orderId = getOrderIdFromCapture(resource);
      if (orderId) {
        const order = await getVerifiedDonationOrder(orderId);
        if (order.purchase_units?.[0].payments?.captures?.some((capture) => capture.id === resource.id && capture.status === "DENIED")) {
          const { error: updateError } = await client
            .from("platform_donations")
            .update({ payment_status: "failed" })
            .eq("paypal_order_id", orderId)
            .eq("payment_status", "pending");
          if (updateError) throw new DonationHttpError("Could not record failed donation.", 500);
        }
      }
    }

    const { error: recordEventError } = await client
      .from("paypal_donation_webhook_events")
      .insert({ event_id: rawEvent.id, event_type: rawEvent.event_type });
    if (recordEventError && recordEventError.code !== "23505") {
      throw new DonationHttpError("Could not record PayPal webhook event.", 500);
    }
    return webhookResponse({ received: true });
  } catch (error) {
    if (error instanceof DonationHttpError) {
      return webhookResponse({ error: error.message }, error.status);
    }
    console.error("[paypal-donation-webhook] Event handling failed:", error);
    return webhookResponse({ error: "PayPal webhook could not be processed." }, 500);
  }
});
