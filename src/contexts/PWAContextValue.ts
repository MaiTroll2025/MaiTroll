import { createContext } from 'react';

export interface ServiceWorkerState {
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  isOfflineReady: boolean;
  version: string | null;
  waitingWorker: ServiceWorker | null;
}

export interface NetworkState {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: string | null;
}

export interface CacheState {
  cachedStreams: string[];
  cachedProfiles: string[];
  cachedChats: string[];
}

export interface PWAContextType {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isSafari: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
  dismissInstallPrompt: () => void;
  showIOSInstallInstructions: boolean;
  dismissIOSInstructions: () => void;
  swState: ServiceWorkerState;
  updateApp: () => void;
  checkForUpdates: () => Promise<void>;
  networkState: NetworkState;
  cacheState: CacheState;
  syncWhenOnline: (queueName: string, data: unknown) => void;
  pendingSyncItems: Record<string, number>;
  pushPermission: NotificationPermission;
  requestPushPermission: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  wasOffline: boolean;
  offlineTimestamp: number | null;
  clearAllCaches: () => Promise<void>;
  cacheStream: (streamId: string, data: unknown) => void;
  cacheProfile: (userId: string, data: unknown) => void;
  cacheChat: (roomId: string, messages: unknown[]) => void;
  prefetchStream: (streamId: string) => void;
  prefetchUpcomingStreams: () => void;
  connectionHealth: 'healthy' | 'degraded' | 'disconnected';
  lastRealtimeActivity: number;
  triggerReconnect: () => void;
}

export const PWAContext = createContext<PWAContextType | null>(null);
