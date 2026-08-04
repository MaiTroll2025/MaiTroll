import React, { useEffect, useState } from 'react';
import { Bell, X, Download, Share2 } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { doesUserProfileExist, supabase } from '../lib/supabase';
import { isIos } from '../pwa/install';
import { useInstallPrompt } from '../pwa/useInstallPrompt';
import { getInstallStatus } from '../pwa/install';

const HomeNotificationPrompt: React.FC = () => {
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { canPromptInstall, promptInstall, isInstalling } = useInstallPrompt();

  const isNotificationSupported = typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function';
  const isServiceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  const installStatus = getInstallStatus(canPromptInstall);

  const safeSessionStorageGet = (key: string) => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeSessionStorageSet = (key: string, value: string) => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      sessionStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsIOS(isIos());

    if (!user) return;
    if (safeSessionStorageGet('homeNotificationPromptShown')) return;
    if (!isNotificationSupported || Notification.permission !== 'default') return;

    let timerId: number | undefined;
    let cancelled = false;

    const init = async () => {
      let subscribed = false;
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          subscribed = !!sub;
        }
      } catch { /* ignore */ }
      if (cancelled) return;
      if (subscribed) return;
      timerId = window.setTimeout(() => {
        if (!cancelled) setShow(true);
      }, 2000);
    };
    void init();

    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [user, isNotificationSupported]);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      if (!isNotificationSupported) {
        alert('Notifications are not supported in this browser.');
        setLoading(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission denied. You can enable it in browser settings.');
        setShow(false);
        safeSessionStorageSet('homeNotificationPromptShown', 'true');
        return;
      }

      // Wait for service worker with timeout to avoid hanging
      let registration: ServiceWorkerRegistration | null = null;
      try {
        const swReadyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Service worker timeout')), 5000);
        });
        registration = await Promise.race([swReadyPromise, timeoutPromise]) as ServiceWorkerRegistration;
      } catch (swError: any) {
        console.error('[HomeNotificationPrompt] Service worker not ready:', swError);
        alert('Push notifications require a service worker. The service worker is not available or failed to start. Please refresh the page and try again, or check your browser settings.');
        setLoading(false);
        return;
      }

      if (!isServiceWorkerSupported) {
        alert('Push notifications are not available in this browser. Please use a supported browser with service worker support.');
        setLoading(false);
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        alert('VAPID public key is missing. Please contact support.');
        setLoading(false);
        return;
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      let subscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      } catch (subError: any) {
        console.error('[HomeNotificationPrompt] Push subscription failed:', subError);
        alert('Failed to subscribe to push notifications: ' + (subError?.message || 'Unknown error'));
        setLoading(false);
        return;
      }

      const hasProfile = await doesUserProfileExist(user!.id);
      if (!hasProfile) {
        alert('Your account is still being initialized. Please refresh the page and try again.')
        setLoading(false)
        return
      }

      const subJson = subscription.toJSON() as any;
      const expirationTime = (subscription as any).expirationTime
        ? new Date((subscription as any).expirationTime).toISOString()
        : null;

      const { error } = await supabase
        .from('web_push_subscriptions')
        .upsert(
          {
            user_id: user!.id,
            endpoint: subscription.endpoint || subJson.endpoint,
            p256dh_key: subJson.keys?.p256dh,
            auth_key: subJson.keys?.auth,
            expiration_time: expirationTime,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            is_active: true,
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        console.error('Failed to save subscription:', error);
        alert('Failed to save notification settings. Please try again.');
        setLoading(false);
        return;
      }

      await supabase
        .from('user_profiles')
        .update({ push_notifications_enabled: true })
        .eq('id', user!.id);

      setShow(false);
      safeSessionStorageSet('homeNotificationPromptShown', 'true');
      alert('Notifications enabled! You will receive alerts for messages and city updates.');
    } catch (err: any) {
      console.error('Notification enable failed:', err);
      alert('Failed to enable notifications: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    // Use the proper PWA install prompt system
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        alert('Install in progress! Add Mai Troll to your home screen for quick access.');
      }
      setShow(false);
      safeSessionStorageSet('homeNotificationPromptShown', 'true');
    } else if (isIOS()) {
      // iOS: show manual instructions
      alert('On iOS, use Safari\'s Share button → "Add to Home Screen" to install Mai Troll.');
      setShow(false);
      safeSessionStorageSet('homeNotificationPromptShown', 'true');
    } else {
      // Desktop or unsupported — try browser menu
      alert('Look for the install icon ⊡ in Chrome/Edge menu (three dots) to install Mai Troll.');
      setShow(false);
      safeSessionStorageSet('homeNotificationPromptShown', 'true');
    }
  };

  const handleDismiss = () => {
    setShow(false);
    safeSessionStorageSet('homeNotificationPromptShown', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Stay in the Loop</h2>
          <p className="text-slate-300 mb-2">
            Enable notifications to get instant alerts for messages, live streams, and city updates.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleEnableNotifications}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            {loading ? 'Enabling...' : 'Enable Notifications'}
          </button>

          {/* Android / Chrome: Show native install prompt button */}
          {installStatus === 'prompt-available' ? (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-purple-500/20"
            >
              {isInstalling ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Install Mai Troll App
                </>
              )}
            </button>
          ) : installStatus === 'ios-manual' || (isIOS && installStatus !== 'prompt-available') ? (
            <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-white">Save to Home Screen</span>
              </div>
              <p className="text-sm text-slate-300 mb-3">
                iPhone and iPad install requires manual home screen saving from Safari.
              </p>
              <div className="flex items-start gap-3 bg-slate-900/70 rounded-lg p-3 mb-4">
                <div className="flex flex-col items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-slate-400">
                    <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M8 21h8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 17v4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  <span className="text-xs text-slate-400">Safari</span>
                </div>
                <div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    1. Tap the <span className="text-cyan-400">Share</span> icon. <br/>
                    2. Choose <span className="text-cyan-400">Add to Home Screen</span>. <br/>
                    3. Tap <span className="text-cyan-400">Add</span> to finish.
                  </p>
                </div>
              </div>
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Show iOS Install Instructions
              </button>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          You can manage these later in Profile Settings.
        </p>
      </div>
    </div>
  );
};

export default HomeNotificationPrompt;
