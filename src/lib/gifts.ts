import { supabase } from './supabase'
import { toast } from 'sonner'
import { xpService } from '../services/xpService'
import { XP_RATES } from './xp'

const GIFT_MEDIA_COLUMNS = [
  'id',
  'name',
  'slug',
  'gift_slug',
  'icon',
  'icon_url',
  'tray_visual_url',
  'animation_url',
  'video_url',
  'animation_type',
  'animation_duration_ms',
  'sound_url',
  'coin_cost',
  'metadata',
].join(',')

async function fetchGiftItemById(id: string, columns: string) {
  return supabase
    .from('gift_items')
    .select(columns)
    .eq('id', id)
    .maybeSingle()
}

async function fetchGiftItemBySlug(slug: string, columns: string) {
  return supabase
    .from('gift_items')
    .select(columns)
    .or(`gift_slug.eq.${slug},slug.eq.${slug}`)
    .maybeSingle()
}

async function fetchGiftItemByName(name: string, columns: string) {
  return supabase
    .from('gift_items')
    .select(columns)
    .eq('name', name)
    .maybeSingle()
}

async function fetchPurchasableItemById(id: string, columns: string) {
  return supabase
    .from('purchasable_items')
    .select(columns)
    .eq('id', id)
    .maybeSingle()
}

async function fetchPurchasableItemBySlug(slug: string, columns: string) {
  return supabase
    .from('purchasable_items')
    .select(columns)
    .or(`item_key.eq.${slug},slug.eq.${slug}`)
    .maybeSingle()
}

async function fetchPurchasableItemByName(name: string, columns: string) {
  return supabase
    .from('purchasable_items')
    .select(columns)
    .eq('display_name', name)
    .maybeSingle()
}

async function fetchLegacyGiftById(id: string, columns: string) {
  return supabase
    .from('gifts')
    .select(columns)
    .eq('id', id)
    .maybeSingle()
}

async function fetchLegacyGiftBySlug(slug: string, columns: string) {
  return supabase
    .from('gifts')
    .select(columns)
    .eq('slug', slug)
    .maybeSingle()
}

async function fetchLegacyGiftByName(name: string, columns: string) {
  return supabase
    .from('gifts')
    .select(columns)
    .eq('name', name)
    .maybeSingle()
}

const PURCHASABLE_MEDIA_COLUMNS = [
  'id',
  'name',
  'display_name',
  'slug',
  'item_key',
  'icon',
  'icon_url',
  'metadata',
  'coin_price',
].join(',')

const LEGACY_GIFT_COLUMNS = [
  'id',
  'name',
  'slug',
  'cost',
].join(',')

export async function hydrateGiftForOverlay(incomingGift: any) {
  const metadata = incomingGift?.metadata || {}

  const rawGiftIdentifier =
    incomingGift?.gift_id ||
    incomingGift?.gift_item_id ||
    incomingGift?.giftId ||
    incomingGift?.giftItemId ||
    metadata?.gift_id ||
    metadata?.gift_item_id ||
    null

  const giftSlug =
    incomingGift?.gift_slug ||
    incomingGift?.slug ||
    metadata?.gift_slug ||
    metadata?.slug ||
    null

  const giftName =
    incomingGift?.gift_name ||
    incomingGift?.name ||
    metadata?.gift_name ||
    metadata?.name ||
    null

  let giftItem: any = null
  let lookupError: any = null

  if (import.meta.env.DEV) {
    console.error('[GIFT RAW EVENT DEBUG]', {
      raw: incomingGift,
      id: incomingGift?.id,
      gift_id: incomingGift?.gift_id,
      gift_item_id: incomingGift?.gift_item_id,
      gift_slug: incomingGift?.gift_slug,
      slug: incomingGift?.slug,
      metadata: incomingGift?.metadata,
      animation_url: incomingGift?.animation_url,
      video_url: incomingGift?.video_url,
      stream_id: incomingGift?.stream_id,
      sender_id: incomingGift?.sender_id,
      receiver_id: incomingGift?.receiver_id,
    })
  }

  if (import.meta.env.DEV) {
    console.error('[GIFT HYDRATE DEBUG]', {
      giftItemId: rawGiftIdentifier,
      incomingGift,
    })
  }

  // 1. UUID lookup by gift_items.id
  if (rawGiftIdentifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawGiftIdentifier))) {
    const { data, error } = await fetchGiftItemById(rawGiftIdentifier, GIFT_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || null
    }
  }

  // 2. Slug lookup
  if (!giftItem && giftSlug) {
    const { data, error } = await fetchGiftItemBySlug(giftSlug, GIFT_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  // 3. Name lookup
  if (!giftItem && giftName && giftName !== 'Gift') {
    const { data, error } = await fetchGiftItemByName(giftName, GIFT_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  // 4. Fallback: purchasable_items (for gifts loaded from the store catalog)
  if (!giftItem && rawGiftIdentifier) {
    const { data, error } = await fetchPurchasableItemById(rawGiftIdentifier, PURCHASABLE_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  if (!giftItem && giftSlug) {
    const { data, error } = await fetchPurchasableItemBySlug(giftSlug, PURCHASABLE_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  if (!giftItem && giftName && giftName !== 'Gift') {
    const { data, error } = await fetchPurchasableItemByName(giftName, PURCHASABLE_MEDIA_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  // 5. Fallback: legacy gifts table (backward compat)
  if (!giftItem && rawGiftIdentifier) {
    const { data, error } = await fetchLegacyGiftById(rawGiftIdentifier, LEGACY_GIFT_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  if (!giftItem && giftSlug) {
    const { data, error } = await fetchLegacyGiftBySlug(giftSlug, LEGACY_GIFT_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  if (!giftItem && giftName && giftName !== 'Gift') {
    const { data, error } = await fetchLegacyGiftByName(giftName, LEGACY_GIFT_COLUMNS)
    if (data) {
      giftItem = data
    } else {
      lookupError = error || lookupError
    }
  }

  if (import.meta.env.DEV) {
    console.error('[GIFT ITEM LOOKUP RESULT]', {
      giftItemId: rawGiftIdentifier,
      giftSlug,
      giftName,
      giftItem,
      error: lookupError,
    })
  }

  if (!giftItem) {
    console.warn('[GiftHydration] REAL GIFT NOT FOUND', {
      rawGiftIdentifier,
      giftSlug,
      giftName,
      incomingGift,
    })
    return incomingGift
  }

  const mergedMetadata = {
    ...(giftItem.metadata || {}),
    ...(metadata || {}),
  }

  const resolvedAnimationUrl =
    incomingGift?.animation_url_webm ||
    giftItem.animation_url_webm ||
    incomingGift?.animation_url_mp4 ||
    giftItem.animation_url_mp4 ||
    incomingGift?.animation_url_mov ||
    giftItem.animation_url_mov ||
    incomingGift?.animation_url ||
    giftItem.animation_url ||
    incomingGift?.video_url ||
    giftItem.video_url ||
    null

  const resolvedVideoUrl =
    incomingGift?.video_url ||
    incomingGift?.animation_url ||
    giftItem.video_url ||
    giftItem.animation_url ||
    null

  return {
    ...giftItem,
    ...incomingGift,
    metadata: mergedMetadata,
    gift_id: giftItem.id,
    gift_name:
      (incomingGift?.gift_name && incomingGift.gift_name !== 'Gift') ||
      (metadata?.gift_name && metadata.gift_name !== 'Gift') ||
      giftItem.name ||
      'Gift',
    slug:
      giftItem.slug ||
      giftItem.gift_slug ||
      giftSlug,
    gift_slug:
      giftItem.gift_slug ||
      giftItem.slug ||
      giftSlug,
    animation_url: resolvedAnimationUrl,
    video_url: resolvedVideoUrl,
    animation_url_webm:
      incomingGift?.animation_url_webm ||
      giftItem.animation_url_webm ||
      null,
    animation_url_mp4:
      incomingGift?.animation_url_mp4 ||
      giftItem.animation_url_mp4 ||
      null,
    animation_url_mov:
      incomingGift?.animation_url_mov ||
      giftItem.animation_url_mov ||
      null,
    animation_type:
      incomingGift?.animation_type ||
      giftItem.animation_type ||
      'video',
    animation_duration_ms:
      incomingGift?.animation_duration_ms ||
      giftItem.animation_duration_ms ||
      giftItem.metadata?.animation_duration_ms ||
      7000,
    sound_url:
      incomingGift?.sound_url ||
      giftItem.sound_url ||
      giftItem.metadata?.sound_url ||
      null,
    tray_visual_url:
      incomingGift?.tray_visual_url ||
      giftItem.tray_visual_url ||
      giftItem.metadata?.tray_visual_url ||
      null,
    coin_cost:
      giftItem.coin_cost || incomingGift?.coin_cost || incomingGift?.amount || null,
  }
}

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

