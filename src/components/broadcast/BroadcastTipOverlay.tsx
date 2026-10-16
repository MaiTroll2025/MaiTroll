// src/components/broadcast/BroadcastTipOverlay.tsx
// Floating "flying chat" animation for coin tips.
// Renders a transient message that flies from the sender's position toward
// the broadcaster's video / stage area, then fades out.
// Shows: sender username, broadcaster display name, formatted coin amount.

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface TipOverlayItem {
  id: string
  senderUsername: string
  broadcasterDisplayName: string
  amount: number
  createdAt: number
  durationMs?: number
}

interface BroadcastTipOverlayProps {
  tips: TipOverlayItem[]
  onDismiss?: (id: string) => void
  className?: string
  /**
   * Where the tip originates from (clientX/clientY). When provided the
   * message flies from that point to the center.
   */
  origin?: { x: number; y: number } | null
}

const DEFAULT_DURATION_MS = 4500

function formatCoins(value: number): string {
  return Number(value || 0).toLocaleString()
}

export function BroadcastTipOverlay({
  tips,
  onDismiss,
  className = '',
  origin = null,
}: BroadcastTipOverlayProps) {
  const [internalTips, setInternalTips] = useState<TipOverlayItem[]>([])

  // Sync incoming tips and schedule dismissal
  useEffect(() => {
    if (tips.length === 0) return

    setInternalTips((prev) => {
      const existingIds = new Set(prev.map((t) => t.id))
      const newTips = tips.filter((t) => !existingIds.has(t.id))
      if (newTips.length === 0) return prev
      return [...prev, ...newTips]
    })

    tips.forEach((tip) => {
      const duration = tip.durationMs ?? DEFAULT_DURATION_MS
      window.setTimeout(() => {
        setInternalTips((prev) => prev.filter((t) => t.id !== tip.id))
        onDismiss?.(tip.id)
      }, duration)
    })
  }, [tips, onDismiss])

  const activeTips = internalTips

  const computeOrigin = useCallback((_tip: TipOverlayItem) => {
    if (origin) return origin
    // Default: fly from bottom-left chat area toward the center stage.
    return { x: window.innerWidth * 0.1, y: window.innerHeight * 0.8 }
  }, [origin])

  const targetPosition = useMemo(() => {
    // Fly toward the center of the viewport (where the broadcaster video sits).
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4 }
  }, [])

  if (activeTips.length === 0) return null

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none z-[60] overflow-hidden',
        className
      )}
      aria-live="polite"
      aria-label="Coin tip notifications"
    >
      <AnimatePresence>
        {activeTips.map((tip) => {
          const from = computeOrigin(tip)
          const dx = targetPosition.x - from.x
          const dy = targetPosition.y - from.y

          return (
            <motion.div
              key={tip.id}
              className="absolute flex flex-col items-center gap-0.5"
              initial={{ x: from.x, y: from.y, opacity: 0, scale: 0.6 }}
              animate={{
                x: [from.x, from.x + dx * 0.55, targetPosition.x],
                y: [from.y, from.y + dy * 0.55, targetPosition.y],
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1.05, 1.0, 0.8],
              }}
              transition={{
                duration: (tip.durationMs ?? DEFAULT_DURATION_MS) / 1000,
                ease: [0.2, 0.8, 0.2, 1],
                times: [0, 0.15, 0.75, 1],
              }}
              exit={{ opacity: 0, scale: 0.4 }}
            >
              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.55)] border border-white/30">
                <span className="text-[11px] font-black text-black whitespace-nowrap">
                  {formatCoins(tip.amount)} 🪙
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-black/70 border border-white/15 text-[10px] font-bold text-white whitespace-nowrap">
                <span className="text-cyan-300">{tip.senderUsername}</span>
                <span className="text-white/60"> → </span>
                <span className="text-amber-200">{tip.broadcasterDisplayName}</span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default BroadcastTipOverlay