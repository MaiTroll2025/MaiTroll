import { getWalletBalance, canAffordGift } from './balance';

describe('gift wallet balance helpers', () => {
  it('uses troll_coins for the live wallet balance', () => {
    expect(getWalletBalance({ troll_coins: 1000000000 })).toBe(1000000000);
    expect(getWalletBalance({ coins: 10, troll_coins: 250000000 })).toBe(250000000);
  });

  it('supports large gift costs without undercounting', () => {
    expect(canAffordGift({ troll_coins: 1000000000 }, 1000000000)).toBe(true);
    expect(canAffordGift({ troll_coins: 999999999 }, 1000000000)).toBe(false);
  });
});
