import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  ConsentState,
  ConsentPreferences,
  CONSENT_VERSION,
  DEFAULT_PREFERENCES,
  getStoredConsent,
  setStoredConsent,
  clearStoredConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  hasPreferencesConsent,
} from '../lib/consent';
import { ConsentContext } from '../hooks/useConsent';

export interface ConsentContextType {
  consent: ConsentState | null;
  hasConsented: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  updatePreferences: (preferences: Partial<ConsentPreferences>) => void;
  resetConsent: () => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  canInitializeAnalytics: boolean;
  canInitializeMarketing: boolean;
  canInitializePreferences: boolean;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    setConsent(stored);
    setShowBanner(!stored);
    setHydrated(true);
  }, []);

  const acceptAll = useCallback(() => {
    const preferences: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    setStoredConsent(preferences);
    setConsent({
      hasConsented: true,
      preferences,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    });
    setShowBanner(false);
    window.dispatchEvent(new CustomEvent('consent-changed', { detail: { preferences } }));
  }, []);

  const rejectNonEssential = useCallback(() => {
    const preferences: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    setStoredConsent(preferences);
    setConsent({
      hasConsented: true,
      preferences,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    });
    setShowBanner(false);
    window.dispatchEvent(new CustomEvent('consent-changed', { detail: { preferences } }));
  }, []);

  const updatePreferences = useCallback((newPrefs: Partial<ConsentPreferences>) => {
    const current = consent?.preferences || DEFAULT_PREFERENCES;
    const preferences: ConsentPreferences = {
      necessary: true,
      analytics: newPrefs.analytics ?? current.analytics,
      marketing: newPrefs.marketing ?? current.marketing,
      preferences: newPrefs.preferences ?? current.preferences,
    };
    setStoredConsent(preferences);
    setConsent({
      hasConsented: true,
      preferences,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    });
    setShowBanner(false);
    window.dispatchEvent(new CustomEvent('consent-changed', { detail: { preferences } }));
  }, [consent]);

  const resetConsent = useCallback(() => {
    clearStoredConsent();
    setConsent(null);
    setShowBanner(true);
    window.dispatchEvent(new CustomEvent('consent-reset'));
  }, []);

  const value: ConsentContextType = {
    consent,
    hasConsented: !!consent,
    acceptAll,
    rejectNonEssential,
    updatePreferences,
    resetConsent,
    showBanner: hydrated && showBanner,
    setShowBanner,
    canInitializeAnalytics: hasAnalyticsConsent(),
    canInitializeMarketing: hasMarketingConsent(),
    canInitializePreferences: hasPreferencesConsent(),
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
}
