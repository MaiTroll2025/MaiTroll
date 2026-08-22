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
  'executive_secretary', 'troll_city_secretary'
]);

interface StreamLivePayload {
  streamId: string;
  userId: string;
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate' }
    });
  }

  try {
    const body = await req.json() as StreamLivePayload;
    const { streamId, userId, category = 'general' } = body;

    if (!streamId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: streamId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: streamerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!streamerProfile) {
      return new Response(
        JSON.stringify({ error: 'Streamer profile not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: stream } = await supabaseAdmin
      .from('streams')
      .select('id, title, category, status, is_live')
      .eq('id', streamId)
      .maybeSingle();

    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role')
      .in('role', Array.from(ADMIN_ROLES));

    if (!adminUsers || adminUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admin users found', notificationsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = adminUsers.map(u => u.id);
    const streamerName = streamerProfile.display_name || streamerProfile.username || 'A user';
    const streamTitle = stream.title || 'Untitled Stream';

    const createPromises = adminUserIds.map(adminId =>
      supabaseAdmin.rpc('create_notification', {
        p_user_id: adminId,
        p_type: 'stream_live',
        p_title: '🔴 Stream Started',
        p_message: `${streamerName} started streaming: "${streamTitle}"`,
        p_metadata: {
          stream_id: streamId,
          streamer_id: userId,
          streamer_name: streamerName,
          stream_title: streamTitle,
          category,
        }
      })
    );

    await Promise.allSettled(createPromises);

    if (vapidPublicKey && vapidPrivateKey) {
      const vapidDetails = {
        subject: 'mailto:admin@Mai Troll.com',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      };

      const { data: subscriptions } = await supabaseAdmin
        .from('web_push_subscriptions')
        .select('id, user_id, endpoint, p256dh_key, auth_key, is_active')
        .in('user_id', adminUserIds)
        .eq('is_active', true);

      if (subscriptions && subscriptions.length > 0) {
        // Check which admins are online - skip push for online admins
        const { data: presenceData } = await supabaseAdmin
          .from('user_presence')
          .select('user_id, is_online')
          .in('user_id', adminUserIds);

        const onlineAdminIds = new Set(
          (presenceData || []).filter(p => p.is_online).map(p => p.user_id)
        );

        const pushSubscriptions = subscriptions.filter(s => !onlineAdminIds.has(s.user_id));

        if (pushSubscriptions.length > 0) {
          const pushPayload = JSON.stringify({
            title: '🔴 Stream Started',
            body: `${streamerName} is now live: "${streamTitle}"`,
            icon: streamerProfile.avatar_url || '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: `stream-live-${streamId}`,
            data: {
              streamId,
              userId,
              url: `/broadcast/${streamId}`,
            },
            actions: [
              { action: 'view', title: 'View Stream' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          });

          let successCount = 0;
          let failureCount = 0;

          for (const sub of pushSubscriptions) {
            try {
              await webPush.sendNotification({
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh_key,
                  auth: sub.auth_key,
                }
              }, pushPayload, { vapidDetails });
              successCount++;
            } catch (err: any) {
              failureCount++;
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabaseAdmin
                  .from('web_push_subscriptions')
                  .delete()
                  .eq('id', sub.id);
              }
            }
          }

          await supabaseAdmin.from('push_notification_logs').insert({
            notification_type: 'stream_live',
            target_count: pushSubscriptions.length,
            success_count: successCount,
            failed_count: failureCount,
            metadata: { streamId, userId, skipped_online: onlineAdminIds.size },
          });

          return new Response(
            JSON.stringify({
              success: true,
              notificationsSent: successCount,
              notificationsFailed: failureCount,
              inAppNotificationsCreated: adminUserIds.length,
              skippedOnline: onlineAdminIds.size,
              message: 'In-app + push notifications sent for stream start',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: 0,
        inAppNotificationsCreated: adminUserIds.length,
        message: 'In-app admin notifications created',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[notify-stream-live] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
