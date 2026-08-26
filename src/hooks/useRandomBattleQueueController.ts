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
const MIN_PRE_BATTLE_DELAY_MS = 3_000;

const BATTLE_STREAM_FIELDS = [
  'id',
  'user_id',
  'status',
  'is_live',
  'is_battle',
  'battle_id',
  'battle_mode',
  'battle_enabled',
  'battle_status',
  'battle_start_time',
  'battle_end_time',
  'battle_end_reason',
  'battle_winner_id',
  'battle_forfeited_by',
  'random_battle_queue_enabled',
  'random_battle_queued_at',
  'random_battle_cooldown_until',
].join(',');

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
  const autoQueueTimerRef = useRef<number | null>(null);

  const activationInFlightRef = useRef(false);
  const lastActivationBattleIdRef = useRef<string | null>(null);
  const matchingRef = useRef(false);
  const mountedRef = useRef(true);

  const realtimeChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const lastMatchErrorToastRef = useRef<number>(0);
  const shouldAutoQueueRef = useRef(false);

  const isGeneralChat = stream?.category === 'general';

  const isQueueEnabled =
    !!stream?.random_battle_queue_enabled;

  const hasActiveBattle =
    !!stream?.battle_id &&
    !!stream?.is_battle;

  const isRandomBattle =
    stream?.battle_mode === 'random_queue' &&
    hasActiveBattle;

  const isBattleActive =
    hasActiveBattle &&
    (
      stream?.battle_status === 'active' ||
      stream?.battle_status === 'starting' ||
      stream?.battle_status === 'waiting' ||
      !stream?.battle_status
    );

  const canUseRandomBattles =
    RANDOM_BATTLE_ENABLED &&
    isGeneralChat &&
    isBroadcaster &&
    !!stream?.id &&
    !!userId;

  const phase: QueuePhase = useMemo(() => {
    if (stream?.status === 'ended') {
      return 'ended';
    }

    if (
      isRandomBattle &&
      (
        stream?.battle_status === 'starting' ||
        stream?.battle_status === 'waiting'
      )
    ) {
      return 'starting';
    }

    if (isRandomBattle && isBattleActive) {
      return 'active';
    }

    if (isQueueEnabled) {
      return 'queue';
    }

    return 'regular';
  }, [
    isBattleActive,
    isQueueEnabled,
    isRandomBattle,
    stream?.battle_status,
    stream?.status,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * -------------------------------------------------------------
   * TIMER CLEANUP
   * -------------------------------------------------------------
   */

  const clearAutoQueueTimer = useCallback(() => {
    if (autoQueueTimerRef.current !== null) {
      window.clearTimeout(autoQueueTimerRef.current);
      autoQueueTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setDelayUntil(null);

    clearAutoQueueTimer();
  }, [clearAutoQueueTimer]);

  const clearActivationTimer = useCallback(() => {
    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = null;
    }

    setBattleStartsAt(null);
    activationInFlightRef.current = false;
  }, []);

  /*
   * -------------------------------------------------------------
   * REALTIME STREAM SYNC
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * When find_random_battle_match updates BOTH stream rows,
   * each browser receives the update immediately.
   * No refresh required.
   * -------------------------------------------------------------
   */

  useEffect(() => {
    if (!canUseRandomBattles || !stream?.id) {
      return;
    }

    const streamId = stream.id;

    if (realtimeChannelRef.current) {
      void supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase.channel(
      `random-battle-stream:${streamId}`
    );

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${streamId}`,
      },
      (payload) => {
        if (!mountedRef.current) return;

        const next = payload.new as Partial<Stream>;

        if (!next || !next.id) {
          return;
        }

        /*
         * Only process battle-related stream changes here.
         *
         * Do NOT replace the entire Stream object because this hook
         * should not accidentally erase unrelated local stream state.
         */
        const patch: Partial<Stream> = {
          is_battle: next.is_battle,
          battle_id: next.battle_id,
          battle_mode: next.battle_mode,
          battle_enabled: next.battle_enabled,
          battle_status: next.battle_status,
          battle_start_time: next.battle_start_time,
          battle_end_time: next.battle_end_time,
          battle_end_reason: next.battle_end_reason,
          battle_winner_id: next.battle_winner_id,
          battle_forfeited_by: next.battle_forfeited_by,
          random_battle_queue_enabled:
            next.random_battle_queue_enabled,
          random_battle_queued_at:
            next.random_battle_queued_at,
          random_battle_cooldown_until:
            next.random_battle_cooldown_until,
        };

        if (import.meta.env.DEV) {
          console.log(
            '[RandomBattleRealtime] stream update received',
            {
              streamId,
              battleId: next.battle_id,
              isBattle: next.is_battle,
              status: next.battle_status,
              start: next.battle_start_time,
              end: next.battle_end_time,
            }
          );
        }

        onStreamUpdate?.(patch);

        /*
         * If another process/user caused the battle to end,
         * immediately stop local queue/activation timers.
         */
        if (
          next.battle_status === 'ended' ||
          next.is_battle === false ||
          (
            next.battle_end_time &&
            new Date(next.battle_end_time).getTime() <= Date.now()
          )
        ) {
          clearActivationTimer();
          clearTimers();
        }

        /*
         * If a battle appeared remotely, make sure the local
         * activation recovery logic sees it immediately.
         */
        if (
          next.battle_id &&
          next.battle_start_time &&
          (
            next.battle_status === 'starting' ||
            next.battle_status === 'waiting'
          )
        ) {
          const startMs =
            new Date(next.battle_start_time).getTime();

          if (!Number.isNaN(startMs)) {
            setBattleStartsAt(startMs);

            if (startMs <= Date.now()) {
              void triggerActivationIfDue(
                next.battle_id,
                next.battle_start_time
              );
            }
          }
        }
      }
    );

    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        console.log(
          '[RandomBattleRealtime] subscription status:',
          status,
          streamId
        );
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [
    canUseRandomBattles,
    clearActivationTimer,
    clearTimers,
    onStreamUpdate,
    stream?.id,
  ]);

  /*
   * -------------------------------------------------------------
   * ACTIVATION RPC
   * -------------------------------------------------------------
   */

  const callActivationRpc = useCallback(
    async (battleId: string) => {
      if (!battleId) return;

      if (
        activationInFlightRef.current ||
        lastActivationBattleIdRef.current === battleId
      ) {
        return;
      }

      activationInFlightRef.current = true;

      try {
        const { data, error } = await supabase.rpc(
          'activate_due_random_battles'
        );

        if (error) {
          console.error(
            '[RandomBattleActivation] RPC failed',
            error
          );
          return;
        }

        if (import.meta.env.DEV) {
          console.log(
            '[RandomBattleActivation] activated',
            {
              battleId,
              data,
            }
          );
        }

        lastActivationBattleIdRef.current = battleId;
      } catch (error) {
        console.error(
          '[RandomBattleActivation] exception',
          error
        );
      } finally {
        activationInFlightRef.current = false;
      }
    },
    []
  );

  /*
   * -------------------------------------------------------------
   * SCHEDULE ACTIVATION
   * -------------------------------------------------------------
   */

  const scheduleBattleActivation = useCallback(
    async (
      battleId: string,
      battleStartTime: string
    ) => {
      if (!battleId || !battleStartTime) {
        return;
      }

      const startMs =
        new Date(battleStartTime).getTime();

      if (Number.isNaN(startMs)) {
        return;
      }

      clearActivationTimer();

      setBattleStartsAt(startMs);

      const nowMs = Date.now();

      /*
       * If the start time is already past, activate immediately.
       * This is important for a browser that received the realtime
       * update slightly late.
       */
      if (startMs <= nowMs) {
        void callActivationRpc(battleId);
        return;
      }

      const delayMs = Math.max(
        MIN_PRE_BATTLE_DELAY_MS,
        startMs - nowMs
      );

      if (import.meta.env.DEV) {
        console.log(
          '[RandomBattleActivation] scheduled',
          {
            battleId,
            startTime: battleStartTime,
            delayMs,
          }
        );
      }

      activationTimerRef.current =
        window.setTimeout(() => {
          activationTimerRef.current = null;

          if (import.meta.env.DEV) {
            console.log(
              '[RandomBattleActivation] due',
              {
                battleId,
                localNow: Date.now(),
              }
            );
          }

          void callActivationRpc(battleId);
        }, delayMs + 100);
    },
    [
      callActivationRpc,
      clearActivationTimer,
    ]
  );

  const triggerActivationIfDue = useCallback(
    async (
      battleId: string | null | undefined,
      startedAt: string | null | undefined
    ) => {
      if (!battleId || !startedAt) {
        return;
      }

      if (
        activationInFlightRef.current ||
        lastActivationBattleIdRef.current === battleId
      ) {
        return;
      }

      const startMs =
        new Date(startedAt).getTime();

      if (Number.isNaN(startMs)) {
        return;
      }

      if (startMs <= Date.now()) {
        if (import.meta.env.DEV) {
          console.log(
            '[RandomBattleActivation] recovery trigger',
            {
              battleId,
              localNow: Date.now(),
            }
          );
        }

        await callActivationRpc(battleId);
      }
    },
    [callActivationRpc]
  );

  /*
   * -------------------------------------------------------------
   * FIND MATCH
   * -------------------------------------------------------------
   */

  const findMatch = useCallback(
    async (force = false) => {
      if (
        !stream?.id ||
        !userId ||
        matchingRef.current
      ) {
        return;
      }

      if (
        !canUseRandomBattles ||
        isBattleActive ||
        stream.status !== 'live'
      ) {
        return;
      }

      if (!isQueueEnabled && !force) {
        return;
      }

      matchingRef.current = true;

      try {
        if (import.meta.env.DEV) {
          console.debug(
            '[RandomBattleQueue] searching for match',
            {
              streamId: stream.id,
              userId,
              force,
            }
          );
        }

        const { data, error } =
          await supabase.rpc(
            'find_random_battle_match',
            {
              p_stream_id: stream.id,
              p_broadcaster_id: userId,
            }
          );

        if (error) {
          throw error;
        }

        const matched =
          !!data?.matched ||
          !!data?.match_found;

        if (!matched) {
          if (import.meta.env.DEV) {
            console.debug(
              '[RandomBattleQueue] no match',
              data?.message ?? data
            );
          }

          return;
        }

        const battleId =
          data?.battle_id ??
          data?.id ??
          stream.battle_id;

        if (!battleId) {
          throw new Error(
            'Match found but no battle ID was returned.'
          );
        }

        let battleStartTime =
          data?.battle_started_at ??
          data?.started_at ??
          stream.battle_start_time;

        /*
         * Ensure there is always a small pre-battle window.
         */
        if (battleStartTime) {
          const startMs =
            new Date(battleStartTime).getTime();

          if (
            !Number.isNaN(startMs) &&
            startMs - Date.now() <
              MIN_PRE_BATTLE_DELAY_MS
          ) {
            battleStartTime =
              new Date(
                Date.now() +
                  MIN_PRE_BATTLE_DELAY_MS
              ).toISOString();
          }
        }

        const battleEndTime =
          data?.battle_ends_at ??
          data?.ends_at ??
          stream.battle_end_time;

        /*
         * Update THIS browser immediately.
         *
         * The database RPC should update both stream rows.
         * The realtime subscription above will update the
         * other broadcaster automatically.
         */
        onStreamUpdate?.({
          is_battle: true,
          battle_id: battleId,
          battle_mode: 'random_queue' as any,
          battle_enabled: true,
          battle_status: 'starting' as any,
          random_battle_queue_enabled: false,
          random_battle_queued_at: null,
          random_battle_cooldown_until: null,
          battle_start_time: battleStartTime,
          battle_end_time: battleEndTime,
          battle_end_reason: null,
          battle_winner_id: null,
          battle_forfeited_by: null,
        } as Partial<Stream>);

        shouldAutoQueueRef.current = false;

        clearTimers();
        clearActivationTimer();

        toast.success('Match found');

        if (
          battleStartTime
        ) {
          void scheduleBattleActivation(
            battleId,
            battleStartTime
          );
        }
      } catch (error: any) {
        console.error(
          '[RandomBattleQueue] Matchmaking failed:',
          error
        );

        const now = Date.now();

        if (
          now -
            lastMatchErrorToastRef.current >
          10_000
        ) {
          lastMatchErrorToastRef.current = now;

          toast.error(
            error?.message ||
              'Matchmaking failed.'
          );
        }
      } finally {
        matchingRef.current = false;
      }
    },
    [
      canUseRandomBattles,
      clearActivationTimer,
      clearTimers,
      isBattleActive,
      isQueueEnabled,
      onStreamUpdate,
      scheduleBattleActivation,
      stream?.battle_end_time,
      stream?.battle_id,
      stream?.battle_start_time,
      stream?.id,
      stream?.status,
      userId,
    ]
  );

  /*
   * -------------------------------------------------------------
   * QUEUE POLLING
   * -------------------------------------------------------------
   */

  useEffect(() => {
    clearTimers();

    if (
      !canUseRandomBattles ||
      !isQueueEnabled ||
      isBattleActive ||
      stream?.status !== 'live'
    ) {
      return;
    }

    const queuedAt =
      stream.random_battle_queued_at
        ? new Date(
            stream.random_battle_queued_at
          ).getTime()
        : null;

    const firstRunAt =
      queuedAt
        ? queuedAt + QUEUE_DELAY_MS
        : Date.now() + QUEUE_DELAY_MS;

    const delay = Math.max(
      0,
      firstRunAt - Date.now()
    );

    setDelayUntil(firstRunAt);

    delayTimerRef.current =
      window.setTimeout(() => {
        delayTimerRef.current = null;
        setDelayUntil(null);

        void findMatch();

        pollTimerRef.current =
          window.setInterval(() => {
            void findMatch();
          }, POLL_INTERVAL_MS);
      }, delay);

    return clearTimers;
  }, [
    canUseRandomBattles,
    clearTimers,
    findMatch,
    isBattleActive,
    isQueueEnabled,
    stream?.random_battle_queued_at,
    stream?.status,
  ]);

  /*
   * -------------------------------------------------------------
   * START QUEUE
   * -------------------------------------------------------------
   */

  const startQueue = useCallback(async () => {
    if (
      !canUseRandomBattles ||
      !stream?.id
    ) {
      return;
    }

    setIsBusy(true);

    try {
      const queuedAt =
        new Date().toISOString();

      const { data, error } =
        await supabase
          .from('streams')
          .update({
            random_battle_queue_enabled: true,
            random_battle_queued_at: queuedAt,
          })
          .eq('id', stream.id)
          .select(
            'random_battle_queue_enabled, random_battle_queued_at, random_battle_cooldown_until'
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      const row = data;

      const patch = {
        random_battle_queue_enabled:
          row?.random_battle_queue_enabled ??
          true,
        random_battle_queued_at:
          row?.random_battle_queued_at ??
          queuedAt,
        random_battle_cooldown_until:
          row?.random_battle_cooldown_until ??
          null,
      } as Partial<Stream>;

      onStreamUpdate?.(patch);

      shouldAutoQueueRef.current = true;

      toast.success(
        'Random Battle Queue enabled'
      );

      if (
        stream.status === 'live' &&
        !isBattleActive
      ) {
        void findMatch(true);
      }
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Failed to start random battles'
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    canUseRandomBattles,
    findMatch,
    isBattleActive,
    onStreamUpdate,
    stream?.id,
    stream?.status,
  ]);

  /*
   * -------------------------------------------------------------
   * STOP QUEUE
   * -------------------------------------------------------------
   */

  const stopQueue = useCallback(async () => {
    if (!stream?.id) {
      return;
    }

    setIsBusy(true);

    try {
      const { error } =
        await supabase
          .from('streams')
          .update({
            random_battle_queue_enabled: false,
            random_battle_queued_at: null,
          })
          .eq('id', stream.id);

      if (error) {
        throw error;
      }

      clearTimers();
      clearAutoQueueTimer();

      shouldAutoQueueRef.current = false;

      onStreamUpdate?.({
        random_battle_queue_enabled: false,
        random_battle_queued_at: null,
      } as Partial<Stream>);

      toast.success(
        'Random Battle Queue stopped'
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Failed to stop random battles'
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    clearAutoQueueTimer,
    clearTimers,
    onStreamUpdate,
    stream?.id,
  ]);

  /*
   * -------------------------------------------------------------
   * AUTO QUEUE
   * -------------------------------------------------------------
   */

  useEffect(() => {
    clearAutoQueueTimer();

    if (
      !canUseRandomBattles ||
      stream?.status !== 'live' ||
      !shouldAutoQueueRef.current
    ) {
      return;
    }

    if (
      isQueueEnabled ||
      hasActiveBattle
    ) {
      return;
    }

    autoQueueTimerRef.current =
      window.setTimeout(() => {
        autoQueueTimerRef.current = null;

        if (
          !hasActiveBattle &&
          !isQueueEnabled &&
          shouldAutoQueueRef.current &&
          stream?.status === 'live'
        ) {
          void startQueue();
        }
      }, 30_000);

    return clearAutoQueueTimer;
  }, [
    canUseRandomBattles,
    clearAutoQueueTimer,
    hasActiveBattle,
    isQueueEnabled,
    startQueue,
    stream?.status,
  ]);

  /*
   * -------------------------------------------------------------
   * BATTLE COUNTDOWN / RECOVERY
   * -------------------------------------------------------------
   */

  useEffect(() => {
    const battleId =
      stream?.battle_id;

    const startedAt =
      stream?.battle_start_time;

    if (
      stream?.battle_mode ===
        'random_queue' &&
      battleId &&
      startedAt &&
      (
        stream?.battle_status ===
          'starting' ||
        stream?.battle_status ===
          'waiting'
      )
    ) {
      void scheduleBattleActivation(
        battleId,
        startedAt
      );
    }

    if (
      battleId &&
      startedAt &&
      !stream?.is_battle
    ) {
      void triggerActivationIfDue(
        battleId,
        startedAt
      );
    }

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
          'visible' &&
        battleId &&
        startedAt
      ) {
        void triggerActivationIfDue(
          battleId,
          startedAt
        );
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      clearActivationTimer();

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [
    clearActivationTimer,
    scheduleBattleActivation,
    triggerActivationIfDue,
    stream?.battle_id,
    stream?.battle_status,
    stream?.battle_start_time,
    stream?.battle_mode,
    stream?.is_battle,
  ]);

  /*
   * -------------------------------------------------------------
   * BATTLE END SAFETY
   *
   * If the database says the end time has passed but the local
   * stream still says active, force a refresh of the stream row.
   * -------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !stream?.battle_id ||
      !stream?.battle_end_time
    ) {
      return;
    }

    const endMs =
      new Date(
        stream.battle_end_time
      ).getTime();

    if (Number.isNaN(endMs)) {
      return;
    }

    const remaining =
      endMs - Date.now();

    if (remaining <= 0) {
      return;
    }

    const timer = window.setTimeout(
      async () => {
        if (!mountedRef.current) {
          return;
        }

        try {
          const { data } =
            await supabase
              .from('streams')
              .select(BATTLE_STREAM_FIELDS)
              .eq('id', stream.id)
              .maybeSingle();

          if (
            !mountedRef.current ||
            !data
          ) {
            return;
          }

          const streamData = data as Partial<Stream>;

          onStreamUpdate?.(
            streamData
          );

          if (
            streamData.battle_status ===
              'ended' ||
            streamData.is_battle === false
          ) {
            clearActivationTimer();
            clearTimers();
          }
        } catch (error) {
          console.error(
            '[RandomBattle] end-time recovery failed',
            error
          );
        }
      },
      remaining + 500
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    clearActivationTimer,
    clearTimers,
    onStreamUpdate,
    stream?.battle_id,
    stream?.battle_end_time,
    stream?.id,
  ]);

  /*
   * -------------------------------------------------------------
   * FORFEIT
   * -------------------------------------------------------------
   */

  const forfeitBattle = useCallback(
    async () => {
      if (
        !stream?.id ||
        !userId ||
        !isRandomBattle
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'You will lose and opponent gets 2 crowns'
        );

      if (!confirmed) {
        return;
      }

      setIsBusy(true);

      try {
        const { data, error } =
          await supabase.rpc(
            'forfeit_random_battle',
            {
              p_stream_id: stream.id,
              p_broadcaster_id: userId,
            }
          );

        if (error) {
          throw error;
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              'Failed to forfeit battle'
          );
        }

        clearActivationTimer();
        clearTimers();

        onStreamUpdate?.({
          is_battle: false,
          battle_id: null,
          battle_mode: 'manual' as any,
          battle_status: 'ended' as any,
          battle_start_time: null,
          battle_end_time:
            new Date().toISOString(),
          battle_end_reason: 'forfeit',
          battle_winner_id:
            data.winner_id,
          battle_forfeited_by: userId,
          random_battle_queue_enabled:
            false,
          random_battle_queued_at: null,
          random_battle_cooldown_until:
            null,
        } as Partial<Stream>);

        shouldAutoQueueRef.current = false;

        toast.success(
          'Battle forfeited'
        );
      } catch (error: any) {
        toast.error(
          error?.message ||
            'Failed to forfeit battle'
        );
      } finally {
        setIsBusy(false);
      }
    },
    [
      clearActivationTimer,
      clearTimers,
      isRandomBattle,
      onStreamUpdate,
      stream?.id,
      userId,
    ]
  );

  /*
   * -------------------------------------------------------------
   * FINAL CLEANUP
   * -------------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      clearTimers();
      clearActivationTimer();

      if (realtimeChannelRef.current) {
        void supabase.removeChannel(
          realtimeChannelRef.current
        );

        realtimeChannelRef.current = null;
      }
    };
  }, [
    clearActivationTimer,
    clearTimers,
  ]);

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