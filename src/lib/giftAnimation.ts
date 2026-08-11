/**
 * Gift-animation deduplication and enqueue pipeline.
 *
 * Two event streams arrive at each page:
 *  1. ``stream_gifts`` postgres_changes  →  useStreamRealtime.onGift(event.new)
 *  2. Broadcast ``gift_sent``            →  supabase channel ``giftChannel``
 *
 * Both paths are normalised via normaliseGiftEvent() into the same
 * normalisedGift shape whose ``animationId`` is always the stream_gifts row UUID.
 * The per-page ``seenGiftAnimationIdsRef`` Set then rejects the second arrival
 * regardless of which channel fired first.
 */

import type { RefObject } from 'react'

// ── normalised shape ──────────────────────────────────────────────────────────

export interface normalisedGift {
  animationId: string // stream_gifts row UUID — stable across both channels
  streamGiftId: string
  source: 'pg' | 'broadcast'
  streamId: string
  senderId: string
  receiverId: string
  giftItemId: string
  giftName: string
  slug: string
  amount: number
  animationUrl?: string | null
  createdAt: string
}

// ── constants ────────────────────────────────────────────────────────────────

const DEDUPE_TTL_MS = 30_000 // generous TTL; overlay is gone long before this

// ── helpers ──────────────────────────────────────────────────────────────────

function _firstStr(candidates: (string | null | undefined)[]): string {
  for (const c of candidates)
    if (typeof c === 'string' && c.trim()) return c.trim()
  return ''
}

function _resolveAmount(g: Record<string, unknown>): number {
  const qty = Math.max(1, Number(g.quantity ?? g.qty ?? 1) || 1)
  const direct = ['amount', 'coins_spent', 'coins_amount', 'total_amount', 'total_coins']
    .map((k) => Number(g[k]))
    .filter((n): n is number => n !== null && !isNaN(n))
  if (direct[0] > 0) return direct[0]
  const unit = ['coin_value', 'gift_value', 'gift_price', 'price']
    .map((k) => Number(g[k]))
    .filter((n): n is number => n !== null && !isNaN(n))
  if (unit[0] > 0) return unit[0] * qty
  return qty
}

// ── normalisation ─────────────────────────────────────────────────────────────
/**
 * Normalise any raw gift event into a consistent shape.
 *
 * animationId is resolved with this priority:
 *   1. rawGift.id             — broadcast payload.id = RPC transaction_id (stream_gifts row UUID)
 *   2. rawGift.stream_gift_id
 *   3. rawGift.gift_transaction_id
 *   4. composite fallback: `${streamId}-${senderId}-${receiverId}-${giftItemId}-${ts}`
 *
 * Returns null when the event has no usable identifiers.
 */
export function normaliseGiftEvent(
  rawGift: Record<string, unknown>,
  source: normalisedGift['source'],
): normalisedGift | null {
  if (!rawGift) return null

  // row UUID — the single birthmark shared by both channels
  const rawId =
    _firstStr(['id', 'stream_gift_id', 'gift_transaction_id', 'transaction_id'].map((k) => rawGift as any))

  // Sender field name varies across sources
  const senderId = _firstStr(
    ['sender_id', 'from_user_id', 'senderId', 's'].map((k) => rawGift as any),
  )
  if (!senderId) return null

  // Receiver field name varies too
  const receiverId = _firstStr(
    ['receiver_id', 'recipient_id', 'receiverId', 'recipientId'].map((k) => rawGift as any),
  )
  if (!receiverId) return null

  // If we cannot stabilise the event we do not enqueue
  if (!rawId) return null

  const streamId = _firstStr(['stream_id', 'streamId'].map((k) => rawGift as any)) || ''
  const streamGiftId = rawId

  const giftItemId = _firstStr(
    ['gift_id', 'gift_item_id', 'giftId', 'giftItemId', 'gift_type'].map((k) => rawGift as any),
  ) || ''

  const giftName = _firstStr(
    ['gift_name', 'name', 'title', 'message'].map((k) => rawGift as any),
  ) || 'Gift'

  const slug = _firstStr(['gift_slug', 'slug'].map((k) => rawGift as any)) || ''

  const animationUrl = _firstStr(
    ['animation_url', 'video_url', 'animationUrl', 'videoUrl', 'icon_url'].map((k) => rawGift as any),
  ) || null

  const createdAt = _firstStr(['timestamp', 'created_at'].map((k) => rawGift as any)) || new Date().toISOString()

  return {
    animationId: rawId,
    streamGiftId,
    source,
    streamId,
    senderId,
    receiverId,
    giftItemId,
    giftName,
    slug,
    amount: _resolveAmount(rawGift),
    animationUrl,
    createdAt,
  }
}

// ── per-page enqueue ──────────────────────────────────────────────────────────

export type SetRecentGiftsFn = (
  updater: (prev: readonly unknown[]) => readonly unknown[],
) => void

/**
 * Race-proof enqueue entry point for one page's animation queue.
 *
 * Both channels call the same normaliseGiftEvent first, guaranteeing that:
 *  • broadcast.paylo.id   (RPC transaction_id == stream_gifts UUID)
 *  • postgres event.new.id (stream_gifts UUID)
 * resolve to the same ``animationId`` — so the Set dedupe fires on the second
 * call regardless of channel ordering.
 *
 * @param rawGift                 event.new or payload depending on source
 * @param source                  'pg' | 'broadcast'
 * @param seenGiftAnimationIdsRef per-page Set<string> dedupe store
 * @param setRecentGifts           page state updater (adds to normalised queue)
 * @returns animationId when enqueued, null when skipped
 */
export function enqueueGiftAnimation(
  rawGift: Record<string, unknown>,
  source: normalisedGift['source'],
  seenGiftAnimationIdsRef: RefObject<Set<string>>,
  setRecentGifts: SetRecentGiftsFn,
): string | null {
  const g = normaliseGiftEvent(rawGift, source)
  if (!g) return null

  const { animationId } = g

  // ── Deduplicate ─────────────────────────────────────────────────────────────
  if (seenGiftAnimationIdsRef.current.has(animationId)) {
    if (import.meta.env.DEV) {
      console.log('[GiftAnimation] duplicate skipped', { animationId, source })
    }
    return null
  }
  seenGiftAnimationIdsRef.current.add(animationId)

  // ── Resolve animationUrl ────────────────────────────────────────────────────
  const finalUrl = g.animationUrl

  // ── Enqueue ─────────────────────────────────────────────────────────────────
  setRecentGifts((prev) => [...prev.slice(-20), { ...g, animationUrl: finalUrl ?? undefined }])

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  // The GiftVideoOverlay will usually remove via onEnded / onLoadedMetadata, but
  // keep a safety net in case the overlay is torn down early.
  setTimeout(() => {
    seenGiftAnimationIdsRef.current.delete(animationId)
  }, DEDUPE_TTL_MS)

  return animationId
}
