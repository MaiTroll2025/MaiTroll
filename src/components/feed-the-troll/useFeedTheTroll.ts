import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  TrollRealtimeEvent,
  TrollFeedState,
  TrollFeedLeaderboardEntry,
  TrollFeedTransaction,
  TrollFeedCashout,
  TrollFeedMilestone,
  TrollFeedMilestoneConfig,
  TrollFeedGiftTrain,
  TrollFeedSettings,
  TrollFeedEvolutionConfig,
  TrollFeedEvolutionHistoryEntry,
} from '@/types/feedTheTroll';

const PRIORITY: Record<string, number> = {
  evolving: 90,
  legendary_gift: 85,
  battle_result: 80,
  milestone: 75,
  large_gift: 65,
  gift_train: 55,
  eating: 40,
  cheering: 35,
  sleeping: 10,
  idle: 0,
};

function priorityFor(ev: TrollRealtimeEvent): number {
  if (ev.eventType === 'troll_evolved') return PRIORITY.evolving;
  if (ev.eventType === 'troll_cashout_completed') return PRIORITY.milestone;
  if (ev.eventType === 'troll_milestone_completed') return PRIORITY.milestone;
  if (ev.eventType === 'troll_battle_won' || ev.eventType === 'troll_battle_lost' || ev.eventType === 'troll_battle_tied')
    return PRIORITY.battle_result;
  if (ev.sizeCategory === 'legendary') return PRIORITY.legendary_gift;
  if (ev.sizeCategory === 'large') return PRIORITY.large_gift;
  if (ev.eventType === 'troll_gift_train_started' || ev.eventType === 'troll_gift_train_updated')
    return PRIORITY.gift_train;
  if (ev.eventType === 'troll_fed') return PRIORITY.eating;
  if (ev.eventType === 'troll_battle_lead_changed' || ev.eventType === 'troll_state_changed')
    return PRIORITY.cheering;
  if (ev.eventType === 'troll_battle_started') return PRIORITY.cheering;
  return PRIORITY.idle;
}

interface UseFeedTheTrollResult {
  state: TrollFeedState | null;
  leaderboard: TrollFeedLeaderboardEntry[];
  recentFeedings: TrollFeedTransaction[];
  cashouts: TrollFeedCashout[];
  milestones: TrollFeedMilestone[];
  milestoneConfigs: TrollFeedMilestoneConfig[];
  giftTrain: TrollFeedGiftTrain | null;
  settings: TrollFeedSettings | null;
  evolutionConfig: TrollFeedEvolutionConfig[];
  evolutionHistory: TrollFeedEvolutionHistoryEntry[];
  loading: boolean;
  lastEvent: TrollRealtimeEvent | null;
  refresh: () => Promise<void>;
}

/**
 * Single shared hook driving one realtime connection per broadcaster.
 * Listens to:
 *   - broadcast channel `troll_feed:${streamId}` (instant UI events from RPC)
 *   - postgres_changes on troll_feed_transactions / state / leaderboard
 *     (guaranteed consistency + idempotent replay on reconnect)
 * Financial numbers always come from the DB, never the browser.
 */
export function useFeedTheTroll(
  broadcasterId: string | null | undefined,
  streamId?: string | null,
  _opts?: { battleId?: string | null }
): UseFeedTheTrollResult {
  const [state, setState] = useState<TrollFeedState | null>(null);
  const [leaderboard, setLeaderboard] = useState<TrollFeedLeaderboardEntry[]>([]);
  const [recentFeedings, setRecentFeedings] = useState<TrollFeedTransaction[]>([]);
  const [cashouts, setCashouts] = useState<TrollFeedCashout[]>([]);
  const [milestones, setMilestones] = useState<TrollFeedMilestone[]>([]);
  const [milestoneConfigs, setMilestoneConfigs] = useState<TrollFeedMilestoneConfig[]>([]);
  const [giftTrain, setGiftTrain] = useState<TrollFeedGiftTrain | null>(null);
  const [settings, setSettings] = useState<TrollFeedSettings | null>(null);
  const [evolutionConfig, setEvolutionConfig] = useState<TrollFeedEvolutionConfig[]>([]);
  const [evolutionHistory, setEvolutionHistory] = useState<TrollFeedEvolutionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<TrollRealtimeEvent | null>(null);

  // Dedupe map so a reconnect or dual transport can't double-animate.
  const seenRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!broadcasterId) return;
    setLoading(true);
    const [
      st,
      lb,
      rc,
      co,
      ms,
      mc,
      gt,
      set,
      ec,
      eh,
    ] = await Promise.all([
      supabase.from('troll_feed_state').select('*').eq('broadcaster_id', broadcasterId).maybeSingle(),
      supabase
        .from('troll_feed_leaderboard')
        .select('*, user_profiles!troll_feed_leaderboard_sender_id_fkey(username, avatar_url)')
        .eq('broadcaster_id', broadcasterId)
        .order('total_troll_allocated', { ascending: false })
        .limit(50),
      supabase
        .from('troll_feed_transactions')
        .select('*')
        .eq('broadcaster_id', broadcasterId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('troll_feed_cashouts')
        .select('*')
        .eq('broadcaster_id', broadcasterId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('troll_feed_milestones').select('*').eq('broadcaster_id', broadcasterId),
      supabase.from('troll_feed_milestone_config').select('*').eq('is_active', true),
      supabase.from('troll_feed_gift_trains').select('*').eq('broadcaster_id', broadcasterId).maybeSingle(),
      supabase.from('troll_feed_settings').select('*').eq('broadcaster_id', broadcasterId).maybeSingle(),
      supabase.from('troll_feed_evolution_config').select('*').eq('is_active', true).order('sort_order'),
      supabase
        .from('troll_feed_evolution_history')
        .select('*')
        .eq('broadcaster_id', broadcasterId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (st.data) setState(st.data as TrollFeedState);
    if (lb.data) {
      setLeaderboard(
        (lb.data as any[]).map((r) => ({
          ...(r as TrollFeedLeaderboardEntry),
          username: r.user_profiles?.username,
          avatar_url: r.user_profiles?.avatar_url ?? null,
        }))
      );
    }
    if (rc.data) setRecentFeedings(rc.data as TrollFeedTransaction[]);
    if (co.data) setCashouts(co.data as TrollFeedCashout[]);
    if (ms.data) setMilestones(ms.data as TrollFeedMilestone[]);
    if (mc.data) setMilestoneConfigs(mc.data as TrollFeedMilestoneConfig[]);
    if (gt.data) setGiftTrain(gt.data as TrollFeedGiftTrain);
    if (set.data) setSettings(set.data as TrollFeedSettings);
    if (ec.data) setEvolutionConfig(ec.data as TrollFeedEvolutionConfig[]);
    if (eh.data) setEvolutionHistory(eh.data as TrollFeedEvolutionHistoryEntry[]);
    setLoading(false);
  }, [broadcasterId]);

  // Load snapshot
  useEffect(() => {
    if (!broadcasterId) return;
    refresh();
  }, [broadcasterId, refresh]);

  // Realtime connections (broadcast + postgres_changes), one per broadcaster.
  useEffect(() => {
    if (!broadcasterId) return;
    const channels: any[] = [];

    const handleEvent = (ev: TrollRealtimeEvent) => {
      const key = `${ev.eventType}:${ev.senderId ?? ''}:${ev.createdAt}:${ev.eligibleGiftValue ?? ''}`;
      if (seenRef.current.has(key)) return; // idempotent dedupe
      seenRef.current.add(key);
      if (seenRef.current.size > 500) seenRef.current.clear();
      setLastEvent(ev);
      // Refresh authoritative data after any event (cheap, throttled by DB).
      refresh();
    };

    // Broadcast channel (instant). The RPC result is also pushed here by the
    // gift sender after a successful send_gift_in_stream.
    if (streamId) {
      const bc = supabase
        .channel(`troll_feed:${streamId}`)
        .on('broadcast', { event: 'troll_event' }, ({ payload }) => handleEvent(payload as TrollRealtimeEvent))
        .subscribe();
      channels.push(bc);
    }

    // Postgres changes — durable fallback + reconnect consistency.
    const txCh = supabase
      .channel(`troll_feed_tx:${broadcasterId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'troll_feed_transactions', filter: `broadcaster_id=eq.${broadcasterId}` },
        (p) => {
          const row = p.new as TrollFeedTransaction;
          handleEvent({
            eventType: 'troll_fed',
            trollOwnerId: broadcasterId,
            streamId,
            senderId: row.sender_id,
            senderDisplayName: undefined,
            giftId: row.gift_id ?? undefined,
            giftName: row.gift_name ?? undefined,
            eligibleGiftValue: row.eligible_gift_value,
            trollAllocation: row.troll_allocation,
            sizeCategory: row.size_category,
            createdAt: row.created_at,
          });
        }
      )
      .subscribe();
    channels.push(txCh);

    const stateCh = supabase
      .channel(`troll_feed_state:${broadcasterId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'troll_feed_state', filter: `broadcaster_id=eq.${broadcasterId}` },
        (p) => setState(p.new as TrollFeedState)
      )
      .subscribe();
    channels.push(stateCh);

    const lbCh = supabase
      .channel(`troll_feed_lb:${broadcasterId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'troll_feed_leaderboard', filter: `broadcaster_id=eq.${broadcasterId}` },
        () => refresh()
      )
      .subscribe();
    channels.push(lbCh);

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [broadcasterId, streamId, refresh]);

  return {
    state,
    leaderboard,
    recentFeedings,
    cashouts,
    milestones,
    milestoneConfigs,
    giftTrain,
    settings,
    evolutionConfig,
    evolutionHistory,
    loading,
    lastEvent,
    refresh,
  };
}

// Exposed so callers (gift send flow) can push a broadcast event immediately.
export function emitTrollEvent(streamId: string | null | undefined, ev: TrollRealtimeEvent) {
  if (!streamId) return;
  try {
    supabase.channel(`troll_feed:${streamId}`).send({
      type: 'broadcast',
      event: 'troll_event',
      payload: ev,
    });
  } catch {
    /* non-critical */
  }
}

export { priorityFor };
