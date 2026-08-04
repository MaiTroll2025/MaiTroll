export interface WalletLike {
  troll_coins?: number | null;
  coins?: number | null;
}

export function getWalletBalance(profile?: WalletLike | null): number {
  const value = Number(profile?.troll_coins ?? profile?.coins ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function canAffordGift(profile: WalletLike | null | undefined, cost: number): boolean {
  return getWalletBalance(profile) >= Math.max(0, Number(cost) || 0);
}
