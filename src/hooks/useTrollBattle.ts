import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface BattleParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
  team: 'A' | 'B';
  seatIndex: number;
  coinsEarned: number;
  isActive: boolean;
  liveKitIdentity?: string;
}

export interface TrollBattleState {
  phase: 'idle' | 'pre_battle' | 'active' | 'ended';
  battleId: string | null;
  active: boolean;
  participants: BattleParticipant[];
  teamAScore: number;
  teamBScore: number;
  timerSeconds: number;
  winner: 'A' | 'B' | 'draw' | null;
  rematchAccepted: { A: boolean; B: boolean };
  rematchCountdown: number;
}

interface UseTrollBattleProps {
  streamId: string;
  userId: string;
  isHost: boolean;
}

const BATTLE_DURATION = 180; // 3 minutes
const PRE_BATTLE_COUNTDOWN = 5; // 5 seconds

export function useTrollBattle({ streamId: _streamId, userId, isHost }: UseTrollBattleProps) {
  const [state, setState] = useState<TrollBattleState>({
    phase: 'idle',
    battleId: null,
    active: false,
    participants: [],
    teamAScore: 0,
    teamBScore: 0,
    timerSeconds: BATTLE_DURATION,
    winner: null,
    rematchAccepted: { A: false, B: false },
    rematchCountdown: 0
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const battleChannelRef = useRef<any>(null);
  const stateRef = useRef(state);
  const startCountdownRef = useRef<(duration: number, onComplete: () => void) => void>(() => {});
  const startBattleTimerRef = useRef<() => void>(() => {});
  const subscribeToBattleChannelRef = useRef<(battleId: string) => void>(() => {});
  const endBattleRef = useRef<() => Promise<void>>(async () => {});
  const awardBattleRewardsRef = useRef<(winner: 'A' | 'B' | 'draw') => Promise<void>>(async () => {});
  const broadcastBattleStateRef = useRef<(event: string, payload: any) => void>(() => {});

  // Keep ref in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Start battle
  const startBattle = useCallback(async (participants: BattleParticipant[]) => {
    const battleId = `battle-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    setState(prev => ({
      ...prev,
      battleId,
      phase: 'pre_battle',
      active: true,
      participants,
      timerSeconds: PRE_BATTLE_COUNTDOWN,
      teamAScore: 0,
      teamBScore: 0,
      winner: null,
      rematchAccepted: { A: false, B: false }
    }));

    // Start pre-battle countdown
    startCountdownRef.current(PRE_BATTLE_COUNTDOWN, () => {
      setState(prev => ({
        ...prev,
        phase: 'active',
        timerSeconds: BATTLE_DURATION
      }));
      startBattleTimerRef.current();
    });

    // Subscribe to battle channel
    subscribeToBattleChannelRef.current(battleId);

    return battleId;
  }, []);

  // Pre-battle countdown
  const startCountdown = useCallback((duration: number, onComplete: () => void) => {
    let remaining = duration;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      remaining--;
      setState(prev => ({
        ...prev,
        timerSeconds: remaining
      }));

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onComplete();
      }
    }, 1000);
  }, []);

  // Main battle timer (3 minutes)
  const startBattleTimer = useCallback(() => {
    let remaining = BATTLE_DURATION;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      remaining--;
      setState(prev => ({
        ...prev,
        timerSeconds: remaining
      }));

      // Broadcast score update every second
      const currentState = stateRef.current;
      if (currentState.battleId) {
      broadcastBattleStateRef.current('score_update', {
        teamAScore: currentState.teamAScore,
        teamBScore: currentState.teamBScore,
        timerSeconds: remaining
      });
      }

      // Battle ends
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        void endBattleRef.current();
      }
    }, 1000);
  }, []);

  // Add score to team
  const addScore = useCallback((team: 'A' | 'B', amount: number) => {
    if (state.phase !== 'active') return;

    setState(prev => ({
      ...prev,
      [team === 'A' ? 'teamAScore' : 'teamBScore']: 
        (team === 'A' ? prev.teamAScore : prev.teamBScore) + amount
    }));

    // Broadcast to other participants
    if (state.battleId) {
      broadcastBattleStateRef.current('score_update', {
        teamAScore: state.teamAScore + (team === 'A' ? amount : 0),
        teamBScore: state.teamBScore + (team === 'B' ? amount : 0)
      });
    }
  }, [state]);

  // Update participant coins
  const updateParticipantCoins = useCallback((participantId: string, coinsEarned: number) => {
    setState(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.userId === participantId
          ? { ...p, coinsEarned }
          : p
      )
    }));
  }, []);

  // End battle
  const endBattle = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Determine winner
    const currentState = stateRef.current;
    const winner: 'A' | 'B' | 'draw' = 
      currentState.teamAScore > currentState.teamBScore ? 'A' :
      currentState.teamBScore > currentState.teamAScore ? 'B' :
      'draw';

    setState(prev => ({
      ...prev,
      phase: 'ended',
      winner,
      active: false
    }));

    // Award rewards
    if (isHost && currentState.battleId) {
      await awardBattleRewardsRef.current(winner);
    }

    // Broadcast battle end
    if (currentState.battleId) {
      broadcastBattleStateRef.current('battle_ended', {
        winner,
        teamAScore: currentState.teamAScore,
        teamBScore: currentState.teamBScore
      });
    }
  }, [isHost]);

  // Award crowns and bonus coins to winners
  const awardBattleRewards = useCallback(async (winner: 'A' | 'B' | 'draw') => {
    if (winner === 'draw') return;

    const currentState = stateRef.current;
    const winningParticipants = currentState.participants.filter(p => p.team === winner);

    for (const participant of winningParticipants) {
      try {
        // Award crowns
        const { error: crownError } = await supabase
          .from('user_profiles')
          .update({
            battle_crowns: supabase.rpc('increment_user_crowns', { p_user_id: participant.userId, p_amount: 2 })
          })
          .eq('id', participant.userId);

        if (crownError) console.error('Error awarding crowns:', crownError);

        // Award 2% bonus coins
        const bonusCoins = Math.floor(participant.coinsEarned * 0.02);
        if (bonusCoins > 0) {
          const { error: coinError } = await supabase
            .from('coin_transactions')
            .insert({
              user_id: participant.userId,
              amount: bonusCoins,
              type: 'battle_bonus',
              metadata: { battle_id: currentState.battleId, bonus_percentage: 2 }
            });

          if (coinError) console.error('Error awarding bonus coins:', coinError);
        }
      } catch (err) {
        console.error('Error awarding rewards:', err);
      }
    }
  }, []);

  // Request rematch
  const requestRematch = useCallback(() => {
    if (state.phase !== 'ended') return;

    const userTeam = state.participants.find(p => p.userId === userId)?.team;
    if (!userTeam) return;

    setState(prev => ({
      ...prev,
      rematchAccepted: {
        ...prev.rematchAccepted,
        [userTeam]: true
      }
    }));

    // Broadcast rematch request
    if (state.battleId) {
      broadcastBattleStateRef.current('rematch_requested', { team: userTeam });
    }

    // Check if both teams accepted
    setTimeout(() => {
      const newState = stateRef.current;
      if (newState.rematchAccepted.A && newState.rematchAccepted.B) {
        // Auto-start new battle
        startBattle(newState.participants);
      }
    }, 100);
  }, [state, userId, startBattle]);

  // Forfeit battle
  const forfeitBattle = useCallback(async () => {
    if (state.phase !== 'active') return;

    if (timerRef.current) clearInterval(timerRef.current);

    const userParticipant = state.participants.find(p => p.userId === userId);
    if (!userParticipant) return;

    const forfeitingTeam = userParticipant.team;
    const winner = forfeitingTeam === 'A' ? 'B' : 'A';

    setState(prev => ({
      ...prev,
      phase: 'ended',
      winner,
      active: false
    }));

    // Award rewards to winning team
    if (isHost) {
      await awardBattleRewards(winner);
    }

    // Broadcast forfeit
    if (state.battleId) {
      broadcastBattleStateRef.current('battle_ended', {
        winner,
        forfeited: true,
        forfeitingTeam,
        teamAScore: state.teamAScore,
        teamBScore: state.teamBScore
      });
    }
  }, [state, userId, isHost, awardBattleRewards]);

  // Subscribe to real-time battle updates
  const subscribeToBattleChannel = useCallback((battleId: string) => {
    const channel = supabase.channel(`battle:${battleId}`);

    channel
      .on('broadcast', { event: 'score_update' }, (payload) => {
        setState(prev => ({
          ...prev,
          teamAScore: payload.payload.teamAScore,
          teamBScore: payload.payload.teamBScore,
          timerSeconds: payload.payload.timerSeconds
        }));
      })
      .on('broadcast', { event: 'rematch_requested' }, (payload) => {
        setState(prev => ({
          ...prev,
          rematchAccepted: {
            ...prev.rematchAccepted,
            [payload.payload.team]: true
          }
        }));
      })
      .on('broadcast', { event: 'battle_ended' }, (payload) => {
        setState(prev => ({
          ...prev,
          phase: 'ended',
          winner: payload.payload.winner,
          active: false
        }));
      })
      .subscribe();

    battleChannelRef.current = channel;
  }, []);

  // Broadcast battle state to all participants
  const broadcastBattleState = useCallback((event: string, payload: any) => {
    if (!battleChannelRef.current) return;

    battleChannelRef.current.send({
      type: 'broadcast',
      event,
      payload
    });
  }, []);

  startCountdownRef.current = startCountdown;
  startBattleTimerRef.current = startBattleTimer;
  subscribeToBattleChannelRef.current = subscribeToBattleChannel;
  endBattleRef.current = endBattle;
  awardBattleRewardsRef.current = awardBattleRewards;
  broadcastBattleStateRef.current = broadcastBattleState;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (battleChannelRef.current) {
        battleChannelRef.current.unsubscribe();
      }
    };
  }, []);

  return {
    state,
    startBattle,
    addScore,
    updateParticipantCoins,
    endBattle,
    requestRematch,
    forfeitBattle,
    broadcastBattleState
  };
}
