import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { BattleRandomEvent } from '@/types/battle';

export interface BattleEventState {
  activeEvent: BattleRandomEvent | null;
  scheduledEvent: BattleRandomEvent | null;
  eventHistory: BattleRandomEvent[];
  timerRate: number;
  giftLockedHostId: string | null;
  eventSequence: number;
  isLoading: boolean;
  error: string | null;
  refreshEvents: () => Promise<void>;
}

export function useBattleEvents(battleId: string | null | undefined): BattleEventState {
  const [activeEvent, setActiveEvent] = useState<BattleRandomEvent | null>(null);
  const [scheduledEvent, setScheduledEvent] = useState<BattleRandomEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<BattleRandomEvent[]>([]);
  const [timerRate, setTimerRate] = useState<number>(1);
  const [giftLockedHostId, setGiftLockedHostId] = useState<string | null>(null);
  const [eventSequence, setEventSequence] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    if (!battleId) return;

    try {
      const { data, error } = await supabase
        .from('battle_random_events')
        .select('*')
        .eq('battle_id', battleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const events = (data || []) as BattleRandomEvent[];
      setActiveEvent(events.find(e => e.status === 'active') || null);
      setScheduledEvent(events.find(e => e.status === 'scheduled') || null);
      setEventHistory(events);
    } catch (err) {
      console.error('Error fetching battle events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    }
  }, [battleId]);

  const fetchBattleState = useCallback(async () => {
    if (!battleId) return;

    try {
      const { data, error } = await supabase
        .from('battles')
        .select('timer_rate, gift_locked_host_id, event_sequence, active_event_type, active_event_started_at, active_event_ends_at')
        .eq('id', battleId)
        .single();

      if (error) throw error;

      setTimerRate(data?.timer_rate ?? 1);
      setGiftLockedHostId(data?.gift_locked_host_id ?? null);
      setEventSequence(data?.event_sequence ?? 0);
    } catch (err) {
      console.error('Error fetching battle state:', err);
    }
  }, [battleId]);

  const refreshEvents = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchBattleState()]);
  }, [fetchEvents, fetchBattleState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!battleId) {
      setActiveEvent(null);
      setScheduledEvent(null);
      setEventHistory([]);
      setTimerRate(1);
      setGiftLockedHostId(null);
      setEventSequence(0);
      return;
    }

    refreshEvents();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `battle-events:${battleId}`;
    const channel = supabase.channel(channelName);

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'battle_random_events',
      filter: `battle_id=eq.${battleId}`,
    }, async (payload) => {
      if (!mountedRef.current) return;
      await refreshEvents();
    });

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'battles',
      filter: `id=eq.${battleId}`,
    }, async (payload) => {
      if (!mountedRef.current) return;
      const updated = payload.new as any;
      setTimerRate(updated.timer_rate ?? 1);
      setGiftLockedHostId(updated.gift_locked_host_id ?? null);
      setEventSequence(updated.event_sequence ?? 0);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug('[BattleEvents] Subscribed to battle events');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [battleId, refreshEvents]);

  return {
    activeEvent,
    scheduledEvent,
    eventHistory,
    timerRate,
    giftLockedHostId,
    eventSequence,
    isLoading: false,
    error,
    refreshEvents,
  };
}

export default useBattleEvents;