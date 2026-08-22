import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webPush from 'https://esm.sh/web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

const ADMIN_ROLES = new Set([
  'admin', 'superadmin', 'owner', 'ceo', 'lead_troll_officer',
  'troll_officer', 'moderator', 'staff', 'secretary',
  'executive_secretary', 'troll_city_secretary', 'agency_hr',
  'agency_hr_manager', 'agency_leader', 'ceo_assistant', 'noah_assistant',
  'hr_admin', 'marketing_readonly', 'academy_director'
]);

interface AdminEventPayload {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  targetRoles?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate' }
    });
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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured: missing Supabase credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { type, title, message, metadata = {}, targetRoles }: AdminEventPayload = await req.json();

    if (!type || !title || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, title, message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rolesToNotify = targetRoles && targetRoles.length > 0
      ? targetRoles
      : Array.from(ADMIN_ROLES);

    const { data: adminUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, is_admin, is_troll_officer, is_lead_officer')
      .or(`role.in.(${rolesToNotify.map(r => `"${r}"`).join(',')}),is_admin.eq.true,is_troll_officer.eq.true,is_lead_officer.eq.true`);

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admin users found', notificationsCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = adminUsers.map(u => u.id);

    // Create in-app notifications for all admins
    const createPromises = adminUserIds.map(adminId =>
      supabaseAdmin.rpc('create_notification', {
        p_user_id: adminId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_metadata: metadata
      })
    );

    await Promise.allSettled(createPromises);

    let pushSent = 0;
    let pushSkipped = 0;
    let pushFailed = 0;

    // Send push notifications if VAPID is configured
    if (vapidPublicKey && vapidPrivateKey) {
      const vapidDetails = {
        subject: 'mailto:admin@Mai Troll.com',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      };

      // Check which admins are online
      const { data: presenceData } = await supabaseAdmin
        .from('user_presence')
        .select('user_id, is_online')
        .in('user_id', adminUserIds);

      const onlineAdminIds = new Set(
        (presenceData || []).filter(p => p.is_online).map(p => p.user_id)
      );

      // Get push subscriptions for offline admins only
      const offlineAdminIds = adminUserIds.filter(id => !onlineAdminIds.has(id));

      if (offlineAdminIds.length > 0) {
        const { data: subscriptions } = await supabaseAdmin
          .from('web_push_subscriptions')
          .select('id, user_id, endpoint, p256dh_key, auth_key, is_active')
          .in('user_id', offlineAdminIds)
          .eq('is_active', true);

        if (subscriptions && subscriptions.length > 0) {
          const pushPayload = JSON.stringify({
            title,
            body: message,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            data: {
              type,
              url: metadata?.action_url || '/admin',
              ...metadata
            }
          });

          for (const sub of subscriptions) {
            try {
              await webPush.sendNotification({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh_key,
                  auth: sub.auth_key,
                }
              }, pushPayload, { vapidDetails });
              pushSent++;
            } catch (err: any) {
              pushFailed++;
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabaseAdmin
                  .from('web_push_subscriptions')
                  .delete()
                  .eq('id', sub.id);
              }
            }
          }
        }
      }

      pushSkipped = onlineAdminIds.size;
    }

    // Log the notification
    await supabaseAdmin.from('push_notification_logs').insert({
      notification_type: type,
      target_count: adminUserIds.length,
      success_count: pushSent,
      failure_count: pushFailed,
      metadata: { skipped_online: pushSkipped, ...metadata }
    });

    return new Response(JSON.stringify({
      success: true,
      notificationsCreated: adminUserIds.length,
      pushSent,
      pushSkipped,
      pushFailed,
      message: `Admin notifications created: ${adminUserIds.length} in-app, ${pushSent} push sent, ${pushSkipped} skipped (online)`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[notify-admin-event] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
