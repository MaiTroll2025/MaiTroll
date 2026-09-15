import { supabase } from './supabase'
import { toast } from 'sonner'

// Track if we've already checked for concurrent login this session
let concurrentLoginCheckDone = false

export interface ConcurrentLoginResult {
  hasConcurrentLogin: boolean
  originalSessionId: string | null
  originalDeviceInfo: string | null
  originalLastActive: string | null
}

/**
 * Roles that are allowed to have concurrent sessions on multiple devices.
 * Auctioneers need this so they can run the desktop auction studio while
 * simultaneously using the mobile scanner (PWA or mobile web).
 */
const MULTI_SESSION_ROLES = new Set([
  'admin',
  'superadmin',
  'ceo',
  'auctioneer',
  'officer',
  'lead_officer',
])

/**
 * Check if a user has an active session from another device.
 * Uses the DB function check_concurrent_login which looks for other
 * active sessions within the last 30 minutes.
 */
export async function checkConcurrentLogin(userId: string, sessionId: string): Promise<ConcurrentLoginResult> {
  try {
    const { data, error } = await supabase.rpc('check_concurrent_login', {
      p_user_id: userId,
      p_current_session_id: sessionId,
    })

    if (error) {
      console.warn('[ConcurrentLogin] RPC error:', error)
      return { hasConcurrentLogin: false, originalSessionId: null, originalDeviceInfo: null, originalLastActive: null }
    }

    // The RPC returns a table row; data may be an array or single object
    const row = Array.isArray(data) ? data?.[0] : data
    if (!row) {
      return { hasConcurrentLogin: false, originalSessionId: null, originalDeviceInfo: null, originalLastActive: null }
    }

    return {
      hasConcurrentLogin: !!row.has_concurrent_login,
      originalSessionId: row.original_session_id || null,
      originalDeviceInfo: row.original_device_info || null,
      originalLastActive: row.original_last_active || null,
    }
  } catch (err) {
    console.warn('[ConcurrentLogin] Check failed:', err)
    return { hasConcurrentLogin: false, originalSessionId: null, originalDeviceInfo: null, originalLastActive: null }
  }
}

/**
 * Check if user has a role that permits multi-session (admin, CEO, auctioneer, etc.)
 */
export async function canHaveMultiSession(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin, is_ceo, is_superadmin, is_troll_officer, is_lead_officer')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return false

    // Explicit multi-session roles
    if (MULTI_SESSION_ROLES.has(data.role || '')) return true
    if (data.is_admin === true) return true
    if (data.is_superadmin === true) return true
    if (data.is_ceo === true) return true
    if (data.is_troll_officer === true) return true
    if (data.is_lead_officer === true) return true

    return false
  } catch (err) {
    console.error('[MultiSession] Failed to check user role:', err)
    return false
  }
}

/**
 * Summon a user to court for fraud (concurrent login violation)
 */
export async function summonUserForFraud(defendantId: string, reason: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('summon_user_to_court', {
      p_defendant_id: defendantId,
      p_reason: reason,
      p_users_involved: [],
      p_docket_id: null,
    })

    if (error) {
      console.error('Error summoning user to court:', error)
      return false
    }

    return data?.success ?? true
  } catch (err) {
    console.error('Failed to summon user for fraud:', err)
    return false
  }
}

/**
 * Handle concurrent login detection.
 *
 * - Admins, CEOs, auctioneers, officers → allowed concurrent sessions (no action).
 * - Regular users with concurrent login → logged out + summoned to court.
 *
 * For auctioneers specifically, the multi-session allowance enables the
 * desktop auction studio + mobile scanner workflow.
 */
export async function handleConcurrentLogin(
  userId: string,
  currentSessionId: string,
  onLogout: () => void,
): Promise<boolean> {
  // Skip if we've already handled this session
  if (concurrentLoginCheckDone) {
    return false
  }
  concurrentLoginCheckDone = true

  try {
    // Check if user is allowed multi-session (admin, CEO, auctioneer, officer, etc.)
    const isMultiSessionAllowed = await canHaveMultiSession(userId)
    if (isMultiSessionAllowed) {
      console.log('[ConcurrentLogin] User has multi-session role — allowing concurrent sessions')
      return false
    }

    // Check for concurrent login
    const result = await checkConcurrentLogin(userId, currentSessionId)

    if (!result.hasConcurrentLogin) {
      console.log('[ConcurrentLogin] No concurrent login detected')
      return false
    }

    console.log('[ConcurrentLogin] Concurrent login detected!', result)

    // Show warning toast
    toast.error(
      '⚠️ FRAUD ALERT: You have been logged out because your account was accessed from another device. This incident has been reported.',
      { duration: 10000 },
    )

    // Summon the original account to court for fraud
    const fraudReason = `AUTOMATIC SUMMONS: Concurrent login fraud detected. Account was accessed from multiple devices simultaneously. Original session was active on: ${result.originalLastActive || 'unknown date'}. Device: ${result.originalDeviceInfo || 'unknown device'}.`

    await summonUserForFraud(userId, fraudReason)

    console.log('[ConcurrentLogin] User summoned to court for fraud investigation')

    // Log the user out
    setTimeout(() => {
      onLogout()
      window.location.href = '/auth?message=fraud_logout'
    }, 3000)

    return true
  } catch (err) {
    console.error('[ConcurrentLogin] Error handling concurrent login:', err)
    return false
  }
}

/**
 * Reset the concurrent login check flag (for testing or re-login)
 */
export function resetConcurrentLoginCheck() {
  concurrentLoginCheckDone = false
}
