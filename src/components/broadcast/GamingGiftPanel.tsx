import React, { useState, useCallback } from 'react'
import { Send, Coins } from 'lucide-react';
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { useGiftSystem, type GiftItem } from '@/lib/hooks/useGiftSystem'
import { GAMING_GIFTS, getGamingGiftRarityStyle } from '@/lib/gamingGiftCatalog'
import { toast } from 'sonner'

interface GamingGiftPanelProps {
  streamId: string
  recipientId: string
  onGiftSent?: (gift: typeof GAMING_GIFTS[number], coinValue: number) => void
  compact?: boolean
}

export function GamingGiftPanel({
  streamId,
  recipientId,
  onGiftSent,
  compact = false,
}: GamingGiftPanelProps) {
  const { user, profile } = useAuthStore()
  const { sendGift, isSending } = useGiftSystem()
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null)
  const [recentGifts, setRecentGifts] = useState<Array<{ name: string; sender: string; icon: string; time: number }>>([])

  const selectedGift = GAMING_GIFTS.find((g) => g.id === selectedGiftId)

  const handleSendGift = useCallback(async () => {
    if (!user || !selectedGift) return
    if (isSending) return
    if (!recipientId || !streamId) {
      toast.error('Cannot send gift: missing recipient or stream.')
      return
    }

    try {
      const giftItem: GiftItem = {
        id: selectedGift.id,
        name: selectedGift.name,
        icon: selectedGift.icon,
        coinCost: selectedGift.coinCost,
        type: 'paid',
        slug: selectedGift.id,
        animationType: selectedGift.animationType,
      }

      const result = await sendGift(giftItem, {
        receiverId: recipientId,
        streamId: streamId,
      })

      if (result) {
        setRecentGifts((prev) => [
          { name: selectedGift.name, sender: profile?.username || 'You', icon: selectedGift.icon, time: Date.now() },
          ...prev.slice(0, 4),
        ])
        onGiftSent?.(selectedGift, selectedGift.coinCost)
        toast.success(`Sent ${selectedGift.name}!`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send gift')
    }
  }, [user, selectedGift, isSending, sendGift, recipientId, streamId, profile?.username, onGiftSent])

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4')}>
        {GAMING_GIFTS.map((gift) => (
          <button
            key={gift.id}
            onClick={() => setSelectedGiftId(gift.id === selectedGiftId ? null : gift.id)}
            className={cn(
              'relative overflow-hidden rounded-xl border p-2 text-center transition-all',
              getGamingGiftRarityStyle(gift.rarity),
              selectedGiftId === gift.id
                ? 'ring-2 ring-cyan-400 scale-105'
                : 'hover:scale-102',
            )}
          >
            <div className={cn('text-xl', compact ? 'text-lg' : 'text-2xl')}>{gift.icon}</div>
            <p className="mt-1 text-[10px] font-black uppercase leading-tight">{gift.name}</p>
            <div className="mt-1 flex items-center justify-center gap-0.5">
              <Coins className="h-2.5 w-2.5" />
              <span className="text-[9px] font-bold">{gift.coinCost}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedGift && (
        <button
          onClick={handleSendGift}
          disabled={isSending || !user || !recipientId || !streamId}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/15 px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-50"
        >
          {isSending ? (
            <span>Sending...</span>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Send {selectedGift.name} ({selectedGift.coinCost} coins)
            </>
          )}
        </button>
      )}

      {recentGifts.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-2">
          {recentGifts.map((g, i) => (
            <div key={`${g.time}-${i}`} className="flex items-center gap-2 text-[10px] text-slate-400">
              <span>{g.icon}</span>
              <span className="font-bold text-slate-300">{g.sender}</span>
              <span>sent</span>
              <span className="font-bold text-cyan-300">{g.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default GamingGiftPanel
