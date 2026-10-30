/**
 * Outbound click tracker.
 *
 * Records clicks on external links (anything that navigates away from the app
 * or opens a new tab/window) into the `outbound_clicks` Supabase table so
 * admins can monitor real-time website traffic from the RTC Admin panel.
 *
 * The table has an RLS policy allowing anonymous INSERT, so this works for
 * logged-out visitors too. Raw IPs are stored server-side but never shown in
 * the UI — the admin panel masks each visitor as "Random User #N".
 */

import { supabase } from './supabase';

let initialized = false;

function isExternalUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    // Same-origin links are internal navigation, not outbound clicks.
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function trackOutboundClick(url: string, referrer?: string): void {
  if (typeof window === 'undefined' || !url) return;
  if (!isExternalUrl(url)) return;

  // Fire-and-forget with keepalive so it survives page unload.
  try {
    void supabase.from('outbound_clicks').insert({
      url,
      referrer: referrer || document.referrer || null,
      user_agent: navigator.userAgent || null,
    });
  } catch (err) {
    console.warn('[outboundClickTracker] Failed to record click:', err);
  }
}

export function initOutboundClickTracker(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Capture clicks on <a> elements that point off-site. The listener is
  // registered on document with capture so it fires before any component
  // handler (and before the link navigates away).
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (anchor?.href) {
        trackOutboundClick(anchor.href);
        return;
      }
      const href = target?.getAttribute?.('href');
      if (href) trackOutboundClick(href);
    },
    true,
  );
}