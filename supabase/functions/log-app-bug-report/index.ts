import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return withCors(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405 }
    );
  }

  try {
    const payload = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("log_app_bug_report", {
      payload,
    });

    if (error) {
      console.error("log_app_bug_report error:", error);
      return withCors(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    return withCors(JSON.stringify(data));
  } catch (err: any) {
    console.error("log-app-bug-report error:", err);
    return withCors(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500 }
    );
  }
});