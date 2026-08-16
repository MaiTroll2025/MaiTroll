import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, TrendingUp, Award } from 'lucide-react'

export interface LeagueBannerEvent {
  user_id: string
  username: string
  type: 'main_tier' | 'sub_tier' | 'league_level'
  previous: string
  current: string
  tierLabel: string
  icon: string
}

interface LeagueLevelUpBannerProps {
  event: LeagueBannerEvent | null
  onDismiss: () => void
}

function getIcon(type: string) {
  if (type === 'main_tier') return <Trophy className="h-5 w-5 text-yellow-300" />
  if (type === 'league_level') return <Award className="h-5 w-5 text-purple-300" />
  return <TrendingUp className="h-5 w-5 text-cyan-300" />
}

export default function LeagueLevelUpBanner({ event, onDismiss }: LeagueLevelUpBannerProps) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ type: 'tween', duration: 0.8, ease: 'easeOut' }}
          onAnimationComplete={() => {
            setTimeout(onDismiss, 4000)
          }}
          className="fixed top-4 left-0 right-0 z-[180] flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-yellow-400/30 bg-gradient-to-r from-slate-900/95 via-purple-950/95 to-slate-900/95 px-6 py-3 shadow-2xl shadow-yellow-500/20 backdrop-blur-xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 border border-yellow-400/30 text-lg">
              {event.icon}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-black text-white">{event.username}</span>
              <span className="text-slate-400">just leveled up to</span>
              <span className="font-black text-yellow-300">{event.tierLabel}</span>
              {getIcon(event.type)}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
