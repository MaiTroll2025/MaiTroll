import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const receiverId = body.p_receiver_id;
    const streamId = body.p_stream_id ?? null;
    const giftId = body.p_gift_id;
    const quantity = body.p_quantity;
    const metadata = body.p_metadata ?? {};

    if (typeof receiverId !== "string" || !uuidPattern.test(receiverId)
      || (streamId !== null && (typeof streamId !== "string" || !uuidPattern.test(streamId)))
      || typeof giftId !== "string" || giftId.length === 0 || giftId.length > 128
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 20
      || metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
      return new Response(JSON.stringify({ success: false, message: "Invalid gift request" }), {
        status: 400,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    if (receiverId === user.id) {
      return new Response(JSON.stringify({ success: false, message: "Cannot send gifts to yourself" }), {
        status: 400,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("send_gift_in_stream", {
      p_sender_id: user.id,
      p_receiver_id: receiverId,
      p_stream_id: streamId,
      p_gift_id: giftId,
      p_quantity: quantity,
      p_metadata: metadata,
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-gift] Gift settlement failed", error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Gift settlement failed",
    }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
