export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export interface ConsentState {
  hasConsented: boolean;
  preferences: ConsentPreferences;
  timestamp: number;
  version: string;
}

export const CONSENT_STORAGE_KEY = 'maitroll_consent';
export const CONSENT_VERSION = '1.0';

export const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

export function getStoredConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredConsent(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return;
  const state: ConsentState = {
    hasConsented: true,
    preferences,
    timestamp: Date.now(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
}

export function clearStoredConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONSENT_STORAGE_KEY);
}

export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.preferences.analytics === true;
}

export function hasMarketingConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.preferences.marketing === true;
}

export function hasPreferencesConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.preferences.preferences === true;
}