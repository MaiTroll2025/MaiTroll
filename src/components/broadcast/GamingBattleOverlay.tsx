import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, X, Minimize2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils'
import type { GamingBattlePhase } from '@/hooks/useGamingBattle'

interface GamingBattleOverlayProps {
  phase: GamingBattlePhase
  opponentUsername: string | null
  opponentAvatarUrl: string | null
  myScore: number
  opponentScore: number
  timeRemaining: number
  myUsername: string
  myAvatarUrl: string | null
  onEnd: () => void
  onMinimize?: () => void
  children?: React.ReactNode
}

export function GamingBattleOverlay({
  phase,
  opponentUsername,
  opponentAvatarUrl,
  myScore,
  opponentScore,
  timeRemaining,
  myUsername,
  myAvatarUrl,
  onEnd,
  onMinimize,
  children,
}: GamingBattleOverlayProps) {
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const totalScore = myScore + opponentScore || 1
  const myPercent = (myScore / totalScore) * 100
  const oppPercent = (opponentScore / totalScore) * 100
  const isEnded = phase === 'ended'
  const iWon = myScore > opponentScore

  if (phase === 'idle' || phase === 'searching') return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex flex-col bg-black/85 backdrop-blur-xl"
      >
        {phase === 'countdown' && (
          <div className="flex flex-1 items-center justify-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <Swords className="mx-auto h-20 w-20 text-purple-400" />
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="mt-6 text-6xl font-black text-white"
              >
                VS
              </motion.p>
              <p className="mt-4 text-xl font-bold text-purple-300">
                {opponentUsername || 'Opponent'}
              </p>
              <p className="mt-2 text-sm text-slate-400">Battle starting...</p>
            </motion.div>
          </div>
        )}

        {(phase === 'active' || isEnded) && (
          <>
            <div className="flex items-center justify-between border-b border-purple-500/30 bg-black/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-purple-400" />
                <span className="text-sm font-black uppercase text-purple-200">
                  {isEnded ? 'Battle Ended' : 'Gaming Battle'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {!isEnded && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="font-mono text-lg font-black text-amber-300">
                      {minutes}:{seconds.toString().padStart(2, '0')}
                    </span>
                  </div>
                )}

                {isEnded && (
                  <div className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-black',
                    iWon
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : myScore === opponentScore
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300',
                  )}>
                    {iWon ? 'VICTORY!' : myScore === opponentScore ? 'DRAW!' : 'DEFEAT'}
                  </div>
                )}

                {onMinimize && (
                  <button
                    onClick={onMinimize}
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:text-white"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onEnd}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-red-400 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center gap-6 p-6">
              <motion.div
                className="flex flex-col items-center"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                {myAvatarUrl ? (
                  <img src={myAvatarUrl} alt={myUsername} className="h-20 w-20 rounded-2xl border-2 border-cyan-400/50 object-cover" />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-cyan-400/50 bg-cyan-500/20 text-lg font-black text-cyan-300">
                    {myUsername?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="mt-2 text-sm font-black text-cyan-300">{myUsername}</p>
                <p className="mt-1 text-3xl font-black text-white">{myScore.toLocaleString()}</p>
                <span className="text-xs text-slate-500">coins</span>
              </motion.div>

              <div className="flex flex-col items-center gap-2">
                <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-purple-500/50 bg-purple-500/10">
                  <Swords className="h-8 w-8 text-purple-400" />
                </div>
                <span className="text-sm font-black text-purple-300">VS</span>
              </div>

              <motion.div
                className="flex flex-col items-center"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                {opponentAvatarUrl ? (
                  <img src={opponentAvatarUrl} alt={opponentUsername || ''} className="h-20 w-20 rounded-2xl border-2 border-purple-400/50 object-cover" />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-purple-400/50 bg-purple-500/20 text-lg font-black text-purple-300">
                    {(opponentUsername || '??').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="mt-2 text-sm font-black text-purple-300">{opponentUsername || 'Opponent'}</p>
                <p className="mt-1 text-3xl font-black text-white">{opponentScore.toLocaleString()}</p>
                <span className="text-xs text-slate-500">coins</span>
              </motion.div>
            </div>

            <div className="px-6 pb-4">
              <div className="relative h-4 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                  initial={{ width: '50%' }}
                  animate={{ width: `${myPercent}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
                <motion.div
                  className="absolute right-0 top-0 h-full rounded-full bg-gradient-to-l from-purple-500 to-purple-400"
                  initial={{ width: '50%' }}
                  animate={{ width: `${oppPercent}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold text-slate-500">
                <span>{myPercent.toFixed(1)}%</span>
                <span>{oppPercent.toFixed(1)}%</span>
              </div>
            </div>

            {children}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default GamingBattleOverlay
