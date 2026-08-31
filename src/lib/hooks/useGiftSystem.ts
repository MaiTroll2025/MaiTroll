import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, UserProfile } from '../../lib/supabase'
import { useXPStore } from '@/stores/useXPStore'
import { toast } from 'sonner'
import { BattleSounds } from '../battleSounds';
import { useAuthStore } from '../../lib/store'
import { useTrollFamilyActivity } from '@/hooks/useTrollFamilyActivity'
import { unlockGiftAudio } from '../../components/broadcast/GiftVideoOverlay';

import { sendStreamBroadcast } from '@/lib/realtime/streamRealtimeManager'

export async function quietRefreshGiftProfile(userId: string) {
  const authStore = useAuthStore.getState();
  const currentProfile = authStore.profile;

  try {
    const [{ data: profileRow }, { data: levelRow }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_stats').select('level, xp_total, xp_to_next_level').eq('user_id', userId).maybeSingle(),
    ]);

     if (profileRow) {
       authStore.setProfile({
         ...currentProfile,
         ...profileRow,
         level: levelRow?.level ?? profileRow.level ?? currentProfile?.level ?? 1,
         xp: levelRow?.xp_total ?? profileRow.xp ?? currentProfile?.xp ?? 0,
         total_xp: levelRow?.xp_total ?? profileRow.total_xp ?? currentProfile?.total_xp ?? 0,
         next_level_xp: levelRow?.xp_to_next_level ?? profileRow.next_level_xp ?? currentProfile?.next_level_xp,
       } as UserProfile)
     }
  } catch (err) {
    console.warn('[GiftSystem] Quiet profile refresh failed:', err);
  }
}

export interface GiftItem {
  id: string
  name: string
  description?: string
  icon?: string
  coinCost: number
  type: 'paid' | 'free'
  category?: string
  subcategory?: string
  slug?: string
  currency?: 'troll_coins'
  animationKey?: string
  animationType?: string
  animationUrl?: string | null
  animationDurationMs?: number
  soundUrl?: string | null
  isFullscreen?: boolean
  rarity?: string
  trayVisualUrl?: string | null
  trayGradient?: string | null
  videoUrl?: string | null
}

export interface GiftSendOptions {
  receiverId?: string
  quantity?: number
  battleId?: string | null
  streamId?: string | null
  metadata?: Record<string, any>
}

interface GiftSystemContextValue {
  sendGift: (gift: GiftItem, options?: GiftSendOptions) => Promise<boolean | { success: boolean; bonus?: any }>
  undoRecentGift: (streamGiftId?: string) => Promise<{ success: boolean; message?: string }>
  isSending: boolean
  lastSentGiftId: string | null
}

const GiftSystemContext = createContext<GiftSystemContextValue | null>(null)

// Global counter for debugging
if (typeof window !== 'undefined') {
  (window as any).GIFT_SYSTEM_PROVIDER_RENDER_COUNT = 0
}

export function GiftSystemProvider({
  streamId,
  defaultReceiverId,
  children,
}: {
  streamId?: string | null
  defaultReceiverId?: string
  children: React.ReactNode
}) {
  const renderCountRef = useRef(0)
  useEffect(() => {
    renderCountRef.current += 1
    if (typeof window !== 'undefined') {
      (window as any).GIFT_SYSTEM_PROVIDER_RENDER_COUNT = renderCountRef.current
    }
  })

  // Guard: Do not initialize provider without streamId. This return happens before
  // any hooks run in the outer component, so it never affects hook order.
  if (!streamId) {
    if (import.meta.env.DEV) console.debug('[GiftSystemProvider] Skipping - no streamId provided')
    return React.createElement(
      GiftSystemContext.Provider,
      { value: { sendGift: async () => false, isSending: false } },
      children
    )
  }

  return React.createElement(GiftSystemProviderInner, { streamId, defaultReceiverId }, children)
}

function GiftSystemProviderInner({
  streamId,
  defaultReceiverId,
  children,
}: {
  streamId: string
  defaultReceiverId?: string
    children?: React.ReactNode
}) {
  const { user, profile } = useAuthStore()
  const { recordGiftSent, recordGiftEarned } = useTrollFamilyActivity()
  const [isSending, setIsSending] = useState(false)
  const [lastSentGiftId, setLastSentGiftId] = useState<string | null>(null)

  const circuitRef = useRef<{ openUntil: number }>({ openUntil: 0 })

  const undoRecentGift = useCallback(
    async (streamGiftId?: string): Promise<{ success: boolean; message?: string }> => {
      const currentUserId = user?.id
      const targetId = streamGiftId || lastSentGiftId

      if (!currentUserId || !targetId) {
        return { success: false, message: 'No gift to undo' }
      }

      try {
        const { data: result, error: rpcError } = await supabase.rpc('undo_gift_transaction', {
          p_stream_gift_id: targetId,
          p_requester_id: currentUserId,
        })

        if (rpcError) {
          console.error('[GiftSystem] Undo RPC error:', rpcError)
          return { success: false, message: rpcError.message || 'Undo failed' }
        }

        if (!result?.success) {
          return { success: false, message: result?.message || 'Undo failed' }
        }

        setLastSentGiftId(null)

        void quietRefreshGiftProfile(currentUserId)
        void quietRefreshGiftProfile(result.receiver_id)

        try {
          const xpState = useXPStore.getState()
          await xpState.fetchXP(currentUserId)
          if (result.receiver_id) await xpState.fetchXP(result.receiver_id)
        } catch (e) { if (import.meta.env.DEV) console.warn('[GiftSystem] undo fetchXP failed:', e) }

        return { success: true, message: 'Gift undone successfully' }
      } catch (error: any) {
        console.error('[GiftSystem] Undo error:', error)
        return { success: false, message: error?.message || 'Undo failed' }
      }
    },
    [user?.id, lastSentGiftId]
  )

  const sendGift = useCallback(
    async (gift: GiftItem, options: GiftSendOptions = {}) => {
      const now = Date.now()
      if (circuitRef.current.openUntil > now) {
        toast.error('Gifting is temporarily paused. Please try again shortly.')
        return false
      }

      const targetReceiverId = options.receiverId || defaultReceiverId || streamId
      const quantity = Math.max(1, Number(options.quantity) || 1)
      const battleId = options.battleId ?? null
      const effectiveStreamId = options.streamId ?? streamId

      if (!user || !profile) {
        toast.error('You must be logged in to send gifts.')
        return false
      }

      if (user.id === targetReceiverId) {
        toast.error('You cannot send gifts to yourself')
        return false
      }

      await unlockGiftAudio();

      // Note: trollmond deduction is now handled entirely by the RPC.
      // Gifts >= 100 coins deduct 100 trollmonds per gift (if sender has trollmonds).
      // No client-side coin discount is applied.
      const totalCost = gift.coinCost * quantity
      const balance = gift.type === 'paid' ? (profile.troll_coins || 0) : 0

      if (gift.type === 'paid' && balance < totalCost) {
        toast.error(`Not enough Coins for this gift. Need ${totalCost} coins.`)
        return false
      }

      setIsSending(true)
      try {
        const giftMetadata = {
        source: battleId ? 'battle_gift' : 'stream_gift',
        battle_id: battleId,
        gift_name: gift.name,
        gift_slug: gift.slug,
        gift_icon: gift.icon,
        animation_key: gift.animationKey || gift.slug || gift.name,
        animation_type: gift.animationType,
        animation_url: gift.animationUrl || gift.videoUrl || null,
        video_url: gift.videoUrl || gift.animationUrl || null,
        animation_duration_ms: gift.animationDurationMs,
        sound_url: gift.soundUrl || null,
        is_fullscreen: gift.isFullscreen,
        rarity: gift.rarity,
        tray_visual_url: gift.trayVisualUrl || null,
        tray_gradient: gift.trayGradient || null,
        recipient_type: (options as any).recipient_type || 'broadcaster',
        recipient_seat_index: (options as any).recipient_seat_index ?? null,
        ...options.metadata,
      }

      const { data: result, error: rpcError } = await supabase.rpc('send_gift_in_stream', {
          p_sender_id: user.id,
          p_receiver_id: targetReceiverId,
          p_stream_id: effectiveStreamId,
          p_gift_id: gift.id,
          p_quantity: quantity,
          p_metadata: giftMetadata,
        })

        if (rpcError) {
          throw rpcError
        }

          if (!result?.success) {
          const message = result?.message || result?.error || 'Failed to send gift'
          toast.error(message)
          BattleSounds.error();
          return false
        }

        // Play gift sent sound
        BattleSounds.giftSent();

        // Feed the Troll: push the server-computed event for instant UI updates.
        // (Also delivered via postgres_changes as a durable fallback.)
        if (result?.troll_event && result.troll_event.eventType) {
          try {
            import('@/components/feed-the-troll/useFeedTheTroll').then((m) =>
              m.emitTrollEvent(effectiveStreamId, {
                ...(result.troll_event as any),
                createdAt:
                  (result.troll_event as any).createdAt ||
                  new Date().toISOString(),
              })
            );
          } catch {
            /* non-critical */
          }
        }

        // Non-critical post-send operations — fire and forget for instant UI response
        void (async () => {
          try { await quietRefreshGiftProfile(user.id) } catch (e) { if (import.meta.env.DEV) console.warn('[GiftSystem] profile refresh failed:', e) }
          try {
            const xpState = useXPStore.getState()
            if (xpState.xpTotal > 0) await xpState.fetchXP(user?.id)
          } catch (e) { if (import.meta.env.DEV) console.warn('[GiftSystem] fetchXP failed:', e) }
          try {
            const dedupKey = `gift_${effectiveStreamId}_${gift.id}_${user.id}_${targetReceiverId}_${Date.now()}`
            await recordGiftSent(totalCost, targetReceiverId, effectiveStreamId, gift.id)
            await supabase.rpc('record_troll_family_activity', {
              p_user_id: targetReceiverId,
              p_event_type: 'broadcast_gift_earned',
              p_amount: totalCost,
              p_metadata: { stream_id: effectiveStreamId, gift_id: gift.id, sender_id: user.id, dedup_key: dedupKey },
            })
          } catch (e) { if (import.meta.env.DEV) console.warn('[GiftSystem] activity record failed:', e) }

          const giftId = result?.stream_gift_id || result?.gift_transaction_id || result?.transaction_id
          if (giftId) setLastSentGiftId(giftId)
          const normalizedPayload = {
            id: giftId,
            stream_gift_id: giftId,
            gift_transaction_id: giftId,
            transaction_id: giftId,
            stream_id: effectiveStreamId,
            gift_id: gift.id,
            gift_name: gift.name,
            gift_slug: gift.slug,
            sender_id: user.id,
            sender_name: profile?.username || user.email?.split('@')?.[0] || 'Someone',
            receiver_id: targetReceiverId,
            recipient_type: giftMetadata.recipient_type || 'broadcaster',
            recipient_seat_index: giftMetadata.recipient_seat_index ?? null,
            animation_type: gift.animationType || 'video',
            animation_url: gift.animationUrl || gift.videoUrl || null,
            animation_url_webm: gift.animationUrl?.endsWith('.webm') ? gift.animationUrl : null,
            animation_url_mp4: gift.animationUrl?.endsWith('.mp4') ? gift.animationUrl : null,
            animation_url_mov: gift.animationUrl?.endsWith('.mov') ? gift.animationUrl : null,
            video_url: gift.videoUrl || gift.animationUrl || null,
            sound_url: gift.soundUrl || null,
            animation_duration_ms: gift.animationDurationMs || 7000,
            quantity,
            amount: totalCost,
            created_at: new Date().toISOString(),
            metadata: giftMetadata,
          }

          if (import.meta.env.DEV) {
            console.info('[GiftPipeline] send success', normalizedPayload)
          }

          try {
            window.dispatchEvent(
              new CustomEvent('maitroll:gift-sent', {
                detail: normalizedPayload,
              }),
            )
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[GiftPipeline] local event dispatch failed', e)
          }

          try {
            await sendStreamBroadcast(effectiveStreamId, 'gift_sent', normalizedPayload)
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[GiftPipeline] broadcast send failed', e)
          }
        })()

        return { success: true, bonus: result }
      } catch (error: any) {
        console.error('[GiftDebugger] Error:', error)
        const msg = error?.message || 'Failed to send gift'
        toast.error(msg)
        if (
          String(msg).toLowerCase().includes('timeout') ||
          String(msg).toLowerCase().includes('deadlock') ||
          String(msg).toLowerCase().includes('rate limit') ||
          String(msg).toLowerCase().includes('could not obtain lock')
        ) {
          circuitRef.current.openUntil = Date.now() + 60_000
        }
        return false
      } finally {
        setIsSending(false)
      }
    },
    [defaultReceiverId, profile, streamId, user, recordGiftSent, recordGiftEarned]
  )

  const contextValue = useMemo(
    () => ({ sendGift, undoRecentGift, isSending, lastSentGiftId }),
    [sendGift, undoRecentGift, isSending, lastSentGiftId]
  )

  return React.createElement(
    GiftSystemContext.Provider,
    { value: contextValue },
    children
  )
}

export function useGiftSystem() {
  const context = useContext(GiftSystemContext)
  if (!context) {
    throw new Error('useGiftSystem must be used within GiftSystemProvider')
  }
  return context
}

// Helper function to calculate trollmonds discount percentage
// Only applies discount if user has 100+ trollmonds
export function getTrollmondDiscount(trollmonds: number): number {
  if (trollmonds >= 100) {
    return 1
  }
  return 0
}

// Helper function to calculate discounted price
export function getDiscountedPrice(originalCost: number, discountPercent: number): number {
  if (discountPercent <= 0) return originalCost
  const discountAmount = Math.floor(originalCost * (discountPercent / 100))
  return originalCost - discountAmount
}
