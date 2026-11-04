import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate'
      }
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

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, troll_role, is_admin')
      .eq('id', userData.user.id)
      .single();

    const allowedRoles = ['admin', 'ceo', 'superadmin', 'tcnn_news_caster', 'tcnn_chief_news_caster'];
    const canPublish =
      profile?.is_admin === true ||
      allowedRoles.includes(String(profile?.role || '').toLowerCase()) ||
      allowedRoles.includes(String(profile?.troll_role || '').toLowerCase());
    if (!canPublish) {
      return new Response(JSON.stringify({ error: 'Ticker publishing permission required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { title, message, type: notifType = 'announcement', icon, original_type, category, url } = await req.json();

    if (!title || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: title, message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch target user IDs (announcements enabled OR null, AND push notifications enabled OR null)
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .or('announcements_enabled.eq.true,announcements_enabled.is.null')
      .or('push_notifications_enabled.eq.true,push_notifications_enabled.is.null');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userIds = users?.map((u: any) => u.id) || [];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No users to notify' }), {
        status: 200,
        headers
      });
    }

    // Prepare notifications for bulk insert
    const now = new Date().toISOString();
    const notifications = userIds.map((uid: string) => ({
      user_id: uid,
      type: notifType,
      title,
      message,
      metadata: {
        icon,
        original_type,
        category,
        url,
        source: 'global_ticker'
      },
      is_read: false,
      created_at: now,
    }));

    // Bulk insert in-app notifications via RPC
    const { error: rpcError } = await supabase.rpc('bulk_create_notifications', {
      p_notifications: JSON.stringify(notifications),
    });

    if (rpcError) {
      console.error('Bulk insert error, falling back to direct batch insert:', rpcError);
      // Fallback: direct insert in batches
      const BATCH_SIZE = 500;
      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await supabase.from('notifications').insert(batch);
        if (insertErr) {
          console.error('Batch insert error:', insertErr);
        }
      }
    }

    // Also invoke the push-notifications Edge Function to send Web Push
    try {
      console.log('[TickerNotify] Invoking push-notifications Edge Function...');
      const result = await supabase.functions.invoke('push-notifications', {
        body: {
          user_ids: userIds,
          notification: {
            title,
            body: message,
            type: notifType,
            icon: icon || (original_type === 'tcnn_breaking' ? 'alert' : 'newspaper'),
            url: url || '/',
            data: {
              original_type: original_type || 'tcnn_live',
              category: category || 'ticker_message',
              source: 'global_ticker'
            }
          },
          options: { ttl: 86400, urgency: 'high' }
        }
      });
      console.log('[TickerNotify] push-notifications result:', JSON.stringify(result, null, 2));
    } catch (pushErr: any) {
      console.warn('[TickerNotify] Failed to send Web Push for ticker:', pushErr);
      // Don't throw - push failure shouldn't break the ticker
    }

    return new Response(JSON.stringify({ success: true, sent: userIds.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('global-ticker-notify error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
