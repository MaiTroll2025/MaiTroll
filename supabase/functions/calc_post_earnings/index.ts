import { serve } from "https://deno.land/std/http/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const secret = Deno.env.get("CALC_POST_EARNINGS_SECRET") ?? Deno.env.get("MAI_CALENDAR_CRON_SECRET");
    const authorization = req.headers.get("authorization");
    if (!secret || secret.length < 32 || authorization !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { postId } = await req.json();

    // 1. Get engagement data
    const { data: engagement, error } = await supabaseClient.rpc("get_post_engagement", {
      post_id: postId
    });

    if (error) {
      console.error("Error getting engagement:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    const { views, comments, reactions } = engagement;

    // 2. Apply formula
    const earned = Math.floor(
      views * 0.1 + comments * 2 + reactions * 3
    );

    // 3. Update post earnings + credit user
    const { data: post, error: postError } = await supabaseClient
      .from("troll_posts")
      .select("user_id, free_coins_earned")
      .eq("id", postId)
      .single();

    if (postError) {
      console.error("Error getting post:", postError);
      return new Response(JSON.stringify({ error: postError.message }), { status: 400 });
    }

    // Update post earnings
    const { error: updateError } = await supabaseClient
      .from("troll_posts")
      .update({ free_coins_earned: earned })
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating post:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
    }

    // Credit user free coins
    const { error: creditError } = await supabaseClient.rpc("credit_free_coins", {
      target_user: post.user_id,
      amount: earned
    });

    if (creditError) {
      console.error("Error crediting coins:", creditError);
      return new Response(JSON.stringify({ error: creditError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ earned, views, comments, reactions }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});