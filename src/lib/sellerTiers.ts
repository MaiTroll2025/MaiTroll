// ==========================================
// SELLER TIER SYSTEM - TypeScript Definitions
// ==========================================

export type SellerTier = 'standard' | 'verified' | 'verified_pro' | 'merchant' | 'enterprise';

export interface SellerTierInfo {
  tier: SellerTier;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

// Badge colors - Blue is reserved for Troll Officers ONLY
export const SELLER_TIER_CONFIG: Record<SellerTier, SellerTierInfo> = {
  standard: {
    tier: 'standard',
    label: 'Standard Seller',
    color: '#9ca3af', // Gray
    bgColor: 'rgba(156, 163, 175, 0.1)',
    borderColor: '#9ca3af',
    icon: '📦',
  },
  verified: {
    tier: 'verified',
    label: 'Verified Seller',
    color: '#fbbf24', // Yellow
    bgColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: '#fbbf24',
    icon: '✓',
  },
  verified_pro: {
    tier: 'verified_pro',
    label: 'Verified Pro',
    color: '#f59e0b', // Gold
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#f59e0b',
    icon: '⭐',
  },
  merchant: {
    tier: 'merchant',
    label: 'Merchant',
    color: '#f97316', // Orange
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: '#f97316',
    icon: '🏪',
  },
  enterprise: {
    tier: 'enterprise',
    label: 'Enterprise',
    color: '#a855f7', // Purple
    bgColor: 'rgba(168, 85, 247, 0.1)',
    borderColor: '#a855f7',
    icon: '🏢',
  },
};

// Helper to get tier info
export function getSellerTierInfo(tier: SellerTier): SellerTierInfo {
  return SELLER_TIER_CONFIG[tier] || SELLER_TIER_CONFIG.standard;
}

// Helper to check if tier can be displayed
export function canDisplaySellerTier(userTier: string | null): boolean {
  return userTier !== null && userTier !== 'standard';
}

// Tier upgrade priority (higher = better)
export const TIER_PRIORITY: Record<SellerTier, number> = {
  standard: 0,
  verified: 1,
  verified_pro: 2,
  merchant: 3,
  enterprise: 4,
};

// ==========================================
// REVIEW SYSTEM TYPES
// ==========================================

export interface MarketplaceReview {
  id: string;
  order_id: string;
  seller_id: string;
  buyer_id: string;
  listing_id: string | null;
  listing_type: 'marketplace' | 'vehicle' | 'service';
  rating: number;
  comment: string | null;
  images: string[];
  delivery_rating: number | null;
  item_as_described: boolean;
  would_recommend: boolean;
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  buyer_username?: string;
  buyer_avatar?: string;
}

export interface CreateReviewInput {
  order_id: string;
  seller_id: string;
  buyer_id: string;
  listing_id?: string;
  listing_type?: 'marketplace' | 'vehicle' | 'service';
  rating: number;
  comment?: string;
  images?: string[];
  delivery_rating?: number;
  item_as_described?: boolean;
  would_recommend?: boolean;
}

// ==========================================
// APPEAL MEDIA TYPES
// ==========================================

export interface MediaMetadata {
  url: string;
  filename: string;
  contentType: string;
  size: number;
  // EXIF data when available
  image_taken_at?: string;
  upload_time?: string;
  metadata_available?: boolean;
  // Device info if available
  device_make?: string;
  device_model?: string;
}

export interface AppealMedia {
  images: MediaMetadata[];
  videos: MediaMetadata[];
}

// ==========================================
// NOTIFICATION TYPES FOR SELLER SYSTEM
// ==========================================

export type SellerNotificationType = 
  | 'seller_tier_upgraded'
  | 'seller_tier_downgraded'
  | 'new_review_received'
  | 'appeal_submitted'
  | 'appeal_decision';

// ==========================================
// TIER EVALUATION RESULT
// ==========================================
