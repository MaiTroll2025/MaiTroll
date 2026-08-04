// supabase/functions/_shared/supabaseClient.ts (EDGE FUNCTION CLIENT)
import { createClient } from "jsr:@supabase/supabase-js@2";

// For maitalent.fun promo redemption, we need to connect to Mai Troll DB
// where the promo_cards table exists. SB_URL/SB_SERVICE_ROLE_KEY are
// populated in maitalent project, but we can override for promo redemption.
const supabaseUrl = Deno.env.get("Mai Troll_DB_URL") || Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("Mai Troll_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Edge Functions use service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
