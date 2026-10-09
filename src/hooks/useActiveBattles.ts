import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ActiveBattle {
  id: string;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  score_challenger: number;
  score_opponent: number;
  challenger_stream_id: string | null;
  opponent_stream_id: string | null;
  challenger?: { id: string; title: string | null; user_id: string; viewer_count?: number | null; is_live?: boolean; battle_mode?: string | null } | null;
  opponent?: { id: string; title: string | null; user_id: string; viewer_count?: number | null; is_live?: boolean; battle_mode?: string | null } | null;
}

const ACTIVE_STATUSES = ['active', 'starting', 'ready'];

export function useActiveBattles(currentBattleId?: string | null) {
  const [battles, setBattles] = useState<ActiveBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const refetchRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: rows, error } = await supabase
        .from('battles')
        .select('id, status, started_at, ends_at, score_challenger, score_opponent, challenger_stream_id, opponent_stream_id')
        .in('status', ACTIVE_STATUSES);
      if (error) {
        console.warn('[ActiveBattles] load error', error);
        return;
      }
      const list = (rows || []) as ActiveBattle[];
      const streamIds = Array.from(
        new Set(list.flatMap((b) => [b.challenger_stream_id, b.opponent_stream_id].filter(Boolean) as string[]))
      );
      const streamMap: Record<string, any> = {};
      if (streamIds.length > 0) {
        const { data: streams } = await supabase
          .from('streams')
          .select('id, title, user_id, viewer_count, is_live, battle_mode')
          .in('id', streamIds);
        for (const stream of streams || []) streamMap[stream.id] = stream;
      }
      const merged = list
        .filter((battle) => battle.challenger_stream_id && battle.opponent_stream_id)
        .map((battle) => ({
          ...battle,
          challenger: battle.challenger_stream_id ? streamMap[battle.challenger_stream_id] || null : null,
          opponent: battle.opponent_stream_id ? streamMap[battle.opponent_stream_id] || null : null,
        }))
        .filter((battle) => battle.id !== currentBattleId);
      setBattles(merged);
    } catch (error) {
      console.warn('[ActiveBattles] load threw', error);
    } finally {
      setLoading(false);
    }
  }, [currentBattleId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('active-battles-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => {
        if (refetchRef.current) clearTimeout(refetchRef.current);
        refetchRef.current = window.setTimeout(() => load(), 400);
      })
      .subscribe();
    return () => {
      if (refetchRef.current) clearTimeout(refetchRef.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { battles, loading, reload: load };
}
