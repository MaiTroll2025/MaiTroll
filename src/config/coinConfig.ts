/**
 * CENTRAL COIN CONFIGURATION
 * 
 * This is the single source of truth for all coin pack and cashout tier values.
 * 
 * Last Updated: 2026-08-23
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
  { coins: 2000, usd: 10, manualReview: false, name: 'Tier 1', color: '#cd7f32', label: '' },
  { coins: 4000, usd: 20, manualReview: false, name: 'Tier 2', color: '#c0c0c0', label: '' },
  { coins: 10000, usd: 50, manualReview: false, name: 'Tier 3', color: '#ffd700', label: '' },
  { coins: 20000, usd: 100, manualReview: false, name: 'Tier 4', color: '#ff4dd2', label: '' },
  { coins: 30000, usd: 150, manualReview: false, name: 'Tier 5', color: '#00ff00', label: '' },
  { coins: 50000, usd: 250, manualReview: false, name: 'Tier 6', color: '#ff0000', label: '' },
  { coins: 100000, usd: 500, manualReview: false, name: 'Tier 7', color: '#ff0000', label: '' },
  { coins: 200000, usd: 1000, manualReview: false, name: 'Tier 8', color: '#ff0000', label: '' },
  { coins: 500000, usd: 2500, manualReview: false, name: 'Tier 9', color: '#ff0000', label: '' },
  { coins: 1000000, usd: 5000, manualReview: false, name: 'Tier 10', color: '#ff0000', label: '' },
] as const;

// Alias exports for backward compatibility with old payoutTiers imports
export const TIERS = CASHOUT_TIERS;

// Type for individual cashout tier
export type CashoutTier = typeof CASHOUT_TIERS[number];

// Minimum coins required for any cashout
export const MIN_CASHOUT_COINS = 2000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get cashout rate (USD per coin) for a given coin amount
 */
export function getRateForCoins(coins: number): number {
  if (coins >= 2000) return 0.005;
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
