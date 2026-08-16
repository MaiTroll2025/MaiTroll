import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/sendNotification';
import type {
  KeyInstance,
  KeyDefinition,
  KeyTransaction,
  KeyTradeRequest,
  KeyTradeItem,
  KeyMarketplaceListing,
  KeySetCompletion,
  KeySupply,
  KeyLetter,
  KeyRarity,
  KeyStatus,
  TradeStatus,
  ListingStatus,
  KeyTransactionAction,
  KeyNotificationPayload,
} from '../types/keys';

export type { KeyLetter, KeyRarity, KeyStatus, TradeStatus, ListingStatus, KeyTransactionAction };

// =========================================================================
// KEY DEFINITIONS
// =========================================================================

export async function getKeyDefinitions(): Promise<KeyDefinition[]> {
  const { data, error } = await supabase
    .from('key_definitions')
    .select('*')
    .order('key_letter', { ascending: true })
    .order('rarity', { ascending: true });

  if (error) {
    console.warn('getKeyDefinitions error:', error.message);
    return [];
  }
  return (data as KeyDefinition[]) || [];
}

// =========================================================================
// KEY INSTANCES
// =========================================================================

export async function getUserKeysPrivate(userId: string): Promise<KeyInstance[]> {
  const { data, error } = await supabase.rpc('get_user_keys_private', { p_user_id: userId });
  if (error) {
    console.warn('getUserKeysPrivate error:', error.message);
    return [];
  }
  return (data as KeyInstance[]) || [];
}

export async function getUserKeysPublic(userId: string): Promise<Omit<KeyInstance, 'value' | 'cashout_available_at' | 'is_transferable' | 'source'>[]> {
  const { data, error } = await supabase.rpc('get_user_keys_public', { p_user_id: userId });
  if (error) {
    console.warn('getUserKeysPublic error:', error.message);
    return [];
  }
  return (data as any[]) || [];
}

export async function getKeyVerifiedValue(keyInstanceId: string, userId: string): Promise<KeyInstance | null> {
  const { data, error } = await supabase.rpc('get_key_verified_value', {
    p_key_instance_id: keyInstanceId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('getKeyVerifiedValue error:', error.message);
    return null;
  }
  return (data as KeyInstance) || null;
}

// =========================================================================
// KEY AWARD
// =========================================================================

export async function awardKeyToUser(userId: string): Promise<{
  success: boolean;
  key_instance_id?: string;
  key_letter?: KeyLetter;
  rarity?: KeyRarity;
  value?: number;
  is_key_to_city?: boolean;
  cashout_available_at?: string;
  error?: string;
  message?: string;
}> {
  const { data, error } = await supabase.rpc('award_key_to_user', { p_user_id: userId });
  if (error) {
    console.warn('awardKeyToUser error:', error.message);
    return { success: false, error: 'RPC_ERROR', message: error.message };
  }
  return data as any;
}

// =========================================================================
// KEY TRANSFER
// =========================================================================

export async function transferKey(
  keyInstanceId: string,
  fromUserId: string,
  toUserId: string
): Promise<{ success: boolean; error?: string; key_instance_id?: string }> {
  const { data, error } = await supabase.rpc('transfer_key', {
    p_key_instance_id: keyInstanceId,
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
  });
  if (error) {
    console.warn('transferKey error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

// =========================================================================
// KEY CASHOUT
// =========================================================================

export async function cashoutKey(
  keyInstanceId: string,
  userId: string
): Promise<{ success: boolean; value?: number; key_instance_id?: string; error?: string; available_at?: string }> {
  const { data, error } = await supabase.rpc('cashout_key', {
    p_key_instance_id: keyInstanceId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('cashoutKey error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function cashoutMaiTrollSet(
  userId: string
): Promise<{
  success: boolean;
  total_value?: number;
  bonus_amount?: number;
  final_amount?: number;
  key_ids?: string[];
  error?: string;
}> {
  const { data, error } = await supabase.rpc('cashout_maitroll_set', { p_user_id: userId });
  if (error) {
    console.warn('cashoutMaiTrollSet error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

// =========================================================================
// KEY TRADING
// =========================================================================

export async function createTradeRequest(
  fromUserId: string,
  toUserId: string,
  offeredKeyIds: string[],
  requestedKeyIds: string[],
  message?: string
): Promise<{ success: boolean; trade_request_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_trade_request', {
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_offered_key_ids: offeredKeyIds,
    p_requested_key_ids: requestedKeyIds,
    p_message: message || null,
  });
  if (error) {
    console.warn('createTradeRequest error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function acceptTradeRequest(
  tradeRequestId: string,
  userId: string
): Promise<{ success: boolean; trade_request_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('accept_trade_request', {
    p_trade_request_id: tradeRequestId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('acceptTradeRequest error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function declineTradeRequest(
  tradeRequestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('decline_trade_request', {
    p_trade_request_id: tradeRequestId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('declineTradeRequest error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function cancelTradeRequest(
  tradeRequestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('cancel_trade_request', {
    p_trade_request_id: tradeRequestId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('cancelTradeRequest error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function getTradeRequests(userId: string): Promise<(KeyTradeRequest & { trade_items: KeyTradeItem[] })[]> {
  const { data, error } = await supabase
    .from('key_trade_requests')
    .select(`
      *,
      key_trade_items(*)
    `)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getTradeRequests error:', error.message);
    return [];
  }
  return (data as any[]) || [];
}

// =========================================================================
// KEY MARKETPLACE
// =========================================================================

export async function listKeyForSale(
  keyInstanceId: string,
  sellerId: string,
  price: number
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('list_key_for_sale', {
    p_key_instance_id: keyInstanceId,
    p_user_id: sellerId,
    p_price: price,
  });
  if (error) {
    console.warn('listKeyForSale error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function purchaseKey(
  listingId: string,
  buyerId: string
): Promise<{ success: boolean; key_instance_id?: string; price?: number; error?: string }> {
  const { data, error } = await supabase.rpc('purchase_key', {
    p_listing_id: listingId,
    p_user_id: buyerId,
  });
  if (error) {
    console.warn('purchaseKey error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function cancelKeyListing(
  listingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('cancel_key_listing', {
    p_listing_id: listingId,
    p_user_id: userId,
  });
  if (error) {
    console.warn('cancelKeyListing error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

export async function getMarketplaceListings(): Promise<(KeyMarketplaceListing & { key_instance: KeyInstance })[]> {
  const { data, error } = await supabase
    .from('key_marketplace_listings')
    .select(`
      *,
      key_instance:key_instances(*)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getMarketplaceListings error:', error.message);
    return [];
  }
  return (data as any[]) || [];
}

export async function getUserListings(userId: string): Promise<KeyMarketplaceListing[]> {
  const { data, error } = await supabase
    .from('key_marketplace_listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getUserListings error:', error.message);
    return [];
  }
  return (data as KeyMarketplaceListing[]) || [];
}

// =========================================================================
// KEY SUPPLY
// =========================================================================

export async function getKeySupplyStats(): Promise<KeySupply[]> {
  const { data, error } = await supabase.rpc('get_key_supply_stats');
  if (error) {
    console.warn('getKeySupplyStats error:', error.message);
    return [];
  }
  return (data as KeySupply[]) || [];
}

// =========================================================================
// KEY TRANSACTIONS
// =========================================================================

export async function getUserKeyTransactions(userId: string): Promise<KeyTransaction[]> {
  const { data, error } = await supabase
    .from('key_transactions')
    .select('*')
    .or(`actor_id.eq.${userId},from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getUserKeyTransactions error:', error.message);
    return [];
  }
  return (data as KeyTransaction[]) || [];
}

// =========================================================================
// KEY SET COMPLETIONS
// =========================================================================

export async function getUserSetCompletions(userId: string): Promise<KeySetCompletion[]> {
  const { data, error } = await supabase
    .from('key_set_completions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getUserSetCompletions error:', error.message);
    return [];
  }
  return (data as KeySetCompletion[]) || [];
}

// =========================================================================
// ADMIN
// =========================================================================

export async function adminSeedKey(
  userId: string,
  letter: KeyLetter,
  rarity: KeyRarity,
  value: number
): Promise<{ success: boolean; key_instance_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('admin_seed_key', {
    p_user_id: userId,
    p_letter: letter,
    p_rarity: rarity,
    p_value: value,
  });
  if (error) {
    console.warn('adminSeedKey error:', error.message);
    return { success: false, error: 'RPC_ERROR' };
  }
  return data as any;
}

// =========================================================================
// HELPERS
// =========================================================================

export function formatCashoutDate(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getDaysUntilCashout(cashoutAvailableAt: string): number {
  const now = new Date();
  const available = new Date(cashoutAvailableAt);
  const diff = available.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isCashoutAvailable(cashoutAvailableAt: string): boolean {
  return new Date(cashoutAvailableAt) <= new Date();
}

export function calculateUserKeysSummary(keys: KeyInstance[]): {
  total_keys: number;
  total_value: number;
  rare_keys: number;
  complete_sets: number;
  has_key_to_city: boolean;
  letters_owned: KeyLetter[];
} {
  const activeKeys = keys.filter(k => k.status === 'active');
  const total_keys = activeKeys.length;
  const total_value = activeKeys.reduce((sum, k) => sum + (k.value || 0), 0);
  const rare_keys = activeKeys.filter(k => ['RARE', 'VERY_RARE', 'LEGENDARY'].includes(k.rarity)).length;
  const has_key_to_city = activeKeys.some(k => k.is_key_to_city);

  const letters_owned = Array.from(
    new Set(activeKeys.map(k => k.key_letter))
  ) as KeyLetter[];
  const complete_sets = letters_owned.length === 5 ? 1 : 0;

  return { total_keys, total_value, rare_keys, complete_sets, has_key_to_city, letters_owned };
}

// =========================================================================
// NOTIFICATIONS
// =========================================================================

export async function notifyKeyReceived(
  userId: string,
  keyInstanceId: string,
  keyLetter: KeyLetter,
  rarity: KeyRarity,
  value: number,
  isKeyToCity: boolean
): Promise<void> {
  const title = isKeyToCity ? '🔑 YOU FOUND A KEY TO THE CITY!' : '🔑 You received a new key!';
  const message = isKeyToCity
    ? 'You discovered the ultra-rare KEY TO THE CITY worth 20,000 Troll Coins!'
    : `You received a ${rarity.replace('_', ' ')} key: ${keyLetter} — worth ${value.toLocaleString()} Troll Coins.`;

  await sendNotification(userId, 'key_received', title, message, {
    key_instance_id: keyInstanceId,
    key_letter: keyLetter,
    key_rarity: rarity,
    key_value: value,
    is_key_to_city: isKeyToCity,
  } as KeyNotificationPayload);
}

export async function notifyTradeRequest(
  toUserId: string,
  fromUserId: string,
  fromUsername: string,
  tradeRequestId: string
): Promise<void> {
  await sendNotification(toUserId, 'key_trade_request', '🔑 Trade Request', `${fromUsername} wants to trade keys with you.`, {
    trade_request_id: tradeRequestId,
    from_username: fromUsername,
  } as KeyNotificationPayload);
}

export async function notifyTradeAccepted(
  userId: string,
  byUsername: string,
  tradeRequestId: string
): Promise<void> {
  await sendNotification(userId, 'key_trade_accepted', '🔑 Trade Accepted', `${byUsername} accepted your trade request.`, {
    trade_request_id: tradeRequestId,
    from_username: byUsername,
  } as KeyNotificationPayload);
}

export async function notifyTradeDeclined(
  userId: string,
  byUsername: string,
  tradeRequestId: string
): Promise<void> {
  await sendNotification(userId, 'key_trade_declined', '🔑 Trade Declined', `${byUsername} declined your trade request.`, {
    trade_request_id: tradeRequestId,
    from_username: byUsername,
  } as KeyNotificationPayload);
}

export async function notifyKeyListed(
  userId: string,
  keyInstanceId: string,
  keyLetter: KeyLetter,
  rarity: KeyRarity,
  price: number
): Promise<void> {
  await sendNotification(userId, 'key_sale_listed', '🔑 Key Listed', `Your ${keyLetter} (${rarity.replace('_', ' ')}) is now listed for ${price.toLocaleString()} TC.`, {
    key_instance_id: keyInstanceId,
    key_letter: keyLetter,
    key_rarity: rarity,
  } as KeyNotificationPayload);
}

export async function notifyKeyPurchased(
  userId: string,
  keyInstanceId: string,
  keyLetter: KeyLetter,
  rarity: KeyRarity,
  price: number
): Promise<void> {
  await sendNotification(userId, 'key_sale_completed', '🔑 Key Purchased', `You purchased a ${keyLetter} (${rarity.replace('_', ' ')}) for ${price.toLocaleString()} TC.`, {
    key_instance_id: keyInstanceId,
    key_letter: keyLetter,
    key_rarity: rarity,
  } as KeyNotificationPayload);
}

export async function notifyKeyCashoutAvailable(
  userId: string,
  keyInstanceId: string,
  keyLetter: KeyLetter,
  rarity: KeyRarity,
  value: number
): Promise<void> {
  await sendNotification(userId, 'key_cashout_available', '💰 Key Ready for Cashout', `Your ${keyLetter} (${rarity.replace('_', ' ')}) is now eligible for cashout: ${value.toLocaleString()} TC.`, {
    key_instance_id: keyInstanceId,
    key_letter: keyLetter,
    key_rarity: rarity,
    key_value: value,
  } as KeyNotificationPayload);
}

export async function notifyKeyCashedOut(
  userId: string,
  keyInstanceId: string,
  keyLetter: KeyLetter,
  rarity: KeyRarity,
  value: number
): Promise<void> {
  await sendNotification(userId, 'key_cashed_out', '💰 Key Cashed Out', `Your ${keyLetter} (${rarity.replace('_', ' ')}) was cashed out for ${value.toLocaleString()} TC.`, {
    key_instance_id: keyInstanceId,
    key_letter: keyLetter,
    key_rarity: rarity,
    key_value: value,
  } as KeyNotificationPayload);
}

export async function notifyMaitrollSetCompleted(
  userId: string,
  totalValue: number,
  bonusAmount: number,
  finalAmount: number
): Promise<void> {
  await sendNotification(userId, 'maitroll_set_completed', '🎉 MAITROLL SET COMPLETE!', `You completed the MAITROLL set! ${finalAmount.toLocaleString()} TC (including ${bonusAmount.toLocaleString()} bonus).`, {
    key_value: totalValue,
  } as KeyNotificationPayload);
}
