import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';
import { openNotificationDestination } from '../lib/notificationDestination';

let nativeListenerRegistered = false;

export default function GlobalNotificationHandler() {
  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.6;
    audio.play().catch((error) => {
      console.warn('[GlobalNotification] Could not play notification sound:', error);
    });
  }, []);

  const showInAppNotification = useCallback((title: string, body: string, data?: any) => {
    playNotificationSound();
    
    toast.custom((t) => (
      <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 min-w-[300px] max-w-md">
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">{body}</p>
          {data?.route && (
            <button
              onClick={() => void openNotificationDestination(data.route)}
              className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              Open
            </button>
          )}
        </div>
        <button
          onClick={() => toast.dismiss(t)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ), {
      duration: 8000,
      closeButton: false,
      style: {
        background: 'transparent',
        boxShadow: 'none',
        padding: 0,
      },
    });
  }, [playNotificationSound]);

  const handleNativePush = useCallback(async (notification: PushNotificationSchema) => {
    console.log('[GlobalNotification] Native push received:', notification);
    
    const title = notification.title || 'Mai Troll';
    const body = notification.body || 'New notification';
    const data = notification.data || {};
    
    showInAppNotification(title, body, data);
    
    // If app was in background and user taps notification, handle navigation
    if (data.route && document.visibilityState === 'visible') {
      // App is foreground, don't auto-navigate but show toast with action
    }
  }, [showInAppNotification]);

  const handleWebPush = useCallback((event: CustomEvent) => {
    const payload = event.detail;
    console.log('[GlobalNotification] Web push received:', payload);
    
    const title = payload.title || 'Mai Troll';
    const body = payload.body || 'New notification';
    const data = { route: payload.url || '/' };
    
    showInAppNotification(title, body, data);
  }, [showInAppNotification]);

  const handleNotificationAction = useCallback((event: CustomEvent) => {
    const payload = event.detail;
    console.log('[GlobalNotification] Notification action:', payload);
    
    void openNotificationDestination(payload.route || payload.url)
  }, []);

  useEffect(() => {
    // Register native push listener for foreground notifications
    const registerNativeListener = async () => {
      if (nativeListenerRegistered) return;
      
      const platform = Capacitor.getPlatform();
      if (platform === 'android' || platform === 'ios') {
        try {
          await PushNotifications.addListener('pushNotificationReceived', handleNativePush);
          nativeListenerRegistered = true;
          console.log('[GlobalNotification] Native push listener registered');
        } catch (e) {
          console.error('[GlobalNotification] Failed to register native listener:', e);
        }
      }
    };

    registerNativeListener();

    // Listen for web push notifications
    const webPushHandler = (e: CustomEvent) => handleWebPush(e);
    const notificationActionHandler = (e: CustomEvent) => handleNotificationAction(e);

    window.addEventListener('pwa-push-received', webPushHandler as EventListener);
    window.addEventListener('pwa-notification-action', notificationActionHandler as EventListener);

    return () => {
      window.removeEventListener('pwa-push-received', webPushHandler as EventListener);
      window.removeEventListener('pwa-notification-action', notificationActionHandler as EventListener);
    };
  }, [handleNativePush, handleWebPush, handleNotificationAction]);

  // Also register native push on app startup if user is logged in
  useEffect(() => {
    const initPush = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const platform = Capacitor.getPlatform();
          if (platform === 'android' || platform === 'ios') {
            // Check permission and register
            const perm = await PushNotifications.checkPermissions();
            if (perm.receive === 'granted') {
              await PushNotifications.register();
            }
          }
        } catch (e) {
          console.error('[GlobalNotification] Push init failed:', e);
        }
      }
    };
    initPush();
  }, []);

  return null; // This component doesn't render anything
}