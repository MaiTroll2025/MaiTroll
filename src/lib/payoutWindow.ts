/**
 * Payout window is now determined by user level in the backend RPC.
 * This file is kept for backward compatibility but the actual gating
 * happens in request_cashout based on user_stats.level.
 */

export const PAYOUT_WINDOW_LABEL =
  'Payout availability depends on your level.';

/**
 * @deprecated Use backend RPC request_cashout which checks user level
 * This is a frontend-only hint and should not be used for gating.
 */
export function isPayoutWindowOpen(date: Date = new Date()): boolean {
  return true;
}
