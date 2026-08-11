import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getGiftVisualConfig } from '@/lib/giftVisuals'

export type NormalizedGiftAnimation = {
  id: string
  stream_id: string
  gift_id: string | null
  gift_name: string
  gift_slug: string | null
  sender_id: string | null
  sender_name: string
  receiver_id: string | null
  receiver_name: string | null
  recipient_type: 'broadcaster' | 'seat'
  recipient_seat_index: number | null
  animation_type: string
  animation_url: string | null
  animation_url_webm: string | null
  animation_url_mp4: string | null
  animation_url_mov: string | null
  video_url: string | null
  base_url: string | null
  sound_url: string | null
  animation_duration_ms: number
  quantity: number
  amount: number
  created_at: string
}

const DEDUPE_WINDOW_MS = 15_000

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveString(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function isUuid(value: unknown): boolean {
  const text = resolveString(value)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function nullableSeatIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function mergeMetadata(itemMetadata: unknown, eventMetadata: unknown): Record<string, any> {
  const item =
    itemMetadata && typeof itemMetadata === 'object' && !Array.isArray(itemMetadata)
      ? (itemMetadata as Record<string, any>)
      : {}

  const event =
    eventMetadata && typeof eventMetadata === 'object' && !Array.isArray(eventMetadata)
      ? (eventMetadata as Record<string, any>)
      : {}

  return {
    ...item,
    ...event,
  }
}

export function useGiftAnimationPipeline() {
  const playedGiftIdsRef = useRef(new Map<string, number>())

  const resolveGiftAmount = useCallback((giftData: any): number => {
    const metadata = giftData?.metadata || {}
    const quantity = Math.max(
      1,
      Number(giftData?.quantity ?? metadata?.quantity ?? 1) || 1,
    )

    const directAmountCandidates = [
      giftData?.coins_spent,
      giftData?.coins_amount,
      giftData?.total_amount,
      giftData?.total_coins,
      giftData?.amount,
      metadata?.coins_spent,
      metadata?.coins_amount,
      metadata?.total_amount,
      metadata?.total_coins,
      metadata?.amount,
    ]

    for (const candidate of directAmountCandidates) {
      const value = positiveNumber(candidate)
      if (value !== null) return value
    }

    const unitAmountCandidates = [
      giftData?.coin_value,
      giftData?.gift_value,
      giftData?.gift_price,
      giftData?.price,
      giftData?.coin_cost,
      metadata?.coin_value,
      metadata?.gift_value,
      metadata?.gift_price,
      metadata?.price,
      metadata?.coin_cost,
    ]

    for (const candidate of unitAmountCandidates) {
      const value = positiveNumber(candidate)
      if (value !== null) return value * quantity
    }

    return quantity
  }, [])

  const resolveGiftName = useCallback((giftData: any): string => {
    const metadata = giftData?.metadata || {}

    return (
      cleanString(giftData?.gift_name) ||
      cleanString(giftData?.name) ||
      cleanString(giftData?.title) ||
      cleanString(metadata?.gift_name) ||
      cleanString(metadata?.name) ||
      cleanString(metadata?.title) ||
      'Gift'
    )
  }, [])

  /**
   * Hydrates a realtime/database gift event with the canonical gift_items row.
   *
   * Important:
   * - A rich broadcast payload may already contain all media. We preserve it.
   * - We never turn an unresolved event into "gift_boost".
   * - We try UUID, gift_slug, slug, and name so receiver-side events can recover
   *   even when different event sources have different shapes.
   */
  const enrichGiftWithItemData = useCallback(async (giftData: any): Promise<any> => {
    const eventMetadata =
      giftData?.metadata && typeof giftData.metadata === 'object'
        ? giftData.metadata
        : {}

    const rawGiftIdentifier =
      cleanString(giftData?.gift_id) ||
      cleanString(giftData?.gift_item_id) ||
      cleanString(giftData?.giftId) ||
      cleanString(giftData?.giftItemId) ||
      cleanString(eventMetadata?.gift_id) ||
      cleanString(eventMetadata?.gift_item_id)

    const giftSlug =
      cleanString(giftData?.gift_slug) ||
      cleanString(giftData?.slug) ||
      cleanString(eventMetadata?.gift_slug) ||
      cleanString(eventMetadata?.slug)

    const giftName =
      cleanString(giftData?.gift_name) ||
      cleanString(giftData?.name) ||
      cleanString(eventMetadata?.gift_name) ||
      cleanString(eventMetadata?.name)

    const fullSelectColumns =
      'id,name,slug,gift_slug,icon,icon_url,tray_visual_url,animation_url,video_url,animation_url_webm,animation_url_mp4,animation_url_mov,base_url,animation_type,animation_duration_ms,sound_url,coin_cost,metadata'

    // Safe fallback for schemas that have not yet received every optional media column.
    const fallbackSelectColumns =
      'id,name,gift_slug,icon,icon_url,animation_url,animation_type,animation_duration_ms,sound_url,coin_cost'

    let giftItem: any = null
    let lastError: any = null

    const selectOne = async (
      column: 'id' | 'gift_slug' | 'slug' | 'name',
      value: string,
      columns: string,
    ) => {
      return supabase
        .from('gift_items')
        .select(columns)
        .eq(column, value)
        .maybeSingle()
    }

    const tryLookup = async (
      column: 'id' | 'gift_slug' | 'slug' | 'name',
      value: string | null,
    ) => {
      if (!value || giftItem) return

      // Never send a non-UUID string into gift_items.id.
      if (column === 'id' && !isUuid(value)) return

      let result = await selectOne(column, value, fullSelectColumns)

      if (!result.data && result.error) {
        result = await selectOne(column, value, fallbackSelectColumns)
      }

      if (result.data) {
        giftItem = result.data
        lastError = null
      } else if (result.error) {
        lastError = result.error
      }
    }

    await tryLookup('id', rawGiftIdentifier)

    if (!giftItem) {
      await tryLookup('gift_slug', giftSlug || rawGiftIdentifier)
    }

    if (!giftItem) {
      await tryLookup('slug', giftSlug)
    }

    if (!giftItem && giftName && giftName !== 'Gift') {
      await tryLookup('name', giftName)
    }

    // The event itself may already be rich enough to render. Do not destroy it
    // just because gift_items hydration failed.
    if (!giftItem) {
      if (import.meta.env.DEV) {
        console.warn('[GiftPipeline] canonical gift_items lookup did not resolve', {
          rawGiftIdentifier,
          giftSlug,
          giftName,
          lastError,
          incomingHasAnimation:
            Boolean(cleanString(giftData?.animation_url)) ||
            Boolean(cleanString(giftData?.video_url)) ||
            Boolean(cleanString(eventMetadata?.animation_url)) ||
            Boolean(cleanString(eventMetadata?.video_url)),
        })
      }

      return giftData
    }

    const metadata = mergeMetadata(giftItem?.metadata, eventMetadata)

    const resolvedSlug =
      giftSlug ||
      cleanString(giftItem?.gift_slug) ||
      cleanString(giftItem?.slug)

    const resolvedAnimationUrl =
      cleanString(giftData?.animation_url) ||
      cleanString(giftData?.video_url) ||
      cleanString(eventMetadata?.animation_url) ||
      cleanString(eventMetadata?.video_url) ||
      cleanString(giftItem?.animation_url) ||
      cleanString(giftItem?.video_url) ||
      cleanString(giftItem?.metadata?.animation_url) ||
      cleanString(giftItem?.metadata?.video_url)

    return {
      ...giftItem,
      ...giftData,

      // Always point gift_id at the canonical gift_items row when hydration succeeds.
      gift_id: giftItem.id,
      gift_item_id: giftItem.id,

      metadata,

      gift_name:
        giftName && giftName !== 'Gift'
          ? giftName
          : cleanString(giftItem?.name) || 'Gift',

      gift_slug: resolvedSlug,
      slug: resolvedSlug,

      icon:
        cleanString(giftData?.icon) ||
        cleanString(giftItem?.icon) ||
        null,

      icon_url:
        cleanString(giftData?.icon_url) ||
        cleanString(eventMetadata?.icon_url) ||
        cleanString(giftItem?.icon_url) ||
        cleanString(giftItem?.metadata?.icon_url) ||
        null,

      tray_visual_url:
        cleanString(giftData?.tray_visual_url) ||
        cleanString(eventMetadata?.tray_visual_url) ||
        cleanString(giftItem?.tray_visual_url) ||
        cleanString(giftItem?.metadata?.tray_visual_url) ||
        null,

      animation_url: resolvedAnimationUrl,
      video_url:
        cleanString(giftData?.video_url) ||
        cleanString(giftData?.animation_url) ||
        cleanString(eventMetadata?.video_url) ||
        cleanString(eventMetadata?.animation_url) ||
        cleanString(giftItem?.video_url) ||
        cleanString(giftItem?.animation_url) ||
        resolvedAnimationUrl,

      animation_url_webm:
        cleanString(giftData?.animation_url_webm) ||
        cleanString(eventMetadata?.animation_url_webm) ||
        cleanString(giftItem?.animation_url_webm) ||
        cleanString(giftItem?.metadata?.animation_url_webm) ||
        null,

      animation_url_mp4:
        cleanString(giftData?.animation_url_mp4) ||
        cleanString(eventMetadata?.animation_url_mp4) ||
        cleanString(giftItem?.animation_url_mp4) ||
        cleanString(giftItem?.metadata?.animation_url_mp4) ||
        null,

      animation_url_mov:
        cleanString(giftData?.animation_url_mov) ||
        cleanString(eventMetadata?.animation_url_mov) ||
        cleanString(giftItem?.animation_url_mov) ||
        cleanString(giftItem?.metadata?.animation_url_mov) ||
        null,

      base_url:
        cleanString(giftData?.base_url) ||
        cleanString(eventMetadata?.base_url) ||
        cleanString(giftItem?.base_url) ||
        cleanString(giftItem?.metadata?.base_url) ||
        null,

      animation_type:
        cleanString(giftData?.animation_type) ||
        cleanString(eventMetadata?.animation_type) ||
        cleanString(giftItem?.animation_type) ||
        'video',

      animation_duration_ms:
        positiveNumber(giftData?.animation_duration_ms) ||
        positiveNumber(eventMetadata?.animation_duration_ms) ||
        positiveNumber(giftItem?.animation_duration_ms) ||
        positiveNumber(giftItem?.metadata?.animation_duration_ms) ||
        7000,

      sound_url:
        cleanString(giftData?.sound_url) ||
        cleanString(eventMetadata?.sound_url) ||
        cleanString(giftItem?.sound_url) ||
        cleanString(giftItem?.metadata?.sound_url) ||
        null,

      coin_cost:
        positiveNumber(giftData?.coin_cost) ||
        positiveNumber(giftItem?.coin_cost) ||
        positiveNumber(giftData?.amount) ||
        null,
    }
  }, [])

  const resolveAnimationUrl = useCallback((gift: any): string | null => {
    const candidates = [
      gift?.animation_url_webm,
      gift?.animation_url,
      gift?.video_url,
      gift?.animation_url_mp4,
      gift?.animation_url_mov,
      gift?.metadata?.animation_url_webm,
      gift?.metadata?.animation_url,
      gift?.metadata?.video_url,
      gift?.metadata?.animation_url_mp4,
      gift?.metadata?.animation_url_mov,
    ]

    for (const candidate of candidates) {
      const url = cleanString(candidate)
      if (url) return url
    }

    return null
  }, [])

  const processGiftEvent = useCallback(
    async (rawPayload: any): Promise<NormalizedGiftAnimation | null> => {
      if (!rawPayload) return null

      // Supabase broadcast events may arrive wrapped as:
      // { type: 'broadcast', event: 'gift_sent', payload: {...gift} }
      const actualPayload =
        rawPayload?.event === 'gift_sent' &&
        rawPayload?.payload &&
        typeof rawPayload.payload === 'object'
          ? rawPayload.payload
          : rawPayload

      if (import.meta.env.DEV) {
        console.log('[GiftPipeline] payload unwrap', {
          wasWrapped: actualPayload !== rawPayload,
          wrapperType: rawPayload?.type,
          wrapperEvent: rawPayload?.event,
          actualPayload,
        })
      }

      // Hydrate FIRST. An incomplete DB event must never reserve/dedupe the
      // animation before a richer gift_sent broadcast has a chance to arrive.
      const giftData = await enrichGiftWithItemData(actualPayload)

      const debugGift =
        giftData?.event === 'gift_sent' &&
        giftData?.payload &&
        typeof giftData.payload === 'object'
          ? giftData.payload
          : giftData

      if (import.meta.env.DEV) {
        console.log('[GIFT RAW EVENT DEBUG]', {
          wasWrapped: debugGift !== giftData,

          raw: giftData,
          actualGift: debugGift,

          id: debugGift?.id,
          gift_id: debugGift?.gift_id,
          gift_item_id: debugGift?.gift_item_id,

          gift_slug: debugGift?.gift_slug,
          slug: debugGift?.slug,

          metadata: debugGift?.metadata,

          animation_url: debugGift?.animation_url,
          video_url: debugGift?.video_url,

          stream_id:
            debugGift?.stream_id ||
            debugGift?.streamId,

          sender_id: debugGift?.sender_id,
          receiver_id: debugGift?.receiver_id,
        })
      }

      const streamId =
        resolveString(giftData?.streamId) ||
        resolveString(giftData?.stream_id) ||
        resolveString(giftData?.metadata?.stream_id) ||
        resolveString(giftData?.metadata?.streamId)

      const giftId =
        resolveString(giftData?.giftId) ||
        resolveString(giftData?.gift_id) ||
        resolveString(giftData?.giftItemId) ||
        resolveString(giftData?.gift_item_id) ||
        resolveString(giftData?.metadata?.gift_id) ||
        resolveString(giftData?.metadata?.gift_item_id)

      const giftSlug =
        cleanString(giftData?.gift_slug) ||
        cleanString(giftData?.slug) ||
        cleanString(giftData?.metadata?.gift_slug) ||
        cleanString(giftData?.metadata?.slug)

      const senderId =
        resolveString(giftData?.senderId) ||
        resolveString(giftData?.sender_id) ||
        resolveString(giftData?.sender_user_id) ||
        resolveString(giftData?.user_id) ||
        resolveString(giftData?.metadata?.sender_id)

      const receiverId =
        resolveString(giftData?.receiverId) ||
        resolveString(giftData?.receiver_id) ||
        resolveString(giftData?.recipientId) ||
        resolveString(giftData?.recipient_id) ||
        resolveString(giftData?.recipient_user_id) ||
        resolveString(giftData?.target_user_id) ||
        resolveString(giftData?.metadata?.receiver_id) ||
        resolveString(giftData?.metadata?.recipient_id)

      const animationUrl = resolveAnimationUrl(giftData)

      // Critical fix: do NOT mark unresolved/incomplete events as seen.
      // This lets the rich `gift_sent` broadcast play even if a thin
      // `stream_gifts` postgres event arrived first.
      if (!animationUrl) {
        if (import.meta.env.DEV) {
          console.warn(
            '[GiftPipeline] incomplete gift event ignored; waiting for richer event',
            {
              giftId,
              giftSlug,
              streamId,
              senderId,
              receiverId,
              giftData,
            },
          )
        }
        return null
      }

      const eventId =
        resolveString(giftData?.transaction_id) ||
        resolveString(giftData?.gift_transaction_id) ||
        resolveString(giftData?.stream_gift_id) ||
        resolveString(giftData?.metadata?.transaction_id) ||
        resolveString(giftData?.metadata?.txn_key) ||
        resolveString(giftData?.id) ||
        `${streamId}:${giftId || giftSlug}:${senderId}:${receiverId}:${giftData?.created_at || giftData?.timestamp || Date.now()}`

      if (!eventId) return null

      const now = Date.now()
      const lastPlayedAt = playedGiftIdsRef.current.get(eventId)

      if (lastPlayedAt && now - lastPlayedAt < DEDUPE_WINDOW_MS) {
        if (import.meta.env.DEV) {
          console.debug('[GiftPipeline] duplicate skipped', { eventId })
        }
        return null
      }

      const visual = getGiftVisualConfig(giftData)

      const resolvedDuration =
        positiveNumber(giftData?.animation_duration_ms) ||
        positiveNumber(giftData?.metadata?.animation_duration_ms) ||
        positiveNumber(visual?.durationMs) ||
        7000

      const quantity = Math.max(
        1,
        Number(giftData?.quantity ?? giftData?.metadata?.quantity ?? 1) || 1,
      )

      const amount = resolveGiftAmount(giftData)
      const giftName = resolveGiftName(giftData)

      const seatIndex =
        nullableSeatIndex(giftData?.recipient_seat_index) ??
        nullableSeatIndex(giftData?.seat_index) ??
        nullableSeatIndex(giftData?.metadata?.recipient_seat_index) ??
        nullableSeatIndex(giftData?.metadata?.seat_index)

      const explicitRecipientType =
        cleanString(giftData?.recipient_type) ||
        cleanString(giftData?.metadata?.recipient_type)

      const recipientType: 'broadcaster' | 'seat' =
        explicitRecipientType === 'seat' || seatIndex !== null
          ? 'seat'
          : 'broadcaster'

      const normalized: NormalizedGiftAnimation = {
        id: eventId,
        stream_id: streamId,
        gift_id: giftId || null,
        gift_name: giftName,
        gift_slug: giftSlug,
        sender_id: senderId || null,
        sender_name:
          cleanString(giftData?.sender_name) ||
          cleanString(giftData?.metadata?.sender_name) ||
          'Someone',
        receiver_id: receiverId || null,
        receiver_name:
          cleanString(giftData?.receiver_name) ||
          cleanString(giftData?.metadata?.receiver_name) ||
          null,
        recipient_type: recipientType,
        recipient_seat_index: seatIndex,
        animation_type:
          cleanString(giftData?.animation_type) ||
          cleanString(giftData?.metadata?.animation_type) ||
          'video',
        animation_url: animationUrl,
        animation_url_webm:
          cleanString(giftData?.animation_url_webm) ||
          cleanString(giftData?.metadata?.animation_url_webm) ||
          null,
        animation_url_mp4:
          cleanString(giftData?.animation_url_mp4) ||
          cleanString(giftData?.metadata?.animation_url_mp4) ||
          null,
        animation_url_mov:
          cleanString(giftData?.animation_url_mov) ||
          cleanString(giftData?.metadata?.animation_url_mov) ||
          null,
        video_url:
          cleanString(giftData?.video_url) ||
          cleanString(giftData?.metadata?.video_url) ||
          animationUrl,
        base_url:
          cleanString(giftData?.base_url) ||
          cleanString(giftData?.metadata?.base_url) ||
          null,
        sound_url:
          cleanString(giftData?.sound_url) ||
          cleanString(giftData?.metadata?.sound_url) ||
          null,
        animation_duration_ms: resolvedDuration,
        quantity,
        amount,
        created_at:
          cleanString(giftData?.created_at) ||
          cleanString(giftData?.timestamp) ||
          new Date().toISOString(),
      }

      // Only mark the event played AFTER it has successfully resolved into a
      // renderable normalized gift.
      playedGiftIdsRef.current.set(eventId, now)

      window.setTimeout(() => {
        playedGiftIdsRef.current.delete(eventId)
      }, DEDUPE_WINDOW_MS)

      if (import.meta.env.DEV) {
        console.info('[GiftPipeline] normalized renderable gift', normalized)
      }

      return normalized
    },
    [
      enrichGiftWithItemData,
      resolveAnimationUrl,
      resolveGiftAmount,
      resolveGiftName,
    ],
  )

  return {
    processGiftEvent,
    playedGiftIdsRef,
  }
}