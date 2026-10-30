import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

export class DonationHttpError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function donationResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function createDonationAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new DonationHttpError("Donation service is not configured.", 500);
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getDonorUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new DonationHttpError("Donation service is not configured.", 500);
  }
  if (!token || token === anonKey) return null;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    console.warn("[paypal-donation] Optional donor session was not valid; continuing as guest.");
    return null;
  }
  return data.user.id;
}

export async function checkDonationRateLimit(
  client: SupabaseClient,
  request: Request,
  action: string,
): Promise<void> {
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await client.rpc("check_platform_donation_rate_limit", {
    p_key: `paypal_donation_${action}_${ipHash}`,
    p_limit: action === "create" ? 6 : 12,
    p_window_seconds: 60,
  });

  if (error) {
    console.error("[paypal-donation] Rate limit check failed:", {
      code: error.code,
      message: error.message,
    });
    throw new DonationHttpError("Donation service is temporarily unavailable.", 503);
  }
  if (!data) throw new DonationHttpError("Too many requests. Please try again shortly.", 429);
}

export function getDonationMaxAmount(): number {
  const configured = Deno.env.get("DONATION_MAX_AMOUNT_USD");
  const maximum = configured ? Number(configured) : 1000;
  if (!Number.isFinite(maximum) || maximum < 1 || maximum > 10000) {
    throw new DonationHttpError("Donation limit is not configured correctly.", 500);
  }
  return Math.floor(maximum * 100) / 100;
}

export function parseDonationAmount(value: unknown): number {
  const source = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(source)) {
    throw new DonationHttpError("Enter a donation amount with no more than two decimal places.");
  }
  const amount = Number(source);
  const amountCents = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
    throw new DonationHttpError("The minimum donation is $1.00.");
  }
  if (amount > getDonationMaxAmount()) {
    throw new DonationHttpError(`The maximum donation is $${getDonationMaxAmount().toFixed(2)}.`);
  }
  return amountCents / 100;
}

function getPaypalConfig() {
  const configuredMode = (
    Deno.env.get("PAYPAL_DONATION_MODE")
    || Deno.env.get("PAYPAL_MODE")
    || Deno.env.get("PAYPAL_ENV")
    || "live"
  ).toLowerCase();
  let mode: "sandbox" | "live";
  if (["sandbox", "test"].includes(configuredMode)) {
    mode = "sandbox";
  } else if (["live", "production", "prod"].includes(configuredMode)) {
    mode = "live";
  } else {
    throw new DonationHttpError("PayPal mode must be sandbox, test, live, or production.", 500);
  }
  const donationClientId = Deno.env.get("PAYPAL_DONATION_CLIENT_ID");
  const donationClientSecret = Deno.env.get("PAYPAL_DONATION_CLIENT_SECRET");
  if (Boolean(donationClientId) !== Boolean(donationClientSecret)) {
    throw new DonationHttpError("PayPal donation credentials are incomplete.", 500);
  }
  const clientId = donationClientId || Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = donationClientSecret || Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new DonationHttpError("PayPal donation credentials are not configured.", 503);
  }
  return {
    clientId,
    clientSecret,
    baseUrl: mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com",
  };
}

export async function paypalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { clientId, clientSecret, baseUrl } = getPaypalConfig();
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenResponse.ok) {
    console.error("[paypal-donation] PayPal authentication failed:", tokenResponse.status);
    throw new DonationHttpError("PayPal is temporarily unavailable.", 502);
  }
  const { access_token: accessToken } = await tokenResponse.json();
  if (typeof accessToken !== "string" || !accessToken) {
    throw new DonationHttpError("PayPal is temporarily unavailable.", 502);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[paypal-donation] PayPal API request failed:", response.status, errorText.slice(0, 1000));
    throw new DonationHttpError("PayPal could not complete this request. Please try again.", 502);
  }
  return await response.json() as T;
}

export function isPayPalApprovalUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "www.paypal.com" || url.hostname === "www.sandbox.paypal.com")
      && url.pathname.startsWith("/checkoutnow");
  } catch {
    return false;
  }
}
