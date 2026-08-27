import React from 'react'
import { motion } from 'framer-motion'
import { MaiBagProgressProps } from './types'

export default function MaiBagProgress({ fillPercent, tier, compact = false }: MaiBagProgressProps) {
  const height = compact ? 'h-2' : 'h-3'
  const showParticles = tier.particleIntensity > 0 && fillPercent >= 100

  return (
    <div className={`w-full ${height} rounded-full bg-black/40 border border-white/10 overflow-hidden relative`}>
      <motion.div
        className={`h-full rounded-full ${tier.accentClass} ${showParticles ? 'animate-pulse' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${fillPercent}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
        style={{
          boxShadow: fillPercent >= 100
            ? `0 0 12px ${tier.accentClass.replace('bg-', '')}`
            : undefined,
        }}
      />
      {fillPercent >= 100 && (
        <motion.div
          className="absolute inset-0 bg-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  )
}
