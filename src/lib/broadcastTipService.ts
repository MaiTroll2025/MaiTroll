// src/lib/broadcastTipService.ts
// Centralized coin tipping service for broadcasts.
//
// Responsibilities:
//   - Deducts Troll Coins from the sender via the secure `try_pay_coins_secure` RPC.
//   - Credits the broadcaster via `troll_bank_credit_coins`.
//   - Inserts a `stream_gifts` row for audit + paid-chat qualification.
//   - Broadcasts a `broadcast:tip_sent` realtime event so viewers see the
//     flying-chat overlay instantly.
//   - Prevents duplicate deductions by tracking `txn_id` client-side and
//     server-side (the RPCs are idempotent on the same `txn_id`).
//
// This service intentionally does NOT touch the global site-wide ticker;
// it only fires per-broadcast events.

import { supabase } from './supabase'
import { deductCoins, addCoins } from './formatBalanceForRecord'
import { sendStreamBroadcast } from './realtime/streamRealtimeManager'
import { validateWishlistUrl } from './urlValidation'

export interface TipRequest {
  streamId: string
  senderId: string
  broadcasterId: string
  amount: number
  /**
   * Client-generated idempotency key. The same key must never be reused
   * across attempts — the server uses it to prevent double-deducts.
   */
  txnId: string
  message?: string
}

export interface TipResult {
  success: boolean
  error?: string
  giftId?: string
  newSenderBalance?: number
}

/**
 * Sends a coin tip from a viewer to the broadcaster.
 *
 * Flow:
 *   1. Deduct coins from sender (server-side balance check via RPC).
 *   2. Credit coins to broadcaster (Troll Bank).
 *   3. Record the gift in `stream_gifts`.
 *   4. Broadcast `tip_sent` on the stream realtime channel.
 */
export async function sendTip(req: TipRequest): Promise<TipResult> {
  const { streamId, senderId, broadcasterId, amount, txnId, message } = req

  if (!streamId || !senderId || !broadcasterId) {
    return { success: false, error: 'Missing required fields' }
  }

  const normalizedAmount = Math.max(1, Math.round(amount))
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { success: false, error: 'Invalid tip amount' }
  }

  // 1. Deduct from sender using the secure RPC (server-side balance validation).
  const deductResult = await deductCoins({
    userId: senderId,
    amount: normalizedAmount,
    type: 'gift_sent',
    description: `Tip to broadcaster ${broadcasterId} on stream ${streamId}`,
    metadata: {
      txn_id: txnId,
      stream_id: streamId,
      broadcaster_id: broadcasterId,
      tip_message: message || null,
    },
  })

  if (!deductResult.success) {
    return { success: false, error: deductResult.error || 'Failed to deduct coins' }
  }

  // 2. Credit the broadcaster via Troll Bank.
  const addResult = await addCoins({
    userId: broadcasterId,
    amount: normalizedAmount,
    type: 'gift_received',
    description: `Tip from ${senderId} on stream ${streamId}`,
    metadata: {
      txn_id: txnId,
      stream_id: streamId,
      sender_id: senderId,
    },
    sourceId: txnId,
  })

  if (!addResult.success) {
    // Best-effort: log but don't fail the tip — the sender already lost coins.
    console.error('[broadcastTipService] Failed to credit broadcaster:', addResult.error)
  }

  // 3. Record the gift for audit + paid-chat qualification.
  let giftId: string | undefined
  try {
    const { data, error } = await supabase
      .from('stream_gifts')
      .insert({
        stream_id: streamId,
        sender_id: senderId,
        receiver_id: broadcasterId,
        gift_id: 'coin_tip',
        quantity: normalizedAmount,
        metadata: {
          txn_id: txnId,
          type: 'coin_tip',
          tip_message: message || null,
          sender_balance_after: deductResult.newBalance ?? null,
        },
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[broadcastTipService] stream_gifts insert failed:', error)
    } else if (data) {
      giftId = data.id
    }
  } catch (err) {
    console.error('[broadcastTipService] stream_gifts insert exception:', err)
  }

  // 4. Broadcast the tip event on the stream realtime channel.
  try {
    await sendStreamBroadcast(streamId, 'tip_sent', {
      txn_id: txnId,
      stream_id: streamId,
      sender_id: senderId,
      broadcaster_id: broadcasterId,
      amount: normalizedAmount,
      message: message || null,
      gift_id: giftId || null,
    })
  } catch (err) {
    console.warn('[broadcastTipService] tip_sent broadcast failed (non-fatal):', err)
  }

  return {
    success: true,
    giftId,
    newSenderBalance: deductResult.newBalance ?? undefined,
  }
}

/**
 * Validates a wishlist URL (re-exports the shared validator for convenience).
 */
export { validateWishlistUrl }