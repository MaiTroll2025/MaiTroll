import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REMINDERS: Array<{
  type: string;
  label: string;
  offsetMs: number;
  title: (eventTitle: string) => string;
  body: (eventTitle: string, localTime: string) => string;
}> = [
  {
    type: 'event_reminder_7d',
    label: '7 days',
    offsetMs: 7 * 24 * 60 * 60 * 1000,
    title: (t) => `📅 ${t} — in 7 days`,
    body: (t, lt) => `${t} starts on ${lt}. Join the MaiTroll community event.`,
  },
  {
    type: 'event_reminder_24h',
    label: '24 hours',
    offsetMs: 24 * 60 * 60 * 1000,
    title: (t) => `⏰ ${t} — tomorrow`,
    body: (t, lt) => `${t} starts on ${lt}. Don't miss it.`,
  },
  {
    type: 'event_reminder_30m',
    label: '30 minutes',
    offsetMs: 30 * 60 * 1000,
    title: (t) => `🔴 ${t} — starting soon`,
    body: (t, lt) => `${t} starts at ${lt}. Join live now.`,
  },
];

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
  const schedulerSecret = Deno.env.get('MAI_CALENDAR_CRON_SECRET');

  if (!supabaseUrl || !supabaseServiceKey || !schedulerSecret || schedulerSecret.length < 32) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (req.headers.get('authorization') !== 'Bearer ' + schedulerSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Service-role client: privileged backend. Bypasses RLS for reminder dispatch.
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  // Processing window: reminders due within the last/next 90 minutes so a
  // delayed cron still fires each reminder once (idempotency prevents dupes).
  const windowMs = 90 * 60 * 1000;
  const eventWindowStart = new Date(
    now.getTime() - windowMs + 30 * 60 * 1000,
  ).toISOString();
  const eventWindowEnd = new Date(
    now.getTime() + windowMs + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let eventsProcessed = 0;
  let deliveriesClaimed = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  try {
    // Include events far enough out for the 7-day reminder and filter each
    // reminder target to the processing window below.
    const { data: events, error: eventsError } = await supabase
      .from('mai_calendar_events')
      .select('id, slug, title, description, starts_at, ends_at, timezone, location, stream_url, status, visibility')
      .eq('visibility', 'public')
      .in('status', ['upcoming', 'live'])
      .gte('starts_at', eventWindowStart)
      .lte('starts_at', eventWindowEnd)
      .order('starts_at', { ascending: true });

    if (eventsError) throw eventsError;
    const eventList = events || [];

    // Fetch eligible registered recipients: active, non-banned profiles.
    const { data: recipients, error: recipientsError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .neq('is_banned', true)
      .is('account_state', null)
      .order('id', { ascending: true });

    if (recipientsError) throw recipientsError;
    const recipientList = recipients || [];

    // For each event, evaluate each reminder type.
    for (const event of eventList) {
      const eventStart = new Date(event.starts_at).getTime();
      if (Number.isNaN(eventStart)) continue;

      eventsProcessed += 1;

      for (const reminder of REMINDERS) {
        const targetSendAt = new Date(eventStart - reminder.offsetMs);
        // Only send if the reminder target is within the processing window
        // and hasn't already passed by more than the window (avoid stale 7d
        // reminders for events created shortly before they start).
        if (targetSendAt < new Date(now.getTime() - windowMs)) continue;
        if (targetSendAt > new Date(now.getTime() + windowMs)) continue;

        const localTime = formatInZone(event.starts_at, event.timezone || 'UTC');

        // Process recipients in batches to bound Supabase load.
        const BATCH = 100;
        for (let i = 0; i < recipientList.length; i += BATCH) {
          const batch = recipientList.slice(i, i + BATCH);
          const inserts: any[] = [];

          for (const recipient of batch) {
            inserts.push({
              event_id: event.id,
              recipient_user_id: recipient.id,
              reminder_type: reminder.type,
              channel: 'push',
              status: 'pending',
              attempt_count: 0,
            });
          }

          if (inserts.length > 0) {
            const { error: insError } = await supabase
              .from('mai_calendar_notification_deliveries')
              .upsert(inserts, {
                onConflict: 'event_id,recipient_user_id,reminder_type,channel',
                ignoreDuplicates: true,
              });
            if (insError) {
              errors.push(`insert push ${event.id}: ${insError.message}`);
              continue;
            }
          }

          const claimedAt = new Date().toISOString();
          const { data: claimed, error: claimError } = await supabase
            .from('mai_calendar_notification_deliveries')
            .update({ status: 'processing', updated_at: claimedAt })
            .eq('event_id', event.id)
            .eq('reminder_type', reminder.type)
            .eq('channel', 'push')
            .in('recipient_user_id', batch.map((recipient) => recipient.id))
            .in('status', ['pending', 'failed'])
            .select('recipient_user_id');

          if (claimError) {
            errors.push(`claim push ${event.id}: ${claimError.message}`);
            continue;
          }
          deliveriesClaimed += claimed?.length || 0;
          const claimedIds = new Set((claimed || []).map((delivery) => delivery.recipient_user_id));
          const toNotify = batch.filter((recipient) => claimedIds.has(recipient.id));

          // Send notifications (push + in-app via the shared RPC which the
          // DB trigger fans out to push tokens and in-app feeds).
          for (const recipient of toNotify) {
            try {
              const { error: rpcError } = await supabase.rpc('create_notification', {
                p_user_id: recipient.id,
                p_type: 'event_reminder',
                p_title: reminder.title(event.title),
                p_message: reminder.body(event.title, localTime),
                p_metadata: {
                  action_url: `/calendar/events/${event.slug}`,
                  event_id: event.id,
                  event_title: event.title,
                  reminder_type: reminder.type,
                },
              });
              if (rpcError) {
                errors.push(`notify ${recipient.id}: ${rpcError.message}`);
                const { error: markFailedError } = await supabase
                  .from('mai_calendar_notification_deliveries')
                  .update({
                    status: 'failed',
                    last_error: rpcError.message,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('event_id', event.id)
                  .eq('recipient_user_id', recipient.id)
                  .eq('reminder_type', reminder.type)
                  .eq('channel', 'push')
                  .eq('status', 'processing');
                if (markFailedError) {
                  errors.push(`mark failed ${recipient.id}: ${markFailedError.message}`);
                }
                continue;
              }
              notificationsSent += 1;

              // Mark delivery sent.
              const { error: markSentError } = await supabase
                .from('mai_calendar_notification_deliveries')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  last_error: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('event_id', event.id)
                .eq('recipient_user_id', recipient.id)
                .eq('reminder_type', reminder.type)
                .eq('channel', 'push')
                .eq('status', 'processing');
              if (markSentError) {
                errors.push(`mark sent ${recipient.id}: ${markSentError.message}`);
              }
            } catch (err: any) {
              errors.push(`notify catch ${recipient.id}: ${err.message}`);
              const { error: markFailedError } = await supabase
                .from('mai_calendar_notification_deliveries')
                .update({
                  status: 'failed',
                  last_error: String(err.message || err),
                  updated_at: new Date().toISOString(),
                })
                .eq('event_id', event.id)
                .eq('recipient_user_id', recipient.id)
                .eq('reminder_type', reminder.type)
                .eq('channel', 'push')
                .eq('status', 'processing');
              if (markFailedError) {
                errors.push(`mark failed ${recipient.id}: ${markFailedError.message}`);
              }
            }
          }

          // Small delay between batches to avoid overwhelming Supabase.
          if (i + BATCH < recipientList.length) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        run_at: now.toISOString(),
        events_processed: eventsProcessed,
        deliveries_claimed: deliveriesClaimed,
        notifications_sent: notificationsSent,
        errors: errors.slice(0, 20),
      }),
      { status: errors.length === 0 ? 200 : 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('mai-calendar-reminders error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        events_processed: eventsProcessed,
        deliveries_claimed: deliveriesClaimed,
        notifications_sent: notificationsSent,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatInZone(utcISO: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(utcISO));
  } catch {
    return new Date(utcISO).toLocaleString();
  }
}
