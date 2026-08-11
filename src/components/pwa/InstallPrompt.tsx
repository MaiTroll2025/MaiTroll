import React, { useState, useEffect } from 'react';
import { usePWA } from '../../contexts/PWAContext';
import { motion, AnimatePresence } from 'framer-motion';

// ===== OFFLINE BANNER =====

export function OfflineBanner() {
  const { networkState, wasOffline } = usePWA();
  const [showOffline, setShowOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  
  useEffect(() => {
    if (!networkState.isOnline) {
      setShowOffline(true);
      setShowBackOnline(false);
    } else if (wasOffline && networkState.isOnline) {
      setShowOffline(false);
      setShowBackOnline(true);
      
      // Hide "back online" after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [networkState.isOnline, wasOffline]);
  
  return (
    <>
      <AnimatePresence>
        {showOffline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-100"></span>
              </span>
              <span className="text-sm font-medium">
                You are offline. Some features may be limited.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showBackOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-2"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center">
              <span className="text-sm font-medium">
                Back online! Syncing your data...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ===== UPDATE AVAILABLE BANNER =====

export function UpdateBanner() {
  const { swState, updateApp } = usePWA();
  
  if (!swState.isUpdateAvailable) return null;
  
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 left-4 right-4 z-50 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl shadow-xl p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Update Available</p>
          <p className="text-sm text-purple-100">A new version of Mai Troll is ready</p>
        </div>
        <button
          onClick={updateApp}
          className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-500 transition-colors"
        >
          Update Now
        </button>
      </div>
    </motion.div>
  );
}

// ===== CONNECTION STATUS INDICATOR =====

export function ConnectionStatus() {
  const { connectionHealth } = usePWA();
  
  const statusConfig = {
    healthy: { color: 'bg-green-500', label: 'Connected' },
    degraded: { color: 'bg-yellow-500', label: 'Slow Connection' },
    disconnected: { color: 'bg-red-500', label: 'Reconnecting...' }
  };
  
  const config = statusConfig[connectionHealth];
  
  if (connectionHealth === 'healthy') return null;
  
  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-black/50 rounded-full">
      <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
      <span className="text-xs text-gray-400">{config.label}</span>
    </div>
  );
}

export function InstallPrompt() {
  return null;
}

export default InstallPrompt;
