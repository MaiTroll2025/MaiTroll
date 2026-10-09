// AR Gift Store - Zustand store for managing AR gift state

import { create } from 'zustand';
import type { ARGiftInstance, ARSettings } from '../types/arGifts';
import { DEFAULT_AR_SETTINGS } from '../types/arGifts';

export interface ARGiftState {
  // Settings
  settings: ARSettings;
  updateSettings: (settings: Partial<ARSettings>) => void;

  // Active AR gifts currently being rendered
  activeGifts: ARGiftInstance[];
  addActiveGift: (gift: ARGiftInstance) => void;
  removeActiveGift: (instanceId: string) => void;
  clearAllGifts: () => void;

  // AR gift history (for gift tray display)
  giftHistory: ARGiftHistoryEntry[];
  addGiftHistory: (entry: ARGiftHistoryEntry) => void;
  clearHistory: () => void;

  // Tracking state
  isTracking: boolean;
  setIsTracking: (tracking: boolean) => void;

  // AR overlay visibility
  isOverlayVisible: boolean;
  setOverlayVisible: (visible: boolean) => void;

  // Performance metrics
  fps: number;
  setFps: (fps: number) => void;
  processingTime: number;
  setProcessingTime: (time: number) => void;

  // Stacking: count active gifts per tracking point
  getStackCount: (trackingPoint: string) => number;
}

export interface ARGiftHistoryEntry {
  id: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  amount: number;
  timestamp: number;
  category: string;
}

export const useARGiftStore = create<ARGiftState>((set, get) => ({
  settings: { ...DEFAULT_AR_SETTINGS },
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  activeGifts: [],
  addActiveGift: (gift) =>
    set((state) => ({
      activeGifts: [...state.activeGifts, gift],
    })),
  removeActiveGift: (instanceId) =>
    set((state) => ({
      activeGifts: state.activeGifts.filter((g) => g.id !== instanceId),
    })),
  clearAllGifts: () => set({ activeGifts: [] }),

  giftHistory: [],
  addGiftHistory: (entry) =>
    set((state) => ({
      giftHistory: [entry, ...state.giftHistory].slice(0, 100),
    })),
  clearHistory: () => set({ giftHistory: [] }),

  isTracking: false,
  setIsTracking: (tracking) => set({ isTracking: tracking }),

  isOverlayVisible: true,
  setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),

  fps: 0,
  setFps: (fps) => set({ fps }),
  processingTime: 0,
  setProcessingTime: (time) => set({ processingTime: time }),

  getStackCount: (trackingPoint: string) => {
    const state = get();
    return state.activeGifts.filter(
      (g) => g.trackingPoint === trackingPoint && g.isActive
    ).length;
  },
}));
