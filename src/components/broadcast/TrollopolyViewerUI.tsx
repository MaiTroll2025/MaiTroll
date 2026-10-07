// src/components/broadcast/TrollopolyViewerUI.tsx
// Viewer UI for Trollopoly (shown to non-player viewers)

import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Users, Dice5, Crown, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrollopolyPlayer } from '@/lib/game/gameTypes';
import type { TrollopolyMatch } from '@/stores/trollopolyStore';

interface TrollopolyViewerUIProps {
  match: TrollopolyMatch;
  currentUserId?: string;
  userBalance?: number;
  onClose?: () => void;
}

export default function TrollopolyViewerUI({
  match,
  currentUserId,
  userBalance = 0,
  onClose,
}: TrollopolyViewerUIProps) {
  if (match.phase === 'lobby' || match.phase === 'piece_selection') {
    return <TrollopolyLobbyViewer match={match} currentUserId={currentUserId} />;
  }

  const currentPlayer = match.players[match.currentTurnIndex];
  const isGameOver = match.status === 'finished';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 z-40 w-72 bg-zinc-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
        <div className="flex items-center gap-2">
          <Dice5 size={14} className="text-amber-400" />
          <span className="text-xs font-black text-white uppercase tracking-wider">Trollopoly</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50">Watching</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
              title="Close game panel"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Current Turn */}
      {currentPlayer && match.status === 'active' && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-white/80">
              <span className="font-bold text-amber-400">{currentPlayer.username}</span>&apos;s turn
            </span>
          </div>
          
          {/* Last dice roll */}
          {match.lastDiceRoll && (
            <div className="mt-2 flex items-center gap-2">
              <Dice5 size={12} className="text-white/50" />
              <span className="text-xs text-white/50">Rolled:</span>
              <span className="text-lg font-black text-white">{match.lastDiceRoll}</span>
            </div>
          )}
        </div>
      )}

      {/* Players */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users size={12} className="text-white/50" />
          <span className="text-[10px] text-white/50 uppercase tracking-wider">Players</span>
        </div>
        
        <div className="space-y-1.5">
          {match.players.map((player, index) => (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between px-2 py-1.5 rounded-lg',
                index === match.currentTurnIndex && match.status === 'active' 
                  ? 'bg-amber-500/10 border border-amber-500/20' 
                  : 'bg-white/5'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  player.id === currentUserId 
                    ? 'bg-green-500/30 text-green-400' 
                    : player.id === currentPlayer?.id
                      ? 'bg-amber-500/30 text-amber-400'
                      : 'bg-white/10 text-white/60'
                )}>
                  {player.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-white/80 truncate max-w-[100px]">
                  {player.username}
                  {player.id === currentUserId && <span className="text-green-400 ml-1">(You)</span>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign size={10} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400">{player.balance}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Winner announcement */}
      {isGameOver && match.winnerId && (
        <div className="px-4 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-t border-amber-500/30">
          <div className="flex items-center justify-center gap-2">
            <Crown size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-white">
              Winner: {match.players.find(p => p.id === match.winnerId)?.username || 'Unknown'}
            </span>
          </div>
        </div>
      )}

      {/* Game Over message */}
      {isGameOver && !match.winnerId && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/30">
          <span className="text-sm font-bold text-red-400">Game Over - All Bankrupt!</span>
        </div>
      )}
    </motion.div>
  );
}

// Separate lobby viewer component
function TrollopolyLobbyViewer({ match, currentUserId }: { match: TrollopolyMatch; currentUserId?: string }) {
  const isInGame = match.players.some(p => p.id === currentUserId);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 z-40 w-64 bg-zinc-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
        <div className="flex items-center gap-2">
          <Dice5 size={14} className="text-amber-400" />
          <span className="text-xs font-black text-white uppercase tracking-wider">Trollopoly</span>
        </div>
        {match.phase === 'lobby' && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[8px] font-bold text-red-400">{match.countdownRemaining}s</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-xs text-white/60 text-center mb-3">
          {match.phase === 'lobby' 
            ? 'Join the game before it starts!'
            : 'Selecting pieces...'}
        </p>
        
        {/* Players */}
        <div className="space-y-1">
          {match.players.map((player) => (
            <div key={player.id} className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-400">
                  {player.username[0].toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-white/80 truncate flex-1">
                {player.username}
                {player.id === match.players[0].id && <span className="text-purple-400 ml-1">Host</span>}
              </span>
            </div>
          ))}
          
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - match.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-2 px-2 py-1 bg-white/5/30 rounded-lg border border-dashed border-white/10">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                <Eye size={10} className="text-white/30" />
              </div>
              <span className="text-xs text-white/30">Empty slot</span>
            </div>
          ))}
        </div>
        
         <p className="text-[10px] text-white/40 text-center mt-3">
           {match.players.length}/4 players • Min 2 to start
         </p>
      </div>
    </motion.div>
  );
}
