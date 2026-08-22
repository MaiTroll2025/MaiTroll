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

// Notification categories (for future grouping)
const NOTIFICATION_CATEGORIES = {
  ACCOUNT_SECURITY: [
    'new_login_detected', 'password_changed', 'email_changed', 'profile_updated',
    'account_warning', 'account_restriction_started', 'account_restriction_expired',
    'jail_sentence_started', 'jail_release_reminder', 'jail_release_completed'
  ],
  BROADCAST_LIVE: [
    'someone_you_follow_went_live', 'your_stream_started', 'your_stream_ended',
    'stream_disconnected', 'invited_to_cohost', 'cohost_invite_accepted',
    'cohost_invite_declined', 'removed_from_cohost', 'broadofficer_assigned',
    'broadofficer_removed', 'chat_disabled', 'kicked_from_live', 'restricted_from_live',
    'live_received_report', 'live_ended_by_staff',
    'stage_pass_opened', 'stage_pass_requested', 'stage_pass_approved',
    'stage_pass_denied', 'stage_pass_removed', 'stage_pass_live_started',
    'stage_pass_live_ended'
  ],
  CHAT_SOCIAL: [
    'new_private_message', 'message_request_received', 'someone_replied',
    'someone_mentioned', 'someone_followed', 'friend_request_received',
    'request_accepted', 'utromail_received', 'paid_message_received',
    'paid_message_unlocked'
  ],
  GIFTS_COINS_WALLET: [
    'gift_received', 'gift_sent', 'large_gift_received', 'coin_purchase_success',
    'coin_purchase_failed', 'bonus_coins_added', 'daily_reward_available',
    'daily_reward_claimed', 'cashout_submitted', 'cashout_approved',
    'cashout_rejected', 'cashout_paid', 'cashout_hold_placed',
    'cashout_hold_removed', 'wallet_adjustment', 'refund_issued',
    'hype_coin_earned', 'hype_coin_daily_cap_reached', 'hype_coin_weekly_cap_reached',
    'hype_coins_converted', 'hype_coin_adjustment'
  ],
  COURT_JAIL: [
    'court_case_opened', 'added_to_case', 'court_hearing_scheduled',
    'hearing_starting_soon', 'judge_assigned', 'attorney_assigned',
    'evidence_submitted', 'verdict_issued', 'sentence_issued', 'fine_assigned',
    'fine_paid', 'license_suspension_started', 'license_suspension_ended',
    'appeal_submitted', 'appeal_decision',
    'jail_insurance_purchased', 'jail_insurance_expiring_soon',
    'jail_insurance_expired', 'get_out_of_jail_coin_won',
    'get_out_of_jail_coin_used', 'get_out_of_jail_coin_denied'
  ],
  AUCTIONS_MARKETPLACE: [
    'auction_starting_soon', 'seller_you_follow_auction', 'you_placed_bid',
    'you_were_outbid', 'you_won_auction', 'you_lost_auction', 'payment_required',
    'payment_confirmed', 'seller_shipped', 'tracking_added', 'order_delivered',
    'mystery_box_assigned', 'mystery_box_opened_live', 'dispute_opened',
    'dispute_resolved', 'seller_rating_received', 'buyer_rating_received'
  ],
  FAMILIES_NEIGHBORHOODS: [
    'family_invite_received', 'family_invite_accepted', 'family_role_changed',
    'family_xp_milestone', 'neighborhood_event_started', 'family_challenge_started',
    'family_challenge_completed'
  ],
  STORE_INVENTORY: [
    'purchase_successful', 'purchase_failed', 'item_unlocked',
    'entrance_effect_activated', 'theme_purchased', 'theme_equipped',
    'vip_perk_unlocked', 'subscription_renewed', 'subscription_expired'
  ]
};

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

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured, Web Push notifications will be skipped');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, user_ids, notification, options }: PushRequest = await req.json();

    if (!userId && !user_ids) {
      return new Response(JSON.stringify({ error: 'Missing userId or user_ids' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize to array
    const targetUserIds = userId ? [userId] : (user_ids || []);

    console.log('[Push] Request received for users:', targetUserIds);
    console.log('[Push] Notification:', JSON.stringify(notification, null, 2));

    // Check VAPID keys
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[Push] VAPID keys NOT configured - skipping Web Push');
      return new Response(JSON.stringify({ 
        success: true, 
        sent: 0,
        message: 'Skipped - VAPID keys missing' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Push] VAPID configured, proceeding with Web Push');

    // Send Web Push notifications if VAPID is configured
    if (vapidPublicKey && vapidPrivateKey) {
      const vapidDetails = {
        subject: 'mailto:admin@Mai Troll.com',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      };

      // Fetch push subscriptions for target users
      // Also join with user_profiles to respect push_notifications_enabled preference
      const { data: subscriptions, error: subsError } = await supabase
        .from('web_push_subscriptions')
        .select('*')
        .in('user_id', targetUserIds)
        .eq('is_active', true);

      if (subsError) {
        console.error('[Push] Error fetching subscriptions:', subsError);
      }

      console.log('[Push] Raw subscriptions found:', subscriptions?.length || 0, subscriptions?.map(s => ({ user_id: s.user_id, endpoint: s.endpoint.substring(0, 50) })));

      // Filter out users who have disabled push notifications
      let filteredSubscriptions = subscriptions || [];
      if (subscriptions && subscriptions.length > 0) {
        const userIdsToCheck = subscriptions.map(s => s.user_id);
        const { data: enabledUsers } = await supabase
          .from('user_profiles')
          .select('id, push_notifications_enabled, role, is_admin, is_troll_officer, is_lead_officer')
          .in('id', userIdsToCheck);
        
        console.log('[Push] User push_notifications_enabled status:', enabledUsers);
        
        const enabledUserIds = new Set(enabledUsers?.filter(u => u.push_notifications_enabled !== false).map(u => u.id) || []);
        filteredSubscriptions = subscriptions.filter(s => enabledUserIds.has(s.user_id));
        
        // Check online presence: skip push for online admins (they'll see in-app notifications)
        const onlineAdminIds = new Set(
          (enabledUsers || [])
            .filter(u => {
              const isAdmin = u.role === 'admin' || u.role === 'superadmin' || u.role === 'owner' ||
                u.role === 'ceo' || u.role === 'secretary' ||
                u.is_admin === true || u.is_troll_officer === true || u.is_lead_officer === true;
              return isAdmin;
            })
            .map(u => u.id)
        );
        
        if (onlineAdminIds.size > 0) {
          const { data: presenceData } = await supabase
            .from('user_presence')
            .select('user_id, is_online')
            .in('user_id', Array.from(onlineAdminIds));
          
          const onlineIds = new Set(
            (presenceData || []).filter(p => p.is_online).map(p => p.user_id)
          );
          
          console.log('[Push] Online admins (skipping push):', Array.from(onlineIds));
          
          filteredSubscriptions = filteredSubscriptions.filter(s => !onlineIds.has(s.user_id));
        }
        
        console.log('[Push] Filtered subscriptions (enabled users, excluding online admins):', filteredSubscriptions.length);
      }

      if (filteredSubscriptions.length > 0) {
        let successCount = 0;
        let failureCount = 0;
        const errors: any[] = [];

        // Build push payload
        const pushPayload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192.png',
          badge: notification.badge || '/icons/icon-72.png',
          image: notification.image,
          data: {
            url: notification.url || '/',
            type: notification.type,
            ...notification.data
          }
        });

        // Send to each subscription
        for (const sub of filteredSubscriptions) {
          console.log(`[Push] Attempting Web Push to user ${sub.user_id}, endpoint: ${sub.endpoint.substring(0, 80)}...`);
          try {
            const subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key
              }
            };

            await webPush.sendNotification(subscription, pushPayload, { vapidDetails });
            successCount++;
            console.log(`[Push] ✓ Success for user ${sub.user_id}`);

            // Log success
            const logResult = await supabase.from('push_notification_logs').insert({
              user_id: sub.user_id,
              notification_type: notification.type,
              title: notification.title,
              body: notification.body,
              sent_at: new Date().toISOString(),
              success_count: 1,
              failure_count: 0,
            });
            if (logResult.error) {
              console.warn('Failed to log push success:', logResult.error);
            }
          } catch (sendErr: any) {
            const errorDetail = {
              user_id: sub.user_id,
              endpoint: sub.endpoint.substring(0, 80),
              statusCode: sendErr?.statusCode,
              message: sendErr?.message,
              body: sendErr?.body,
              fullError: String(sendErr)
            };
            errors.push(errorDetail);
            console.error(`[Push] ✗ Failed for user ${sub.user_id}:`, errorDetail);
            failureCount++;

            // Log failure
            const failLogResult = await supabase.from('push_notification_logs').insert({
              user_id: sub.user_id,
              notification_type: notification.type,
              title: notification.title,
              body: notification.body,
              sent_at: new Date().toISOString(),
              success_count: 0,
              failure_count: 1,
            });
            if (failLogResult.error) {
              console.warn('Failed to log push failure:', failLogResult.error);
            }

            // If subscription is gone (410 Gone), remove it
            if (sendErr?.statusCode === 410 || sendErr?.body?.includes('expired')) {
              await supabase
                .from('web_push_subscriptions')
                .delete()
                .eq('id', sub.id);
              console.log(`[Push] Removed expired subscription for user ${sub.user_id}`);
            }
          }
        }

        console.log(`Web Push: ${successCount} sent, ${failureCount} failed`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          targeted_users: targetUserIds.length,
          subscriptions_found: filteredSubscriptions.length,
          subscriptions_enabled: filteredSubscriptions.length,
          sent: successCount,
          failed: failureCount,
          errors: failureCount > 0 ? errors : undefined,
          message: 'Push notification processing complete'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('No active push subscriptions found for target users');
      }
    } else {
      console.warn('Skipping Web Push: VAPID keys not configured');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sent: 0,
      message: 'Push notification processing complete'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface PushRequest {
  userId?: string;
  user_ids?: string[];
  notification: {
    title: string;
    body: string;
    type?: string;
    icon?: string;
    badge?: string;
    image?: string;
    url?: string;
    data?: Record<string, unknown>;
  };
  options?: {
    ttl?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  };
}