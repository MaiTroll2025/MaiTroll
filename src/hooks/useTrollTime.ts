/**
 * useTrollTime — server-authoritative Troll Time state for a battle.
 *
 * CRITICAL:
 * - The multiplier, start time, end time, and event ID are ALL determined
 *   server-side. The frontend NEVER decides the multiplier.
 * - The countdown is computed from server timestamps, never from a
 *   drifting local interval.
 * - One single realtime subscription per battle — no duplicate timers.
 * - Cleans up timers/subscriptions on unmount to avoid leaks.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface TrollTimeState {
  active: boolean;
  multiplier: number; // 1, 2, 4, or 6
  startedAt: string | null;
  endsAt: string | null;
  nextTrollTimeAt: string | null;
  eventId: string | null;
  remainingMs: number;
  serverTime: string | null;
}

const EMPTY_STATE: TrollTimeState = {
  active: false,
  multiplier: 1,
  startedAt: null,
  endsAt: null,
  nextTrollTimeAt: null,
  eventId: null,
  remainingMs: 0,
  serverTime: null,
};

function computeRemaining(endsAt: string | null, serverTime: string | null): number {
  if (!endsAt) return 0;
  const end = new Date(endsAt).getTime();
  const now = serverTime ? new Date(serverTime).getTime() : Date.now();
  return Math.max(0, end - now);
}

export function useTrollTime(battleId: string | null | undefined) {
  const [state, setState] = useState<TrollTimeState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const battleIdRef = useRef(battleId);

  // Keep ref in sync without re-running effects
  useEffect(() => {
    battleIdRef.current = battleId;
  }, [battleId]);

  useEffect(() => {
    if (!battleId) {
      setState(EMPTY_STATE);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchState = async () => {
      try {
        const { data, error } = await supabase.rpc('get_authoritative_troll_time', {
          p_battle_id: battleId,
        });
        if (cancelled) return;
        if (error || !data) {
          setState(EMPTY_STATE);
          setLoading(false);
          return;
        }
setState({
          active: !!data.troll_time_active,
          multiplier: Number(data.troll_time_multiplier || 1),
          startedAt: data.troll_time_started_at || null,
          endsAt: data.troll_time_ends_at || null,
          nextTrollTimeAt: data.troll_time_next_at || null,
          eventId: data.event_id || null,
          remainingMs: computeRemaining(data.troll_time_ends_at, data.server_time),
          serverTime: data.server_time || null,
        });
      } catch {
        if (!cancelled) {
          setState(EMPTY_STATE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchState();

    // Single realtime subscription for Troll Time events on this battle.
    const channel = supabase.channel(`troll-time:${battleId}`);
    channelRef.current = channel;

    const applyRow = (row: any) => {
      if (!row) return;
      const active = row.status === 'active';
      setState(() => {
        const next: TrollTimeState = {
          active,
          multiplier: active ? Number(row.multiplier || 1) : 1,
          startedAt: row.started_at || null,
          endsAt: row.ends_at || null,
          nextTrollTimeAt: row.next_troll_time_at || null,
          eventId: row.id || null,
          remainingMs: active ? computeRemaining(row.ends_at, null) : 0,
          serverTime: new Date().toISOString(),
        };
        return next;
      });
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'troll_time_events',
        filter: `battle_id=eq.${battleId}`,
      },
      (payload: any) => {
        const row = payload.new || payload.old;
        applyRow(row);
      }
    );

    // Also watch the battles row for the denormalized columns.
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`,
      },
      (payload: any) => {
        const row = payload.new;
        if (!row) return;
        setState((prev) => ({
          ...prev,
          active: !!row.troll_time_active,
          multiplier: Number(row.troll_time_multiplier || 1),
          startedAt: row.troll_time_started_at || null,
          endsAt: row.troll_time_ends_at || null,
          nextTrollTimeAt: row.troll_time_next_at || null,
          remainingMs: row.troll_time_active
            ? computeRemaining(row.troll_time_ends_at, null)
            : 0,
        }));
      }
    );

    channel.subscribe();

    // Single countdown timer — derives remaining from server timestamps.
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev.endsAt) return prev;
        return {
          ...prev,
          remainingMs: computeRemaining(prev.endsAt, prev.serverTime),
        };
      });
    }, 250);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* non-critical */
        }
        channelRef.current = null;
      }
    };
  }, [battleId]);

  return { ...state, loading };
}

export default useTrollTime;