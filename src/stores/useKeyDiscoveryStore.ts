import { create } from 'zustand';

interface KeyDiscoveryState {
  isOpen: boolean;
  keyData: {
    key_letter: string;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE' | 'LEGENDARY';
    value: number;
    is_key_to_city: boolean;
    cashout_available_at: string;
  } | null;
  openDiscovery: (data: {
    key_letter: string;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'VERY_RARE' | 'LEGENDARY';
    value: number;
    is_key_to_city: boolean;
    cashout_available_at: string;
  }) => void;
  closeDiscovery: () => void;
}

export const useKeyDiscoveryStore = create<KeyDiscoveryState>((set) => ({
  isOpen: false,
  keyData: null,
  openDiscovery: (data) => set({ isOpen: true, keyData: data }),
  closeDiscovery: () => set({ isOpen: false, keyData: null }),
}));
