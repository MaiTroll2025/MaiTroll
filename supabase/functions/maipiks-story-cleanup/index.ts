import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/*
 * MAI Piks story expiry.
 *
 * Stories live for 24h, but pg_cron is not enabled on this project so the
 * `maipiks_purge_expired_stories` job scheduled in
 * 20290904000002_maipiks_stories_v2.sql never ran. This function calls that
 * purge directly with the service role key, so the 24h hard delete actually
 * happens for every user instead of only the caller (who self-heals from the
 * app via `maipiks_purge_own_expired_stories`).
 *
 * Schedule it from Supabase Dashboard -> Database -> Cron Jobs, e.g. every
 * 5 minutes:
 *   SELECT net.http_post(
 *     url := '<SUPABASE_URL>/functions/v1/maipiks-story-cleanup',
 *     headers := jsonb_build_object(
 *       'Content-Type', 'application/json',
 *       'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
 *     ),
 *     body := '{}'::jsonb
 *   );
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('maipiks_purge_expired_stories');

    if (error) {
      console.error('maipiks_purge_expired_stories failed:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('MAI Piks story purge complete:', JSON.stringify(data));

    return new Response(JSON.stringify({ success: true, ...(data ?? {}) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('MAI Piks story cleanup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});