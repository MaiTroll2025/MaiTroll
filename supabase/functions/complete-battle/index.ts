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
    const { battle_id, winner_stream_id } = body as { battle_id?: string; winner_stream_id?: string };

    if (!battle_id) {
      return withCors({ error: 'battle_id is required' }, 400);
    }

    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('*')
      .eq('id', battle_id)
      .single();

    if (battleError || !battle) {
      return withCors({ error: 'Battle not found' }, 404);
    }

    if (battle.status === 'ended') {
      return withCors({ error: 'Battle already ended' }, 400);
    }

    const now = new Date();

    await supabase
      .from('battles')
      .update({
        status: 'ended',
        ended_at: now.toISOString(),
        winner_stream_id: winner_stream_id || battle.winner_stream_id,
      })
      .eq('id', battle_id);

    const { data: activeEvents, error: eventsError } = await supabase
      .from('battle_random_events')
      .select('id, event_type, status')
      .eq('battle_id', battle_id)
      .in('status', ['scheduled', 'active']);

    if (activeEvents.data && activeEvents.data.length > 0) {
      const eventIds = activeEvents.data.map(e => e.id);
      await supabase
        .from('battle_random_events')
        .update({ status: 'cancelled' })
        .in('id', eventIds);

      for (const evt of activeEvents.data) {
        await supabase.from('battle_event_history').insert({
          battle_id,
          event_id: evt.id,
          event_type: evt.event_type,
          status_from: evt.status,
          status_to: 'cancelled',
          triggered_by: 'complete',
          metadata: {
            cancelled_at: now.toISOString(),
            reason: 'battle_ended',
          },
        });
      }
    }

    await supabase
      .from('battles')
      .update({
        active_event_type: null,
        active_event_started_at: null,
        active_event_ends_at: null,
        timer_rate: 1,
        gift_locked_host_id: null,
      })
      .eq('id', battle_id);

    return withCors({ battle_id, ended_at: now.toISOString(), cancelled_events: activeEvents.data?.length ?? 0 }, 200);
  } catch (e) {
    console.error('complete-battle error:', e);
    return withCors({ error: 'Internal error' }, 500);
  }
};

Deno.serve(handler);