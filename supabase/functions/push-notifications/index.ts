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

interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedFcmAccessToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodePemPrivateKey(privateKey: string): Uint8Array {
  const pem = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  return Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
}

async function getFcmAccessToken(account: FcmServiceAccount): Promise<string> {
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedFcmAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${claims}`;
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    decodePemPrivateKey(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') {
    throw new Error(`FCM OAuth token request failed (${response.status})`);
  }

  cachedFcmAccessToken = {
    token: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
  };
  return cachedFcmAccessToken.token;
}

function fcmData(notification: PushRequest['notification']): Record<string, string> {
  const data: Record<string, string> = {};
  let payloadBytes = 0;
  for (const [key, value] of Object.entries(notification.data || {})) {
    if (value !== undefined && value !== null) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
      const entryBytes = new TextEncoder().encode(key).length + new TextEncoder().encode(serialized).length;
      if (payloadBytes + entryBytes <= 2500) {
        data[key] = serialized;
        payloadBytes += entryBytes;
      }
    }
  }
  data.route = String(notification.data?.route || notification.url || '/').slice(0, 500);
  data.type = String(notification.type || 'notification').slice(0, 80);
  return data;
}

async function authorizePushRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  serviceRoleKey: string,
  targetUserIds: string[],
  notification: PushRequest['notification'],
): Promise<{ authorized: boolean; status: number; message: string; targetUserIds: string[] }> {
  const authorization = req.headers.get('Authorization') || '';
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!bearerToken) {
    return { authorized: false, status: 401, message: 'Unauthorized', targetUserIds: [] };
  }

  if (bearerToken === serviceRoleKey) {
    return { authorized: true, status: 200, message: 'Authorized', targetUserIds };
  }

  // Supabase gateway validates the JWT signature before the request reaches this
  // function (verify_jwt is enabled). Service-role JWTs are not user sessions,
  // so auth.getUser() rejects them even though their signed role claim is valid.
  try {
    const payload = bearerToken.split('.')[1];
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
    const claims = JSON.parse(decodedPayload);
    if (claims.role === 'service_role') {
      return { authorized: true, status: 200, message: 'Authorized', targetUserIds };
    }
  } catch {
    // Continue with normal user-session validation for non-JWT or malformed tokens.
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(bearerToken);
  if (userError || !userData.user) {
    return { authorized: false, status: 401, message: 'Unauthorized', targetUserIds: [] };
  }

  const recentSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: rows, error: notificationError } = await supabase
    .from('notifications')
    .select('user_id, type, title, message')
    .in('user_id', targetUserIds)
    .gte('created_at', recentSince)
    .limit(5000);

  if (notificationError) {
    throw new Error(`Failed to validate notification recipients: ${notificationError.message}`);
  }

  const matchingTargets = new Set(
    (rows || [])
      .filter((row) =>
        String(row.type || '').toLowerCase() === String(notification.type || '').toLowerCase()
        && row.title === notification.title
        && row.message === notification.body,
      )
      .map((row) => row.user_id),
  );
  const authorizedTargets = targetUserIds.filter((id) => matchingTargets.has(id));
  if (authorizedTargets.length === 0) {
    return {
      authorized: false,
      status: 403,
      message: 'No matching recent notification exists for the requested recipient',
      targetUserIds: [],
    };
  }

  return { authorized: true, status: 200, message: 'Authorized', targetUserIds: authorizedTargets };
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
    const fcmServiceAccountValue = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    const fcmProjectId = Deno.env.get('FCM_PROJECT_ID');
    const fcmClientEmail = Deno.env.get('FCM_CLIENT_EMAIL');
    const fcmPrivateKey = Deno.env.get('FCM_PRIVATE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured: missing Supabase credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, user_ids, notification, options, platforms: requestedPlatforms }: PushRequest = await req.json();
    const platforms = requestedPlatforms || ['android', 'web'];
    if (
      !Array.isArray(platforms)
      || platforms.length === 0
      || platforms.some((platform) => platform !== 'android' && platform !== 'web')
    ) {
      return new Response(JSON.stringify({ error: 'Platforms must contain android and/or web' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (
      (!userId && !Array.isArray(user_ids))
      || typeof notification?.title !== 'string'
      || !notification.title.trim()
      || typeof notification?.body !== 'string'
      || !notification.body.trim()
    ) {
      return new Response(JSON.stringify({ error: 'Missing target users or notification title/body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize and bound client-supplied recipient lists.
    const requestedUserIds = [...new Set(userId ? [userId] : (user_ids || []))];
    const isUuid = (value: unknown): value is string =>
      typeof value === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    if (
      requestedUserIds.length === 0
      || requestedUserIds.length > 1000
      || requestedUserIds.some((id) => !isUuid(id))
    ) {
      return new Response(JSON.stringify({ error: 'Recipient list must contain 1 to 1000 valid user IDs' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authorization = await authorizePushRequest(
      req,
      supabase,
      supabaseServiceKey,
      requestedUserIds,
      notification,
    );
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: authorization.message }), {
        status: authorization.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const targetUserIds = authorization.targetUserIds;

    console.log('[Push] Request received for', targetUserIds.length, 'users');

    let webSent = 0;
    let webFailed = 0;
    let nativeSent = 0;
    let nativeFailed = 0;
    const errors: Array<{ platform: string; status?: number; message: string }> = [];

    if (platforms.includes('android') && (fcmServiceAccountValue || (fcmProjectId && fcmClientEmail && fcmPrivateKey))) {
      try {
        let fcmAccount: FcmServiceAccount;
        if (fcmProjectId && fcmClientEmail && fcmPrivateKey) {
          fcmAccount = {
            project_id: fcmProjectId,
            client_email: fcmClientEmail,
            private_key: fcmPrivateKey,
          };
        } else if (fcmServiceAccountValue) {
          try {
            fcmAccount = JSON.parse(fcmServiceAccountValue);
          } catch {
            throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
          }
        } else {
          throw new Error('FCM credentials are incomplete');
        }
        if (!fcmAccount.project_id || !fcmAccount.client_email || !fcmAccount.private_key) {
          throw new Error('FCM service account is missing required fields');
        }

        const { data: nativeTokens, error: tokenError } = await supabase
          .from('native_push_tokens')
          .select('id, user_id, token')
          .in('user_id', targetUserIds)
          .eq('platform', 'android')
          .eq('is_active', true);
        if (tokenError) {
          throw new Error(`Failed to load Android push tokens: ${tokenError.message}`);
        }

        if (nativeTokens?.length) {
          const targetIdsWithTokens = [...new Set(nativeTokens.map((item) => item.user_id))];
          const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, push_notifications_enabled')
            .in('id', targetIdsWithTokens);
          if (profileError) {
            throw new Error(`Failed to load Android push preferences: ${profileError.message}`);
          }
          const enabledIds = new Set(
            (profiles || [])
              .filter((profile) => profile.push_notifications_enabled !== false)
              .map((profile) => profile.id),
          );
          const eligibleTokens = nativeTokens.filter((item) => enabledIds.has(item.user_id));

          if (eligibleTokens.length) {
            const accessToken = await getFcmAccessToken(fcmAccount);
            const data = fcmData(notification);
            for (const device of eligibleTokens) {
              try {
                const response = await fetch(
                  `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(fcmAccount.project_id)}/messages:send`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      message: {
                        token: device.token,
                        notification: {
                          title: notification.title,
                          body: notification.body,
                          ...(notification.image && /^https:\/\//i.test(notification.image)
                            ? { image: notification.image }
                            : {}),
                        },
                        data,
                        android: {
                          priority: options?.urgency === 'high' ? 'HIGH' : 'NORMAL',
                          notification: {
                            channel_id: 'default_v2',
                            sound: 'notification',
                          },
                        },
                      },
                    }),
                  },
                );

                if (response.ok) {
                  nativeSent += 1;
                  continue;
                }

                const responseBody = await response.json().catch(() => ({}));
                const fcmError = responseBody?.error;
                const fcmStatus = typeof fcmError?.status === 'string' ? fcmError.status : '';
                nativeFailed += 1;
                errors.push({
                  platform: 'android',
                  status: response.status,
                  message: fcmStatus || 'FCM send failed',
                });
                console.error('[Push] Android FCM delivery failed:', response.status, fcmStatus || 'unknown');

                if (fcmStatus === 'UNREGISTERED') {
                  const { error: deactivateError } = await supabase
                    .from('native_push_tokens')
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq('id', device.id);
                  if (deactivateError) {
                    console.error('[Push] Failed to deactivate invalid Android token:', deactivateError.message);
                  }
                }
              } catch (sendError) {
                nativeFailed += 1;
                errors.push({
                  platform: 'android',
                  message: sendError instanceof Error ? sendError.message : 'FCM send failed',
                });
                console.error('[Push] Android FCM request failed:', sendError);
              }
            }
          }
        }
      } catch (nativeSetupError) {
        nativeFailed += 1;
        errors.push({
          platform: 'android',
          message: nativeSetupError instanceof Error ? nativeSetupError.message : 'FCM setup failed',
        });
        console.error('[Push] Android FCM setup failed:', nativeSetupError);
      }
    } else if (platforms.includes('android')) {
      console.warn('[Push] FCM credentials are not fully configured; Android push is skipped');
    }

    // Send Web Push notifications if VAPID is configured
    if (platforms.includes('web') && vapidPublicKey && vapidPrivateKey) {
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

      console.log('[Push] Web push subscriptions found:', subscriptions?.length || 0);

      // Filter out users who have disabled push notifications
      let filteredSubscriptions = subscriptions || [];
      if (subscriptions && subscriptions.length > 0) {
        const userIdsToCheck = subscriptions.map(s => s.user_id);
        const { data: enabledUsers } = await supabase
          .from('user_profiles')
          .select('id, push_notifications_enabled, role, is_admin, is_troll_officer, is_lead_officer')
          .in('id', userIdsToCheck);
        
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
          
          filteredSubscriptions = filteredSubscriptions.filter(s => !onlineIds.has(s.user_id));
        }
        
        console.log('[Push] Eligible web push subscriptions:', filteredSubscriptions.length);
      }

      if (filteredSubscriptions.length > 0) {
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
          try {
            const subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key
              }
            };

            await webPush.sendNotification(subscription, pushPayload, { vapidDetails });
            webSent++;

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
            webFailed++;
            errors.push({
              platform: 'web',
              status: sendErr?.statusCode,
              message: sendErr?.message || 'Web Push delivery failed',
            });
            console.error('[Push] Web Push delivery failed:', sendErr?.statusCode, sendErr?.message);

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
      } else {
        console.log('No active push subscriptions found for target users');
      }
    } else if (platforms.includes('web')) {
      console.warn('Skipping Web Push: VAPID keys not configured');
    }

    return new Response(JSON.stringify({
      success: webFailed + nativeFailed === 0,
      targeted_users: targetUserIds.length,
      android_configured: Boolean(
        fcmServiceAccountValue || (fcmProjectId && fcmClientEmail && fcmPrivateKey),
      ),
      web_configured: Boolean(vapidPublicKey && vapidPrivateKey),
      web_sent: webSent,
      web_failed: webFailed,
      android_sent: nativeSent,
      android_failed: nativeFailed,
      sent: webSent + nativeSent,
      failed: webFailed + nativeFailed,
      errors: errors.length > 0 ? errors : undefined,
      message: 'Push notification processing complete'
    }), {
      status: webFailed + nativeFailed > 0 ? 207 : 200,
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
  platforms?: Array<'android' | 'web'>;
}