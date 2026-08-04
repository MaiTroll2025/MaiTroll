/**
 * CENTRAL COIN CONFIGURATION
 * 
 * This is the single source of truth for all coin pack and cashout tier values.
 * 
 * Last Updated: 2026-07-17
 */

// Type for cashout tiers
export interface CashoutTierConfig {
  coins: number;
  usd: number;
  manualReview: boolean;
}

// ============================================================================
// COIN PACKAGES - User purchases (Platform receives USD)
// ============================================================================

export interface CoinPackage {
  id: string;
  coins: number;
  usdPrice: number;
  label: string;
  description: string;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg-100', coins: 110, usdPrice: 1.00, label: 'Micro Pack', description: '110 Coins' },
  { id: 'pkg-300', coins: 330, usdPrice: 3.00, label: 'Starter Pack', description: '330 Coins' },
  { id: 'pkg-500', coins: 550, usdPrice: 5.00, label: 'Small Boost', description: '550 Coins' },
  { id: 'pkg-1000', coins: 1100, usdPrice: 10.00, label: 'Casual Pack', description: '1,100 Coins' },
  { id: 'pkg-2500', coins: 2750, usdPrice: 25.00, label: 'Bronze Pack', description: '2,750 Coins' },
  { id: 'pkg-5000', coins: 5500, usdPrice: 50.00, label: 'Silver Pack', description: '5,500 Coins' },
  { id: 'pkg-10000', coins: 11000, usdPrice: 100.00, label: 'Gold Pack', description: '11,000 Coins' },
  { id: 'pkg-15000', coins: 16500, usdPrice: 150.00, label: 'Platinum Pack', description: '16,500 Coins' },
  { id: 'pkg-25000', coins: 27500, usdPrice: 250.00, label: 'Diamond Pack', description: '27,500 Coins' },
  { id: 'pkg-50000', coins: 55000, usdPrice: 500.00, label: 'Legendary Pack', description: '55,000 Coins' },
  { id: 'pkg-100000', coins: 110000, usdPrice: 1000.00, label: 'Titan Pack', description: '110,000 Coins' },
  { id: 'pkg-250000', coins: 275000, usdPrice: 2500.00, label: 'Immortal Pack', description: '275,000 Coins' },
];

// Exchange rate: 100 coins per $1 (all packages)
export const COINS_PER_USD = 100;

// ============================================================================
// CASHOUT TIERS (Single Source of Truth)
// ============================================================================
export const CASHOUT_TIERS = [
  { coins: 0, usd: 0, manualReview: false, name: 'Free Cashout', color: '#00ff00', label: '' },
  { coins: 2000, usd: 5, manualReview: false, name: 'Tier 1', color: '#cd7f32', label: '' },
  { coins: 7000, usd: 10, manualReview: false, name: 'Tier 2', color: '#c0c0c0', label: '' },
  { coins: 12000, usd: 30, manualReview: false, name: 'Tier 3', color: '#ffd700', label: '' },
  { coins: 18000, usd: 50, manualReview: false, name: 'Tier 4', color: '#ff4dd2', label: '' },
  { coins: 23000, usd: 85, manualReview: false, name: 'Tier 5', color: '#00ff00', label: '' },
  { coins: 34000, usd: 115, manualReview: false, name: 'Tier 6', color: '#ff0000', label: '' },
  { coins: 42000, usd: 150, manualReview: false, name: 'Tier 7', color: '#ff0000', label: '' },
  { coins: 56000, usd: 215, manualReview: false, name: 'Tier 8', color: '#ff0000', label: '' },
  { coins: 69000, usd: 300, manualReview: false, name: 'Tier 9', color: '#ff0000', label: '' },
  { coins: 77000, usd: 350, manualReview: false, name: 'Tier 10', color: '#ff0000', label: '' },
  { coins: 88000, usd: 415, manualReview: false, name: 'Tier 11', color: '#ff0000', label: '' },
  { coins: 96000, usd: 475, manualReview: false, name: 'Tier 12', color: '#ff0000', label: '' },
  { coins: 106000, usd: 600, manualReview: false, name: 'Tier 13', color: '#ff0000', label: '' },
  { coins: 120000, usd: 700, manualReview: false, name: 'Tier 14', color: '#ff0000', label: '' },
  { coins: 135000, usd: 800, manualReview: false, name: 'Tier 15', color: '#ff0000', label: '' },
  { coins: 150000, usd: 950, manualReview: false, name: 'Tier 16', color: '#ff0000', label: '' },
  { coins: 170000, usd: 1100, manualReview: false, name: 'Tier 17', color: '#ff0000', label: '' },
  { coins: 190000, usd: 1300, manualReview: false, name: 'Tier 18', color: '#ff0000', label: '' },
  { coins: 210000, usd: 1500, manualReview: false, name: 'Tier 19', color: '#ff0000', label: '' },
] as const;

// Alias exports for backward compatibility with old payoutTiers imports
export const TIERS = CASHOUT_TIERS;

// Type for individual cashout tier
export type CashoutTier = typeof CASHOUT_TIERS[number];

// Minimum coins required for any cashout
export const MIN_CASHOUT_COINS = 0;

// ============================================================================
// PLATFORM CAPACITY LIMITS
// ============================================================================

export const MAX_CONCURRENT_CONNECTIONS = 675;
export const DAILY_CASHOUT_LIMIT = 10;

// MAI Pay Plus — one-time paid upgrade users can select when applying for cashout.
// Grants 20 rolling cashouts (vs 10) and double coin requirements per tier.
export const MAI_PAY_PLUS_PRICE_USD = 9.99;
export const MAI_PAY_PLUS_ITEM_KEY = 'mai_pay_plus';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get cashout rate (USD per coin) for a given coin amount
 */
export function getRateForCoins(coins: number): number {
  if (coins >= 106000) return 600 / 106000;
  if (coins >= 96000) return 475 / 96000;
  if (coins >= 88000) return 415 / 88000;
  if (coins >= 77000) return 350 / 77000;
  if (coins >= 69000) return 300 / 69000;
  if (coins >= 56000) return 215 / 56000;
  if (coins >= 42000) return 150 / 42000;
  if (coins >= 34000) return 115 / 34000;
  if (coins >= 23000) return 85 / 23000;
  if (coins >= 18000) return 50 / 18000;
  if (coins >= 12000) return 30 / 12000;
  if (coins >= 7000) return 10 / 7000;
  if (coins >= 2000) return 5 / 2000;
  if (coins >= 0) return 0;
  return 0;
}

/**
 * Get coins per USD for a given cashout amount
 */
export function getCoinsPerUsd(coinAmount: number): number {
  const rate = getRateForCoins(coinAmount);
  return rate > 0 ? 1 / rate : 200;
}

/**
 * Calculate USD value for a given coin amount based on tiers
 */
export function calculateCashoutUsd(coinAmount: number): number {
  const tier = CASHOUT_TIERS.find(t => t.coins === coinAmount);
  return tier?.usd ?? 0;
}

/**
 * Get all available coin packages
 */
export function getCoinPackages(): CoinPackage[] {
  return COIN_PACKAGES;
}

/**
 * Validate coin amount against available tiers
 */
export function isValidCashoutAmount(coinAmount: number): boolean {
  return CASHOUT_TIERS.some(t => t.coins === coinAmount);
}

/**
 * Check if user is admin or secretary
 */
export function isAdminOrSecretary(userId: string): boolean {
  return false;
}
