import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

// Types
export interface SmokeEvent {
  id: string;
  stream_id: string;
  created_by: string;
  is_active: boolean;
  seat_count: number;
  raffle_enabled: boolean;
  troll_drop_enabled: boolean;
  song_queue_enabled: boolean;
  dj_user_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface TrollDrop {
  id: string;
  stream_id: string;
  coin_value: number;
  duration_seconds: number;
  total_bills: number;
  status: string;
  ends_at: string;
}

export interface RaffleTicket {
  id: string;
  ticket_number: number;
}

export interface SongRequest {
  id: string;
  song_title: string;
  artist: string | null;
  status: string;
  requested_by: string;
}

export function useSmokeEvent(streamId: string | undefined) {
  const [smokeEvent, setSmokeEvent] = useState<SmokeEvent | null>(null);
  const [activeDrop, setActiveDrop] = useState<TrollDrop | null>(null);
  const [_raffleTickets, _setRaffleTickets] = useState<RaffleTicket[]>([]);
  const [songQueue, setSongQueue] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch smoke event state
  const fetchSmokeEvent = useCallback(async () => {
    if (!streamId) return;
    try {      const { data } = await supabase
        .from('stream_smoke_events')
        .select('*')
        .eq('stream_id', streamId)
        .eq('is_active', true)
        .maybeSingle();
      setSmokeEvent(data);
    } catch (err) {
      console.error('[SmokeEvent] fetch error:', err);
    }
  }, [streamId]);

  // Fetch active troll drop
  const fetchActiveDrop = useCallback(async () => {
    if (!streamId) return;
    try {
      const { data } = await supabase
        .from('troll_drops')
        .select('*')
        .eq('stream_id', streamId)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .maybeSingle();
      setActiveDrop(data);
    } catch (err) {
      console.error('[TrollDrop] fetch error:', err);
    }
  }, [streamId]);

  // Fetch song queue
  const fetchSongQueue = useCallback(async () => {
    if (!streamId) return;
    try {
      const { data } = await supabase
        .from('stream_song_requests')
        .select('*')
        .eq('stream_id', streamId)
        .in('status', ['queued', 'playing'])
        .order('created_at', { ascending: true });
      setSongQueue(data || []);
    } catch (err) {
      console.error('[SongQueue] fetch error:', err);
    }
  }, [streamId]);

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSmokeEvent(), fetchActiveDrop(), fetchSongQueue()]);
      setLoading(false);
    };
    load();
  }, [fetchSmokeEvent, fetchActiveDrop, fetchSongQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`smoke-event:${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stream_smoke_events',
        filter: `stream_id=eq.${streamId}`
      }, () => fetchSmokeEvent())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'troll_drops',
        filter: `stream_id=eq.${streamId}`
      }, () => fetchActiveDrop())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stream_song_requests',
        filter: `stream_id=eq.${streamId}`
      }, () => fetchSongQueue())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stream_raffles',
        filter: `stream_id=eq.${streamId}`
      }, () => fetchSmokeEvent())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchSmokeEvent, fetchActiveDrop, fetchSongQueue]);

  // Actions
  const startSmokeEvent = useCallback(async (seatCount: number = 6) => {
    if (!streamId) return;
    const { data, error } = await supabase.rpc('start_smoke_event', {
      p_stream_id: streamId,
      p_seat_count: seatCount
    });
    if (error) throw error;
    await fetchSmokeEvent();
    return data;
  }, [streamId, fetchSmokeEvent]);

  const endSmokeEvent = useCallback(async () => {
    if (!streamId) return;
    const { error } = await supabase.rpc('end_smoke_event', { p_stream_id: streamId });
    if (error) throw error;
    setSmokeEvent(null);
    setActiveDrop(null);
  }, [streamId]);

  const startTrollDrop = useCallback(async (coinValue: number, durationSeconds: number, totalBills: number = 25) => {
    if (!streamId) return;
    const { data, error } = await supabase.rpc('start_troll_drop', {
      p_stream_id: streamId,
      p_coin_value: coinValue,
      p_duration_seconds: durationSeconds,
      p_total_bills: totalBills
    });
    if (error) throw error;
    await fetchActiveDrop();
    return data;
  }, [streamId, fetchActiveDrop]);

  const claimBill = useCallback(async (dropId: string, billIndex: number) => {
    const { data, error } = await supabase.rpc('claim_troll_drop_bill', {
      p_troll_drop_id: dropId,
      p_bill_index: billIndex
    });
    if (error) throw error;
    return data;
  }, []);

  const buyRaffleTicket = useCallback(async (raffleId: string, quantity: number = 1) => {
    const { data, error } = await supabase.rpc('buy_raffle_ticket', {
      p_raffle_id: raffleId,
      p_quantity: quantity
    });
    if (error) throw error;
    return data;
  }, []);

  const drawRaffle = useCallback(async (raffleId: string) => {
    const { data, error } = await supabase.rpc('draw_raffle_winners', { p_raffle_id: raffleId });
    if (error) throw error;
    return data;
  }, []);

  const requestSong = useCallback(async (title: string, artist?: string, link?: string) => {
    if (!streamId) return;
    const { data, error } = await supabase.rpc('request_stream_song', {
      p_stream_id: streamId,
      p_song_title: title,
      p_artist: artist || null,
      p_song_link: link || null
    });
    if (error) throw error;
    await fetchSongQueue();
    return data;
  }, [streamId, fetchSongQueue]);

  return {
    smokeEvent,
    activeDrop,
    songQueue,
    loading,
    startSmokeEvent,
    endSmokeEvent,
    startTrollDrop,
    claimBill,
    buyRaffleTicket,
    drawRaffle,
    requestSong,
    refresh: fetchSmokeEvent,
  };
}
