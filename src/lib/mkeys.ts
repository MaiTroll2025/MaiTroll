/**
 * MKey service layer.
 *
 * MKeys are the MaiTroll invitation currency that lives inside the Gift Tray.
 * A normal gift says "I'm supporting this broadcaster". An MKey says
 * "I'm bringing another person into this room".
 *
 *   1 MKey = 1 invitation to 1 currently-active MaiTroll user
 *   They join  -> MKey claimed
 *   They don't -> MKey returned
 *
 * SECURITY: this module is a thin, dumb transport. Every balance, hold, claim,
 * return, expiry and recipient selection decision is made by the server inside
 * SECURITY DEFINER Postgres functions. Nothing here may be trusted by the
 * backend, and nothing here writes to an MKey table directly.
 */

import { supabase } from './supabase'

/** Web + Phone share this one implementation. Do not fork it. */
export const MKEY_QUICK_AMOUNTS = [10, 25, 50, 100] as const

/**
 * Coins charged per MKey when buying MKeys with troll_coins.
 * Keep this in sync with `mkey_config.mkey_coin_price_per_key`.
 */
export const MKEY_COIN_PRICE_PER_KEY = 10

export interface MKeyPurchaseResult {
  success: boolean
  error?: string
  mkeysPurchased?: number
  coinCost?: number
  available?: number
  balance?: number
}

export interface MKeyWallet {
  available: number
  held: number
  total: number
  lifetimeSent: number
  lifetimeClaimed: number
  lifetimeReturned: number
  inviteExpirySeconds: number
  maxAmountPerSend: number
}

export interface MKeySendResult {
  success: boolean
  error?: string
  message?: string
  boostId?: string
  amount?: number
  invitesCreated?: number
  returnedImmediately?: number
  expiresAt?: string
  expiresInSeconds?: number
  available?: number
  held?: number
}

export interface MKeyClaimResult {
  claimed: boolean
  reason?: string
  inviteId?: string
  boostId?: string
  senderId?: string
  retryAfterSeconds?: number
}

export interface MKeyOpenInvite {
  hasInvite: boolean
  inviteId?: string
  boostId?: string
  status?: 'pending' | 'notified' | 'claimed'
  expiresAt?: string
  senderId?: string
  senderUsername?: string
  senderAvatarUrl?: string | null
}

export interface MKeyBroadcastStats {
  mkeysSent: number
  invitesSent: number
  successfulJoins: number
  returned: number
  uniqueSenders: number
  conversionRate: number
}

export interface MKeyBoostSummary {
  boostId: string
  broadcastId: string
  amount: number
  invitesCreated: number
  joined: number
  returned: number
  pending: number
  status: 'active' | 'completed' | 'cancelled'
  expiresAt: string
  createdAt: string
}

const EMPTY_WALLET: MKeyWallet = {
  available: 0,
  held: 0,
  total: 0,
  lifetimeSent: 0,
  lifetimeClaimed: 0,
  lifetimeReturned: 0,
  inviteExpirySeconds: 300,
  maxAmountPerSend: 500,
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Read the server-authoritative wallet. The client never computes a balance;
 * `total = available + held` is maintained server-side.
 */
export async function fetchMKeyWallet(): Promise<MKeyWallet> {
  try {
    const { data, error } = await supabase.rpc('mkey_wallet')
    if (error || !data || (data as any).success === false) {
      if (error) console.warn('[MKeys] wallet read failed:', error.message)
      return EMPTY_WALLET
    }
    const row = data as any
    return {
      available: num(row.available),
      held: num(row.held),
      total: num(row.total),
      lifetimeSent: num(row.lifetime_sent),
      lifetimeClaimed: num(row.lifetime_claimed),
      lifetimeReturned: num(row.lifetime_returned),
      inviteExpirySeconds: num(row.invite_expiry_seconds, 300),
      maxAmountPerSend: num(row.max_amount_per_send, 500),
    }
  } catch (err) {
    console.warn('[MKeys] wallet read threw:', err)
    return EMPTY_WALLET
  }
}

/**
 * How many currently-active users could actually receive an invitation right
 * now. Used purely to set expectations in the UI before sending.
 */
export async function fetchEligibleRecipientCount(broadcastId: string): Promise<number> {
  if (!broadcastId) return 0
  try {
    const { data, error } = await supabase.rpc('mkey_eligible_recipient_count', {
      p_broadcast_id: broadcastId,
    })
    if (error) return 0
    return num(data)
  } catch {
    return 0
  }
}

/**
 * Send MKeys toward a broadcast.
 *
 * The server holds the MKeys, finds active viewers and seat participants
 * inside OTHER live broadcasts, and delivers one invitation per MKey. Any MKey
 * it cannot place is returned to the sender before this call even resolves.
 */
export async function sendMKeys(broadcastId: string, amount: number): Promise<MKeySendResult> {
  if (!broadcastId) {
    return { success: false, error: 'invalid_broadcast', message: 'No broadcast selected.' }
  }
  const requested = Math.max(1, Math.floor(Number(amount) || 0))

  try {
    const { data, error } = await supabase.rpc('mkey_send', {
      p_broadcast_id: broadcastId,
      p_amount: requested,
    })

    if (error) {
      console.warn('[MKeys] send failed:', error.message)
      return { success: false, error: 'rpc_error', message: 'Could not send MKeys. Try again.' }
    }

    const row = (data || {}) as any
    return {
      success: Boolean(row.success),
      error: row.error,
      message: row.message,
      boostId: row.boost_id,
      amount: num(row.amount, requested),
      invitesCreated: num(row.invites_created),
      returnedImmediately: num(row.returned_immediately),
      expiresAt: row.expires_at,
      expiresInSeconds: num(row.expires_in_seconds, 300),
      available: num(row.available),
      held: num(row.held),
    }
  } catch (err) {
    console.warn('[MKeys] send threw:', err)
    return { success: false, error: 'exception', message: 'Could not send MKeys. Try again.' }
  }
}

/**
 * Ask the server whether the current user just earned an MKey claim by
 * genuinely entering this broadcast.
 *
 * This is a *request to verify*, not an assertion. The server checks that a
 * real viewer or seat session exists, that it started after the invitation was
 * delivered, and that it lasted long enough. `reason: 'verifying_session'`
 * means "come back in retryAfterSeconds".
 */
export async function claimMKeyOnJoin(broadcastId: string): Promise<MKeyClaimResult> {
  if (!broadcastId) return { claimed: false, reason: 'invalid_broadcast' }

  try {
    const { data, error } = await supabase.rpc('mkey_claim_on_join', {
      p_broadcast_id: broadcastId,
    })
    if (error) {
      return { claimed: false, reason: 'rpc_error' }
    }
    const row = (data || {}) as any
    return {
      claimed: Boolean(row.claimed),
      reason: row.reason,
      inviteId: row.invite_id,
      boostId: row.boost_id,
      senderId: row.sender_id,
      retryAfterSeconds: row.retry_after_seconds ? num(row.retry_after_seconds) : undefined,
    }
  } catch {
    return { claimed: false, reason: 'exception' }
  }
}

/** Any MKey invitation the current user holds for this broadcast. */
export async function fetchMyOpenInvite(broadcastId: string): Promise<MKeyOpenInvite> {
  if (!broadcastId) return { hasInvite: false }
  try {
    const { data, error } = await supabase.rpc('mkey_my_open_invite', {
      p_broadcast_id: broadcastId,
    })
    if (error || !data) return { hasInvite: false }
    const row = data as any
    if (!row.has_invite) return { hasInvite: false }
    return {
      hasInvite: true,
      inviteId: row.invite_id,
      boostId: row.boost_id,
      status: row.status,
      expiresAt: row.expires_at,
      senderId: row.sender_id,
      senderUsername: row.sender_username,
      senderAvatarUrl: row.sender_avatar_url ?? null,
    }
  } catch {
    return { hasInvite: false }
  }
}

/**
 * Opportunistically return lapsed MKeys to their senders. Safe to call from
 * anywhere: the server decides what has actually expired, and the sweep is
 * idempotent. This is a belt-and-braces companion to the scheduled sweep so an
 * MKey is never stranded in `held` just because cron is unavailable.
 */
export async function sweepExpiredMKeys(): Promise<void> {
  try {
    await supabase.rpc('mkey_expire_invites', { p_limit: 200 })
  } catch {
    /* non-critical */
  }
}

/** Rule 19: MKey traffic driven toward a broadcast. */
export async function fetchMKeyBroadcastStats(broadcastId: string): Promise<MKeyBroadcastStats | null> {
  if (!broadcastId) return null
  try {
    const { data, error } = await supabase.rpc('mkey_broadcast_stats', {
      p_broadcast_id: broadcastId,
    })
    if (error || !data || (data as any).success === false) return null
    const row = data as any
    return {
      mkeysSent: num(row.mkeys_sent),
      invitesSent: num(row.invites_sent),
      successfulJoins: num(row.successful_joins),
      returned: num(row.returned),
      uniqueSenders: num(row.unique_senders),
      conversionRate: num(row.conversion_rate),
    }
  } catch {
    return null
  }
}

function mapBoostSummary(row: any): MKeyBoostSummary {
  return {
    boostId: row.boost_id,
    broadcastId: row.broadcast_id,
    amount: num(row.amount),
    invitesCreated: num(row.invites_created),
    joined: num(row.joined),
    returned: num(row.returned),
    pending: num(row.pending),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

/** Rule 20: "20 MKeys sent • 12 users joined • 8 MKeys returned". */
export async function fetchMKeyBoostSummary(boostId: string): Promise<MKeyBoostSummary | null> {
  if (!boostId) return null
  try {
    const { data, error } = await supabase.rpc('mkey_boost_summary', { p_boost_id: boostId })
    if (error || !data || (data as any).success === false) return null
    return mapBoostSummary(data)
  } catch {
    return null
  }
}

export async function fetchMyRecentMKeySends(limit = 5): Promise<MKeyBoostSummary[]> {
  try {
    const { data, error } = await supabase.rpc('mkey_my_recent_sends', { p_limit: limit })
    if (error || !data || (data as any).success === false) return []
    const sends = (data as any).sends
    if (!Array.isArray(sends)) return []
    return sends.map(mapBoostSummary)
  } catch {
    return []
  }
}

/**
 * Buy MKeys by spending troll_coins.
 *
 * Delegates the entire coin-deduction + MKey-credit accounting to the
 * `mkey_purchase_with_coins` SECURITY DEFINER RPC. The client never touches a
 * balance. Available to any authenticated user (broadcaster OR viewer) who has
 * enough coins.
 */
export async function purchaseMKeysWithCoins(amount: number): Promise<MKeyPurchaseResult> {
  const requested = Math.max(1, Math.floor(Number(amount) || 0))

  try {
    const { data, error } = await supabase.rpc('mkey_purchase_with_coins', {
      p_amount: requested,
    })

    if (error) {
      console.warn('[MKeys] coin purchase failed:', error.message)
      return { success: false, error: 'rpc_error' }
    }

    const row = (data || {}) as any
    return {
      success: Boolean(row.success),
      error: row.error,
      mkeysPurchased: num(row.mkeys_purchased, requested),
      coinCost: num(row.coin_cost),
      available: num(row.available),
      balance: num(row.balance),
    }
  } catch (err) {
    console.warn('[MKeys] coin purchase threw:', err)
    return { success: false, error: 'exception' }
  }
}

/** Human-readable copy for a failed coin purchase. */
export function describeMKeyPurchaseError(result: MKeyPurchaseResult): string {
  if (!result.error) return 'Could not purchase MKeys. Try again.'
  switch (result.error) {
    case 'not_authenticated':
      return 'Sign in to buy MKeys.'
    case 'insufficient_coins':
      return 'You do not have enough coins to buy that many MKeys.'
    case 'invalid_amount':
      return 'Choose at least 1 MKey to buy.'
    default:
      return 'Could not purchase MKeys. Try again.'
  }
}

/** Human-readable copy for a failed send, so every surface says the same thing. */
export function describeMKeySendError(result: MKeySendResult): string {
  if (result.message) return result.message
  switch (result.error) {
    case 'not_authenticated':
      return 'Sign in to send MKeys.'
    case 'insufficient_mkeys':
      return 'You do not have enough MKeys.'
    case 'broadcast_not_live':
      return 'This broadcast is not live right now.'
    case 'send_cooldown':
      return 'Slow down a moment before sending more MKeys.'
    default:
      return 'Could not send MKeys. Try again.'
  }
}
