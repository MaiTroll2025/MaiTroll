// Profile View Payment Logic
import { supabase } from './supabase'
import { toast } from 'sonner'
import { NavigateFunction } from 'react-router-dom'
import { canMessageAdmin } from './perkEffects'

/**
 * Check if user has enough coins to view a profile
 * @param viewerId - The user trying to view the profile
 * @param profileOwnerId - The profile owner's ID
 * @param profileViewPrice - The price to view the profile
 * @returns true if user can view, false if they need more coins
 */
export async function checkProfileViewPayment(
  viewerId: string,
  profileOwnerId: string,
  profileViewPrice: number | null
): Promise<{ canView: boolean; requiredCoins?: number }> {
  // No price set, free to view
  if (!profileViewPrice || profileViewPrice <= 0) {
    return { canView: true }
  }

  // Can't charge yourself
  if (viewerId === profileOwnerId) {
    return { canView: true }
  }

  // Get viewer's balance
  const { data: viewerProfile, error } = await supabase
    .from('user_profiles')
    .select('troll_coins, role, is_troll_officer, is_troller')
    .eq('id', viewerId)
    .single()

  if (error || !viewerProfile) {
    console.error('Error checking viewer balance:', error)
    return { canView: false, requiredCoins: profileViewPrice }
  }

  // Admins, officers, and trollers view for free
  const hasMessagePerk = await canMessageAdmin(viewerId)
  if (
    viewerProfile.role === 'admin' ||
    viewerProfile.is_troll_officer ||
    viewerProfile.is_troller ||
    hasMessagePerk
  ) {
    return { canView: true }
  }

  // Check balance
  const balance = viewerProfile.troll_coins || 0
  if (balance < profileViewPrice) {
    return { canView: false, requiredCoins: profileViewPrice }
  }

  return { canView: true }
}

/**
 * Charge user for viewing a profile
 * @param viewerId - The user viewing the profile
 * @param profileOwnerId - The profile owner's ID
 * @param profileViewPrice - The price to view the profile
 * @returns success status and transaction ID
 */
export async function chargeProfileView(
  viewerId: string,
  profileOwnerId: string,
  profileViewPrice: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  if (!Number.isFinite(profileViewPrice) || profileViewPrice < 0) {
    return { success: false, error: 'Invalid profile view price.' }
  }

  if (profileViewPrice === 0) {
    return { success: true }
  }

  return { success: false, error: 'Paid profile views are temporarily unavailable.' }
}

/**
 * Charge user for sending a message
 * @param senderId - The user sending the message
 * @param recipientId - The user receiving the message
 * @param cost - The cost to send the message
 * @returns success status and transaction ID
 */
export async function chargeMessageCost(
  senderId: string,
  recipientId: string,
  cost: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  if (!senderId || !recipientId) {
    return { success: false, error: 'Sender and recipient are required.' }
  }

  if (!Number.isFinite(cost) || cost < 0) {
    return { success: false, error: 'Invalid message cost.' }
  }

  if (cost === 0) {
    return { success: true }
  }

  return { success: false, error: 'Paid messages are temporarily unavailable.' }
}

/**
 * Redirect user to store with message
 */
export function redirectToStore(
  navigate: NavigateFunction,
  requiredCoins: number,
  message?: string
) {
  const defaultMessage = `You need ${requiredCoins.toLocaleString()} coins to continue. Please purchase coins.`
  toast.error(message || defaultMessage)
  navigate('/store', { state: { requiredCoins, message: message || defaultMessage } })
}
