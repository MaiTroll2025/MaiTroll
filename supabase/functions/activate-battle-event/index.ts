import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return withCors({ error: 'Missing authorization' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return withCors({ error: 'Invalid user' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { battle_id, event_id } = body as { battle_id?: string; event_id?: string };

    if (!battle_id && !event_id) {
      return withCors({ error: 'battle_id or event_id is required' }, 400);
    }

    let targetEvent: any = null;

    if (event_id) {
      const { data: evt, error: evtError } = await supabase
        .from('battle_random_events')
        .select('*')
        .eq('id', event_id)
        .eq('status', 'scheduled')
        .single();

      if (evtError || !evt) {
        return withCors({ error: 'Scheduled event not found' }, 404);
      }
      targetEvent = evt;
    } else {
      const { data: evt, error: evtError } = await supabase
        .from('battle_random_events')
        .select('*')
        .eq('battle_id', battle_id)
        .eq('status', 'scheduled')
        .lte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)
        .single();

      if (evtError || !evt) {
        return withCors({ error: 'No scheduled event to activate' }, 404);
      }
      targetEvent = evt;
    }

    const now = new Date();
    const startsAt = new Date(targetEvent.starts_at);

    if (now < startsAt) {
      return withCors({ error: 'Event has not started yet', starts_at: targetEvent.starts_at }, 409);
    }

    const { data: updated, error: updateError } = await supabase
      .from('battle_random_events')
      .update({
        status: 'active',
        active_event_type: targetEvent.event_type,
      })
      .eq('id', targetEvent.id)
      .select()
      .single();

    if (updateError) {
      return withCors({ error: updateError.message }, 500);
    }

    await supabase.from('battle_event_history').insert({
      battle_id: targetEvent.battle_id,
      event_id: targetEvent.id,
      event_type: targetEvent.event_type,
      status_from: 'scheduled',
      status_to: 'active',
      triggered_by: 'activate',
      metadata: {
        activated_at: now.toISOString(),
        affected_team: updated.affected_team,
        affected_host_id: updated.affected_host_id,
        multiplier: updated.multiplier,
      },
    });

    await supabase
      .from('battles')
      .update({
        active_event_type: targetEvent.event_type,
        active_event_started_at: now.toISOString(),
        active_event_ends_at: targetEvent.ends_at,
        timer_rate: targetEvent.event_type === 'turtle_mode' ? 0.5 : targetEvent.event_type === 'turbo_mode' ? 2 : 1,
        gift_locked_host_id: targetEvent.event_type === 'ceo_mode' ? targetEvent.affected_host_id : null,
      })
      .eq('id', targetEvent.battle_id);

    return withCors({ event: updated, battle_id: targetEvent.battle_id }, 200);
  } catch (e) {
    console.error('activate-battle-event error:', e);
    return withCors({ error: 'Internal error' }, 500);
  }
};

Deno.serve(handler);