// src/components/broadcast/BroadcastTipTrigger.tsx
// Invisible button overlay that viewers can click/long-press to send a coin tip.
// Renders nothing visible by itself — it just provides an accessible way to
// trigger the tip flow. The actual flying-chat animation is handled by
// BroadcastTipOverlay.

import React, { useState, useCallback } from 'react'
import { Coins } from 'lucide-react'
import { cn } from '../../lib/utils'
import { sendTip } from '../../lib/broadcastTipService'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

interface BroadcastTipTriggerProps {
  streamId: string
  broadcasterId: string
  broadcasterDisplayName: string
  onTipSent?: (amount: number) => void
  onTipError?: (error: string) => void
  defaultAmount?: number
  className?: string
  children?: React.ReactNode
}

export function BroadcastTipTrigger({
  streamId,
  broadcasterId,
  broadcasterDisplayName,
  onTipSent,
  onTipError,
  defaultAmount = 100,
  className = '',
  children,
}: BroadcastTipTriggerProps) {
  const { user, profile } = useAuthStore()
  const [isTipping, setIsTipping] = useState(false)
  const [showAmountPicker, setShowAmountPicker] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(defaultAmount)

  const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]

  const handleTip = useCallback(async (amount: number) => {
    if (!user?.id || !profile) {
      toast.error('You must be logged in to tip')
      return
    }

    if (user.id === broadcasterId) {
      toast.error('You cannot tip yourself')
      return
    }

    setIsTipping(true)
    try {
      const result = await sendTip({
        streamId,
        senderId: user.id,
        broadcasterId,
        amount,
        txnId: `tip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      })

      if (result.success) {
        onTipSent?.(amount)
        toast.success(`Tipped ${amount.toLocaleString()} coins to ${broadcasterDisplayName}!`)
      } else {
        onTipError?.(result.error || 'Tip failed')
        toast.error(result.error || 'Tip failed')
      }
    } catch (err: any) {
      const msg = err?.message || 'Tip failed'
      onTipError?.(msg)
      toast.error(msg)
    } finally {
      setIsTipping(false)
      setShowAmountPicker(false)
    }
  }, [streamId, broadcasterId, broadcasterDisplayName, user, profile, onTipSent, onTipError])

  if (!user || !profile) {
    return null
  }

  return (
    <div className={cn('relative', className)} onClick={() => setShowAmountPicker((p) => !p)}>
      {children || (
        <button
          type="button"
          disabled={isTipping}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition',
            'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-400/20',
            isTipping && 'opacity-50 cursor-wait'
          )}
        >
          <Coins size={12} />
          {isTipping ? 'Tipping...' : 'Tip'}
        </button>
      )}

      {showAmountPicker && (
        <div
          className="absolute bottom-full left-0 mb-2 z-[70] p-2 rounded-xl bg-slate-950/95 border border-white/10 shadow-xl backdrop-blur-xl min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-2">
            Tip amount
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleTip(amt)}
                disabled={isTipping}
                className={cn(
                  'py-1.5 rounded-lg text-[11px] font-black transition border',
                  selectedAmount === amt
                    ? 'bg-amber-500/25 text-amber-100 border-amber-400/40'
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                )}
              >
                {amt}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value) || 0)}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-amber-400/40"
            />
            <button
              type="button"
              onClick={() => handleTip(selectedAmount)}
              disabled={isTipping || selectedAmount < 1}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BroadcastTipTrigger