// src/components/broadcast/GamePicker.tsx
// Dropdown menu for selecting which game to launch in a broadcast

import React from 'react'
import { motion } from 'framer-motion'
import { Gamepad2, X, Dice5 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamePickerProps {
  onSelectGame: (game: 'troll_us' | 'trollopoly') => void
  activeGame: string | null
  onClose: () => void
  category?: string
}

const TROLL_US_GAME = {
  id: 'troll_us' as const,
  name: 'Troll Us',
  description: 'Werewolf-style social deduction game',
  icon: Gamepad2,
  color: 'from-green-600 to-emerald-600',
  borderColor: 'border-green-500/30',
  glowColor: 'shadow-green-500/20',
}

const TROLLOPOLY_GAME = {
  id: 'trollopoly' as const,
  name: 'Trollopoly',
  description: 'Monopoly-style board game with 3D board',
  icon: Dice5,
  color: 'from-amber-600 to-orange-600',
  borderColor: 'border-amber-500/30',
  glowColor: 'shadow-amber-500/20',
}

const GENERAL_CHAT_GAMES = [TROLL_US_GAME, TROLLOPOLY_GAME]
const OTHER_GAMES = [TROLL_US_GAME]

export default function GamePicker({ onSelectGame, activeGame, onClose, category }: GamePickerProps) {
  const GAMES = category === 'general' ? GENERAL_CHAT_GAMES : OTHER_GAMES

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="w-72 bg-zinc-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
        <div className="flex items-center gap-2">
          <Gamepad2 size={16} className="text-purple-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Games</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Game list */}
      <div className="p-2 space-y-1.5">
        {GAMES.map((game) => {
          const isActive = activeGame === game.id
          const Icon = game.icon
          return (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left',
                isActive
                  ? `bg-gradient-to-r ${game.color} bg-opacity-20 border ${game.borderColor} shadow-lg ${game.glowColor}`
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                isActive ? 'bg-white/20' : 'bg-white/10'
              )}>
                <Icon size={18} className={isActive ? 'text-white' : 'text-white/70'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-bold', isActive ? 'text-white' : 'text-white/90')}>
                  {game.name}
                </p>
                <p className={cn('text-[10px] truncate', isActive ? 'text-white/70' : 'text-zinc-500')}>
                  {game.description}
                </p>
              </div>
              {isActive && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/20 text-green-400 uppercase">
                  Active
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5">
        <p className="text-[9px] text-zinc-600 text-center">Select a game to launch in your broadcast</p>
      </div>
    </motion.div>
  )
}
