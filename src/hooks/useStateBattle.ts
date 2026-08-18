// ============================================================
// useStateBattle Hook
// ============================================================
// Manages state battle mode for the broadcast page.
// Wraps the existing useRandomBattleQueueController with
// state-aware matchmaking.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { Stream } from '@/types/broadcast';
import type { BattleModeType } from '@/types/stateBattle';
import {
  assignUserToState,
  getUserStateRPC,
  findStateBattleMatch,
} from '@/services/stateBattleService';

interface UseStateBattleOptions {
  stream: Stream | null;
  isBroadcaster: boolean;
  onStreamUpdate?: (patch: Partial<Stream>) => void;
}

interface UseStateBattleReturn {
  battleMode: BattleModeType;
  setBattleMode: (mode: BattleModeType) => void;
  userState: string | null;
  userStateName: string | null;
  isStateAssigned: boolean;
  showStateSelector: boolean;
  setShowStateSelector: (show: boolean) => void;
  assignState: (stateCode: string) => Promise<void>;
  isAssigning: boolean;
  // State battle queue
  isStateQueueEnabled: boolean;
  isStateMatching: boolean;
  stateMatchResult: {
    opponentState: string | null;
    opponentStateName: string | null;
  } | null;
  startStateQueue: () => Promise<void>;
  stopStateQueue: () => Promise<void>;
  findStateMatch: () => Promise<void>;
}

import { getStateName } from '@/config/usStates';

export function useStateBattle({
  stream,
  isBroadcaster,
  onStreamUpdate,
}: UseStateBattleOptions): UseStateBattleReturn {
  const userId = useAuthStore((s) => s.user?.id);

  const [battleMode, setBattleModeState] = useState<BattleModeType>('world');
  const [userState, setUserState] = useState<string | null>(null);
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isStateMatching, setIsStateMatching] = useState(false);
  const [stateMatchResult, setStateMatchResult] = useState<{
    opponentState: string | null;
    opponentStateName: string | null;
  } | null>(null);

  const isStateQueueEnabled =
    stream?.state_battle_mode === 'state' && isBroadcaster;

  // Load user's state on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const state = await getUserStateRPC(userId!);
        if (!cancelled) {
          const normalizedState = typeof state === 'string' ? state : null;
          setUserState(normalizedState);
          if (!normalizedState) {
            setShowStateSelector(true);
          }
        }
      } catch (err) {
        console.error('[StateBattle] Failed to load user state:', err);
        if (!cancelled) setShowStateSelector(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // Sync battle mode from stream state
  useEffect(() => {
    if (stream?.state_battle_mode === 'state') {
      setBattleModeState('state');
    } else {
      setBattleModeState('world');
    }
  }, [stream?.state_battle_mode]);

  const setBattleMode = useCallback(
    (mode: BattleModeType) => {
      setBattleModeState(mode);
      if (mode === 'state' && !userState) {
        setShowStateSelector(true);
      }
    },
    [userState]
  );

  const assignState = useCallback(
    async (stateCode: string) => {
      if (!userId) return;
      setIsAssigning(true);
      try {
        await assignUserToState(userId, stateCode);
        setUserState(stateCode);
        setShowStateSelector(false);
        toast.success(`You now represent ${getStateName(stateCode)}!`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to assign state');
      } finally {
        setIsAssigning(false);
      }
    },
    [userId]
  );

  const startStateQueue = useCallback(async () => {
    if (!stream?.id || !userId) return;

    if (!userState) {
      setShowStateSelector(true);
      toast.error('Select your state first!');
      return;
    }

    try {
      // Set stream to state battle mode
      const { error } = await supabase
        .from('streams')
        .update({ state_battle_mode: 'state' })
        .eq('id', stream.id);
      if (error) throw error;

      onStreamUpdate?.({ state_battle_mode: 'state' });
      toast.success('State Battle mode enabled! Searching for opponent...');

      // Immediately try to find a match
      await findStateMatch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start state battle queue');
    }
  }, [stream?.id, userId, userState, onStreamUpdate]);

  const stopStateQueue = useCallback(async () => {
    if (!stream?.id) return;
    try {
      const { error } = await supabase
        .from('streams')
        .update({ state_battle_mode: 'none' })
        .eq('id', stream.id);
      if (error) throw error;

      onStreamUpdate?.({ state_battle_mode: 'none' });
      setStateMatchResult(null);
      toast.success('State Battle mode disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to stop state battle');
    }
  }, [stream?.id, onStreamUpdate]);

  const findStateMatch = useCallback(async () => {
    if (!stream?.id || !userId || isStateMatching) return;
    setIsStateMatching(true);
    try {
      const result = await findStateBattleMatch(stream.id, userId);
      if (result.matched && result.battle_id) {
        setStateMatchResult({
          opponentState: result.opponent_state ?? null,
          opponentStateName: result.opponent_state
            ? getStateName(result.opponent_state)
            : null,
        });
        onStreamUpdate?.({
          is_battle: true,
          battle_id: result.battle_id,
          battle_mode: 'random_queue',
          battle_status: 'starting',
          battle_start_time: result.battle_started_at,
          battle_end_time: result.battle_ends_at,
          state_battle_mode: 'state',
          state_battle_state_code: result.broadcaster_state,
        } as Partial<Stream>);
        toast.success(
          `State Battle found! ${getStateName(result.broadcaster_state ?? '')} VS ${getStateName(result.opponent_state ?? '')}`
        );
      } else {
        toast.info('No state battle opponent found yet. Keep searching!');
      }
    } catch (err: any) {
      console.error('[StateBattle] Matchmaking failed:', err);
      toast.error(err?.message || 'Matchmaking failed');
    } finally {
      setIsStateMatching(false);
    }
  }, [stream?.id, userId, isStateMatching, onStreamUpdate]);

  return {
    battleMode,
    setBattleMode,
    userState,
    userStateName: userState ? getStateName(userState) : null,
    isStateAssigned: !!userState,
    showStateSelector,
    setShowStateSelector,
    assignState,
    isAssigning,
    isStateQueueEnabled,
    isStateMatching,
    stateMatchResult,
    startStateQueue,
    stopStateQueue,
    findStateMatch,
  };
}
