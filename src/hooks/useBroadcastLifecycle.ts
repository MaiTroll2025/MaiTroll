import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

export type BroadcastPhase = 'active' | 'warning' | 'ending' | 'ended' | 'expired';
export type BroadcastType = 'broadcast' | 'hytrogame' | 'podcast';

export interface BroadcastLifecycleState {
  phase: BroadcastPhase;
  startedAt: Date | null;
  expiresAt: Date | null;
  endedAt: Date | null;
  endedReason: string | null;
  timeRemainingMs: number;
  warningTimeRemainingMs: number;
  isWarning: boolean;
  isEnding: boolean;
  isEnded: boolean;
  isExpired: boolean;
  broadcastType: BroadcastType;
  battleActive: boolean;
  battleCompletedAfterExpiration: boolean;
}

export interface BroadcastLifecycleActions {
  onBroadcastEnd: () => void;
  onWarningStart: () => void;
  onEndingStart: () => void;
  refreshExpiration: () => Promise<void>;
}

const BROADCAST_DURATION_MS = 50 * 60 * 1000;
const WARNING_START_MS = 45 * 60 * 1000;
const _ENDING_START_MS = 50 * 60 * 1000;

function getServerTimeOffset(): number {
  if (typeof window === 'undefined') return 0;
  return (window as any).__SERVER_TIME_OFFSET__ || 0;
}

function getAuthoritativeNow(): Date {
  return new Date(Date.now() + getServerTimeOffset());
}

export function useBroadcastLifecycle(
  streamId: string | null,
  stream: {
    started_at?: string | null;
    ended_at?: string | null;
    status?: string;
    is_live?: boolean;
    broadcast_expires_at?: string | null;
    broadcast_type?: string;
    ended_reason?: string | null;
    is_battle?: boolean;
    battle_status?: string;
    category?: string;
    stream_type?: string;
  } | null,
  options: {
    isBroadcaster?: boolean;
    onPhaseChange?: (phase: BroadcastPhase) => void;
    sourceType?: 'stream' | 'podcast';
  } = {}
): BroadcastLifecycleState & BroadcastLifecycleActions {
  const { isBroadcaster: _isBroadcaster = false, onPhaseChange, sourceType = 'stream' } = options;
  const { user: _user } = useAuthStore();

  const [phase, setPhase] = useState<BroadcastPhase>('active');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(BROADCAST_DURATION_MS);
  const [warningTimeRemainingMs, setWarningTimeRemainingMs] = useState<number>(0);
  const [battleActive, setBattleActive] = useState(false);
  const [battleCompletedAfterExpiration, setBattleCompletedAfterExpiration] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseChangeRef = useRef<BroadcastPhase>('active');
  const mountedRef = useRef(true);
  const lastStreamRef = useRef(stream);

  const broadcastType = useMemo<BroadcastType>(() => {
    if (!stream?.broadcast_type) {
      if (sourceType === 'podcast') return 'podcast';
      if (stream?.category === 'gaming' || stream?.stream_type === 'hytro') return 'hytrogame';
      if (stream?.category === 'podcast') return 'podcast';
      return 'broadcast';
    }
    return stream.broadcast_type as BroadcastType;
  }, [stream?.broadcast_type, stream?.category, stream?.stream_type, sourceType]);

  const isWarning = phase === 'warning';
  const isEnding = phase === 'ending';
  const isEnded = phase === 'ended';
  const isExpired = phase === 'expired';

  const calculateTimes = useCallback(() => {
    if (!stream || !stream.started_at) return;

    const now = getAuthoritativeNow();
    const started = new Date(stream.started_at);
    const expires = stream.broadcast_expires_at
      ? new Date(stream.broadcast_expires_at)
      : new Date(started.getTime() + BROADCAST_DURATION_MS);
    const ended = stream.ended_at ? new Date(stream.ended_at) : null;

    setStartedAt(started);
    setExpiresAt(expires);
    setEndedAt(ended);

    if (ended) {
      setEndedReason(stream.ended_reason || 'manual_end');
      setTimeRemainingMs(0);
      setWarningTimeRemainingMs(0);
      return;
    }

    const timeRemaining = expires.getTime() - now.getTime();
    setTimeRemainingMs(Math.max(0, timeRemaining));

    const warningRemaining = expires.getTime() - WARNING_START_MS - now.getTime();
    if (warningRemaining > 0 && timeRemaining > 0) {
      setWarningTimeRemainingMs(warningRemaining);
    } else {
      setWarningTimeRemainingMs(0);
    }
  }, [stream]);

  const determinePhase = useCallback((): BroadcastPhase => {
    if (!stream || !stream.started_at) return 'active';
    if (stream.ended_at) return 'ended';

    const now = getAuthoritativeNow();
    const expires = stream.broadcast_expires_at
      ? new Date(stream.broadcast_expires_at)
      : new Date(new Date(stream.started_at).getTime() + BROADCAST_DURATION_MS);

    // Podcasts don't have battles, only streams do
    const isBattleActiveNow = sourceType === 'stream' && stream.is_battle && stream.battle_status && ['starting', 'active'].includes(stream.battle_status);

    if (now >= expires) {
      if (isBattleActiveNow) {
        return 'ending';
      }
      return 'expired';
    }

    const timeUntilExpiry = expires.getTime() - now.getTime();
    if (timeUntilExpiry <= 5 * 60 * 1000 && timeUntilExpiry > 0) {
      return 'ending';
    }
    if (timeUntilExpiry <= 10 * 60 * 1000 && timeUntilExpiry > 0) {
      return 'warning';
    }

    return 'active';
  }, [stream, sourceType]);

  const updatePhase = useCallback(() => {
    const newPhase = determinePhase();
    if (newPhase !== phaseChangeRef.current) {
      phaseChangeRef.current = newPhase;
      setPhase(newPhase);
      onPhaseChange?.(newPhase);
    }
    calculateTimes();
  }, [determinePhase, calculateTimes, onPhaseChange]);

  const checkBattleStatus = useCallback(() => {
    if (!stream || sourceType === 'podcast') return;
    const isBattleActiveNow = stream.is_battle && stream.battle_status && ['starting', 'active'].includes(stream.battle_status);
    setBattleActive(isBattleActiveNow);

    if (!isBattleActiveNow && battleActive && phase === 'ending') {
      setBattleCompletedAfterExpiration(true);
    }
  }, [stream, battleActive, phase, sourceType]);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    updatePhaseRef.current = updatePhase;
  }, [updatePhase]);

  useEffect(() => {
    checkBattleStatusRef.current = checkBattleStatus;
  }, [checkBattleStatus]);

  const updatePhaseRef = useRef(updatePhase);
  const checkBattleStatusRef = useRef(checkBattleStatus);

  useEffect(() => {
    mountedRef.current = true;
    lastStreamRef.current = stream;
    updatePhaseRef.current();
    checkBattleStatusRef.current();

    if (!streamId || !stream) return;

    const tick = () => {
      if (!mountedRef.current) return;
      updatePhaseRef.current();
      checkBattleStatusRef.current();
    };

    intervalRef.current = setInterval(tick, 1000);
    tick();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streamId, stream]);

  const refreshExpiration = useCallback(async () => {
    if (!streamId) return;
    try {
      const table = sourceType === 'podcast' ? 'podcasts' : 'streams';
      const { data, error } = await supabase
        .from(table)
        .select('started_at, ended_at, broadcast_expires_at, broadcast_type, ended_reason, is_battle, battle_status, status, is_live')
        .eq('id', streamId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        lastStreamRef.current = data as any;
        updatePhase();
        checkBattleStatus();
      }
    } catch (err) {
      console.warn('[useBroadcastLifecycle] Failed to refresh expiration:', err);
    }
  }, [streamId, sourceType, updatePhase, checkBattleStatus]);

  const onBroadcastEnd = useCallback(() => {
    setPhase('ended');
  }, []);

  const onWarningStart = useCallback(() => {
    setPhase('warning');
  }, []);

  const onEndingStart = useCallback(() => {
    setPhase('ending');
  }, []);

  return {
    phase,
    startedAt,
    expiresAt,
    endedAt,
    endedReason,
    timeRemainingMs,
    warningTimeRemainingMs,
    isWarning,
    isEnding,
    isEnded,
    isExpired,
    broadcastType,
    battleActive,
    battleCompletedAfterExpiration,
    onBroadcastEnd,
    onWarningStart,
    onEndingStart,
    refreshExpiration,
  };
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatWarningCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}