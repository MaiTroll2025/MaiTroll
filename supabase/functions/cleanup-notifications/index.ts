import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete notifications older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: notificationsDeleted, error: notifError } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', sevenDaysAgo);

    if (notifError) {
      console.error('Error deleting notifications:', notifError);
    }

    const { count: jailDeleted, error: jailError } = await supabase
      .from('jail_notifications')
      .delete()
      .lt('created_at', sevenDaysAgo);

    if (jailError) {
      console.error('Error deleting jail_notifications:', jailError);
    }

    const totalDeleted = (notificationsDeleted || 0) + (jailDeleted || 0);

    console.log(`Cleanup complete: ${notificationsDeleted || 0} notifications, ${jailDeleted || 0} jail_notifications deleted`);

    return new Response(JSON.stringify({
      success: true,
      deleted: totalDeleted,
      notifications_deleted: notificationsDeleted || 0,
      jail_notifications_deleted: jailDeleted || 0,
      run_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});