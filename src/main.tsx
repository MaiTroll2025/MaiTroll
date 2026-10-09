import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import './styles/pwa-mobile.css'
import './styles/broadcast-responsive.css'
import './styles/mobile-theme.css'
import './styles/broadcast-themes.css'
import './styles/battle-themes.css'
import './styles/leaflet.css'
import { AuthProvider } from './contexts/AuthProvider'
 import { GlobalAppProvider } from './contexts/GlobalAppContext'
import { GlobalEventProvider } from './contexts/GlobalEventContext'
import { ConsentProvider } from './contexts/ConsentContext'
import ConsentBanner from './components/ConsentBanner'
import AprilFoolsProvider from './components/april-fools/AprilFoolsProvider'
import { EasterEggHuntProvider } from './contexts/EasterEggHuntContext'
import { PWAProvider } from './contexts/PWAContext'
import { supabase } from './lib/supabase';
  import { initMobilePlatform, isMobilePlatform } from './lib/mobilePlatform'
 import { reportBug, reportFetchError } from './lib/bugReporter'

 // App version for cache busting
const env = import.meta.env
const APP_VERSION =
  (env.VITE_APP_VERSION as string | undefined) ||
  (env.VITE_PUBLIC_APP_VERSION as string | undefined) ||
  '1.0.0'

const BUG_CENTER_DEDUPE_WINDOW_MS = 30_000
const reportedBugHashes = new Map<string, number>()

// Circuit breaker: when Supabase is down (522 errors), stop reporting bugs
// to avoid infinite loops (failed report -> reportBug -> failed report -> ...)
let bugReportCircuitBreakerTripped = false
let bugReportCircuitBreakerResetAt = 0
const CIRCUIT_BREAKER_COOLDOWN_MS = 120_000 // 2 minutes

const isBugReportCircuitBreakerTripped = () => {
  if (!bugReportCircuitBreakerTripped) return false
  if (Date.now() > bugReportCircuitBreakerResetAt) {
    bugReportCircuitBreakerTripped = false
    return false
  }
  return true
}

const getBugCenterErrorKey = (errorLike: unknown) => {
  const message = String((errorLike as any)?.message || errorLike || '').trim()
  const stack = String((errorLike as any)?.stack || '').trim()
  const route = typeof window !== 'undefined' ? window.location.pathname : ''
  const userId = String(((supabase.auth as any)?.user?.id) || '')
  return [message, stack, route, userId].join('|')
}

const shouldReportBugCenterError = (errorLike: unknown) => {
  const key = getBugCenterErrorKey(errorLike)
  const now = Date.now()
  const previous = reportedBugHashes.get(key)
  if (previous && now - previous < BUG_CENTER_DEDUPE_WINDOW_MS) {
    return false
  }
  reportedBugHashes.set(key, now)
  return true
}

const shouldIgnoreBugCenterError = (errorLike: unknown) => {
  const text = String((errorLike as any)?.message || errorLike || '').toLowerCase()
  const stack = String((errorLike as any)?.stack || '').toLowerCase()
  return (
    text.includes('analytics.google.com') ||
    text.includes('googletagmanager.com') ||
    text.includes('google-analytics.com') ||
    text.includes('/g/collect') ||
    text.includes('/collect?v=2') ||
    // Auth token expiration is normal — not a bug
    text.includes('refresh_token_not_found') ||
    text.includes('invalid refresh token') ||
    text.includes('refresh token not found') ||
    // Service worker registration rejections — non-critical, handled by PWA context
    stack.includes('serviceworker') ||
    stack.includes('service-worker') ||
    (text.includes('rejected') && stack.includes('register'))
  )
}

// Initialize mobile platform features (Capacitor)
if (isMobilePlatform) {
  console.log('[Main] Running on native mobile platform');
  initMobilePlatform().catch((error) => {
    console.error('[Main] Failed to initialize mobile platform:', error);
  });
}

// ── iOS / WKWebView / In-App Browser navigator.mediaDevices runtime guard ──
// Capacitor WKWebView and some in-app browsers may clobber navigator.mediaDevices
// AFTER the page-loaded script has run.  Re-check here and rebuild if missing.
(function () {
  if (typeof navigator === 'undefined') return;
  const hasWebkit =
    typeof (navigator as any).webkitGetUserMedia === 'function' ||
    typeof (navigator as any).webkitGetDisplayMedia === 'function';
  const hasStandard =
    typeof navigator.mediaDevices !== 'undefined' &&
    !!navigator.mediaDevices.getUserMedia;

  if (!hasStandard && hasWebkit) {
    console.info('[iOS Guard] navigator.mediaDevices missing after bootstrap, rebuilding from webkit shims');
    const MD: any = {};

    if (typeof (navigator as any).webkitGetUserMedia === 'function') {
      MD.getUserMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return (navigator as any).webkitGetUserMedia!(constraints);
      };
    }

    if (typeof (navigator as any).webkitGetDisplayMedia === 'function') {
      MD.getDisplayMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return (navigator as any).webkitGetDisplayMedia!(constraints);
      };
    }

    if (typeof navigator.mediaDevices !== 'undefined' &&
        typeof navigator.mediaDevices.enumerateDevices === 'function') {
      MD.enumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: MD,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    console.info('[iOS Guard] navigator.mediaDevices rebuilt successfully');
  }
})();

// App version guard - clear storage on deploy
try {
  const storedVersion = localStorage.getItem('app_version')
  if (storedVersion !== APP_VERSION) {
    console.log('App version changed, clearing storage')
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('app_version', APP_VERSION)
  }
} catch (error) {
  console.warn('Unable to evaluate app version guard', error)
}

  if (typeof window !== 'undefined') {
   (window as any).__ENV = env

    // =================================================================
    // CONSENT-GATED ANALYTICS & TELEMETRY INITIALIZATION
    //
    // Google Analytics and internal telemetry must NOT initialize until
    // the user has given analytics consent. Both are checked against the
    // stored consent preference so that consent given on a later page
    // load (or changed later) is respected.
    //
    // The consent-changed event is dispatched by ConsentContext whenever
    // the user accepts/rejects updates preferences.
    // =================================================================
    import('./lib/consent').then(({ hasAnalyticsConsent }) => {
      if (hasAnalyticsConsent()) {
        import('./lib/telemetry').then(({ initTelemetry }) => {
          try { initTelemetry(); } catch { /* silent: analytics */ }
        });
        import('./lib/googleAnalytics').then(({ initializeAnalyticsIfConsented }) => {
          void initializeAnalyticsIfConsented();
        });
      }
    });

    window.addEventListener('consent-changed', () => {
      import('./lib/consent').then(({ hasAnalyticsConsent }) => {
        if (hasAnalyticsConsent()) {
          import('./lib/telemetry').then(({ initTelemetry }) => {
            try { initTelemetry(); } catch { /* silent */ }
          });
          import('./lib/googleAnalytics').then(({ initializeAnalyticsIfConsented }) => {
            void initializeAnalyticsIfConsented();
          });
        } else {
          import('./lib/telemetry').then(({ resetTelemetry }) => {
            try { resetTelemetry(); } catch { /* silent */ }
          });
          import('./lib/googleAnalytics').then(({ resetGoogleAnalytics }) => {
            try { resetGoogleAnalytics(); } catch { /* silent */ }
          });
        }
      });
    });

    // ================================================================
   // GLOBAL ERROR CATCHERS - Universal Bug Catcher
   // ================================================================

   // Catch unhandled JavaScript errors
const isExpectedDevNoise = (errorLike: unknown) => {
      const error = errorLike as any
      const message = String(
        error?.message ||
        error?.reason?.message ||
        errorLike ||
        ''
      ).toLowerCase()

      return (
        message.includes('aborterror') ||
        message.includes('operation was aborted') ||
        message.includes('signal is aborted') ||
        message.includes('lock request is aborted') ||
        error?.name === 'AbortError' ||
        message.includes('@vite/client') ||
        message.includes('vite') && message.includes('ping') ||
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('failed to fetch') && env.DEV
      )
    }

    // Track reported HTTP 0 errors for deduplication
    const reportedHttpZeroErrors = new Set<string>()

   window.addEventListener('error', (event: ErrorEvent) => {
     const error = event.error || event.message;
     if (isExpectedDevNoise(error) || shouldIgnoreBugCenterError(error)) {
       if (env.DEV) console.debug('[BugCenter] ignored expected dev/browser error', error)
       return
     }
     if (!shouldReportBugCenterError(error)) return
     if (isBugReportCircuitBreakerTripped()) return
     reportBug(error, {
       source: 'frontend',
       severity: 'high',
       functionName: 'globalErrorHandler',
     });
   });

   // Catch unhandled promise rejections
   window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
     const error = event.reason;
     if (isExpectedDevNoise(error) || shouldIgnoreBugCenterError(error)) {
       if (env.DEV) console.debug('[BugCenter] ignored expected rejection', error)
       return
     }
     if (!shouldReportBugCenterError(error)) return
     if (isBugReportCircuitBreakerTripped()) return
     reportBug(error, {
       source: 'frontend',
       severity: 'high',
       functionName: 'globalUnhandledRejection',
     });
   });

const isBugReporterRequest = (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()

      return url.includes('/rpc/log_app_bug_report') || url.includes('/app_bug_reports')
    }

const shouldIgnoreNetworkErrorForBugCenter = (url: string) => {
  return (
    url.includes('analytics.google.com') ||
    url.includes('googletagmanager.com') ||
    url.includes('google-analytics.com') ||
    url.includes('google.com/measurement/conversion') ||
    url.includes('googleadservices.com') ||
    url.includes('doubleclick.net') ||
    url.includes('/g/collect') ||
    url.includes('/collect?v=2') ||
    url.includes('facebook.net') ||
    url.includes('connect.facebook.net') ||
// Non-critical catalog fetches with graceful fallback — already caught by callers
     url.includes('/rest/v1/profile_frames') ||
      // native_push_tokens upsert runs on every phone app start; a 403 from a
      // missing/mismatched RLS policy is non-critical and saveToken already
      // swallows the error. Don't let it spam the Bug Center.
      url.includes('/rest/v1/native_push_tokens')
  )
}

// Note: We only log actual failed responses here; validation errors should be logged at call site
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlString =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input || '')

      // Bypass global fetch logging for Supabase Edge Functions
      // to avoid interference with critical auth flows like Terms agreement
      const isSupabaseFunction = urlString.includes('/functions/v1/')

      try {
        const response = await originalFetch(input, init);
        if (!response.ok && !isSupabaseFunction) {
          // Bypass bug-center reporting for the bug reporter's own RPC calls
          // to prevent recursive error loops (failed report -> reportBug ->
          // failed report -> ...). The isBugReporterRequest helper was
          // defined but never wired up, which caused log_app_bug_report
          // failures (e.g. P0001 "Authentication required") to be reported
          // as new bugs.
          if (shouldIgnoreNetworkErrorForBugCenter(urlString) || isBugReporterRequest(urlString)) {
            return response;
          }
          // Detect Supabase/Cloudflare 522 (connection timeout) and trip circuit breaker
          // to prevent infinite bug-report loops
          if (response.status === 522) {
            bugReportCircuitBreakerTripped = true
            bugReportCircuitBreakerResetAt = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS
            console.warn('[BugCenter] Circuit breaker tripped: Supabase returning 522. Bug reporting paused for 2 min.')
            return response
          }
          // Handle HTTP 0 (network/CORS/insecure context/aborted) - classify appropriately
          if (response.status === 0) {
            const errorKey = `http0_${urlString}`;
            // Deduplicate HTTP 0 errors - only report once per URL per session
            if (!reportedHttpZeroErrors.has(errorKey)) {
              reportedHttpZeroErrors.add(errorKey);
              
              // Add context for network/CORS issues
              const networkContext = {
                source: 'frontend',
                severity: 'medium',
                functionName: 'globalFetchWrapper',
                table: 'network_cors',
                current_origin: window.location.origin,
                request_url: urlString,
                navigator_onLine: navigator.onLine,
                is_secure_context: window.isSecureContext,
              };
              
              // In dev/localhost, just log - don't spam Bug Center
              if (env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('[BugCenter] HTTP 0 (network/CORS) error:', urlString, {
                  onLine: navigator.onLine,
                  isSecureContext: window.isSecureContext,
                  origin: window.location.origin,
                });
              } else if (!isBugReportCircuitBreakerTripped()) {
                reportBug(new Error(`HTTP 0 - Network/CORS error: ${urlString}`), networkContext);
              }
              return response;
            }
          }
          // Clone response to read body without consuming it
          const cloned = response.clone();
          cloned.text().then(rawText => {
            reportFetchError(
              response,
              rawText,
              {
                source: 'frontend',
                severity: response.status >= 500 ? 'high' : 'medium',
                functionName: 'globalFetchWrapper',
              }
            );
          }).catch(() => {
            // Ignore errors reading body
          });
        }
        return response;
       } catch (error: any) {
        if (shouldIgnoreNetworkErrorForBugCenter(urlString) || isBugReporterRequest(urlString)) {
          throw error
        }

        if (!isSupabaseFunction && !isExpectedDevNoise(error) && !shouldIgnoreBugCenterError(error)) {
          if (!shouldReportBugCenterError(error)) throw error
          
          const errorContext: any = {
            source: 'frontend',
            severity: 'high',
            functionName: 'globalFetchWrapper',
            table: 'network_error',
            current_origin: window.location.origin,
            request_url: urlString,
            navigator_onLine: navigator.onLine,
            is_secure_context: window.isSecureContext,
          };
          
          if (error.name === 'TypeError') {
            // TypeError can indicate CORS, network offline, or insecure context
            const msg = String(error.message || '').toLowerCase();
            if (msg.includes('failed to fetch') || msg.includes('network')) {
              errorContext.table = 'network_cors';
              // In dev/localhost, downgrade severity and just log
              if (env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('[BugCenter] Network error in dev:', urlString, {
                  onLine: navigator.onLine,
                  isSecureContext: window.isSecureContext,
                });
                throw error;
              }
            } else {
              errorContext.table = 'fetch_type_error';
            }
          }
          
          // Enhance error message with URL info
          const enhancedError = new Error(`${error.message} (URL: ${urlString})`);
          enhancedError.name = error.name;
          enhancedError.stack = error.stack;
          
          // Don't report if circuit breaker is tripped (Supabase is down)
          if (!isBugReportCircuitBreakerTripped()) {
            reportBug(enhancedError, errorContext);
          }
        }
        throw error;
      }
    };


    // Clean up any stale service workers from previous builds that may
    // intercept or block network requests (including edge function calls).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) {
          console.log('[main] Unregistering stale service worker:', r.active?.scriptURL)
          r.unregister().catch(() => {})
        }
      }).catch(() => {})
    }

   // Initialize offline notification system
   // This will deliver queued notifications when user comes back online
   // initializeOfflineNotifications()
  }

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

if (typeof window !== 'undefined') {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  const isHttps = window.location.protocol === 'https:'

  // In prod, only register SW on HTTPS and not on localhost preview unless explicitly forced.
  // In dev, only register if explicitly enabled.
  const forceLocalhostSw = localStorage.getItem('force_sw') === '1'
  const _enableDevSw = env.DEV && localStorage.getItem('enable_sw_dev') === '1'
  const _enableProdSw = env.PROD && (isHttps && (!isLocalhost || forceLocalhostSw))

   // PWA registration is handled by vite-plugin-pwa via VitePWA in vite.config.ts
   console.log('[SW] registration config', {
     dev: !!env.DEV,
     prod: !!env.PROD,
     host: window.location.hostname,
     protocol: window.location.protocol,
   })
  }

 const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - balance between freshness and reduced fetches
      gcTime: 15 * 60 * 1000, // 15 minutes - keep inactive queries longer
      refetchOnMount: false, // Don't refetch on mount if cache exists
      refetchOnReconnect: true, // Refetch when reconnecting
      refetchOnWindowFocus: false, // Disabled to prevent bursts when switching tabs
      retry: 1, // Allow one retry on failure
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchIntervalInBackground: false, // Don't refetch in background tabs
    },
    mutations: {
      retry: 1, // Allow one retry on mutation failure
      retryDelay: 1000,
    },
  },
})

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      
      <HelmetProvider>
        <AuthProvider>
          <GlobalAppProvider>
            <GlobalEventProvider>
              <ConsentProvider>
                <AprilFoolsProvider>
                  <PWAProvider>
                    <EasterEggHuntProvider>
                      <App />
                      <ConsentBanner />
                    </EasterEggHuntProvider>
                  </PWAProvider>
                </AprilFoolsProvider>
              </ConsentProvider>
            </GlobalEventProvider>
          </GlobalAppProvider>
        </AuthProvider>
      </HelmetProvider>
       
    </BrowserRouter>
  </QueryClientProvider>
)
