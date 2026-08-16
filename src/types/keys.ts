export type KeyLetter = 'M' | 'A' | 'I' | 'T' | 'R';
export type KeyRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE' | 'LEGENDARY';
export type KeyStatus = 'active' | 'cashed_out' | 'transferred' | 'listed' | 'in_trade';
export type KeySource = 'system' | 'trade' | 'marketplace' | 'admin';
export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export type KeyTransactionAction = 'created' | 'received' | 'transferred' | 'traded' | 'sold' | 'cashed_out' | 'listed' | 'purchased' | 'set_completed' | 'set_cashed_out';

export interface KeyDefinition {
  id: string;
  key_letter: KeyLetter;
  rarity: KeyRarity;
  min_value: number;
  max_value: number;
  supply_limit: number;
  is_legendary: boolean;
  is_key_to_city: boolean;
  created_at: string;
  updated_at: string;
}

export interface KeyInstance {
  id: string;
  definition_id: string;
  key_letter: KeyLetter;
  rarity: KeyRarity;
  value: number;
  owner_id: string | null;
  previous_owner_id: string | null;
  received_at: string;
  cashout_available_at: string;
  status: KeyStatus;
  source: KeySource;
  is_transferable: boolean;
  is_key_to_city: boolean;
  cashed_out_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeyTransaction {
  id: string;
  key_instance_id: string;
  actor_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  action: KeyTransactionAction;
  value: number;
  previous_value: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface KeyTradeRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: TradeStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
}

export interface KeyTradeItem {
  id: string;
  trade_request_id: string;
  key_instance_id: string;
  offered_by_user_id: string;
  created_at: string;
}

export interface KeyMarketplaceListing {
  id: string;
  key_instance_id: string;
  seller_id: string;
  price: number;
  status: ListingStatus;
  created_at: string;
  sold_at: string | null;
  purchased_by: string | null;
}

export interface KeySetCompletion {
  id: string;
  user_id: string;
  key_instance_ids: string[];
  total_value: number;
  bonus_amount: number;
  final_amount: number;
  created_at: string;
}

export interface KeySupply {
  id: string;
  total_supply: number;
  keys_issued: number;
  keys_remaining: number;
  rarity: string;
  legendary_issued: number;
  legendary_limit: number;
  key_to_city_issued: number;
  key_to_city_limit: number;
  created_at: string;
  updated_at: string;
}

export interface KeyNotificationPayload {
  key_instance_id?: string;
  key_letter?: KeyLetter;
  rarity?: KeyRarity;
  value?: number;
  is_key_to_city?: boolean;
  trade_request_id?: string;
  listing_id?: string;
  from_username?: string;
  to_username?: string;
  key_name?: string;
}

export interface UserKeysSummary {
  total_keys: number;
  total_value: number;
  rare_keys: number;
  complete_sets: number;
  has_key_to_city: boolean;
  letters_owned: KeyLetter[];
}

export const KEY_RARITY_COLORS: Record<KeyRarity, { bg: string; text: string; border: string; glow: string }> = {
  COMMON: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/50', glow: 'shadow-gray-500/50' },
  UNCOMMON: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/50', glow: 'shadow-green-500/50' },
  RARE: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/50', glow: 'shadow-blue-500/50' },
  VERY_RARE: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/50', glow: 'shadow-purple-500/50' },
  LEGENDARY: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/50', glow: 'shadow-yellow-500/50' },
};

export const KEY_RARITY_ICONS: Record<KeyRarity, string> = {
  COMMON: '🔑',
  UNCOMMON: '🔑',
  RARE: '🔑',
  VERY_RARE: '🔑',
  LEGENDARY: '🔑',
};

export const KEY_LETTER_LABELS: Record<KeyLetter, string> = {
  M: 'M',
  A: 'A',
  I: 'I',
  T: 'T',
  R: 'R',
};
