import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { GameError, gameApi } from '../lib/gameApi';
import type { RoomState } from '../lib/types';

const SYNC_INTERVAL_MS = 1000;
const ROOM_TABLES = ['rooms', 'room_players', 'game_rounds', 'round_answers'] as const;

export function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState<GameError | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const sync = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const next = await gameApi.tickRoom(roomId);
      setClockOffset(new Date(next.server_now).getTime() - Date.now());
      setState(next);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof GameError
          ? caught
          : new GameError('unknown', 'Connection hiccup. Retrying...'),
      );
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        void sync();
      }
    }
  }, [roomId]);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sync]);

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`);
    for (const table of ROOM_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${table === 'rooms' ? 'id' : 'room_id'}=eq.${roomId}` },
        () => void sync(),
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, sync]);

  return { state, clockOffset, error, sync };
}

