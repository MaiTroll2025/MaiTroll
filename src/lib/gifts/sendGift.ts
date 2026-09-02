import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { GiftSendResult, GiftCatalogItem } from '@/types/gifts';
import { generateUUID } from '@/lib/uuid';

/**
 * Send a gift to a user
 * - Verifies sender has enough coins
 * - Deducts coins
 * - Creates transaction record
 * - Returns result
 */
export async function sendGift(
  receiverId: string,
  giftId: string,
  streamId?: string
): Promise<GiftSendResult> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) {
    return { success: false, message: 'You must be logged in to send gifts' };
  }
  
  if (profile.id === receiverId) {
    return { success: false, message: 'You cannot send gifts to yourself' };
  }
  
  try {
    // Generate unique transaction key for deduplication
    const txnKey = `${profile.id}_${streamId || 'nostream'}_${giftId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Call the correct database function: send_gift_in_stream
    const { data, error } = await supabase.rpc('send_gift_in_stream', {
      p_sender_id: profile.id,
      p_receiver_id: receiverId,
      p_stream_id: streamId || null,
      p_gift_id: giftId,
      p_quantity: 1,
      p_metadata: { 
        txn_key: txnKey,
        trollmond_coins_back_enabled: true 
      }
    });
    
    if (error) {
      console.error('Error sending gift:', error);
      return { success: false, message: error.message || 'Failed to send gift' };
    }
    
    if (data && typeof data === 'object' && data.success) {
      return {
        success: true,
        message: data.message || 'Gift sent successfully',
        transaction_id: data.transaction_id || generateUUID(),
      };
    }
    
    // Handle unexpected response format
    if (data && typeof data === 'object' && !data.success) {
      return {
        success: false,
        message: data.message || 'Failed to send gift',
      };
    }
    
    return { success: false, message: 'Unknown error occurred' };
  } catch (err) {
    console.error('Exception sending gift:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Fetch the gift catalog from the database
 */
export async function fetchGiftCatalog(): Promise<GiftCatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from('gifts_catalog')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    
    if (error) {
      console.error('Error fetching gift catalog:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception fetching gift catalog:', err);
    return [];
  }
}

/**
 * Check if user has enough coins for a gift
 */
export async function hasEnoughCoins(giftPrice: number): Promise<boolean> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) return false;
  
  return (profile as any).coins >= giftPrice || (profile as any).troll_coins >= giftPrice;
}

/**
 * Get user's current coin balance
 */
export async function getCoinBalance(): Promise<number> {
  const { profile } = useAuthStore.getState();
  
  if (!profile) return 0;
  
  // Try to get fresh balance from profile
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('coins')
      .eq('id', profile.id)
      .single();
    
    if (error) {
      console.error('Error fetching coin balance:', error);
      return (profile as any).coins || (profile as any).troll_coins || 0;
    }
    
    return data?.coins || 0;
  } catch {
    return (profile as any).coins || (profile as any).troll_coins || 0;
  }
}

export interface SendFeaturedGiftResult extends GiftSendResult {
  reward_amount?: number;
  reward_transaction_id?: string;
}

/**
 * Send a featured gift with 5% reward.
 * Backend validates featured gift eligibility and awards reward.
 */
export async function sendFeaturedGift(
  receiverId: string,
  giftId: string,
  streamId?: string
): Promise<SendFeaturedGiftResult> {
  const { profile } = useAuthStore.getState();

  if (!profile) {
    return { success: false, message: 'You must be logged in to send gifts' };
  }

  if (profile.id === receiverId) {
    return { success: false, message: 'Cannot send gifts to yourself' };
  }

  try {
    const txnKey = `${profile.id}_${streamId || 'nostream'}_${giftId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const { data, error } = await supabase.rpc('send_featured_gift_with_reward', {
      p_sender_id: profile.id,
      p_receiver_id: receiverId,
      p_stream_id: streamId || null,
      p_gift_id: giftId,
      p_quantity: 1,
      p_metadata: {
        txn_key: txnKey,
        featured_gift: true,
      },
    });

    if (error) {
      console.error('Error sending featured gift:', error);
      return { success: false, message: error.message || 'Failed to send featured gift' };
    }

    if (data && typeof data === 'object' && data.success) {
      return {
        success: true,
        message: data.message || 'Featured gift sent successfully',
        transaction_id: data.transaction_id || generateUUID(),
        reward_amount: data.reward_amount,
        reward_transaction_id: data.reward_transaction_id,
      };
    }

    if (data && typeof data === 'object' && !data.success) {
      return {
        success: false,
        message: data.message || 'Failed to send featured gift',
      };
    }

    return { success: false, message: 'Unknown error occurred' };
  } catch (err) {
    console.error('Exception sending featured gift:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}
