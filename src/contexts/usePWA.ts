import { useContext } from 'react';
import { PWAContext, type PWAContextType } from './PWAContextValue';

export function usePWA(): PWAContextType {
  const context = useContext(PWAContext);
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn('usePWA called outside PWAProvider; using no-op fallback');
    }
    return ({
      isInstalled: false,
      canInstall: false,
      installPrompt: null,
      networkState: { isOnline: typeof navigator === 'undefined' ? true : navigator.onLine, effectiveType: undefined, downlink: undefined, rtt: undefined },
      wasOffline: false,
      offlineTimestamp: null,
      cacheState: { isSupported: false, isEnabled: false, usage: 0, quota: 0, items: [] },
      swState: { isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator, isRegistered: false, isInstalling: false, isWaiting: false, isActive: false, hasUpdate: false },
      pushPermission: typeof Notification === 'undefined' ? 'default' : Notification.permission,
      pushSubscription: null,
      connectionHealth: 'good',
      lastRealtimeActivity: null,
      promptInstall: async () => false,
      dismissInstallPrompt: () => {},
      checkForUpdates: async () => {},
      updateApp: async () => {},
      requestPushPermission: async () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
      subscribeToPush: async () => null,
      unsubscribeFromPush: async () => {},
      clearAllCaches: async () => {},
      cacheStream: async () => {},
      cacheProfile: async () => {},
      cacheChat: async () => {},
      prefetchStream: async () => {},
      prefetchUpcomingStreams: async () => {},
      triggerReconnect: () => {},
    } as unknown) as PWAContextType;
  }
  return context;
}

export function useInstallState() {
  const { canInstall, isInstalled, promptInstall, dismissInstallPrompt } = usePWA();
  return { canInstall, isInstalled, promptInstall, dismissInstallPrompt };
}

export function useNetworkStatus() {
  const { networkState, wasOffline, offlineTimestamp } = usePWA();
  return { ...networkState, wasOffline, offlineTimestamp };
}

export function useSWStatus() {
  const { swState, updateApp, checkForUpdates } = usePWA();
  return { swState, updateApp, checkForUpdates };
}

export function usePushNotifications() {
  const { pushPermission, requestPushPermission, subscribeToPush, unsubscribeFromPush } = usePWA();
  return { pushPermission, requestPushPermission, subscribeToPush, unsubscribeFromPush };
}

export function usePWACache() {
  const { cacheState, cacheStream, cacheProfile, cacheChat, clearAllCaches } = usePWA();
  return { cacheState, cacheStream, cacheProfile, cacheChat, clearAllCaches };
}

export function useConnectionHealth() {
  const { connectionHealth, lastRealtimeActivity, triggerReconnect } = usePWA();
  return { connectionHealth, lastRealtimeActivity, triggerReconnect };
}
