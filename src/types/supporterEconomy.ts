export interface SupporterEconomyConfig {
  config_key: string;
  config_value: string;
  config_type: string;
  description: string;
}

export interface WeeklyCashbackPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: 'open' | 'closed' | 'paid';
  total_eligible_senders: number;
  total_cashback_coins: number;
  created_at: string;
}

export interface WeeklyCashbackEligible {
  id: string;
  user_id: string;
  period_id: string;
  total_gifts: number;
  total_coins_spent: number;
  total_coins_back: number;
  cashback_amount: number;
  paid_at: string | null;
  created_at: string;
}

export interface WeeklyCashbackPayout {
  id: string;
  user_id: string;
  period_id: string;
  eligible_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  txn_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface WeeklyCashbackStatus {
  period_start: string;
  period_end: string;
  total_gifts: number;
  total_coins_spent: number;
  total_coins_back: number;
  cashback_amount: number;
  paid_at: string | null;
  is_paid: boolean;
  qualifies: boolean;
}

export interface GifterStatsDaily {
  id: string;
  user_id: string;
  stats_date: string;
  total_gifts: number;
  total_coins_spent: number;
  total_coins_back: number;
  unique_recipients: number;
  created_at: string;
}

export interface GifterStatsWeekly {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_gifts: number;
  total_coins_spent: number;
  total_coins_back: number;
  unique_recipients: number;
  rank: number | null;
  created_at: string;
}

export interface GifterLeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_gifts: number;
  total_coins_spent: number;
  total_coins_back: number;
}

export interface BroadcasterWishlist {
  id: string;
  broadcaster_id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  status: 'active' | 'completed' | 'cancelled';
  completed_at: string | null;
  stream_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WishlistProgress {
  id: string;
  wishlist_id: string;
  item_id: string | null;
  backer_id: string;
  amount: number;
  gift_txn_id: string | null;
  stream_gift_id: number | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface FanCrown {
  id: string;
  wishlist_id: string;
  item_id: string | null;
  winner_id: string;
  amount: number;
  gift_txn_id: string | null;
  stream_gift_id: number | null;
  reason: string;
  created_at: string;
}

export interface FreeSubscription {
  id: string;
  subscriber_id: string;
  broadcaster_id: string;
  tier_id: string | null;
  source: 'fan_crown' | 'weekly_cashback' | 'admin_grant';
  source_id: string | null;
  started_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EPaperStory {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url: string | null;
  author_id: string;
  author_name: string | null;
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  reviewed_by: string | null;
  category: string;
  tags: string[] | null;
  is_breaking: boolean;
  view_count: number;
  tip_count: number;
  tip_total_coins: number;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EPaperStoryTip {
  id: string;
  story_id: string;
  tipper_id: string;
  tipper_name: string | null;
  amount: number;
  coin_type: 'troll_coins' | 'paid_coins';
  message: string | null;
  created_at: string;
}

export interface CreateWishlistInput {
  broadcaster_id: string;
  title: string;
  description?: string;
  target_amount?: number;
}

export interface AddWishlistItemInput {
  wishlist_id: string;
  title: string;
  description?: string;
  target_amount?: number;
}

export interface BackWishlistItemInput {
  user_id: string;
  item_id: string;
  amount: number;
  gift_txn_id?: string;
  stream_gift_id?: number;
}

export interface TipEPaperStoryInput {
  story_id: string;
  tipper_id: string;
  amount: number;
  coin_type?: 'troll_coins' | 'paid_coins';
  message?: string;
}

export interface CreateEPaperStoryInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url?: string;
  author_id: string;
  category?: string;
  tags?: string[];
  is_breaking?: boolean;
}

export type UniverseEventType =
  | 'show'
  | 'championship'
  | 'battle'
  | 'arrest'
  | 'universe'
  | 'showdown';

export interface UniverseNewspaperEvent {
  id: string;
  event_type: UniverseEventType;
  title: string;
  subtitle: string | null;
  status: string;
  occurs_at: string | null;
  meta: {
    kind?: string;
    room_name?: string;
    host_id?: string | null;
    season_number?: number | null;
    grand_prize_coins?: number | null;
    grand_prize_description?: string | null;
    entries_limit?: number | null;
    stream_id_a?: string | null;
    stream_id_b?: string | null;
    score_a?: number | null;
    score_b?: number | null;
    winner?: string | null;
    user_id?: string | null;
    release_time?: string | null;
    event_date?: string | null;
    timezone?: string | null;
    capacity?: number | null;
    registered_count?: number | null;
    guest_count?: number | null;
    [key: string]: unknown;
  };
  route: string;
}
