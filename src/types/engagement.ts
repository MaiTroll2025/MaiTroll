export type StreamType = 'broadcast' | 'hytrogame' | 'podcast';

export interface EngagementTarget {
  streamType: StreamType;
  streamId: string;
}

export interface StreamEngagement {
  id: string;
  stream_type: StreamType;
  stream_id: string;
  total_likes: number;
  total_reactions: number;
  total_messages: number;
  total_gifts: number;
  total_gift_coins: number;
  unique_likers: number;
  unique_reactors: number;
  unique_chatters: number;
  unique_gifters: number;
  last_like_at: string | null;
  last_reaction_at: string | null;
  last_message_at: string | null;
  last_gift_at: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamEngagementUsers {
  stream_type: string;
  stream_id: string;
  user_id: string;
  has_liked: boolean;
  has_reacted: boolean;
  has_chatted: boolean;
  has_gifted: boolean;
  like_count: number;
  reaction_count: number;
  message_count: number;
  gift_count: number;
  gift_coins: number;
  first_activity_at: string;
  last_activity_at: string;
}

export interface EngagementBatch {
  likes: number;
  reactions: number;
  messages: number;
  gifts: number;
  giftCoins: number;
}

export interface EngagementCounts {
  totalLikes: number;
  totalReactions: number;
  totalMessages: number;
  totalGifts: number;
  totalGiftCoins: number;
  uniqueLikers: number;
  uniqueReactors: number;
  uniqueChatters: number;
  uniqueGifters: number;
}