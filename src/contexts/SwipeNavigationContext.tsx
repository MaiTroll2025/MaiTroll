import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type SwipeDirection = 'left' | 'right' | null;

interface SwipeNavigationContextValue {
  direction: SwipeDirection;
  setDirection: (dir: SwipeDirection) => void;
}

const SwipeNavigationContext = createContext<SwipeNavigationContextValue | null>(null);

export function SwipeNavigationProvider({ children }: { children: React.ReactNode }) {
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const directionRef = useRef<SwipeDirection>(null);

  const stableSetDirection = useCallback((dir: SwipeDirection) => {
    directionRef.current = dir;
    setDirection(dir);
  }, []);

  return (
    <SwipeNavigationContext.Provider value={{ direction, setDirection: stableSetDirection }}>
      {children}
    </SwipeNavigationContext.Provider>
  );
}

export function useSwipeNavigation() {
  const ctx = useContext(SwipeNavigationContext);
  if (!ctx) {
    return { direction: null as SwipeDirection, setDirection: () => {} };
  }
  return ctx;
}

export const useSwipeNavigationProvider = useSwipeNavigation;
