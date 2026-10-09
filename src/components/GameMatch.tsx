import React, { useEffect, useState, useRef } from 'react';
import { MatchController } from '@/lib/game/MatchController';
import { GameState } from '@/lib/game/types';
import { useAuthStore } from '@/lib/store';
import { GameType } from '@/lib/game/gameTypes';

interface GameMatchProps {
  matchId: string;
  gameType: GameType;
  onMatchEnd: (winnerId?: string) => void;
}

const GameMatch: React.FC<GameMatchProps> = ({ matchId, gameType, onMatchEnd }) => {
  const { user } = useAuthStore();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const legacyControllerRef = useRef<MatchController | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setError('User not authenticated.');
      return;
    }

    const controller = new MatchController({
      matchId,
      gameType,
      userId: user.id,
      onStateChange: (newState) => {
        setGameState(newState);
      },
      onMatchEnd: (winnerId) => {
        onMatchEnd(winnerId);
        legacyControllerRef.current?.dispose();
      },
    });
    legacyControllerRef.current = controller;

    controller.init().catch((err) => {
      console.error('Failed to initialize MatchController:', err);
      setError(err.message || 'Failed to initialize game.');
    });

    return () => {
      controller.dispose();
    };
  }, [matchId, gameType, user?.id, onMatchEnd]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold text-white mb-4">
          Game Match
        </h2>
        <p className="text-slate-400 mb-6">
          Match {matchId.slice(0, 8)} is active.
        </p>
        <button
          onClick={() => onMatchEnd()}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold"
        >
          Back to Games
        </button>
      </div>
    </div>
  );
};

export default GameMatch;