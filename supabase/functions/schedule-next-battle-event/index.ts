import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const EVENT_TYPES = [
  { type: 'triple_points', weight: 30 },
  { type: 'turtle_mode', weight: 20 },
  { type: 'turbo_mode', weight: 20 },
  { type: 'glow_mode', weight: 20 },
  { type: 'ceo_mode', weight: 10 },
];

const EVENT_CONFIG: Record<string, { duration_seconds: number; multiplier: number; minimum_paid_gift: number }> = {
  triple_points: { duration_seconds: 60, multiplier: 3, minimum_paid_gift: 0 },
  turtle_mode: { duration_seconds: 30, multiplier: 1, minimum_paid_gift: 0 },
  turbo_mode: { duration_seconds: 30, multiplier: 2, minimum_paid_gift: 0 },
  glow_mode: { duration_seconds: 45, multiplier: 2, minimum_paid_gift: 1000 },
  ceo_mode: { duration_seconds: 10, multiplier: 1, minimum_paid_gift: 0 },
};

function weightedRandomSelect(events: { type: string; weight: number }[]): string {
  const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  for (const event of events) {
    random -= event.weight;
    if (random <= 0) {
      return event.type;
    }
  }
  return events[events.length - 1].type;
}

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
      .select('*')
      .eq('id', battle_id)
      .single();

    if (battleError || !battle) {
      return withCors({ error: 'Battle not found' }, 404);
    }

    if (battle.status !== 'active') {
      return withCors({ error: 'Battle is not active' }, 400);
    }

    const now = new Date();
    const startsAt = new Date(now.getTime() + 10000);

    const existingActiveEvents = await supabase
      .from('battle_random_events')
      .select('id')
      .eq('battle_id', battle_id)
      .in('status', ['scheduled', 'active']);

    if (existingActiveEvents.data && existingActiveEvents.data.length > 0) {
      return withCors({ error: 'Event already exists for this battle', count: existingActiveEvents.data.length }, 409);
    }

    const eventCount = await supabase
      .from('battle_random_events')
      .select('id')
      .eq('battle_id', battle_id);

    if (eventCount.data && eventCount.data.length >= 3) {
      return withCors({ error: 'Maximum events reached for this battle', count: eventCount.data.length }, 409);
    }

    const eventType = weightedRandomSelect(EVENT_TYPES);
    const config = EVENT_CONFIG[eventType];
    const endsAt = new Date(startsAt.getTime() + config.duration_seconds * 1000);

    let affectedTeam: string | null = null;
    let affectedHostId: string | null = null;

    if (eventType === 'ceo_mode') {
      const participants = await supabase
        .from('battle_participants')
        .select('user_id, team')
        .eq('battle_id', battle_id);

      if (participants.data && participants.data.length >= 2) {
        const shuffled = [...participants.data].sort(() => Math.random() - 0.5);
        const lastTargeted = battle.gift_locked_host_id;
        const available = lastTargeted
          ? shuffled.filter(p => p.user_id !== lastTargeted)
          : shuffled;
        const target = available.length > 0 ? available[0] : shuffled[0];
        affectedHostId = target.user_id;
        affectedTeam = target.team;
      }
    } else if (eventType === 'glow_mode') {
      affectedTeam = 'both';
    } else {
      affectedTeam = Math.random() > 0.5 ? 'challenger' : 'opponent';
    }

    const { data: event, error: eventError } = await supabase
      .from('battle_random_events')
      .insert({
        battle_id,
        event_type: eventType,
        status: 'scheduled',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        duration_seconds: config.duration_seconds,
        affected_team: affectedTeam,
        affected_host_id: affectedHostId,
        multiplier: config.multiplier,
        minimum_paid_gift: config.minimum_paid_gift,
        metadata: {
          weighted_probability: EVENT_TYPES.find(e => e.type === eventType)?.weight,
          scheduled_by: 'schedule_next_battle_event',
        },
      })
      .select()
      .single();

    if (eventError) {
      return withCors({ error: eventError.message }, 500);
    }

    await supabase.from('battle_event_history').insert({
      battle_id,
      event_id: event.id,
      event_type: eventType,
      status_from: null,
      status_to: 'scheduled',
      triggered_by: 'schedule',
      metadata: {
        scheduled_starts_at: startsAt.toISOString(),
        scheduled_ends_at: endsAt.toISOString(),
        affected_team: affectedTeam,
        affected_host_id: affectedHostId,
      },
    });

    await supabase
      .from('battles')
      .update({ event_sequence: (battle.event_sequence ?? 0) + 1 })
      .eq('id', battle_id);

    return withCors({ event, battle_id }, 201);
  } catch (e) {
    console.error('schedule-next-battle-event error:', e);
    return withCors({ error: 'Internal error' }, 500);
  }
};

Deno.serve(handler);