// AR Gift Overlay Component
// Renders 3D AR gifts attached to face/body tracking points on the broadcast video
// This appears in the broadcast viewer for both streamers and viewers

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useARGiftStore } from '../../stores/arGiftStore';
import { ARGiftRenderer } from '../../lib/ar/argiftRenderer';
import { TrackingEngine } from '../../lib/ar/trackingEngine';
import type { TrackingData } from '../../types/arGifts';
import type { ARGiftHistoryEntry } from '../../stores/arGiftStore';
import { Settings, Eye, EyeOff, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ARGiftOverlayProps {
  videoElement: HTMLVideoElement | null;
  streamId: string;
  broadcasterId: string;
  isStreamerView?: boolean;
  onGiftExpired?: (instanceId: string) => void;
  className?: string;
}

export default function ARGiftOverlay({
  videoElement,
  streamId: _streamId,
  broadcasterId: _broadcasterId,
  isStreamerView = false,
  onGiftExpired,
  className,
}: ARGiftOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ARGiftRenderer | null>(null);
  const trackingEngineRef = useRef<TrackingEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [trackingReady, setTrackingReady] = useState(false);

  const {
    settings,
    updateSettings,
    activeGifts,
    addActiveGift: _addActiveGift,
    removeActiveGift,
    isOverlayVisible,
    setOverlayVisible,
    fps,
    setFps,
    processingTime,
    setProcessingTime,
    giftHistory,
  } = useARGiftStore();

  const handleTrackingData = useCallback(
    (data: TrackingData) => {
      setFps(data.fps);
      setProcessingTime(data.processingTime);
      if (rendererRef.current) {
        rendererRef.current.updateTracking(data.face, data.body);
      }
    },
    []
  );

  const handleGiftExpired = useCallback(
    (instanceId: string) => {
      removeActiveGift(instanceId);
      onGiftExpired?.(instanceId);
    },
    [removeActiveGift, onGiftExpired]
  );

  useEffect(() => {
    if (!videoElement || !canvasRef.current) return;

    const init = async () => {
      const videoWidth = videoElement.videoWidth || 1280;
      const videoHeight = videoElement.videoHeight || 720;

      rendererRef.current = new ARGiftRenderer(
        canvasRef.current!,
        videoWidth,
        videoHeight,
        settings.maxActiveGifts,
        handleGiftExpired
      );
      rendererRef.current.start();

      if (isStreamerView) {
        trackingEngineRef.current = new TrackingEngine({
          videoElement,
          settings,
          onTrackingData: handleTrackingData,
        });

        const success = await trackingEngineRef.current.initialize();
        if (success) {
          trackingEngineRef.current.start();
          setTrackingReady(true);
        }
      }
    };

    if (videoElement.readyState >= 2) {
      init();
    } else {
      videoElement.addEventListener('loadeddata', init, { once: true });
    }

    return () => {
      videoElement.removeEventListener('loadeddata', init);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (trackingEngineRef.current) {
        trackingEngineRef.current.destroy();
        trackingEngineRef.current = null;
      }
    };
  }, [videoElement, isStreamerView]);

  useEffect(() => {
    if (!rendererRef.current || !videoElement) return;

    const handleResize = () => {
      const videoWidth = videoElement.videoWidth || 1280;
      const videoHeight = videoElement.videoHeight || 720;
      rendererRef.current?.resize(videoWidth, videoHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [videoElement]);

  useEffect(() => {
    if (trackingEngineRef.current) {
      trackingEngineRef.current.updateSettings(settings);
    }
  }, [settings]);

  if (!isOverlayVisible) return null;

  return (
    <div ref={containerRef} className={cn('absolute inset-0 pointer-events-none', className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: 'screen' }}
      />

      {isStreamerView && (
        <div className="absolute top-2 right-2 pointer-events-auto flex gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={cn(
              'p-1.5 rounded-lg backdrop-blur-sm transition-colors',
              showDebug ? 'bg-cyan-500/30 text-cyan-300' : 'bg-black/40 text-white/60 hover:text-white'
            )}
            title="Debug overlay"
          >
            <Cpu size={16} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 rounded-lg backdrop-blur-sm transition-colors',
              showSettings ? 'bg-violet-500/30 text-violet-300' : 'bg-black/40 text-white/60 hover:text-white'
            )}
            title="AR settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setOverlayVisible(!isOverlayVisible)}
            className="p-1.5 rounded-lg bg-black/40 text-white/60 hover:text-white backdrop-blur-sm transition-colors"
            title="Toggle AR overlay"
          >
            {isOverlayVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
      )}

      {showDebug && isStreamerView && (
        <div className="absolute top-12 right-2 pointer-events-auto bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs font-mono text-white/80 space-y-1 min-w-[180px]">
          <div className="text-cyan-400 font-bold mb-2">AR Debug</div>
          <div>FPS: <span className={fps >= 30 ? 'text-green-400' : fps >= 15 ? 'text-yellow-400' : 'text-red-400'}>{fps}</span></div>
          <div>Processing: <span className="text-cyan-300">{processingTime}ms</span></div>
          <div>Active Gifts: <span className="text-yellow-300">{activeGifts.length}</span></div>
          <div>Tracking: <span className={trackingReady ? 'text-green-400' : 'text-red-400'}>{trackingReady ? 'Ready' : 'Not Ready'}</span></div>
          <div>Quality: <span className="text-purple-300">{settings.quality}</span></div>
          <div>Smoothing: <span className="text-purple-300">{settings.smoothing}</span></div>
        </div>
      )}

      {showSettings && isStreamerView && (
        <div className="absolute top-12 right-2 pointer-events-auto bg-black/90 backdrop-blur-sm rounded-lg p-4 text-sm text-white space-y-3 min-w-[220px]">
          <div className="text-violet-400 font-bold mb-2">AR Gift Settings</div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.faceGiftsEnabled}
              onChange={(e) => updateSettings({ faceGiftsEnabled: e.target.checked })}
              className="rounded"
            />
            <span>Face Gifts</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.bodyGiftsEnabled}
              onChange={(e) => updateSettings({ bodyGiftsEnabled: e.target.checked })}
              className="rounded"
            />
            <span>Body Gifts</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.shoulderGiftsEnabled}
              onChange={(e) => updateSettings({ shoulderGiftsEnabled: e.target.checked })}
              className="rounded"
            />
            <span>Shoulder Gifts</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.legendaryGiftsEnabled}
              onChange={(e) => updateSettings({ legendaryGiftsEnabled: e.target.checked })}
              className="rounded"
            />
            <span>Legendary Gifts</span>
          </label>

          <div className="border-t border-white/10 pt-2">
            <label className="text-white/60 text-xs">Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => updateSettings({ quality: e.target.value as any })}
              className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 mt-1 text-white text-xs"
            >
              <option value="low">Low (160px)</option>
              <option value="medium">Medium (320px)</option>
              <option value="high">High (416px)</option>
              <option value="ultra">Ultra (640px)</option>
            </select>
          </div>

          <div>
            <label className="text-white/60 text-xs">Smoothing: {settings.smoothing.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              value={settings.smoothing}
              onChange={(e) => updateSettings({ smoothing: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs">Max Active: {settings.maxActiveGifts}</label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.maxActiveGifts}
              onChange={(e) => updateSettings({ maxActiveGifts: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      )}

      <ARGiftTicker events={giftHistory} />
    </div>
  );
}

interface ARGiftTickerProps {
  events: ARGiftHistoryEntry[];
}

function ARGiftTicker({ events }: ARGiftTickerProps) {
  const visibleEvents = events.slice(0, 5);

  if (visibleEvents.length === 0) return null;

  return (
    <div className="absolute bottom-20 left-2 right-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visibleEvents.slice(0, 3).map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 mb-1.5 max-w-xs"
          >
            <span className="text-lg">{event.giftIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white truncate">
                <span className="font-bold text-yellow-400">{event.senderName}</span>
                {' sent '}
                <span className="text-cyan-300">{event.giftName}</span>
              </div>
            </div>
            <div className="text-xs text-yellow-400 font-mono">
              {event.amount.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ARGiftNotification({
  entry,
  onDismiss,
}: {
  entry: ARGiftHistoryEntry;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.95 }}
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
    >
      <div className="bg-gradient-to-r from-purple-900/90 via-fuchsia-900/90 to-purple-900/90 backdrop-blur-xl rounded-2xl px-6 py-3 shadow-[0_0_40px_rgba(168,85,247,0.4)] border border-purple-500/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{entry.giftIcon}</span>
          <div>
            <div className="text-white font-bold text-sm">
              {entry.senderName} sent AR {entry.giftName}!
            </div>
            <div className="text-purple-300 text-xs">
              {entry.amount.toLocaleString()} coins
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
    </motion.div>,
    document.body
  );
}
