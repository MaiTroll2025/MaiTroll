import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface FridayRewardRequest {
  force?: boolean;
}

interface RewardResult {
  user_id: string;
  username: string;
  eligible: boolean;
  cashback_amount: number;
  status: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "secretary" && !profile.is_admin)) {
      throw new Error("Forbidden: Admin or Secretary role required");
    }

    const { force } = await req.json().catch(() => ({ force: false }));

    const today = new Date();
    const dayOfWeek = today.getDay();
    const isFriday = dayOfWeek === 5;

    if (!isFriday && !force) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Not Friday. Rewards are distributed on Fridays only.",
          today: today.toISOString(),
          dayOfWeek: dayOfWeek,
        }),
        { status: 200, headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
      );
    }

    const { data: configRate, error: rateError } = await supabaseClient
      .from("supporter_economy_config")
      .select("config_value")
      .eq("config_key", "weekly_cashback_rate")
      .single();

    if (rateError || !configRate) {
      throw new Error("Cashback rate config not found");
    }

    const cashbackRate = parseFloat(configRate.config_value);

    const { data: configMinCoins, error: minCoinsError } = await supabaseClient
      .from("supporter_economy_config")
      .select("config_value")
      .eq("config_key", "weekly_cashback_min_coins")
      .single();

    const minCoins = minCoinsError ? 100 : parseInt(configMinCoins?.config_value ?? "100");

    const { data: configMinGifts, error: minGiftsError } = await supabaseClient
      .from("supporter_economy_config")
      .select("config_value")
      .eq("config_key", "weekly_cashback_min_gifts")
      .single();

    const minGifts = minGiftsError ? 3 : parseInt(configMinGifts?.config_value ?? "3");

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 1) % 7) - 4);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const { data: openPeriods, error: periodError } = await supabaseClient
      .from("weekly_cashback_periods")
      .select("id, period_start, period_end")
      .gte("period_start", weekStart.toISOString())
      .lte("period_end", weekEnd.toISOString())
      .eq("status", "open");

    if (periodError) throw new Error(`Failed to find open period: ${periodError.message}`);

    if (!openPeriods || openPeriods.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No open cashback period found for this week", processed: 0 }),
        { status: 200, headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
      );
    }

    const periodId = openPeriods[0].id;
    const periodStart = openPeriods[0].period_start;
    const periodEnd = openPeriods[0].period_end;

    const { data: eligibleUsers, error: eligibleError } = await supabaseClient
      .from("weekly_cashback_eligible")
      .select("user_id, total_gifts, total_coins_spent, total_coins_back")
      .eq("period_id", periodId)
      .gte("total_gifts", minGifts)
      .gte("total_coins_spent", minCoins);

    if (eligibleError) throw new Error(`Failed to fetch eligible users: ${eligibleError.message}`);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      await supabaseClient
        .from("weekly_cashback_periods")
        .update({ status: "paid" })
        .eq("id", periodId);

      return new Response(
        JSON.stringify({ success: true, message: "No eligible users this week", processed: 0 }),
        { status: 200, headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
      );
    }

    const results: RewardResult[] = [];

    for (const eligible of eligibleUsers) {
      const cashbackAmount = Math.floor(eligible.total_coins_spent * cashbackRate);

      if (cashbackAmount <= 0) {
        results.push({
          user_id: eligible.user_id,
          username: "unknown",
          eligible: true,
          cashback_amount: 0,
          status: "skipped_zero",
        });
        continue;
      }

      const { data: userProfile, error: profileError } = await supabaseClient
        .from("user_profiles")
        .select("username")
        .eq("id", eligible.user_id)
        .maybeSingle();

      const username = !profileError && userProfile ? userProfile.username : "unknown";

      const { error: ledgerError } = await supabaseClient
        .from("coin_ledger")
        .insert({
          user_id: eligible.user_id,
          delta: cashbackAmount,
          bucket: "promo",
          source: "weekly_cashback",
          ref_id: periodId,
        });

      if (ledgerError) {
        results.push({
          user_id: eligible.user_id,
          username,
          eligible: true,
          cashback_amount: cashbackAmount,
          status: "ledger_error",
        });
        continue;
      }

      const { error: updateError } = await supabaseClient
        .from("user_profiles")
        .update({
          troll_coins: supabaseClient.raw(`COALESCE(troll_coins, 0) + ${cashbackAmount}`),
          total_earned_coins: supabaseClient.raw(`COALESCE(total_earned_coins, 0) + ${cashbackAmount}`),
        })
        .eq("id", eligible.user_id);

      if (updateError) {
        results.push({
          user_id: eligible.user_id,
          username,
          eligible: true,
          cashback_amount: cashbackAmount,
          status: "update_error",
        });
        continue;
      }

      await supabaseClient
        .from("weekly_cashback_payouts")
        .insert({
          user_id: eligible.user_id,
          period_id: periodId,
          eligible_id: eligible.id,
          amount: cashbackAmount,
          status: "paid",
          paid_at: new Date().toISOString(),
        });

      await supabaseClient
        .from("weekly_cashback_eligible")
        .update({
          cashback_amount: cashbackAmount,
          paid_at: new Date().toISOString(),
        })
        .eq("id", eligible.id);

      results.push({
        user_id: eligible.user_id,
        username,
        eligible: true,
        cashback_amount: cashbackAmount,
        status: "paid",
      });
    }

    await supabaseClient
      .from("weekly_cashback_periods")
      .update({ status: "paid", total_cashback_coins: results.reduce((sum, r) => sum + r.cashback_amount, 0) })
      .eq("id", periodId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} eligible users`,
        period_start: periodStart,
        period_end: periodEnd,
        cashback_rate: cashbackRate,
        results,
      }),
      { status: 200, headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Friday Rewards Processing Failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
    );
  }
});