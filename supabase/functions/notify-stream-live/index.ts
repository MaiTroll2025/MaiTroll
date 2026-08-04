import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webPush from 'https://esm.sh/web-push@3.6.7';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

// Admin roles that should receive stream notifications
const ADMIN_ROLES = new Set([
  'admin',
  'superadmin',
  'owner',
  'ceo',
  'lead_troll_officer',
  'troll_officer',
  'moderator',
  'staff',
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

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );

    // Get the streamer's profile
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

    // Get the stream details
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

    // Get admin push subscriptions
    const { data: adminSubscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, user_profiles(role)')
      .eq('user_profiles.role', 'admin') // This won't work with join, let's use a different approach
      .not('endpoint', 'is', null);

    // Get all admin users with push subscriptions
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

    // Get push subscriptions for admin users
    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', adminUserIds)
      .not('endpoint', 'is', null);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admin push subscriptions found', notificationsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also create in-app admin notifications
    const streamerName = streamerProfile.display_name || streamerProfile.username || 'A user';
    const streamTitle = stream.title || 'Untitled Stream';

    const adminNotifications = adminUserIds.map(adminId => ({
      user_id: adminId,
      type: 'stream_live',
      title: '🔴 Stream Started',
      message: `${streamerName} started streaming: "${streamTitle}"`,
      metadata: {
        stream_id: streamId,
        streamer_id: userId,
        streamer_name: streamerName,
        stream_title: streamTitle,
        category,
      },
      is_read: false,
    }));

    // Insert in-app notifications
    await supabaseAdmin
      .from('admin_notifications')
      .insert(adminNotifications);

    // Send push notifications
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (vapidPublicKey && vapidPrivateKey) {
      webPush.setVapidDetails(
        'mailto:admin@Mai Troll.com',
        vapidPublicKey,
        vapidPrivateKey
      );

      const pushPayload = JSON.stringify({
        title: '🔴 Stream Started',
        body: `${streamerName} is now live: "${streamTitle}"`,
        icon: streamerProfile.avatar_url || '/icon-192x192.png',
        badge: '/badge-72x72.png',
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

      let sentCount = 0;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            pushPayload
          );
          sentCount++;
        } catch (err: any) {
          errors.push(`Failed for ${sub.user_id}: ${err.message}`);
          // Remove invalid subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
        }
      }

      // Log the notification
      await supabaseAdmin
        .from('push_notification_logs')
        .insert({
          notification_type: 'stream_live',
          target_count: subscriptions.length,
          success_count: sentCount,
          failed_count: subscriptions.length - sentCount,
          metadata: { streamId, userId, errors },
        });

      return new Response(
        JSON.stringify({
          success: true,
          notificationsSent: sentCount,
          notificationsFailed: subscriptions.length - sentCount,
          message: `Push notifications sent to ${sentCount} admins`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No VAPID keys configured, but in-app notifications were created
    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: 0,
        inAppNotificationsCreated: adminNotifications.length,
        message: 'In-app admin notifications created (push not configured)',
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
