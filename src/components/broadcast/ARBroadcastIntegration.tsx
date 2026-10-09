// AR Broadcast Integration Component
// Combines AR gift overlay, tracking engine, and AR gift rendering
// Used by both streamer and viewer broadcast pages

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ARGiftOverlay from './ARGiftOverlay';
import type { ARGiftInstance } from '../../types/arGifts';
import { useARGiftStore } from '../../stores/arGiftStore';

interface ARBroadcastIntegrationProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamId: string;
  broadcasterId: string;
  isStreamerView: boolean;
  children?: React.ReactNode;
}

export default function ARBroadcastIntegration({
  videoRef,
  streamId,
  broadcasterId,
  isStreamerView,
  children,
}: ARBroadcastIntegrationProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [notification, setNotification] = useState<{
    id: string;
    giftName: string;
    giftIcon: string;
    senderName: string;
    amount: number;
  } | null>(null);
  const { activeGifts, settings } = useARGiftStore();
  const notificationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
    }
  }, [videoRef]);

  const handleGiftExpired = useCallback((_instanceId: string) => {
    // Gift expired naturally
  }, []);

  const _showNotification = useCallback(
    (gift: ARGiftInstance) => {
      if (notificationTimerRef.current) {
        window.clearTimeout(notificationTimerRef.current);
      }

      setNotification({
        id: gift.id,
        giftName: gift.gift.name,
        giftIcon: gift.gift.icon,
        senderName: gift.senderName,
        amount: gift.gift.price,
      });

      notificationTimerRef.current = window.setTimeout(() => {
        setNotification(null);
      }, 5000);
    },
    []
  );

  return (
    <div className="relative w-full h-full">
      {children}

      {videoElement && settings.isOverlayVisible && (
        <ARGiftOverlay
          videoElement={videoElement}
          streamId={streamId}
          broadcasterId={broadcasterId}
          isStreamerView={isStreamerView}
          onGiftExpired={handleGiftExpired}
          className="absolute inset-0 z-[70]"
        />
      )}

      {/* AR Gift Toast Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
          >
            <div className="bg-gradient-to-r from-fuchsia-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-xl rounded-2xl px-6 py-3 shadow-[0_0_40px_rgba(168,85,247,0.4)] border border-fuchsia-500/30">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{notification.giftIcon}</span>
                <div>
                  <div className="text-white font-bold text-sm">
                    {notification.senderName} sent AR {notification.giftName}!
                  </div>
                  <div className="text-fuchsia-300 text-xs">
                    {notification.amount.toLocaleString()} coins • {settings.faceGiftsEnabled ? 'Tracking Active' : 'AR Disabled'}
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="text-2xl"
                >
                  ✨
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active AR Gift Counter */}
      {activeGifts.length > 0 && isStreamerView && (
        <div className="absolute bottom-4 left-4 z-[100] pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 border border-fuchsia-500/20">
            <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
            <span className="text-xs font-medium text-fuchsia-300">
              {activeGifts.length} AR {activeGifts.length === 1 ? 'Gift' : 'Gifts'} Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
