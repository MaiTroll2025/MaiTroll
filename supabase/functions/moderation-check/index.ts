import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, content, context } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load active keywords
    const { data: keywords } = await supabase
      .from("moderation_keywords")
      .select("term")
      .eq("active", true);

    const terms = (keywords || []).map((k: any) => k.term.toLowerCase());
    const normalized = String(content || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const matched = terms.filter((t: string) => normalized.includes(t));

    if (matched.length === 0) {
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count prior offenses for escalation
    const { count } = await supabase
      .from("moderation_offenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id);

    const offenseNum = (count || 0) + 1;
    let action = "warning";
    if (offenseNum === 2) action = "jail_30m";
    else if (offenseNum === 3) action = "jail_7d";
    else if (offenseNum >= 4) action = "jail_3m";

    await supabase.from("moderation_offenses").insert({
      user_id,
      context,
      content,
      matched_terms: matched,
      offense_count: offenseNum,
      action_taken: action,
    });

    const messages: Record<string, string> = {
      warning: "Warning: your message violated chat rules and was not sent.",
      jail_30m: "You have been jailed for 30 minutes.",
      jail_7d: "You have been jailed for 7 days.",
      jail_3m: "You have been jailed for 3 months.",
    };

    return new Response(
      JSON.stringify({ allowed: false, action, message: messages[action], matched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});