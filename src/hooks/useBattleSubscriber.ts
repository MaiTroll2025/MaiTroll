import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface BattleSubscriberState {
  active: boolean;
  battleId: string | null;
  phase: 'idle' | 'pre_battle' | 'active' | 'ended';
  teamAScore: number;
  teamBScore: number;
  teamAGiftCount: number;
  teamBGiftCount: number;
  timerSeconds: number;
  totalDuration: number;
  participants: any[];
  frozenTeams: { A: boolean; B: boolean };
  doubleXpTeams: { A: boolean; B: boolean };
  lastGiftUser: { username: string; amount: number; team: 'A' | 'B' } | null;
  winner: 'A' | 'B' | 'draw' | null;
  rematchAccepted: { A: boolean; B: boolean };
  rematchCountdown: number;
  abilityEffects: Array<{ id: string; type: string; team?: 'A' | 'B'; username: string; timestamp: number }>;
}

const INITIAL: BattleSubscriberState = {
  active: false,
  battleId: null,
  phase: 'idle',
  teamAScore: 0,
  teamBScore: 0,
  teamAGiftCount: 0,
  teamBGiftCount: 0,
  timerSeconds: 0,
  totalDuration: 180,
  participants: [],
  frozenTeams: { A: false, B: false },
  doubleXpTeams: { A: false, B: false },
  lastGiftUser: null,
  winner: null,
  rematchAccepted: { A: false, B: false },
  rematchCountdown: 0,
  abilityEffects: [],
};

export function useBattleSubscriber(stream: any) {
  const [state, setState] = useState<BattleSubscriberState>(INITIAL);
  const channelsRef = useRef<any[]>([]);
  const currentBattleIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearTimer();
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];
    currentBattleIdRef.current = null;
  }, [clearTimer]);

  useEffect(() => {
    const isBattle = stream?.is_battle;
    const battleId = stream?.battle_id;

    if (isBattle && battleId) {
      if (currentBattleIdRef.current === battleId) return;

      cleanup();

      const setupChannel = async () => {
        let initialParticipants: any[] = [];
        let isOneVOne = false;
        let battleData: any = null;
        try {
          const { data: session } = await supabase
            .from('battle_sessions')
            .select('*')
            .or(`stream_id_a.eq.${stream.id},stream_id_b.eq.${stream.id}`)
            .in('status', ['pre_battle', 'active'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (session?.participants) {
            initialParticipants = typeof session.participants === 'string'
              ? JSON.parse(session.participants)
              : session.participants;
          }
        } catch (e) {
          console.warn('[BattleSubscriber] Could not fetch battle session:', e);
        }

        if (initialParticipants.length === 0) {
          try {
            const { data: battle } = await supabase
              .from('battles')
              .select('*')
              .eq('id', battleId)
              .in('status', ['active', 'pending'])
              .maybeSingle();

            if (battle) {
              isOneVOne = true;
              battleData = battle;
              const [cStream, oStream] = await Promise.all([
                supabase.from('streams').select('user_id').eq('id', battle.challenger_stream_id).maybeSingle(),
                supabase.from('streams').select('user_id').eq('id', battle.opponent_stream_id).maybeSingle(),
              ]);
              initialParticipants = [
                { userId: cStream?.data?.user_id, team: 'A', role: 'host' },
                { userId: oStream?.data?.user_id, team: 'B', role: 'host' },
              ].filter(p => p.userId);

              let timerSeconds = 5;
              let phase: 'pre_battle' | 'active' = 'pre_battle';

              if (battle.status === 'pending' && battle.scheduled_start_at) {
                timerSeconds = Math.max(0, Math.floor((new Date(battle.scheduled_start_at).getTime() - Date.now()) / 1000));
                phase = 'pre_battle';
              } else if (battle.status === 'active' && battle.started_at) {
                timerSeconds = Math.max(0, 180 - Math.floor((Date.now() - new Date(battle.started_at).getTime()) / 1000));
                phase = 'active';
              }

              setState({
                active: true,
                battleId,
                phase,
                teamAScore: battle.score_challenger || 0,
                teamBScore: battle.score_opponent || 0,
                teamAGiftCount: 0,
                teamBGiftCount: 0,
                timerSeconds,
                totalDuration: 180,
                participants: initialParticipants,
                frozenTeams: { A: false, B: false },
                doubleXpTeams: { A: false, B: false },
                lastGiftUser: null,
                winner: null,
                rematchAccepted: { A: false, B: false },
                rematchCountdown: 0,
                abilityEffects: [],
              });
              return;
            }
          } catch (e) {
            console.warn('[BattleSubscriber] Could not fetch 1v1 battle:', e);
          }
        }

        if (initialParticipants.length > 0) {
          const timerSeconds = isOneVOne && battleData?.started_at
            ? Math.max(0, 180 - Math.floor((Date.now() - new Date(battleData.started_at).getTime()) / 1000))
            : 5;
          setState({
            active: true,
            battleId,
            phase: isOneVOne ? 'active' : 'pre_battle',
            teamAScore: isOneVOne ? (battleData?.score_challenger || 0) : 0,
            teamBScore: isOneVOne ? (battleData?.score_opponent || 0) : 0,
            teamAGiftCount: 0,
            teamBGiftCount: 0,
            timerSeconds: isOneVOne ? timerSeconds : 5,
            totalDuration: 180,
            participants: initialParticipants,
            frozenTeams: { A: false, B: false },
            doubleXpTeams: { A: false, B: false },
            lastGiftUser: null,
            winner: null,
            rematchAccepted: { A: false, B: false },
            rematchCountdown: 0,
            abilityEffects: [],
          });
        }

        // Single unified battle channel: broadcasts for 5v5 events + postgres_changes for 1v1 score updates + timer_sync
        const battleChannel = supabase.channel(`battle-live:${battleId}`);

        // 5v5 broadcast events
        battleChannel.on('broadcast', { event: '*' }, (payload) => {
          const { event, payload: data } = payload;
          switch (event) {
            case 'battle_found': {
              setState(prev => ({
                ...prev,
                active: true,
                battleId: data.battleId,
                phase: 'pre_battle',
                teamAScore: 0,
                teamBScore: 0,
                teamAGiftCount: 0,
                teamBGiftCount: 0,
                timerSeconds: data.countdownSeconds || 10,
                totalDuration: 180,
                participants: data.participants || [],
                frozenTeams: { A: false, B: false },
                doubleXpTeams: { A: false, B: false },
                lastGiftUser: null,
                winner: null,
                rematchAccepted: { A: false, B: false },
                rematchCountdown: 0,
              }));
              break;
            }
            case 'battle_start': {
              setState(prev => ({
                ...prev,
                phase: 'active',
                timerSeconds: data.duration || 180,
                totalDuration: data.duration || 180,
              }));
              break;
            }
            case 'timer_sync': {
              setState(prev => {
                const newPhase = data.phase === 'pre_battle' && data.remaining <= 0
                  ? 'active'
                  : prev.phase;
                return {
                  ...prev,
                  timerSeconds: data.remaining,
                  ...(newPhase !== prev.phase ? {
                    phase: newPhase as any,
                    timerSeconds: newPhase === 'active' ? (prev.totalDuration || 180) : data.remaining,
                  } : {}),
                };
              });
              break;
            }
            case 'gift_scored': {
              setState(prev => {
                const teamKey = data.team === 'A' ? 'teamAScore' : 'teamBScore';
                const giftCountKey = data.team === 'A' ? 'teamAGiftCount' : 'teamBGiftCount';
                return {
                  ...prev,
                  [teamKey]: prev[teamKey] + data.score,
                  [giftCountKey]: prev[giftCountKey] + 1,
                  lastGiftUser: {
                    username: data.senderName,
                    amount: data.giftAmount,
                    team: data.team,
                  },
                };
              });
              break;
            }
            case 'ability_used': {
              const targetRef = { current: false };
              if (data.ability === 'team_freeze' && data.targetTeam) {
                const freezeKey = data.targetTeam === 'A' ? 'A' : 'B';
                setState(prev => ({
                  ...prev,
                  frozenTeams: { ...prev.frozenTeams, [freezeKey]: true },
                }));
                targetRef.current = true;
                setTimeout(() => {
                  setState(prev => ({
                    ...prev,
                    frozenTeams: { ...prev.frozenTeams, [freezeKey]: false },
                  }));
                }, 5000);
              } else if (data.ability === 'double_xp') {
                const dxpKey = data.team === 'A' ? 'A' : 'B';
                setState(prev => ({
                  ...prev,
                  doubleXpTeams: { ...prev.doubleXpTeams, [dxpKey]: true },
                }));
                setTimeout(() => {
                  setState(prev => ({
                    ...prev,
                    doubleXpTeams: { ...prev.doubleXpTeams, [dxpKey]: false },
                  }));
                }, 10000);
              }
              break;
            }
            case 'battle_ended': {
              clearTimer();
              setState(prev => ({
                ...prev,
                phase: 'ended',
                winner: data.winner,
                active: false,
                teamAScore: data.teamAScore,
                teamBScore: data.teamBScore,
              }));
              break;
            }
            case 'ability_visual': {
              if (data.effect) {
                setState(prev => ({
                  ...prev,
                  abilityEffects: [...prev.abilityEffects, data.effect],
                }));
                const effectId = data.effect.id;
                setTimeout(() => {
                  setState(prev => ({
                    ...prev,
                    abilityEffects: prev.abilityEffects.filter(e => e.id !== effectId),
                  }));
                }, 3000);
              }
              break;
            }
          }
        });

        // 1v1 postgres_changes for score/timer updates
        battleChannel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'battles',
          filter: `id=eq.${battleId}`
        }, (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'active') {
            const timerSecs = updated.started_at
              ? Math.max(0, 180 - Math.floor((Date.now() - new Date(updated.started_at).getTime()) / 1000))
              : 0;
            setState(prev => ({
              ...prev,
              active: true,
              phase: 'active',
              teamAScore: updated.score_challenger || 0,
              teamBScore: updated.score_opponent || 0,
              timerSeconds: timerSecs,
            }));
          } else if (updated.status === 'ended') {
            setState(prev => ({
              ...prev,
              phase: 'ended',
              active: false,
              winner: updated.score_challenger > updated.score_opponent ? 'A' :
                      updated.score_opponent > updated.score_challenger ? 'B' : 'draw',
              teamAScore: updated.score_challenger || 0,
              teamBScore: updated.score_opponent || 0,
            }));
          }
        });

        battleChannel.subscribe();
        channelsRef.current = [battleChannel];
        currentBattleIdRef.current = battleId;
      };

      setupChannel();

    } else if (!isBattle && currentBattleIdRef.current) {
      cleanup();
      setState(INITIAL);
    }
  }, [stream?.is_battle, stream?.battle_id, cleanup, clearTimer, stream.id]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const resetBattle = useCallback(() => {
    cleanup();
    setState(INITIAL);
  }, [cleanup]);

  return { state, resetBattle };
}
