/**
 * City Ads / Promo System Types
 * Internal Mai Troll promotional ads
 */

export type AdPlacement = 'left_sidebar_screensaver' | 'right_panel_featured' | 'home_horizontal_banner' | 'left_rail' | 'right_rail' | 'home_right_upper' | 'home_right_lower';

export type CampaignType = 
  | 'troll_coins' 
  | 'trollmonds' 
  | 'go_live' 
  | 'event' 
  | 'feature' 
  | 'limited_offer' 
  | 'announcement';

export interface CityAd {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  placement: AdPlacement;
  is_active: boolean;
  start_at?: string;
  end_at?: string;
  priority: number;
  display_order: number;
  label?: string;
  campaign_type?: CampaignType;
  background_style?: string;
  impressions_count: number;
  clicks_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  isUserAd?: boolean;
  // Maitalent integration fields (optional)
  maitalent_campaign_id?: string;
  maitalent_platform?: 'maitalent';
  maitalent_target_audience?: {
    platforms?: string[];
    countries?: string[];
    age_range?: [number, number];
  };
}

/**
 * Extended CityAd with creator info
 */
export interface CityAdWithCreator extends CityAd {
  creator_username?: string;
}

/**
 * Form data for creating/updating CityAds
 */
export interface CityAdFormData {
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  placement: AdPlacement;
  is_active: boolean;
  start_at?: string;
  end_at?: string;
  priority: number;
  display_order: number;
  label?: string;
  campaign_type?: CampaignType;
  background_style?: string;
}

/**
 * Home page promo placements
 */
export const HOME_PAGE_PROMO_PLACEMENTS: AdPlacement[] = [
  'home_right_upper',
  'home_right_lower',
];

/**
 * Ad placement configurations
 */
export const AD_PLACEMENTS: { value: AdPlacement; label: string; description: string }[] = [
  { value: 'left_rail', label: 'Left Ad Rail', description: 'Vertical card between sidebar and feed' },
  { value: 'right_rail', label: 'Right Ad Rail', description: 'Vertical card beside right panel' },
  { value: 'left_sidebar_screensaver', label: 'Left Sidebar', description: 'Tall card in empty sidebar area' },
  { value: 'right_panel_featured', label: 'Right Panel', description: 'Large featured card in right panel' },
  { value: 'home_horizontal_banner', label: 'Upper Panel', description: 'Horizontal banner on the home feed' },
  { value: 'home_right_upper', label: 'Right Upper', description: 'Upper promo slot in right sidebar' },
  { value: 'home_right_lower', label: 'Right Lower', description: 'Lower promo slot in right sidebar' },
];

/**
 * Campaign type options
 */
export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'troll_coins', label: 'Troll Coins Special' },
  { value: 'trollmonds', label: 'Trollmonds Bundle' },
  { value: 'go_live', label: 'Go Live Promotion' },
  { value: 'event', label: 'Event' },
  { value: 'feature', label: 'Feature Discovery' },
  { value: 'limited_offer', label: 'Limited Offer' },
  { value: 'announcement', label: 'Announcement' },
];

/**
 * Default ad labels
 */
export const DEFAULT_LABELS = [
  'MaiTroll Promo',
  'Special Offer',
  'Featured',
  'Limited Time',
  'New',
  'Exclusive',
];