import { useCallback, useRef, useState } from 'react'

export type StreamGiftEvent = {
  id: string
  stream_id: string
  gift_id: string
  gift_name: string | null
  sender_user_id: string
  recipient_user_id: string
  recipient_type: 'broadcaster' | 'seat'
  recipient_seat_index: number | null
  animation_url: string | null
  animation_url_webm: string | null
  animation_url_mp4: string | null
  animation_url_mov: string | null
  animation_type: 'video' | 'image' | 'lottie' | null
  animation_duration_ms: number | null
  sound_url: string | null
  created_at: string
}

type GiftQueueState = Record<string, StreamGiftEvent[]>

export function useTargetedGiftQueue() {
  const [queues, setQueues] = useState<GiftQueueState>({})
  const seenGiftIds = useRef(new Set<string>())

  const enqueueGift = useCallback((gift: StreamGiftEvent) => {
    if (!gift.id) {
      console.error('[GiftRouting] Rejected gift without ID', gift)
      return
    }

    if (seenGiftIds.current.has(gift.id)) {
      return
    }

    const targetKey = getGiftTargetKey(gift)

    if (!targetKey) {
      console.error('[GiftRouting] Rejected gift without target', {
        giftId: gift.id,
        senderUserId: gift.sender_user_id,
        recipientUserId: gift.recipient_user_id,
        recipientType: gift.recipient_type,
        recipientSeatIndex: gift.recipient_seat_index,
        animationUrl: gift.animation_url,
      })
      return
    }

    if (!gift.animation_url) {
      console.error('[GiftRouting] Rejected gift without animation URL', gift)
      return
    }

    seenGiftIds.current.add(gift.id)

    setQueues((current) => ({
      ...current,
      [targetKey]: [...(current[targetKey] ?? []), gift],
    }))
  }, [])

  const removeGift = useCallback((targetKey: string, giftId: string) => {
    setQueues((current) => {
      const updatedQueue = (current[targetKey] ?? []).filter((gift) => gift.id !== giftId)

      const next = { ...current }

      if (updatedQueue.length === 0) {
        delete next[targetKey]
      } else {
        next[targetKey] = updatedQueue
      }

      return next
    })
  }, [])

  return {
    queues,
    enqueueGift,
    removeGift,
  }
}

export function getGiftTargetKey(gift: StreamGiftEvent): string | null {
  if (!gift.recipient_user_id) {
    return null
  }

  return `user:${gift.recipient_user_id}`
}

export function normalizeGiftRow(row: Record<string, unknown>): StreamGiftEvent {
  const recipientUserId =
    String(
      row.recipient_user_id ??
        row.recipient_id ??
        row.receiver_id ??
        row.target_user_id ??
        '',
    )

  const senderUserId =
    String(
      row.sender_user_id ??
        row.sender_id ??
        row.user_id ??
        '',
    )

  const fallbackId =
    String(row.id) ||
    String(row.stream_gift_id) ||
    String(row.gift_transaction_id) ||
    String(row.transaction_id) ||
    `${String(row.stream_id)}:${String(row.gift_id)}:${senderUserId}:${recipientUserId}:${String(row.created_at || Date.now())}`

  return {
    id: fallbackId,
    stream_id: String(row.stream_id),

    gift_id: String(row.gift_id),
    gift_name: typeof row.gift_name === 'string' ? row.gift_name : null,

    sender_user_id: senderUserId,
    recipient_user_id: recipientUserId,

    recipient_type: row.recipient_type === 'seat' ? 'seat' : 'broadcaster',

    recipient_seat_index: typeof row.recipient_seat_index === 'number' ? row.recipient_seat_index : null,

    animation_url: typeof row.animation_url === 'string' ? row.animation_url : null,
    animation_url_webm: typeof row.animation_url_webm === 'string' ? row.animation_url_webm : null,
    animation_url_mp4: typeof row.animation_url_mp4 === 'string' ? row.animation_url_mp4 : null,
    animation_url_mov: typeof row.animation_url_mov === 'string' ? row.animation_url_mov : null,

    animation_type:
      row.animation_type === 'video' || row.animation_type === 'image' || row.animation_type === 'lottie'
        ? row.animation_type
        : null,

    animation_duration_ms: typeof row.animation_duration_ms === 'number' ? row.animation_duration_ms : 7000,

    sound_url: typeof row.sound_url === 'string' ? row.sound_url : null,

    created_at: String(row.created_at),
  }
}

export function chooseAnimationUrl(gift: StreamGiftEvent): string | null {
  if (typeof document === 'undefined') {
    return gift.animation_url
  }

  const video = document.createElement('video')

  const supportsWebm = video.canPlayType('video/webm; codecs="vp9"') !== ''

  if (supportsWebm && gift.animation_url_webm) {
    return gift.animation_url_webm
  }

  return gift.animation_url_mp4 || gift.animation_url || null
}
