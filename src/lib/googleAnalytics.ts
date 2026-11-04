const GA_MEASUREMENT_ID = 'G-3XKLTEJ3ZR';
const GA_DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

import { hasAnalyticsConsent } from './consent';

let gaInitialized = false;

export function initGoogleAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (gaInitialized) return;
  if (!window.gtag) return;

  window[GA_DISABLE_KEY] = false;
  gaInitialized = true;

  window.dataLayer = window.dataLayer || [];
   window.gtag = function gtag(...args: any[]) {
     window.dataLayer.push(args);
   };
  window.gtag('js', new Date());
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
  });
  window.gtag('config', GA_MEASUREMENT_ID, {
    cookie_domain: window.location.hostname,
    cookie_expires: 63072000,
    cookie_update: false,
    send_page_view: true,
  });
}

export function loadGoogleAnalyticsScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[data-maitroll-google-analytics="${GA_MEASUREMENT_ID}"]`,
  );
  if (existingScript) return Promise.resolve();

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.dataset.maitrollGoogleAnalytics = GA_MEASUREMENT_ID;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export async function initializeAnalyticsIfConsented(): Promise<void> {
  if (typeof window === 'undefined') return;
  const consent = hasAnalyticsConsent();
  if (!consent) return;
  await loadGoogleAnalyticsScript();
  initGoogleAnalytics();
}

export function gtagSendEvent(action: string, params: Record<string, any> = {}): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  if (!gaInitialized) return;
  window.gtag('event', action, params);
}

export function resetGoogleAnalytics(): void {
  if (typeof window !== 'undefined') {
    window[GA_DISABLE_KEY] = true;
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
  }
  gaInitialized = false;
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}