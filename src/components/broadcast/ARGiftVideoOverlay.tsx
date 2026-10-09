// AR-Aware Gift Video Overlay
// Handles both traditional video gifts and AR face/body tracking gifts
// Extends GiftVideoOverlay to be AR-aware

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Glasses } from 'lucide-react';
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime';
import { getARGiftById } from '../../data/arGiftCatalog';
import { useARGiftStore } from '../../stores/arGiftStore';
import type { ARGiftHistoryEntry } from '../../stores/arGiftStore';

interface ARGiftVideoOverlayProps {
  gifts: BroadcastGift[];
  onFinish: (giftId: string) => void;
  nameMap?: Record<string, string>;
  videoElement?: HTMLVideoElement | null;
  streamId?: string;
  broadcasterId?: string;
  isStreamerView?: boolean;
}

function isARGift(gift: BroadcastGift): boolean {
  const slug = String((gift as any).slug || gift.gift_slug || '').trim();
  const animType = String((gift as any).animation_type || gift.gift_slug || '').trim();
  return (
    slug.startsWith('ar_') ||
    animType.startsWith('ar_') ||
    ['ar_face', 'ar_body', 'ar_presidential', 'ar_troll', 'ar_shoulder', 'ar_legendary', 'ar_gift'].includes(animType)
  );
}

function getARGiftEffect(gift: BroadcastGift) {
  const slug = String((gift as any).slug || gift.gift_slug || '').trim();
  return getARGiftById(slug);
}

export default function ARGiftVideoOverlay({
  gifts,
  onFinish,
  nameMap = {},
  videoElement: _videoElement,
  streamId: _streamId = '',
  broadcasterId: _broadcasterId = '',
  isStreamerView: _isStreamerView = false,
}: ARGiftVideoOverlayProps) {
  const { addGiftHistory, addActiveGift } = useARGiftStore();
  const processedARgiftsRef = useRef<Set<string>>(new Set());

  const handleARGift = useCallback(
    (gift: BroadcastGift) => {
      const giftId = gift.id;
      if (processedARgiftsRef.current.has(giftId)) return;
      processedARgiftsRef.current.add(giftId);

      const arGift = getARGiftEffect(gift);
      if (!arGift) return;

      const senderName =
        nameMap[gift.sender_id] || gift.sender_name || 'Someone';

      const historyEntry: ARGiftHistoryEntry = {
        id: giftId,
        giftId: arGift.id,
        giftName: arGift.name,
        giftIcon: arGift.icon,
        senderId: gift.sender_id,
        senderName,
        receiverId: gift.receiver_id,
        amount: gift.amount || arGift.price,
        timestamp: Date.now(),
        category: arGift.category,
      };

      addGiftHistory(historyEntry);

      addActiveGift({
        id: giftId,
        giftId: arGift.id,
        gift: arGift,
        senderId: gift.sender_id,
        senderName,
        receiverId: gift.receiver_id,
        trackingPoint: arGift.trackingPoint,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
        startTime: performance.now(),
        duration: arGift.durationMs,
        isActive: true,
        stackIndex: 0,
      });

      setTimeout(() => {
        onFinish(giftId);
        processedARgiftsRef.current.delete(giftId);
      }, arGift.durationMs);
    },
    [addGiftHistory, addActiveGift, nameMap, onFinish]
  );

  useEffect(() => {
    gifts.forEach((gift) => {
      if (isARGift(gift) && gift.id) {
        handleARGift(gift);
      }
    });
  }, [gifts, handleARGift]);

  const traditionalGifts = useMemo(
    () => gifts.filter((g) => !isARGift(g)),
    [gifts]
  );

  const arGifts = useMemo(
    () => gifts.filter((g) => isARGift(g)),
    [gifts]
  );

  return (
    <>
      {/* Traditional Gift Video Overlay */}
      <TraditionalGiftOverlay
        gifts={traditionalGifts}
        onFinish={onFinish}
        nameMap={nameMap}
      />

      {/* AR Gift Indicator Overlay */}
      <AnimatePresence mode="popLayout">
        {arGifts.slice(0, 3).map((gift) => {
          const arGift = getARGiftEffect(gift);
          const senderName =
            nameMap[gift.sender_id] || gift.sender_name || 'Someone';

          return (
            <motion.div
              key={`ar-indicator-${gift.id}`}
              initial={{ opacity: 0, scale: 0.8, y: -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -30 }}
              transition={{ duration: 0.4 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-[85] pointer-events-none"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-500/30 via-purple-500/30 to-cyan-500/30 rounded-2xl blur-lg animate-pulse" />
                <div className="relative bg-gradient-to-r from-fuchsia-950/95 via-purple-950/95 to-indigo-950/95 backdrop-blur-xl rounded-2xl px-6 py-3 border border-fuchsia-500/30 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30">
                      <Glasses className="text-fuchsia-300" size={20} />
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="text-2xl">{arGift?.icon || '✨'}</span>
                        <span className="text-white font-bold text-sm">
                          AR {arGift?.name || 'Gift'}
                        </span>
                      </div>
                      <div className="text-xs text-fuchsia-300">
                        {senderName} • {(gift.amount || arGift?.price || 0).toLocaleString()} coins
                      </div>
                    </div>
                    {arGift?.isFullscreen && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="text-xl"
                      >
                        ⭐
                      </motion.div>
                    )}
                  </div>

                  {arGift && (
                    <div className="mt-2 text-center">
                      <span className="text-[10px] text-fuchsia-400/80 uppercase tracking-wider">
                        Tracking: {arGift.trackingPoint.replace('_', ' ')} • {arGift.durationMs / 1000}s
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* AR Gift Counter */}
      {arGifts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[85] pointer-events-none">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-fuchsia-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-fuchsia-500/30"
          >
            <div className="flex items-center gap-1.5">
              <Glasses size={12} className="text-fuchsia-300" />
              <span className="text-xs font-bold text-fuchsia-300">
                {arGifts.length} AR Active
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

interface TraditionalGiftOverlayProps {
  gifts: BroadcastGift[];
  onFinish: (giftId: string) => void;
  nameMap?: Record<string, string>;
}

function TraditionalGiftOverlay({
  gifts,
  onFinish,
  nameMap = {},
}: TraditionalGiftOverlayProps) {
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const activeGiftIds = new Set(gifts.map((g) => g.id));

    Object.keys(timersRef.current).forEach((giftId) => {
      if (!activeGiftIds.has(giftId)) {
        window.clearTimeout(timersRef.current[giftId]);
        delete timersRef.current[giftId];
      }
    });

    gifts.forEach((gift) => {
      if (!gift?.id || timersRef.current[gift.id]) return;
      const durationMs = gift.animation_duration_ms ?? 15000;
      timersRef.current[gift.id] = window.setTimeout(() => {
        onFinish(gift.id);
        delete timersRef.current[gift.id];
      }, Math.max(durationMs + 150, 15000));
    });

    return () => {
      Object.values(timersRef.current).forEach((timerId) =>
        window.clearTimeout(timerId)
      );
      timersRef.current = {};
    };
  }, [gifts, onFinish]);

  if (!gifts.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[80] flex items-center justify-center px-4 py-6">
      <AnimatePresence mode="popLayout">
        {gifts.slice(-3).map((gift) => {
          const senderName =
            nameMap[gift.sender_id] || gift.sender_name || 'Someone';
          const displayCount =
            gift.quantity && gift.quantity > 1 ? `×${gift.quantity}` : '';

          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_0_40px_rgba(15,23,42,0.55)] backdrop-blur-xl"
            >
              <div className="relative aspect-video bg-slate-950 flex flex-col items-center justify-center">
                <div className="text-5xl mb-4">
                  {gift.gift_icon || '🎁'}
                </div>
                <div className="text-lg font-bold text-white">
                  {gift.gift_name || gift.gift_slug || 'Gift'}
                </div>

                <div className="absolute bottom-0 inset-x-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <Gift className="h-4 w-4 text-pink-300" />
                    <span>{gift.gift_name || gift.gift_slug || 'Gift'}</span>
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    {senderName && senderName !== 'Someone' && (
                      <span>{senderName}</span>
                    )}
                    {gift.amount != null && gift.amount > 0 && (
                      <span className="text-cyan-300">
                        🪙 {gift.amount.toLocaleString()}
                      </span>
                    )}
                    {displayCount && (
                      <span className="text-cyan-200">{displayCount}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
