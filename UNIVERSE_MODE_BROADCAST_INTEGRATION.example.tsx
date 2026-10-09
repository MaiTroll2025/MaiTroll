// ============================================================================
// UNIVERSE MODE INTEGRATION EXAMPLE
// ============================================================================
// Shows how to integrate Troll Battle into BroadcastPage
// This is a reference implementation - adapt to your existing code structure

import { useTrollBattle, type BattleParticipant } from '@/hooks/useTrollBattle';
import TrollBattleRoom from '@/components/broadcast/TrollBattleRoom';

// ============================================================================
// 1. IN YOUR BROADCAST PAGE STATE
// ============================================================================

// Add these state variables to your BroadcastPage component:
const [battleActive, setBattleActive] = useState(false);
const [_battleParticipants, setBattleParticipants] = useState<BattleParticipant[]>([]);

// Initialize the battle hook
const battle = useTrollBattle({
  streamId: stream?.id || '',
  userId: user?.id || '',
  isHost: isHost
});

// ============================================================================
// 2. WHEN STREAM GOES LIVE (AND IS TROLL BATTLE MODE)
// ============================================================================

useEffect(() => {
  if (!stream || stream.category !== 'battle' || stream.battle_mode !== 'troll') {
    return; // Not a troll battle
  }

  if (stream.status === 'live' && !battleActive) {
    // Stream is live and battle mode enabled
    // Initialize participants from seated viewers
    const participants: BattleParticipant[] = [];

    // Team A seats (1-4)
    for (let i = 1; i <= 4; i++) {
      const seat = seats[i];
      if (seat?.user_id && seat.user_profile) {
        participants.push({
          userId: seat.user_id,
          username: seat.user_profile.username,
          avatarUrl: seat.user_profile.avatar_url,
          team: 'A',
          seatIndex: i,
          coinsEarned: 0,
          isActive: true,
          liveKitIdentity: `participant-${seat.user_id}`
        });
      }
    }

    // Team B seats (1-4) - In actual implementation, might come from opponent stream
    // For demo, just show how structure works:
    for (let i = 1; i <= 4; i++) {
      const seat = seats[i + 4]; // Seats 5-8 for team B
      if (seat?.user_id && seat.user_profile) {
        participants.push({
          userId: seat.user_id,
          username: seat.user_profile.username,
          avatarUrl: seat.user_profile.avatar_url,
          team: 'B',
          seatIndex: i,
          coinsEarned: 0,
          isActive: true,
          liveKitIdentity: `participant-${seat.user_id}`
        });
      }
    }

    if (participants.length >= 8) {
      // Enough participants, start battle
      setBattleParticipants(participants);
      battle.startBattle(participants);
      setBattleActive(true);
    }
  }
}, [stream?.status, stream?.battle_mode]);

// ============================================================================
// 3. WHEN GIFTS ARE RECEIVED (ADD TO TEAM SCORE)
// ============================================================================

// In your existing gift-received handler:
const _handleGiftReceived = useCallback((gift: GiftData) => {
  // ... existing gift logic ...

  // If troll battle is active, update scores
  if (battleActive && battle.state.phase === 'active') {
    const recipient = battle.state.participants.find(p => p.userId === gift.recipientId);
    
    if (recipient) {
      // Add gift value to recipient's team score
      const giftValue = gift.coinValue || 10;
      battle.addScore(recipient.team, giftValue);
      
      // Update individual participant coins earned
      const newCoinsEarned = recipient.coinsEarned + giftValue;
      battle.updateParticipantCoins(recipient.userId, newCoinsEarned);

      // Visual feedback
      toast.success(`+${giftValue} points to Team ${recipient.team}!`);
    }
  }
}, [battleActive, battle.state.phase, battle.state.participants]);

// ============================================================================
// 4. RENDER THE BATTLE UI
// ============================================================================

// Render the TrollBattleRoom component (fullscreen overlay):
return (
  <>
    {/* ... existing broadcast UI ... */}

    {battleActive && (
      <TrollBattleRoom
        battleId={battle.state.battleId || ''}
        isHost={isHost}
        participants={battle.state.participants}
        remoteParticipants={remoteParticipants} // From your existing LiveKit setup
        teamAScore={battle.state.teamAScore}
        teamBScore={battle.state.teamBScore}
        timerSeconds={battle.state.timerSeconds}
        isActive={battle.state.active}
        phase={battle.state.phase}
        winningTeam={battle.state.winner}
        onForfeit={() => {
          battle.forfeitBattle();
          setBattleActive(false);
        }}
        onRematch={() => {
          battle.requestRematch();
        }}
        onClose={() => {
          setBattleActive(false);
          // Clear battle data
          setBattleParticipants([]);
        }}
        rematchAccepted={battle.state.rematchAccepted}
      />
    )}
  </>
);

// ============================================================================
// 5. WHEN PARTICIPANT JOINS A SEAT
// ============================================================================

// In your seat-join handler:
const _handleUserJoinSeat = useCallback((userId: string, seatIndex: number) => {
  // ... existing seat logic ...

  // If battle active, update participants
  if (battleActive && battle.state.phase === 'active') {
    const isTeamA = seatIndex <= 4;
    const team = isTeamA ? 'A' : 'B';
    const seatInTeam = isTeamA ? seatIndex : seatIndex - 4;

    // Check if participant already exists
    const existing = battle.state.participants.find(p => p.userId === userId);
    if (existing) return; // Already in battle

    // Add new participant
    const profile = {}; // fetch user profile from database
    const newParticipant: BattleParticipant = {
      userId,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      team,
      seatIndex: seatInTeam,
      coinsEarned: 0,
      isActive: true,
      liveKitIdentity: `participant-${userId}`
    };

    setBattleParticipants(prev => [...prev, newParticipant]);
  }
}, [battleActive, battle.state.phase]);

// ============================================================================
// 6. WHEN PARTICIPANT LEAVES
// ============================================================================

// In your seat-leave handler:
const _handleUserLeaveSeat = useCallback((userId: string) => {
  // ... existing seat logic ...

  // Mark as inactive in battle
  if (battleActive) {
    setBattleParticipants(prev =>
      prev.map(p => 
        p.userId === userId ? { ...p, isActive: false } : p
      )
    );
  }
}, [battleActive]);

// ============================================================================
// 8. BATTLE PHASE MONITORING
// ============================================================================

// Monitor battle state and update stream record
useEffect(() => {
  if (!stream || !battleActive) return;

  const updateStreamState = async () => {
    await supabase
      .from('streams')
      .update({
        is_battle: battle.state.active,
        battle_status: battle.state.phase,
        side_a_score: battle.state.teamAScore,
        side_b_score: battle.state.teamBScore
      })
      .eq('id', stream.id);
  };

  updateStreamState();
}, [battle.state.phase, battle.state.teamAScore, battle.state.teamBScore]);

// ============================================================================
// KEY INTEGRATION POINTS SUMMARY
// ============================================================================

/*
1. Initialize hook with stream/user data
2. When stream goes live + battle mode enabled:
   - Collect 8 seated participants (4 per team)
   - Call battle.startBattle(participants)
   
3. When gifts received:
   - Find recipient's team
   - Call battle.addScore(team, amount)
   - Call battle.updateParticipantCoins(userId, amount)

4. When participant joins/leaves seat:
   - Update battle.state.participants
   - Reflect in UI immediately

5. Real-time sync:
   - Supabase channels broadcast every 1s
   - All viewers see score updates
   - Timer synced across devices

6. Battle end:
   - battle.state.phase === 'ended'
   - Rewards automatically awarded
   - Show results overlay (10s)

7. Rematch:
   - User clicks "Rematch?"
   - battle.requestRematch()
   - Auto-start if both teams accept
   - Reset scores, timer, participants

8. Forfeit:
   - User clicks "Forfeit"
   - battle.forfeitBattle()
   - Opposite team wins immediately
   - Awards applied
*/
