import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { dispatchPushNotification } from '../_shared/pushDelivery.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-notification-push-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  const expectedToken = Deno.env.get('NOTIFICATION_PUSH_DISPATCH_TOKEN');
  const suppliedToken = req.headers.get('x-notification-push-token') || '';
  if (!expectedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    const { notification_id: notificationId } = await req.json();
    if (
      typeof notificationId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)
    ) {
      return Response.json({ error: 'A valid notification_id is required' }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Notification push dispatcher is not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message, metadata, link')
      .eq('id', notificationId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load notification: ${error.message}`);
    }
    if (!notification) {
      return Response.json({ success: true, skipped: 'notification_not_found' }, { status: 200, headers: corsHeaders });
    }

    const metadata = notification.metadata && typeof notification.metadata === 'object'
      ? notification.metadata as Record<string, unknown>
      : {};
    const url = [metadata.action_url, metadata.route, notification.link]
      .find((candidate): candidate is string =>
        typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//'),
      ) || '/notifications';

    const result = await dispatchPushNotification(
      supabaseUrl,
      serviceRoleKey,
      [notification.user_id],
      {
        title: notification.title || 'MaiTroll notification',
        body: notification.message || '',
        type: notification.type || 'notification',
        url,
        data: { ...metadata, route: url, notification_id: notification.id },
      },
    );

    if (result.failed > 0 || result.sent === 0) {
      console.warn('[NotificationPush] Delivery incomplete', {
        notificationId,
        androidConfigured: result.android_configured,
        androidTokensFound: result.android_tokens_found,
        androidTokensEligible: result.android_tokens_eligible,
        androidSent: result.android_sent,
        androidFailed: result.android_failed,
        webSent: result.web_sent,
        webFailed: result.web_failed,
      });
    }

    return Response.json({
      success: result.failed === 0,
      android_sent: result.android_sent,
      android_failed: result.android_failed,
      android_tokens_found: result.android_tokens_found,
      android_tokens_eligible: result.android_tokens_eligible,
      web_sent: result.web_sent,
      web_failed: result.web_failed,
    }, { status: result.failed > 0 ? 207 : 200, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push dispatch failed';
    console.error('[NotificationPush] Dispatch failed:', message);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
