import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Gamepad2, Users, Play, Pause, SkipForward, Trophy, 
  AlertTriangle, X, Crown, Vote, HandMetal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTrollUsGame, GamePlayer } from '@/hooks/useTrollUsGame'
import { useAuthStore } from '@/lib/store'

interface TrollUsGameControllerProps {
  streamId: string
  onClose: () => void
}

export default function TrollUsGameController({ 
  streamId, 
  onClose 
}: TrollUsGameControllerProps) {
  const { 
    gameState, 
    isLoading, 
    createGame, 
    joinSeat, 
    startGame, 
    submitVote,
    endRound, 
    endGame,
    myRole
  } = useTrollUsGame({ streamId })

  const { user } = useAuthStore()

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)

  const {
    gameId,
    status,
    currentRound,
    prizePool,
    winnerTeam,
    players,
    isHost,
    isSeated,
    isEliminated,
    isMuted
  } = gameState

  // Available seats (0-8 for 9 slots)
  const seatedIndices = players.filter(p => p.is_seated).map(p => p.seat_index)
  const availableSeats = Array.from({ length: 9 }, (_, i) => i).filter(i => !seatedIndices.includes(i))

  // Handle joining a seat
  const handleJoinSeat = async (seatIndex: number) => {
    if (isLoading) return
    await joinSeat(seatIndex)
    setSelectedSeat(null)
  }

  // Handle voting
  const handleVote = async (targetId: string) => {
    if (isLoading || isEliminated || !isSeated) return
    await submitVote(targetId)
  }

  if (!gameId) {
    // Game not started - show create button
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-72 bg-zinc-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-green-900/30 to-emerald-900/30">
          <div className="flex items-center gap-2">
            <Gamepad2 size={16} className="text-green-400" />
            <span className="text-sm font-black text-white uppercase tracking-wider">Troll Us</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="text-xs text-zinc-400 mb-4">
              Werewolf-style social deduction game
            </p>
            <p className="text-[10px] text-zinc-500">
              1 troll • Multiple hunters • Find the troll before it's too late
            </p>
          </div>

          <button
            onClick={createGame}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Play size={16} />
            {isLoading ? 'Creating...' : 'Start New Game (2000 coins)'}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-yellow-500">
            <Trophy size={12} />
            <span>2000 coin prize pool</span>
          </div>
        </div>
      </motion.div>
    )
  }

  // Game in progress
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-80 bg-zinc-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-green-900/30 to-emerald-900/30">
        <div className="flex items-center gap-2">
          <Gamepad2 size={16} className="text-green-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Troll Us</span>
          {status && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
              status === 'lobby' && "bg-blue-500/20 text-blue-400",
              status === 'live' && "bg-red-500/20 text-red-400 animate-pulse",
              status === 'ended' && "bg-yellow-500/20 text-yellow-400"
            )}>
              {status}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Game Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-zinc-400" />
            <span className="text-zinc-300">{players.filter(p => p.is_seated).length} players</span>
          </div>
          {status === 'live' && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Round</span>
              <span className="text-white font-bold">{currentRound}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-yellow-500">
            <Trophy size={10} />
            <span>{prizePool}</span>
          </div>
        </div>

        {/* Lobby: Show available seats */}
        {status === 'lobby' && !isSeated && (
          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500 text-center">
              Select a seat to join
            </p>
            <div className="grid grid-cols-3 gap-1">
              {availableSeats.map(seatIndex => (
                <button
                  key={seatIndex}
                  onClick={() => handleJoinSeat(seatIndex)}
                  disabled={isLoading}
                  className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors"
                >
                  Seat {seatIndex + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lobby: Waiting for players */}
        {status === 'lobby' && isSeated && (
          <div className="text-center py-4">
            <p className="text-sm text-white mb-2">Waiting for players...</p>
            <p className="text-[10px] text-zinc-500">
              {players.filter(p => p.is_seated).length} / 9 players joined
            </p>
            
            {isHost && players.filter(p => p.is_seated).length >= 3 && (
              <button
                onClick={startGame}
                disabled={isLoading}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Play size={16} />
                {isLoading ? 'Starting...' : 'Start Game'}
              </button>
            )}
          </div>
        )}

        {/* Live: Show game */}
        {status === 'live' && (
          <div className="space-y-3">
            {/* Players grid */}
            <div className="grid grid-cols-3 gap-1">
              {players.filter(p => p.is_seated).map(player => (
                <button
                  key={player.user_id}
                  onClick={() => !isEliminated && isSeated && handleVote(player.user_id)}
                  disabled={isEliminated || !isSeated || player.is_eliminated}
                  className={cn(
                    "relative p-2 rounded-lg text-center transition-all",
                    player.is_eliminated 
                      ? "bg-red-900/30 opacity-50" 
                      : isEliminated || !isSeated
                        ? "bg-white/5"
                        : "bg-white/10 hover:bg-white/20 cursor-pointer",
                    player.user_id === user?.id && "border border-green-500/30"
                  )}
                >
                  {player.is_eliminated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                      <AlertTriangle size={14} className="text-red-500" />
                    </div>
                  )}
                  <p className="text-[9px] text-white truncate">
                    {player.profile?.username || `Player ${(player.seat_index || 0) + 1}`}
                  </p>
                  {player.votes_received > 0 && (
                    <p className="text-[8px] text-red-400">
                      {player.votes_received} votes
                    </p>
                  )}
                </button>
              ))}
            </div>

            {/* My status */}
            <div className="text-center py-2 border-t border-white/10">
              {isEliminated ? (
                <p className="text-sm text-red-400 font-bold flex items-center justify-center gap-1">
                  <AlertTriangle size={14} />
                  ELIMINATED
                </p>
              ) : isMuted ? (
                <p className="text-sm text-yellow-400">You're muted</p>
              ) : myRole === 'troll' ? (
                <p className="text-sm text-red-400 font-bold">You're the TROLL</p>
              ) : (
                <p className="text-sm text-green-400">You're a HUNTER</p>
              )}
            </div>

            {/* Host controls */}
            {isHost && (
              <button
                onClick={endRound}
                disabled={isLoading}
                className="w-full py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <SkipForward size={12} />
                {isLoading ? 'Processing...' : 'End Round & Count Votes'}
              </button>
            )}
          </div>
        )}

        {/* Game ended */}
        {status === 'ended' && (
          <div className="text-center py-4 space-y-2">
            <Trophy size={32} className={cn(
              "mx-auto",
              winnerTeam === 'troll' ? "text-red-500" : "text-green-500"
            )} />
            <p className="text-lg font-bold text-white">
              {winnerTeam === 'troll' ? 'TROLL WINS!' : 'HUNTERS WIN!'}
            </p>
            <p className="text-xs text-zinc-400">
              {winnerTeam === 'troll' 
                ? 'The troll escaped!'
                : 'The troll was found!'
              }
            </p>
            
            {isHost && (
              <button
                onClick={endGame}
                className="mt-4 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
              >
                Close Game
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}