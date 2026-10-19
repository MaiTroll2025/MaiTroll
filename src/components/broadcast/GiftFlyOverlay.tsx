import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'
import { hydrateRealtimeGift } from '@/hooks/useBroadcastRealtime'

interface FlyingGift {
  key: string
  id: string
  giftName: string
  giftIcon: string
  senderName: string
  count: number
}

const GIFT_DISPLAY_MS = 2000

function normalizeGift(event: any) {
  const envelope = event?.new ?? event
  const gift = envelope?.d ?? envelope
  const metadata = gift?.metadata ?? {}

  return {
    ...gift,
    id: gift?.id || gift?.stream_gift_id || gift?.gift_transaction_id || gift?.transaction_id,
    gift_id: gift?.gift_id || metadata.gift_id,
    gift_name: gift?.gift_name || gift?.name || metadata.gift_name || metadata.name || 'Gift',
    gift_icon: gift?.gift_icon || gift?.icon || metadata.gift_icon || metadata.icon || '🎁',
    gift_slug: gift?.gift_slug || gift?.slug || metadata.gift_slug || metadata.slug || '',
    quantity: Math.max(1, Number(gift?.quantity || metadata.quantity || 1)),
    sender_id: gift?.sender_id || gift?.sender_user_id || envelope?.s || '',
    sender_name: gift?.sender_name || gift?.username || metadata.sender_name || 'Someone',
    receiver_id: gift?.receiver_id || gift?.recipient_id || gift?.receiver_user_id || metadata.receiver_id || '',
  }
}

export default function GiftFlyOverlay({ streamId }: { streamId: string }) {
  const [gifts, setGifts] = useState<FlyingGift[]>([])
  const timersRef = useRef(new Map<string, number>())
  const seenRef = useRef(new Set<string>())

  const receiveGift = useCallback(async (event: any) => {
    const gift = normalizeGift(event)
    if (!gift.id || seenRef.current.has(gift.id)) return
    seenRef.current.add(gift.id)
    window.setTimeout(() => seenRef.current.delete(gift.id), 30_000)

    let hydratedGift = gift
    try {
      hydratedGift = { ...gift, ...(await hydrateRealtimeGift(gift)) }
    } catch (error) {
      console.warn('[GiftFlyOverlay] Gift details could not be loaded:', error)
    }

    const displayGift = {
      ...gift,
      ...hydratedGift,
      id: gift.id,
      gift_name: hydratedGift.gift_name || gift.gift_name,
      gift_icon: hydratedGift.gift_icon || gift.gift_icon,
      receiver_id: gift.receiver_id || hydratedGift.receiver_id || '',
    }

    window.dispatchEvent(new CustomEvent('broadcast-gift-received', { detail: { payload: displayGift } }))

    const key = [displayGift.sender_id, displayGift.receiver_id, displayGift.gift_slug || displayGift.gift_id || displayGift.gift_name].join(':')
    setGifts((previous) => {
      const existing = previous.find((item) => item.key === key)
      if (!existing) {
        return [...previous, {
          key,
          id: displayGift.id,
          giftName: displayGift.gift_name,
          giftIcon: displayGift.gift_icon,
          senderName: displayGift.sender_name,
          count: displayGift.quantity,
        }]
      }
      return previous.map((item) => item.key === key
        ? { ...item, id: displayGift.id, count: item.count + displayGift.quantity }
        : item)
    })

    const existingTimer = timersRef.current.get(key)
    if (existingTimer) window.clearTimeout(existingTimer)
    timersRef.current.set(key, window.setTimeout(() => {
      setGifts((previous) => previous.filter((item) => item.key !== key))
      timersRef.current.delete(key)
    }, GIFT_DISPLAY_MS))
  }, [])

  useStreamRealtime(streamId, {
    onGift: (event) => {
      if (event.table === 'stream_gifts' && event.eventType !== 'INSERT') return
      void receiveGift(event)
    },
  })

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-live="polite">
      <AnimatePresence>
        {gifts.map((gift, index) => (
          <motion.div
            key={`${gift.key}:${gift.id}`}
            initial={{ opacity: 0, x: '-25vw', y: '20vh', scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], x: ['-25vw', '0vw', '35vw'], y: ['20vh', '0vh', '-18vh'], scale: [0.7, 1, 1, 0.85] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: GIFT_DISPLAY_MS / 1000, times: [0, 0.15, 0.8, 1], ease: 'easeOut' }}
            className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-amber-300/40 bg-slate-950/90 px-4 py-2.5 text-white shadow-[0_0_30px_rgba(251,191,36,0.3)] backdrop-blur"
            style={{ marginBottom: `${index * 3.5}rem` }}
          >
            <span className="text-3xl" aria-hidden="true">{gift.giftIcon}</span>
            <span className="min-w-0">
              <span className="block max-w-52 truncate text-xs font-bold text-amber-100">{gift.senderName}</span>
              <span className="block max-w-52 truncate text-sm font-black">{gift.giftName}</span>
            </span>
            {gift.count > 1 && (
              <span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-black text-black">x{gift.count}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
