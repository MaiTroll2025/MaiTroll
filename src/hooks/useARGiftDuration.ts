// AR Gift Duration Manager
// Manages the lifecycle of active AR gifts with 15-second duration per send
// Handles stacking, expiration, and cleanup

import { useEffect, useRef, useCallback } from 'react';
import { useARGiftStore } from '@/stores/arGiftStore';
import type { ARGiftInstance } from '@/types/arGifts';

interface ARGiftDurationManagerOptions {
  streamId: string;
  onGiftExpired?: (instance: ARGiftInstance) => void;
  onGiftStackChange?: (activeCount: number) => void;
}

export function useARGiftDurationManager({
  streamId,
  onGiftExpired,
  onGiftStackChange,
}: ARGiftDurationManagerOptions) {
  const { activeGifts, removeActiveGift, settings } = useARGiftStore();
  const timersRef = useRef<Map<string, number>>(new Map());
  const lastCountRef = useRef(0);

  const expireGift = useCallback(
    (instanceId: string) => {
      const gift = activeGifts.find((g) => g.id === instanceId);
      if (gift) {
        onGiftExpired?.(gift);
      }
      removeActiveGift(instanceId);
      timersRef.current.delete(instanceId);
    },
    [activeGifts, removeActiveGift, onGiftExpired]
  );

  useEffect(() => {
    const currentIds = new Set(activeGifts.map((g) => g.id));

    timersRef.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        window.clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });

    activeGifts.forEach((gift) => {
      if (timersRef.current.has(gift.id)) return;

      const elapsed = performance.now() - gift.startTime;
      const remaining = gift.duration - elapsed;

      if (remaining <= 0) {
        expireGift(gift.id);
        return;
      }

      const timer = window.setTimeout(() => {
        expireGift(gift.id);
      }, remaining);

      timersRef.current.set(gift.id, timer);
    });

    if (activeGifts.length !== lastCountRef.current) {
      lastCountRef.current = activeGifts.length;
      onGiftStackChange?.(activeGifts.length);
    }

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [activeGifts, expireGift, onGiftStackChange]);

  const getActiveGiftsForTrackingPoint = useCallback(
    (trackingPoint: string) => {
      return activeGifts.filter(
        (g) => g.trackingPoint === trackingPoint && g.isActive
      );
    },
    [activeGifts]
  );

  const getStackOffset = useCallback(
    (trackingPoint: string, giftId: string) => {
      const giftsAtPoint = getActiveGiftsForTrackingPoint(trackingPoint);
      const index = giftsAtPoint.findIndex((g) => g.id === giftId);
      return index >= 0 ? index : giftsAtPoint.length;
    },
    [getActiveGiftsForTrackingPoint]
  );

  const isGiftTypeActive = useCallback(
    (giftId: string) => {
      return activeGifts.some((g) => g.giftId === giftId && g.isActive);
    },
    [activeGifts]
  );

  const getRemainingTime = useCallback(
    (giftId: string) => {
      const gift = activeGifts.find((g) => g.id === giftId);
      if (!gift) return 0;
      const elapsed = performance.now() - gift.startTime;
      return Math.max(0, gift.duration - elapsed);
    },
    [activeGifts]
  );

  return {
    activeGifts,
    activeCount: activeGifts.length,
    getActiveGiftsForTrackingPoint,
    getStackOffset,
    isGiftTypeActive,
    getRemainingTime,
    expireGift,
  };
}

// Hook for managing AR gift settings per-streamer
export function useARGiftSettings(userId: string) {
  const { settings, updateSettings } = useARGiftStore();

  const canReceiveGift = useCallback(
    (category: string) => {
      switch (category) {
        case 'face':
        case 'hat':
        case 'mask':
        case 'glasses':
          return settings.faceGiftsEnabled;
        case 'body':
        case 'shoulder_pet':
          return settings.bodyGiftsEnabled;
        case 'presidential':
        case 'troll_city':
          return settings.legendaryGiftsEnabled;
        case 'legendary':
          return settings.legendaryGiftsEnabled;
        default:
          return true;
      }
    },
    [settings]
  );

  return {
    settings,
    updateSettings,
    canReceiveGift,
  };
}
