import { createContext, useContext } from 'react';
import type { SwipeDirection } from '../contexts/SwipeNavigationContext';

interface SwipeNavigationContextValue {
  direction: SwipeDirection;
  setDirection: (dir: SwipeDirection) => void;
}

export const SwipeNavigationContext = createContext<SwipeNavigationContextValue | null>(null);

export function useSwipeNavigation() {
  const ctx = useContext(SwipeNavigationContext);
  if (!ctx) {
    return { direction: null as SwipeDirection, setDirection: () => {} };
  }
  return ctx;
}

export const useSwipeNavigationProvider = useSwipeNavigation;
