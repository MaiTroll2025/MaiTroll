import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { p_user_id, p_highlight_color } = body;

    if (!p_user_id || p_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Invalid user ID" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!p_highlight_color || typeof p_highlight_color !== 'string') {
      return new Response(JSON.stringify({ error: "Invalid highlight color" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const PERK_ID = "perk_highlighted_chat";
    const COST = 50;

    const { data: existingPerk, error: perkError } = await supabase
      .from("user_perks")
      .select("*")
      .eq("user_id", p_user_id)
      .eq("perk_id", PERK_ID)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (perkError) {
      return new Response(JSON.stringify({ error: "Failed to check existing perk", details: perkError.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (existingPerk) {
      await supabase
        .from("user_perks")
        .update({ metadata: { ...existingPerk.metadata, highlight_color: p_highlight_color } })
        .eq("id", existingPerk.id);

      return new Response(JSON.stringify({ success: true, message: "Color updated", perk_id: existingPerk.id }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { data: payResult, error: payError } = await supabase.rpc('try_pay_coins_secure', {
      p_amount: COST,
      p_reason: 'perk_purchase',
      p_metadata: { perk_id: PERK_ID, perk_name: 'Highlighted Chat' }
    });

    if (payError || !payResult) {
      return new Response(JSON.stringify({ success: false, error: "Insufficient Troll Coins or payment failed" }), {
        status: 402,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: newPerk, error: insertError } = await supabase
      .from("user_perks")
      .insert({
        user_id: p_user_id,
        perk_id: PERK_ID,
        is_active: true,
        expires_at: expiresAt,
        metadata: { highlight_color: p_highlight_color },
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to activate perk", details: insertError.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      perk_id: newPerk.id,
      expires_at: expiresAt,
      cost: COST,
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
