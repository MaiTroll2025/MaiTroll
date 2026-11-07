import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedOrigins = new Set([
  "https://maitroll.com",
  "https://www.maitroll.com",
  "https://maitalent.fun",
  "https://www.maitalent.fun",
  "http://localhost:5173",
  "http://localhost:5178",
  "http://localhost:5179",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://maitroll.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing Supabase environment variables");

    const authorization = req.headers.get("Authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(url, serviceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const targetUserId = body.userId;
    const amount = body.amount;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (typeof targetUserId !== "string" || !uuidPattern.test(targetUserId)
      || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000
      || reason.length === 0 || reason.length > 500) {
      return new Response(JSON.stringify({ success: false, error: "Invalid grant request" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: actor, error: actorError } = await supabase
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer")
      .eq("id", user.id)
      .single();
    if (actorError) throw actorError;
    if (!actor || !(actor.role === "admin" || actor.role === "lead_troll_officer"
      || actor.is_admin === true || actor.is_lead_officer === true)) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: target, error: targetError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return new Response(JSON.stringify({ success: false, error: "Target user not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: credit, error: creditError } = await supabase.rpc("troll_bank_credit_coins", {
      p_user_id: targetUserId,
      p_coins: amount,
      p_bucket: "paid",
      p_source: "admin_grant",
      p_ref_id: null,
      p_metadata: { admin_id: user.id, reason },
    });
    if (creditError) throw creditError;

    const { error: transactionError } = await supabase.from("coin_transactions").insert({
      user_id: targetUserId,
      type: "admin_grant",
      amount,
      description: reason,
      metadata: { admin_id: user.id, source: "grant_coins_panel" },
    });
    if (transactionError) throw transactionError;

    const { error: auditError } = await supabase.from("admin_actions_log").insert({
      admin_user_id: user.id,
      target_user_id: targetUserId,
      action_type: "grant_coins",
      reason,
      metadata: { amount, source: "coin-admin" },
    });
    if (auditError) throw auditError;

    const { data: updatedTarget, error: balanceError } = await supabase
      .from("user_profiles")
      .select("troll_coins")
      .eq("id", targetUserId)
      .single();
    if (balanceError) throw balanceError;

    return new Response(JSON.stringify({
      success: true,
      newBalance: updatedTarget.troll_coins,
      credited: credit?.user_gets ?? amount,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[coin-admin] Coin grant failed", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Coin grant failed",
    }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
