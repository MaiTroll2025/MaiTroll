import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { BattleSounds } from '@/lib/battleSounds';

type BattlePhase = 'idle' | 'pre_battle' | 'active' | 'ended';

export interface BattleRealtimeState {
  battle: any | null;
  participants: any[];

  arenaReady: boolean;

  challengerStream: any | null;
  opponentStream: any | null;

  lastGift: {
    username: string;
    amount: number;
    team: 'A' | 'B';
  } | null;

  abilityEffects: Array<{
    id: string;
    type: string;
    team?: 'A' | 'B';
    username: string;
    timestamp: number;
  }>;

  timerSeconds: number;

  phase: BattlePhase;

  winner: 'A' | 'B' | 'draw' | null;
}

const INITIAL_STATE: BattleRealtimeState = {
  battle: null,
  participants: [],
  arenaReady: false,
  challengerStream: null,
  opponentStream: null,
  lastGift: null,
  abilityEffects: [],
  timerSeconds: 0,
  phase: 'idle',
  winner: null,
};

const RECONCILE_INTERVAL_MS = 1000;
const DATABASE_REFRESH_INTERVAL_MS = 3000;

function getBattleStartMs(battle: any): number | null {
  const value =
    battle?.started_at ??
    battle?.battle_started_at ??
    battle?.start_time ??
    null;

  if (!value) return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getBattleEndMs(battle: any): number | null {
  const value =
    battle?.ends_at ??
    battle?.battle_ends_at ??
    battle?.ended_at ??
    battle?.end_time ??
    null;

  if (!value) return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function getBattleDurationSeconds(battle: any): number {
  const start = getBattleStartMs(battle);
  const end = getBattleEndMs(battle);

  if (start !== null && end !== null && end > start) {
    return Math.max(1, Math.round((end - start) / 1000));
  }

  return 180;
}

function calculatePhase(battle: any): BattlePhase {
  if (!battle) return 'idle';

  if (battle.status === 'ended') {
    return 'ended';
  }

  const startMs = getBattleStartMs(battle);
  const endMs = getBattleEndMs(battle);
  const now = Date.now();

  if (endMs !== null && now >= endMs) {
    return 'ended';
  }

  if (
    battle.status === 'starting' ||
    battle.status === 'waiting' ||
    (startMs !== null && now < startMs)
  ) {
    return 'pre_battle';
  }

  if (battle.status === 'active') {
    return 'active';
  }

  if (startMs !== null && now >= startMs) {
    return 'active';
  }

  return 'idle';
}

function calculateTimer(battle: any): number {
  if (!battle) return 0;

  const phase = calculatePhase(battle);

  if (phase === 'ended') {
    return 0;
  }

  const startMs = getBattleStartMs(battle);
  const endMs = getBattleEndMs(battle);

  if (endMs !== null) {
    return Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
  }

  if (startMs !== null) {
    const durationSeconds = getBattleDurationSeconds(battle);
    const elapsed = Math.floor((Date.now() - startMs) / 1000);

    return Math.max(0, durationSeconds - elapsed);
  }

  return 0;
}

function calculateWinner(battle: any): 'A' | 'B' | 'draw' | null {
  if (!battle) return null;

  if (battle.status !== 'ended') {
    return null;
  }

  const challenger = Number(battle.score_challenger ?? 0);
  const opponent = Number(battle.score_opponent ?? 0);

  if (challenger > opponent) return 'A';
  if (opponent > challenger) return 'B';

  return 'draw';
}

export function useBattleRealtime(
  battleId: string | null | undefined,
) {
  const [state, setState] =
    useState<BattleRealtimeState>(INITIAL_STATE);

  const channelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const reconcileTimerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const databaseRefreshRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const mountedRef = useRef(true);

  const lastPhaseRef = useRef<BattlePhase>('idle');

  const lastEndSoundBattleRef =
    useRef<string | null>(null);

  const lastStartSoundBattleRef =
    useRef<string | null>(null);

  const frozenTimeoutsRef =
    useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (reconcileTimerRef.current) {
      clearInterval(reconcileTimerRef.current);
      reconcileTimerRef.current = null;
    }

    if (databaseRefreshRef.current) {
      clearInterval(databaseRefreshRef.current);
      databaseRefreshRef.current = null;
    }

    frozenTimeoutsRef.current.forEach(clearTimeout);
    frozenTimeoutsRef.current = [];
  }, []);

  const removeChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const loadBattle = useCallback(
    async (id: string) => {
      try {
        const [
          battleResult,
          participantsResult,
        ] = await Promise.all([
          supabase
            .from('battles')
            .select('*')
            .eq('id', id)
            .maybeSingle(),

          supabase
            .from('battle_participants')
            .select('*')
            .eq('battle_id', id),
        ]);

        if (!mountedRef.current) return;

        if (battleResult.error) {
          console.error(
            '[BattleRealtime] battle fetch failed',
            battleResult.error,
          );
        }

        if (participantsResult.error) {
          console.error(
            '[BattleRealtime] participant fetch failed',
            participantsResult.error,
          );
        }

        const battle = battleResult.data;
        const participants =
          participantsResult.data ?? [];

        if (!battle) {
          return;
        }

        const phase = calculatePhase(battle);
        const timerSeconds = calculateTimer(battle);
        const winner = calculateWinner(battle);

        if (
          phase === 'active' &&
          lastPhaseRef.current !== 'active' &&
          lastStartSoundBattleRef.current !== id
        ) {
          lastStartSoundBattleRef.current = id;
          BattleSounds.battleStart?.();
        }

        if (
          phase === 'ended' &&
          lastPhaseRef.current !== 'ended' &&
          lastEndSoundBattleRef.current !== id
        ) {
          lastEndSoundBattleRef.current = id;
          BattleSounds.battleEnd();
        }

        lastPhaseRef.current = phase;

        setState(prev => ({
          ...prev,
          battle,
          participants,
          phase,
          timerSeconds,
          winner,
        }));
      } catch (error) {
        console.error(
          '[BattleRealtime] loadBattle failed',
          error,
        );
      }
    },
    [],
  );

  const loadBattleStreams = useCallback(
    async (battle: any) => {
      if (!battle) return;

      const streamIds = [
        battle.team_a_stream_id,
        battle.team_b_stream_id,
        battle.challenger_stream_id,
        battle.opponent_stream_id,
      ].filter(Boolean);

      const uniqueStreamIds = [
        ...new Set(streamIds),
      ];

      if (!uniqueStreamIds.length) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('streams')
          .select('*')
          .in('id', uniqueStreamIds);

        if (error) {
          console.error(
            '[BattleRealtime] stream fetch failed',
            error,
          );
          return;
        }

        if (!mountedRef.current) return;

        const streams = data ?? [];

        const challengerId =
          battle.team_a_stream_id ??
          battle.challenger_stream_id;

        const opponentId =
          battle.team_b_stream_id ??
          battle.opponent_stream_id;

        const challengerStream =
          streams.find(
            stream => stream.id === challengerId,
          ) ?? null;

        const opponentStream =
          streams.find(
            stream => stream.id === opponentId,
          ) ?? null;

        setState(prev => ({
          ...prev,
          challengerStream,
          opponentStream,
        }));
      } catch (error) {
        console.error(
          '[BattleRealtime] loadBattleStreams failed',
          error,
        );
      }
    },
    [],
  );

  const reconcileBattle = useCallback(
    async (id: string) => {
      try {
        const { data: battle, error } = await supabase
          .from('battles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error(
            '[BattleRealtime] reconcile failed',
            error,
          );
          return;
        }

        if (!battle || !mountedRef.current) {
          return;
        }

        const phase = calculatePhase(battle);
        const timerSeconds = calculateTimer(battle);
        const winner = calculateWinner(battle);

        setState(prev => ({
          ...prev,
          battle: {
            ...prev.battle,
            ...battle,
          },
          phase,
          timerSeconds,
          winner,
        }));

        /*
         * If the database says the battle has expired but the
         * status has not yet changed, immediately reflect the
         * expiration locally.
         *
         * We do NOT invent a winner here.
         * The database remains authoritative for final scores
         * and winner distribution.
         */
        if (
          phase === 'ended' &&
          battle.status !== 'ended'
        ) {
          setState(prev => ({
            ...prev,
            phase: 'ended',
            timerSeconds: 0,
          }));
        }

        await loadBattleStreams(battle);
      } catch (error) {
        console.error(
          '[BattleRealtime] reconcile exception',
          error,
        );
      }
    },
    [loadBattleStreams],
  );

  useEffect(() => {
    clearTimers();
    removeChannel();

    if (!battleId) {
      setState(INITIAL_STATE);      
      lastPhaseRef.current = 'idle';
      lastEndSoundBattleRef.current = null;
      lastStartSoundBattleRef.current = null;
      return;
    }

    let cancelled = false;

    setState(prev => ({
      ...INITIAL_STATE,
      battle: prev.battle,
    }));

    /*
     * Initial database load.
     *
     * This is critical because realtime events are not guaranteed
     * to arrive if the battle was created before this component
     * mounted.
     */
    void loadBattle(battleId).then(async () => {
      if (cancelled || !mountedRef.current) return;

      const { data: battle } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .maybeSingle();

      if (battle) {
        await loadBattleStreams(battle);
      }
    });

    const channelName =
      `battle-all:${battleId}:${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const channel =
      supabase.channel(channelName);

    /*
     * BATTLE DATABASE UPDATES
     */
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battles',
        filter: `id=eq.${battleId}`,
      },
      async payload => {
        if (!mountedRef.current) return;

        const battle = payload.new;

        if (!battle) return;

        const phase = calculatePhase(battle);
        const timerSeconds = calculateTimer(battle);
        const winner = calculateWinner(battle);

        setState(prev => ({
          ...prev,
          battle: {
            ...prev.battle,
            ...battle,
          },
          phase,
          timerSeconds,
          winner,
        }));

        await loadBattleStreams(battle);
      },
    );

    /*
     * PARTICIPANT CHANGES
     */
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'battle_participants',
        filter: `battle_id=eq.${battleId}`,
      },
      async () => {
        if (!mountedRef.current) return;

        const { data } = await supabase
          .from('battle_participants')
          .select('*')
          .eq('battle_id', battleId);

        if (!mountedRef.current) return;

        setState(prev => ({
          ...prev,
          participants: data ?? [],
        }));

        await reconcileBattle(battleId);
      },
    );

    /*
     * STREAM CHANGES
     *
     * This is important for the "other broadcaster track isn't
     * shown" problem.
     *
     * We listen for both streams and reload them whenever the
     * stream row changes.
     */
    const streamIdsRef = {
      a: null as string | null,
      b: null as string | null,
    };

    channel.on(
      'broadcast',
      { event: 'stream_update' },
      async payload => {
        if (!mountedRef.current) return;

        const streamId =
          payload?.payload?.stream_id;

        if (!streamId) return;

        await reconcileBattle(battleId);
      },
    );

    /*
     * ARENA READY
     */
    channel.on(
      'broadcast',
      { event: 'arena_ready' },
      payload => {
        if (!mountedRef.current) return;

        const readyAt =
          Number(
            payload?.payload?.ready_at_ms ?? 0,
          );

        if (!readyAt) return;

        setState(prev => ({
          ...prev,
          arenaReady: true,
        }));
      },
    );

    /*
     * BATTLE START
     */
    channel.on(
      'broadcast',
      { event: 'battle_start' },
      async payload => {
        if (!mountedRef.current) return;

        const duration =
          Number(
            payload?.payload?.duration ?? 0,
          );

        setState(prev => ({
          ...prev,
          phase: 'active',
          timerSeconds:
            duration > 0
              ? duration
              : calculateTimer(prev.battle),
        }));

        await reconcileBattle(battleId);
      },
    );

    /*
     * TIMER SYNC
     */
    channel.on(
      'broadcast',
      { event: 'timer_sync' },
      payload => {
        if (!mountedRef.current) return;

        const data =
          payload?.payload;

        if (!data) return;

        const timeLeft =
          Number(data.timeLeft);

        if (!Number.isFinite(timeLeft)) {
          return;
        }

        if (
          timeLeft <= 10 &&
          timeLeft > 0
        ) {
          BattleSounds.timerTick();
        }

        if (timeLeft === 15) {
          BattleSounds.suddenDeath();
        }

        setState(prev => ({
          ...prev,
          timerSeconds:
            Math.max(0, timeLeft),
          phase:
            data.battleEnded
              ? 'ended'
              : prev.phase,
        }));

        /*
         * Never trust a broadcast alone for finalization.
         * Reconcile with the database when timer reaches zero.
         */
        if (
          data.battleEnded ||
          timeLeft <= 0
        ) {
          void reconcileBattle(battleId);
        }
      },
    );

    /*
     * SCORE UPDATE
     */
    channel.on(
      'broadcast',
      { event: 'score_update' },
      payload => {
        if (!mountedRef.current) return;

        const data =
          payload?.payload;

        if (!data) return;

        BattleSounds.scoreUpdate();

        setState(prev => ({
          ...prev,
          battle: prev.battle
            ? {
                ...prev.battle,
                score_challenger:
                  data.score_challenger ??
                  prev.battle.score_challenger,

                score_opponent:
                  data.score_opponent ??
                  prev.battle.score_opponent,
              }
            : prev.battle,

          lastGift:
            data.lastGift ??
            prev.lastGift,
        }));
      },
    );

    /*
     * GIFT
     */
    channel.on(
      'broadcast',
      { event: 'gift_sent' },
      payload => {
        if (!mountedRef.current) return;

        const data =
          payload?.payload;

        if (!data) return;

        const rawTeam =
          data.team ??
          data.side ??
          data.stream_side;

        const team: 'A' | 'B' =
          rawTeam === 'B'
            ? 'B'
            : 'A';

        setState(prev => ({
          ...prev,
          lastGift: {
            username:
              data.sender_name ??
              data.sender_username ??
              'Unknown',

            amount:
              Number(data.amount ?? 0),

            team,
          },
        }));

        BattleSounds.scoreUpdate();
      },
    );

    /*
     * ABILITY
     */
    channel.on(
      'broadcast',
      { event: 'ability_used' },
      payload => {
        if (!mountedRef.current) return;

        const data =
          payload?.payload;

        if (!data) return;

        const effect = {
          id:
            data.id ??
            `${Date.now()}-${Math.random()}`,

          type:
            data.ability ??
            data.type ??
            'unknown',

          team:
            data.targetTeam === 'B'
              ? 'B' as const
              : data.targetTeam === 'A'
                ? 'A' as const
                : undefined,

          username:
            data.username ??
            data.sender_name ??
            'Unknown',

          timestamp: Date.now(),
        };

        setState(prev => ({
          ...prev,
          abilityEffects: [
            ...prev.abilityEffects,
            effect,
          ].slice(-50),
        }));

        /*
         * Keep the freeze effect local to the event.
         * Do not put undeclared fields such as frozenTeams
         * onto BattleRealtimeState.
         */
        if (
          data.ability === 'team_freeze' &&
          data.targetTeam
        ) {
          const timeout =
            setTimeout(() => {
              if (!mountedRef.current) return;

              setState(prev => ({
                ...prev,
                abilityEffects:
                  prev.abilityEffects.filter(
                    item =>
                      item.id !== effect.id,
                  ),
              }));
            }, 5000);

          frozenTimeoutsRef.current.push(
            timeout,
          );
        }
      },
    );

    /*
     * BATTLE ENDED
     */
    channel.on(
      'broadcast',
      { event: 'battle_ended' },
      async payload => {
        if (!mountedRef.current) return;

        BattleSounds.battleEnd();

        setState(prev => ({
          ...prev,
          phase: 'ended',
          timerSeconds: 0,
          winner:
            payload?.payload?.winner ??
            prev.winner,
        }));

        /*
         * Pull the final database state.
         * This gets the actual scores, winner_id,
         * end_reason, winnings, etc.
         */
        await reconcileBattle(battleId);
      },
    );

    /*
     * SUBSCRIBE
     */
    channel.subscribe(status => {
      if (import.meta.env.DEV) {
        console.debug(
          '[BattleRealtime] channel status',
          battleId,
          status,
        );
      }
    });

    channelRef.current = channel;

    /*
     * REALTIME RECONCILIATION
     *
     * This prevents the "I had to refresh" problem.
     *
     * Even if a realtime event is missed, the client checks
     * the authoritative battle row every few seconds.
     */
    databaseRefreshRef.current =
      setInterval(() => {
        if (!mountedRef.current) return;

        void reconcileBattle(battleId);
      }, DATABASE_REFRESH_INTERVAL_MS);

    /*
     * CLIENT TIMER
     *
     * This is deliberately independent from the server's
     * timer broadcast.
     *
     * The displayed timer is calculated from ends_at,
     * so it continues moving even when no timer_sync event
     * arrives.
     */
    reconcileTimerRef.current =
      setInterval(() => {
        if (!mountedRef.current) return;

        setState(prev => {
          if (!prev.battle) {
            return prev;
          }

          const phase =
            calculatePhase(prev.battle);

          const timerSeconds =
            calculateTimer(prev.battle);

          if (
            phase === 'ended' &&
            prev.phase !== 'ended'
          ) {
            if (
              lastEndSoundBattleRef.current !==
              battleId
            ) {
              lastEndSoundBattleRef.current =
                battleId;

              BattleSounds.battleEnd();
            }

            /*
             * Trigger database reconciliation
             * immediately when the client reaches zero.
             */
            void reconcileBattle(battleId);
          }

          return {
            ...prev,
            phase,
            timerSeconds,
          };
        });
      }, RECONCILE_INTERVAL_MS);

    return () => {
      cancelled = true;

      clearTimers();
      removeChannel();

      streamIdsRef.a = null;
      streamIdsRef.b = null;
    };
  }, [
    battleId,
    clearTimers,
    loadBattle,
    loadBattleStreams,
    reconcileBattle,
    removeChannel,
  ]);

  /*
   * Host helper.
   *
   * Uses the existing battle channel instead of creating another
   * long-lived channel with the same name.
   */
  const publishArenaReady = useCallback(
    async () => {
      if (!battleId) return;

      const existingChannel =
        channelRef.current;

      if (!existingChannel) {
        /*
         * If the main channel hasn't connected yet,
         * simply mark locally and let the database/realtime
         * reconciliation handle the rest.
         */
        setState(prev => ({
          ...prev,
          arenaReady: true,
        }));

        return;
      }

      const nowMs = Date.now();

      try {
        await existingChannel.send({
          type: 'broadcast',
          event: 'arena_ready',
          payload: {
            battle_id: battleId,
            ready_at_ms: nowMs,
          },
        });

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            arenaReady: true,
          }));
        }
      } catch (error) {
        console.error(
          '[BattleRealtime] arena_ready failed',
          error,
        );
      }
    },
    [battleId],
  );

  return {
    state,
    publishArenaReady,
  };
}