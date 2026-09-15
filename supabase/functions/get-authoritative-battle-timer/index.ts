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
    const { battle_id } = body as { battle_id?: string };

    if (!battle_id) {
      return withCors({ error: 'battle_id is required' }, 400);
    }

    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('id, status, started_at, ended_at, timer_rate, active_event_type, active_event_started_at, active_event_ends_at, event_sequence')
      .eq('id', battle_id)
      .single();

    if (battleError || !battle) {
      return withCors({ error: 'Battle not found' }, 404);
    }

    const now = new Date();
    let effectiveTimerRate = battle.timer_rate || 1;
    let effectiveTimeRemaining = 0;
    let battleElapsedSeconds = 0;

    if (battle.started_at && !battle.ended_at) {
      const battleStart = new Date(battle.started_at);
      const realElapsedMs = now.getTime() - battleStart.getTime();
      const realElapsedSeconds = realElapsedMs / 1000;

      let activeEventTimerRate = 1;
      if (battle.active_event_type === 'turtle_mode') {
        activeEventTimerRate = 0.5;
      } else if (battle.active_event_type === 'turbo_mode') {
        activeEventTimerRate = 2;
      }

      const activeEventStart = battle.active_event_started_at ? new Date(battle.active_event_started_at) : null;
      const activeEventEnd = battle.active_event_ends_at ? new Date(battle.active_event_ends_at) : null;

      let eventElapsedSeconds = 0;
      let normalElapsedSeconds = 0;

      if (activeEventStart && activeEventEnd && now >= activeEventStart && now <= activeEventEnd) {
        eventElapsedSeconds = (now.getTime() - activeEventStart.getTime()) / 1000;
        normalElapsedSeconds = realElapsedSeconds - eventElapsedSeconds;
      } else {
        normalElapsedSeconds = realElapsedSeconds;
      }

      battleElapsedSeconds = (normalElapsedSeconds * 1) + (eventElapsedSeconds * activeEventTimerRate);
      effectiveTimerRate = battle.active_event_type ? activeEventTimerRate : 1;
    }

    const { data: events, error: eventsError } = await supabase
      .from('battle_random_events')
      .select('id, event_type, status, starts_at, ends_at, duration_seconds, affected_team, affected_host_id, multiplier')
      .eq('battle_id', battle_id)
      .in('status', ['scheduled', 'active']);

    const activeEvent = events?.data?.find(e => e.status === 'active') || null;
    const scheduledEvent = events?.data?.find(e => e.status === 'scheduled') || null;

    return withCors({
      battle_id,
      battle_status: battle.status,
      timer_rate: effectiveTimerRate,
      battle_elapsed_seconds: Math.floor(battleElapsedSeconds),
      active_event: activeEvent,
      scheduled_event: scheduledEvent,
      server_time: now.toISOString(),
      event_sequence: battle.event_sequence,
      gift_locked_host_id: battle.gift_locked_host_id,
    }, 200);
  } catch (e) {
    console.error('get-authoritative-battle-timer error:', e);
    return withCors({ error: 'Internal error' }, 500);
  }
};

Deno.serve(handler);