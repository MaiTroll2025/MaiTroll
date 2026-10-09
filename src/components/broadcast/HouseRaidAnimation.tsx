import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Wrench, AlertTriangle } from 'lucide-react'

interface HouseRaidAnimationProps {
  isVisible: boolean
  onDismiss?: () => void
}

export default function HouseRaidAnimation({ isVisible, onDismiss }: HouseRaidAnimationProps) {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onDismiss])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Dark glass overlay */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
          
          {/* Animation container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative z-10 flex flex-col items-center justify-center"
          >
            {/* Fire/Flames animation */}
            <div className="absolute inset-0 -z-10">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute h-16 w-4 rounded-full bg-gradient-to-t from-red-500 via-orange-400 to-yellow-300"
                  style={{
                    left: `${50 + Math.sin(i * 0.6) * 40}%`,
                    top: `${50 + Math.cos(i * 0.6) * 40}%`,
                    filter: 'blur(2px)',
                  }}
                  animate={{
                    y: [-20, -40, -20],
                    opacity: [0.5, 1, 0.5],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 1 + Math.random() * 0.5,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>

            {/* Neon border effect */}
            <motion.div
              className="rounded-3xl border-2 border-red-400/50 bg-slate-900/80 p-12 shadow-[0_0_60px_rgba(239,68,68,0.4)]"
              animate={{
                boxShadow: [
                  '0 0 40px rgba(239, 68, 68, 0.3)',
                  '0 0 80px rgba(239, 68, 68, 0.5)',
                  '0 0 40px rgba(239, 68, 68, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Pulsing house icon */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [-5, 5, -5],
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500"
              >
                <Home className="h-12 w-12 text-white" />
                
                {/* Alert indicator */}
                <motion.div
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500"
                >
                  <AlertTriangle className="h-4 w-4 text-white" />
                </motion.div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center text-4xl font-black text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              >
                HOUSE RAIDED!
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3 text-center text-lg text-slate-300"
              >
                Send coins to repair the damage.
              </motion.p>

              {/* Repair hint */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3"
              >
                <div className="flex items-center justify-center gap-2 text-cyan-300">
                  <Wrench className="h-4 w-4" />
                  <span className="text-sm font-bold">
                    Every 100 coins restores 5% condition
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}