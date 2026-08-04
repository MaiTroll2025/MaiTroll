import { supabase } from './supabase'
import { toast } from 'sonner'
import { xpService } from '../services/xpService'
import { XP_RATES } from './xp'

/**
 * Send a gift from one user to another
 * 
 * ⚠️ DEPRECATED: Use useCoins().spendCoins() instead
 * This function is kept for backward compatibility but now wraps the hook pattern.
 * 
 * @param senderId - UUID of the user sending the gift
 * @param receiverId - UUID of the user receiving the gift
 * @param coins - Number of coins to send
 * @param itemName - Optional name of the gift item (e.g., 'TrollRose')
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const sendGift = async (
  senderId: string,
  receiverId: string,
  coins: number,
  itemName?: string
): Promise<boolean> => {
  // Skip for guest IDs
  if (senderId.startsWith('TC-')) {
    console.error('Error sending gift: Guest users cannot send gifts');
    toast.error('Please log in to send gifts');
    return false;
  }
  
  if (senderId === receiverId) {
    toast.error('You cannot send gifts to yourself');
    return false;
  }
  
  try {
    const { data, error } = await supabase.rpc('spend_coins', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_coin_amount: coins,
      p_source: 'gift',
      p_item: itemName || 'Gift'
    })

    if (error) {
      console.error('Error sending gift:', error)
      
      // Check if it's a "not enough coins" error
      if (error.message?.includes('Not enough coins') || error.message?.includes('insufficient')) {
        toast.error('Not enough coins!')
      } else {
        toast.error(error.message || 'Failed to send gift')
      }
      
      return false
    }

    // Check if the RPC returned an error in the response
    if (typeof data === 'boolean') {
        if (!data) {
            toast.error('Insufficient funds or error')
            return false
        }
    } else if (data && typeof data === 'object' && 'success' in data && !data.success) {
      const errorMsg = (data as any).error || 'Failed to send gift'
      
      if (errorMsg.includes('Not enough coins')) {
        toast.error('Not enough coins!')
      } else {
        toast.error(errorMsg)
      }
      
      return false
    }

    // Grant XP to sender (gifter) - 25% of coin amount
    const gifterXp = Math.floor(coins * XP_RATES.GIFTER);
    if (gifterXp > 0) {
      await xpService.grantXP(
        senderId,
        gifterXp,
        'gift_sent',
        `gift_${Date.now()}`,
        { coins, item: itemName || 'Gift' }
      );
    }
    
    // Grant XP to receiver (streamer) - 100% of coin amount
    const streamerXp = Math.floor(coins * XP_RATES.STREAMER);
    if (streamerXp > 0) {
      await xpService.grantXP(
        receiverId,
        streamerXp,
        'gift_received',
        `gift_${Date.now()}`,
        { coins, sender_id: senderId }
      );
    }

    toast.success(`🎁 Gift sent successfully!`)
    return true
  } catch (err: any) {
    console.error('Unexpected error sending gift:', err)
    toast.error(err.message || 'Failed to send gift')
    return false
  }
}

/**
 * Send a gift with a specific item name (convenience wrapper)
 * 
 * @param senderId - UUID of the user sending the gift
 * @param receiverId - UUID of the user receiving the gift
 * @param coins - Number of coins to send
 * @param itemName - Name of the gift item (e.g., 'TrollRose', 'Diamond', 'Crown')
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const sendGiftWithItem = async (
  senderId: string,
  receiverId: string,
  coins: number,
  itemName: string
): Promise<boolean> => {
  return sendGift(senderId, receiverId, coins, itemName)
}

