// Gift Types and Interfaces

export type GiftRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type AnimationType =
  | 'emoji'
  | 'particle'
  | 'video'
  | 'fullscreen_video'
  | 'screen_takeover'
  | 'shake'
  | 'portal'
  | 'burst'
  | 'float'
  | 'spin'
  | 'drop'
  | 'orbit'
  | 'spotlight'
  | 'fireworks';

export interface GiftCatalogItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  model_url?: string;
  thumbnail_url?: string;
  rarity: GiftRarity;
  animation_type: AnimationType;
  animation_key?: string;
  animation_url?: string;
  animation_duration_ms?: number;
  sound_url?: string;
  is_fullscreen?: boolean;
  tray_visual_url?: string;
  tray_gradient?: string;
  duration: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface GiftTransaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  session_id?: string;
  coins_spent: number;
  created_at: string;
  // Joined data
  gift?: GiftCatalogItem;
  sender?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}

export interface GiftInstance {
  id: string;
  giftId: string;
  gift: GiftCatalogItem;
  senderId: string;
  senderName: string;
  receiverId: string;
  sessionId?: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  animationType: AnimationType;
  duration: number;
  startTime: number;
  rarity: GiftRarity;
}

export interface GiftPosition {
  x: number;
  y: number;
  z: number;
}

export interface GiftSendResult {
  success: boolean;
  message: string;
  transaction_id?: string;
}

// Rarity colors for visual effects
export const RARITY_COLORS: Record<GiftRarity, string> = {
  common: '#9CA3AF',      // Gray
  uncommon: '#22C55E',   // Green
  rare: '#3B82F6',       // Blue
  epic: '#A855F7',       // Purple
  legendary: '#F59E0B',  // Amber/Gold
  mythic: '#EF4444',     // Red
};

// Rarity glow intensities
export const RARITY_GLOW: Record<GiftRarity, number> = {
  common: 0.2,
  uncommon: 0.4,
  rare: 0.6,
  epic: 0.8,
  legendary: 1.0,
  mythic: 1.2,
};

// Animation durations by type (ms)
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  emoji: 2000,
  particle: 3000,
  video: 4500,
  fullscreen_video: 6000,
  screen_takeover: 7000,
  shake: 2500,
  portal: 4000,
  float: 3000,
  spin: 4000,
  burst: 5000,
  drop: 3500,
  orbit: 6000,
  spotlight: 8000,
  fireworks: 10000,
};
