import { useEffect, useRef, useState } from 'react';

export function useJailTimeState(
  challengerScore: number,
  opponentScore: number,
  battleActive: boolean
) {
  const [challengerLosing, setChallengerLosing] = useState(false);
  const [opponentLosing, setOpponentLosing] = useState(false);
  const [leadChanged, setLeadChanged] = useState(false);
  const prevLeaderRef = useRef<'challenger' | 'opponent' | 'tie' | null>(null);

  useEffect(() => {
    if (!battleActive) {
      setChallengerLosing(false);
      setOpponentLosing(false);
      setLeadChanged(false);
      prevLeaderRef.current = null;
      return;
    }

    const currentLeader: 'challenger' | 'opponent' | 'tie' =
      challengerScore > opponentScore ? 'challenger' :
      opponentScore > challengerScore ? 'opponent' : 'tie';

    const prevLeader = prevLeaderRef.current;
    const didLeadChange = prevLeader !== null && currentLeader !== prevLeader && currentLeader !== 'tie';
    setLeadChanged(didLeadChange);
    prevLeaderRef.current = currentLeader;

    setChallengerLosing(opponentScore > challengerScore);
    setOpponentLosing(challengerScore > opponentScore);

    if (didLeadChange) {
      const timer = setTimeout(() => setLeadChanged(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [challengerScore, opponentScore, battleActive]);

  return { challengerLosing, opponentLosing, leadChanged };
}
