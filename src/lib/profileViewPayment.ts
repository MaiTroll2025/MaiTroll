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

  if (profileViewPrice > 0) {
    return {
      success: false,
      error: 'Paid profile views are temporarily unavailable while secure server-side settlement is being deployed.',
    }
  }

  try {
    // Deduct from viewer securely
    const { data: spendResult, error: spendError } = await supabase.rpc('troll_bank_spend_coins', {
      p_user_id: viewerId,
      p_amount: profileViewPrice,
      p_bucket: 'profile_view',
      p_source: 'profile_view',
      p_metadata: { profile_owner_id: profileOwnerId }
    })

    if (spendError) {
      return { success: false, error: spendError.message }
    }

    if (spendResult && spendResult.success === false) {
      return { success: false, error: spendResult.error || 'Insufficient balance' }
    }

    // Note: If we need to credit the profile owner, we should add that logic here using a credit RPC
    // For now, we only handle the deduction as per original code structure
    
    // Add to profile owner's earned coins
    const { error: ownerError } = await supabase.rpc('add_troll_coins', {
       p_user_id: profileOwnerId,
       p_amount: profileViewPrice
    });

    if (ownerError) {
       console.error('Error adding coins to owner:', ownerError);
       // Don't fail the transaction, just log it
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error charging profile view:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
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
  if (!Number.isFinite(cost) || cost < 0) {
    return { success: false, error: 'Invalid message cost.' }
  }

  if (cost === 0) {
    return { success: true }
  }

  if (cost > 0) {
    return {
      success: false,
      error: 'Paid messages are temporarily unavailable while secure server-side settlement is being deployed.',
    }
  }

  try {
    // Deduct from sender securely using troll_bank_spend_coins
    const { data: spendResult, error: spendError } = await supabase.rpc('troll_bank_spend_coins', {
      p_user_id: senderId,
      p_amount: cost,
      p_bucket: 'message_cost',
      p_source: 'message_payment',
      p_metadata: { recipient_id: recipientId }
    })

    if (spendError) {
      return { success: false, error: spendError.message }
    }

    if (spendResult && spendResult.success === false) {
      return { success: false, error: spendResult.error || 'Insufficient balance' }
    }

    // Add to recipient's earned coins
    const { error: ownerError } = await supabase.rpc('add_troll_coins', {
      p_user_id: recipientId,
      p_amount: cost
    })

    if (ownerError) {
      console.error('Error adding coins to recipient:', ownerError)
    }

    // Record transaction
    const { data: transaction, error: txError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: senderId,
        coins: -cost,
        type: 'message_cost', 
        source: 'message_payment',
        payment_status: 'completed',
        metadata: {
          recipient_id: recipientId,
          message_cost: cost
        }
      })
      .select()
      .single()

    if (txError) {
      console.error('Error recording transaction:', txError)
    }

    return { success: true, transactionId: transaction?.id }
  } catch (error: any) {
    console.error('Error charging message cost:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
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
