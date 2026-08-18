import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RANDOM_BATTLE_ENABLED } from '../config/featureFlags';
import { supabase } from '../lib/supabase';
import type { Stream } from '../types/broadcast';

type QueuePhase = 'regular' | 'queue' | 'starting' | 'active' | 'ended';

interface Options {
  stream: Stream | null;
  userId?: string;
  isBroadcaster: boolean;
  onStreamUpdate?: (patch: Partial<Stream>) => void;
}

const QUEUE_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 3_000;

export function useRandomBattleQueueController({
  stream,
  userId,
  isBroadcaster,
  onStreamUpdate,
}: Options) {
  const [isBusy, setIsBusy] = useState(false);
  const [delayUntil, setDelayUntil] = useState<number | null>(null);
  const [battleStartsAt, setBattleStartsAt] = useState<number | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const activationTimerRef = useRef<number | null>(null);
  const activationInFlightRef = useRef(false);
  const lastActivationBattleIdRef = useRef<string | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  const autoQueueTimerRef = useRef<number | null>(null);
  const shouldAutoQueueRef = useRef(false);
  const matchingRef = useRef(false);
  const lastMatchErrorToastRef = useRef<number>(0);

  const isGeneralChat = stream?.category === 'general';
  const isQueueEnabled = !!stream?.random_battle_queue_enabled;
  const hasActiveBattleRef = !!stream?.battle_id && !!stream?.is_battle;
  const isRandomBattle = stream?.battle_mode === 'random_queue' && hasActiveBattleRef;
  const isBattleActive = hasActiveBattleRef && (
    stream?.battle_status === 'active'
    || stream?.battle_status === 'starting'
    || !stream?.battle_status
  );
  const canUseRandomBattles = RANDOM_BATTLE_ENABLED && isGeneralChat && isBroadcaster && !!stream?.id && !!userId;

  const phase: QueuePhase = useMemo(() => {
    if (stream?.status === 'ended') return 'ended';
    if (isRandomBattle && stream?.battle_status === 'starting') return 'starting';
    if (isRandomBattle && isBattleActive) return 'active';
    if (isQueueEnabled) return 'queue';
    return 'regular';
  }, [isBattleActive, isQueueEnabled, isRandomBattle, stream?.battle_status, stream?.status]);

  useEffect(() => {
    if (isQueueEnabled) {
      shouldAutoQueueRef.current = true;
    }
  }, [isQueueEnabled]);

  const clearAutoQueueTimer = useCallback(() => {
    if (autoQueueTimerRef.current) window.clearTimeout(autoQueueTimerRef.current);
    autoQueueTimerRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    delayTimerRef.current = null;
    pollTimerRef.current = null;
    setDelayUntil(null);
    clearAutoQueueTimer();
  }, [clearAutoQueueTimer]);

  const clearActivationTimer = useCallback(() => {
    if (activationTimerRef.current) window.clearTimeout(activationTimerRef.current);
    activationTimerRef.current = null;
    setBattleStartsAt(null);
    activationInFlightRef.current = false;
  }, []);

  const callActivationRpc = useCallback(async (battleId: string) => {
    if (!battleId) return;
    if (activationInFlightRef.current || lastActivationBattleIdRef.current === battleId) {
      return;
    }

    activationInFlightRef.current = true;
    try {
      const { data, error } = await supabase.rpc('activate_due_random_battles');
      if (error) {
        console.error('[RandomBattleActivation] RPC failed', error);
        return;
      }
      if (import.meta.env.DEV) {
        console.log('[RandomBattleActivation] rpc-result', { battleId, data });
      }
      lastActivationBattleIdRef.current = battleId;
    } catch (err) {
      console.error('[RandomBattleActivation] exception', err);
    } finally {
      activationInFlightRef.current = false;
    }
  }, []);

  const MIN_PRE_BATTLE_DELAY_MS = 3_000;

  const scheduleBattleActivation = useCallback(async (battleId: string, battleStartTime: string) => {
    if (!battleId || !battleStartTime) return;

    const startMs = new Date(battleStartTime).getTime();
    if (Number.isNaN(startMs)) return;

    const nowMs = Date.now();
    const delayMs = Math.max(MIN_PRE_BATTLE_DELAY_MS, startMs - nowMs);

    if (import.meta.env.DEV) {
      console.log('[RandomBattleActivation] scheduled', { battleId, startTime: battleStartTime, delayMs });
    }

    clearActivationTimer();

    activationTimerRef.current = window.setTimeout(async () => {
      activationTimerRef.current = null;
      if (import.meta.env.DEV) {
        console.log('[RandomBattleActivation] due', { battleId, localNow: Date.now() });
      }
      await callActivationRpc(battleId);
    }, delayMs + 100);
  }, [callActivationRpc, clearActivationTimer]);

  const triggerActivationIfDue = useCallback(async (battleId: string | null | undefined, startedAt: string | null | undefined) => {
    if (!battleId || !startedAt) return;
    if (activationInFlightRef.current || lastActivationBattleIdRef.current === battleId) return;

    const startMs = new Date(startedAt).getTime();
    if (Number.isNaN(startMs)) return;

    if (startMs <= Date.now()) {
      if (import.meta.env.DEV) {
        console.log('[RandomBattleActivation] recovery trigger', { battleId, localNow: Date.now() });
      }
      await callActivationRpc(battleId);
    }
  }, [callActivationRpc]);

  const findMatch = useCallback(async (force: boolean = false) => {
    if (import.meta.env.DEV) console.debug('[RandomBattleQueue] findMatch called:', { hasId: !!stream?.id, hasUserId: !!userId, matching: matchingRef.current, canUse: canUseRandomBattles, isBattleActive, status: stream?.status, isQueueEnabled, force });
    if (!stream?.id || !userId || matchingRef.current) return;
    if (!canUseRandomBattles || isBattleActive || stream.status !== 'live') return;
    if (!isQueueEnabled && !force) return;

    if (import.meta.env.DEV) console.debug('[RandomBattleQueue] calling find_random_battle_match RPC');
    matchingRef.current = true;
    try {
      const { data, error } = await supabase.rpc('find_random_battle_match', {
        p_stream_id: stream.id,
        p_broadcaster_id: userId,
      });

      if (error) throw error;

      const matched = !!(data?.matched || data?.match_found);

      if (matched) {
        if (import.meta.env.DEV) console.debug('[RandomBattleQueue] MATCH FOUND:', data);
        clearActivationTimer();
        const battleId = data?.battle_id ?? data?.id ?? stream.battle_id;
        let battleStartTime = data?.battle_started_at ?? data?.started_at ?? stream.battle_start_time;

        const startMs = battleStartTime ? new Date(battleStartTime).getTime() : NaN;
        const nowMs = Date.now();
        if (!Number.isNaN(startMs) && startMs - nowMs < MIN_PRE_BATTLE_DELAY_MS) {
          battleStartTime = new Date(nowMs + MIN_PRE_BATTLE_DELAY_MS).toISOString();
        }

        onStreamUpdate?.({
          is_battle: true,
          battle_id: battleId,
          battle_mode: 'random_queue' as any,
          battle_status: 'starting' as any,
          random_battle_queue_enabled: false,
          random_battle_queued_at: null,
          random_battle_cooldown_until: null,
          battle_start_time: battleStartTime,
          battle_end_time: data?.battle_ends_at ?? data?.ends_at ?? stream.battle_end_time,
          battle_end_reason: null,
          battle_winner_id: null,
          battle_forfeited_by: null,
        } as Partial<Stream>);
        toast.success('Match found');

        if (battleId && battleStartTime) {
          void scheduleBattleActivation(battleId, battleStartTime);
        }
      } else if (import.meta.env.DEV) {
        console.debug('[RandomBattleQueue] No match:', data?.message ?? data);
      }
    } catch (err: any) {
      console.error('[RandomBattleQueue] Matchmaking failed:', err);
      const now = Date.now();
      if (now - lastMatchErrorToastRef.current > 10_000) {
        lastMatchErrorToastRef.current = now;
        toast.error(err?.message || 'Matchmaking failed. Check console for details.');
      }
    } finally {
      matchingRef.current = false;
    }
  }, [canUseRandomBattles, clearActivationTimer, isBattleActive, isQueueEnabled, onStreamUpdate, scheduleBattleActivation, stream?.battle_end_time, stream?.battle_id, stream?.battle_start_time, stream?.id, stream?.status, userId]);

  useEffect(() => {
    clearTimers();

    if (!canUseRandomBattles || !isQueueEnabled || isBattleActive || stream?.status !== 'live') return;

    const queuedAt = stream.random_battle_queued_at
      ? new Date(stream.random_battle_queued_at).getTime()
      : null;
    const firstRunAt = queuedAt ? queuedAt + QUEUE_DELAY_MS : Date.now() + QUEUE_DELAY_MS;
    const delay = Math.max(0, firstRunAt - Date.now());
    setDelayUntil(firstRunAt);

    delayTimerRef.current = window.setTimeout(() => {
      setDelayUntil(null);
      void findMatch();
      pollTimerRef.current = window.setInterval(() => {
        void findMatch();
      }, POLL_INTERVAL_MS);
    }, delay);

    return clearTimers;
  }, [canUseRandomBattles, clearTimers, findMatch, isBattleActive, isQueueEnabled, stream?.random_battle_queued_at, stream?.status]);

  const startQueue = useCallback(async () => {
    if (!canUseRandomBattles || !stream?.id) return;
    if (import.meta.env.DEV) console.debug('[RandomBattleQueue] startQueue called, streamId:', stream.id);
    setIsBusy(true);
    try {
      const queuedAt = new Date().toISOString();
      if (import.meta.env.DEV) console.debug('[RandomBattleQueue] setting random_battle_queue_enabled=true in DB');
      const { data, error } = await supabase
        .from('streams')
        .update({
          random_battle_queue_enabled: true,
          random_battle_queued_at: queuedAt,
        })
        .select('random_battle_queue_enabled, random_battle_queued_at, random_battle_cooldown_until')
        .eq('id', stream.id);
      if (error) throw error;
      const row = data?.[0];
      onStreamUpdate?.({
        random_battle_queue_enabled: true,
        random_battle_queued_at: row?.random_battle_queued_at ?? queuedAt,
        random_battle_cooldown_until: row?.random_battle_cooldown_until ?? null,
      } as Partial<Stream>);
      shouldAutoQueueRef.current = true;
      toast.success('Random Battle Queue enabled');

      if (stream?.status === 'live' && !isBattleActive) {
        void findMatch(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start random battles');
    } finally {
      setIsBusy(false);
    }
  }, [canUseRandomBattles, findMatch, isBattleActive, onStreamUpdate, stream?.id, stream?.status]);

  const stopQueue = useCallback(async () => {
    if (!stream?.id) return;
    setIsBusy(true);
    try {
      const { error } = await supabase
        .from('streams')
        .update({
          random_battle_queue_enabled: false,
          random_battle_queued_at: null,
        })
        .eq('id', stream.id);
      if (error) throw error;
      clearTimers();
      clearAutoQueueTimer();
      shouldAutoQueueRef.current = false;
      onStreamUpdate?.({ random_battle_queue_enabled: false, random_battle_queued_at: null } as Partial<Stream>);
      toast.success('Random Battle Queue stopped');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to stop random battles');
    } finally {
      setIsBusy(false);
    }
  }, [clearAutoQueueTimer, clearTimers, onStreamUpdate, stream?.id]);

  useEffect(() => {
    clearAutoQueueTimer();
    if (!canUseRandomBattles || stream?.status !== 'live' || !shouldAutoQueueRef.current) return;
    if (isQueueEnabled || hasActiveBattleRef) return;

    autoQueueTimerRef.current = window.setTimeout(() => {
      autoQueueTimerRef.current = null;
      if (!hasActiveBattleRef && !isQueueEnabled && shouldAutoQueueRef.current && stream?.status === 'live') {
        void startQueue();
      }
    }, 30_000);

    return clearAutoQueueTimer;
  }, [canUseRandomBattles, clearAutoQueueTimer, hasActiveBattleRef, isQueueEnabled, startQueue, stream?.status]);

  useEffect(() => {
    const battleId = stream?.battle_id;
    const startedAt = stream?.battle_start_time;

    const isInRandomBattleCountdown =
      stream?.battle_mode === 'random_queue' &&
      !!battleId &&
      !!startedAt &&
      (stream?.battle_status === 'starting' || stream?.battle_status === 'waiting');

    if (isInRandomBattleCountdown) {
      scheduleBattleActivation(battleId, startedAt);
    }

    if (battleId && startedAt) {
      triggerActivationIfDue(battleId, startedAt);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && battleId && startedAt) {
        triggerActivationIfDue(battleId, startedAt);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityHandlerRef.current = handleVisibilityChange;

    return () => {
      clearActivationTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      visibilityHandlerRef.current = null;
    };
  }, [scheduleBattleActivation, triggerActivationIfDue, clearActivationTimer, stream?.battle_id, stream?.battle_status, stream?.battle_start_time, stream?.battle_mode]);

  const forfeitBattle = useCallback(async () => {
    if (!stream?.id || !userId || !isRandomBattle) return;
    const confirmed = window.confirm('You will lose and opponent gets 2 crowns');
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const { data, error } = await supabase.rpc('forfeit_random_battle', {
        p_stream_id: stream.id,
        p_broadcaster_id: userId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Failed to forfeit battle');
      clearActivationTimer();
      onStreamUpdate?.({
        is_battle: false,
        battle_id: null,
        battle_mode: 'manual' as any,
        battle_status: 'waiting' as any,
        battle_start_time: null,
        battle_end_time: new Date().toISOString(),
        battle_end_reason: 'forfeit',
        battle_winner_id: data.winner_id,
        battle_forfeited_by: userId,
        random_battle_queue_enabled: false,
        random_battle_queued_at: null,
        random_battle_cooldown_until: null,
      } as Partial<Stream>);
      toast.success('Battle forfeited');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to forfeit battle');
    } finally {
      setIsBusy(false);
    }
  }, [isRandomBattle, onStreamUpdate, stream?.id, userId, clearActivationTimer]);

  return {
    canUseRandomBattles,
    isBusy,
    isQueueEnabled,
    isRandomBattle,
    isBattleActive,
    phase,
    delayUntil,
    battleStartsAt,
    startQueue,
    stopQueue,
    forfeitBattle,
  };
}
