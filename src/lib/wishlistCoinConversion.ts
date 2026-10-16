// src/lib/wishlistCoinConversion.ts
// USD-to-Troll-Coin conversion for the Mai Troll wishlist system.
//
// Base conversion rate:
//   3,500 coins = $10  =>  350 coins = $1
//
// A 5% wishlist contribution fee is added on top of the base coin amount.
//
//   Base Coins = USD Item Price × 350
//   Total Coins Required = Base Coins × 1.05
//
// The final coin requirement is rounded up to the next whole coin.

export const WISHLIST_COINS_PER_USD = 350
export const WISHLIST_CONTRIBUTION_FEE_RATE = 0.05

export interface CoinBreakdown {
  usdPrice: number
  baseCoins: number
  feeCoins: number
  totalCoins: number
  feeRate: number
}

/**
 * Calculates the number of Troll Coins required for a wishlist item,
 * including the 5% contribution fee.
 *
 * @param usdPrice - The USD price of the wishlist item.
 * @returns A breakdown with base coins, fee coins, and total coins.
 */
export function calculateWishlistCoins(usdPrice: number): CoinBreakdown {
  const price = Math.max(0, Number(usdPrice) || 0)
  const baseCoins = Math.round(price * WISHLIST_COINS_PER_USD)
  const feeCoins = Math.ceil(baseCoins * WISHLIST_CONTRIBUTION_FEE_RATE)
  const totalCoins = baseCoins + feeCoins

  return {
    usdPrice: price,
    baseCoins,
    feeCoins,
    totalCoins,
    feeRate: WISHLIST_CONTRIBUTION_FEE_RATE,
  }
}

/**
 * Returns the human-readable coin amount with thousands separators.
 */
export function formatCoinsForWishlist(coins: number): string {
  return Math.max(0, Number(coins) || 0).toLocaleString()
}

/**
 * Returns the contribution fee as a percentage string (e.g. "5%").
 */
export function getWishlistFeePercent(): string {
  return `${(WISHLIST_CONTRIBUTION_FEE_RATE * 100).toFixed(0)}%`
}