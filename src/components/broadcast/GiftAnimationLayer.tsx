import React, { useEffect, useRef, useState } from 'react'

type GiftEvent = {
  id: string
  gift_id?: string
  gift_name: string
  gift_icon: string
  sender_id?: string
  sender_name?: string
  receiver_id: string
  quantity: number
}

interface Props {
  streamId: string
  recipientUserId: string
  recipientType?: 'broadcaster' | 'seat'
  className?: string
}

const BADGE_DURATION_MS = 2000

export default function GiftAnimationLayer({
  streamId,
  recipientUserId,
  recipientType: _recipientType = 'seat',
  className = '',
}: Props) {
  const [gift, setGift] = useState<GiftEvent | null>(null)
  const seenRef = useRef(new Set<string>())
  const badgeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!streamId || !recipientUserId) return
    const seenGiftIds = seenRef.current

    const handler = (event: Event) => {
      const payload = (event as CustomEvent).detail
      const rawGift = payload?.payload || payload
      const id = rawGift?.id || rawGift?.stream_gift_id || rawGift?.gift_transaction_id || rawGift?.transaction_id
      const receiverId = rawGift?.receiver_id || rawGift?.recipient_id || rawGift?.receiver_user_id

      if (!id || String(receiverId) !== recipientUserId || seenGiftIds.has(String(id))) return
      seenGiftIds.add(String(id))

      const nextGift: GiftEvent = {
        id: String(id),
        gift_id: rawGift.gift_id || rawGift.metadata?.gift_id,
        gift_name: rawGift.gift_name || rawGift.metadata?.gift_name || 'Gift',
        gift_icon: rawGift.gift_icon || rawGift.metadata?.gift_icon || '🎁',
        sender_id: rawGift.sender_id || rawGift.sender_user_id,
        sender_name: rawGift.sender_name || rawGift.metadata?.sender_name || 'Someone',
        receiver_id: String(receiverId),
        quantity: Math.max(1, Number(rawGift.quantity || rawGift.metadata?.quantity || 1)),
      }

      setGift((current) => current &&
        current.gift_id === nextGift.gift_id &&
        current.sender_id === nextGift.sender_id
        ? { ...nextGift, quantity: current.quantity + nextGift.quantity }
        : nextGift)

      if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current)
      badgeTimerRef.current = window.setTimeout(() => {
        setGift(null)
        badgeTimerRef.current = null
      }, BADGE_DURATION_MS)
    }

    window.addEventListener('broadcast-gift-received', handler as EventListener)
    return () => {
      window.removeEventListener('broadcast-gift-received', handler as EventListener)
      seenGiftIds.clear()
      if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current)
    }
  }, [streamId, recipientUserId])

  if (!streamId || !gift) return null

  return (
    <div className={`pointer-events-none absolute inset-0 z-40 overflow-hidden ${className}`} aria-live="polite">
      <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-xl border border-amber-300/40 bg-slate-950/90 px-2.5 py-1.5 text-white shadow-lg backdrop-blur">
        <span className="text-xl" aria-hidden="true">{gift.gift_icon}</span>
        <span className="truncate text-xs font-bold">{gift.gift_name}</span>
        {gift.quantity > 1 && (
          <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-black">
            x{gift.quantity}
          </span>
        )}
      </div>
    </div>
  )
}
