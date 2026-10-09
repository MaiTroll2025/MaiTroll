import { createContext, useContext } from 'react';
import type { ConsentContextType } from '../contexts/ConsentContext';

export const ConsentContext = createContext<ConsentContextType | null>(null);

export function useConsent(): ConsentContextType {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}

export function useConsentValue<K extends keyof ConsentContextType>(key: K): ConsentContextType[K] {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsentValue must be used within a ConsentProvider');
  }
  return context[key];
}
